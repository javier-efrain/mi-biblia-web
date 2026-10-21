# Motor visual · Prototipo técnico aislado

Implementación modular sin framework, exclusiva de la rama `desarrollo-motor-visual`, creada desde `origin/main` en `7e11f6c4d47bd20b7a19b98193500c73ba312d44`.

**Todos los datos y el SVG son sintéticos y están identificados como demostración. No publicar.** Esta carpeta no se enlaza desde el sitio actual. No incluye Marcos 12, contenido de V15, imágenes históricas ni copias de texto RVC.

## Versión actual · Etapa 4, bloque 1

Interfaz editorial clara en marfil y verde salvia, con verde oscuro para títulos y selecciones. La barra forma parte del flujo normal. Lectura inicial y restablecimiento a **12 px**, manteniendo el rango **8–30 px** y los tamaños válidos guardados. La apariencia oscura y su botón se retiraron.

El índice horizontal es el acceso a los relatos del capítulo y desplaza al título real sin reiniciar el modo elegido. Permanecen los controles de capítulo; se retiraron Relato anterior/siguiente y el descubrimiento final. Se preservan los visores y sus funciones aprobadas.

[ETAPA4-BLOQUE1.md](ETAPA4-BLOQUE1.md) es el informe vigente, con pruebas, alcance y limitaciones de la publicación. Los apartados e informes posteriores de este README describen las fases históricas del prototipo y sus decisiones de entonces. El repositorio de demostración y la configuración de Pages no se modificaron en este bloque.

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

## Apariencia y accesibilidad visual

La apariencia inicial es oscura (gris muy oscuro, texto claro y acentos dorados). El botón **Modo oscuro** permite alternar con la apariencia clara y expone su estado con `aria-pressed`.

Los botones **A− / A+** ajustan el tamaño de lectura de **8 a 30 px**, en pasos de 2 px, partiendo de **8 px** durante esta fase experimental. El ajuste alcanza el texto de lectura, las explicaciones de estudios, devocionales y paneles informativos, incluidos los paneles dentro del visor modal. Los controles mantienen un tamaño estable para no confundir el aumento de letra con el zoom de imágenes.

Las preferencias se guardan en `localStorage`, exclusivamente bajo `mi-biblia-web:motor-visual:preferencias:v1`. No se almacena texto ni contenido educativo. Se recuperan al recargar en el mismo navegador y origen. Si el almacenamiento está bloqueado, los ajustes siguen funcionando durante la sesión. La configuración no se transfiere automáticamente entre la URL Cloud y la URL de Codespaces.

El cambio tipográfico se aplica mediante una variable CSS, sin reconstruir la lectura ni reiniciar su página o zoom. Los controles tienen al menos 44 × 44 px, foco visible y manejo por teclado. La paleta verifica un contraste mínimo de 4,5:1 para los pares de texto probados; esto no constituye una auditoría completa de conformidad WCAG.

Ver [COMPACTACION.md](COMPACTACION.md) para la fase actual y las instrucciones de actualización en Codespaces. [ACCESIBILIDAD.md](ACCESIBILIDAD.md) conserva el informe histórico de la fase anterior.


## Interfaz compacta · Fase experimental

La interfaz se diseña primero para celular: encabezados y tarjetas menores, márgenes laterales de 10 px, separaciones de 4–8 px y navegación en una barra de cuatro botones. El visor conserva su proporción 3:4 y hasta 480 px de ancho; en celular se aprovecha más ancho disponible. Los controles no heredan los 8 px: mantienen tipografía propia y superficies táctiles de al menos 44 × 44 px.

La clave de almacenamiento se conserva para respetar las preferencias existentes. Un valor guardado de 20 px sigue siendo 20 px; los antiguos 31/32 px se ajustan a 30 px. **Restablecer 8 px** vuelve al tamaño inicial experimental y lo guarda, conservando el tema elegido. A− y A+ siguen variando de 2 en 2 px. No hace falta borrar los datos del navegador.

La suite ahora incluye comprobaciones a **8, 20 y 30 px** en estudios extensos, devocionales, paneles, ambos modos de lectura y pantallas estrechas. Las capturas actuales se encuentran en `pruebas/capturas/compacto-*.png`; las capturas de 32 px se conservan como evidencia histórica.

