import { test,assert,rechaza,datos,diferida } from './harness.js';
import { crearServicioBiblia,validarReferencia } from '../js/servicios/biblia.js';
const ref = rangos => ({ version:'DEMO',libro:'contenido-sintetico',rangos });
const r = { capitulo:1,desde:1,hasta:2 };
const fuente = async () => (await fetch(new URL('fixtures/contenido-sintetico.json',import.meta.url))).json();
test('El lector conserva literalmente el texto sintético de la fuente', async () => {
  const { biblia } = await datos(); const original = await fuente(); const p = await biblia.obtenerPasaje(ref([r]));
  assert(p.texto.length===2 && p.texto[0].texto===original.capitulos['1']['1']);
});
test('Los rangos discontinuos y entre capítulos conservan el orden', async () => {
  const { biblia } = await datos(); const p = await biblia.obtenerPasaje(ref([r,{ capitulo:1,desde:4,hasta:4 },{ capitulo:2,desde:1,hasta:1 }]));
  assert(p.texto.map(v => `${v.capitulo}:${v.numero}`).join(',')==='1:1,1:2,1:4,2:1');
});
test('La caché comparte solicitudes concurrentes del mismo libro', async () => {
  let llamadas=0; const espera = diferida(); const original = await fuente();
  const biblia = crearServicioBiblia({ baseURL:new URL('fixtures/',import.meta.url),version:'DEMO',fetcher:async () => { llamadas++; await espera.promesa; return { ok:true,json:async () => original }; } });
  const a=biblia.obtenerPasaje(ref([r])), b=biblia.obtenerPasaje(ref([r])); espera.resolver(); await Promise.all([a,b]); assert(llamadas===1);
});
test('Un fallo HTTP permite reintentar', async () => {
  let llamadas=0; const original = await fuente();
  const biblia = crearServicioBiblia({ baseURL:new URL('fixtures/',import.meta.url),version:'DEMO',fetcher:async () => ++llamadas===1 ? { ok:false,status:503 } : { ok:true,json:async () => original } });
  await rechaza(() => biblia.obtenerPasaje(ref([r]))); await biblia.obtenerPasaje(ref([r])); assert(llamadas===2);
});
test('Capítulos y versículos faltantes producen un error explícito', async () => {
  const { biblia } = await datos();
  await rechaza(() => biblia.obtenerPasaje(ref([{ capitulo:9,desde:1,hasta:1 }])));
  await rechaza(() => biblia.obtenerPasaje(ref([{ capitulo:1,desde:7,hasta:7 }])));
});
test('Se rechazan rangos vacíos, invertidos, decimales y superpuestos', async () => {
  for (const rangos of [[],[{ ...r,desde:0 }],[{ ...r,desde:3 }],[{ ...r,desde:1.5 }],[r,r]]) await rechaza(() => validarReferencia(ref(rangos)));
});
test('Una referencia RVC no se acepta en la demo y no solicita la red', async () => {
  let llamadas=0;
  const biblia = crearServicioBiblia({ baseURL:new URL('fixtures/',import.meta.url),version:'DEMO',fetcher:async () => { llamadas++; } });
  await rechaza(() => biblia.obtenerPasaje({ ...ref([r]),version:'RVC' })); assert(llamadas===0);
});
test('El nombre del libro no puede escapar del directorio', async () => {
  const { biblia } = await datos(); await rechaza(() => biblia.obtenerPasaje({ ...ref([r]),libro:'../rvc/marcos' }));
});
test('Un JSON inválido o una versión incompatible no queda en caché', async () => {
  let llamadas=0; const original=await fuente();
  const biblia=crearServicioBiblia({ baseURL:new URL('fixtures/',import.meta.url),version:'DEMO',fetcher:async () => {
    llamadas++;
    return { ok:true,json:async () => { if(llamadas===1) throw new SyntaxError('JSON sintético inválido'); return llamadas===2 ? { ...original,version:'OTRA' } : original; } };
  } });
  await rechaza(() => biblia.obtenerPasaje(ref([r])));
  await rechaza(() => biblia.obtenerPasaje(ref([r])));
  const pasaje=await biblia.obtenerPasaje(ref([r])); assert(pasaje.texto.length===2 && llamadas===3);
});
