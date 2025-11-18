# Template Designer Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the Template Designer feature in the E-Cards application. Follow these instructions sequentially to build a fully functional visual template editor.

**Feature Name:** `template-designer`
**Estimated Time:** 3-4 weeks
**Dependencies:** s3-bucket feature (must be implemented first)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 1: Foundation Setup](#phase-1-foundation-setup)
3. [Phase 2: Canvas Implementation](#phase-2-canvas-implementation)
4. [Phase 3: Element System](#phase-3-element-system)
5. [Phase 4: Resource Management](#phase-4-resource-management)
6. [Phase 5: Data Persistence](#phase-5-data-persistence)
7. [Phase 6: Preview System](#phase-6-preview-system)
8. [Phase 7: Integration](#phase-7-integration)
9. [Testing Guide](#testing-guide)
10. [Deployment Checklist](#deployment-checklist)

---

## Prerequisites

### Required Knowledge
- React hooks and state management
- Fabric.js canvas library
- TypeScript
- Cassandra and PostgreSQL
- S3-compatible storage (SeaweedFS)

### Environment Setup
Ensure these services are running:
```bash
docker-compose -f docker-compose.dev.yml up -d postgres cassandra redis
```

### Dependencies to Install

#### Frontend (front-cards)
```bash
cd front-cards
npm install fabric @types/fabric zustand react-color react-dropzone
npm install --save-dev @types/react-color
```

#### Backend (api-server)
```bash
cd api-server
npm install sharp uuid multer @types/multer
npm install --save-dev @types/sharp @types/uuid
```

---

## Phase 1: Foundation Setup

### Step 1.1: Create Database Schema

#### PostgreSQL Schema
Create migration file: `api-server/prisma/migrations/create_templates_table.sql`

```sql
-- Templates table
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('vcard', 'qr-square', 'qr-vertical')),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    background_url TEXT,
    thumbnail_url TEXT,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    export_format VARCHAR(10) DEFAULT 'png' CHECK (export_format IN ('jpg', 'png')),
    export_dpi INTEGER DEFAULT 300,
    phone_prefix VARCHAR(20),
    extension_length INTEGER DEFAULT 4,
    website_url TEXT,
    brand_colors JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT templates_user_project_idx UNIQUE (user_id, project_id, name)
);

-- Template resources table
CREATE TABLE template_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('font', 'icon', 'image', 'background')),
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_resources_user_project (user_id, project_id)
);

-- Create indexes
CREATE INDEX idx_templates_user_project ON templates(user_id, project_id);
CREATE INDEX idx_templates_status ON templates(status);
```

#### Cassandra Schema
Create file: `db/init-cassandra/02-template-configs.cql`

```cql
-- Template configurations with versioning
CREATE TABLE IF NOT EXISTS ecards_canonical.template_configs (
    template_id UUID,
    version INT,
    user_id TEXT,
    project_id TEXT,
    elements TEXT,  -- JSON array of elements
    global_settings TEXT,  -- JSON settings
    metadata TEXT,  -- JSON metadata
    timestamp TIMESTAMP,
    PRIMARY KEY (template_id, version)
) WITH CLUSTERING ORDER BY (version DESC);

-- Create materialized view for latest versions
CREATE MATERIALIZED VIEW IF NOT EXISTS ecards_canonical.template_configs_latest AS
    SELECT * FROM ecards_canonical.template_configs
    WHERE template_id IS NOT NULL AND version IS NOT NULL
    PRIMARY KEY (template_id, version)
    WITH CLUSTERING ORDER BY (version DESC);
```

### Step 1.2: Create Feature Structure

#### Frontend Structure
```bash
cd front-cards/features
mkdir -p template-designer/{components,hooks,services,stores,types,utils,styles}
```

Create `front-cards/features/template-designer/index.ts`:
```typescript
// Public exports for template-designer feature
export { TemplateDesigner } from './components/TemplateDesigner';
export { useTemplates } from './hooks/useTemplates';
export type { Template, TemplateElement } from './types';
```

#### Backend Structure
```bash
cd api-server/src/features
mkdir -p template-designer/{controllers,services,repositories,validators,routes,types,utils}
```

Create `api-server/src/features/template-designer/index.ts`:
```typescript
// Public exports for template-designer feature
export { templateRoutes } from './routes/templateRoutes';
export { templateService } from './services/templateService';
export type { Template, TemplateConfig } from './types';
```

### Step 1.3: Define TypeScript Types

Create `front-cards/features/template-designer/types/index.ts`:
```typescript
export interface Template {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  type: 'vcard' | 'qr-square' | 'qr-vertical';
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
```

---

## Phase 2: Canvas Implementation

### Step 2.1: Install and Setup Fabric.js

Create `front-cards/features/template-designer/components/Canvas/DesignCanvas.tsx`:
```typescript
import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { useTemplateStore } from '../../stores/templateStore';

export interface DesignCanvasProps {
  width: number;
  height: number;
  onElementSelect?: (element: fabric.Object | null) => void;
  onElementUpdate?: (element: fabric.Object) => void;
}

export const DesignCanvas: React.FC<DesignCanvasProps> = ({
  width,
  height,
  onElementSelect,
  onElementUpdate
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const { elements, addElement, updateElement, removeElement } = useTemplateStore();

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Fabric canvas
    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selection: true,
      selectionBorderColor: '#0066CC',
      selectionLineWidth: 2
    });

    // Set up event handlers
    fabricCanvas.on('selection:created', (e) => {
      if (onElementSelect && e.selected?.[0]) {
        onElementSelect(e.selected[0]);
      }
    });

    fabricCanvas.on('selection:updated', (e) => {
      if (onElementSelect && e.selected?.[0]) {
        onElementSelect(e.selected[0]);
      }
    });

    fabricCanvas.on('selection:cleared', () => {
      if (onElementSelect) {
        onElementSelect(null);
      }
    });

    fabricCanvas.on('object:modified', (e) => {
      if (onElementUpdate && e.target) {
        onElementUpdate(e.target);
      }
    });

    setCanvas(fabricCanvas);

    // Cleanup
    return () => {
      fabricCanvas.dispose();
    };
  }, [width, height]);

  // Add element to canvas
  const addToCanvas = (element: TemplateElement) => {
    if (!canvas) return;

    let fabricObject: fabric.Object | null = null;

    switch (element.type) {
      case 'text':
        fabricObject = new fabric.Text(element.content || 'Text', {
          left: element.x,
          top: element.y,
          fontSize: element.fontSize,
          fontFamily: element.fontFamily,
          fill: element.color
        });
        break;

      case 'image':
        fabric.Image.fromURL(element.assetUrl, (img) => {
          img.set({
            left: element.x,
            top: element.y,
            scaleX: (element.width || 100) / (img.width || 1),
            scaleY: (element.height || 100) / (img.height || 1)
          });
          canvas.add(img);
        });
        return;

      case 'qr':
        // QR code generation would go here
        const qrPlaceholder = new fabric.Rect({
          left: element.x,
          top: element.y,
          width: element.size,
          height: element.size,
          fill: '#f0f0f0',
          stroke: '#333',
          strokeWidth: 1
        });
        fabricObject = qrPlaceholder;
        break;
    }

    if (fabricObject) {
      fabricObject.set('id', element.id);
      canvas.add(fabricObject);
      canvas.renderAll();
    }
  };

  return (
    <div className="canvas-container border border-gray-300 shadow-lg">
      <canvas ref={canvasRef} />
    </div>
  );
};
```

### Step 2.2: Create Canvas Controls

Create `front-cards/features/template-designer/components/Canvas/CanvasControls.tsx`:
```typescript
import React from 'react';

interface CanvasControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
}

export const CanvasControls: React.FC<CanvasControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  showGrid,
  onToggleGrid,
  snapToGrid,
  onToggleSnap
}) => {
  return (
    <div className="flex items-center gap-2 p-2 bg-white border rounded-lg shadow-sm">
      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onZoomOut}
          className="p-1 hover:bg-gray-100 rounded"
          title="Zoom Out"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
        </button>
        <span className="px-2 min-w-[60px] text-center text-sm">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={onZoomIn}
          className="p-1 hover:bg-gray-100 rounded"
          title="Zoom In"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
        </button>
        <button
          onClick={onZoomReset}
          className="p-1 hover:bg-gray-100 rounded"
          title="Reset Zoom"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
          </svg>
        </button>
      </div>

      <div className="w-px h-6 bg-gray-300" />

      {/* Grid controls */}
      <button
        onClick={onToggleGrid}
        className={`p-1 rounded ${showGrid ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
        title="Toggle Grid"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      </button>

      <button
        onClick={onToggleSnap}
        className={`p-1 rounded ${snapToGrid ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
        title="Snap to Grid"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.5 2a.5.5 0 00-.5.5v15a.5.5 0 001 0v-15a.5.5 0 00-.5-.5zm9 0a.5.5 0 00-.5.5v15a.5.5 0 001 0v-15a.5.5 0 00-.5-.5z" clipRule="evenodd" />
          <path fillRule="evenodd" d="M2 5.5a.5.5 0 01.5-.5h15a.5.5 0 010 1h-15a.5.5 0 01-.5-.5zm0 9a.5.5 0 01.5-.5h15a.5.5 0 010 1h-15a.5.5 0 01-.5-.5z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
};
```

---

## Phase 3: Element System

### Step 3.1: Create Element Toolbox

Create `front-cards/features/template-designer/components/Toolbox/ElementToolbox.tsx`:
```typescript
import React from 'react';

interface ElementToolboxProps {
  onAddText: () => void;
  onAddImage: () => void;
  onAddQR: () => void;
  onAddTable: () => void;
}

export const ElementToolbox: React.FC<ElementToolboxProps> = ({
  onAddText,
  onAddImage,
  onAddQR,
  onAddTable
}) => {
  return (
    <div className="w-64 bg-white border-r border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Elements</h3>

      <div className="space-y-2">
        <button
          onClick={onAddText}
          className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-left">
            <div className="font-medium text-sm">Text</div>
            <div className="text-xs text-gray-500">Add text element</div>
          </div>
        </button>

        <button
          onClick={onAddImage}
          className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div className="text-left">
            <div className="font-medium text-sm">Image</div>
            <div className="text-xs text-gray-500">Add image or icon</div>
          </div>
        </button>

        <button
          onClick={onAddQR}
          className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h8m-4 0v8m-4 0h.01M8 8h.01M12 8h.01M16 8h.01M20 8h.01M4 20h.01M8 20h.01M4 16h.01M4 4h16v4H4V4z" />
          </svg>
          <div className="text-left">
            <div className="font-medium text-sm">QR Code</div>
            <div className="text-xs text-gray-500">Add QR code</div>
          </div>
        </button>

        <button
          onClick={onAddTable}
          className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <div className="text-left">
            <div className="font-medium text-sm">Table</div>
            <div className="text-xs text-gray-500">Add table container</div>
          </div>
        </button>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Fields</h3>
        <div className="space-y-1 text-xs">
          <div className="p-2 bg-gray-50 rounded">Full Name</div>
          <div className="p-2 bg-gray-50 rounded">Position</div>
          <div className="p-2 bg-gray-50 rounded">Email</div>
          <div className="p-2 bg-gray-50 rounded">Phone</div>
          <div className="p-2 bg-gray-50 rounded">Website</div>
        </div>
      </div>
    </div>
  );
};
```

### Step 3.2: Create Property Panel

Create `front-cards/features/template-designer/components/PropertyPanel/PropertyPanel.tsx`:
```typescript
import React from 'react';
import { TextProperties } from './TextProperties';
import { ImageProperties } from './ImageProperties';
import { QRProperties } from './QRProperties';
import { TemplateElement } from '../../types';

interface PropertyPanelProps {
  selectedElement: TemplateElement | null;
  onUpdateElement: (element: TemplateElement) => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedElement,
  onUpdateElement
}) => {
  if (!selectedElement) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 p-4">
        <div className="text-center text-gray-500 mt-8">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">Select an element to edit properties</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Properties</h3>
        <p className="text-sm text-gray-500 mt-1">
          {selectedElement.type.charAt(0).toUpperCase() + selectedElement.type.slice(1)} Element
        </p>
      </div>

      <div className="p-4">
        {selectedElement.type === 'text' && (
          <TextProperties
            element={selectedElement as TextElement}
            onUpdate={onUpdateElement}
          />
        )}
        {selectedElement.type === 'image' && (
          <ImageProperties
            element={selectedElement as ImageElement}
            onUpdate={onUpdateElement}
          />
        )}
        {selectedElement.type === 'qr' && (
          <QRProperties
            element={selectedElement as QRElement}
            onUpdate={onUpdateElement}
          />
        )}
      </div>
    </div>
  );
};
```

---

## Phase 4: Resource Management

### Step 4.1: Create Resource Service

Create `front-cards/features/template-designer/services/resourceService.ts`:
```typescript
import { apiClient } from '@/shared/lib/api-client';

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

export const resourceService = {
  async uploadResource(
    file: File,
    type: TemplateResource['type'],
    projectId: string
  ): Promise<TemplateResource> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    formData.append('projectId', projectId);

    const response = await fetch('/api/v1/templates/resources/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to upload resource');
    }

    return response.json();
  },

  async listResources(
    projectId: string,
    type?: TemplateResource['type']
  ): Promise<TemplateResource[]> {
    const params = new URLSearchParams({ projectId });
    if (type) params.append('type', type);

    const response = await fetch(`/api/v1/templates/resources?${params}`);

    if (!response.ok) {
      throw new Error('Failed to fetch resources');
    }

    return response.json();
  },

  async deleteResource(resourceId: string): Promise<void> {
    const response = await fetch(`/api/v1/templates/resources/${resourceId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to delete resource');
    }
  },

  async generateThumbnail(resourceUrl: string): Promise<string> {
    const response = await fetch('/api/v1/templates/resources/thumbnail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: resourceUrl })
    });

    if (!response.ok) {
      throw new Error('Failed to generate thumbnail');
    }

    const data = await response.json();
    return data.thumbnailUrl;
  }
};
```

### Step 4.2: Implement S3 Integration

Create `api-server/src/features/template-designer/services/storageService.ts`:
```typescript
import { s3Service } from '@/features/s3-bucket';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

export const storageService = {
  async uploadTemplateResource(
    buffer: Buffer,
    mimeType: string,
    userId: string,
    projectId: string,
    resourceType: string
  ): Promise<{ url: string; thumbnailUrl?: string }> {
    const resourceId = uuidv4();
    const extension = mimeType.split('/')[1];
    const key = `templates/${userId}/${projectId}/resources/${resourceType}/${resourceId}.${extension}`;

    // Upload original file
    const result = await s3Service.putObject('ecards', key, buffer, {
      contentType: mimeType,
      metadata: {
        userId,
        projectId,
        resourceType,
        uploadedAt: new Date().toISOString()
      }
    });

    // Generate thumbnail for images
    let thumbnailUrl;
    if (mimeType.startsWith('image/')) {
      const thumbnail = await sharp(buffer)
        .resize(200, 200, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .toBuffer();

      const thumbnailKey = `templates/${userId}/${projectId}/thumbnails/${resourceId}_thumb.jpg`;
      const thumbResult = await s3Service.putObject('ecards', thumbnailKey, thumbnail, {
        contentType: 'image/jpeg'
      });

      thumbnailUrl = thumbResult.publicUrl || s3Service.getPublicUrl('ecards', thumbnailKey);
    }

    return {
      url: result.publicUrl || s3Service.getPublicUrl('ecards', key),
      thumbnailUrl
    };
  },

  async deleteTemplateResource(resourceUrl: string): Promise<void> {
    // Extract bucket and key from URL
    const urlParts = new URL(resourceUrl);
    const pathParts = urlParts.pathname.split('/');
    const bucket = pathParts[1];
    const key = pathParts.slice(2).join('/');

    await s3Service.deleteObject(bucket, key);
  },

  async copyTemplate(
    sourceTemplateId: string,
    targetTemplateId: string,
    userId: string,
    projectId: string
  ): Promise<void> {
    const sourcePrefix = `templates/${userId}/${projectId}/templates/${sourceTemplateId}/`;
    const targetPrefix = `templates/${userId}/${projectId}/templates/${targetTemplateId}/`;

    // List all objects with source prefix
    const objects = await s3Service.listObjects('ecards', sourcePrefix);

    // Copy each object
    for (const obj of objects.contents || []) {
      const sourceKey = obj.key;
      const targetKey = sourceKey.replace(sourcePrefix, targetPrefix);

      await s3Service.copyObject(
        'ecards',
        sourceKey,
        'ecards',
        targetKey
      );
    }
  }
};
```

---

## Phase 5: Data Persistence

### Step 5.1: Create Template Repository

Create `api-server/src/features/template-designer/repositories/templateRepository.ts`:
```typescript
import { PrismaClient } from '@prisma/client';
import { cassandraClient } from '@/core/database/cassandra';
import { v4 as uuidv4 } from 'uuid';
import type { Template, TemplateConfig } from '../types';

const prisma = new PrismaClient();

export const templateRepository = {
  async createTemplate(data: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>): Promise<Template> {
    const template = await prisma.template.create({
      data: {
        ...data,
        id: uuidv4(),
        brandColors: JSON.stringify(data.brandColors || {})
      }
    });

    return {
      ...template,
      brandColors: JSON.parse(template.brandColors as string)
    };
  },

  async updateTemplate(id: string, data: Partial<Template>): Promise<Template> {
    const template = await prisma.template.update({
      where: { id },
      data: {
        ...data,
        brandColors: data.brandColors ? JSON.stringify(data.brandColors) : undefined,
        updatedAt: new Date()
      }
    });

    return {
      ...template,
      brandColors: JSON.parse(template.brandColors as string)
    };
  },

  async getTemplate(id: string): Promise<Template | null> {
    const template = await prisma.template.findUnique({
      where: { id }
    });

    if (!template) return null;

    return {
      ...template,
      brandColors: JSON.parse(template.brandColors as string)
    };
  },

  async listTemplates(userId: string, projectId: string): Promise<Template[]> {
    const templates = await prisma.template.findMany({
      where: {
        userId,
        projectId,
        status: { not: 'archived' }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return templates.map(t => ({
      ...t,
      brandColors: JSON.parse(t.brandColors as string)
    }));
  },

  async deleteTemplate(id: string): Promise<void> {
    await prisma.template.update({
      where: { id },
      data: { status: 'archived' }
    });
  },

  // Cassandra operations for template configuration
  async saveTemplateConfig(config: TemplateConfig): Promise<void> {
    const query = `
      INSERT INTO template_configs
      (template_id, version, user_id, project_id, elements, global_settings, metadata, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      config.templateId,
      config.version,
      config.userId,
      config.projectId,
      JSON.stringify(config.elements),
      JSON.stringify(config.globalSettings),
      JSON.stringify(config.metadata),
      new Date()
    ];

    await cassandraClient.execute(query, params, { prepare: true });
  },

  async getLatestTemplateConfig(templateId: string): Promise<TemplateConfig | null> {
    const query = `
      SELECT * FROM template_configs
      WHERE template_id = ?
      ORDER BY version DESC
      LIMIT 1
    `;

    const result = await cassandraClient.execute(query, [templateId], { prepare: true });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      templateId: row.template_id,
      version: row.version,
      userId: row.user_id,
      projectId: row.project_id,
      elements: JSON.parse(row.elements),
      globalSettings: JSON.parse(row.global_settings),
      metadata: JSON.parse(row.metadata),
      timestamp: row.timestamp
    };
  },

  async getTemplateConfigVersion(templateId: string, version: number): Promise<TemplateConfig | null> {
    const query = `
      SELECT * FROM template_configs
      WHERE template_id = ? AND version = ?
    `;

    const result = await cassandraClient.execute(query, [templateId, version], { prepare: true });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      templateId: row.template_id,
      version: row.version,
      userId: row.user_id,
      projectId: row.project_id,
      elements: JSON.parse(row.elements),
      globalSettings: JSON.parse(row.global_settings),
      metadata: JSON.parse(row.metadata),
      timestamp: row.timestamp
    };
  }
};
```

### Step 5.2: Create Template Service

Create `api-server/src/features/template-designer/services/templateService.ts`:
```typescript
import { templateRepository } from '../repositories/templateRepository';
import { storageService } from './storageService';
import type { Template, TemplateConfig, CreateTemplateDto, UpdateTemplateDto } from '../types';

export const templateService = {
  async createTemplate(dto: CreateTemplateDto): Promise<Template> {
    // Create template in PostgreSQL
    const template = await templateRepository.createTemplate({
      userId: dto.userId,
      projectId: dto.projectId,
      name: dto.name,
      type: dto.type,
      width: dto.width,
      height: dto.height,
      exportFormat: dto.exportFormat || 'png',
      exportDpi: dto.exportDpi || 300,
      phonePrefix: dto.phonePrefix,
      extensionLength: dto.extensionLength || 4,
      websiteUrl: dto.websiteUrl,
      brandColors: dto.brandColors || {}
    });

    // Save initial configuration to Cassandra
    const config: TemplateConfig = {
      templateId: template.id,
      version: 1,
      userId: dto.userId,
      projectId: dto.projectId,
      elements: [],
      globalSettings: {
        fonts: ['Arial', 'Helvetica', 'Times New Roman'],
        defaultFont: 'Arial',
        defaultColor: '#000000',
        gridSize: 10,
        snapToGrid: false
      },
      metadata: {
        lastModifiedBy: dto.userId,
        lastModifiedAt: new Date(),
        elementCount: 0,
        resourceCount: 0
      },
      timestamp: new Date()
    };

    await templateRepository.saveTemplateConfig(config);

    return template;
  },

  async updateTemplate(id: string, dto: UpdateTemplateDto): Promise<Template> {
    const existing = await templateRepository.getTemplate(id);
    if (!existing) {
      throw new Error('Template not found');
    }

    // Update PostgreSQL
    const updated = await templateRepository.updateTemplate(id, dto);

    // If elements are being updated, save new version to Cassandra
    if (dto.elements) {
      const latestConfig = await templateRepository.getLatestTemplateConfig(id);
      const newVersion = (latestConfig?.version || 0) + 1;

      const config: TemplateConfig = {
        templateId: id,
        version: newVersion,
        userId: existing.userId,
        projectId: existing.projectId,
        elements: dto.elements,
        globalSettings: dto.globalSettings || latestConfig?.globalSettings || {},
        metadata: {
          lastModifiedBy: dto.userId || existing.userId,
          lastModifiedAt: new Date(),
          elementCount: dto.elements.length,
          resourceCount: 0
        },
        timestamp: new Date()
      };

      await templateRepository.saveTemplateConfig(config);
    }

    return updated;
  },

  async duplicateTemplate(
    templateId: string,
    newName: string,
    userId: string,
    projectId: string
  ): Promise<Template> {
    const source = await templateRepository.getTemplate(templateId);
    if (!source) {
      throw new Error('Source template not found');
    }

    const sourceConfig = await templateRepository.getLatestTemplateConfig(templateId);
    if (!sourceConfig) {
      throw new Error('Source template configuration not found');
    }

    // Create new template
    const newTemplate = await this.createTemplate({
      userId,
      projectId,
      name: newName,
      type: source.type,
      width: source.width,
      height: source.height,
      exportFormat: source.exportFormat,
      exportDpi: source.exportDpi,
      phonePrefix: source.phonePrefix,
      extensionLength: source.extensionLength,
      websiteUrl: source.websiteUrl,
      brandColors: source.brandColors
    });

    // Copy resources in S3
    if (source.backgroundUrl) {
      await storageService.copyTemplate(templateId, newTemplate.id, userId, projectId);
    }

    // Copy configuration
    const newConfig: TemplateConfig = {
      ...sourceConfig,
      templateId: newTemplate.id,
      version: 1,
      userId,
      projectId,
      timestamp: new Date()
    };

    await templateRepository.saveTemplateConfig(newConfig);

    return newTemplate;
  }
};
```

---

## Phase 6: Preview System

### Step 6.1: Create Preview Service

Create `api-server/src/features/template-designer/services/previewService.ts`:
```typescript
import { createCanvas, loadImage, registerFont } from 'canvas';
import QRCode from 'qrcode';
import { templateRepository } from '../repositories/templateRepository';
import type { TemplateConfig, TemplateElement } from '../types';

export const previewService = {
  async generatePreview(
    templateId: string,
    testData: Record<string, any>
  ): Promise<Buffer> {
    const template = await templateRepository.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const config = await templateRepository.getLatestTemplateConfig(templateId);
    if (!config) {
      throw new Error('Template configuration not found');
    }

    // Create canvas
    const canvas = createCanvas(template.width, template.height);
    const ctx = canvas.getContext('2d');

    // Draw background
    if (template.backgroundUrl) {
      const bgImage = await loadImage(template.backgroundUrl);
      ctx.drawImage(bgImage, 0, 0, template.width, template.height);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, template.width, template.height);
    }

    // Render elements
    for (const element of config.elements) {
      await this.renderElement(ctx, element, testData, template);
    }

    // Convert to buffer
    const format = template.exportFormat === 'jpg' ? 'jpeg' : 'png';
    return canvas.toBuffer(format as any);
  },

  async renderElement(
    ctx: CanvasRenderingContext2D,
    element: TemplateElement,
    data: Record<string, any>,
    template: Template
  ): Promise<void> {
    switch (element.type) {
      case 'text':
        await this.renderTextElement(ctx, element as TextElement, data);
        break;

      case 'image':
        await this.renderImageElement(ctx, element as ImageElement, data);
        break;

      case 'qr':
        await this.renderQRElement(ctx, element as QRElement, data);
        break;

      case 'table':
        await this.renderTableElement(ctx, element as TableElement, data, template);
        break;
    }
  },

  async renderTextElement(
    ctx: CanvasRenderingContext2D,
    element: TextElement,
    data: Record<string, any>
  ): Promise<void> {
    const text = data[element.field] || element.content || '';

    ctx.save();

    // Set text properties
    ctx.font = `${element.fontSize}px ${element.fontFamily}`;
    ctx.fillStyle = element.color;
    ctx.textAlign = element.textAlign || 'left';

    // Handle auto-fit
    if (element.autoFit?.enabled && element.maxWidth) {
      let fontSize = element.fontSize;
      ctx.font = `${fontSize}px ${element.fontFamily}`;

      while (ctx.measureText(text).width > element.maxWidth && fontSize > element.autoFit.minSize) {
        fontSize -= 0.5;
        ctx.font = `${fontSize}px ${element.fontFamily}`;
      }
    }

    // Apply style rules
    if (element.styleRules && element.styleRules.length > 0) {
      const words = text.split(' ');
      let x = element.x;

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const rule = element.styleRules.find(r => {
          if (r.type === 'firstWord' && i === 0) return true;
          if (r.type === 'lastWord' && i === words.length - 1) return true;
          if (r.type === 'wordIndex' && r.value === i) return true;
          return false;
        });

        if (rule) {
          ctx.fillStyle = rule.color || element.color;
          if (rule.fontSize) {
            ctx.font = `${rule.fontSize}px ${element.fontFamily}`;
          }
        }

        ctx.fillText(word, x, element.y);
        x += ctx.measureText(word + ' ').width;
      }
    } else {
      ctx.fillText(text, element.x, element.y);
    }

    ctx.restore();
  },

  async renderImageElement(
    ctx: CanvasRenderingContext2D,
    element: ImageElement,
    data: Record<string, any>
  ): Promise<void> {
    // Check visibility
    if (element.visibilityField && !data[element.visibilityField]) {
      return;
    }

    const image = await loadImage(element.assetUrl);

    // Calculate position
    let x = element.x;
    let y = element.y;

    if (element.dynamicPosition) {
      if (element.dynamicPosition.xField) {
        x = data[element.dynamicPosition.xField] || x;
      }
      if (element.dynamicPosition.yField) {
        y = data[element.dynamicPosition.yField] || y;
      }
    }

    ctx.drawImage(
      image,
      x,
      y,
      element.width || image.width,
      element.height || image.height
    );
  },

  async renderQRElement(
    ctx: CanvasRenderingContext2D,
    element: QRElement,
    data: Record<string, any>
  ): Promise<void> {
    const qrData = data[element.field] || '';

    if (!qrData) return;

    // Generate QR code
    const qrCanvas = createCanvas(element.size, element.size);
    await QRCode.toCanvas(qrCanvas, qrData, {
      width: element.size,
      margin: element.margin,
      color: {
        dark: element.colorDark,
        light: element.colorLight
      },
      errorCorrectionLevel: element.errorCorrection
    });

    // Draw QR code on main canvas
    ctx.drawImage(qrCanvas, element.x, element.y);

    // Add logo if specified
    if (element.logo) {
      const logo = await loadImage(element.logo.url);
      const logoSize = element.size * (element.logo.size / 100);
      const logoX = element.x + (element.size - logoSize) / 2;
      const logoY = element.y + (element.size - logoSize) / 2;

      ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
    }
  }
};
```

---

## Phase 7: Integration

### Step 7.1: Update Quick Actions

Update `front-cards/features/simple-quick-actions/components/QuickActions.tsx`:
```typescript
// Change the button text
<p className={getTitleClasses()}>Template Designer</p>
<p className={getDescriptionClasses()}>Design custom card templates</p>
```

### Step 7.2: Create Template Designer Page

Create `front-cards/app/template-designer/page.tsx`:
```typescript
'use client';

import { ProtectedRoute } from '@/features/auth';
import { TemplateDesigner } from '@/features/template-designer';
import { useProjects } from '@/features/simple-projects';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function TemplateDesignerContent() {
  const { selectedProjectId } = useProjects();
  const router = useRouter();

  useEffect(() => {
    if (!selectedProjectId) {
      router.push('/dashboard');
    }
  }, [selectedProjectId, router]);

  if (!selectedProjectId) {
    return null;
  }

  return <TemplateDesigner projectId={selectedProjectId} />;
}

export default function TemplateDesignerPage() {
  return (
    <ProtectedRoute>
      <TemplateDesignerContent />
    </ProtectedRoute>
  );
}
```

### Step 7.3: Create Main Template Designer Component

Create `front-cards/features/template-designer/components/TemplateDesigner.tsx`:
```typescript
import React, { useState, useCallback } from 'react';
import { DesignCanvas } from './Canvas/DesignCanvas';
import { CanvasControls } from './Canvas/CanvasControls';
import { ElementToolbox } from './Toolbox/ElementToolbox';
import { PropertyPanel } from './PropertyPanel/PropertyPanel';
import { ResourceManager } from './ResourceManager/ResourceLibrary';
import { useTemplateStore } from '../stores/templateStore';
import type { TemplateElement } from '../types';

interface TemplateDesignerProps {
  projectId: string;
}

export const TemplateDesigner: React.FC<TemplateDesignerProps> = ({ projectId }) => {
  const [selectedElement, setSelectedElement] = useState<TemplateElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);

  const { template, elements, addElement, updateElement, saveTemplate } = useTemplateStore();

  const handleAddText = useCallback(() => {
    const newElement: TextElement = {
      id: `text_${Date.now()}`,
      type: 'text',
      name: 'New Text',
      x: 100,
      y: 100,
      field: '',
      content: 'Sample Text',
      fontFamily: 'Arial',
      fontSize: 16,
      color: '#000000'
    };
    addElement(newElement);
  }, [addElement]);

  const handleAddImage = useCallback(() => {
    // Open resource manager to select image
    console.log('Add image');
  }, []);

  const handleAddQR = useCallback(() => {
    const newElement: QRElement = {
      id: `qr_${Date.now()}`,
      type: 'qr',
      name: 'QR Code',
      x: 100,
      y: 100,
      field: 'email',
      qrType: 'text',
      size: 150,
      margin: 4,
      colorDark: '#000000',
      colorLight: '#ffffff',
      errorCorrection: 'M'
    };
    addElement(newElement);
  }, [addElement]);

  const handleAddTable = useCallback(() => {
    const newElement: TableElement = {
      id: `table_${Date.now()}`,
      type: 'table',
      name: 'Table',
      x: 100,
      y: 100,
      rows: 3,
      columns: 2,
      cellWidth: 100,
      cellHeight: 30,
      borderWidth: 1,
      borderColor: '#cccccc',
      autoCollapse: true,
      cells: []
    };
    addElement(newElement);
  }, [addElement]);

  const handleSave = async () => {
    try {
      await saveTemplate(projectId);
      alert('Template saved successfully!');
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Failed to save template');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Sidebar - Element Toolbox */}
      <ElementToolbox
        onAddText={handleAddText}
        onAddImage={handleAddImage}
        onAddQR={handleAddQR}
        onAddTable={handleAddTable}
      />

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Template Designer</h1>
            <input
              type="text"
              placeholder="Template Name"
              className="px-3 py-1 border rounded-md"
              value={template?.name || ''}
              onChange={(e) => updateTemplate({ name: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <CanvasControls
              zoom={zoom}
              onZoomIn={() => setZoom(Math.min(zoom + 0.1, 3))}
              onZoomOut={() => setZoom(Math.max(zoom - 0.1, 0.1))}
              onZoomReset={() => setZoom(1)}
              showGrid={showGrid}
              onToggleGrid={() => setShowGrid(!showGrid)}
              snapToGrid={snapToGrid}
              onToggleSnap={() => setSnapToGrid(!snapToGrid)}
            />

            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Save Template
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto p-8">
          <DesignCanvas
            width={template?.width || 800}
            height={template?.height || 600}
            onElementSelect={setSelectedElement}
            onElementUpdate={updateElement}
          />
        </div>
      </div>

      {/* Right Sidebar - Properties Panel */}
      <PropertyPanel
        selectedElement={selectedElement}
        onUpdateElement={updateElement}
      />
    </div>
  );
};
```

---

## Testing Guide

### Unit Tests

Create `front-cards/features/template-designer/__tests__/templateService.test.ts`:
```typescript
import { templateService } from '../services/templateService';

describe('Template Service', () => {
  it('should create a new template', async () => {
    const template = await templateService.createTemplate({
      name: 'Test Template',
      type: 'vcard',
      width: 800,
      height: 600,
      projectId: 'test-project'
    });

    expect(template).toHaveProperty('id');
    expect(template.name).toBe('Test Template');
  });

  it('should list templates for a project', async () => {
    const templates = await templateService.listTemplates('test-project');
    expect(Array.isArray(templates)).toBe(true);
  });
});
```

### Integration Tests

Create `api-server/src/features/template-designer/__tests__/templateRoutes.test.ts`:
```typescript
import request from 'supertest';
import { app } from '@/app';

describe('Template API Routes', () => {
  describe('POST /api/v1/templates', () => {
    it('should create a new template', async () => {
      const response = await request(app)
        .post('/api/v1/templates')
        .send({
          name: 'Test Template',
          type: 'vcard',
          width: 800,
          height: 600,
          projectId: 'test-project'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });
  });

  describe('GET /api/v1/templates/:id', () => {
    it('should retrieve a template by ID', async () => {
      const response = await request(app)
        .get('/api/v1/templates/test-id')
        .expect(200);

      expect(response.body).toHaveProperty('name');
    });
  });
});
```

### E2E Tests

Create `e2e/template-designer.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Template Designer', () => {
  test('should create a new template', async ({ page }) => {
    // Login first
    await page.goto('/login');
    // ... login steps

    // Navigate to template designer
    await page.goto('/template-designer');

    // Add text element
    await page.click('button:has-text("Text")');

    // Verify element appears on canvas
    await expect(page.locator('canvas')).toBeVisible();

    // Save template
    await page.fill('input[placeholder="Template Name"]', 'My Test Template');
    await page.click('button:has-text("Save Template")');

    // Verify save success
    await expect(page.locator('text=Template saved successfully')).toBeVisible();
  });
});
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] S3 bucket permissions verified
- [ ] Cassandra keyspace created

### Deployment Steps

1. **Database Setup**
   ```bash
   # Apply PostgreSQL migrations
   npm run prisma:migrate

   # Initialize Cassandra schema
   docker exec -it ecards-cassandra cqlsh -f /scripts/02-template-configs.cql
   ```

2. **Build Services**
   ```bash
   # Build frontend
   cd front-cards && npm run build

   # Build API server
   cd api-server && npm run build
   ```

3. **Deploy with Docker**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Verify Deployment**
   ```bash
   # Check service health
   curl http://localhost:7400/health

   # Test template creation
   curl -X POST http://localhost:7400/api/v1/templates \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","type":"vcard","width":800,"height":600}'
   ```

### Post-Deployment

- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Verify S3 uploads working
- [ ] Test preview generation
- [ ] Confirm WebSocket connections

---

## Troubleshooting

### Common Issues

1. **Canvas not rendering**
   - Check Fabric.js is properly imported
   - Verify canvas element has width/height
   - Check browser console for errors

2. **S3 upload failures**
   - Verify SeaweedFS endpoint is accessible
   - Check access keys are correct
   - Ensure bucket exists

3. **Cassandra connection issues**
   - Verify Cassandra is running
   - Check keyspace exists
   - Review connection string

4. **Preview generation errors**
   - Ensure node-canvas dependencies installed
   - Check font files are accessible
   - Verify memory limits

### Debug Commands

```bash
# Check logs
docker logs ecards-api -f

# Test S3 connection
npx tsx api-server/src/features/s3-bucket/test-s3.ts

# Verify Cassandra schema
docker exec -it ecards-cassandra cqlsh -e "DESCRIBE KEYSPACE ecards_canonical;"

# Test template creation
curl -X POST http://localhost:7400/api/v1/templates/test-preview \
  -H "Content-Type: application/json" \
  -d '{"templateId":"test","data":{"fullName":"John Doe"}}'
```

---

## Additional Resources

### Documentation
- [Fabric.js Documentation](https://fabricjs.com/)
- [Cassandra Data Modeling](https://cassandra.apache.org/doc/latest/data-modeling/)
- [SeaweedFS S3 API](https://github.com/seaweedfs/seaweedfs/wiki/Amazon-S3-API)

### Related Features
- [S3-Bucket Implementation Guide](./S3-BUCKET-IMPLEMENTATION-GUIDE.md)
- [Batch Import Feature](./BATCH-IMPORT-IMPLEMENTATION-GUIDE.md)
- [Render Worker Setup](./RENDER-WORKER-IMPLEMENTATION-GUIDE.md)

---

**Document Version:** 1.0.0
**Last Updated:** 2025-01-18
**Author:** Feature Implementation Specialist
**Status:** Ready for Implementation