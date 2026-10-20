import { test,assert,rechaza,datos } from './harness.js';
import { validarCatalogo,validarEstudio,validarRecursos,validarRelaciones } from '../js/servicios/validacion.js';
import { crearServicioContenidos } from '../js/servicios/contenidos.js';
test('Tres relatos sintéticos válidos comparten un recurso', async () => {
  const { catalogo,contenidos } = await datos();
  assert(catalogo.relatos.length === 3);
  assert(catalogo.relatos.every(r => r.demostracion && r.referencia.version==='DEMO'));
  assert(new Set(catalogo.relatos.flatMap(r => r.recursos.map(u => u.recursoId))).size === 1);
  for (const relato of catalogo.relatos) {
    const d = await contenidos.cargarVisuales(relato);
    validarEstudio(d.estudio); validarRelaciones(relato,d.estudio,{ recursos:d.recursos });
  }
});
test('El catálogo rechaza identificadores duplicados', async () => {
  const { catalogo } = await datos(); catalogo.relatos.push(catalogo.relatos[0]);
  await rechaza(() => validarCatalogo(catalogo));
});
test('Los anclajes fuera del pasaje se rechazan', async () => {
  const { catalogo } = await datos(); catalogo.relatos[0].recursos[0].anclajeBiblico.versiculo = 99;
  await rechaza(() => validarCatalogo(catalogo));
});
test('Los marcadores fuera de imagen se rechazan', async () => {
  const { catalogo } = await datos(); catalogo.relatos[0].recursos[0].marcadores[0].x = 1.1;
  await rechaza(() => validarCatalogo(catalogo));
});
test('Se detectan recursos faltantes y estudios ajenos', async () => {
  const { catalogo,contenidos } = await datos(); const r = catalogo.relatos[0]; const d = await contenidos.cargarVisuales(r);
  await rechaza(() => validarRelaciones(r,d.estudio,{ recursos:[] }));
  await rechaza(() => validarRelaciones(r,{ ...d.estudio,relatoId:'otro' },{ recursos:d.recursos }));
});
test('Se rechazan estados desconocidos y páginas vacías', async () => {
  const { catalogo,contenidos } = await datos(); const d = await contenidos.cargarVisuales(catalogo.relatos[0]);
  await rechaza(() => validarEstudio({ ...d.estudio,estadoEditorial:'publicado' }));
  d.estudio.secciones[0].paginas = []; await rechaza(() => validarEstudio(d.estudio));
});
test('La portada requiere metadatos 16:9', async () => {
  const { catalogo,contenidos } = await datos(); const d = await contenidos.cargarVisuales(catalogo.relatos[0]);
  d.recursos[0].dimensiones.alto = 1000;
  await rechaza(() => validarRecursos({ schemaVersion:1,recursos:d.recursos }));
});
test('No se aceptan URLs de imágenes externas', async () => {
  const { catalogo,contenidos } = await datos(); const d = await contenidos.cargarVisuales(catalogo.relatos[0]);
  const servicio = crearServicioContenidos({ baseURL:new URL('../datos/',import.meta.url),fetcher:async url => ({ ok:true,json:async () => String(url).endsWith('recursos.json') ? { schemaVersion:1,recursos:d.recursos.map(r => ({ ...r,src:'https://example.com/a.svg' })) } : d.estudio }) });
  await rechaza(() => servicio.cargarVisuales(catalogo.relatos[0]));
});
test('Las páginas de marcador rechazan vacíos y duplicados y aceptan párrafos heredados', async () => {
  const {catalogo}=await datos(); const m=catalogo.relatos[0].recursos[0].marcadores[0];
  const paginas=m.paginas;
  m.paginas=[]; await rechaza(()=>validarCatalogo(catalogo));
  m.paginas=[paginas[0],paginas[0]]; await rechaza(()=>validarCatalogo(catalogo));
  delete m.paginas; m.parrafos=['DEMO: panel anterior de una sola página.'];
  validarCatalogo(catalogo);
  m.parrafos=[]; await rechaza(()=>validarCatalogo(catalogo));
});
