/**
 * Template-Textile Feature Types
 * Types for template storage and management in SeaweedFS
 */

// Template element types matching frontend
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
  sectionGroup?: string;
  lineGroup?: string;
  requiredFields?: string[];
  linePriority?: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  color?: string;
  colors?: string[];
  textAlign?: 'left' | 'center' | 'right';
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  underline?: boolean;
  stroke?: string;
  strokeWidth?: number;
  fieldId?: string;
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

// Main template structure
export interface Template {
  id: string;
  name: string;
  width: number;
  height: number;
  elements: TemplateElement[];
  createdAt: Date;
  updatedAt: Date;
}

// Template metadata stored in S3
export interface TemplateMetadata {
  id: string;
  name: string;
  projectName: string;
  userId: string;
  version: number;
  width: number;
  height: number;
  elementCount: number;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy?: string;
  tags?: string[];
  description?: string;
}

// Template storage structure
export interface StoredTemplate {
  metadata: TemplateMetadata;
  template: Template;
  resources?: TemplateResource[];
}

// Template resource (images, fonts, etc.)
export interface TemplateResource {
  id: string;
  type: 'image' | 'font' | 'svg' | 'other';
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
}

// Save template request
export interface SaveTemplateRequest {
  templateName: string;
  projectName: string;
  template: Template;
  resources?: TemplateResource[];
}

// List templates response
export interface ListTemplatesResponse {
  templates: TemplateMetadata[];
  total: number;
  page: number;
  pageSize: number;
}

// Template version info
export interface TemplateVersion {
  version: number;
  createdAt: string;
  createdBy: string;
  changeDescription?: string;
  size: number;
}

// Template permissions
export interface TemplatePermissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canShare: boolean;
}