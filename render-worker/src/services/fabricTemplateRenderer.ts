/**
 * Server-side template renderer using node-canvas.
 * Renders Fabric-style template JSON (text + shapes + background) to PNG.
 */

import { createCanvas, loadImage, type CanvasRenderingContext2D } from 'canvas';
import QRCode from 'qrcode';
import { decodeXmlEntities } from '../utils/decodeXmlEntities';
import { ensureFontsRegistered, isBoldFontWeight } from './fontLoader';
import {
  applyLineCompaction,
  createOriginalPositionMap,
  getRecordFieldValue,
  resolveRecordProperty,
} from './lineCompaction';

export interface TemplateElementJson {
  id: string;
  type: 'text' | 'image' | 'qr' | 'shape';
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  excludeFromExport?: boolean;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  colors?: string[];
  textAlign?: 'left' | 'center' | 'right';
  fontWeight?: string;
  fontStyle?: string;
  fieldId?: string;
  sectionGroup?: string;
  lineGroup?: string;
  requiredFields?: string[];
  shapeType?: 'rectangle' | 'circle' | 'ellipse' | 'line';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  imageUrl?: string;
  clipShape?: string;
  size?: number;
  data?: string;
  colorDark?: string;
  colorLight?: string;
}

export interface TemplateJson {
  width: number;
  height: number;
  exportWidth?: number;
  exportHeight?: number;
  backgroundColor?: string;
  elements: TemplateElementJson[];
}

export interface RecordFieldValues {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  workPhone?: string | null;
  workPhoneExt?: string | null;
  mobilePhone?: string | null;
  businessName?: string | null;
  businessTitle?: string | null;
  addressStreet?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostal?: string | null;
  addressCountry?: string | null;
  socialInstagram?: string | null;
  socialTwitter?: string | null;
  socialFacebook?: string | null;
  businessDepartment?: string | null;
  businessUrl?: string | null;
  businessHours?: string | null;
  businessAddressStreet?: string | null;
  businessAddressCity?: string | null;
  businessAddressState?: string | null;
  businessAddressPostal?: string | null;
  businessAddressCountry?: string | null;
  businessLinkedin?: string | null;
  businessTwitter?: string | null;
  personalUrl?: string | null;
  personalBio?: string | null;
  personalBirthday?: string | null;
  [key: string]: string | null | undefined;
}

/**
 * Resolve the text a text element renders.
 * Contract (parity with the browser batch export):
 * - Element with `fieldId` AND a record: the record value via tolerant field
 *   resolution (exact -> normalized -> `_N` suffix strip -> alias table).
 *   Missing or blank value -> '' (EMPTY STRING; the design-time placeholder is
 *   never rendered for a bound field).
 * - Element WITHOUT `fieldId`: static placeholder text, unchanged.
 */
export function resolveText(element: TemplateElementJson, record?: RecordFieldValues): string {
  if (element.fieldId && record) {
    const value = getRecordFieldValue(record, element.fieldId);
    if (value != null) {
      // Use stored value as-is — casing is fixed at ingest; user edits must be preserved.
      // Decode any XML/HTML entities left from legacy ingest paths.
      return decodeXmlEntities(value);
    }
    return '';
  }
  return element.text ?? '';
}

function applyRotation(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rotationDeg: number,
  draw: () => void
) {
  if (!rotationDeg) {
    draw();
    return;
  }
  ctx.save();
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.translate(cx, cy);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.translate(-cx, -cy);
  draw();
  ctx.restore();
}

/**
 * Fit-to-width scale factor. Contract (parity with the fixed browser export):
 * shrink-only, width-only — when the measured text exceeds the available
 * width, scale the font size down by available/measured, clamped to
 * [0.5, 1.0]. Never scales up; no vertical fitting.
 */
export function computeFitScale(measured: number, available: number): number {
  if (measured <= 0 || available <= 0 || measured <= available) return 1.0;
  return Math.max(0.5, Math.min(1.0, available / measured));
}

function drawText(
  ctx: CanvasRenderingContext2D,
  element: TemplateElementJson,
  designWidth: number,
  record?: RecordFieldValues
) {
  const text = resolveText(element, record);
  if (!text) return;

  let fontSize = element.fontSize ?? 16;
  const fontFamily = element.fontFamily ?? 'sans-serif';
  // Browser parity (fontService.variantFromTextStyle): 'bold', 700, '700'.
  const weight = isBoldFontWeight(element.fontWeight) ? 'bold' : 'normal';
  const style = element.fontStyle === 'italic' ? 'italic' : 'normal';
  ctx.font = `${style} ${weight} ${fontSize}px ${fontFamily}`;

  // Fit-to-width (see computeFitScale): shrink overflowing text toward the
  // canvas' right edge, keeping a 30px safe padding like the browser export.
  const available = designWidth - element.x - 30;
  const fitScale = computeFitScale(ctx.measureText(text).width, available);
  if (fitScale < 1) {
    fontSize = fontSize * fitScale;
    ctx.font = `${style} ${weight} ${fontSize}px ${fontFamily}`;
  }

  ctx.fillStyle = element.colors?.[0] ?? element.color ?? '#000000';
  ctx.textBaseline = 'top';

  const align = element.textAlign ?? 'left';
  ctx.textAlign = align;
  let drawX = element.x;
  if (align === 'center') drawX = element.x + (element.width ?? 0) / 2;
  if (align === 'right') drawX = element.x + (element.width ?? 0);

  applyRotation(ctx, element.x, element.y, element.width ?? 1, element.height ?? fontSize, element.rotation ?? 0, () => {
    ctx.fillText(text, drawX, element.y);
  });
}

