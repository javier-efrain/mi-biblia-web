// Todo el contenido editorial se inserta como texto, nunca como HTML.
export function nodo(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') el.className = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== false && value != null) el.setAttribute(key, String(value));
  }
  el.append(...children.filter(x => x != null));
  return el;
}
export function boton(texto, accion, attrs = {}) {
  return nodo('button', { type: 'button', ...attrs, onclick: accion }, texto);
}
export function mensaje(texto) {
  return nodo('p', { role: 'status', className: 'mv-aviso' }, texto);
}
