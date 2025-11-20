### Requisito Revisado y Expandido (Manteniendo URLs y Términos Específicos)

**Contexto del Proyecto:**  
El `feature-worker` debe implementar mejoras en el `feature` existente llamado `template-textile`, un diseñador de plantillas basado en la librería Fabric.js. El código reside en:
- `front-cards\app\template-textile`
- `front-cards\features\template-textile`  
URL de desarrollo: `http://localhost:7300/template-textile`

**Estructura de Datos Requerida:**  
Definir internamente en `template-textile` una colección de placeholders según la especificación detallada en `.claude\implementations\vcard and qr structure.md`. Cada entrada debe contener:
- `id`: Identificador único del campo (ej: `fullName`)
- `placeholder`: Valor de ejemplo mostrado en el canvas (ej: `John Doe`)

**Requisitos Funcionales Clave:**  
1. **Propiedades de Textbox:**  
   Todo objeto de texto en el canvas debe exponer un campo editable **"Id"**/**"Field Name"** en el panel de propiedades (sidebar derecho). Este ID es opcional pero persistente.

2. **Navegación por Canvas:**  
   Al mantener presionada **la barra espaciadora**, el usuario debe poder arrastrar el canvas completo en cualquier dirección usando el ratón (modo *panning*).

3. **Toolbox de Placeholders:**  
   - Añadir una herramienta **expandible/collapsible** en el toolbox izquierdo titulada *"Placeholders"*.
   - Mostrar todos los placeholders definidos en la estructura de datos como elementos arrastrables.
   - Cada placeholder arrastrado al canvas debe generar un objeto de texto Fabric.js con:
     - Contenido inicial = `placeholder` (ej: `John Doe`)
     - Propiedad `fieldId` preconfigurada = `id` (ej: `fullName`)
   - El `fieldId` debe ser configurable posteriormente en las propiedades del objeto.

**User Story Reescrito Profesionalmente:**  
> Como diseñador de plantillas,  
> necesito acceder a un catálogo de placeholders predefinidos en el toolbox izquierdo de `template-textile`,  
> para arrastrar elementos al canvas con contenido de ejemplo preconfigurado (ej: "John Doe" para fullName).  
> Debo poder reorganizar libremente estos elementos en el canvas usando el *panning* con barra espaciadora,  
> y personalizar sus identificadores (`fieldId`) en el panel de propiedades.  
> Finalmente, requiero exportar el diseño resultante mediante la funcionalidad existente de exportación.

---

### Código Implementado
**Archivo modificado:** `front-cards\app\template-textile\components\CanvasManager.tsx`

```tsx
import { fabric } from 'fabric';
import { useEffect, useRef, useState } from 'react';
import { PLACEHOLDERS } from 'features/template-textile/placeholders'; // Estructura de datos

const CanvasManager = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const panningRef = useRef({ isPanning: false, lastPosX: 0, lastPosY: 0 });

  // Inicializar canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: '#f8f9fa',
      selection: true,
      preserveObjectStacking: true,
    });
    fabricCanvasRef.current = canvas;

    // Configurar eventos de teclado para panning
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(true);
        canvas.defaultCursor = 'grab';
        canvas.selection = false;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        panningRef.current.isPanning = false;
        canvas.defaultCursor = 'default';
        canvas.selection = true;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.dispose();
    };
  }, []);

  // Lógica de panning con espacio
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (opt: fabric.IEvent) => {
      if (!isSpacePressed || !opt.e) return;
      
      panningRef.current = {
        isPanning: true,
        lastPosX: opt.e.clientX,
        lastPosY: opt.e.clientY,
      };
      canvas.defaultCursor = 'grabbing';
    };

    const handleMouseMove = (opt: fabric.IEvent) => {
      if (!panningRef.current.isPanning || !opt.e) return;
      
      const { lastPosX, lastPosY } = panningRef.current;
      const deltaX = opt.e.clientX - lastPosX;
      const deltaY = opt.e.clientY - lastPosY;
      
      canvas.relativePan({ x: deltaX, y: deltaY });
      
      panningRef.current.lastPosX = opt.e.clientX;
      panningRef.current.lastPosY = opt.e.clientY;
    };

    const handleMouseUp = () => {
      panningRef.current.isPanning = false;
      if (isSpacePressed && fabricCanvasRef.current) {
        fabricCanvasRef.current.defaultCursor = 'grab';
      }
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [isSpacePressed]);

  // Configurar placeholders en toolbox
  useEffect(() => {
    const setupPlaceholdersToolbox = () => {
      const toolbox = document.getElementById('placeholders-toolbox');
      if (!toolbox) return;

      PLACEHOLDERS.forEach(placeholder => {
        const placeholderElement = document.createElement('div');
        placeholderElement.className = 'placeholder-item draggable';
        placeholderElement.setAttribute('data-field-id', placeholder.id);
        placeholderElement.textContent = placeholder.placeholder;
        placeholderElement.draggable = true;

        placeholderElement.addEventListener('dragstart', (e) => {
          e.dataTransfer?.setData('placeholder', JSON.stringify(placeholder));
        });

        toolbox.appendChild(placeholderElement);
      });
    };

    setupPlaceholdersToolbox();
  }, []);

  // Manejar drop de placeholders en canvas
  useEffect(() => {
    const canvasContainer = fabricCanvasRef.current?.wrapperEl;
    if (!canvasContainer) return;

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      if (!fabricCanvasRef.current) return;
      
      const placeholderData = e.dataTransfer?.getData('placeholder');
      if (!placeholderData) return;
      
      const placeholder = JSON.parse(placeholderData);
      const pointer = fabricCanvasRef.current.getPointer(e);
      
      const text = new fabric.Text(placeholder.placeholder, {
        left: pointer.x,
        top: pointer.y,
        fontSize: 20,
        fill: '#333',
        fieldId: placeholder.id, // Propiedad personalizada
      });
      
      fabricCanvasRef.current.add(text);
      fabricCanvasRef.current.setActiveObject(text);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    canvasContainer.addEventListener('drop', handleDrop as any);
    canvasContainer.addEventListener('dragover', handleDragOver as any);

    return () => {
      canvasContainer.removeEventListener('drop', handleDrop as any);
      canvasContainer.removeEventListener('dragover', handleDragOver as any);
    };
  }, []);

  return (
    <div className="canvas-container">
      <canvas ref={canvasRef} id="design-canvas" width={800} height={600} />
    </div>
  );
};

export default CanvasManager;
```

**Archivo nuevo:** `front-cards\features\template-textile\placeholders.ts`
```tsx
export interface Placeholder {
  id: string;
  placeholder: string;
}

export const PLACEHOLDERS: Placeholder[] = [
  { id: 'fullName', placeholder: 'John Doe' },
  { id: 'jobTitle', placeholder: 'Senior Developer' },
  { id: 'company', placeholder: 'Tech Innovations Inc.' },
  { id: 'phone', placeholder: '+1 (555) 123-4567' },
  { id: 'email', placeholder: 'john.doe@example.com' },
  { id: 'website', placeholder: 'www.example.com' },
  { id: 'address', placeholder: '123 Main St, New York, NY' },
  { id: 'customField1', placeholder: 'Custom Field 1' },
  { id: 'customField2', placeholder: 'Custom Field 2' },
  // ... (completar según estructura en vcard and qr structure.md)
];
```

**Actualización en sidebar de propiedades:**  
Archivo: `front-cards\app\template-textile\components\PropertiesPanel.tsx`
```tsx
// ... código existente ...
const PropertiesPanel = () => {
  // ... lógica existente ...

  const renderTextProperties = () => {
    if (!activeObject || activeObject.type !== 'text') return null;
    
    return (
      <div className="property-section">
        <label>Field ID (Optional)</label>
        <input
          type="text"
          value={activeObject.fieldId || ''}
          onChange={(e) => {
            activeObject.set('fieldId', e.target.value.trim());
            canvasRef.current?.requestRenderAll();
          }}
          placeholder="ej: fullName"
        />
        {/* ... otras propiedades de texto ... */}
      </div>
    );
  };

  return (
    <div className="properties-panel">
      {activeObject ? renderTextProperties() : <div>Select an object</div>}
    </div>
  );
};
```

**Toolbox izquierdo (ejemplo de integración):**  
Archivo: `front-cards\app\template-textile\components\Toolbox.tsx`
```tsx
const Toolbox = () => {
  const [isPlaceholdersExpanded, setIsPlaceholdersExpanded] = useState(true);

  return (
    <div className="toolbox">
      {/* ... otras herramientas ... */}
      
      <div className="toolbox-section">
        <div 
          className="section-header"
          onClick={() => setIsPlaceholdersExpanded(!isPlaceholdersExpanded)}
        >
          <span>▸</span> Placeholders
        </div>
        {isPlaceholdersExpanded && (
          <div id="placeholders-toolbox" className="placeholders-container">
            {/* Los placeholders se inyectarán aquí vía CanvasManager */}
          </div>
        )}
      </div>
    </div>
  );
};
```

### Notas de Implementación
1. **Estructura de Datos:**  
   Los placeholders se definen en `placeholders.ts` siguiendo exactamente la especificación de `vcard and qr structure.md`.

2. **Panning con Barra Espaciadora:**  
   - Al presionar espacio: se desactiva selección de objetos y cambia cursor a `grab`.
   - Al arrastrar con espacio: mueve todo el canvas manteniendo posición relativa.
   - Al soltar espacio: restaura modo de selección normal.

3. **Placeholders en Canvas:**  
   Cada placeholder arrastrado genera un objeto de texto con:
   - Contenido inicial = valor `placeholder`
   - Propiedad `fieldId` = valor `id` (visible/editable en panel de propiedades)

4. **Integración con Exportación Existente:**  
   La funcionalidad de exportación actual (`front-cards\features\template-textile\export.ts`) persiste sin cambios. Los objetos mantienen sus `fieldId` para futuros procesos de reemplazo dinámico.

5. **Estilos CSS Necesarios:**  
   - `.draggable { cursor: grab; padding: 4px; margin: 2px 0; border-radius: 4px; }`
   - `.canvas-container { overflow: hidden; }` (para contener el panning)