"""Comparación opcional con la fase anterior, a igual lectura de 20 px.
Requiere Chromium, Playwright y el commit histórico disponible en Git.
No cambia archivos fuente ni ramas; escribe únicamente densidad.json.
"""
import json
import subprocess
import threading
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

MOTOR = Path(__file__).resolve().parents[1]
REPO = MOTOR.parent
BASE = '1aa04866d70f26bd11944c638ada43fe7f6474e0'
PATHS = ['css/motor.css', 'js/estado/preferencias.js', 'js/componentes/preferencias.js']


class Silencioso(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def responder(route, _request, *, body, mime):
    route.fulfill(status=200, content_type=mime, body=body)


def main():
    old = {p: subprocess.check_output(['git', 'show', f'{BASE}:motor-visual/{p}'], cwd=REPO).decode() for p in PATHS}
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Silencioso, directory=str(REPO)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    result = {'referencia_anterior': BASE, 'tamano_comun': 20, 'mediciones': {}}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
            for name, width, height in [('escritorio', 1280, 900), ('movil', 390, 844)]:
                result['mediciones'][name] = {}
                for version in ['anterior', 'compacta']:
                    context = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=name == 'movil', has_touch=name == 'movil')
                    context.add_init_script("localStorage.setItem('mi-biblia-web:motor-visual:preferencias:v1',JSON.stringify({apariencia:'oscuro',tamano:20}))")
                    if version == 'anterior':
                        for path, content in old.items():
                            context.route('**/motor-visual/' + path, partial(responder, body=content, mime='text/css' if path.endswith('.css') else 'text/javascript'))
                    page = context.new_page()
                    page.goto(f'http://127.0.0.1:{server.server_port}/motor-visual/demo.html?relato=demo-dos&modo=visual')
                    page.wait_for_selector('#motor[data-listo="true"]')
                    page.wait_for_timeout(100)
                    result['mediciones'][name][version] = page.evaluate('''() => ({
                      cabecera:document.querySelector('.mv-cabecera').getBoundingClientRect().height,
                      ancho_visor:document.querySelector('.mv-viewport').getBoundingClientRect().width,
                      alto_visor:document.querySelector('.mv-viewport').getBoundingClientRect().height,
                      inicio_visor:document.querySelector('.mv-viewport').getBoundingClientRect().top,
                      font_lectura:getComputedStyle(document.querySelector('.mv-texto > p')).fontSize
                    })''')
                    context.close()
                antes = result['mediciones'][name]['anterior']
                ahora = result['mediciones'][name]['compacta']
                assert ahora['cabecera'] < antes['cabecera']
                assert ahora['ancho_visor'] >= antes['ancho_visor'] - .1
                result['mediciones'][name]['reduccion_cabecera_porcentaje'] = round(100 * (1 - ahora['cabecera'] / antes['cabecera']), 1)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    (MOTOR / 'pruebas/densidad.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
