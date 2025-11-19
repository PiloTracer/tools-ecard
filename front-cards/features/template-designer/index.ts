// Public exports for template-designer feature

// Main component
export { TemplateDesigner } from './components/TemplateDesigner';

// Hooks
export { useTemplates } from './hooks/useTemplates';
export { useCanvas } from './hooks/useCanvas';
export { useElements } from './hooks/useElements';
export { useResources } from './hooks/useResources';

// Services
export { templateService } from './services/templateService';
export { resourceService } from './services/resourceService';

// Types
export type {
  Template,
  TemplateElement,
  TextElement,
  ImageElement,
  QRElement,
  TableElement,
  TemplateResource,
  TemplateConfig,
  CanvasState,
  Point,
  Rectangle
} from './types';

export {
  isTextElement,
  isImageElement,
  isQRElement,
  isTableElement
} from './types';