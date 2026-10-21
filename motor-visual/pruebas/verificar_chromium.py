"""Verificación local reproducible. Requiere Python, playwright y jsonschema.
No instala paquetes ni consulta Internet. Sirve solo en 127.0.0.1 y apaga el servidor.
Ejecutar: python motor-visual/pruebas/verificar_chromium.py
"""
import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from jsonschema import Draft202012Validator
from playwright.sync_api import sync_playwright, expect

MOTOR = Path(__file__).resolve().parents[1]
REPO = MOTOR.parent
SALIDA = MOTOR / 'pruebas'


def originales():
    nombres = subprocess.check_output(['git', 'ls-files', '-z'], cwd=REPO).decode().split('\0')
    return {n: hashlib.sha256((REPO / n).read_bytes()).hexdigest()
            for n in nombres if n and not n.startswith('motor-visual/')}


def validar_esquemas():
    catalogo = json.loads((MOTOR / 'datos/catalogo.json').read_text())
    recursos = json.loads((MOTOR / 'datos/recursos.json').read_text())
    total = 0
    for tipo, documentos in [
        ('relato', catalogo['relatos']),
        ('estudio', [json.loads(p.read_text()) for p in sorted((MOTOR / 'datos/estudios').glob('*.json'))]),
        ('recurso', recursos['recursos']),
    ]:
        schema = json.loads((MOTOR / f'contratos/{tipo}.schema.json').read_text())
        Draft202012Validator.check_schema(schema)
        validador = Draft202012Validator(schema)
        for documento in documentos:
            validador.validate(documento)
            total += 1
    return total


