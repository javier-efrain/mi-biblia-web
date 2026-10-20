import { test, assert } from './harness.js';
import { CLAVE_PREFERENCIAS, crearPreferencias, normalizarPreferencias } from '../js/estado/preferencias.js';
import { crearControlesPreferencias } from '../js/componentes/preferencias.js';
function memoria(inicial = null) {
  let contenido = inicial;
  return { getItem: () => contenido, setItem: (clave, valor) => { assert(clave===CLAVE_PREFERENCIAS); contenido = valor; } };
}
function montaje(almacen = memoria()) {
  const raiz = document.createElement('div'); raiz.className = 'mv';
  document.querySelector('#sandbox').append(raiz);
  const preferencias = crearPreferencias({ raiz, almacen });
  const controles = crearControlesPreferencias(preferencias); raiz.append(controles.el);
  return { raiz, preferencias, almacen, destruir() { controles.destruir(); raiz.remove(); } };
}

test('La apariencia inicial es oscura y la lectura empieza en 8 px', () => {
  const m=montaje();
  try { assert(m.raiz.dataset.apariencia==='oscuro'); assert(m.raiz.style.getPropertyValue('--mv-tamano-lectura')==='8px'); }
  finally { m.destruir(); }
});
test('El tamaño se limita a 8–30 px y los botones reflejan sus límites', () => {
  const m=montaje();
  try {
    m.preferencias.ajustarTamano(999); assert(m.preferencias.obtener().tamano===30);
    assert(m.raiz.querySelector('[aria-label="Aumentar tamaño de letra"]').disabled);
    m.preferencias.ajustarTamano(-999); assert(m.preferencias.obtener().tamano===8);
    assert(m.raiz.querySelector('[aria-label="Reducir tamaño de letra"]').disabled);
    m.preferencias.ajustarTamano(NaN); assert(m.preferencias.obtener().tamano===8);
  } finally { m.destruir(); }
});
test('Apariencia y tamaño se recuperan del almacenamiento sin guardar contenido', () => {
  const almacen=memoria(), m=montaje(almacen);
  try {
    m.preferencias.cambiarApariencia(); m.preferencias.ajustarTamano(22);
    const guardado=JSON.parse(almacen.getItem());
    assert(Object.keys(guardado).sort().join(',')==='apariencia,tamano');
    const otro=montaje(almacen);
    try { assert(otro.preferencias.obtener().apariencia==='claro' && otro.preferencias.obtener().tamano===30); }
    finally { otro.destruir(); }
  } finally { m.destruir(); }
});
test('Preferencias corruptas o fuera de rango usan los valores experimentales', () => {
  for (const valor of ['{roto','null','32','{"tamano":900,"apariencia":"otra"}']) {
    const m=montaje(memoria(valor));
    try { assert(m.preferencias.obtener().tamano===8 && m.preferencias.obtener().apariencia==='oscuro'); }
    finally { m.destruir(); }
  }
  assert(normalizarPreferencias({ tamano:'30' }).tamano===8);
});
test('Bloquear el almacenamiento no impide ajustar la lectura durante la sesión', () => {
  const m=montaje({ getItem() { throw new Error('Bloqueado'); }, setItem() { throw new Error('Bloqueado'); } });
  try {
    m.raiz.querySelector('[aria-label="Aumentar tamaño de letra"]').click();
    assert(m.preferencias.obtener().tamano===10);
    assert(m.raiz.querySelector('output').textContent.includes('Solo esta sesión'));
  } finally { m.destruir(); }
});
test('Los ajustes preservan los nodos de lectura y exponen su estado accesible', () => {
  const m=montaje();
  try {
    const parrafo=document.createElement('p'); parrafo.textContent='DEMOSTRACIÓN'; m.raiz.append(parrafo);
    const tema=m.raiz.querySelector('[aria-label="Modo oscuro"]');
    assert(tema.getAttribute('aria-pressed')==='true'); tema.click();
    assert(tema.getAttribute('aria-pressed')==='false');
    m.raiz.querySelector('[aria-label="Aumentar tamaño de letra"]').click();
    assert(m.raiz.lastChild===parrafo && parrafo.isConnected);
    for (const boton of m.raiz.querySelectorAll('button')) {
      const r=boton.getBoundingClientRect(); assert(r.width>=44 && r.height>=44);
    }
  } finally { m.destruir(); }
});
function luminancia(rgb) {
  const valores=rgb.match(/[\d.]+/g).slice(0,3).map(n => { const v=Number(n)/255; return v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4; });
  return valores[0]*.2126+valores[1]*.7152+valores[2]*.0722;
}
function contraste(a,b) { const x=luminancia(a),y=luminancia(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
test('Ambas apariencias mantienen contraste AA en texto, paneles y controles', () => {
  const m=montaje();
  try {
    for (const tema of ['oscuro','claro']) {
      m.raiz.dataset.apariencia=tema;
      const muestra=document.createElement('p'); m.raiz.append(muestra);
      for (const fondo of ['--mv-fondo','--mv-superficie','--mv-panel','--mv-aviso']) {
        muestra.style.backgroundColor=`var(${fondo})`;
        for (const texto of ['--mv-texto','--mv-secundario']) {
          muestra.style.color=`var(${texto})`; const c=getComputedStyle(muestra);
          assert(contraste(c.color,c.backgroundColor)>=4.5,`${tema}: ${texto}/${fondo}`);
        }
      }
      muestra.style.backgroundColor='var(--mv-seleccion)'; muestra.style.color='var(--mv-sobre-seleccion)';
      const c=getComputedStyle(muestra); assert(contraste(c.color,c.backgroundColor)>=4.5);
      muestra.style.backgroundColor='var(--mv-fondo)'; muestra.style.color='var(--mv-acento)';
      const foco=getComputedStyle(muestra); assert(contraste(foco.color,foco.backgroundColor)>=3);
      muestra.remove();
    }
  } finally { m.destruir(); }
});

test('Las preferencias anteriores de 20 px se conservan hasta restablecer la lectura', () => {
  const almacen=memoria(JSON.stringify({ apariencia:'claro',tamano:20 })), m=montaje(almacen);
  try {
    assert(m.preferencias.obtener().tamano===20 && m.preferencias.obtener().apariencia==='claro');
    m.raiz.querySelector('[aria-label="Restablecer tamaño de letra a 8 px"]').click();
    assert(m.preferencias.obtener().tamano===8 && m.preferencias.obtener().apariencia==='claro');
    const otro=montaje(almacen);
    try { assert(otro.preferencias.obtener().tamano===8 && otro.preferencias.obtener().apariencia==='claro'); }
    finally { otro.destruir(); }
  } finally { m.destruir(); }
});
test('Los 32 px anteriores se adaptan a 30 px sin perder la apariencia elegida', () => {
  const m=montaje(memoria(JSON.stringify({ apariencia:'claro',tamano:32 })));
  try { assert(m.preferencias.obtener().tamano===30 && m.preferencias.obtener().apariencia==='claro'); }
  finally { m.destruir(); }
});
