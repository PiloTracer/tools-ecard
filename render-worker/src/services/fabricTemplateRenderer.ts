/**
 * Server-side template renderer using node-canvas.
 * Renders Fabric-style template JSON (text + shapes + background) to PNG.
 */

import { createCanvas, loadImage, type CanvasRenderingContext2D } from 'canvas';
import QRCode from 'qrcode';

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
  [key: string]: string | null | undefined;
}

const FIELD_ID_TO_PROPERTY: Record<string, keyof RecordFieldValues> = {
  full_name: 'fullName',
  first_name: 'firstName',
  last_name: 'lastName',
  email: 'email',
  work_phone: 'workPhone',
  work_phone_ext: 'workPhoneExt',
  mobile_phone: 'mobilePhone',
  business_name: 'businessName',
  business_title: 'businessTitle',
};

function resolveText(element: TemplateElementJson, record?: RecordFieldValues): string {
  if (element.fieldId && record) {
    const key = FIELD_ID_TO_PROPERTY[element.fieldId] ?? (element.fieldId as keyof RecordFieldValues);
    const value = record[key];
    if (value != null && String(value).trim() !== '') {
      // Use stored value as-is — casing is fixed at ingest; user edits must be preserved.
      return String(value);
    }
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

function drawText(
  ctx: CanvasRenderingContext2D,
  element: TemplateElementJson,
  record?: RecordFieldValues
) {
  const text = resolveText(element, record);
  if (!text) return;

  const fontSize = element.fontSize ?? 16;
  const fontFamily = element.fontFamily ?? 'sans-serif';
  const weight = element.fontWeight === 'bold' ? 'bold' : 'normal';
  const style = element.fontStyle === 'italic' ? 'italic' : 'normal';
  ctx.font = `${style} ${weight} ${fontSize}px ${fontFamily}`;
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
  const dataUrl = await QRCode.toDataURL(element.data, {
    width: size,
    margin: 1,
    color: {
      dark: element.colorDark ?? '#000000',
      light: element.colorLight ?? '#ffffff',
    },
  });
  const img = await loadImage(dataUrl);
  applyRotation(ctx, element.x, element.y, size, size, element.rotation ?? 0, () => {
    ctx.drawImage(img, element.x, element.y, size, size);
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

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = template.backgroundColor ?? '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.save();
  ctx.scale(scaleX, scaleY);

  for (const element of template.elements) {
    if (element.excludeFromExport) continue;
    const prevAlpha = ctx.globalAlpha;
    if (element.opacity != null) ctx.globalAlpha = element.opacity;

    if (element.type === 'text') {
      drawText(ctx, element, record);
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
