# Guía rápida: agregar plantillas al demo (modo más simple)

**Fecha:** 2026-08-12 · **Audiencia:** operador/diseñador · **Tiempo estimado:** 3 minutos

Las plantillas "empaquetadas" (bundled) son archivos estáticos que viajan dentro del propio despliegue. Son visibles para **todos** los visitantes del sitio — incluido el demo público — en el modal **Abrir plantilla**. No requieren base de datos, API ni permisos especiales.

**No hay manifiesto ni script que regenerar:** el servidor lista las carpetas en vivo (`GET /api/bundled-templates`). Copiar los archivos es todo el paso de publicación.

Cada sitio tiene su propio conjunto:

| Carpeta | ¿Dónde aparece? |
|---------|-----------------|
| `front-cards/public/templates/globals/demo/` | Solo en el **demo** |
| `front-cards/public/templates/globals/prd/` | Solo en **producción** |
| `front-cards/public/templates/globals/` (raíz) | En **ambos** sitios (compartidas) |

---

## Flujo completo

### 1. Exportar el diseño desde el editor

Diseña la tarjeta en el editor (textos, imágenes, QR, fuentes) y usa **Exportar**. Se descargan **3 archivos** automáticamente:

```
cumpleanos-2026.zip    ← el diseño completo (obligatorio)
cumpleanos-2026.png    ← vista previa para la galería
cumpleanos-2026.json   ← nombre visible (y "description" opcional, editable a mano)
```

> Tu navegador puede pedir permiso la primera vez para "descargar varios archivos" — acéptalo una vez y listo.

### 2. Copiar los 3 archivos a la carpeta del sitio

```
front-cards/public/templates/globals/
├── demo/
│   ├── A.zip  A.png  A.json      ← solo demo
│   └── B.zip  B.png  B.json      ← solo demo
├── prd/
│   ├── C.zip  C.png  C.json      ← solo producción
│   └── D.zip  D.png  D.json      ← solo producción
└── (raíz: archivos compartidos por ambos sitios)
```

- **Un `.zip` por plantilla**; el `.png` y el `.json` son opcionales (pero recomendados).
- Nombres de archivo simples: minúsculas, sin espacios ni acentos. El nombre **visible** en la galería sale del `.json` (o del nombre del archivo si no hay `.json`).

### 3. Publicar (VPS) — sin rebuild, sin reiniciar

Las carpetas `globals/` están **montadas como volumen** desde el repo del host al contenedor (`docker-compose.prd.yml` / `docker-compose.demo.yml`), y tanto el listado (`/api/bundled-templates`) como la descarga de archivos (`/api/bundled-templates/file/...`) leen el disco en vivo. Por lo tanto **copiar los archivos en el VPS es suficiente** — aparecen en la galería al instante:

```bash
# Desde tu máquina, directo al VPS:
scp cumpleanos-2026.zip cumpleanos-2026.png cumpleanos-2026.json \
  usuario@vps:/ruta/al/repo/front-cards/public/templates/globals/demo/
```

Los usuarios solo recargan con **Ctrl+Shift+R** y ven la novedad en **Abrir plantilla**. Desde ahí abren la plantilla, trabajan sobre ella y **generan sus tarjetas**; al guardar, cada usuario guarda **su propia copia** — la global nunca se modifica.

> Recomendado (opcional): también haz `git add` + commit + push de las plantillas, para que el repo quede como respaldo versionado del set publicado. No es necesario para que aparezcan — el sitio lee la carpeta local del VPS directamente.

> **Nota VPS con ambos sitios en el mismo repo:** no hay conflicto — cada sitio lista únicamente su propia carpeta (`demo/` en el demo, `prd/` en producción) más la raíz compartida.

> **Único paso que sí requiere redeploy:** esta mejora (el montaje + las rutas en vivo) se publica una sola vez con `git pull --ff-only` + `./bin/refresh-prd.sh demo ui` / `./bin/refresh-prd.sh ui`. A partir de ahí, publicar plantillas es solo copiar archivos.

---

## Preguntas frecuentes

- **¿Cómo quito una plantilla?** Borra sus archivos (`.zip`/`.png`/`.json`) de la carpeta correspondiente en el VPS. Desaparece de la galería al instante — nada que reiniciar ni regenerar.
- **¿Un visitante del demo puede borrarla o romperla?** No. Son de solo lectura: al guardar, el usuario crea su propia copia.
- **¿Una misma plantilla en ambos sitios?** Ponla una sola vez en la raíz `globals/`.
- **¿Puedo editar el texto descriptivo?** Sí — abre el `.json` y agrega `"description": "tu texto"`. Se muestra en la galería.
- **¿Esto requiere roles o login?** No. Las empaquetadas son públicas en el sitio donde se publican. (La gestión de plantillas globales vía API con roles `appsuper`/`appglobal` es otro canal, no necesario para este flujo.)
- **¿Hay que reconstruir o reiniciar algo al publicar?** No. La carpeta está montada del host al contenedor y las rutas la leen en vivo: copiar archivos = publicado.

## Referencias

- Listado en vivo: `front-cards/app/api/bundled-templates/route.ts` + `front-cards/features/template-textile/services/bundledGlobalsScanner.ts`
- Descarga en vivo de archivos: `front-cards/app/api/bundled-templates/file/[...path]/route.ts`
- Montaje host→contenedor: `docker-compose.prd.yml` / `docker-compose.demo.yml` (servicio `front-cards`, sección `volumes:`)
- Servicio de la galería: `front-cards/features/template-textile/services/bundledTemplatesService.ts`
- Export con sidecars: `front-cards/features/template-textile/components/Canvas/CanvasControls.tsx` (`handleExportJSON`)
- ~~Script de manifiesto~~ `front-cards/scripts/build-global-templates-manifest.mjs` — **eliminado** 2026-08-12, ya no hace falta (las carpetas se versionan con `.gitkeep`)
