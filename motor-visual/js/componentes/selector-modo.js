import { nodo, boton } from './dom.js';
export function crearSelectorModo(modo, cambiar) {
  return nodo('div', { className:'mv-modos', role:'group', 'aria-label':'Modo de lectura' },
    boton('Visual', () => cambiar('visual'), { 'aria-label':'Con recursos visuales', 'aria-pressed':String(modo === 'visual'), 'data-modo':'visual' }),
    boton('Solo texto', () => cambiar('texto'), { 'aria-label':'Solo texto bíblico', 'aria-pressed':String(modo === 'texto'), 'data-modo':'texto' }));
}
