#!/usr/bin/env python3
"""Pixel illustrations of the four research lines (img/lines/*.svg), drawn on a 56 × 20 grid.
Run: python3 tools/src/line-art.py   (writes ../../img/lines/). Colours follow css/styles.css on the dark cards."""
import math, os

W, H = 56, 20
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'img', 'lines')
C = {
    'G': '#5fd39a', 'g': '#2f9e69', 'B': '#7cd0ff', 'b': '#3b86c9', 'W': '#ffffff', 'w': '#b9cbe3',
    'A': '#ffd28a', 'a': '#f2a35e', 'P': '#b9a4ff', 'p': '#7d6ad8', 'd': '#27466f', 'R': '#ff8fa3',
}


class Canvas:
    def __init__(self):
        self.px = {}

    def set(self, x, y, c):
        x, y = math.floor(x + .5), math.floor(y + .5)
        if 0 <= x < W and 0 <= y < H:
            self.px[(x, y)] = c

    def line(self, x0, y0, x1, y1, c, dash=0):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) or 1
        for i in range(n + 1):
            if dash and (i // dash) % 2:
                continue
            self.set(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c)

    def rect(self, x, y, w, h, c):
        for i in range(w):
            for j in range(h):
                self.set(x + i, y + j, c)

    def svg(self, title):
        cells = ''.join(f'<rect x="{x + .08:.2f}" y="{y + .08:.2f}" width=".84" height=".84" fill="{C[c]}"/>'
                        for (x, y), c in sorted(self.px.items(), key=lambda k: (k[0][1], k[0][0])))
        dots = ''.join(f'<rect x="{x + .44}" y="{y + .44}" width=".12" height=".12"/>'
                       for x in range(0, W, 2) for y in range(0, H, 2) if (x, y) not in self.px)
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" shape-rendering="crispEdges" role="img" aria-label="{title}">'
                f'<title>{title}</title><g fill="#7fc4ff" fill-opacity=".22">{dots}</g>{cells}</svg>\n')


def imaging():
    c = Canvas()
    fx, fy = 31, 10                                   # focus
    for y in range(4, 17, 2):                         # parallel rays → lens
        c.line(1, y, 16, y, 'b', dash=2 if y in (4, 16) else 0)
    for y in range(3, 18):                            # biconvex lens
        half = round(2.2 * math.sqrt(max(0, 1 - ((y - 10) / 7.6) ** 2)))
        for x in range(18 - half, 19 + half):
            c.set(x, y, 'W' if x in (18 - half, 18 + half) else 'w')
    for y in range(4, 17, 2):                         # converge, then spread to the sensor
        c.line(20, y, fx, fy, 'B')
        c.line(fx, fy, 40, fy + (y - 10) * 0.9, 'B')
    c.set(fx, fy, 'W')
    for x in range(41, 55):                           # sensor: a pixelated cell (membrane, cytoplasm, nucleus)
        for y in range(3, 17):
            r = math.hypot((x - 47.6) / 1.05, y - 9.6)
            v = math.sin(x * 1.3) * math.cos(y * 1.1)
            c.set(x, y, 'G' if r < 2.2 else 'g' if r < 3.4 else 'A' if 5 < r < 6.2 else
                  ('B' if v > .35 else 'b' if v > -.2 else 'd') if r < 5 else 'd')
    c.rect(40, 2, 1, 16, 'w'); c.rect(55, 2, 1, 16, 'w')
    return c


def polarimetry():
    c = Canvas()
    cx, cy, a, b, th = 12, 10, 9.4, 4.6, math.radians(-28)    # polarization ellipse
    c.line(cx - 11, cy, cx + 11, cy, 'd'); c.line(cx, 0, cx, 19, 'd')
    for i in range(160):
        t = 2 * math.pi * i / 160
        x, y = a * math.cos(t), b * math.sin(t)
        c.set(cx + x * math.cos(th) - y * math.sin(th), cy + x * math.sin(th) + y * math.cos(th), 'G')
    for dx, dy in ((0, 0), (-1, 0), (0, 1), (-1, -1), (-2, 1)):  # arrowhead on the ellipse
        c.set(cx + 8 + dx, cy - 5 + dy, 'W')
    c.line(cx - 6, cy + 3, cx + 6, cy - 3, 'A')                 # major axis
    c.line(26, 10, 31, 10, 'w'); c.set(30, 9, 'w'); c.set(30, 11, 'w')
    shade = [['W', 'b', 'b', 'd'], ['b', 'G', 'g', 'A'], ['b', 'g', 'G', 'a'], ['d', 'a', 'A', 'B']]
    for i in range(4):                                          # 4 × 4 Mueller matrix
        for j in range(4):
            c.rect(34 + j * 5, 1 + i * 5, 4, 4, shade[i][j])
    for i in range(4):
        c.set(34 + i * 5 + 1, 1 + i * 5 + 1, 'W' if i else 'G')
    return c


