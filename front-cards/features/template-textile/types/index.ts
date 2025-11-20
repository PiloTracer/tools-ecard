// Core template types for template-textile feature

export interface BaseElement {
  id: string;
  type: 'text' | 'image' | 'qr' | 'shape';
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
  // Line metadata for visibility and reordering logic
  lineGroup?: string; // e.g., 'contact-line-1', 'contact-line-2'
  requiredFields?: string[]; // vCard fields required for this line to be visible
  linePriority?: number; // Priority for reordering (1, 2, 3...)
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  textAlign?: 'left' | 'center' | 'right';
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  underline?: boolean;
  stroke?: string;
  strokeWidth?: number;
  fieldId?: string; // vCard field identifier (e.g., 'full_name', 'business_title')
}

export interface ImageElement extends BaseElement {
  type: 'image';
  width: number;
  height: number;
  imageUrl: string;
  scaleMode?: 'fill' | 'fit' | 'stretch';
}

export interface QRElement extends BaseElement {
  type: 'qr';
  size: number;
  data: string;
  qrType: 'url' | 'text' | 'vcard';
  colorDark?: string;
  colorLight?: string;
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shapeType: 'rectangle' | 'circle' | 'ellipse' | 'line';
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export type TemplateElement = TextElement | ImageElement | QRElement | ShapeElement;

export interface Template {
  id: string;
  name: string;
  width: number;
  height: number;
  elements: TemplateElement[];
  createdAt: Date;
  updatedAt: Date;
}

// Helper type guards
export const isTextElement = (el: TemplateElement): el is TextElement => el.type === 'text';
export const isImageElement = (el: TemplateElement): el is ImageElement => el.type === 'image';
export const isQRElement = (el: TemplateElement): el is QRElement => el.type === 'qr';
export const isShapeElement = (el: TemplateElement): el is ShapeElement => el.type === 'shape';