class Silencioso(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def capturar(pagina, ruta):
    # Fijar el origen antes de capturar la composición completa.
    pagina.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
    pagina.evaluate('window.scrollTo({top:0,behavior:"instant"})')
    pagina.wait_for_function('window.scrollY === 0')
    pagina.screenshot(path=str(ruta),full_page=True,animations="disabled")


# Las regresiones por relato apuntan al activo sin esconder los otros relatos.
def localizar(pagina, selector):
    locales = ('.mv-cierre','.mv-contexto','.mv-devocional','.mv-recurso','.mv-viewport',
               '.mv-portada','.mv-panel','.mv-visor','.mv-hoja','.mv-texto','.mv-plano',
               '.mv-titulo-relato','[data-marcador','[data-elemento','[data-recurso-acceso',
               'input[type=range]','input[type="range"]')
    raiz = 'dialog[open]' if pagina.locator('dialog[open]').count() else '.mv-relato[data-activo=true]'
    partes = []
    for parte in selector.split(','):
        limpia = parte.strip().removeprefix('#motor ').strip()
        partes.append(raiz+' '+limpia if limpia.startswith(locales) or limpia.startswith('[data-versiculo]') else parte)
    return pagina.locator(','.join(partes))


def buscar_rol(pagina, rol, **opciones):
    if opciones.get('name') in ['Exégesis','Enseñanzas']:
        return localizar(pagina,'.mv-cierre').get_by_role(rol,**opciones)
    return pagina.get_by_role(rol,**opciones)


def esperar_selector(pagina, selector, **opciones):
    return localizar(pagina,selector).first.wait_for(state='visible',**opciones)


def probar_demo(browser, origen, configuracion, nombre):
    contexto = browser.new_context(**configuracion)
    pagina = contexto.new_page()
    solicitudes, errores = [], []
    pagina.on('request', lambda r: solicitudes.append(r.url))
    pagina.on('pageerror', lambda e: errores.append(str(e)))
    checks = []

    def comprobar(condicion, descripcion):
        if not condicion:
            raise AssertionError(f'{nombre}: {descripcion}')
        checks.append(descripcion)

    pagina.goto(origen + '/motor-visual/demo.html?relato=demo-dos&modo=texto')
    esperar_selector(pagina,'#motor[data-listo="true"]')
    comprobar(localizar(pagina,'#motor [data-versiculo]').count() == 2, 'Enlace directo a segundo relato')
    comprobar(localizar(pagina,'#motor img, #motor .mv-recurso, #motor dialog').count() == 0,
              'Solo texto con estudio y sin recursos visuales')
    comprobar(not any(u.endswith('/datos/recursos.json') or u.endswith('.svg')
                      for u in solicitudes), 'Solo texto sin solicitudes de biblioteca ni imágenes')
    comprobar(not any('/componentes/' in u and any(x in u for x in
                      ['visor.js', 'explorador.js', 'portada.js', 'descubrimiento.js'])
                      for u in solicitudes), 'Solo texto sin descargar módulos visuales')
    comprobar(not any('/biblia/' in u or '/rvc/' in u for u in solicitudes), 'Sin solicitudes al lector o archivos RVC')
    comprobar(pagina.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Sin desbordamiento horizontal inicial')
    capturas = SALIDA / 'capturas'
    capturas.mkdir(exist_ok=True)
    capturar(pagina,capturas / f'{nombre}-texto.png')

    buscar_rol(pagina,'button', name='Con recursos visuales', exact=True).click()
    esperar_selector(pagina,'.mv-cierre')
    comprobar(localizar(pagina,'#motor .mv-recurso').count() == 2, 'Dos recursos en dos anclajes del segundo relato')
    comprobar(localizar(pagina,'.mv-descubrimiento,.mv-tarjeta').count() == 0, 'Sin sección de descubrimiento redundante')
    medidas = localizar(pagina,'.mv-viewport').first.evaluate('(e) => ({ w:e.clientWidth, h:e.clientHeight })')
    comprobar(abs(medidas['w'] / medidas['h'] - .75) < .01, 'Visor 3:4')
    portada = localizar(pagina,'.mv-portada img').first.evaluate('(e) => ({ w:e.clientWidth, h:e.clientHeight })')
    comprobar(abs(portada['w'] / portada['h'] - 16 / 9) < .01, 'Portada 16:9')
    comprobar(pagina.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Sin desbordamiento horizontal visual')
    capturar(pagina,capturas / f'{nombre}-visual.png')

    slider = localizar(pagina,'input[type=range]').first
    slider.fill('250')
    slider.dispatch_event('input')
    viewport = localizar(pagina,'.mv-viewport').first
    viewport.evaluate('(e) => { e.scrollLeft=100; e.scrollTop=100; }')
    comprobar(viewport.evaluate('(e) => e.scrollLeft > 0 && e.scrollTop > 0'), 'Zoom y desplazamiento en ambos ejes')
    pagina.set_viewport_size({'width': 430 if nombre == 'movil' else 1100, 'height': 932 if nombre == 'movil' else 850})
    pagina.wait_for_timeout(100)
    alineado = localizar(pagina,'.mv-recurso').first.evaluate('''e => {
      const p=e.querySelector('.mv-plano').getBoundingClientRect();
      const m=e.querySelector('[data-marcador="punto-a"]').getBoundingClientRect();
      return Math.abs((m.x+m.width/2-p.x)/p.width-.25)<.01 && Math.abs((m.y+m.height/2-p.y)/p.height-.5)<.01;
    }''')
    comprobar(alineado, 'Marcadores alineados tras zoom, scroll y redimensionamiento')
    # Playwright desplaza el visor para alcanzar el marcador ampliado.
    localizar(pagina,'[data-marcador="punto-b"]').first.click()
    expect(localizar(pagina,'.mv-panel h4').first).to_have_text('Punto B')
    checks.append('Panel informativo del marcador')

    buscar_rol(pagina,'button',name='Solo texto bíblico',exact=True).click()
    abrir = localizar(pagina,'[data-recurso-acceso]').first
    abrir.click()
    esperar_selector(pagina,'dialog .mv-visor')
    dialogo = localizar(pagina,'dialog[open]')
    expect(dialogo).to_be_visible()
    pagina.keyboard.press('Tab')
    foco_dentro = pagina.evaluate('document.querySelector("dialog[open]").contains(document.activeElement)')
    comprobar(foco_dentro, 'Foco dentro del diálogo modal')
    pagina.keyboard.press('Escape')
    expect(localizar(pagina,'dialog[open]')).to_have_count(0)
    expect(abrir).to_be_focused()
    checks.append('Escape cierra el recurso y devuelve el foco')
    buscar_rol(pagina,'button',name='Con recursos visuales',exact=True).click()
    esperar_selector(pagina,'.mv-cierre')

    hoja = localizar(pagina,'.mv-cierre .mv-hoja')
    hoja.focus()
    pagina.keyboard.press('ArrowRight')
    expect(localizar(pagina,'.mv-cierre output')).to_have_text(re.compile(r'^2 / \d+$'))
    comprobar(len(hoja.inner_text()) > 1500, 'Lectura extensa por teclado sin truncamiento')
    if nombre == 'movil':
        buscar_rol(pagina,'button', name='Enseñanzas', exact=True).click()
        hoja.dispatch_event('pointerdown', {'pointerType':'touch', 'isPrimary':True, 'clientX':250, 'clientY':120})
        hoja.dispatch_event('pointerup', {'pointerType':'touch', 'isPrimary':True, 'clientX':100, 'clientY':125})
        expect(localizar(pagina,'.mv-cierre output')).to_have_text(re.compile(r'^2 / \d+$'))
        checks.append('Gesto horizontal simulado cambia de página')

    buscar_rol(pagina,'button', name='Solo texto bíblico', exact=True).click()
    expect(localizar(pagina,'#motor .mv-recurso, #motor img, #motor dialog')).to_have_count(0)
    pagina.go_back()
    esperar_selector(pagina,'.mv-cierre')
    pagina.go_forward()
    expect(localizar(pagina,'#motor .mv-recurso')).to_have_count(0)
    checks.append('Atrás y Adelante restauran el modo y desmontan visuales')
    buscar_rol(pagina,'button', name='Capítulo siguiente:', exact=False).click()
    expect(localizar(pagina,'#motor')).to_have_attribute('data-relato','demo-tres')
    checks.append('Navegación a otro capítulo sintético')
    comprobar(not errores, 'Sin errores JavaScript no controlados')
    comprobar(all(urlparse(u).netloc == urlparse(origen).netloc for u in solicitudes), 'Sin solicitudes externas')
    contexto.close()
    return {'comprobaciones':checks,'solicitudes':solicitudes,'errores':errores}



def probar_accesibilidad(browser, origen, configuracion, nombre):
    contexto = browser.new_context(**configuracion)
    pagina = contexto.new_page()
    errores, checks = [], []
    pagina.on('pageerror', lambda e: errores.append(str(e)))
    url = origen + '/motor-visual/demo.html?relato=demo-dos&modo=visual'

    def comprobar(condicion, descripcion):
        if not condicion:
            raise AssertionError(f'{nombre}, accesibilidad: {descripcion}')
        checks.append(descripcion)

    def sin_recortes():
        return pagina.evaluate("""() => {
          if (document.documentElement.scrollWidth > innerWidth) return false;
          return [...document.querySelectorAll('.mv-texto > p,.mv-hoja p,.mv-panel p')].every(p => {
            if (!p.getBoundingClientRect().height) return true;
            if (p.closest('.mv-hoja')) return p.closest('.mv-hoja').clientHeight<=260;
            const c=getComputedStyle(p);
            return p.scrollWidth <= p.clientWidth+1 && p.scrollHeight <= p.clientHeight+1 &&
              c.overflowX !== 'hidden' && c.overflowY !== 'hidden';
          });
        }""")

    pagina.goto(url)
    esperar_selector(pagina,'#motor[data-listo="true"]')
    comprobar(localizar(pagina,'body').get_attribute('data-apariencia') == 'claro', 'Apariencia editorial clara en navegador sin preferencias')
    comprobar(localizar(pagina,'.mv-texto > p').first.evaluate('(p)=>getComputedStyle(p).fontSize') == '12px', 'Texto de lectura inicial a 12 px')
    aumentar = buscar_rol(pagina,'button', name='Aumentar tamaño de letra', exact=True)
    reducir = buscar_rol(pagina,'button', name='Reducir tamaño de letra', exact=True)
    comprobar(localizar(pagina,'.mv-preferencias').is_visible(), 'Controles A− y A+ visibles')
    localizar(pagina,'[data-marcador="punto-b"]').first.click()
    localizar(pagina,'.mv-cierre .mv-hoja').focus()
    pagina.keyboard.press('ArrowRight')
    expect(localizar(pagina,'.mv-cierre output')).to_have_text(re.compile(r'^2 / \d+$'))
    pagina.evaluate('window.__hojaAntes = document.querySelector(".mv-relato[data-activo=true] .mv-cierre .mv-hoja"); window.__textoAntes=window.__hojaAntes.textContent')
    for _ in range(11):
        aumentar.focus()
        pagina.keyboard.press('Enter')
    expect(localizar(pagina,'.mv-preferencias output')).to_have_text('30 px')
    expect(aumentar).to_be_disabled()
    comprobar(pagina.evaluate('window.__hojaAntes === document.querySelector(".mv-relato[data-activo=true] .mv-cierre .mv-hoja")'), 'Aumentar texto no reconstruye el estudio')
    comprobar(localizar(pagina,'.mv-cierre .mv-hoja').text_content()==pagina.evaluate('window.__textoAntes'), 'Se conserva el contenido de explicación al ampliar')
    for selector in ['.mv-texto > p', '.mv-hoja p', '.mv-panel p']:
        comprobar(localizar(pagina,selector).first.evaluate('(p)=>getComputedStyle(p).fontSize') == '30px', f'Texto a 30 px: {selector}')
    comprobar(sin_recortes(), 'Párrafos extensos a 30 px sin recortes ni scroll horizontal')
    botones = localizar(pagina,'.mv-preferencias button').evaluate_all('(bs)=>bs.every(b=>b.getBoundingClientRect().width>=44 && b.getBoundingClientRect().height>=44)')
    comprobar(botones, 'Controles de apariencia de al menos 44 × 44 px')
    reducir.focus(); pagina.keyboard.press('Tab')
    foco = pagina.evaluate('getComputedStyle(document.activeElement).outlineStyle')
    comprobar(foco != 'none', 'Foco visible al usar teclado')
    comprobar(buscar_rol(pagina,'button',name='Modo oscuro',exact=True).count()==0, 'Sin selector de modo oscuro')
    comprobar(sin_recortes(), 'Paleta clara a 30 px sin desbordamiento')
    capturar(pagina,SALIDA / 'capturas' / f'{nombre}-claro-30.png')
    pagina.reload()
    esperar_selector(pagina,'#motor[data-listo="true"]')
    comprobar(localizar(pagina,'body').get_attribute('data-apariencia') == 'claro', 'Apariencia recuperada al recargar')
    comprobar(localizar(pagina,'.mv-texto > p').first.evaluate('(p)=>getComputedStyle(p).fontSize') == '30px', 'Tamaño recuperado al recargar')
    guardado = pagina.evaluate('JSON.parse(localStorage.getItem("mi-biblia-web:motor-visual:preferencias:v1"))')
    comprobar(guardado == {'apariencia':'claro','tamano':30}, 'Se guardan solo apariencia y tamaño')
    for _ in range(11):
        reducir.click()
    expect(reducir).to_be_disabled()
    expect(localizar(pagina,'.mv-preferencias output')).to_have_text('8 px')
    comprobar(sin_recortes(), 'Tamaño mínimo 8 px sin desbordamiento')
    for _ in range(11):
        aumentar.click()
    buscar_rol(pagina,'button',name='Devocional',exact=True).click()
    comprobar(localizar(pagina,'.mv-cierre .mv-hoja p').first.evaluate('(p)=>getComputedStyle(p).fontSize') == '30px', 'Devocional a 30 px')
    buscar_rol(pagina,'button',name='Estudio',exact=True).click()
    localizar(pagina,'[data-marcador="punto-b"]').first.click()
    comprobar(localizar(pagina,'.mv-panel p').first.evaluate('(p)=>getComputedStyle(p).fontSize') == '30px', 'Explicación del mapa a 30 px')
    localizar(pagina,'input[type=range]').first.fill('250')
    localizar(pagina,'input[type=range]').first.dispatch_event('input')
    comprobar(localizar(pagina,'.mv-visor output').first.inner_text() == '250 %', 'El zoom sigue funcionando con texto a 30 px')
    buscar_rol(pagina,'button',name='Solo texto bíblico',exact=True).click()
    localizar(pagina,'[data-recurso-acceso]').first.click()
    esperar_selector(pagina,'dialog .mv-visor')
    comprobar(localizar(pagina,'dialog[open] .mv-panel p').first.evaluate('(p)=>getComputedStyle(p).fontSize') == '30px', 'El panel modal hereda el tamaño de lectura')
    comprobar(localizar(pagina,'dialog[open]').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1'), 'Modal sin scroll horizontal de párrafos a 30 px')
    pagina.keyboard.press('Escape')
    pagina.wait_for_timeout(50)
    buscar_rol(pagina,'button',name='Con recursos visuales',exact=True).click(); esperar_selector(pagina,'.mv-cierre')
    comprobar(sin_recortes(), 'Visuales, panel y devocional sin recortes a 30 px')
    localizar(pagina,'input[type=range]').first.fill('100')
    localizar(pagina,'input[type=range]').first.dispatch_event('input')
    capturar(pagina,SALIDA / 'capturas' / f'editorial-claro-{nombre}-30.png')
    buscar_rol(pagina,'button',name='Solo texto bíblico',exact=True).click()
    expect(localizar(pagina,'#motor .mv-recurso,#motor img')).to_have_count(0)
    comprobar(localizar(pagina,'.mv-texto > p').first.evaluate('(p)=>getComputedStyle(p).fontSize') == '30px', 'Solo texto conserva 30 px sin montar visuales')
    comprobar(localizar(pagina,'.mv-preferencias').is_visible(), 'Ajustes disponibles en Solo texto')
    buscar_rol(pagina,'button',name='Capítulo siguiente:',exact=False).click()
    expect(localizar(pagina,'#motor')).to_have_attribute('data-relato','demo-tres')
    comprobar(localizar(pagina,'.mv-texto > p').first.evaluate('(p)=>getComputedStyle(p).fontSize') == '30px', 'Navegar conserva tamaño y apariencia')
    if nombre == 'movil':
        pagina.set_viewport_size({'width':320,'height':740})
        comprobar(sin_recortes(), 'Pantalla estrecha de 320 px con lectura a 30 px')
        buscar_rol(pagina,'button',name='Con recursos visuales',exact=True).click()
        esperar_selector(pagina,'.mv-cierre')
        comprobar(sin_recortes(), 'Visuales a 320 px de ancho y letra a 30 px')
    comprobar(not errores, 'Sin errores JavaScript durante los ajustes')
    contexto.close()
    return {'comprobaciones':checks,'errores':errores}



def probar_compactacion(browser, origen, configuracion, nombre):
    contexto = browser.new_context(**configuracion)
    contexto.add_init_script("""if (!localStorage.getItem('mi-biblia-web:motor-visual:preferencias:v1')) {
      localStorage.setItem('mi-biblia-web:motor-visual:preferencias:v1', JSON.stringify({apariencia:'oscuro',tamano:20}));
    }""")
    pagina = contexto.new_page()
    checks, errores, muestras = [], [], []
    pagina.on('pageerror',lambda e: errores.append(str(e)))

    def comprobar(condicion, descripcion):
        if not condicion:
            raise AssertionError(f'{nombre}, compactación: {descripcion}')
        checks.append(descripcion)

    def disposicion_valida():
        return pagina.evaluate("""() => {
          if (document.documentElement.scrollWidth > innerWidth) return false;
          const parrafos=[...document.querySelectorAll('.mv-texto > p,.mv-hoja p,.mv-panel p')];
          if (!parrafos.every(p=>p.closest('.mv-hoja') ? p.closest('.mv-hoja').clientHeight<=260 : p.scrollWidth<=p.clientWidth+1 && p.scrollHeight<=p.clientHeight+1)) return false;
          return [...document.querySelectorAll('.mv-ajustes,.mv-navegacion,.mv-controles,.mv-pestanas')].every(g=>{
            const rects=[...g.children].map(e=>e.getBoundingClientRect()).filter(r=>r.width && r.height);
            return rects.every((a,i)=>rects.slice(i+1).every(b=>
              Math.min(a.right,b.right)-Math.max(a.left,b.left)<=1 || Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<=1));
          });
        }""")

    pagina.goto(origen + '/motor-visual/demo.html?relato=demo-dos&modo=visual')
    esperar_selector(pagina,'#motor[data-listo="true"]')
    expect(localizar(pagina,'.mv-preferencias output')).to_have_text('20 px')
    checks.append('Se recuperan los 20 px guardados antes de esta fase')
    restablecer=buscar_rol(pagina,'button',name='Restablecer tamaño de letra a 12 px',exact=True)
    restablecer.focus(); restablecer.press('Enter')
    expect(localizar(pagina,'.mv-preferencias output')).to_have_text('12 px')
    pagina.reload(); esperar_selector(pagina,'#motor[data-listo="true"]')
    expect(localizar(pagina,'.mv-preferencias output')).to_have_text('12 px')
    checks.append('Restablecer por teclado guarda 12 px y persiste al recargar')
    aumentar=buscar_rol(pagina,'button',name='Aumentar tamaño de letra',exact=True)
    for tamano in [8,20,30]:
        restablecer.click()
        boton=buscar_rol(pagina,'button',name='Aumentar tamaño de letra' if tamano>=12 else 'Reducir tamaño de letra',exact=True)
        for _ in range(abs(tamano-12)//2):
            boton.click()
        for modo in ['visual','texto']:
            buscar_rol(pagina,'button',name='Con recursos visuales' if modo=='visual' else 'Solo texto bíblico',exact=True).click()
            if modo=='visual':
                esperar_selector(pagina,'.mv-cierre')
                localizar(pagina,'[data-marcador="punto-b"]').first.click()
                buscar_rol(pagina,'button',name='Estudio',exact=True).click()
                localizar(pagina,'.mv-cierre .mv-hoja').focus(); pagina.keyboard.press('ArrowRight')
                comprobar(localizar(pagina,'.mv-cierre .mv-hoja p').first.evaluate('(p)=>getComputedStyle(p).fontSize')==f'{tamano}px', f'Estudio extenso a {tamano} px')
                comprobar(disposicion_valida(), f'Estudio a {tamano} px sin recortes, superposición ni scroll horizontal')
                buscar_rol(pagina,'button',name='Devocional',exact=True).click()
                comprobar(localizar(pagina,'.mv-cierre .mv-hoja p').first.evaluate('(p)=>getComputedStyle(p).fontSize')==f'{tamano}px', f'Devocional a {tamano} px')
                comprobar(localizar(pagina,'.mv-recurso').count()==0, f'Devocional sin recursos intercalados a {tamano} px')
                buscar_rol(pagina,'button',name='Estudio',exact=True).click()
                comprobar(localizar(pagina,'.mv-panel p').first.evaluate('(p)=>getComputedStyle(p).fontSize')==f'{tamano}px', f'Panel de mapa a {tamano} px')
                v=localizar(pagina,'.mv-viewport').first.bounding_box()
                minimo=450 if nombre=='escritorio' else configuracion['viewport']['width']-50
                comprobar(v['width']>=minimo and abs(v['width']/v['height']-.75)<.01, f'Visor amplio y 3:4 con lectura a {tamano} px')
                muestras.append({'tamano':tamano,'visor_ancho':round(v['width'],2),'visor_alto':round(v['height'],2)})
                # La tipografía no debe agrandar ni achicar el área del visor.
                comprobar(abs(muestras[-1]['visor_ancho']-muestras[0]['visor_ancho'])<1, f'Visor independiente de letra a {tamano} px')
                capturar(pagina,SALIDA/'capturas'/f'compacto-{nombre}-{tamano}.png')
            else:
                expect(localizar(pagina,'#motor .mv-recurso,#motor img')).to_have_count(0)
                checks.append(f'Solo texto a {tamano} px sin montar recursos')
            comprobar(localizar(pagina,'.mv-texto > p').first.evaluate('(p)=>getComputedStyle(p).fontSize')==f'{tamano}px', f'Lectura {modo} a {tamano} px')
            comprobar(disposicion_valida(), f'Disposición {modo} válida a {tamano} px')
            tactiles=localizar(pagina,'button,input[type=range]').evaluate_all("""es=>es.every(e=>{
              const r=e.getBoundingClientRect(); return !r.width || !r.height || (r.width>=44 && r.height>=44);
            })""")
            comprobar(tactiles, f'Controles independientes de {tamano} px: áreas de al menos 44 × 44 px en {modo}')
        comprobar(disposicion_valida(), f'Apariencia clara sin desbordamiento a {tamano} px')
    if nombre=='movil':
        pagina.set_viewport_size({'width':320,'height':740})
        for tamano in [8,20,30]:
            restablecer.click()
            boton=buscar_rol(pagina,'button',name='Aumentar tamaño de letra' if tamano>=12 else 'Reducir tamaño de letra',exact=True)
            for _ in range(abs(tamano-12)//2): boton.click()
            buscar_rol(pagina,'button',name='Con recursos visuales',exact=True).click()
            esperar_selector(pagina,'.mv-cierre')
            comprobar(disposicion_valida(), f'Pantalla 320 px: sin superposiciones a {tamano} px')
            comprobar(localizar(pagina,'.mv-viewport').first.bounding_box()['width']>=270, f'Pantalla 320 px: visor útil a {tamano} px')
    comprobar(not errores, 'Sin errores JavaScript en la matriz 8, 20 y 30 px')
    contexto.close()
    return {'comprobaciones':checks,'muestras':muestras,'errores':errores}



def probar_composicion(browser, origen, configuracion, nombre):
    contexto=browser.new_context(**configuracion)
    pagina=contexto.new_page()
    checks, solicitudes, errores = [], [], []
    pagina.on('request',lambda r:solicitudes.append(r.url))
    pagina.on('pageerror',lambda e:errores.append(str(e)))
    url=origen+'/motor-visual/demo.html?relato=demo-dos&modo=texto&enfoque=devocional'

    def comprobar(condicion,descripcion):
        if not condicion: raise AssertionError(f'{nombre}, composición: {descripcion}')
        checks.append(descripcion)

    pagina.goto(url); esperar_selector(pagina,'#motor[data-listo="true"]')
    comprobar(localizar(pagina,'#motor').get_attribute('data-enfoque')=='devocional','Enlace directo con enfoque Devocional')
    comprobar(not any(u.endswith('/datos/recursos.json') or u.endswith('.svg') for u in solicitudes),'Solo texto + Devocional sin cargar biblioteca ni imágenes')
    comprobar(not any('/componentes/' in u and any(x in u for x in ['visor.js','explorador.js','portada.js','descubrimiento.js']) for u in solicitudes),'Solo texto + Devocional sin descargar componentes visuales')
    comprobar(localizar(pagina,'#motor .mv-recurso,#motor img').count()==0,'Solo texto + Devocional sin recursos intercalados')
    buscar_rol(pagina,'button',name='Estudio',exact=True).click()
    comprobar(any('/datos/estudios/' in u for u in solicitudes),'Solo texto carga las secciones textuales correspondientes')
    comprobar(localizar(pagina,'.mv-barra-lector [data-enfoque]').count()==2 and localizar(pagina,'.mv-barra-lector [data-modo]').count()==2,'Dos grupos independientes en la cabecera')
    comprobar(localizar(pagina,'.mv-barra-lector .mv-preferencias').is_visible(),'Controles tipográficos dentro de la cabecera')
    cabecera=localizar(pagina,'.mv-barra-lector').bounding_box()
    comprobar(cabecera['height']<=110 if nombre=='movil' else cabecera['height']<=60,'Cabecera compacta: hasta 110 px móvil y 60 px escritorio')
    comprobar(localizar(pagina,'.mv-indice button').count()==2,'Índice del capítulo con dos relatos sintéticos')
    expect(localizar(pagina,'.mv-indice [aria-current="true"]')).to_have_attribute('data-relato-indice','demo-dos')
    checks.append('Relato activo indicado en el índice')
    pagina.wait_for_function("""() => {
      const i=document.querySelector('.mv-indice'),a=i.querySelector('[aria-current="true"]').getBoundingClientRect(),n=i.getBoundingClientRect();
      return a.left>=n.left-1 && a.right<=n.right+1;
    }""")
    checks.append('El índice muestra completo el relato activo sin desplazar el documento')
    buscar_rol(pagina,'button',name='Con recursos visuales',exact=True).click(); esperar_selector(pagina,'.mv-cierre')
    orden=pagina.evaluate("""() => {
      const partes=['.mv-barra-lector','.mv-capitulo','.mv-titulo-relato','.mv-relato > .mv-referencia','.mv-relato .mv-portada','.mv-contexto','.mv-texto','.mv-cierre'].map(s=>document.querySelector(s));
      return partes.every(Boolean) && partes.slice(1).every((p,i)=>partes[i].compareDocumentPosition(p)&Node.DOCUMENT_POSITION_FOLLOWING);
    }""")
    comprobar(orden,'Orden editorial completo: portada, contexto, versículos y cierre')
    comprobar(localizar(pagina,'.mv-cierre .mv-pestanas button').all_text_contents()==['Exégesis','Enseñanzas'],'Cierre de Estudio con Exégesis y Enseñanzas')
    localizar(pagina,'.mv-contexto .mv-hoja').focus(); pagina.keyboard.press('ArrowRight')
    expect(localizar(pagina,'.mv-contexto output')).to_have_text(re.compile(r'^2 / \d+$'))
    expect(localizar(pagina,'.mv-cierre output')).to_have_text(re.compile(r'^1 / \d+$'))
    checks.append('Contexto paginado sin cambiar el cierre')
    localizar(pagina,'.mv-cierre .mv-hoja').focus(); pagina.keyboard.press('ArrowRight')
    expect(localizar(pagina,'.mv-cierre output')).to_have_text(re.compile(r'^2 / \d+$'))
    expect(localizar(pagina,'.mv-contexto output')).to_have_text(re.compile(r'^2 / \d+$'))
    checks.append('Cierre paginado sin cambiar el contexto')
    localizar(pagina,'[data-marcador="punto-b"]').first.click()
    localizar(pagina,'input[type=range]').first.fill('250'); localizar(pagina,'input[type=range]').first.dispatch_event('input')
    pagina.evaluate('window.__visorEditorial=document.querySelector(".mv-relato[data-activo=true] .mv-visor")')
    antes=len([u for u in solicitudes if '/datos/' in u])
    buscar_rol(pagina,'button',name='Devocional',exact=True).click()
    expect(localizar(pagina,'.mv-contexto')).to_have_count(0)
    expect(localizar(pagina,'.mv-devocional')).to_have_count(1)
    comprobar(pagina.evaluate('!window.__visorEditorial.isConnected'),'Devocional retira el visor de la lectura sin destruir su instancia')
    comprobar(pagina.evaluate('window.__visorEditorial.querySelector("input").value')=='250','Cambiar enfoque conserva el zoom')
    comprobar(pagina.evaluate('window.__visorEditorial.closest(".mv-recurso").querySelector(".mv-panel h4").textContent')=='Punto B','Cambiar enfoque conserva el marcador seleccionado')
    comprobar(antes==len([u for u in solicitudes if '/datos/' in u]),'Cambiar enfoque no vuelve a solicitar los datos visuales')
    pagina.go_back(); esperar_selector(pagina,'.mv-contexto')
    expect(localizar(pagina,'.mv-contexto output')).to_have_text(re.compile(r'^2 / \d+$'))
    expect(localizar(pagina,'.mv-cierre output')).to_have_text(re.compile(r'^2 / \d+$'))
    comprobar(pagina.evaluate('window.__visorEditorial===document.querySelector(".mv-relato[data-activo=true] .mv-visor")'),'Atrás restaura Estudio sin reconstruir el visor')
    pagina.go_forward(); esperar_selector(pagina,'.mv-devocional')
    checks.append('Adelante restaura el enfoque Devocional')
    buscar_rol(pagina,'button',name='Solo texto bíblico',exact=True).click()
    expect(localizar(pagina,'#motor .mv-recurso,#motor img, #motor dialog')).to_have_count(0)
    comprobar(localizar(pagina,'#motor').get_attribute('data-enfoque')=='devocional','Solo texto conserva la elección de enfoque')
    buscar_rol(pagina,'button',name='Capítulo siguiente:',exact=False).click()
    expect(localizar(pagina,'#motor')).to_have_attribute('data-relato','demo-tres')
    comprobar(localizar(pagina,'.mv-indice button').count()==1,'Índice actualizado al navegar al otro capítulo')
    comprobar(localizar(pagina,'#motor').get_attribute('data-enfoque')=='devocional','Navegación conserva el enfoque')
    buscar_rol(pagina,'button',name='Con recursos visuales',exact=True).click(); esperar_selector(pagina,'.mv-devocional')
    buscar_rol(pagina,'button',name='Capítulo anterior:',exact=False).click()
    expect(localizar(pagina,'#motor')).to_have_attribute('data-relato','demo-uno')
    localizar(pagina,'[data-relato-indice="demo-dos"]').click()
    expect(localizar(pagina,'#motor')).to_have_attribute('data-relato','demo-dos')
    esperar_selector(pagina,'.mv-devocional')
    buscar_rol(pagina,'button',name='Estudio',exact=True).click(); esperar_selector(pagina,'.mv-contexto')
    expect(localizar(pagina,'.mv-contexto output')).to_have_text(re.compile(r'^2 / \d+$'))
    checks.append('Volver al relato recupera su página de contexto')
    # Capturas del orden editorial desde las primeras páginas.
    localizar(pagina,'.mv-contexto nav button').first.click()
    if not localizar(pagina,'.mv-cierre nav button').first.is_disabled():
        localizar(pagina,'.mv-cierre nav button').first.click()
    capturar(pagina,SALIDA/'capturas'/f'editorial-{nombre}-estudio.png')
    buscar_rol(pagina,'button',name='Devocional',exact=True).click()
    capturar(pagina,SALIDA/'capturas'/f'editorial-{nombre}-devocional.png')
    if nombre=='movil':
        pagina.set_viewport_size({'width':320,'height':740})
        comprobar(localizar(pagina,'.mv-barra-lector').bounding_box()['height']<=110,'Cabecera compacta también a 320 px')
        comprobar(pagina.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Sin desbordamiento horizontal del documento a 320 px')
    comprobar(not errores,'Sin errores JavaScript en las cuatro combinaciones')
    contexto.close()
    return {'comprobaciones':checks,'alto_cabecera':cabecera['height'],'errores':errores}


def probar_explorador(browser, origen, configuracion, nombre):
    contexto = browser.new_context(**configuracion)
    pagina = contexto.new_page()
    errores, checks = [], []
    pagina.on('pageerror', lambda e: errores.append(str(e)))
    def comprobar(valor, descripcion):
        assert valor, f'{nombre}: {descripcion}'
        checks.append(descripcion)
    pagina.goto(origen+'/motor-visual/demo.html?relato=demo-dos&modo=visual')
    r = localizar(pagina,'.mv-recurso').first
    r.wait_for()
    punto = r.locator('[data-marcador="punto-b"]')
    boton = r.locator('[data-elemento="punto-b"]')
    boton.click()
    expect(punto).to_have_attribute('aria-pressed','true')
    expect(boton).to_have_attribute('aria-pressed','true')
    checks.append('Selección desde botón sincroniza marcador')
    r.locator('.mv-panel nav button').last.click()
    expect(r.locator('.mv-panel output')).to_have_text(re.compile(r'^2 / \d+$'))
    expect(punto).to_have_attribute('aria-pressed','true')
    checks.append('Paginar conserva marcador seleccionado')
    r.locator('[data-control="puntos"]').click()
    comprobar(r.locator('[data-marcador]:visible').count()==0 and r.locator('[data-elemento]:visible').count()==0,'Ocultar elimina puntos y nombres de la vista')
    comprobar(r.locator('img').is_visible() and 'DEMO' in r.locator('.mv-panel p').inner_text(),'Imagen limpia con descripción general')
    buscar_rol(pagina,'button',name='Devocional',exact=True).click()
    expect(localizar(pagina,'.mv-recurso')).to_have_count(0)
    buscar_rol(pagina,'button',name='Estudio',exact=True).click()
    expect(r.locator('[data-control="puntos"]')).to_have_text('Mostrar puntos')
    r.locator('[data-control="puntos"]').click()
    expect(r.locator('.mv-panel output')).to_have_text(re.compile(r'^2 / \d+$'))
    checks.append('Enfoque y ocultación conservan página y selección')
    r.locator('[data-marcador="punto-a"]').click()
    expect(r.locator('[data-elemento="punto-a"]')).to_have_attribute('aria-pressed','true')
    expect(r.locator('.mv-panel output')).to_have_text(re.compile(r'^1 / \d+$'))
    checks.append('Selección desde punto sincroniza botón y página independiente')
    buscar_rol(pagina,'button',name='Estudio',exact=True).click()
    for tamano in [8,20,30]:
        pagina.evaluate('(n)=>document.body.style.setProperty("--mv-tamano-lectura",n+"px")',tamano)
        comprobar(pagina.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Sin desbordamiento de documento a {tamano} px')
        comprobar(r.locator('.mv-panel .mv-hoja').evaluate('(e)=>e.clientHeight<=260'),f'Explicación sin recorte horizontal a {tamano} px')
        comprobar(r.locator('.mv-elementos button').evaluate_all('(bs)=>bs.every(b=>b.getBoundingClientRect().height>=44&&b.getBoundingClientRect().width>=44)'),f'Botones táctiles a {tamano} px')
    pagina.evaluate('document.body.style.removeProperty("--mv-tamano-lectura")')
    if nombre == 'movil':
        hoja = r.locator('.mv-panel .mv-hoja')
        hoja.scroll_into_view_if_needed()
        # Eventos reales del dispositivo emulado: pan-y libera el scroll vertical.
        cdp = contexto.new_cdp_session(pagina)
        def gesto(dx,dy):
            caja = hoja.bounding_box()
            x = min(caja['x']+caja['width']*.75,350)
            y = min(max(caja['y']+30,150),650)
            cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
            for paso in range(1,7):
                cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx*paso/6,'y':y+dy*paso/6}]})
                pagina.wait_for_timeout(25)
            cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
            pagina.wait_for_timeout(250)
        gesto(-140,2)
        expect(r.locator('.mv-panel output')).to_have_text(re.compile(r'^2 / \d+$'))
        expect(r.locator('[data-elemento="punto-a"]')).to_have_attribute('aria-pressed','true')
        checks.append('Gesto horizontal real pagina sin cambiar selección')
        hoja.scroll_into_view_if_needed()
        previo = pagina.evaluate('scrollY')
        gesto(2,-120)
        expect(r.locator('.mv-panel output')).to_have_text(re.compile(r'^2 / \d+$'))
        comprobar(pagina.evaluate('scrollY')>previo+20,'Gesto vertical real desplaza la página sin paginar')
        cdp.detach()
    rango = r.locator('input[type="range"]')
    rango.fill('300'); rango.dispatch_event('input')
    v = r.locator('.mv-viewport')
    v.scroll_into_view_if_needed()
    if nombre == 'escritorio':
        v.evaluate('(e)=>e.scrollTo(0,0)')
        caja=v.bounding_box()
        pagina.mouse.move(caja['x']+caja['width']*.8,caja['y']+caja['height']*.6)
        pagina.mouse.down()
        pagina.mouse.move(caja['x']+caja['width']*.4,caja['y']+caja['height']*.4,steps=8)
        pagina.mouse.up()
        comprobar(v.evaluate('(e)=>e.scrollLeft>20&&e.scrollTop>20'),'Arrastre con ratón desplaza imagen ampliada')
    else:
        v.evaluate('(e)=>e.scrollTo(0,0)')
        caja=v.bounding_box()
        x=caja['x']+caja['width']*.75; y=max(140,caja['y']+caja['height']*.5)
        cdp=contexto.new_cdp_session(pagina)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
        for paso in range(1,7):
            cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-100*paso/6,'y':y-40*paso/6}]})
            pagina.wait_for_timeout(25)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        pagina.wait_for_timeout(250)
        comprobar(v.evaluate('(e)=>e.scrollLeft>20'),'Arrastre táctil real desplaza imagen ampliada')
        cdp.detach()
    comprobar(r.evaluate('''e=>{const p=e.querySelector('.mv-plano').getBoundingClientRect(),b=e.querySelector('[data-marcador="punto-b"]').getBoundingClientRect();return Math.abs((b.x+b.width/2-p.x)/p.width-.75)<.01&&Math.abs((b.y+b.height/2-p.y)/p.height-.5)<.01;}'''),'Marcadores alineados después de zoom y desplazamiento')
    buscar_rol(pagina,'button',name='Devocional',exact=True).click()
    expect(localizar(pagina,'.mv-recurso')).to_have_count(0)
    buscar_rol(pagina,'button',name='Estudio',exact=True).click()
    expect(rango).to_have_value('300')
    checks.append('Cambiar enfoque conserva zoom')
    r.get_by_role('button',name='Restablecer',exact=True).click()
    comprobar(v.evaluate('(e)=>e.scrollLeft===0&&e.scrollTop===0'),'Restaurar devuelve el origen')
    expect(rango).to_have_value('100')
    comprobar(r.evaluate('''e=>{const v=e.querySelector('.mv-viewport').getBoundingClientRect(),p=e.querySelector('.mv-plano').getBoundingClientRect();return Math.abs(p.width/p.height-2/3)<.01&&p.width<=v.width+1&&p.height<=v.height+1;}'''),'Imagen completa 2:3 dentro de visor 3:4')
    r.locator('[data-elemento="punto-b"]').click()
    expect(r.locator('.mv-panel output')).to_have_text(re.compile(r'^2 / \d+$'))
    comprobar(r.get_by_role('button',name='Ampliar visor',exact=True).count()==0,'Visor integrado sin Ampliar visor')
    r.screenshot(path=str(SALIDA/'capturas'/f'explorador-{nombre}.png'),animations='disabled',
                 style='.mv-barra-lector { position:static !important; }')
    comprobar(not errores,'Sin errores JavaScript del explorador')
    contexto.close()
    return {'comprobaciones':checks,'errores':errores}


