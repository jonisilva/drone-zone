"""Draw the app icons (PNG) with the standard library only.

Usage: python tools/make_icons.py   -> icons/icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png
Design: navy square, amber zone disc with red ring, white quadcopter on top.
"""
import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "icons"
NAVY = (15, 27, 45)
AMBER = (242, 169, 0)
RED = (215, 38, 61)
WHITE = (255, 255, 255)
SS = 4  # supersampling per axis


def shade(x, y, safe):
    """Colour at unit coords (0..1). `safe` shrinks the artwork for maskable icons."""
    cx, cy = (x - 0.5) / safe, (y - 0.5) / safe
    r = math.hypot(cx, cy)
    col = NAVY
    if r < 0.40:
        col = blend(NAVY, AMBER, 0.35)
    if 0.36 < r < 0.42:
        col = RED
    # quadcopter: two arms (X), four rotors, body
    d1 = abs(cx - cy) / math.sqrt(2)
    d2 = abs(cx + cy) / math.sqrt(2)
    if (d1 < 0.025 or d2 < 0.025) and max(abs(cx), abs(cy)) < 0.2:
        col = WHITE
    for sx in (-1, 1):
        for sy in (-1, 1):
            rr = math.hypot(cx - sx * 0.2, cy - sy * 0.2)
            if 0.065 < rr < 0.095:
                col = WHITE
            elif rr < 0.03:
                col = WHITE
    if abs(cx) < 0.07 and abs(cy) < 0.07:
        col = WHITE
    return col


def blend(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def render(size, safe=1.0, rounded=True):
    rows = []
    rad = 0.18  # corner radius (fraction of size) for non-maskable icons
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    x = (px + (sx + 0.5) / SS) / size
                    y = (py + (sy + 0.5) / SS) / size
                    alpha = 255
                    if rounded:
                        qx = max(rad - x, x - (1 - rad), 0)
                        qy = max(rad - y, y - (1 - rad), 0)
                        if math.hypot(qx, qy) > rad:
                            alpha = 0
                    c = shade(x, y, safe) if alpha else (0, 0, 0)
                    acc[0] += c[0] * alpha
                    acc[1] += c[1] * alpha
                    acc[2] += c[2] * alpha
                    acc[3] += alpha
            a = acc[3]
            if a:
                row += bytes([round(acc[0] / a), round(acc[1] / a), round(acc[2] / a), round(a / SS / SS)])
            else:
                row += b"\0\0\0\0"
        rows.append(bytes(row))
    return png(size, b"".join(rows))


def png(size, raw):
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def main():
    OUT.mkdir(exist_ok=True)
    (OUT / "icon-192.png").write_bytes(render(192))
    (OUT / "icon-512.png").write_bytes(render(512))
    (OUT / "maskable-512.png").write_bytes(render(512, safe=0.8, rounded=False))
    (OUT / "apple-touch-icon.png").write_bytes(render(180, rounded=False))
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
