// Backend type definitions for template-textile feature

export interface Template {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  type: 'vcard' | 'qr_square' | 'qr_vertical';
  status: 'draft' | 'active' | 'archived';
  backgroundUrl?: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  exportFormat: 'jpg' | 'png';
  exportDpi: number;
  phonePrefix?: string;
  extensionLength?: number;
  websiteUrl?: string;
  brandColors: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateElement {
  id: string;
  type: 'text' | 'image' | 'qr' | 'table';
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
  visible?: boolean;
  zIndex?: number;
}

export interface TextElement extends TemplateElement {
  type: 'text';
  field: string;
  content?: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  color: string;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
  maxWidth?: number;
  maxLines?: number;
  autoFit?: {
    enabled: boolean;
    minSize: number;
    maxSize: number;
    singleLine?: boolean;
  };
  styleRules?: Array<{
    type: 'firstWord' | 'lastWord' | 'wordIndex' | 'pattern';
    value?: string | number;
    color?: string;
    fontWeight?: number;
    fontSize?: number;
  }>;
}

export interface ImageElement extends TemplateElement {
  type: 'image';
  assetUrl: string;
  field?: string;
  scaleMode?: 'fill' | 'fit' | 'stretch';
  visibilityField?: string;
  dynamicPosition?: {
    xField?: string;
    yField?: string;
    formula?: string;
  };
}

export interface QRElement extends TemplateElement {
  type: 'qr';
  field: string;
  qrType: 'url' | 'text' | 'vcard' | 'email' | 'phone';
  size: number;
  margin: number;
  colorDark: string;
  colorLight: string;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
  logo?: {
    url: string;
    size: number;
  };
}

export interface TableElement extends TemplateElement {
  type: 'table';
  rows: number;
  columns: number;
  cellWidth: number;
  cellHeight: number;
  borderWidth?: number;
  borderColor?: string;
  backgroundColor?: string;
  autoCollapse?: boolean;
  cells: Array<{
    row: number;
    column: number;
    element?: TemplateElement;
    padding?: number;
    backgroundColor?: string;
  }>;
}

export interface TemplateResource {
  id: string;
  userId: string;
  projectId: string;
  type: 'font' | 'icon' | 'image' | 'background';
  name: string;
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  size: number;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface TemplateConfig {
  templateId: string;
  version: number;
  userId: string;
  projectId: string;
  elements: TemplateElement[];
  globalSettings: {
    fonts: string[];
    defaultFont: string;
    defaultColor: string;
    gridSize: number;
    snapToGrid: boolean;
  };
  metadata: {
    lastModifiedBy: string;
    lastModifiedAt: Date;
    elementCount: number;
    resourceCount: number;
  };
  timestamp: Date;
}

// DTOs for API operations
export interface CreateTemplateDto {
  userId: string;
  projectId: string;
  name: string;
  type: 'vcard' | 'qr_square' | 'qr_vertical';
  width: number;
  height: number;
  exportFormat?: 'jpg' | 'png';
  exportDpi?: number;
  phonePrefix?: string;
  extensionLength?: number;
  websiteUrl?: string;
  brandColors?: Record<string, string>;
}

export interface UpdateTemplateDto {
  name?: string;
  status?: 'draft' | 'active' | 'archived';
  backgroundUrl?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  exportFormat?: 'jpg' | 'png';
  exportDpi?: number;
  phonePrefix?: string;
  extensionLength?: number;
  websiteUrl?: string;
  brandColors?: Record<string, string>;
  elements?: TemplateElement[];
  globalSettings?: TemplateConfig['globalSettings'];
  userId?: string;  // For tracking who made the update
}

export interface UploadResourceDto {
  userId: string;
  projectId: string;
  type: 'font' | 'icon' | 'image' | 'background';
  file: Express.Multer.File;
  metadata?: Record<string, any>;
}

export interface GeneratePreviewDto {
  templateId: string;
  testData: Record<string, any>;
  format?: 'jpg' | 'png';
}