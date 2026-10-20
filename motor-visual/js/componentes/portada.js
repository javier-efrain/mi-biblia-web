import { nodo } from './dom.js';
export function crearPortada(recurso, titulo, { pieVisible = true } = {}) {
  const imagen = nodo('img', { src:recurso.src, alt:recurso.alt, width:1600, height:900 });
  const figura = nodo('figure', { className:'mv-portada', 'data-educativo':'portada' }, imagen,
    nodo('figcaption', { className:pieVisible ? '' : 'mv-solo-lectores' }, titulo, nodo('small', {}, recurso.leyenda)));
  imagen.addEventListener('error', () => imagen.replaceWith(nodo('p', { role:'status' }, 'Portada no disponible.')));
  return figura;
}
