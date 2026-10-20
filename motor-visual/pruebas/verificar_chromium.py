"""Verificación local reproducible. Requiere Python, playwright y jsonschema.
No instala paquetes ni consulta Internet. Sirve solo en 127.0.0.1 y apaga el servidor.
Ejecutar: python motor-visual/pruebas/verificar_chromium.py
"""
import hashlib
import json
import os
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
    pagina.wait_for_selector('#motor[data-listo="true"]')
    comprobar(pagina.locator('#motor [data-versiculo]').count() == 2, 'Enlace directo a segundo relato')
    comprobar(pagina.locator('#motor img, #motor [data-educativo], #motor dialog').count() == 0,
              'Solo texto sin DOM educativo o visual')
    comprobar(not any('/datos/estudios/' in u or u.endswith('/datos/recursos.json') or u.endswith('.svg')
                      for u in solicitudes), 'Solo texto sin solicitudes de estudios, biblioteca ni imágenes')
    comprobar(not any('/componentes/' in u and any(x in u for x in
                      ['visor.js', 'explorador.js', 'portada.js', 'lectura-horizontal.js', 'descubrimiento.js'])
                      for u in solicitudes), 'Solo texto sin descargar módulos visuales')
    comprobar(not any('/biblia/' in u or '/rvc/' in u for u in solicitudes), 'Sin solicitudes al lector o archivos RVC')
    comprobar(pagina.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Sin desbordamiento horizontal inicial')
    capturas = SALIDA / 'capturas'
    capturas.mkdir(exist_ok=True)
    pagina.screenshot(path=str(capturas / f'{nombre}-texto.png'), full_page=True)

    pagina.get_by_role('button', name='Con recursos visuales', exact=True).click()
    pagina.wait_for_selector('.mv-estudio')
    comprobar(pagina.locator('#motor .mv-recurso').count() == 2, 'Dos recursos en dos anclajes del segundo relato')
    comprobar(pagina.locator('.mv-tarjeta').count() == 3, 'Catálogo de tres relatos con metadatos')
    medidas = pagina.locator('.mv-viewport').first.evaluate('(e) => ({ w:e.clientWidth, h:e.clientHeight })')
    comprobar(abs(medidas['w'] / medidas['h'] - .75) < .01, 'Visor 3:4')
    portada = pagina.locator('.mv-portada img').first.evaluate('(e) => ({ w:e.clientWidth, h:e.clientHeight })')
    comprobar(abs(portada['w'] / portada['h'] - 16 / 9) < .01, 'Portada 16:9')
    comprobar(pagina.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Sin desbordamiento horizontal visual')
    pagina.screenshot(path=str(capturas / f'{nombre}-visual.png'), full_page=True)

    slider = pagina.locator('input[type=range]').first
    slider.fill('250')
    slider.dispatch_event('input')
    viewport = pagina.locator('.mv-viewport').first
    viewport.evaluate('(e) => { e.scrollLeft=100; e.scrollTop=100; }')
    comprobar(viewport.evaluate('(e) => e.scrollLeft > 0 && e.scrollTop > 0'), 'Zoom y desplazamiento en ambos ejes')
    pagina.set_viewport_size({'width': 430 if nombre == 'movil' else 1100, 'height': 932 if nombre == 'movil' else 850})
    pagina.wait_for_timeout(100)
    alineado = pagina.locator('.mv-recurso').first.evaluate('''e => {
      const p=e.querySelector('.mv-plano').getBoundingClientRect();
      const m=e.querySelector('[data-marcador="punto-a"]').getBoundingClientRect();
      return Math.abs((m.x+m.width/2-p.x)/p.width-.25)<.01 && Math.abs((m.y+m.height/2-p.y)/p.height-.5)<.01;
    }''')
    comprobar(alineado, 'Marcadores alineados tras zoom, scroll y redimensionamiento')
    # Playwright desplaza el visor para alcanzar el marcador ampliado.
    pagina.locator('[data-marcador="punto-b"]').first.click()
    expect(pagina.locator('.mv-panel h4').first).to_have_text('Punto B')
    checks.append('Panel informativo del marcador')

    abrir = pagina.get_by_role('button', name='Ampliar visor', exact=True).first
    abrir.click()
    dialogo = pagina.locator('dialog[open]')
    expect(dialogo).to_be_visible()
    pagina.keyboard.press('Tab')
    foco_dentro = pagina.evaluate('document.querySelector("dialog[open]").contains(document.activeElement)')
    comprobar(foco_dentro, 'Foco dentro del diálogo modal')
    pagina.keyboard.press('Escape')
    expect(pagina.locator('dialog[open]')).to_have_count(0)
    expect(abrir).to_be_focused()
    checks.append('Escape cierra el visor y devuelve el foco')

    hoja = pagina.locator('.mv-hoja')
    hoja.focus()
    pagina.keyboard.press('ArrowRight')
    expect(pagina.locator('.mv-estudio output')).to_have_text('2 / 2')
    comprobar(len(hoja.inner_text()) > 1500, 'Lectura extensa por teclado sin truncamiento')
    if nombre == 'movil':
        pagina.get_by_role('button', name='Contexto', exact=True).click()
        hoja.dispatch_event('pointerdown', {'pointerType':'touch', 'isPrimary':True, 'clientX':250, 'clientY':120})
        hoja.dispatch_event('pointerup', {'pointerType':'touch', 'isPrimary':True, 'clientX':100, 'clientY':125})
        expect(pagina.locator('.mv-estudio output')).to_have_text('2 / 2')
        checks.append('Gesto horizontal simulado cambia de página')

    pagina.get_by_role('button', name='Solo texto bíblico', exact=True).click()
    expect(pagina.locator('#motor [data-educativo], #motor img, #motor dialog')).to_have_count(0)
    pagina.go_back()
    pagina.wait_for_selector('.mv-estudio')
    pagina.go_forward()
    expect(pagina.locator('#motor [data-educativo]')).to_have_count(0)
    checks.append('Atrás y Adelante restauran el modo y desmontan visuales')
    pagina.get_by_role('button', name='Capítulo siguiente:', exact=False).click()
    expect(pagina.locator('#motor')).to_have_attribute('data-relato','demo-tres')
    checks.append('Navegación a otro capítulo sintético')
    comprobar(not errores, 'Sin errores JavaScript no controlados')
    comprobar(all(urlparse(u).netloc == urlparse(origen).netloc for u in solicitudes), 'Sin solicitudes externas')
    contexto.close()
    return {'comprobaciones':checks,'solicitudes':solicitudes,'errores':errores}


def main():
    baseline = originales()
    total_esquemas = validar_esquemas()
    handler = partial(Silencioso, directory=str(REPO))
    server = ThreadingHTTPServer(('127.0.0.1',0),handler)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    origen = f'http://127.0.0.1:{server.server_port}'
    resultado = {'ok':False,'esquemas':{'documentos_validos':total_esquemas},'suites':{},'demo':{}}
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
                      'archivos_originales_intactos':resultado['archivos_originales_intactos']},ensure_ascii=False))


if __name__ == '__main__':
    main()
