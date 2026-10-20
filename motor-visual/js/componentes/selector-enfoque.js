import { nodo, boton } from './dom.js';
export function crearSelectorEnfoque(enfoque, cambiar) {
  return nodo('div', { className:'mv-enfoques', role:'group', 'aria-label':'Enfoque educativo' },
    ...[['estudio','Estudio'],['devocional','Devocional']].map(([valor,titulo]) =>
      boton(titulo, () => cambiar(valor), { 'aria-pressed':String(enfoque === valor), 'data-enfoque':valor })));
}
