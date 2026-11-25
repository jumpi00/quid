#!/usr/bin/env python3
"""Genera le icone di Quid: una Q geometrica bianca (anello + codetta) su fondo nero.
Solo libreria standard: forma descritta con distanze firmate, bordi antialias.
Uso: python3 tools/make_icons.py
"""
import math
import os
import struct
import zlib

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')

# geometria in unità 0..1 (resta dentro l'area sicura delle icone "maskable")
CX, CY = 0.5, 0.49        # centro dell'anello
R_MID, THICK = 0.215, 0.085  # raggio medio e spessore dell'anello
TAIL_A = (0.585, 0.585)   # codetta: dall'interno dell'anello…
TAIL_B = (0.745, 0.745)   # …verso l'esterno, a 45°
TAIL_W = 0.085


def sdf(x, y):
    ring = abs(math.hypot(x - CX, y - CY) - R_MID) - THICK / 2
    ax, ay = TAIL_A
    bx, by = TAIL_B
    mx, my = (ax + bx) / 2, (ay + by) / 2
    half_len = math.hypot(bx - ax, by - ay) / 2
    ux, uy = (bx - ax) / (2 * half_len), (by - ay) / (2 * half_len)
    px, py = x - mx, y - my
    u = abs(px * ux + py * uy) - half_len
    v = abs(-px * uy + py * ux) - TAIL_W / 2
    tail = math.hypot(max(u, 0), max(v, 0)) + min(max(u, v), 0)
    return min(ring, tail)


def png(path, size):
    rows = []
    for j in range(size):
        row = bytearray(b'\x00')
        y = (j + 0.5) / size
        for i in range(size):
            d = sdf((i + 0.5) / size, y) * size        # distanza in pixel
            a = min(max(0.5 - d, 0.0), 1.0)              # copertura del pixel
            g = round(255 * a)
            row += bytes((g, g, g))
        rows.append(bytes(row))

    def chunk(t, data):
        return struct.pack('>I', len(data)) + t + data + struct.pack('>I', zlib.crc32(t + data) & 0xffffffff)

    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)))
        f.write(chunk(b'IDAT', zlib.compress(b''.join(rows), 9)))
        f.write(chunk(b'IEND', b''))


def svg(path, size, radius=0):
    s = size
    tail = f'M{TAIL_A[0]*s} {TAIL_A[1]*s} L{TAIL_B[0]*s} {TAIL_B[1]*s}'
    with open(path, 'w') as f:
        f.write(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s} {s}">'
            f'<rect width="{s}" height="{s}" rx="{radius}" fill="#000"/>'
            f'<circle cx="{CX*s}" cy="{CY*s}" r="{R_MID*s}" fill="none" stroke="#fff" stroke-width="{THICK*s}"/>'
            f'<path d="{tail}" stroke="#fff" stroke-width="{TAIL_W*s}" stroke-linecap="butt"/>'
            '</svg>\n')


if __name__ == '__main__':
    os.makedirs(ROOT, exist_ok=True)
    for size in (180, 192, 512):
        png(os.path.join(ROOT, f'icon-{size}.png'), size)
    svg(os.path.join(ROOT, 'favicon.svg'), 64)
    svg(os.path.join(ROOT, 'logo.svg'), 64)
    print('icone generate in', os.path.normpath(ROOT))
