/**
 * Demo template repository — localStorage + IndexedDB via demoStore
 */

import type { Template, TemplateKind } from '@/features/template-textile/types';
import { demoStore, newDemoId } from './demoStore';

export type DemoStorageMode = 'FULL' | 'FALLBACK' | 'LOCAL_ONLY';

export interface DemoTemplateMetadata {
  id: string;
  userId: string;
  name: string;
  storageUrl: string;
  storageMode: DemoStorageMode;
  resourceUrls: string[];
  version: number;
  kind: TemplateKind;
  createdAt: Date;
  updatedAt: Date;
}

export interface DemoSaveTemplateRequest {
  name: string;
  templateData: Template;
  kind?: TemplateKind;
}

export interface DemoLoadedTemplate {
  id: string;
  userId: string;
  name: string;
  data: Template;
  resources: string[];
  metadata: DemoTemplateMetadata;
}

interface DemoTemplateRecord {
  id: string;
  name: string;
  data: Template;
  resources: string[];
  // Pass 4: absent in records saved before kind existed ⇒ treated as 'design'.
  kind?: TemplateKind;
  createdAt: string;
  updatedAt: string;
}

function toMeta(t: DemoTemplateRecord): DemoTemplateMetadata {
  return {
    id: t.id,
    userId: demoStore.getActiveUserId() ?? 'unknown',
    name: t.name,
    storageUrl: `demo://${t.id}`,
    storageMode: 'LOCAL_ONLY',
    resourceUrls: t.resources,
    version: 1,
    kind: t.kind === 'template' ? 'template' : 'design',
    createdAt: new Date(t.createdAt),
    updatedAt: new Date(t.updatedAt),
  };
}

export const demoTemplateRepository = {
  async getStorageMode(): Promise<DemoStorageMode> {
    return 'LOCAL_ONLY';
  },

  async saveTemplate(request: DemoSaveTemplateRequest): Promise<DemoTemplateMetadata> {
    const templates = demoStore.getTemplates<DemoTemplateRecord>();
    const templateId = request.templateData.id;
    const existingIdx = templates.findIndex((t) => t.id === templateId);
    const now = new Date().toISOString();

    if (existingIdx >= 0) {
      const updated: DemoTemplateRecord = {
        ...templates[existingIdx],
        name: request.name,
        data: { ...request.templateData, name: request.name },
        kind: request.kind ?? templates[existingIdx].kind ?? 'design',
        updatedAt: now,
      };
      templates[existingIdx] = updated;
      demoStore.setTemplates(templates);
      await demoStore.putBlob(
        `template:${templateId}`,
        JSON.stringify(updated.data),
        'application/json'
      );
      return toMeta(updated);
    }

    const id = newDemoId('tpl');
    const record: DemoTemplateRecord = {
      id,
      name: request.name,
      data: { ...request.templateData, id, name: request.name },
      resources: [],
      kind: request.kind ?? 'design',
      createdAt: now,
      updatedAt: now,
    };
    templates.push(record);
    demoStore.setTemplates(templates);
    await demoStore.putBlob(`template:${id}`, JSON.stringify(request.templateData), 'application/json');
    return toMeta(record);
  },

  async loadTemplate(templateId: string): Promise<DemoLoadedTemplate> {
    const templates = demoStore.getTemplates<DemoTemplateRecord>();
    const record = templates.find((t) => t.id === templateId);
    if (!record) throw new Error('Template not found');
    return {
      id: record.id,
      userId: demoStore.getActiveUserId() ?? 'unknown',
      name: record.name,
      data: record.data,
      resources: record.resources,
      metadata: toMeta(record),
    };
  },

  async listTemplates(kind?: TemplateKind): Promise<DemoTemplateMetadata[]> {
    const all = demoStore.getTemplates<DemoTemplateRecord>().map(toMeta);
    return kind ? all.filter((t) => t.kind === kind) : all;
  },

  async deleteTemplate(templateId: string): Promise<void> {
    const templates = demoStore.getTemplates<DemoTemplateRecord>().filter((t) => t.id !== templateId);
    demoStore.setTemplates(templates);
    try {
      await demoStore.deleteBlob(`template:${templateId}`);
    } catch {
      /* ignore */
    }
  },
};