function drawShape(ctx: CanvasRenderingContext2D, element: TemplateElementJson) {
  const w = element.width ?? 100;
  const h = element.height ?? 100;
  const fill = element.fill ?? 'transparent';
  const stroke = element.stroke ?? '#000000';
  const strokeWidth = element.strokeWidth ?? 0;

  applyRotation(ctx, element.x, element.y, w, h, element.rotation ?? 0, () => {
    ctx.beginPath();
    if (element.shapeType === 'circle') {
      const r = w / 2;
      ctx.arc(element.x + r, element.y + r, r, 0, Math.PI * 2);
    } else if (element.shapeType === 'ellipse') {
      ctx.ellipse(element.x + w / 2, element.y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    } else if (element.shapeType === 'line') {
      ctx.moveTo(element.x, element.y);
      ctx.lineTo(element.x + w, element.y + h);
    } else {
      ctx.rect(element.x, element.y, w, h);
    }
    if (fill && fill !== 'transparent') {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (strokeWidth > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
  });
}

async function drawImage(ctx: CanvasRenderingContext2D, element: TemplateElementJson) {
  if (!element.imageUrl) return;
  const img = await loadImage(element.imageUrl);
  const w = element.width ?? img.width;
  const h = element.height ?? img.height;
  applyRotation(ctx, element.x, element.y, w, h, element.rotation ?? 0, () => {
    // Apply clip shape (circle/ellipse mask)
    const clipShape = element.clipShape;
    if (clipShape && clipShape !== 'rectangle') {
      ctx.save();
      ctx.beginPath();
      const cx = element.x + w / 2;
      const cy = element.y + h / 2;
      if (clipShape === 'circle') {
        const r = Math.min(w, h) / 2;
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      } else if (clipShape === 'ellipse') {
        ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      }
      ctx.clip();
      ctx.drawImage(img, element.x, element.y, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, element.x, element.y, w, h);
    }
  });
}

async function drawQr(ctx: CanvasRenderingContext2D, element: TemplateElementJson) {
  if (!element.data) return;
  const size = element.size ?? 100;
  const w = element.width ?? size;
  const h = element.height ?? size;
  const dataUrl = await QRCode.toDataURL(element.data, {
    width: size,
    margin: 1,
    color: {
      dark: element.colorDark ?? '#000000',
      light: element.colorLight ?? '#ffffff',
    },
  });
  const img = await loadImage(dataUrl);
  applyRotation(ctx, element.x, element.y, w, h, element.rotation ?? 0, () => {
    ctx.drawImage(img, element.x, element.y, w, h);
  });
}

export async function renderTemplateToPng(
  template: TemplateJson,
  record?: RecordFieldValues
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const canvasWidth = template.exportWidth ?? template.width;
  const aspect = template.width / template.height;
  const canvasHeight = template.exportHeight ?? Math.max(1, Math.round(canvasWidth / aspect));
  const scaleX = canvasWidth / template.width;
  const scaleY = canvasHeight / template.height;

  // Pre-fill + line compaction (parity with the browser batch export):
  // 1. Replace every bound text's placeholder with the resolved record value
  //    ('' when the fieldId is unresolvable or the record value is blank).
  // 2. Remove lines left empty and move surviving lines up to fill gaps.
  const unresolvableFieldIds: string[] = [];
  let elements = template.elements.map((el) => ({ ...el }));
  if (record) {
    for (const element of elements) {
      if (element.type !== 'text' || !element.fieldId) continue;
      if (resolveRecordProperty(element.fieldId) === null && !(element.fieldId in record)) {
        if (!unresolvableFieldIds.includes(element.fieldId)) {
          unresolvableFieldIds.push(element.fieldId);
        }
      }
      element.text = resolveText(element, record);
    }
  }
  const positionMap = createOriginalPositionMap(elements);
  const { elements: compactedElements, removedLines } = applyLineCompaction(elements, positionMap, record);
  elements = compactedElements;

  // Register the design fonts referenced by the final element set before any
  // drawing (best-effort; falls back to Pango substitution on failure).
  await ensureFontsRegistered(elements);

  if (unresolvableFieldIds.length > 0 || removedLines.length > 0) {
    const removed = removedLines.map((l) => `${l.sectionGroup}:${l.lineNumber}`).join(', ');
    console.warn(
      `[Render] ${unresolvableFieldIds.length} unresolvable fieldId(s)` +
        `${unresolvableFieldIds.length > 0 ? ` [${unresolvableFieldIds.join(', ')}]` : ''}` +
        `, ${removedLines.length} line(s) removed by compaction` +
        `${removedLines.length > 0 ? ` [${removed}]` : ''}`
    );
  }

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = template.backgroundColor ?? '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.save();
  ctx.scale(scaleX, scaleY);

  for (const element of elements) {
    if (element.excludeFromExport) continue;
    const prevAlpha = ctx.globalAlpha;
    if (element.opacity != null) ctx.globalAlpha = element.opacity;

    if (element.type === 'text') {
      drawText(ctx, element, template.width, record);
    } else if (element.type === 'shape') {
      drawShape(ctx, element);
    } else if (element.type === 'image') {
      await drawImage(ctx, element);
    } else if (element.type === 'qr') {
      await drawQr(ctx, element);
    }

    ctx.globalAlpha = prevAlpha;
  }

  ctx.restore();

  return {
    buffer: canvas.toBuffer('image/png'),
    width: canvasWidth,
    height: canvasHeight,
  };
}
