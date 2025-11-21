# Prompt: Implementación de Funcionalidad de Guardado de Templates en Template-Textile

## Contexto General
El sistema E-Cards cuenta con una feature existente llamada "template-textile" que permite a los usuarios crear y diseñar plantillas personalizadas para tarjetas electrónicas. Actualmente, esta feature carece de la capacidad de guardar y recuperar diseños completos. Se requiere implementar una funcionalidad robusta de guardado de templates utilizando la infraestructura de almacenamiento S3 ya integrada (SeaweedFS).

## Infraestructura Disponible
El sistema ya cuenta con una implementación completa de S3-bucket (SeaweedFS) debidamente integrada, documentada en `.claude\implementations\S3-BUCKET-IMPLEMENTATION-GUIDE.md`. El código base se encuentra en `api-server\src\features\s3-bucket` y proporciona todas las operaciones necesarias para interactuar con el almacenamiento.

## Requerimientos Funcionales

### Autenticación y Seguridad
- El usuario debe estar autenticado para poder guardar y recuperar templates
- Los templates deben ser privados y solo accesibles por su creador o usuarios con permisos explícitos
- Implementar validación de permisos en todas las operaciones CRUD

### Estructura de Almacenamiento
- La ruta en SeaweedFS debe seguir el patrón: `ecards/{userId}/{projectName}/{templateName}/`
- Dentro de esta estructura, se deben organizar todos los recursos necesarios para reconstruir el diseño:
  - Archivos principales de configuración (JSON con la estructura del diseño)
  - Archivos de recursos (imágenes, SVGs, fuentes, etc.)
  - Metadatos relacionados con el template

### Datos a Almacenar
El sistema debe guardar TODO lo necesario para reconstruir un diseño desde cero:
- La estructura completa del canvas (dimensiones, capas, elementos)
- Todos los elementos visuales (posición, tamaño, rotación, filtros, etc.)
- Fuentes y tipografías personalizadas utilizadas
- Archivos de recursos incrustados (especialmente SVGs y otros elementos vectoriales)
- Variables y placeholders para personalización en batch
- Historial de versiones limitado (últimas 3 versiones)

### Interfaz de Usuario
1. **Nuevo Botón de Guardado**:
   - Ubicación: Entre los botones "Canvas Settings" y "Reset View" en la barra de herramientas
   - Estilo: Ícono intuitivo de guardado (disquete o nube con flecha hacia abajo)
   - Comportamiento: Al hacer clic, abre un modal para nombrar el template

2. **Modal de Guardado**:
   - Campo de texto para ingresar el nombre del template
   - Opción para seleccionar/crear un proyecto (carpeta de organización)
   - Botones de confirmación y cancelación
   - Indicador visual durante el proceso de guardado

3. **Indicador de Template Activo**:
   - Mostrar el nombre del template guardado actualmente en un área pequeña arriba del botón "Canvas Settings"
   - Permitir hacer clic en este nombre para acceder a opciones (guardar como, compartir, eliminar)

## User Stories

### Como diseñador de templates:
- Como diseñador, quiero guardar mi trabajo actual como un template para no perder mis avances y poder continuar editándolo más tarde
- Como diseñador, quiero organizar mis templates en proyectos para mantener un flujo de trabajo ordenado
- Como diseñador, quiero poder recuperar exactamente el estado en que dejé mi template, incluyendo todos los elementos y configuraciones visuales
- Como diseñador, quiero poder usar mis templates guardados como base para generar batches de tarjetas personalizadas

### Como administrador del sistema:
- Como administrador, necesito asegurar que los usuarios solo puedan acceder a sus propios templates
- Como administrador, quiero que el sistema gestione eficientemente el espacio de almacenamiento
- Como administrador, necesito que los datos sensibles no se almacenen en los templates

## Flujo de Usuario Esperado
1. El usuario inicia sesión en la aplicación
2. Accede a template-textile y crea o edita un diseño
3. Hace clic en el nuevo botón de guardado
4. En el modal, ingresa un nombre y selecciona un proyecto
5. El sistema guarda todos los recursos necesarios en SeaweedFS
6. Una vez completado, muestra el nombre del template arriba de "Canvas Settings"
7. Posteriormente, el usuario puede abrir el template desde un panel de gestión para continuar editando o usarlo para generación en batch

## Estrategia de Implementación
1. **Backend**: 
   - Crear un nuevo servicio en `api-server/src/features/template-textile/services/templateStorageService.ts` que utilice `s3Service` para operaciones de almacenamiento
   - Implementar endpoints REST para CRUD de templates, asegurando autenticación y autorización
   - Diseñar el esquema de datos para serializar el estado completo del editor

2. **Frontend**:
   - Agregar el componente de botón de guardado en la barra de herramientas
   - Implementar el modal de guardado con validación de nombre
   - Crear un componente para mostrar el nombre del template actual
   - Desarrollar la serialización del estado actual del editor para enviar al backend

3. **Integración con S3**:
   - Utilizar la implementación existente de `s3Service` según la guía proporcionada
   - Organizar los archivos en la estructura de directorios especificada
   - Implementar manejo de errores robusto para operaciones de almacenamiento
   - Asegurar la limpieza de recursos temporales en caso de fallos

## Consideraciones Clave
- **Integridad de los datos**: El sistema debe garantizar que todos los recursos necesarios se guarden correctamente o ninguno (operación atómica)
- **Rendimiento**: Optimizar el proceso de guardado para minimizar el tiempo de espera del usuario, especialmente con templates complejos
- **Versionamiento**: Implementar un mecanismo simple de versionamiento para permitir revertir cambios recientes
- **Espacio de almacenamiento**: Considerar límites de almacenamiento por usuario y proporcionar feedback visual cuando se acerque al límite

## Éxito Definido
- Los usuarios pueden guardar templates completos con un solo clic
- Todos los elementos visuales y configuraciones se recuperan exactamente como se guardaron
- La interfaz permanece responsiva durante el proceso de guardado
- Los templates se organizan de manera lógica en el sistema de almacenamiento
- Se proporciona feedback visual claro durante todas las operaciones de guardado y recuperación

Este feature representa un paso fundamental para transformar template-textile de una herramienta de edición temporal a un sistema completo de gestión de plantillas profesionales que puede integrarse perfectamente en los flujos de trabajo de generación en batch existentes.