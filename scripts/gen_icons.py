"""One-off helper to generate placeholder PWA icons. Not part of the app runtime."""
from PIL import Image, ImageDraw

BG = (45, 106, 79)      # matches --accent
FG = (255, 255, 255)


def make_icon(size, path):
    img = Image.new("RGB", (size, size), BG)
    draw = ImageDraw.Draw(img)

    # Simple flat checkmark, scaled to size.
    stroke = max(size // 14, 4)
    p1 = (size * 0.24, size * 0.54)
    p2 = (size * 0.42, size * 0.72)
    p3 = (size * 0.78, size * 0.30)

    draw.line([p1, p2], fill=FG, width=stroke, joint="curve")
    draw.line([p2, p3], fill=FG, width=stroke, joint="curve")

    # Rounded end caps
    for pt in (p1, p2, p3):
        r = stroke / 2
        draw.ellipse([pt[0] - r, pt[1] - r, pt[0] + r, pt[1] + r], fill=FG)

    img.save(path, "PNG")


make_icon(192, "icons/icon-192.png")
make_icon(512, "icons/icon-512.png")
print("Icons written.")
