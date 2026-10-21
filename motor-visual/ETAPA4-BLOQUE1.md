# Etapa 4 · Bloque 1 · Interfaz y navegación

Trabajo exclusivo en `desarrollo-motor-visual`, dentro de `motor-visual/`. No se cambió `main`, el lector existente, RVC, la configuración de Pages ni el repositorio de demostración. Se entrega un commit local, sin push ni aprobación de despliegues.

## Cambios

- Paleta editorial clara centralizada en variables CSS: marfil `#faf9f3`, salvia `#a8bca5`, verde oscuro `#31583e`, tarjetas blancas y paneles claros. Los SVG sintéticos usan la misma familia cromática, sin dorados; no se alteraron encuadres ni coordenadas.
- Barra de controles en el flujo normal (`position:static`), sin fijación superior. Se conservan Estudio/Devocional, Visual/Solo texto y tipografía; desaparece el botón de modo oscuro.
- Lectura inicial y restablecimiento a 12 px. El rango sigue siendo 8–30 px, con incrementos de 2 px. Se conservan los tamaños válidos previamente guardados, incluidos 8, 20 y 30 px; el oscuro anterior se interpreta como claro. Restablecer permite volver a 12 px. Las preferencias no guardan contenido educativo.
- El índice selecciona el relato de su capítulo, conserva modo y enfoque y, al terminar la carga vigente, lleva el foco y el desplazamiento al título HTML real. Se elimina la compensación de 110/160 px de la antigua barra fija. Las respuestas tardías no desplazan una selección posterior.
- Pulsar el relato ya activo lleva al título sin reconstruir el visor ni reiniciar su selección, zoom o página explicativa.
- Se retiran los botones Relato anterior/siguiente; permanecen Capítulo anterior/siguiente. Se conserva la utilidad de cálculo de vecinos para no romper sus consumidores.
- Se retira el montaje y la importación del descubrimiento final. El componente reutilizable permanece en el código, disponible para futuras etapas; no se sustituye por otra sección.

No se cambiaron los módulos de visor, explorador ni lectura horizontal. Continúan los anclajes, páginas independientes, selección sincronizada, ocultación de puntos, zoom, desplazamiento, modal opcional y el desmontaje y carga aislada de Solo texto.

## Archivos fuente modificados

- `css/motor.css`: paleta, barra normal, navegación de dos columnas y margen del destino.
- `js/estado/preferencias.js`, `js/componentes/preferencias.js`: apariencia clara, inicial/restablecimiento 12 px y eliminación del botón oscuro.
- `js/estado/navegacion.js`: retiro de controles redundantes.
- `js/estado/lectura.js`: salto al título, protección de respuestas tardías, conservación del relato activo y retiro del descubrimiento.
- `datos/recursos/{portada-demo,diagrama-vertical-demo,diagrama-demo}.svg`: únicamente colores y descripción accesible de la portada.
- `datos/recursos.json`: descripción sintética actualizada de círculos verdes.

También se actualizan `pruebas/preferencias.test.js`, `pruebas/navegacion.test.js`, `pruebas/verificar_chromium.py`, sus resultados y capturas actuales; el README enlaza este informe. Las evidencias históricas con nombres de modo oscuro se conservan como historial.

## Pruebas

Ejecutar desde la raíz:

```sh
PYTHONDONTWRITEBYTECODE=1 python motor-visual/pruebas/verificar_chromium.py
```

La suite comprueba esquemas, lector sintético, aislamiento de modos, navegación, preferencias, composición editorial y explorador. Se actualizan las expectativas retiradas de oscuro/8 px, botones de relato y descubrimiento.

La matriz nueva comprueba en escritorio y móvil las cuatro combinaciones Visual/Solo texto y Estudio/Devocional: selección del índice por click y teclado, título enfocado y situado en el inicio visible, versículos del relato seleccionado, permanencia en el capítulo, ida/vuelta entre capítulos y conservación de modo/enfoque. También comprueba que la barra desaparece al bajar, que faltan los controles retirados y que se aplica la paleta a títulos y tarjetas.

Se mantienen las pruebas a 8, 20 y 30 px, incluido ancho móvil de 320 px, sin recortes, solapamientos ni desplazamiento horizontal de párrafos. El arranque y el restablecimiento se comprueban a 12 px. Se prueban respuestas de lectura tardías y repetición de la selección activa sin perder el visor.

Resultado: **64/64 pruebas de componentes en escritorio y 64/64 en móvil**, más 8 documentos válidos frente a los esquemas JSON. Comprobaciones de navegador aprobadas por escritorio/móvil: demo 21/22, accesibilidad 27/29, compactación 45/51, composición 26/28, explorador 22/24 e interfaz de este bloque 45/45. Sin errores JavaScript no controlados. Se verificaron los 394 archivos originales intactos. Las capturas se revisaron visualmente.

Resultados detallados: `pruebas/resultados.json`. Capturas específicas: `pruebas/capturas/etapa4-{escritorio,movil}-{12,indice}.png`. Solo se probaron Chromium y móviles simulados; no un teléfono físico, Safari ni Firefox.

## Compatibilidad con la publicación existente

Se consultaron en modo lectura los scripts de la rama `publicacion-demo` del repositorio independiente. Las rutas y la lista de 27 archivos de ejecución no cambian: no hace falta alterar el origen de Pages, su dirección ni sus permisos para transportar el paquete.

Sin embargo, **el flujo actual no puede aprobar esta versión tal como está**: `.github/scripts/probar_paquete.py` todavía exige `data-apariencia="oscuro"`, un botón de restablecimiento a 8 px y que se soliciten las 27 rutas. Con la sección de descubrimiento retirada, su módulo permanece en el paquete pero ya no se descarga en el lector. La construcción de esos 27 archivos se probó con una copia temporal del script de empaquetado remoto: pasó sin cambios de configuración ni de rutas. Se ejecutó también su prueba de navegador en esa carpeta temporal, que se detuvo exactamente en `escritorio demo-uno: apariencia oscura`, como era esperable con la nueva identidad clara. No se modificó ningún archivo del repositorio de demostración para realizar esta comprobación.

Esas expectativas deben actualizarse en una tarea posterior autorizada sobre el repositorio de demostración. No se modificó ni se intentó eludir esa verificación.

No se hicieron push, cambios de configuración, ejecuciones de workflows ni aprobaciones. La versión publicada existente no se actualiza con este commit local.

## Fuera de este bloque

Siguen pendientes el pellizco de dos dedos, el comportamiento del scroll vertical al tocar la imagen, retirar Ampliar visor, alturas de Contexto/Exégesis/Enseñanzas, accesos a recursos desde Solo texto y cambios de contenido devocional. No se integró contenido definitivo ni RVC.
