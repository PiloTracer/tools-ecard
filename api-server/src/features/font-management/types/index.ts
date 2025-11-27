/**
 * Font Management Types
 */

export interface Font {
  fontId: string;
  userId: string | null;
  fontName: string;
  fontFamily: string;
  fontCategory: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace';
  fontVariant: 'regular' | 'bold' | 'italic' | 'bold-italic';
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  seaweedfsUrl: string;
  seaweedfsFid: string;
  googleFontFamily?: string;
  isSystemFont: boolean;
  fileSize: number;
  createdAt: Date;
  createdBy: string;
}

export interface GoogleFont {
  family: string;
  category: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace';
}

export interface FontUploadRequest {
  fontName: string;
  fontFamily: string;
  fontCategory: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace';
  fontVariant: 'regular' | 'bold' | 'italic' | 'bold-italic';
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  file: Buffer;
  fileName: string;
}

export interface FontListFilters {
  category?: string;
  search?: string;
  scope?: 'global' | 'user' | 'all';
}

export interface GoogleFontVariant {
  variant: string;
  weight: number;
  style: 'normal' | 'italic';
  url: string;
}

export interface SeaweedFSUploadResult {
  url: string;
  fid: string;
  size: number;
}
