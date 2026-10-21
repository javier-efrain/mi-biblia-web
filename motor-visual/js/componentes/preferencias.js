import { nodo, boton } from './dom.js';
import { TAMANO_MINIMO, TAMANO_MAXIMO, TAMANO_INICIAL } from '../estado/preferencias.js';

export function crearControlesPreferencias(preferencias, { compacto = false } = {}) {
  const reducir = boton('A−', () => preferencias.ajustarTamano(-2), { 'aria-label':'Reducir tamaño de letra', 'aria-controls':'motor', title:'Reducir tamaño de letra' });
  const aumentar = boton('A+', () => preferencias.ajustarTamano(2), { 'aria-label':'Aumentar tamaño de letra', 'aria-controls':'motor', title:'Aumentar tamaño de letra' });
  const tamano = nodo('output', { 'aria-live':'polite', 'aria-atomic':'true', 'aria-label':'Tamaño de lectura' });
  const restablecer = boton(compacto ? `↺ ${TAMANO_INICIAL} px` : `Restablecer ${TAMANO_INICIAL} px`, () => preferencias.restablecerLectura(), { 'aria-label':`Restablecer tamaño de letra a ${TAMANO_INICIAL} px`, 'aria-controls':'motor', title:`Restablecer lectura a ${TAMANO_INICIAL} px` });
  const el = nodo('section', { className:'mv-preferencias', 'aria-label':'Apariencia y tamaño de lectura' },
    nodo('h2', { className:'mv-solo-lectores' }, 'Apariencia y lectura'),
    nodo('div', { className:'mv-ajustes', role:'group', 'aria-label':'Ajustes de lectura' }, reducir, tamano, aumentar, restablecer));
  const desuscribir = preferencias.suscribir(estado => {
    tamano.textContent = `${estado.tamano} px${estado.persistido ? '' : ' · Solo esta sesión'}`;
    reducir.disabled = estado.tamano === TAMANO_MINIMO;
    aumentar.disabled = estado.tamano === TAMANO_MAXIMO;
  });
  return { el, destruir:desuscribir };
}
