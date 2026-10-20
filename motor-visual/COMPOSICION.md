# Composición editorial compartida · Etapa 2

## Alcance

Implementación exclusivamente en `motor-visual/`, rama `desarrollo-motor-visual`, a partir de `33f1ecc9be8d9b7d5eec87dfb2d864ad290041f4`.

Se adopta la organización editorial de referencia usando únicamente los tres relatos sintéticos existentes. No se importa texto bíblico, contenido editorial ni imágenes definitivas del respaldo V15. El ZIP maestro permanece intacto. No se modifica el lector RVC, `main` ni el sitio principal. No hay páginas HTML por relato: todos utilizan el mismo motor y `demo.html`.

## Orden del lector

1. Cabecera compacta con dos grupos independientes: **Estudio / Devocional** y **Visual / Solo texto**, más los ajustes tipográficos.
2. Libro, capítulo e índice horizontal con el relato activo. Se mantiene la navegación anterior/siguiente de relatos y capítulos del catálogo.
3. Título y referencia del relato en HTML, seguidos por portada 16:9 sin texto dibujado. El pie se conserva para tecnologías de asistencia.
4. Contexto antes de los versículos, exclusivamente en enfoque Estudio y vista Visual.
5. Versículos con recursos intercalados por sus anclajes existentes. El visor 3:4 permanece integrado y no requiere abrir el diálogo ampliado.
6. Cierre de Exégesis / Enseñanzas en Estudio, o Devocional en el enfoque alternativo.

La biblioteca de descubrimiento se mantiene después del cierre. El índice del capítulo filtra por libro, versión y colección, indica el relato activo con `aria-current` y desplaza solamente su propia barra para mostrarlo completo.

## Estados independientes y compatibilidad

- La vista (`modo=visual` o `modo=texto`) es independiente del enfoque (`enfoque=estudio` o `enfoque=devocional`). Las URLs anteriores siguen funcionando; sin `enfoque` se usa Estudio.
- Cambiar de enfoque actualiza únicamente los paneles educativos. Se conservan la instancia del visor, el zoom, el marcador seleccionado y los versículos.
- Contexto, cierre y devocional usan el mismo componente de paginación, con memoria independiente por relato y sección durante la sesión del motor. Cambiar una página no cambia las demás. Al volver al relato se recuperan sus páginas.
- Los ejemplos anteriores con secciones `aplicacion` siguen siendo válidos. El contrato también acepta `ensenanzas`; los ejemplos sintéticos actuales muestran esa categoría explícita.
- Solo texto monta controles, metadatos, navegación y versículos. No monta portadas, contexto, cierre educativo, devocionales, recursos, descubrimiento ni modales. Desde una sesión fría no descarga estudios, biblioteca, imágenes ni componentes visuales, incluso con enfoque Devocional. Al salir de Visual cancela solicitudes pendientes y desmonta los elementos suplementarios.
- Se mantienen el aspecto oscuro, el dorado discreto, las preferencias locales, 8–30 px y el valor inicial experimental de 8 px. En la cabecera, **↺ 8 px** restablece la lectura y conserva su nombre accesible completo.

## Reutilización

- `selector-enfoque.js`: controla Estudio/Devocional sin contenido educativo incrustado.
- `navegacion.js`: rutas compatibles, índice horizontal y recorridos existentes.
- `lectura.js`: un compositor para todos los relatos; cargas cancelables y montaje diferido según la vista.
- `lectura-horizontal.js`: paginador compartido para contexto, estudio y devocional, con estado opcional inyectable.
- `portada.js`: admite pie visible u oculto visualmente, manteniendo accesibilidad; las tarjetas reutilizan el mismo componente.
- `portada-demo.svg`: geometría sintética sin letras dibujadas, independiente del diagrama interactivo.

El código de `visor.js` y `explorador.js` no cambia. No se añaden botones de marcadores externos, ocultar puntos, paginación por marcador ni gestos nuevos: esas mejoras pertenecen a la etapa 3.

## Validación

Chromium 154.0.8037.57, escritorio 1280 × 900 y móvil simulado 390 × 844, con comprobaciones adicionales a 320 px y lectura a 8, 20 y 30 px.

| Grupo | Escritorio | Móvil |
|---|---:|---:|
| Suite JavaScript | 54/54 | 54/54 |
| Interacciones existentes de la demo | 21/21 | 22/22 |
| Apariencia, persistencia y accesibilidad visual | 27/27 | 29/29 |
| Matriz de tipografía y compactación | 45/45 | 51/51 |
| Composición editorial y cuatro combinaciones | 26/26 | 28/28 |

También se validaron ocho documentos mediante JSON Schema. Se verificó la integridad SHA-256 de los 394 archivos originales ajenos al motor. La fuente de lectura sintética y el diagrama de marcadores se conservan sin cambios.

La cabecera mide **54 px en escritorio** y **102 px en móvil**, también a 320 px de ancho. Los controles esenciales conservan áreas de al menos 44 × 44 px.

Las pruebas cubren el orden editorial, el índice activo y sus capítulos, la portada sin letras, los paginadores independientes, las cuatro combinaciones de enfoque/vista, la conservación de zoom y selección, el historial, las respuestas tardías y la compatibilidad de Aplicación. La comprobación a 320 px detectó una tercera fila de ajustes; la etiqueta abreviada de restablecimiento mantiene dos filas sin reducir el área táctil.

Se revisaron capturas con la cabecera fija en la posición inicial del documento. No se probaron Safari, Firefox, dispositivos físicos ni lectores de pantalla reales.

Reproducción:

```sh
python motor-visual/pruebas/verificar_chromium.py
```

Evidencias:

- [Resultados detallados](pruebas/resultados.json).
- [Móvil: Estudio + Visual](pruebas/capturas/editorial-movil-estudio.png).
- [Móvil: Devocional + Visual](pruebas/capturas/editorial-movil-devocional.png).
- [Escritorio: Estudio + Visual](pruebas/capturas/editorial-escritorio-estudio.png).
- [Escritorio: Devocional + Visual](pruebas/capturas/editorial-escritorio-devocional.png).

## Actualizar Codespaces

Desde la raíz del repositorio, sin cambios propios pendientes:

```sh
git switch desarrollo-motor-visual
git pull --ff-only origin desarrollo-motor-visual
```

El servidor Python activo no necesita reiniciarse. Si ocupa la terminal, abrir otra para actualizar la rama. Si está detenido:

```sh
python -m http.server 8000 --bind 0.0.0.0
```

En **PORTS / Puertos**, mantener el puerto **8000** como **Private / Privado**, pulsar **Open in Browser / Abrir en el navegador** y añadir:

```text
/motor-visual/demo.html?relato=demo-dos&modo=visual&enfoque=estudio
```

Recargar con Ctrl+Shift+R o Cmd+Shift+R. Probar el contexto, avanzar Exégesis, cambiar a Enseñanzas y alternar Devocional. Los visores deben permanecer en su sitio al cambiar el enfoque. Solo texto debe eliminar todo el contenido suplementario. El botón **↺ 8 px** permite restablecer la tipografía guardada.

No se hace merge ni publicación del sitio.
