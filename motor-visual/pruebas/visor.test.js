import { test,assert,conMotor,frame } from './harness.js';
test('Los visores son 3:4 y las imágenes de portada 16:9', async () => {
  await conMotor(async ({ root,motor }) => {
    await motor.cambiarModo('visual'); await frame();
    const v=root.querySelector('.mv-viewport').getBoundingClientRect(),p=root.querySelector('.mv-portada img').getBoundingClientRect();
    assert(Math.abs(v.width/v.height-.75)<.01); assert(Math.abs(p.width/p.height-16/9)<.01);
  });
});
test('El zoom respeta límites y los marcadores se mantienen sobre la imagen', async () => {
  await conMotor(async ({ root,motor }) => {
    await motor.cambiarModo('visual'); await frame();
    const rango=root.querySelector('input[type="range"]'); rango.value='400'; rango.dispatchEvent(new Event('input')); await frame();
    const plano=root.querySelector('.mv-plano').getBoundingClientRect(),m=root.querySelector('[data-marcador="punto-a"]').getBoundingClientRect();
    assert(Math.abs((m.x+m.width/2-plano.x)/plano.width-.25)<.01);
    assert(Math.abs((m.y+m.height/2-plano.y)/plano.height-.5)<.01);
    root.querySelector('button[aria-label="Aumentar zoom"]').click(); assert(rango.value==='400');
    [...root.querySelectorAll('button')].find(b => b.textContent==='Restablecer').click(); assert(rango.value==='100');
  });
});
test('Los marcadores actualizan su panel informativo', async () => {
  await conMotor(async ({ root,motor }) => {
    await motor.cambiarModo('visual'); root.querySelector('[data-marcador="punto-b"]').click();
    assert(root.querySelector('.mv-panel h4').textContent==='Punto B');
  });
});
test('El visor modal devuelve el foco al disparador', async () => {
  await conMotor(async ({ root,motor }) => {
    await motor.cambiarModo('visual'); const abrir=root.querySelector('.mv-recurso > button'); abrir.focus(); abrir.click();
    const dialogo=root.querySelector('dialog'); assert(dialogo.open); dialogo.close();
    await new Promise(r => setTimeout(r,30)); assert(document.activeElement===abrir);
  });
});
test('La lectura horizontal admite teclado, texto extenso y cambio de sección', async () => {
  await conMotor(async ({ root,motor }) => {
    await motor.cambiarModo('visual'); const hoja=root.querySelector('.mv-hoja');
    hoja.dispatchEvent(new KeyboardEvent('keydown',{ key:'ArrowRight',bubbles:true }));
    assert(root.querySelector('.mv-estudio output').textContent==='2 / 2');
    assert(hoja.textContent.length>1500); assert(hoja.scrollHeight>=hoja.clientHeight);
    const siguiente=root.querySelector('.mv-estudio nav button:last-child'); assert(siguiente.disabled);
    [...root.querySelectorAll('.mv-pestanas button')].find(b => b.textContent==='Devocional de prueba').click();
    assert(root.querySelector('.mv-estudio output').textContent==='1 / 2');
  });
});
test('El cierre tardío del modal no roba el foco a la lectura', async () => {
  await conMotor(async ({ root,motor }) => {
    await motor.cambiarModo('visual'); root.querySelector('.mv-recurso > button').click();
    root.querySelector('dialog').close(); const hoja=root.querySelector('.mv-hoja'); hoja.focus();
    await new Promise(r => setTimeout(r,40)); assert(document.activeElement===hoja);
  });
});
test('Un error de imagen tiene alternativa y conserva la lectura', async () => {
  await conMotor(async ({ root,motor }) => {
    await motor.cambiarModo('visual');
    root.querySelector('.mv-portada img').dispatchEvent(new Event('error'));
    root.querySelector('.mv-plano img').dispatchEvent(new Event('error'));
    assert(root.textContent.includes('Portada no disponible'));
    assert(root.textContent.includes('Imagen no disponible'));
    assert(root.querySelectorAll('[data-versiculo]').length===2);
  });
});
