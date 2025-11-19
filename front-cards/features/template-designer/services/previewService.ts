import type { Template, TemplateElement } from '../types';

// MOCK: Preview service
// TODO: Replace with actual API calls when backend is ready

export const previewService = {
  async generatePreview(
    template: Template,
    elements: TemplateElement[],
    testData: Record<string, any>
  ): Promise<string> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // TODO: Send template and elements to backend for rendering
    // For now, return a placeholder image

    // MOCK: Create a simple canvas-based preview
    const canvas = document.createElement('canvas');
    canvas.width = template.width;
    canvas.height = template.height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Fill background
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw placeholder text
      ctx.fillStyle = '#666';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Template Preview', canvas.width / 2, canvas.height / 2 - 30);
      ctx.font = '16px Arial';
      ctx.fillText(`${elements.length} elements`, canvas.width / 2, canvas.height / 2 + 10);
      ctx.fillText(`${template.width} x ${template.height}px`, canvas.width / 2, canvas.height / 2 + 35);

      // Draw border
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    }

    // Convert to data URL
    return canvas.toDataURL('image/png');
  },

  async generateBatchPreview(
    template: Template,
    elements: TemplateElement[],
    batchData: Record<string, any>[]
  ): Promise<string[]> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // TODO: Generate multiple previews for batch data
    const previews: string[] = [];

    for (const data of batchData.slice(0, 3)) {
      // Limit to 3 previews
      const preview = await this.generatePreview(template, elements, data);
      previews.push(preview);
    }

    return previews;
  },

  async exportPreview(
    template: Template,
    elements: TemplateElement[],
    testData: Record<string, any>,
    format: 'png' | 'jpg' | 'pdf'
  ): Promise<Blob> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // TODO: Generate high-quality export
    // For now, use the same preview generation

    const dataUrl = await this.generatePreview(template, elements, testData);
    const response = await fetch(dataUrl);
    return response.blob();
  },

  async validateTemplate(
    template: Template,
    elements: TemplateElement[]
  ): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!template.name) {
      errors.push('Template name is required');
    }

    if (template.width < 100 || template.height < 100) {
      errors.push('Template dimensions must be at least 100x100 pixels');
    }

    if (elements.length === 0) {
      warnings.push('Template has no elements');
    }

    // Check for overlapping elements
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const el1 = elements[i];
        const el2 = elements[j];

        if (
          el1.x < el2.x + (el2.width || 0) &&
          el1.x + (el1.width || 0) > el2.x &&
          el1.y < el2.y + (el2.height || 0) &&
          el1.y + (el1.height || 0) > el2.y
        ) {
          warnings.push(`Elements "${el1.name}" and "${el2.name}" overlap`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  },

  async getTestData(): Promise<Record<string, any>> {
    // MOCK: Return sample test data
    return {
      fullName: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      position: 'Senior Developer',
      department: 'Engineering',
      email: 'john.doe@example.com',
      phone: '2459-1234',
      extension: '5678',
      whatsapp: '+506 8765-4321',
      website: 'www.example.com',
      phoneShow: true,
      whatsappShow: true,
      emailShow: true,
      websiteShow: true
    };
  }
};