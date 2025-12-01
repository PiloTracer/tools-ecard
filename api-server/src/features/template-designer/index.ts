// Public exports for template-textile feature

export { templateRoutes } from './routes/templateRoutes';
export { templateService } from './services/templateService';
export { resourceService } from './services/resourceService';
export { templateRepository } from './repositories/templateRepository';
export type {
  Template,
  TemplateElement,
  TextElement,
  ImageElement,
  QRElement,
  TableElement,
  TemplateConfig,
  TemplateResource,
  CreateTemplateDto,
  UpdateTemplateDto,
  UploadResourceDto,
  GeneratePreviewDto
} from './types';