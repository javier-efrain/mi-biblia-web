# Ajuste editorial: Estudio y Devocional

## Composición aprobada

| Enfoque y modo | Banner | Contenido textual | Recursos |
| --- | --- | --- | --- |
| Estudio + Visual | Sí | Versículos, Contexto, Exégesis y Enseñanzas | Visores integrados 3:4, sin botón de pantalla completa |
| Devocional + Visual | Sí | Versículos y reflexión devocional | Sin recursos educativos intercalados |
| Estudio + Solo texto | No | Versículos, Contexto, Exégesis y Enseñanzas | Botones «Ver recurso visual»; carga modal bajo demanda |
| Devocional + Solo texto | No | Versículos y reflexión devocional | Botones «Ver recurso visual»; carga modal bajo demanda |

En ambos enfoques de Solo texto el modal permite Pantalla completa y Salir de pantalla completa usando la misma ventana y la misma instancia del explorador. Escape o Cerrar devuelve el foco y la posición de lectura.

Esta regla reemplaza la regla anterior que excluía también los estudios de Solo texto. Se conserva el aislamiento de imágenes y visores: no se montan ni descargan antes de solicitar un recurso.

## Implementación

- `js/componentes/selector-enfoque.js`: `composicionLectura` centraliza las reglas. Es el punto donde en el futuro podrán resolverse metadatos editoriales validados por relato; por ahora no existen excepciones ni metadatos nuevos.
- `js/estado/lectura.js`: aplica la composición a todos los relatos del capítulo. Guarda las instancias de recursos al retirarlas de Devocional y las reinserta en sus anclajes al volver a Estudio. Conserva zoom, marcadores, puntos y páginas; controla respuestas tardías y restaura el anclaje de lectura cuando el alto del documento lo permite.
- `js/servicios/contenidos.js`: `cargarEstudio` obtiene y valida las secciones textuales sin solicitar la biblioteca visual; rechaza estudios de otro relato o con demostración incompatible.
- `js/componentes/explorador.js`: opción de composición para omitir el botón integrado. La funcionalidad compartida permanece disponible y el modal amplía su propia vista, sin duplicar componentes ni motores.
- `css/motor.css`: se retira únicamente la regla que ocultaba el botón de pantalla completa dentro de los modales. Se mantienen los tamaños, proporciones, paleta y diseño aprobados.

No cambian el lector de versículos, el paginador compacto, el motor de zoom/gestos, la navegación continua, el catálogo ni los datos sintéticos. No se incorpora Marcos 12.

## Pruebas

Resultados locales en Chromium 154.0.8037.57: **80/80 pruebas de componentes por pantalla**, **753 comprobaciones de interfaz** (349 escritorio y 404 móvil), 8 documentos validados y 394 archivos originales intactos. El paquete independiente pasó **448 comprobaciones** y **14 pruebas de seguridad**, con 27 archivos permitidos.

`pruebas/editorial.test.js` incorpora la matriz completa, reactivación de instancias y páginas, carga textual separada, validación del servicio y pantalla completa modal en ambos enfoques. Las regresiones existentes se actualizan únicamente donde las expectativas editoriales cambiaron.

`pruebas/verificar_chromium.py` comprueba escritorio y móvil, inicios limpios de las cuatro combinaciones, solicitudes de red, posición/foco al cerrar y anclaje visible al cambiar de enfoque. Mantiene las suites de tipografía 8–30 px, cajas compactas, zoom, pinza, desplazamiento y marcadores.

El repositorio demo adapta sus pruebas a las mismas reglas. No se cambia el workflow, la lista de 27 archivos, el constructor, las 14 pruebas negativas de seguridad ni la configuración de publicación. El paquete debe pasar los controles antes de desplegarse.

Las pruebas en Android/iOS físicos y Safari/Firefox siguen pendientes.
