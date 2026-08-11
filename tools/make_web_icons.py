#!/usr/bin/env python3
"""
Home-screen icons — a filled ghost on the paper field.

Android's install prompt wants real PNGs at 192 and 512, so this rasterises the
GhostShape silhouette (SwimTrainer Watch App/Views/GhostWorkoutView.swift)
straight to bytes. Pure stdlib on purpose: an icon generator that needs a
toolchain installed is an icon generator that stops working.

    python3 tools/make_web_icons.py
"""

import struct
import zlib
from pathlib import Path

PAPER = (0xE6, 0xE8, 0xDB)
INK = (0x21, 0x21, 0x19)

SS = 4          # supersampling factor, for the antialiasing
GLYPH = 0.60    # ghost height as a fraction of the icon


def quad(p0, p1, p2, steps=48):
    """Sample a quadratic Bezier, excluding its first point."""
    out = []
    for i in range(1, steps + 1):
        t = i / steps
        u = 1 - t
        out.append((u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
                    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]))
    return out


def ghost_outline():
    """The classic silhouette in its own 50 x 109 space: domed head, straight
    sides, three-bump hem. Traced anticlockwise from the bottom-left."""
    import math
    pts = [(0.0, 100.0), (0.0, 25.0)]
    # Dome: centre (25, 25), radius 25, sweeping over the top left to right.
    for i in range(1, 65):
        a = math.pi - math.pi * i / 64
        pts.append((25 + 25 * math.cos(a), 25 - 25 * math.sin(a)))
    pts.append((50.0, 100.0))
    bump = 50 / 3
    pts += quad((50.0, 100.0), (50 - bump / 2, 100 - 109 * 0.18), (50 - bump, 100.0))
    pts += quad((50 - bump, 100.0), (50 - bump * 1.5, 100 + 109 * 0.10), (50 - 2 * bump, 100.0))
    pts += quad((50 - 2 * bump, 100.0), (bump / 2, 100 - 109 * 0.18), (0.0, 100.0))
    return pts


def inside(poly, x, y):
    """Even-odd point-in-polygon."""
    hit = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y):
            if x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                hit = not hit
        j = i
    return hit


def render(size):
    poly = ghost_outline()
    # Fit the 50 x 109 glyph into GLYPH of the icon height, centred.
    h = size * GLYPH
    scale = h / 109.0
    ox = (size - 50 * scale) / 2
    oy = (size - h) / 2
    eyes = [(18.0, 38.0), (32.0, 38.0)]
    eye_r = 3.6

    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            covered = 0
            for sy in range(SS):
                for sx in range(SS):
                    gx = (px + (sx + 0.5) / SS - ox) / scale
                    gy = (py + (sy + 0.5) / SS - oy) / scale
                    if not inside(poly, gx, gy):
                        continue
                    if any((gx - ex) ** 2 + (gy - ey) ** 2 < eye_r ** 2 for ex, ey in eyes):
                        continue
                    covered += 1
            a = covered / (SS * SS)
            row += bytes(round(PAPER[c] + (INK[c] - PAPER[c]) * a) for c in range(3))
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    raw = b''.join(b'\x00' + r for r in rows)

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF))

    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    path.write_bytes(png)
    print(f'{path}  {size}x{size}  {len(png)} bytes')


if __name__ == '__main__':
    out = Path(__file__).resolve().parent.parent
    for size in (192, 512):
        write_png(out / f'icon-{size}.png', size, render(size))