def probar_interfaz(browser, origen, configuracion, nombre):
    contexto=browser.new_context(**configuracion)
    pagina=contexto.new_page()
    checks,errores=[],[]
    pagina.on('pageerror',lambda e:errores.append(str(e)))
    def comprobar(valor,descripcion):
        assert valor,f'{nombre}, interfaz: {descripcion}'
        checks.append(descripcion)
    url=origen+'/motor-visual/demo.html?relato=demo-uno'
    for modo in ['visual','texto']:
        for enfoque in ['estudio','devocional']:
            pagina.goto(url+f'&modo={modo}&enfoque={enfoque}')
            esperar_selector(pagina,'#motor[data-listo="true"]')
            if modo=='visual': esperar_selector(pagina,'.mv-cierre')
            else: expect(localizar(pagina,'.mv-recurso,#motor img')).to_have_count(0)
            etiqueta=modo+' '+enfoque
            barra=localizar(pagina,'.mv-barra-lector')
            comprobar(barra.evaluate('e=>getComputedStyle(e).position')=='static',etiqueta+': barra en el flujo normal')
            comprobar(localizar(pagina,'[aria-label^="Relato anterior"],[aria-label^="Relato siguiente"],.mv-descubrimiento').count()==0,
                      etiqueta+': sin navegación redundante ni descubrimiento')
            if modo=='visual':
                pagina.evaluate('scrollTo(0,document.documentElement.scrollHeight)')
                comprobar(barra.bounding_box()['y']+barra.bounding_box()['height']<0,etiqueta+': controles desaparecen al bajar')
            # Click real: Playwright lleva el índice al área visible antes de activarlo.
            localizar(pagina,'[data-relato-indice="demo-dos"]').click()
            expect(localizar(pagina,'#motor')).to_have_attribute('data-relato','demo-dos')
            pagina.wait_for_function('document.activeElement?.classList.contains("mv-titulo-relato")')
            if modo=='visual': esperar_selector(pagina,'.mv-cierre')
            pagina.wait_for_function('''() => {
              const t=document.querySelector('.mv-relato[data-activo=true] .mv-titulo-relato'),r=t.getBoundingClientRect();
              const max=Math.max(0,document.documentElement.scrollHeight-innerHeight);
              const destino=Math.min(max,Math.max(0,scrollY+r.top-8));
              return Math.abs(scrollY-destino)<2;
            }''')
            comprobar(localizar(pagina,'.mv-titulo-relato').bounding_box()['y']>=0,etiqueta+': encabezado visible y alineado al inicio real')
            comprobar(localizar(pagina,'.mv-texto [data-versiculo]').count()==2,etiqueta+': versículos correspondientes presentes')
            comprobar(localizar(pagina,'#motor').get_attribute('data-modo')==modo and localizar(pagina,'#motor').get_attribute('data-enfoque')==enfoque,
                      etiqueta+': índice conserva modo y enfoque')
            comprobar(localizar(pagina,'.mv-capitulo h1').inner_text()=='Capítulo 1' and localizar(pagina,'.mv-indice button').count()==2,
                      etiqueta+': índice permanece dentro del capítulo')
            localizar(pagina,'[data-relato-indice="demo-uno"]').focus()
            pagina.keyboard.press('Enter')
            expect(localizar(pagina,'#motor')).to_have_attribute('data-relato','demo-uno')
            expect(localizar(pagina,'.mv-titulo-relato')).to_be_focused()
            comprobar(True,etiqueta+': índice accesible mediante teclado')
            buscar_rol(pagina,'button',name='Capítulo siguiente:',exact=False).click()
            expect(localizar(pagina,'#motor')).to_have_attribute('data-relato','demo-tres')
            expect(localizar(pagina,'.mv-capitulo h1')).to_have_text('Capítulo 2')
            comprobar(localizar(pagina,'.mv-indice button').count()==1,etiqueta+': capítulo siguiente mantiene su índice')
            buscar_rol(pagina,'button',name='Capítulo anterior:',exact=False).click()
            expect(localizar(pagina,'#motor')).to_have_attribute('data-relato','demo-uno')
            comprobar(localizar(pagina,'#motor').get_attribute('data-modo')==modo and localizar(pagina,'#motor').get_attribute('data-enfoque')==enfoque,
                      etiqueta+': volver al capítulo conserva las selecciones')
    pagina.goto(url+'&modo=visual');esperar_selector(pagina,'#motor[data-listo="true"]');esperar_selector(pagina,'.mv-cierre')
    comprobar(localizar(pagina,'body').get_attribute('data-apariencia')=='claro','Apariencia clara estable')
    comprobar(buscar_rol(pagina,'button',name='Modo oscuro',exact=True).count()==0,'Control de modo oscuro eliminado')
    comprobar(localizar(pagina,'.mv-texto > p').first.evaluate('e=>getComputedStyle(e).fontSize')=='12px','Inicial de lectura a 12 px')
    colores=localizar(pagina,'body').evaluate('''e=>{
      const c=getComputedStyle(e);return Object.fromEntries(['--mv-fondo','--mv-salvia','--mv-verde-oscuro','--mv-acento'].map(k=>[k,c.getPropertyValue(k).trim()]));
    }''')
    comprobar(colores['--mv-fondo']=='#faf9f3' and colores['--mv-salvia']=='#a8bca5' and colores['--mv-acento']=='#31583e',
              'Paleta marfil y salvia centralizada en variables CSS')
    # Comprobar fondo de tarjetas, títulos y selección con los mismos tokens.
    comprobar(localizar(pagina,'.mv-estudio').first.evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(255, 255, 255)' and
              localizar(pagina,'.mv-titulo-relato').evaluate('e=>getComputedStyle(e).color')=='rgb(49, 88, 62)',
              'Tarjetas claras y títulos verdes consistentes')
    capturar(pagina,SALIDA/'capturas'/f'etapa4-{nombre}-12.png')
    localizar(pagina,'[data-relato-indice="demo-dos"]').click();esperar_selector(pagina,'.mv-cierre')
    comprobar(pagina.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Sin desbordamiento en la navegación')
    capturar(pagina,SALIDA/'capturas'/f'etapa4-{nombre}-indice.png')
    comprobar(not errores,'Sin errores JavaScript en las cuatro combinaciones')
    contexto.close()
    return {'comprobaciones':checks,'paleta':colores,'errores':errores}


def probar_bloque2(browser, origen, configuracion, nombre):
    contexto=browser.new_context(**configuracion)
    pagina=contexto.new_page()
    checks,errores,solicitudes=[],[],[]
    pagina.on('pageerror',lambda e:errores.append(str(e)))
    pagina.on('request',lambda r:solicitudes.append(r.url))
    def comprobar(valor,descripcion):
        assert valor,f'{nombre}, bloque 2: {descripcion}'
        checks.append(descripcion)
    url=origen+'/motor-visual/demo.html?relato=demo-dos'
    pagina.goto(url+'&modo=visual');esperar_selector(pagina,'.mv-cierre');pagina.wait_for_timeout(100)
    comprobar(localizar(pagina,'.mv-navegacion').evaluate('e=>e===e.parentElement.lastElementChild'),'Capítulos al final de la lectura')
    comprobar(buscar_rol(pagina,'button',name='Ampliar visor',exact=True).count()==0,'Ampliar visor eliminado')
    comprobar(localizar(pagina,'.mv-viewport').first.evaluate('e=>Math.abs(e.clientWidth/e.clientHeight-.75)<.01'),'Marco 3:4 conservado')
    for tamano in [12,30]:
        buscar_rol(pagina,'button',name='Restablecer tamaño de letra a 12 px',exact=True).click()
        for _ in range((tamano-12)//2):buscar_rol(pagina,'button',name='Aumentar tamaño de letra',exact=True).click()
        localizar(pagina,'[data-elemento="punto-b"]').first.click();pagina.wait_for_timeout(100)
        for selector in ['.mv-contexto','.mv-cierre','.mv-panel .mv-estudio']:
            bloque=localizar(pagina,selector).first
            hoja=bloque.locator('.mv-hoja')
            previo=bloque.locator('nav button').first
            while not previo.is_disabled():previo.click()
            pagina.wait_for_timeout(50)
            total=int(bloque.locator('output').inner_text().split('/')[1])
            altura=hoja.bounding_box()['height']
            for i in range(total):
                comprobar(abs(hoja.bounding_box()['height']-altura)<1 and altura<=260,
                          f'{selector}: altura estable {tamano} px, página {i+1}/{total}')
                if i<total-1:bloque.locator('nav button').last.click()
            comprobar(bloque.locator('nav button').last.is_disabled(),f'{selector}: límite de paginación correcto a {tamano} px')
            comprobar(hoja.evaluate('''e=>{
              const h=e.getBoundingClientRect(),w=document.createTreeWalker(e.firstChild,NodeFilter.SHOW_TEXT);let n,ultimo;
              while((n=w.nextNode())) if(n.textContent.trim()) ultimo=n;
              const fin=ultimo.textContent.trimEnd().length,r=document.createRange();r.setStart(ultimo,fin-1);r.setEnd(ultimo,fin);
              const p=r.getBoundingClientRect();return p.left>=h.left-1&&p.right<=h.right+1&&p.top>=h.top-1&&p.bottom<=h.bottom+1;
            }'''),f'{selector}: final del texto accesible a {tamano} px')
        comprobar(localizar(pagina,'[data-elemento="punto-b"]').first.get_attribute('aria-pressed')=='true','Paginar mantiene el marcador seleccionado')
        comprobar(pagina.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Sin desbordamiento del documento a {tamano} px')
    buscar_rol(pagina,'button',name='Restablecer tamaño de letra a 12 px',exact=True).click()
    v=localizar(pagina,'.mv-viewport').first
    if nombre=='movil':
        cdp=contexto.new_cdp_session(pagina)
        def tocar(puntos,finales):
            cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':puntos})
            for n in range(1,9):
                pasos=[{'id':a['id'],'x':a['x']+(b['x']-a['x'])*n/8,'y':a['y']+(b['y']-a['y'])*n/8} for a,b in zip(puntos,finales)]
                cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':pasos});pagina.wait_for_timeout(25)
            cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});pagina.wait_for_timeout(150)
        def posicion():
            v.scroll_into_view_if_needed();c=v.bounding_box()
            return c['x']+c['width']/2,c['y']+c['height']/2
        x,y=posicion();antes=pagina.evaluate('scrollY')
        tocar([{'id':1,'x':x,'y':y}],[{'id':1,'x':x,'y':y-120}])
        comprobar(pagina.evaluate('scrollY')>antes+20 and v.evaluate('e=>e.scrollTop')==0,'Un dedo vertical sobre imagen desplaza la página')
        x,y=posicion()
        tocar([{'id':1,'x':x-45,'y':y},{'id':2,'x':x+45,'y':y}],
              [{'id':1,'x':x-90,'y':y},{'id':2,'x':x+90,'y':y}])
        zoom=int(localizar(pagina,'.mv-visor output').first.inner_text().split()[0])
        comprobar(180<=zoom<=220,'Separar dos dedos amplía la imagen')
        x,y=posicion();antes=pagina.evaluate('scrollY');desplazamiento=v.evaluate('e=>({x:e.scrollLeft,y:e.scrollTop})')
        tocar([{'id':1,'x':x-40,'y':y},{'id':2,'x':x+40,'y':y}],
              [{'id':1,'x':x-60,'y':y-30},{'id':2,'x':x+20,'y':y-30}])
        comprobar(v.evaluate('e=>e.scrollTop')>desplazamiento['y']+10 and abs(pagina.evaluate('scrollY')-antes)<2,
                  'Dos dedos desplazan la imagen ampliada sin mover la lectura')
        comprobar(localizar(pagina,'.mv-recurso').first.evaluate('''e=>{
          const p=e.querySelector('.mv-plano').getBoundingClientRect(),m=e.querySelector('[data-marcador="punto-b"]').getBoundingClientRect();
          return Math.abs((m.x+m.width/2-p.x)/p.width-.75)<.01&&Math.abs((m.y+m.height/2-p.y)/p.height-.5)<.01;
        }'''),'Marcadores alineados después de pellizco y desplazamiento')
        x,y=posicion();antes=pagina.evaluate('scrollY');top=v.evaluate('e=>e.scrollTop')
        tocar([{'id':1,'x':x,'y':y}],[{'id':1,'x':x,'y':y-100}])
        comprobar(abs(pagina.evaluate('scrollY')-antes)<2 and v.evaluate('e=>e.scrollTop')>top+20,
                  'Un dedo vertical mueve la imagen ampliada sin desplazar la página')
        x,y=posicion()
        tocar([{'id':1,'x':x-90,'y':y},{'id':2,'x':x+90,'y':y}],
              [{'id':1,'x':x-40,'y':y},{'id':2,'x':x+40,'y':y}])
        comprobar(int(localizar(pagina,'.mv-visor output').first.inner_text().split()[0])==100,'Juntar dos dedos reduce hasta 100 %')
        cdp.detach()
    else:
        v.focus();pagina.keyboard.press('+');expect(localizar(pagina,'.mv-visor output').first).to_have_text('125 %')
        pagina.keyboard.press('ArrowRight');comprobar(v.evaluate('e=>e.scrollLeft')>0,'Teclado desplaza imagen ampliada')
        pagina.keyboard.press('0');expect(localizar(pagina,'.mv-visor output').first).to_have_text('100 %')
    # Solo texto conserva posición y foco incluso con letra máxima.
    pagina.goto(url+'&modo=texto&enfoque=devocional');esperar_selector(pagina,'#motor[data-listo="true"]')
    comienzo=len(solicitudes)
    comprobar(localizar(pagina,'[data-recurso-acceso]').count()==2 and localizar(pagina,'img,dialog,.mv-recurso').count()==0,'Solo texto monta únicamente iconos anclados')
    for _ in range(9):buscar_rol(pagina,'button',name='Aumentar tamaño de letra',exact=True).click()
    for cierre in ['Escape','boton']:
        icono=localizar(pagina,'[data-recurso-acceso]').first;icono.scroll_into_view_if_needed()
        antes=pagina.evaluate('scrollY');inicio=len(solicitudes)
        icono.click();esperar_selector(pagina,'dialog .mv-visor')
        comprobar(localizar(pagina,'.mv-recurso').count()==1 and localizar(pagina,'img').count()==1,'El modal carga únicamente el recurso elegido')
        nuevas=solicitudes[inicio:]
        comprobar(not any('/datos/estudios/' in u or 'portada-demo.svg' in u for u in nuevas),'Abrir recurso no carga estudios ni portada')
        localizar(pagina,'dialog [data-elemento="punto-b"]').click()
        comprobar(localizar(pagina,'dialog [data-marcador="punto-b"]').get_attribute('aria-pressed')=='true','El modal conserva selección interactiva sincronizada')
        pagina.keyboard.press('Tab');comprobar(pagina.evaluate('document.querySelector("dialog").contains(document.activeElement)'),'Foco contenido en el modal')
        if cierre=='Escape':pagina.keyboard.press('Escape')
        else:buscar_rol(pagina,'button',name='Cerrar recurso',exact=True).click()
        expect(localizar(pagina,'dialog')).to_have_count(0);pagina.wait_for_timeout(60)
        expect(icono).to_be_focused()
        comprobar(abs(pagina.evaluate('scrollY')-antes)<2,f'{cierre}: regresa exactamente a la posición de lectura')
        comprobar(localizar(pagina,'#motor').get_attribute('data-modo')=='texto' and localizar(pagina,'#motor').get_attribute('data-enfoque')=='devocional','Cerrar conserva Solo texto y Devocional')
        comprobar(localizar(pagina,'.mv-recurso,img').count()==0,'Cerrar desmonta todo el recurso')
    capturar(pagina,SALIDA/'capturas'/f'bloque2-{nombre}-texto.png')
    buscar_rol(pagina,'button',name='Con recursos visuales',exact=True).click();esperar_selector(pagina,'.mv-cierre')
    capturar(pagina,SALIDA/'capturas'/f'bloque2-{nombre}-visual.png')
    comprobar(not errores,'Sin errores JavaScript en el bloque 2')
    contexto.close()
    return {'comprobaciones':checks,'errores':errores}


def probar_bloque3(browser, origen, configuracion, nombre):
    contexto=browser.new_context(**configuracion)
    pagina=contexto.new_page()
    checks,errores,solicitudes,navegaciones=[],[],[],[]
    pagina.on('pageerror',lambda e:errores.append(str(e)))
    pagina.on('request',lambda r:solicitudes.append(r.url))
    pagina.on('request',lambda r:navegaciones.append(r.url) if r.is_navigation_request() else None)
    def comprobar(valor,descripcion):
        assert valor,f'{nombre}, bloque 3: {descripcion}'
        checks.append(descripcion)
    pagina.goto(origen+'/motor-visual/demo.html?relato=demo-uno&modo=visual')
    pagina.wait_for_selector('#motor[data-listo="true"]')
    comprobar(pagina.locator('.mv-relato').count()==2,'Dos relatos consecutivos montados en el capítulo')
    comprobar(pagina.locator('.mv-texto [data-versiculo]').evaluate_all('es=>es.map(e=>e.dataset.versiculo)')==[
        'contenido-sintetico:1:1','contenido-sintetico:1:2','contenido-sintetico:1:3','contenido-sintetico:1:4'],'Orden bíblico y versículos completos sin duplicación')
    comprobar(pagina.locator('.mv-barra-lector').count()==1 and pagina.locator('.mv-indice').count()==1,'Una cabecera y un índice por capítulo')
    comprobar(pagina.locator('.mv-indice button small').count()==2,'Tarjetas con título y referencia')
    pagina.evaluate('window.__relatosB3=[...document.querySelectorAll(".mv-relato")];window.__visorB3=document.querySelector(".mv-visor")')
    pagina.wait_for_function('[...document.images].every(i=>i.complete)')
    inicial=len(solicitudes);documentos=len(navegaciones)
    for id in ['demo-dos','demo-uno']:
        pagina.locator(f'[data-relato-indice="{id}"]').focus();pagina.keyboard.press('Enter')
        expect(pagina.locator('#motor')).to_have_attribute('data-relato',id)
        expect(localizar(pagina,'.mv-titulo-relato')).to_be_focused()
        pagina.wait_for_timeout(600)
        comprobar(pagina.evaluate('window.__relatosB3.every((e,i)=>e===document.querySelectorAll(".mv-relato")[i])'),'El índice conserva todos los nodos '+id)
        comprobar(len(solicitudes)==inicial and len(navegaciones)==documentos,'El índice no carga documentos ni datos '+id)
        comprobar(localizar(pagina,'.mv-titulo-relato').bounding_box()['y']>=-1,'Destino visible tras desplazamiento suave '+id)
    comprobar(pagina.locator('.mv-indice').evaluate('e=>getComputedStyle(e).position')=='static','Índice no fijo')
    comprobar(pagina.locator('.mv-abrir-completa').count()==0,'Estudio Visual sin botón de pantalla completa integrado')
    buscar_rol(pagina,'button',name='Solo texto bíblico',exact=True).click()
    acceso=localizar(pagina,'[data-recurso-acceso]').first;acceso.scroll_into_view_if_needed();antes=pagina.evaluate('scrollY');acceso.click()
    pagina.wait_for_selector('dialog .mv-visor');modal=pagina.locator('dialog[open]')
    modal.locator('[data-elemento="punto-b"]').click();modal.locator('.mv-panel nav button').last.click()
    modal.locator('input').fill('200');modal.locator('input').dispatch_event('input')
    modal.locator('.mv-visor').evaluate('e=>window.__exploradorB3=e')
    abrir=modal.get_by_role('button',name='Pantalla completa',exact=True);abrir.click();pagina.wait_for_timeout(150)
    comprobar(modal.evaluate('e=>e.querySelector(".mv-visor")===window.__exploradorB3'),'Pantalla completa usa exactamente el mismo visor modal')
    comprobar(modal.evaluate('e=>e.clientWidth>=innerWidth-2&&e.clientHeight>=innerHeight-2'),'La superposición aprovecha todo el navegador')
    comprobar(modal.locator('.mv-viewport').evaluate('e=>getComputedStyle(e).aspectRatio')=='auto','Pantalla completa sin límite 3:4')
    comprobar(modal.locator('input').input_value()=='200','Zoom conservado al ampliar la vista')
    comprobar(modal.locator('[data-marcador="punto-b"]').get_attribute('aria-pressed')=='true','Selección conservada al ampliar la vista')
    modal.get_by_role('button',name='Restablecer',exact=True).click()
    comprobar(modal.locator('.mv-viewport').evaluate('e=>{const v=e.getBoundingClientRect(),p=e.querySelector(".mv-plano").getBoundingClientRect();return Math.abs(p.width/p.height-2/3)<.01&&p.width<=v.width+1&&p.height<=v.height+1;}'),'Imagen completa y proporcionada en pantalla completa')
    pagina.screenshot(path=str(SALIDA/'capturas'/f'bloque3-{nombre}-completa.png'),animations='disabled')
    modal.get_by_role('button',name='Salir de pantalla completa',exact=True).click()
    comprobar(modal.evaluate('e=>!e.classList.contains("mv-completa")&&e.querySelector(".mv-visor")===window.__exploradorB3'),'Salir de pantalla completa conserva el mismo modal y visor')
    pagina.keyboard.press('Escape');expect(pagina.locator('dialog')).to_have_count(0);pagina.wait_for_timeout(150)
    expect(acceso).to_be_focused();comprobar(abs(pagina.evaluate('scrollY')-antes)<2,'Cerrar el modal restaura la posición de lectura')
    buscar_rol(pagina,'button',name='Con recursos visuales',exact=True).click()
    recurso=localizar(pagina,'.mv-recurso').first
    if nombre=='movil':
        v=recurso.locator('.mv-viewport');cdp=contexto.new_cdp_session(pagina)
        def arrastrar(dx,dy):
            v.scroll_into_view_if_needed();c=v.bounding_box();x=c['x']+c['width']/2;y=c['y']+c['height']/2
            cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':1,'x':x,'y':y}]})
            for n in range(1,9):
                cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'id':1,'x':x+dx*n/8,'y':y+dy*n/8}]});pagina.wait_for_timeout(25)
            cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});pagina.wait_for_timeout(150)
        recurso.locator('input').fill('200');recurso.locator('input').dispatch_event('input');v.scroll_into_view_if_needed()
        antes=pagina.evaluate('scrollY');p=v.evaluate('e=>({x:e.scrollLeft,y:e.scrollTop})')
        arrastrar(-45,-70)
        comprobar(abs(pagina.evaluate('scrollY')-antes)<2 and v.evaluate('e=>e.scrollLeft')>p['x']+20 and v.evaluate('e=>e.scrollTop')>p['y']+40,'Un dedo mueve ambos ejes de la imagen ampliada sin desplazar la lectura')
        recurso.get_by_role('button',name='Restablecer',exact=True).click();v.scroll_into_view_if_needed();antes=pagina.evaluate('scrollY')
        arrastrar(0,-100)
        comprobar(pagina.evaluate('scrollY')>antes+20 and v.evaluate('e=>e.scrollTop')==0,'Restablecer recupera el desplazamiento vertical de página')
        cdp.detach()
    # Solo texto mantiene todo el capítulo, ofrece botones claros y no solicita estudios.
    pagina.goto(origen+'/motor-visual/demo.html?relato=demo-dos&modo=texto');pagina.wait_for_selector('#motor[data-listo="true"]')
    comprobar(pagina.locator('.mv-relato').count()==2 and pagina.locator('img,.mv-recurso').count()==0,'Capítulo continuo en Solo texto sin contenido visual montado')
    comprobar(pagina.locator('[data-recurso-acceso]').evaluate_all('es=>es.every(e=>e.textContent.includes("Ver recurso visual"))'),'Accesos reconocibles con símbolo y texto')
    inicio=len(solicitudes);boton=localizar(pagina,'[data-recurso-acceso]').first;boton.scroll_into_view_if_needed();antes=pagina.evaluate('scrollY')
    boton.click();pagina.wait_for_selector('dialog .mv-visor');modal=pagina.locator('dialog[open]')
    comprobar(modal.locator('.mv-recurso').count()==1 and not any('/datos/estudios/' in u or 'portada-demo.svg' in u for u in solicitudes[inicio:]),'Solo se carga el recurso elegido')
    modal.get_by_role('button',name='Cerrar recurso',exact=True).click();expect(boton).to_be_focused();pagina.wait_for_timeout(100)
    comprobar(abs(pagina.evaluate('scrollY')-antes)<2 and pagina.locator('#motor').get_attribute('data-modo')=='texto','Cerrar devuelve posición y mantiene Solo texto')
    comprobar(pagina.locator('img,.mv-recurso').count()==0,'Modal desmontado completamente')
    contexto.close()
    contexto=browser.new_context(**configuracion,reduced_motion='reduce');pagina=contexto.new_page()
    pagina.goto(origen+'/motor-visual/demo.html?modo=texto');pagina.wait_for_selector('#motor[data-listo="true"]')
    pagina.evaluate('()=>{window.__movimientos=[];const original=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(o){window.__movimientos.push(o?.behavior);return original.call(this,o)}}')
    pagina.locator('[data-relato-indice="demo-dos"]').click();pagina.wait_for_timeout(100)
    comprobar(pagina.evaluate('window.__movimientos.includes("instant")&&!window.__movimientos.includes("smooth")'),'Índice respeta movimiento reducido')
    comprobar(not errores,'Sin errores JavaScript del Bloque 3');contexto.close()
    return {'comprobaciones':checks,'errores':errores}


