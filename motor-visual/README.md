# Motor visual · Prototipo técnico aislado

Implementación modular sin framework, exclusiva de la rama `desarrollo-motor-visual`, creada desde `origin/main` en `7e11f6c4d47bd20b7a19b98193500c73ba312d44`.

**Todos los datos y el SVG son sintéticos y están identificados como demostración. No publicar.** Esta carpeta no se enlaza desde el sitio actual. No incluye Marcos 12, contenido de V15, imágenes históricas ni copias de texto RVC.

## Abrir localmente

Desde la raíz del repositorio:

```sh
python -m http.server 8765 --bind 127.0.0.1
```

Abrir `http://127.0.0.1:8765/motor-visual/demo.html`. Detener el servidor con Ctrl+C. No abrir mediante `file://`: los módulos y los JSON necesitan HTTP.

La URL acepta `relato=demo-uno`, `demo-dos` o `demo-tres`, y `modo=texto` o `modo=visual`. El modo inicial seguro es `texto`. Por ejemplo:

```text
http://127.0.0.1:8765/motor-visual/demo.html?relato=demo-dos&modo=visual
```

El aviso de demostración permanece visible en ambos modos. La etiqueta «Solo texto bíblico» anticipa la interfaz futura; en este prototipo muestra únicamente líneas sintéticas DEMO, nunca una traducción bíblica.

## Separación de responsabilidades

- `js/servicios/biblia.js`: obtiene pasajes por versión, libro y rangos explícitos. Comparte solicitudes concurrentes y permite reintentar errores. El origen es inyectable; la demo configura exclusivamente `pruebas/fixtures/`, versión `DEMO`.
- `js/servicios/contenidos.js`: carga catálogo y contenido educativo separado; resuelve recursos relativos al manifiesto y rechaza imágenes externas o fuera de `datos/`.
- `js/servicios/validacion.js`: verifica estructura y relaciones semánticas (rangos, identidades, anclajes, recursos y estados). Los esquemas completos JSON Schema se comprueban además durante las pruebas Python.
- `js/estado/lectura.js`: coordina el DOM y descarta respuestas de selecciones anteriores. Los recursos educativos solo se importan, solicitan y montan en modo visual.
- `js/estado/navegacion.js`: resuelve rutas, historial y recorridos por relato o capítulo disponible.
- `js/componentes/`: una sola implementación para todos los relatos. El contenido se inserta como texto, sin interpretar HTML editorial.
- `datos/`: catálogo, estudios y biblioteca independientes del texto de lectura.
- `contratos/`: contratos versionados de relato, estudio y recurso.
- `pruebas/fixtures/`: fuente de texto sintética; no se utiliza ningún archivo RVC.

No hay persistencia de contenido bíblico, service worker, publicación, integración con el lector existente ni código ejecutado desde otras páginas.

## Contratos y reutilización

`catalogo.json` contiene tres relatos de dos capítulos sintéticos. Cada relato referencia su estudio y una portada, y declara usos de recursos mediante `anclajeBiblico`:

```json
{
  "version": "DEMO",
  "libro": "contenido-sintetico",
  "capitulo": 1,
  "versiculo": 3,
  "posicion": "despues"
}
```

El anclaje debe pertenecer al pasaje del relato. Los recursos se montan después del versículo indicado. Varios recursos en un mismo anclaje conservan el orden del catálogo.

Los tres relatos reutilizan `diagrama-demo` y `portada-demo`; el segundo usa el mismo diagrama en dos anclajes. Los marcadores pertenecen al uso del recurso y se expresan como coordenadas 0–1 respecto de la imagen completa. El marco educativo es 3:4; la imagen conserva su proporción y los marcadores escalan con ella. Las portadas tienen imagen 16:9.

El catálogo incluye título, frase de presentación, referencia, portada, colección, orden, estado editorial y bandera `demostracion`. El componente de descubrimiento excluye demos por defecto; solo esta demo las habilita explícitamente. No hay un catálogo público conectado.

Los estudios contienen secciones de contexto, explicación/exégesis, aplicación y devocional, con páginas de párrafos y referencias. Aquí son ejemplos técnicos, no contenido editorial aprobado. Crear otro relato requiere datos compatibles y recursos; no un HTML nuevo.

## Modos y ciclo de vida

Solo texto monta selector de modo, encabezado, referencia, navegación y texto. No monta imágenes, estudios, devocionales, descubrimiento, marcadores, modales ni controles visuales. Desde una sesión nueva tampoco descarga sus módulos o contenidos.

Cambiar de modo cancela solicitudes educativas pendientes, desconecta observadores y eventos, cierra el diálogo y elimina los nodos visuales. El código ya descargado puede permanecer en la caché normal del navegador. Las lecturas concurrentes comparten la petición del libro; el controlador ignora resultados antiguos sin abortar esa petición compartida.

El visor permite zoom 100–400 % con controles o teclado (+, − y 0), desplazamiento nativo horizontal/vertical, marcadores y modo modal. El diálogo utiliza la gestión nativa de foco y Escape y evita robar foco si la persona ya continuó leyendo.

La lectura horizontal cambia páginas con botones, flechas izquierda/derecha o gesto táctil horizontal. Las explicaciones extensas crecen en altura y no se recortan. El movimiento reducido desactiva la transición.

## Pruebas reproducibles

Abrir `http://127.0.0.1:8765/motor-visual/pruebas/runner.html` ejecuta la suite JavaScript sin dependencias de producción.

Para validación JSON Schema, Chromium, escritorio y móvil simulado:

```sh
python motor-visual/pruebas/verificar_chromium.py
```

Requiere Python con `playwright` y `jsonschema` disponibles y un Chromium local. No instala dependencias ni descarga navegadores. Se puede especificar el ejecutable mediante `CHROMIUM_PATH`. El script inicia y cierra su propio servidor en `127.0.0.1`, escribe `pruebas/resultados.json` y genera cuatro capturas bajo `pruebas/capturas/`. Al reejecutarlo, actualiza esos artefactos de prueba.

Ver [RESULTADOS.md](RESULTADOS.md) y [pruebas/resultados.json](pruebas/resultados.json).

## Límites de esta entrega

- El lector RVC existente y sus JSON permanecen intactos. El adaptador admite la estructura de libros, pero su conexión a RVC real y sus condiciones de licencia quedan fuera de esta prueba sintética.
- No se ha recibido ni incorporado V15; tampoco Marcos 12:1–12 o 12:13–17.
- La navegación por capítulo recorre capítulos disponibles en el catálogo de la colección y del mismo libro/versión. No es todavía una interfaz para leer capítulos completos de toda la Biblia.
- Se verificó Chromium en escritorio y dispositivo móvil simulado, no Safari, Firefox ni teléfonos físicos. El gesto horizontal se comprobó mediante eventos táctiles sintéticos; no hay zoom personalizado de pinza de dos dedos.
- No se implementan buscador, administración editorial, autenticación, catálogo público ni despliegue. `noindex` es una precaución de la demo, no una barrera de acceso ni autorización para publicarla.
