import type { Template, TemplateConfig, TemplateElement } from '../types';
import { v4 as uuidv4 } from 'uuid';

// MOCK: Template service with mock data
// TODO: Replace with actual API calls when backend is ready

const MOCK_TEMPLATES: Template[] = [
  {
    id: 'template-1',
    userId: 'user-123',
    projectId: 'project-123',
    name: 'Business Card Template',
    type: 'vcard',
    status: 'active',
    width: 800,
    height: 600,
    exportFormat: 'png',
    exportDpi: 300,
    brandColors: {
      primary: '#0066CC',
      secondary: '#FF6600'
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  }
];

export const templateService = {
  async listTemplates(projectId: string): Promise<Template[]> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // MOCK: Filter templates by project
    return MOCK_TEMPLATES.filter(t => t.projectId === projectId);
  },

  async getTemplate(templateId: string): Promise<Template | null> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // MOCK: Find template by ID
    return MOCK_TEMPLATES.find(t => t.id === templateId) || null;
  },

  async getTemplateConfig(templateId: string): Promise<TemplateConfig | null> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // MOCK: Return empty config
    return {
      templateId,
      version: 1,
      userId: 'user-123',
      projectId: 'project-123',
      elements: [],
      globalSettings: {
        fonts: ['Arial', 'Helvetica', 'Times New Roman'],
        defaultFont: 'Arial',
        defaultColor: '#000000',
        gridSize: 10,
        snapToGrid: false
      },
      metadata: {
        lastModifiedBy: 'user-123',
        lastModifiedAt: new Date(),
        elementCount: 0,
        resourceCount: 0
      },
      timestamp: new Date()
    };
  },

  async createTemplate(template: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>): Promise<Template> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // MOCK: Create new template
    const newTemplate: Template = {
      ...template,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    MOCK_TEMPLATES.push(newTemplate);
    return newTemplate;
  },

  async updateTemplate(
    templateId: string,
    updates: Partial<Template>
  ): Promise<Template> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // MOCK: Find and update template
    const index = MOCK_TEMPLATES.findIndex(t => t.id === templateId);
    if (index === -1) {
      throw new Error('Template not found');
    }

    const updatedTemplate = {
      ...MOCK_TEMPLATES[index],
      ...updates,
      updatedAt: new Date()
    };

    MOCK_TEMPLATES[index] = updatedTemplate;
    return updatedTemplate;
  },

  async saveTemplateConfig(
    templateId: string,
    elements: TemplateElement[],
    globalSettings?: TemplateConfig['globalSettings']
  ): Promise<void> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // TODO: Implement actual API call
    console.log('Saving template config:', {
      templateId,
      elements,
      globalSettings
    });
  },

  async deleteTemplate(templateId: string): Promise<void> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // MOCK: Remove template
    const index = MOCK_TEMPLATES.findIndex(t => t.id === templateId);
    if (index !== -1) {
      MOCK_TEMPLATES.splice(index, 1);
    }
  },

  async duplicateTemplate(
    templateId: string,
    newName: string,
    projectId: string
  ): Promise<Template> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // MOCK: Find original template
    const original = MOCK_TEMPLATES.find(t => t.id === templateId);
    if (!original) {
      throw new Error('Template not found');
    }

    // MOCK: Create duplicate
    const duplicate: Template = {
      ...original,
      id: uuidv4(),
      name: newName,
      projectId,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    MOCK_TEMPLATES.push(duplicate);
    return duplicate;
  },

  async exportTemplate(templateId: string, format: 'json' | 'pdf'): Promise<Blob> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // MOCK: Return dummy blob
    const data = JSON.stringify({ templateId, format });
    return new Blob([data], { type: 'application/json' });
  },

  async generatePreview(
    templateId: string,
    testData: Record<string, any>
  ): Promise<string> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // MOCK: Return placeholder image URL
    return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`;
  }
};