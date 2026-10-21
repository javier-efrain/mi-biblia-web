import { test,assert,conMotor,datos,diferida,esperar } from './harness.js';
test('Solo texto no llama al servicio visual ni monta imágenes, estudios o visores', async () => {
  let solicitudes=0;
  await conMotor(async ({ root }) => {
    assert(solicitudes===0); assert(root.querySelectorAll('[data-versiculo]').length===2);
    assert(!root.querySelector('img,[data-educativo],dialog,input[type="range"]'));
  }, { contenidos:{ cargarVisuales:async () => { solicitudes++; } } });
});
test('Tres relatos se renderizan con el mismo motor y anclajes correctos', async () => {
  await conMotor(async ({ root,motor,catalogo }) => {
    await motor.cambiarModo('visual');
    for (const r of catalogo.relatos) {
      await motor.seleccionar(r.id);
      assert(root.querySelectorAll('.mv-contexto').length===1 && root.querySelectorAll('.mv-cierre').length===1);
      assert(root.querySelectorAll('.mv-portada:not(.mv-tarjeta .mv-portada)').length===1);
      for (const uso of r.recursos) {
        const recurso=root.querySelector(`[data-uso="${uso.id}"]`);
        let anterior=recurso.previousElementSibling;
        while (anterior && !anterior.dataset.versiculo) anterior=anterior.previousElementSibling;
        assert(anterior?.dataset.versiculo===`${uso.anclajeBiblico.libro}:${uso.anclajeBiblico.capitulo}:${uso.anclajeBiblico.versiculo}`);
      }
    }
  });
});
test('Cambiar de modo cierra el recurso modal y Solo texto conserva únicamente accesos', async () => {
  await conMotor(async ({root,motor}) => {
    root.querySelector('[data-recurso-acceso]').click();
    await esperar(()=>root.querySelector('dialog .mv-visor'));
    await motor.cambiarModo('visual'); assert(!root.querySelector('dialog'));
    await motor.cambiarModo('texto'); assert(!root.querySelector('[data-educativo],img,dialog'));
    assert(root.querySelector('[data-recurso-acceso]'));
  });
});
test('Una respuesta educativa tardía no vuelve a montar recursos en Solo texto', async () => {
  const d=await datos(), espera=diferida(); let signal;
  await conMotor(async ({ root,motor }) => {
    const pendiente=motor.cambiarModo('visual');
    // Dejar completar la lectura antes de cambiar el modo.
    for (let i=0;i<20 && !signal;i++) await new Promise(r => setTimeout(r,5));
    assert(signal,'La solicitud visual no comenzó');
    await motor.cambiarModo('texto'); assert(signal.aborted);
    espera.resolver(await d.contenidos.cargarVisuales(d.catalogo.relatos[0])); await pendiente;
    assert(!root.querySelector('[data-educativo],img'));
  }, { contenidos:{ cargarVisuales:(_r,opciones) => { signal=opciones.signal; return espera.promesa; } } });
});
test('Las respuestas antiguas del lector no sobrescriben el relato reciente', async () => {
  const d=await datos(), espera=diferida(); let retrasar=false;
  const biblia={ obtenerPasaje:async ref => { const p=await d.biblia.obtenerPasaje(ref); if(retrasar && ref.rangos[0].capitulo===1 && ref.rangos[0].desde===3) await espera.promesa; return p; } };
  await conMotor(async ({ root,motor }) => {
    retrasar=true; const anterior=motor.seleccionar('demo-dos'); await motor.seleccionar('demo-tres'); espera.resolver(); await anterior;
    assert(root.dataset.relato==='demo-tres'); assert(root.querySelector('[data-versiculo]').dataset.versiculo==='contenido-sintetico:2:1');
  }, { biblia });
});
test('Si falla un estudio, el texto continúa disponible', async () => {
  await conMotor(async ({ root,motor }) => {
    await motor.cambiarModo('visual'); assert(root.querySelectorAll('[data-versiculo]').length===2);
    assert(root.textContent.includes('Recursos educativos no disponibles'));
  }, { contenidos:{ cargarVisuales:async () => { throw new Error('Fallo simulado'); } } });
});
test('Contenido con etiquetas HTML se muestra como texto inerte', async () => {
  await conMotor(async ({ root }) => {
    assert(!root.querySelector('script')); assert(root.querySelector('[data-versiculo]').textContent.includes('<script>'));
  }, { biblia:{ obtenerPasaje:async () => ({ version:'DEMO',libro:'demo',texto:[{ libro:'contenido-sintetico',capitulo:1,numero:1,texto:'<script>throw new Error("no ejecutar")</script>' }] }) } });
});
test('Un fallo de lectura muestra el estado de error sin montar recursos', async () => {
  await conMotor(async ({ root,motor }) => {
    await motor.cambiarModo('visual');
    assert(root.textContent.includes('No fue posible cargar el texto'));
    assert(!root.querySelector('[data-educativo],img'));
  }, { biblia:{ obtenerPasaje:async () => { throw new Error('Fuente no disponible'); } } });
});
