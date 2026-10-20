import { nodo, mensaje } from '../componentes/dom.js';
import { crearLector, claveVersiculo } from '../componentes/lector.js';
import { crearSelectorModo } from '../componentes/selector-modo.js';
import { crearNavegacion, leerRuta, escribirRuta } from './navegacion.js';

// Los módulos visuales no forman parte de la ruta inicial de Solo texto.
export async function crearMotor({ root, catalogo, biblia, contenidos, inicial, usarHistorial = false }) {
  let estado = inicial || { relatoId:catalogo.relatos[0].id, modo:'texto' };
  let generacion = 0, carga = null, destruido = false;
  const eventos = new AbortController();
  async function renderizar(proximo = estado, { historial = true } = {}) {
    if (destruido) return;
    if (!['texto','visual'].includes(proximo.modo)) throw new Error('Modo inválido.');
    const relato = catalogo.relatos.find(r => r.id === proximo.relatoId);
    if (!relato) throw new Error('Relato inexistente.');
    const focoDentro = root.contains(document.activeElement);
    const focoModo = focoDentro && document.activeElement?.dataset.modo;
    carga?.abort(); carga = new AbortController();
    const { signal } = carga;
    const turno = ++generacion;
    estado = { relatoId:relato.id, modo:proximo.modo };
    if (usarHistorial && historial) escribirRuta(estado);
    const vigente = () => !destruido && !signal.aborted && turno === generacion;
    root.dataset.modo = estado.modo; root.dataset.relato = relato.id;
    const titulo = nodo('h2', { tabindex:-1 }, relato.titulo);
    const referencia = nodo('p', { className:'mv-referencia' }, relato.referenciaEtiqueta);
    const cuerpo = nodo('div', { className:'mv-cuerpo' }, mensaje('Cargando texto…'));
    const cambiarModo = modo => renderizar({ ...estado, modo });
    const seleccionar = relatoId => renderizar({ ...estado, relatoId });
    root.replaceChildren(crearSelectorModo(estado.modo,cambiarModo),titulo,referencia,
      crearNavegacion(catalogo,relato.id,seleccionar),cuerpo);
    if (focoModo) root.querySelector(`[data-modo="${estado.modo}"]`)?.focus();
    else if (focoDentro) titulo.focus();
    try {
      const pasaje = await biblia.obtenerPasaje(relato.referencia);
      if (!vigente()) return;
      const lector = crearLector(pasaje); cuerpo.replaceChildren(lector);
      if (estado.modo === 'texto') return;
      const estadoVisual = mensaje('Cargando recursos de demostración…'); cuerpo.append(estadoVisual);
      try {
        const [datos, { crearPortada }, { crearExplorador }, { crearLecturaHorizontal }, { crearDescubrimiento }] = await Promise.all([
          contenidos.cargarVisuales(relato,{ signal }),
          import('../componentes/portada.js'), import('../componentes/explorador.js'),
          import('../componentes/lectura-horizontal.js'), import('../componentes/descubrimiento.js')
        ]);
        if (!vigente()) return;
        const recursos = new Map(datos.recursos.map(r => [r.id,r]));
        const portada = recursos.get(relato.portadaId);
        cuerpo.insertBefore(crearPortada(portada, relato.titulo),lector);
        // Agrupar por versículo evita invertir el orden de múltiples recursos en un mismo anclaje.
        for (const versiculo of lector.querySelectorAll('[data-versiculo]')) {
          const usos = relato.recursos.filter(u => claveVersiculo({ libro:u.anclajeBiblico.libro,capitulo:u.anclajeBiblico.capitulo,numero:u.anclajeBiblico.versiculo }) === versiculo.dataset.versiculo);
          let cursor = versiculo;
          for (const uso of usos) {
            const recurso = crearExplorador(recursos.get(uso.recursoId),uso,{ signal });
            cursor.after(recurso); cursor = recurso;
          }
        }
        cuerpo.append(crearLecturaHorizontal(datos.estudio,{ signal }),
          crearDescubrimiento(catalogo,datos.recursos,seleccionar,{ incluirDemostracion:true }));
        estadoVisual.remove();
      } catch (error) {
        if (vigente()) estadoVisual.textContent = 'Recursos educativos no disponibles. Podés continuar leyendo el texto.';
      }
    } catch (error) {
      if (vigente()) cuerpo.replaceChildren(mensaje('No fue posible cargar el texto. Probá seleccionar otro relato o volver a elegir el modo.'));
    }
  }
  if (usarHistorial) window.addEventListener('popstate', () => renderizar(leerRuta(location.search,catalogo), { historial:false }), { signal:eventos.signal });
  await renderizar(estado, { historial:false });
  return {
    cambiarModo: modo => renderizar({ ...estado,modo }),
    seleccionar: relatoId => renderizar({ ...estado,relatoId }),
    obtenerEstado: () => ({ ...estado }),
    destruir() { destruido=true; generacion++; carga?.abort(); eventos.abort(); root.replaceChildren(); }
  };
}
