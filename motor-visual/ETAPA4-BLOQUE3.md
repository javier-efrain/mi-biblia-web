# Etapa 4 · Bloque 3

## Implementación

- El capítulo 1 sintético muestra consecutivamente `demo-uno` y `demo-dos` (versículos 1–4); el capítulo 2 mantiene `demo-tres`. Una sola cabecera y un índice por capítulo. Se insertan las composiciones en orden antes de esperar los datos para evitar reordenamientos por cargas lentas.
- Las tarjetas muestran título y referencia. Seleccionar un relato desplaza suavemente hasta su encabezado y enfoca el título, sin sustituir nodos, ocultar otros relatos ni solicitar otra página. Respeta movimiento reducido y conserva el historial de selección.
- La misma composición sirve a todos los relatos. Estudio/Devocional actualiza sus cierres sin reconstruir visores; Visual/Solo texto mantiene una referencia de posición cuando es posible. Las páginas educativas se recuerdan por relato.
- A 100 %, un dedo permite leer verticalmente. Con zoom, un dedo arrastra ambos ejes de la imagen sin mover el documento; dos dedos mantienen la pinza. Restablecer devuelve el desplazamiento normal.
- «Pantalla completa» abre una superposición del tamaño del navegador, sin imponer 3:4 al visor. Traslada el mismo explorador y sus controles, sin crear otro motor ni otra instancia. Mantiene zoom, puntos, selección y paginación; al cerrar devuelve el nodo al relato, el foco y la posición. No depende de la API Fullscreen del dispositivo.
- Solo texto muestra botones salvia «Ver recurso visual» con símbolo de imagen. Sigue sin montar ni descargar imágenes o estudios antes de pulsarlos. El modal carga solo el recurso elegido y usa el mismo explorador y ciclo de apertura/cierre.

## Archivos

Implementación: `js/estado/lectura.js`, `js/estado/navegacion.js`, `js/componentes/dom.js`, `js/componentes/explorador.js`, `js/componentes/visor.js` y `css/motor.css`. Pruebas nuevas en `pruebas/bloque3.test.js`; ajustes de regresión, runner, resultados y capturas en `pruebas/`.

`lectura-horizontal.js`, sus cajas de altura estable, la tipografía inicial 12 px, el rango 8–30 px, la portada y el lector de versículos mantienen sus implementaciones aprobadas. Los datos continúan siendo exclusivamente sintéticos. No se modifica nada fuera de `motor-visual/` en el repositorio fuente.

En el repositorio demo solo se adaptan pruebas y documentación a la lectura continua y pantalla completa. No se cambia el workflow, la lista de 27 archivos, el constructor, las reglas de seguridad ni la configuración de Pages.

## Verificación

Chromium 154.0.8037.57, escritorio 1280×900 y móvil simulado 390×844: 8 documentos validados, 75/75 pruebas de componentes en cada pantalla y 619 comprobaciones de interfaz (282 escritorio y 337 móvil). Los 394 archivos originales siguen intactos.

Resultados reproducibles en `pruebas/resultados.json`; ejecutar `python motor-visual/pruebas/verificar_chromium.py` con Chromium y Playwright instalados.

Incluye pruebas de componentes, orden de versículos, conservación de nodos y solicitudes al usar el índice, teclado y movimiento reducido, foco y posición modal, instancia compartida, proporciones, selección, zoom y gestos CDP de pinza y arrastre en ambos ejes. Se mantienen las suites de cajas compactas y tipografía.

El paquete independiente pasó 394 comprobaciones Chromium locales y las 14 pruebas de seguridad, conservando los 27 archivos permitidos. Se valida bajo `/mi-biblia-web-demo/` con las 14 pruebas negativas de seguridad y Chromium en escritorio y móvil. El despliegue automático solo continúa si esas pruebas pasan y comprueba los hashes de los 27 archivos servidos.

Pendiente: gestos y teclado virtual en teléfonos físicos (Android/iOS), y validación en Safari/Firefox. La emulación Chromium no sustituye esas pruebas.
