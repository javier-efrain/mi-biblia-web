import { nodo, boton } from './dom.js';
export function crearSelectorModo(modo, cambiar) {
  return nodo('div', { className:'mv-modos', role:'group', 'aria-label':'Modo de lectura' },
    boton('Solo texto bíblico', () => cambiar('texto'), { 'aria-pressed':modo === 'texto', 'data-modo':'texto' }),
    boton('Con recursos visuales', () => cambiar('visual'), { 'aria-pressed':modo === 'visual', 'data-modo':'visual' }));
}
