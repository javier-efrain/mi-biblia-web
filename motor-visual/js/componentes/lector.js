import { nodo } from './dom.js';
export const claveVersiculo = v => `${v.libro}:${v.capitulo}:${v.numero}`;
export function crearLector(pasaje) {
  const el = nodo('section', { className:'mv-texto', 'aria-label':pasaje.version === 'DEMO' ? 'Texto sintético de demostración; no es una traducción bíblica' : 'Texto bíblico' });
  for (const v of pasaje.texto) {
    const p = nodo('p', { 'data-versiculo':claveVersiculo(v) }, nodo('sup', {}, String(v.numero)), ` ${v.texto}`);
    el.append(p);
  }
  return el;
}
