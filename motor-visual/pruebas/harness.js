import { crearServicioContenidos } from '../js/servicios/contenidos.js';
import { crearServicioBiblia } from '../js/servicios/biblia.js';
import { crearMotor } from '../js/estado/lectura.js';
const casos = [];
export const test = (nombre, fn) => casos.push({ nombre,fn });
export function assert(condicion, mensaje = 'La condición no se cumplió') { if (!condicion) throw new Error(mensaje); }
export async function rechaza(fn) {
  let fallo = false;
  try { await fn(); } catch { fallo = true; }
  assert(fallo, 'Se esperaba un rechazo');
}
export function diferida() { let resolver; const promesa = new Promise(r => { resolver = r; }); return { promesa,resolver }; }
export async function datos() {
  const contenidos = crearServicioContenidos({ baseURL:new URL('../datos/',import.meta.url) });
  const catalogo = await contenidos.cargarCatalogo();
  const biblia = crearServicioBiblia({ baseURL:new URL('fixtures/',import.meta.url),version:'DEMO' });
  return { catalogo,biblia,contenidos };
}
export async function conMotor(fn, opciones = {}) {
  const root = document.createElement('div'); root.className = 'mv-motor';
  document.querySelector('#sandbox').append(root);
  const dependencias = await datos();
  const motor = await crearMotor({ root,...dependencias,...opciones });
  try { await fn({ root,motor,...dependencias }); }
  finally { motor.destruir(); root.remove(); }
}
export const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
export async function ejecutar() {
  const resultados = [];
  for (const caso of casos) {
    try { await caso.fn(); resultados.push({ nombre:caso.nombre, ok:true }); }
    catch(error) { resultados.push({ nombre:caso.nombre,ok:false,error:error.message }); }
  }
  const lista = document.querySelector('#resultados');
  for (const r of resultados) {
    const li = document.createElement('li'); li.textContent = `${r.ok?'✓':'✗'} ${r.nombre}${r.error?': '+r.error:''}`; lista.append(li);
  }
  window.__resultados = { total:resultados.length, aprobadas:resultados.filter(r => r.ok).length, resultados };
  document.querySelector('#resumen').textContent = `${window.__resultados.aprobadas}/${resultados.length} pruebas aprobadas`;
}
