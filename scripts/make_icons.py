"""Genera los íconos de la app: una nota musical blanca sobre violeta."""
from PIL import Image, ImageDraw

ACCENT = (76, 63, 184)


def icon(size: int, pad: float = 0.0) -> Image.Image:
    s = 4 * size  # se dibuja grande y se reduce, para bordes suaves
    img = Image.new("RGB", (s, s), ACCENT)
    d = ImageDraw.Draw(img)
    k = s * (1 - 2 * pad) / 100
    o = s * pad

    def p(x, y):
        return (o + x * k, o + y * k)

    w = (255, 255, 255)
    # Dos notas unidas (corcheas)
    d.ellipse([*p(22, 62), *p(42, 78)], fill=w)
    d.ellipse([*p(58, 54), *p(78, 70)], fill=w)
    d.rectangle([*p(36, 26), *p(42, 70)], fill=w)
    d.rectangle([*p(72, 18), *p(78, 62)], fill=w)
    d.polygon([p(36, 26), p(78, 18), p(78, 30), p(36, 38)], fill=w)
    return img.resize((size, size), Image.LANCZOS)


icon(192, 0.08).save("public/pwa-192x192.png")
icon(512, 0.08).save("public/pwa-512x512.png")
icon(180, 0.1).save("public/apple-touch-icon.png")