Comparación opcional de densidad con la fase anterior, con lectura a 20 px en ambas versiones:

```sh
python motor-visual/pruebas/medir_densidad.py
```

Esta comparación requiere el commit histórico `1aa04866d70f26bd11944c638ada43fe7f6474e0` disponible en Git y Chromium en `/usr/bin/chromium`. No cambia la rama ni los archivos fuente; sustituye las respuestas antiguas solo en el navegador de prueba.


## Composición editorial · Etapa 2

La composición actual conserva la apariencia compacta y aplica la organización visual de referencia usando exclusivamente datos sintéticos:

1. Cabecera del lector con los grupos independientes **Estudio / Devocional** y **Visual / Solo texto**, además de los ajustes tipográficos.
2. Libro, capítulo, índice horizontal con el relato activo y la navegación anterior/siguiente existente.
3. Título y referencia del relato en HTML y portada 16:9 sin letras dibujadas. El pie de la portada se mantiene accesible, sin repetirse visualmente.
4. Contexto antes del texto en Estudio, con paginación propia.
5. Versículos y recursos intercalados mediante los anclajes existentes, con visor integrado 3:4.
6. Cierre de Exégesis / Enseñanzas en Estudio, o Devocional en el enfoque alternativo.

Cambiar el enfoque solo actualiza los paneles educativos: conserva la instancia del visor, su zoom y su marcador seleccionado. Contexto, secciones del estudio y devocional conservan páginas independientes en memoria durante la sesión del motor. Solo texto desmonta el contenido suplementario y no solicita estudios, recursos ni módulos visuales al iniciarse en ese modo, cualquiera sea el enfoque elegido.

Las URLs anteriores siguen siendo válidas; sin el parámetro nuevo se utiliza Estudio. Ejemplo alternativo:

```text
/motor-visual/demo.html?relato=demo-dos&modo=visual&enfoque=devocional
```

Los ejemplos antiguos de tipo `aplicacion` siguen siendo compatibles. El contrato también acepta `ensenanzas`; los tres estudios sintéticos actuales usan esa categoría. La barra compacta muestra **↺ 8 px** para restablecer el tamaño, con nombre accesible y descripción completos. Las preferencias anteriores siguen funcionando.

No se han incorporado textos, imágenes, versículos ni recursos definitivos de V15. En esa etapa todavía no se habían añadido las mejoras del explorador. No hay páginas HTML por relato: todos utilizan `demo.html` y el mismo motor.

[COMPOSICION.md](COMPOSICION.md) contiene el informe de la etapa 2, las pruebas y la actualización de Codespaces. Los informes anteriores documentan sus fases respectivas. El comparador opcional de densidad utiliza ahora una referencia completa en el navegador y guarda la medición actual en `pruebas/densidad-editorial.json`, preservando `pruebas/densidad.json` como evidencia histórica.


## Explorador educativo · Etapa 3

El visor integrado ahora incluye puntos numerados y botones con sus nombres, selección sincronizada, Mostrar/Ocultar puntos y descripción general. Cada marcador conserva su propia página explicativa al alternar elementos o enfoques. Se reutiliza el paginador de contexto y cierre; no hay interfaces separadas por relato.

El zoom de 100–400 %, el desplazamiento táctil nativo, el arrastre con ratón y Restablecer mantienen las coordenadas relativas sobre el plano de imagen. Una nueva geometría sintética 2:3 permite comprobar su encuadre completo en el visor 3:4. El SVG horizontal anterior permanece disponible.

Los marcadores pueden declarar `paginas` (id, título y párrafos) para explicaciones extensas; el contrato sigue aceptando los `parrafos` anteriores como una página. La descripción general utiliza la `leyenda` del recurso. Ocultar puntos conserva selección, página y zoom, ocultando también los botones de elementos. La memoria dura durante la instancia del visor; no se guarda contenido educativo en localStorage.

[EXPLORADOR.md](EXPLORADOR.md) documenta la implementación, las pruebas y cómo actualizar Codespaces. Los informes anteriores conservan el historial de sus respectivas etapas.
