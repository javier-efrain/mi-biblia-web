import { nodo, boton } from './dom.js';
import { crearPortada } from './portada.js';
export function crearDescubrimiento(catalogo, recursos, seleccionar, { incluirDemostracion = false } = {}) {
  const el = nodo('section', { className:'mv-descubrimiento', 'data-educativo':'descubrimiento', 'aria-label':'Descubrir relatos' });
  const grid = nodo('div', { className:'mv-tarjetas' });
  for (const relato of catalogo.relatos.filter(r => r.demostracion ? incluirDemostracion : r.estadoEditorial === 'aprobado')) {
    const portada = recursos.find(r => r.id === relato.portadaId);
    if (!portada) continue;
    grid.append(nodo('article', { className:'mv-tarjeta' }, crearPortada(portada, relato.titulo),
      nodo('p', {}, relato.presentacion), nodo('small', {}, `${relato.referenciaEtiqueta} · ${relato.estadoEditorial}${relato.demostracion?' · DEMOSTRACIÓN':''}`),
      boton('Abrir relato', () => seleccionar(relato.id), { 'aria-label':`Abrir ${relato.titulo}` })));
  }
  el.append(nodo('h2', {}, 'Descubrir demostraciones'),grid); return el;
}
