import { validarReferencia } from './biblia.js';
const estados = ['borrador', 'en_revision', 'aprobado'];
function exigir(condicion, mensaje) { if (!condicion) throw new Error(mensaje); }
function texto(x) { return typeof x === 'string' && x.trim().length > 0; }
function identidad(x) {
  exigir(x?.schemaVersion === 1 && texto(x.id) && /^[a-z0-9-]+$/.test(x.id), 'Identidad o versión inválida.');
  exigir(estados.includes(x.estadoEditorial), 'Estado editorial inválido.');
  exigir(typeof x.demostracion === 'boolean', 'Falta indicar si es demostración.');
}
export function validarCatalogo(catalogo) {
  exigir(catalogo?.schemaVersion === 1 && Array.isArray(catalogo.relatos) && catalogo.relatos.length, 'Catálogo inválido.');
  const ids = new Set();
  const ordenes = new Set();
  for (const r of catalogo.relatos) {
    identidad(r);
    exigir(!ids.has(r.id), 'Relato duplicado.'); ids.add(r.id);
    exigir(texto(r.titulo) && texto(r.presentacion) && texto(r.referenciaEtiqueta) && texto(r.coleccionId), 'Metadatos incompletos.');
    exigir(Number.isInteger(r.orden) && r.orden >= 0 && !ordenes.has(`${r.coleccionId}:${r.orden}`), 'Orden inválido o duplicado.');
    ordenes.add(`${r.coleccionId}:${r.orden}`);
    validarReferencia(r.referencia);
    exigir(texto(r.estudioId) && texto(r.portadaId) && Array.isArray(r.recursos), 'Relaciones incompletas.');
    const usos = new Set();
    for (const uso of r.recursos) {
      exigir(texto(uso.id) && !usos.has(uso.id) && texto(uso.recursoId), 'Uso de recurso inválido.'); usos.add(uso.id);
      exigir(['educativo', 'interactivo'].includes(uso.presentacion), 'Presentación inválida.');
      const a = uso.anclajeBiblico;
      exigir(a && a.libro === r.referencia.libro && a.version === r.referencia.version && a.posicion === 'despues', 'Anclaje incompatible.');
      exigir(Number.isInteger(a.versiculo) && r.referencia.rangos.some(x => x.capitulo === a.capitulo && a.versiculo >= x.desde && a.versiculo <= x.hasta), 'Anclaje fuera del pasaje.');
      exigir(Array.isArray(uso.marcadores), 'Marcadores inválidos.');
      const marcadores = new Set();
      for (const m of uso.marcadores) {
        exigir(texto(m.id) && !marcadores.has(m.id), 'Marcador duplicado.'); marcadores.add(m.id);
        exigir([m.x, m.y].every(n => Number.isFinite(n) && n >= 0 && n <= 1), 'Coordenadas inválidas.');
        exigir(texto(m.titulo) && texto(m.certezaHistorica) && Array.isArray(m.parrafos) && m.parrafos.length && m.parrafos.every(texto), 'Panel inválido.');
      }
    }
  }
  return catalogo;
}
export function validarEstudio(estudio) {
  identidad(estudio);
  exigir(texto(estudio.relatoId) && Array.isArray(estudio.fuentes) && Array.isArray(estudio.secciones) && estudio.secciones.length, 'Estudio inválido.');
  const ids = new Set();
  for (const seccion of estudio.secciones) {
    exigir(texto(seccion.id) && !ids.has(seccion.id), 'Sección duplicada.'); ids.add(seccion.id);
    exigir(['contexto', 'exegesis', 'ensenanzas', 'aplicacion', 'devocional'].includes(seccion.tipo) && texto(seccion.titulo), 'Sección inválida.');
    exigir(Array.isArray(seccion.paginas) && seccion.paginas.length, 'Sección vacía.');
    const paginas = new Set();
    for (const pagina of seccion.paginas) {
      exigir(texto(pagina.id) && !paginas.has(pagina.id), 'Página duplicada.'); paginas.add(pagina.id);
      exigir(texto(pagina.titulo) && Array.isArray(pagina.parrafos) && pagina.parrafos.length && pagina.parrafos.every(texto), 'Página inválida.');
      exigir(Array.isArray(pagina.referencias) && pagina.referencias.every(texto), 'Referencias inválidas.');
    }
  }
  return estudio;
}
export function validarRecursos(biblioteca) {
  exigir(biblioteca?.schemaVersion === 1 && Array.isArray(biblioteca.recursos), 'Biblioteca inválida.');
  const ids = new Set();
  for (const r of biblioteca.recursos) {
    identidad(r);
    exigir(!ids.has(r.id), 'Recurso duplicado.'); ids.add(r.id);
    exigir(['portada', 'mapa', 'imagen', 'diagrama'].includes(r.tipo), 'Tipo inválido.');
    exigir([r.src, r.alt, r.leyenda, r.autoria, r.derechos].every(texto), 'Metadatos de recurso incompletos.');
    exigir(r.dimensiones && [r.dimensiones.ancho, r.dimensiones.alto].every(n => Number.isInteger(n) && n > 0), 'Dimensiones inválidas.');
    if (r.tipo === 'portada') exigir(r.dimensiones.ancho * 9 === r.dimensiones.alto * 16, 'La portada debe ser 16:9.');
  }
  return biblioteca;
}
export function validarRelaciones(relato, estudio, biblioteca) {
  exigir(estudio.id === relato.estudioId && estudio.relatoId === relato.id, 'Estudio de otro relato.');
  exigir(estudio.demostracion === relato.demostracion, 'Contenido demo incompatible.');
  const mapa = new Map(biblioteca.recursos.map(r => [r.id, r]));
  exigir(mapa.get(relato.portadaId)?.tipo === 'portada', 'Portada inexistente.');
  for (const id of [relato.portadaId, ...relato.recursos.map(u => u.recursoId)]) {
    exigir(mapa.has(id) && mapa.get(id).demostracion === relato.demostracion, 'Recurso inexistente o incompatible.');
  }
}
