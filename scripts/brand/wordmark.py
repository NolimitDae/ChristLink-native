"""Turns the ChristLink wordmark into SVG outline paths (no fonts needed at runtime).

Geometry follows the refined horizontal lockup on the logo canvas:
  CHRIST/LINK  Playfair Display SemiBold, 80 px, tracking 0.14 em (trailing tracking trimmed)
  SOCIAL       Montserrat Regular, 34 px, six letters spread across the wordmark width
  14 px between the lines (line-height 1).
Usage: python3 -I wordmark.py <playfair.ttf> <montserrat.ttf> <out.json>
"""
import json
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont


def glyph_run(font, text, size, tracking_em, x0, baseline):
    """Returns (path_d, advance_end) for text set from x0 on a baseline (y down)."""
    upm = font['head'].unitsPerEm
    scale = size / upm
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    pen = SVGPathPen(gs)
    x = x0
    for ch in text:
        name = cmap[ord(ch)]
        t = TransformPen(pen, (scale, 0, 0, -scale, x, baseline))
        gs[name].draw(t)
        x += gs[name].width * scale + tracking_em * size
    return pen.getCommands(), x - tracking_em * size


def ink_bounds(font, text, size, x0, baseline, tracking_em=0.0):
    upm = font['head'].unitsPerEm
    scale = size / upm
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    xs, ys = [], []
    x = x0
    for ch in text:
        name = cmap[ord(ch)]
        bp = BoundsPen(gs)
        gs[name].draw(bp)
        if bp.bounds:
            xmin, ymin, xmax, ymax = bp.bounds
            xs += [x + xmin * scale, x + xmax * scale]
            ys += [baseline - ymax * scale, baseline - ymin * scale]
        x += gs[name].width * scale + tracking_em * size
    return min(xs), min(ys), max(xs), max(ys)


def main():
    pf = TTFont(sys.argv[1])
    ms = TTFont(sys.argv[2])
    size1, size2, gap = 80, 34, 14
    track = 0.14
    # Line 1: line box 80 px tall (line-height 1); baseline sits where the browser puts it for this font
    asc1 = pf['hhea'].ascent / pf['head'].unitsPerEm
    desc1 = -pf['hhea'].descent / pf['head'].unitsPerEm
    base1 = (size1 - (asc1 + desc1) * size1) / 2 + asc1 * size1
    christ, x_after_christ = glyph_run(pf, 'CHRIST', size1, track, 0, base1)
    link, line1_end = glyph_run(pf, 'LINK', size1, track, x_after_christ + track * size1, base1)
    # Line 2: SOCIAL letters spread across line 1 (justify-content: space-between)
    asc2 = ms['hhea'].ascent / ms['head'].unitsPerEm
    desc2 = -ms['hhea'].descent / ms['head'].unitsPerEm
    top2 = size1 + gap
    base2 = top2 + (size2 - (asc2 + desc2) * size2) / 2 + asc2 * size2
    letters = 'SOCIAL'
    cmap, gs = ms.getBestCmap(), ms.getGlyphSet()
    scale2 = size2 / ms['head'].unitsPerEm
    widths = [gs[cmap[ord(c)]].width * scale2 for c in letters]
    free = line1_end - sum(widths)
    step = free / (len(letters) - 1)
    pen = SVGPathPen(gs)
    x = 0.0
    for c, w in zip(letters, widths):
        gs[cmap[ord(c)]].draw(TransformPen(pen, (scale2, 0, 0, -scale2, x, base2)))
        x += w + step
    social = pen.getCommands()

    b1 = ink_bounds(pf, 'CHRISTLINK', size1, 0, base1, track)
    b2 = ink_bounds(ms, 'S', size2, 0, base2)
    out = {
        'christ': christ,
        'link': link,
        'social': social,
        'width': round(line1_end, 2),
        'height': round(top2 + size2, 2),
        'inkTop': round(b1[1], 2),
        'inkBottom': round(b2[3], 2),
    }
    with open(sys.argv[3], 'w') as f:
        json.dump(out, f)
    print({k: v for k, v in out.items() if not isinstance(v, str)})


main()
