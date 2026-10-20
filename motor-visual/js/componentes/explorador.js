import { nodo, boton } from './dom.js';
import { crearVisor } from './visor.js';
export function crearExplorador(recurso, uso, { signal } = {}) {
  const el = nodo('section', { className:'mv-recurso', 'data-educativo':'recurso', 'data-uso':uso.id });
  const panel = nodo('aside', { className:'mv-panel', 'aria-live':'polite' });
  function seleccionar(m) {
    panel.replaceChildren(nodo('h4', {}, m.titulo), ...m.parrafos.map(p => nodo('p', {}, p)), nodo('small', {}, m.certezaHistorica));
  }
  const visor = crearVisor(recurso, { marcadores:uso.marcadores, seleccionar, signal });
  const dialogo = nodo('dialog', { className:'mv-dialogo', 'aria-label':recurso.alt });
  let disparador;
  const cerrar = boton('Cerrar visor', () => dialogo.close());
  const expandir = boton('Ampliar visor', () => {
    disparador = document.activeElement;
    dialogo.append(visor.el, panel); dialogo.showModal(); cerrar.focus();
  });
  const cuerpo = nodo('div', { className:'mv-explorador' }, visor.el, panel);
  dialogo.append(cerrar);
  dialogo.addEventListener('close', () => {
    if (!signal?.aborted) {
      // El evento close es asíncrono: no robar foco si la persona ya continuó leyendo.
      const restaurar = dialogo.contains(document.activeElement) ||
        document.activeElement === document.body || document.activeElement === disparador;
      cuerpo.append(visor.el, panel);
      if (restaurar) disparador?.focus();
    }
  });
  signal?.addEventListener('abort', () => {
    if (dialogo.open) dialogo.close();
    dialogo.remove(); visor.destruir();
  }, { once:true });
  panel.append(nodo('p', {}, uso.marcadores.length ? 'Seleccioná un marcador para explorar el diagrama de demostración.' : 'Imagen educativa de demostración.'));
  el.append(nodo('h3', {}, recurso.alt), expandir, cuerpo, dialogo);
  return el;
}