def probar_editorial(browser, origen, configuracion, nombre):
    checks=[]
    def comprobar(valor,descripcion):
        assert valor,f'{nombre}, editorial: {descripcion}'
        checks.append(descripcion)
    for modo in ['visual','texto']:
        for enfoque in ['estudio','devocional']:
            contexto=browser.new_context(**configuracion);pagina=contexto.new_page();solicitudes=[];errores=[]
            pagina.on('request',lambda r:solicitudes.append(r.url));pagina.on('pageerror',lambda e:errores.append(str(e)))
            pagina.goto(origen+f'/motor-visual/demo.html?relato=demo-uno&modo={modo}&enfoque={enfoque}')
            pagina.wait_for_selector('#motor[data-listo="true"]');pagina.wait_for_timeout(100)
            etiqueta=modo+' '+enfoque
            comprobar(pagina.locator('.mv-relato').count()==2 and pagina.locator('.mv-indice button').count()==2,etiqueta+': capítulo e índice completos')
            comprobar(pagina.locator('.mv-texto [data-versiculo]').count()==4,etiqueta+': versículos completos y ordenados')
            comprobar(pagina.locator('.mv-portada').count()==(2 if modo=='visual' else 0),etiqueta+': banners según modo')
            comprobar(pagina.locator('.mv-contexto').count()==(2 if enfoque=='estudio' else 0),etiqueta+': contexto según enfoque')
            comprobar(pagina.locator('.mv-devocional').count()==(2 if enfoque=='devocional' else 0),etiqueta+': reflexión según enfoque')
            comprobar(pagina.locator('.mv-cierre').count()==2,etiqueta+': cierres textuales correspondientes')
            comprobar(pagina.locator('.mv-recurso').count()==(3 if modo=='visual' and enfoque=='estudio' else 0),etiqueta+': recursos intercalados según composición')
            comprobar(pagina.locator('.mv-abrir-completa').count()==0,etiqueta+': sin pantalla completa integrada')
            comprobar(pagina.locator('[data-recurso-acceso]').count()==(3 if modo=='texto' else 0),etiqueta+': accesos opcionales según modo')
            if modo=='texto' or enfoque=='devocional':
                comprobar(not any('diagrama-vertical-demo.svg' in u or '/componentes/explorador.js' in u for u in solicitudes),etiqueta+': no descarga recursos interactivos al iniciar')
            if modo=='texto':
                comprobar(not any('recursos.json' in u or '.svg' in u for u in solicitudes),etiqueta+': sin biblioteca ni imágenes antes de abrir recurso')
                comprobar(any('/datos/estudios/' in u for u in solicitudes),etiqueta+': contenido textual cargado separadamente')
                acceso=pagina.locator('[data-recurso-acceso]').first;acceso.scroll_into_view_if_needed();antes=pagina.evaluate('scrollY');inicio=len(solicitudes)
                acceso.click();pagina.wait_for_selector('dialog .mv-visor');modal=pagina.locator('dialog[open]')
                comprobar(pagina.locator('img').count()==1 and modal.locator('.mv-recurso').count()==1,etiqueta+': solo recurso solicitado')
                comprobar(not any('/estudios/' in u or 'portada-demo.svg' in u for u in solicitudes[inicio:]),etiqueta+': apertura no recarga estudios ni portada')
                modal.locator('[data-elemento="punto-b"]').click();modal.locator('input').fill('200');modal.locator('input').dispatch_event('input')
                modal.locator('.mv-visor').evaluate('e=>window.__visorEditorialModal=e')
                modal.get_by_role('button',name='Pantalla completa',exact=True).click();pagina.wait_for_timeout(100)
                comprobar(modal.evaluate('e=>e.classList.contains("mv-completa")&&e.querySelector(".mv-visor")===window.__visorEditorialModal'),etiqueta+': pantalla completa usa el mismo visor modal')
                comprobar(modal.locator('input').input_value()=='200' and modal.locator('[data-marcador="punto-b"]').get_attribute('aria-pressed')=='true',etiqueta+': conserva zoom y selección al ampliar')
                modal.get_by_role('button',name='Salir de pantalla completa',exact=True).click()
                comprobar(modal.evaluate('e=>!e.classList.contains("mv-completa")&&e.querySelector(".mv-visor")===window.__visorEditorialModal'),etiqueta+': salir conserva la ventana original')
                pagina.keyboard.press('Escape');expect(pagina.locator('dialog')).to_have_count(0);pagina.wait_for_timeout(100)
                expect(acceso).to_be_focused();comprobar(abs(pagina.evaluate('scrollY')-antes)<2,etiqueta+': restaura posición y foco')
                comprobar(pagina.locator('#motor').get_attribute('data-modo')==modo and pagina.locator('#motor').get_attribute('data-enfoque')==enfoque,etiqueta+': no cambia modo ni enfoque al abrir recursos')
            comprobar(not errores,etiqueta+': sin errores JavaScript');contexto.close()
    contexto=browser.new_context(**configuracion);pagina=contexto.new_page()
    pagina.goto(origen+'/motor-visual/demo.html?modo=visual');pagina.wait_for_selector('#motor[data-listo="true"]')
    recurso=pagina.locator('.mv-recurso').first;recurso.locator('[data-elemento="punto-b"]').click();recurso.locator('.mv-panel nav button').last.click()
    recurso.locator('input').fill('250');recurso.locator('input').dispatch_event('input')
    pagina.evaluate('window.__recursoGuardado=document.querySelector(".mv-recurso");window.__visorGuardado=window.__recursoGuardado.querySelector(".mv-visor")')
    verso=pagina.locator('[data-versiculo="contenido-sintetico:1:1"]')
    verso.evaluate('e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-140)');pagina.wait_for_timeout(100);y=verso.bounding_box()['y']
    pagina.locator('[data-enfoque="devocional"]').evaluate('b=>b.click()');expect(pagina.locator('.mv-recurso')).to_have_count(0);pagina.wait_for_timeout(150)
    comprobar(abs(verso.bounding_box()['y']-y)<2,'Cambiar a Devocional conserva el anclaje visible de lectura')
    pagina.locator('[data-enfoque="estudio"]').evaluate('b=>b.click()');pagina.wait_for_selector('.mv-recurso');pagina.wait_for_timeout(150)
    comprobar(abs(verso.bounding_box()['y']-y)<2,'Volver a Estudio conserva el anclaje visible de lectura')
    comprobar(pagina.evaluate('document.querySelector(".mv-recurso")===window.__recursoGuardado&&document.querySelector(".mv-visor")===window.__visorGuardado'),'Regresa exactamente la misma instancia del visor')
    comprobar(recurso.locator('input').input_value()=='250' and recurso.locator('[data-marcador="punto-b"]').get_attribute('aria-pressed')=='true','Conserva zoom y marcador al volver a Estudio')
    comprobar(recurso.locator('.mv-panel output').inner_text().startswith('2 / '),'Conserva la página de explicación seleccionada')
    capturar(pagina,SALIDA/'capturas'/f'editorial-enfoques-{nombre}-estudio.png')
    pagina.locator('[data-enfoque="devocional"]').click();capturar(pagina,SALIDA/'capturas'/f'editorial-enfoques-{nombre}-devocional.png')
    contexto.close();return {'comprobaciones':checks}


