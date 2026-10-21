export const CLAVE_PREFERENCIAS = 'mi-biblia-web:motor-visual:preferencias:v1';
export const TAMANO_MINIMO = 8;
export const TAMANO_MAXIMO = 30;
export const TAMANO_INICIAL = 12;
const INICIALES = { apariencia:'claro', tamano:TAMANO_INICIAL };

export function normalizarPreferencias(valor) {
  return {
    // La apariencia editorial clara reemplaza también el oscuro guardado anteriormente.
    apariencia: 'claro',
    // Mantener las preferencias anteriores; 31/32 px se adaptan al nuevo máximo.
    tamano: Number.isInteger(valor?.tamano) && valor.tamano >= TAMANO_MINIMO && valor.tamano <= 32 ? Math.min(valor.tamano, TAMANO_MAXIMO) : INICIALES.tamano
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
    restablecerLectura: () => actualizar({ tamano:INICIALES.tamano }),
    ajustarTamano: delta => {
      if (!Number.isFinite(delta)) return;
      actualizar({ tamano:Math.max(TAMANO_MINIMO, Math.min(TAMANO_MAXIMO, Math.round(estado.tamano + delta))) });
    },
    suscribir(oyente) { oyentes.add(oyente); oyente({ ...estado, persistido }); return () => oyentes.delete(oyente); }
  };
}
