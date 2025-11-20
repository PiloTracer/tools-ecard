// Core template types for template-textile feature

export interface BaseElement {
  id: string;
  type: 'text' | 'image' | 'qr' | 'table' | 'shape';
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
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

export interface TableElement extends BaseElement {
  type: 'table';
  rows: number;
  columns: number;
  columnWidths: number[];  // Array of widths, one per column
  rowHeights: number[];     // Array of heights, one per row
  minCellWidth?: number;    // Minimum width for cells (default: 60)
  minCellHeight?: number;   // Minimum height for cells (default: 50)
  borderColor?: string;
  borderWidth?: number;
  cells: TableCell[];
}

export interface TableCell {
  row: number;
  column: number;
  elementId?: string; // Reference to element in this cell
  offsetX?: number;   // Element X position relative to cell's top-left (default: 5px padding)
  offsetY?: number;   // Element Y position relative to cell's top-left (default: 5px padding)
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

export type TemplateElement = TextElement | ImageElement | QRElement | TableElement | ShapeElement;

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
export const isTableElement = (el: TemplateElement): el is TableElement => el.type === 'table';
export const isShapeElement = (el: TemplateElement): el is ShapeElement => el.type === 'shape';
