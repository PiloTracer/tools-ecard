### Requerimiento Consolidado para feature-worker en template-textile

**Contexto Técnico:**  
El feature-worker debe implementar mejoras en el feature `template-textile` (diseñador de plantillas basado en Fabric.js) con el siguiente scope:

**Estructura de Datos Base:**  
Utilizar exclusivamente la estructura definida en `vcard and qr structure.md` para crear una colección de placeholders internos. Cada entrada debe contener:
- `id`: Identificador técnico en formato snake_case (ej: `full_name`, `business_linkedin`)
- `placeholder`: Valor de ejemplo literal con espacios finales preservados según especificación (ej: `"John Doe Frakenfort "`)

**Requisitos Funcionales Obligatorios:**
1. **Panel de Propiedades Dinámico:**  
   Todo objeto de texto en el canvas debe exponer un campo editable **"Field Name"** en el panel derecho (Properties Panel). Este campo:
   - Muestra el `id` predefinido cuando se arrastra un placeholder
   - Permite edición manual con validación de formato snake_case
   - Es opcional (puede dejarse vacío)

2. **Navegación por Canvas:**  
   Implementar modo *panning* con las siguientes características:
   - Activación: Mantener presionada **barra espaciadora** sin soltar
   - Comportamiento: Al arrastrar con botón izquierdo del ratón, desplazar todo el canvas manteniendo posición relativa de objetos
   - Indicador visual: Cambiar cursor a `grab` (espacio presionado) → `grabbing` (durante arrastre)

3. **Toolbox de Placeholders:**  
   Agregar nueva sección expandible/collapsible en toolbox izquierdo con:
   - Título: **"vCard Fields"** (agrupado por categorías: Core Contact, Business, Personal)
   - Elementos: Todos los placeholders de `vcard and qr structure.md` como items arrastrables
   - Visualización: Mostrar placeholder value recortado (ej: `"John Doe Fr..."`) con tooltip completo al hacer hover
   - Comportamiento al soltar en canvas:
     * Crear objeto Text de Fabric.js con contenido = placeholder value
     * Asignar automáticamente `fieldId` = identificador correspondiente
     * Posicionar en coordenadas del puntero con offset -20px en Y

**User Story Profesional:**  
> Como diseñador de plantillas de tarjetas de contacto,  
> necesito acceder a un catálogo estructurado de campos vCard 4.0 en el toolbox izquierdo de template-textile,  
> para arrastrar elementos preconfigurados al canvas con contenido de ejemplo realista (incluyendo espacios finales).  
> Debo poder reorganizar libremente estos elementos usando navegación por espacio (spacebar panning),  
> y personalizar sus identificadores técnicos mediante el panel de propiedades derecho.  
> Finalmente, debo poder exportar el diseño terminado utilizando el flujo de exportación existente del sistema.

**Restricciones de Implementación:**  
- Mantener compatibilidad con el formato vCard 4.0 (RFC 6350) para todos los placeholders
- Preservar espacios finales en valores de ejemplo según especificación (ej: `"New York "`)
- Soporte completo para caracteres Unicode/UTF-8 en todos los campos
- No modificar rutas existentes:  
  `front-cards\app\template-textile`  
  `front-cards\features\template-textile`  
  URL: `http://localhost:7300/template-textile`
- No traducir términos técnicos: `feature-worker`, `template-textile`, `feature`, `user stories`

**Criterios de Aceptación:**  
1. Todos los campos definidos en `vcard and qr structure.md` aparecen en el toolbox agrupados por categorías
2. Al soltar un placeholder en canvas, muestra exactamente el valor de ejemplo con espacios finales intactos
3. El campo "Field Name" en propiedades muestra el identificador snake_case correspondiente (editable)
4. Con barra espaciadora presionada:  
   - No se seleccionan objetos al hacer clic  
   - El canvas se desplaza fluidamente en todas direcciones  
   - Cursor cambia a icono de mano (grab/grabbing)
5. La exportación genera archivos con metadatos que preservan los fieldIds asignados