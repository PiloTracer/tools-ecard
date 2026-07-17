/**
 * Demo template repository — localStorage + IndexedDB via demoStore
 */

import type { Template } from '@/features/template-textile/types';
import { DEMO_USER } from './demoConstants';
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
  createdAt: Date;
  updatedAt: Date;
}

export interface DemoSaveTemplateRequest {
  name: string;
  templateData: Template;
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
  createdAt: string;
  updatedAt: string;
}

function toMeta(t: DemoTemplateRecord): DemoTemplateMetadata {
  return {
    id: t.id,
    userId: DEMO_USER.id,
    name: t.name,
    storageUrl: `demo://${t.id}`,
    storageMode: 'LOCAL_ONLY',
    resourceUrls: t.resources,
    version: 1,
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
      userId: DEMO_USER.id,
      name: record.name,
      data: record.data,
      resources: record.resources,
      metadata: toMeta(record),
    };
  },

  async listTemplates(): Promise<DemoTemplateMetadata[]> {
    return demoStore.getTemplates<DemoTemplateRecord>().map(toMeta);
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