def simulations():
    c = Canvas()
    xs, ys = list(range(3, 54, 7)), [3, 10, 17]
    for y in ys:
        c.line(xs[0], y, xs[-1], y, 'd')
    for x in xs:
        c.line(x, ys[0], x, ys[-1], 'd')
    x0, x1, y0, y1 = xs[3], xs[4], ys[0], ys[1]                 # plaquette with a gauge-flux loop (drawn inside it)
    for x in range(x0 + 2, x1 - 1):
        c.set(x, y0 + 2, 'A'); c.set(x, y1 - 2, 'A')
    for y in range(y0 + 2, y1 - 1):
        c.set(x0 + 2, y, 'A'); c.set(x1 - 2, y, 'A')
    c.set(x0 + 4, y0 + 1, 'A'); c.set(x0 + 4, y0 + 3, 'A')       # arrowhead: circulation
    c.set(x0 + 3.5, y0 + 5.5, 'W')
    occ = {(0, 0): 'G', (2, 0): 'B', (3, 1): 'G', (5, 0): 'B', (1, 2): 'B', (4, 2): 'G', (6, 1): 'B', (7, 2): 'G', (0, 1): 'B', (5, 2): 'G', (1, 1): 'G'}
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            col = occ.get((i, j))
            if col:
                c.rect(x - 1, y - 1, 3, 3, col); c.set(x, y, 'W')
            else:
                c.set(x, y, 'w')
    c.line(xs[6], ys[1], xs[7], ys[1], 'B')                     # a tunnelling link
    return c


def quantum():
    c = Canvas()
    cx, cy = 24.5, 9.5
    wheel = ['G', 'B', 'b', 'p', 'P', 'R', 'A', 'a']            # phase colours
    for x in range(2, 14):                                      # incoming twisted beam (helix seen from the side)
        c.set(x, cy + 3.2 * math.sin(x * 0.75), 'G')
        c.set(x, cy + 3.2 * math.sin(x * 0.75 + math.pi), 'B')
        c.set(x, cy + 3.2 * math.sin(x * 0.75 + math.pi / 2), 'p')
    for x in range(W):                                          # left half: OAM mode, ring with ℓ = 3 helical phase
        for y in range(H):
            dx, dy = x - cx, y - cy
            r = math.hypot(dx, dy)
            if x < cx and 4.0 < r < 9.7:
                phase = (3 * math.atan2(dy, dx)) % (2 * math.pi)
                c.set(x, y, wheel[int(phase / (2 * math.pi) * len(wheel)) % len(wheel)])
    for y in range(H):                                          # seam = the "|" of the ket
        c.set(cx + 0.5, y, 'W' if 1 <= y <= 18 else 'w')
    amps = [3, 7, 11, 15, 11, 7, 3]                             # right half: d = 7 superposition Σ c_k |k⟩
    for k, n in enumerate(amps):
        y = 3 + 2 * k
        col = wheel[(k * 3) % len(wheel)]
        for i in range(n):
            c.set(cx + 2 + i, y, col)
    for i in range(9):                                          # the "⟩" of the ket
        c.set(44 + i * 0.7, 1 + i, "W"); c.set(44 + i * 0.7, 18 - i, "W")
    return c


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, fn, title in (('imaging', imaging, 'Pixel illustration: light focused by a lens onto a sensor that images a cell'),
                            ('polarimetry', polarimetry, 'Pixel illustration: a polarization ellipse and a 4 by 4 Mueller matrix'),
                            ('simulations', simulations, 'Pixel illustration: atoms in an optical lattice with a gauge-flux plaquette'),
                            ('quantum', quantum, 'Pixel illustration: half an OAM beam with helical phase, half a high-dimensional superposition')):
        with open(os.path.join(OUT, f'{name}.svg'), 'w') as f:
            f.write(fn().svg(title))
        print('wrote', name)