def main():
    baseline = originales()
    total_esquemas = validar_esquemas()
    handler = partial(Silencioso, directory=str(REPO))
    server = ThreadingHTTPServer(('127.0.0.1',0),handler)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    origen = f'http://127.0.0.1:{server.server_port}'
    resultado = {'ok':False,'esquemas':{'documentos_validos':total_esquemas},'suites':{},'demo':{},'accesibilidad':{},'compactacion':{},'composicion':{},'explorador':{},'interfaz':{},'bloque2':{}}
    try:
        with sync_playwright() as p:
            ejecutable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser')
            browser = p.chromium.launch(executable_path=ejecutable,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            resultado['chromium'] = browser.version
            configuraciones = {
                'escritorio':{'viewport':{'width':1280,'height':900}},
                'movil':{'viewport':{'width':390,'height':844},'is_mobile':True,'has_touch':True,'device_scale_factor':2},
            }
            for nombre, config in configuraciones.items():
                contexto = browser.new_context(**config)
                pagina = contexto.new_page()
                errores = []
                pagina.on('pageerror', lambda e: errores.append(str(e)))
                pagina.goto(origen + '/motor-visual/pruebas/runner.html')
                pagina.wait_for_function('window.__resultados',timeout=60000)
                suite = pagina.evaluate('window.__resultados')
                suite['errores_no_controlados'] = errores
                resultado['suites'][nombre] = suite
                assert suite['total'] == suite['aprobadas'] and not errores, suite
                contexto.close()
                resultado['demo'][nombre] = probar_demo(browser,origen,config,nombre)
                resultado['accesibilidad'][nombre] = probar_accesibilidad(browser,origen,config,nombre)
                resultado['compactacion'][nombre] = probar_compactacion(browser,origen,config,nombre)
                resultado['composicion'][nombre] = probar_composicion(browser,origen,config,nombre)
                resultado['explorador'][nombre] = probar_explorador(browser,origen,config,nombre)
                resultado['interfaz'][nombre] = probar_interfaz(browser,origen,config,nombre)
                resultado['bloque2'][nombre] = probar_bloque2(browser,origen,config,nombre)
                resultado.setdefault('bloque3',{})[nombre] = probar_bloque3(browser,origen,config,nombre)
                resultado.setdefault('editorial',{})[nombre] = probar_editorial(browser,origen,config,nombre)
            browser.close()
        assert originales() == baseline, 'Se alteró un archivo preexistente durante las pruebas'
        resultado['archivos_originales_intactos'] = len(baseline)
        resultado['rama'] = subprocess.check_output(['git','branch','--show-current'],cwd=REPO,text=True).strip()
        resultado['commit_base'] = subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip()
        resultado['ok'] = True
    except Exception as error:
        resultado['error'] = str(error)
        raise
    finally:
        server.shutdown()
        server.server_close()
        (SALIDA / 'resultados.json').write_text(json.dumps(resultado,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'ok':resultado['ok'],'chromium':resultado['chromium'],'esquemas':total_esquemas,
                      'suites':{k:f"{v['aprobadas']}/{v['total']}" for k,v in resultado['suites'].items()},
                      'demo':{k:len(v['comprobaciones']) for k,v in resultado['demo'].items()},
                      'accesibilidad':{k:len(v['comprobaciones']) for k,v in resultado['accesibilidad'].items()},
                      'compactacion':{k:len(v['comprobaciones']) for k,v in resultado['compactacion'].items()},
                      'composicion':{k:len(v['comprobaciones']) for k,v in resultado['composicion'].items()},
                      'explorador':{k:len(v['comprobaciones']) for k,v in resultado['explorador'].items()},
                      'interfaz':{k:len(v['comprobaciones']) for k,v in resultado['interfaz'].items()},
                      'bloque2':{k:len(v['comprobaciones']) for k,v in resultado['bloque2'].items()},
                      'editorial':{k:len(v['comprobaciones']) for k,v in resultado.get('editorial',{}).items()},
                      'bloque3':{k:len(v['comprobaciones']) for k,v in resultado.get('bloque3',{}).items()},
                      'archivos_originales_intactos':resultado['archivos_originales_intactos']},ensure_ascii=False))


if __name__ == '__main__':
    main()
