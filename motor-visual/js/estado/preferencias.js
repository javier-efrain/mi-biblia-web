export const CLAVE_PREFERENCIAS = 'mi-biblia-web:motor-visual:preferencias:v1';
export const TAMANO_MINIMO = 16;
export const TAMANO_MAXIMO = 32;
const INICIALES = { apariencia:'oscuro', tamano:20 };

export function normalizarPreferencias(valor) {
  return {
    apariencia: valor?.apariencia === 'claro' ? 'claro' : 'oscuro',
    tamano: Number.isInteger(valor?.tamano) && valor.tamano >= TAMANO_MINIMO && valor.tamano <= TAMANO_MAXIMO ? valor.tamano : INICIALES.tamano
  };
}

// Solo guarda preferencias de presentación; nunca contenido o referencias bíblicas.
// El acceso al almacenamiento puede estar bloqueado por la configuración del navegador.
export function crearPreferencias({ raiz = document.body, almacen } = {}) {
  const almacenamiento = () => almacen ?? globalThis.localStorage;
  let estado = { ...INICIALES }, persistido = true;
  try { estado = normalizarPreferencias(JSON.parse(almacenamiento().getItem(CLAVE_PREFERENCIAS))); }
  catch { /* Se mantiene la apariencia inicial cuando no se puede recuperar la preferencia. */ }
  const oyentes = new Set();
  function aplicar() {
    raiz.dataset.apariencia = estado.apariencia;
    raiz.style.setProperty('--mv-tamano-lectura', `${estado.tamano}px`);
    for (const oyente of oyentes) oyente({ ...estado, persistido });
  }
  function actualizar(cambios) {
    estado = normalizarPreferencias({ ...estado, ...cambios });
    try { almacenamiento().setItem(CLAVE_PREFERENCIAS, JSON.stringify(estado)); persistido = true; }
    catch { persistido = false; }
    aplicar();
  }
  aplicar();
  return {
    obtener: () => ({ ...estado, persistido }),
    cambiarApariencia: () => actualizar({ apariencia:estado.apariencia === 'oscuro' ? 'claro' : 'oscuro' }),
    ajustarTamano: delta => {
      if (!Number.isFinite(delta)) return;
      actualizar({ tamano:Math.max(TAMANO_MINIMO, Math.min(TAMANO_MAXIMO, Math.round(estado.tamano + delta))) });
    },
    suscribir(oyente) { oyentes.add(oyente); oyente({ ...estado, persistido }); return () => oyentes.delete(oyente); }
  };
}
