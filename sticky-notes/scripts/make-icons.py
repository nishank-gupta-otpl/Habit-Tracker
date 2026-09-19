#!/usr/bin/env python3
"""Generates the app icons.

Written by hand rather than pulled from an icon pack so the home-screen icon is
the same sticky note the app itself draws, and so regenerating it needs nothing
installed: this uses only zlib and struct from the standard library.

    python3 scripts/make-icons.py

Output: public/icons/icon-{192,512}.png (full-bleed) and
public/icons/icon-maskable-{192,512}.png (Android adaptive, art kept inside the
safe circle so the launcher can crop it to any shape).
"""

import struct
import zlib
from pathlib import Path

SS = 3  # supersampling factor; the whole of the antialiasing

BOARD = (245, 241, 232, 255)
PAPER = (255, 227, 140, 255)
FOLD = (232, 199, 108, 255)
INK = (73, 60, 32, 255)


class Canvas:
    """An RGBA framebuffer with the three primitives these icons need."""

    def __init__(self, size, background):
        self.size = size
        self.px = bytearray(background * size * size)

    def _blend(self, x, y, rgba):
        if not (0 <= x < self.size and 0 <= y < self.size):
            return
        i = (y * self.size + x) * 4
        r, g, b, a = rgba
        if a == 255:
            self.px[i : i + 4] = bytes((r, g, b, 255))
            return
        alpha = a / 255
        for c, value in enumerate((r, g, b)):
            self.px[i + c] = round(self.px[i + c] * (1 - alpha) + value * alpha)
        self.px[i + 3] = max(self.px[i + 3], a)

    def rounded_rect(self, x0, y0, x1, y1, radius, rgba, clip=None):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                if clip and not clip(x, y):
                    continue
                # Distance from the inner rectangle the corners are rounded off.
                dx = max(x0 + radius - x, 0, x - (x1 - radius))
                dy = max(y0 + radius - y, 0, y - (y1 - radius))
                if dx * dx + dy * dy <= radius * radius:
                    self._blend(x, y, rgba)

    def triangle(self, pts, rgba):
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            for x in range(int(min(xs)), int(max(xs)) + 1):
                if _inside(pts, x, y):
                    self._blend(x, y, rgba)

    def downsample(self, factor):
        out_size = self.size // factor
        out = bytearray(out_size * out_size * 4)
        area = factor * factor
        for y in range(out_size):
            for x in range(out_size):
                totals = [0, 0, 0, 0]
                for sy in range(factor):
                    for sx in range(factor):
                        i = ((y * factor + sy) * self.size + x * factor + sx) * 4
                        for c in range(4):
                            totals[c] += self.px[i + c]
                o = (y * out_size + x) * 4
                for c in range(4):
                    out[o + c] = totals[c] // area
        return out, out_size


def _sign(ax, ay, bx, by, cx, cy):
    return (ax - cx) * (by - cy) - (bx - cx) * (ay - cy)


def _inside(pts, x, y):
    (ax, ay), (bx, by), (cx, cy) = pts
    d1 = _sign(x, y, ax, ay, bx, by)
    d2 = _sign(x, y, bx, by, cx, cy)
    d3 = _sign(x, y, cx, cy, ax, ay)
    has_neg = d1 < 0 or d2 < 0 or d3 < 0
    has_pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (has_neg and has_pos)


def write_png(path, pixels, size):
    def chunk(tag, data):
        body = tag + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body))

    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter type 0 (None): these images compress fine as-is
        raw += pixels[y * size * 4 : (y + 1) * size * 4]

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    path.write_bytes(png)


def draw_icon(size, inset_ratio):
    """A sticky note with a folded bottom-right corner and three lines of writing.

    `inset_ratio` is how much of the canvas the note occupies — smaller for the
    maskable variant, whose corners a launcher is free to crop away.
    """
    c = Canvas(size * SS, BOARD)
    s = size * SS
    pad = s * (1 - inset_ratio) / 2
    x0, y0, x1, y1 = pad, pad, s - pad, s - pad
    note = x1 - x0
    fold = note * 0.34
    radius = note * 0.10

    # The note, with the fold corner masked out of it.
    fold_pts = [(x1 - fold, y1), (x1, y1 - fold), (x1 + 2, y1 + 2)]
    c.rounded_rect(x0, y0, x1, y1, radius, PAPER, clip=lambda x, y: not _inside(fold_pts, x, y))
    # The fold itself: the underside of the paper turned up.
    c.triangle([(x1 - fold, y1), (x1, y1 - fold), (x1 - fold, y1 - fold)], FOLD)

    # Three ruled lines, the last one short so it reads as unfinished writing.
    line_h = note * 0.075
    for i, width in enumerate((0.60, 0.68, 0.38)):
        ly = y0 + note * (0.26 + i * 0.19)
        c.rounded_rect(
            x0 + note * 0.16,
            ly,
            x0 + note * (0.16 + width),
            ly + line_h,
            line_h / 2,
            INK,
        )

    pixels, out_size = c.downsample(SS)
    return pixels, out_size


def main():
    out = Path(__file__).resolve().parent.parent / 'public' / 'icons'
    out.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        # Android's maskable safe zone is the inner 80% circle, so the art has
        # to sit well inside the square or a round launcher will clip the fold.
        write_png(out / f'icon-{size}.png', *draw_icon(size, 0.78))
        write_png(out / f'icon-maskable-{size}.png', *draw_icon(size, 0.56))
        print(f'wrote icon-{size}.png and icon-maskable-{size}.png')


if __name__ == '__main__':
    main()
