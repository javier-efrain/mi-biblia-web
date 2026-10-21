# Etapa 4 · Bloque 2

## Cambios

- Navegación de capítulos al pie del relato; se conserva el índice horizontal de relatos.
- Contexto, Exégesis, Enseñanzas, Devocional y explicaciones usan el mismo paginador compacto de altura acotada. El navegador distribuye el texto en columnas sin duplicarlo; botones, teclado y gestos recorren todas las páginas. Se recalcula al cambiar tamaño de letra o pantalla.
- Visor integrado 3:4 con imagen 2:3 completa. Se elimina «Ampliar visor». Un dedo vertical desplaza la página; dos dedos permiten zoom y desplazamiento. Se conservan botones, restauración, marcadores alineados y selección sincronizada.
- Solo texto comienza sin imágenes ni estudios montados. Sus pequeños accesos anclados abren únicamente el recurso solicitado en un diálogo bajo demanda, sin cambiar enfoque ni modo. Cerrar o Escape devuelve foco y posición de lectura; se abortan cargas pendientes.
- Se conserva diseño marfil/salvia, tipografía inicial 12 px y rango 8–30 px, preferencias y contenido exclusivamente sintético.

## Archivos

Implementación en `css/motor.css`, componentes `lectura-horizontal.js`, `visor.js`, `explorador.js`, controlador `estado/lectura.js` y servicio `servicios/contenidos.js`. Se añade `pruebas/bloque2.test.js` y se actualizan pruebas de regresión y evidencias en `pruebas/`. No se cambia ningún archivo fuera de `motor-visual/`.

## Verificación local

Chromium 154.0.8037.57, escritorio 1280×900 y celular simulado 390×844:

- 8 documentos validados contra sus esquemas.
- 68/68 pruebas de componentes en cada pantalla.
- 559 comprobaciones de interfaz y regresión: 253 escritorio y 306 móvil, incluyendo 67 escritorio y 107 móvil del Bloque 2 (ver los totales exactos en `pruebas/resultados.json`).
- Paginación: todos los caracteres accesibles, altura estable, tamaños 12/30; regresiones de tipografía 8/20/30. El conteo usa rangos de texto para evitar páginas vacías por diferencias de métricas de fuente entre Chromium local y Actions.
- Gestos CDP: desplazamiento vertical sobre imagen, pinza para acercar/alejar, desplazamiento con dos dedos y alineación de marcadores.
- Recurso bajo demanda en Solo texto: sin cargar estudios ni portada; cierre/Escape, foco, posición, abortos y navegación.
- Los 394 archivos originales permanecen intactos.

La demostración se empaqueta por separado: 27 archivos permitidos, 14 pruebas de seguridad y 341 comprobaciones Chromium de publicación, sin solicitudes ajenas al paquete. La consulta automática del repositorio demo es aproximadamente cada cinco minutos; no utiliza credenciales entre repositorios. No se modifica `main` ni Pages del sitio principal.

Evidencia completa: `pruebas/resultados.json` y capturas `pruebas/capturas/bloque2-*`. La prueba en teléfono físico y otros navegadores sigue pendiente.
