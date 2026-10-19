"""Texturas originales y repetibles del escenario CQB, sin recursos externos."""
from pathlib import Path
import json, random
from PIL import Image, ImageDraw, ImageFilter

raiz = Path(__file__).resolve().parents[1] / 'recursos/cqb'
(raiz / 'texturas').mkdir(parents=True, exist_ok=True)
(raiz / 'materiales').mkdir(parents=True, exist_ok=True)
for nombre, base, semilla in [('hormigon', (86, 96, 90), 1283), ('pared', (170, 180, 170), 3291)]:
    rng = random.Random(semilla)
    nube = Image.new('L', (16, 16)); nube.putdata([rng.randrange(90, 165) for _ in range(256)])
    nube = nube.resize((256, 256), Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(4))
    imagen = Image.new('RGB', (256, 256)); pix = imagen.load()
    for y in range(256):
        for x in range(256):
            variacion = (nube.getpixel((x, y)) - 128) * .17 + rng.randrange(-3, 4)
            pix[x, y] = tuple(max(0, min(255, int(v + variacion))) for v in base)
    if nombre == 'hormigon':
        d = ImageDraw.Draw(imagen)
        for p in [0, 128, 255]:
            d.line((p, 0, p, 255), fill=(64, 74, 69), width=1)
            d.line((0, p, 255, p), fill=(64, 74, 69), width=1)
    imagen.quantize(colors=96).save(raiz / f'texturas/{nombre}.png', optimize=True)
    nodos = [{'id': 'salida', 'tipo': 'salida', 'x': 560, 'y': 80}, {'id': 'color', 'tipo': 'textura', 'archivo': f'texturas/{nombre}.png', 'x': 40, 'y': 40}, {'id': 'rugosidad', 'tipo': 'numero', 'valor': .9, 'x': 40, 'y': 240}]
    mat = {'formato': 'falcon-material', 'version': 1, 'nombre': nombre, 'grafo': {'nodos': nodos, 'conexiones': [{'de': 'color', 'salida': 'color', 'a': 'salida', 'entrada': 'color_base'}, {'de': 'rugosidad', 'salida': 'valor', 'a': 'salida', 'entrada': 'rugosidad'}]}}
    (raiz / f'materiales/{nombre}.mat').write_text(json.dumps(mat, indent=2), encoding='utf8')
