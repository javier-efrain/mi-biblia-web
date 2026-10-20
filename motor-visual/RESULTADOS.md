# Resultado de la primera implementación técnica

Fecha: 20 de octubre de 2026.

## Alcance e integridad

- Rama utilizada: `desarrollo-motor-visual`, creada desde `origin/main`.
- Commit base: `7e11f6c4d47bd20b7a19b98193500c73ba312d44`. No se crearon commits.
- 41 archivos nuevos, exclusivamente dentro de `motor-visual/` (inventario al final).
- Los 394 archivos preexistentes conservan sus huellas SHA-256 iniciales. No se eliminaron, movieron ni reemplazaron archivos.
- `main`/`origin/main`, el lector, los JSON RVC y los prototipos existentes no se modificaron.
- No se hizo push, publicación, pull request, merge ni integración con el sitio principal.
- No se recibió ni integró V15 ni Marcos 12. Toda la fuente de datos de la demo es sintética.

## Qué demuestra el prototipo

Tres relatos de dos capítulos sintéticos utilizan el mismo controlador, lector, visor, navegación y componentes educativos. Comparten el SVG y reutilizan sus recursos con anclajes y marcadores independientes. El segundo relato inserta dos recursos en dos versículos diferentes.

El modo Solo texto parte de una rama de montaje independiente: no construye ni oculta contenido educativo. Desde una sesión nueva no solicita estudios, biblioteca de recursos, imágenes ni módulos visuales. Cambiar desde modo visual cancela cargas educativas, cierra el modal y desmonta los componentes, incluso si una respuesta llega tarde.

El catálogo prepara portada 16:9, título, frase de presentación, referencia y estado editorial. El visor es 3:4; permite zoom, desplazamiento, marcadores y paneles. Las explicaciones se paginan horizontalmente; los párrafos extensos conservan su altura natural.

## Pruebas ejecutadas

Entorno: Chromium `154.0.8037.57`, automatizado con Playwright Python, sin descargar navegador ni incorporar dependencias de producción.

| Verificación | Resultado |
|---|---:|
| Suite JavaScript, escritorio 1280 × 900 | 36/36 |
| Suite JavaScript, móvil simulado 390 × 844, táctil, escala 2 | 36/36 |
| Comprobaciones de la demo en escritorio | 21/21 |
| Comprobaciones de la demo en móvil simulado | 22/22 |
| Documentos validados con JSON Schema 2020-12 | 8/8 |
| Errores JavaScript no controlados en suites y demo | 0 |
| Archivos originales alterados, movidos o ausentes | 0 |

La suite cubre rangos discontinuos y entre capítulos, validación de anclajes y relaciones, caché concurrente y reintentos, JSON inválido, versión incompatible, rechazo de RVC en la demo, respuestas tardías, errores de lectura e imágenes, contenido HTML inerte, navegación, proporciones, marcadores, modal y lectura extensa.

Las comprobaciones de la demo verifican solicitudes reales del navegador y DOM, enlaces directos, redimensionamiento (1100 × 850 y 430 × 932), zoom y scroll, foco del modal, Escape, historial Atrás/Adelante y navegación entre capítulos sintéticos. El gesto horizontal móvil usa eventos pointer táctiles sintéticos; no constituye prueba de gesto físico en un teléfono.

### Incidencia corregida

Una comprobación de interacción detectó que el evento asíncrono de cierre del diálogo podía devolver el foco al botón cuando la persona ya había pasado a la explicación. Se corrigió la restauración condicional y se añadió una prueba de regresión. La ejecución final completa pasó después de la corrección.

## Evidencia y reproducción

- [Resultados detallados y solicitudes](pruebas/resultados.json).
- [Pruebas en navegador](pruebas/runner.html).
- [Script reproducible de Chromium](pruebas/verificar_chromium.py).
- [Captura escritorio, Solo texto](pruebas/capturas/escritorio-texto.png).
- [Captura escritorio, visual](pruebas/capturas/escritorio-visual.png).
- [Captura móvil, Solo texto](pruebas/capturas/movil-texto.png).
- [Captura móvil, visual](pruebas/capturas/movil-visual.png).
- [Instrucciones y contratos](README.md).

Se revisaron las capturas visuales de escritorio y móvil: contenido adaptado a una y dos columnas, portadas horizontales, marcos educativos verticales y ausencia de desbordamiento horizontal. El servidor usado para comprobar la aplicación fue local, enlazado exclusivamente a `127.0.0.1`; no hubo despliegue.

## Limitaciones pendientes

- Pendiente recibir V15 y revisar la futura adaptación sin alterar el respaldo.
- No hay validación de fidelidad textual ni licencia RVC en esta entrega: la prueba no lee sus archivos.
- Navegación por capítulos limitada a los disponibles en el catálogo de la colección y del mismo libro/versión.
- No se probaron Safari, Firefox ni teléfonos físicos. No se implementó zoom de pinza personalizado.
- Metadatos de dimensiones, derechos y estado editorial requerirán revisión con los recursos reales.
- El catálogo es una demostración local; no hay buscador público, panel editorial ni integración con el sitio actual.

## Inventario de archivos nuevos

Todos los siguientes archivos están dentro de `motor-visual/`:

- `README.md`
- `RESULTADOS.md`
- `contratos/estudio.schema.json`
- `contratos/recurso.schema.json`
- `contratos/relato.schema.json`
- `css/motor.css`
- `datos/catalogo.json`
- `datos/estudios/piloto-tecnico-dos.json`
- `datos/estudios/piloto-tecnico-tres.json`
- `datos/estudios/piloto-tecnico.json`
- `datos/recursos.json`
- `datos/recursos/diagrama-demo.svg`
- `demo.html`
- `js/componentes/descubrimiento.js`
- `js/componentes/dom.js`
- `js/componentes/explorador.js`
- `js/componentes/lector.js`
- `js/componentes/lectura-horizontal.js`
- `js/componentes/portada.js`
- `js/componentes/selector-modo.js`
- `js/componentes/visor.js`
- `js/estado/lectura.js`
- `js/estado/navegacion.js`
- `js/iniciar.js`
- `js/servicios/biblia.js`
- `js/servicios/contenidos.js`
- `js/servicios/validacion.js`
- `pruebas/biblia.test.js`
- `pruebas/capturas/escritorio-texto.png`
- `pruebas/capturas/escritorio-visual.png`
- `pruebas/capturas/movil-texto.png`
- `pruebas/capturas/movil-visual.png`
- `pruebas/contratos.test.js`
- `pruebas/fixtures/contenido-sintetico.json`
- `pruebas/harness.js`
- `pruebas/modos.test.js`
- `pruebas/navegacion.test.js`
- `pruebas/resultados.json`
- `pruebas/runner.html`
- `pruebas/verificar_chromium.py`
- `pruebas/visor.test.js`
