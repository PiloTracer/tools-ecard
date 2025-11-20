### Requerimiento para feature-worker en template-textile: Lógica de Visibilidad y Reordenamiento de Líneas

**Contexto Breve:**  
El diseñador `template-textile` debe permitir definir plantillas con elementos agrupados en "líneas" (icono + texto), donde la presencia/ausencia de datos específicos en la vCard 4.0 (ej: `mobile_phone`) determinará la visibilidad y posición de dichas líneas durante la generación automática de tarjetas en batch.

**Objetivo Principal:**  
Implementar una estructura de metadatos en los objetos del canvas que permita a procesos posteriores de exportación/batch identificar:  
1. Cuáles objetos forman una "línea" funcional  
2. Cuáles campos de vCard son requeridos para mostrar cada línea  
3. El orden jerárquico de las líneas para reubicación automática  

**Estrategia de Metadatos (No Implementar):**  
1. **Agrupación por Líneas:**  
   - Asignar a cada objeto del canvas una propiedad `lineGroup` (ej: `contact-line-1`, `contact-line-2`)  
   - Todos los objetos con el mismo `lineGroup` se consideran una línea funcional  

2. **Dependencia de Campos:**  
   - Añadir propiedad `requiredFields` a cada `lineGroup` (ej: `["work_phone"]`, `["mobile_phone"]`)  
   - Si algún campo en `requiredFields` está vacío, la línea completa se oculta  

3. **Jerarquía de Reordenamiento:**  
   - Definir propiedad `linePriority` numérica (ej: `1`, `2`, `3`)  
   - Durante exportación:  
     * Las líneas con campos faltantes se eliminan del flujo  
     * Las líneas restantes se reordenan manteniendo prioridad ascendente  

**User Stories Profesionales:**  

> Como diseñador de plantillas,  
> necesito agrupar pares icono+texto en líneas funcionales con metadatos de dependencia,  
> para que el sistema de generación automática oculte líneas incompletas y reordene las restantes manteniendo la jerarquía definida.  

> Como desarrollador de procesos batch,  
> requiero que los metadatos de las plantillas indiquen claramente:  
> (a) Cuáles objetos forman una línea,  
> (b) Qué campos de vCard son requeridos para cada línea,  
> (c) El orden de prioridad para reorganización,  
> para implementar lógica de generación de tarjetas dinámicas sin ajustes manuales.  

**Criterios de Aceptación (Definición de "Listo"):**  
1. Cada objeto del canvas (Image/Text) tiene propiedades: `lineGroup`, `requiredFields` (array), y `linePriority` (número)  
2. Los `requiredFields` coinciden con los identificadores snake_case de `vcardFields.ts`  
3. El panel de propiedades permite editar:  
   - `lineGroup` (con sugerencias de nombres de líneas existentes)  
   - `linePriority` (números enteros positivos)  
4. No se implementa lógica de exportación - los metadatos deben ser suficientemente claros para que un proceso futuro los interprete  

**Restricciones:**  
- Preservar compatibilidad con vCard 4.0 (RFC 6350)  
- No alterar estructura existente de `front-cards/app/template-textile`  
- Mantener términos técnicos sin traducción: `feature-worker`, `template-textile`  
- URL de desarrollo inalterada: `http://localhost:7300/template-textile`  

**Nota Crítica:**  
Este requerimiento define *solo la estructura de metadatos en el template*. La implementación de lógica de ocultamiento/reordenamiento corresponde a un proceso futuro de generación batch. Los metadatos deben ser autoexplicativos y coherentes con la estructura de `vcardFields.ts`.