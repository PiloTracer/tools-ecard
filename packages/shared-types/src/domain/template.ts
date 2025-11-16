/**
 * Template domain model
 * Defines card template structure
 */

export type Template = {
  id: string;
  userId: string;
  name: string;
  description?: string;
  backgroundUrl: string;
  width: number;
  height: number;
  elements: TemplateElement[];
  phonePrefix?: string;
  extensionLength?: number;
  exportDpi: number;
  brandColors: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
};

export type TemplateElement = TextElement | ImageElement | QRCodeElement;

export type TextElement = {
  id: string;
  kind: 'text';
  name: string;
  field: string;
  x: number;
  y: number;
  maxWidth?: number;
  fontFamily: string;
  fontSize: number;
  color: string;
  align?: 'left' | 'center' | 'right';
  autoFit?: AutoFitConfig;
  styleRules?: TextStyleRule[];
};

export type AutoFitConfig = {
  enabled: boolean;
  minSize: number;
  maxSize: number;
  singleLine: boolean;
};

export type TextStyleRule =
  | { type: 'firstWord'; color: string }
  | { type: 'rest'; color: string };

export type ImageElement = {
  id: string;
  kind: 'image';
  name: string;
  assetUrl: string;
  x: number;
  y: number;
  visibleByDefault: boolean;
  visibilityField?: string;
  dynamicXField?: string;
  dynamicYField?: string;
};

export type QRCodeElement = {
  id: string;
  kind: 'qr';
  name: string;
  field: string;
  x: number;
  y: number;
  size: number;
  colorDark: string;
  colorLight: string;
};
