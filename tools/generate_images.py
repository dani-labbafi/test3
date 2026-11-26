#!/usr/bin/env python3
"""Generates conceptual 3D-style product illustrations (SVG) for every product in data.js.
These are illustrations built from simple shapes + lighting, NOT photographs of the real products.
Usage (from project root):  python3 tools/generate_images.py"""
import json, re, os, hashlib, math

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "img", "products")
os.makedirs(OUT, exist_ok=True)


def hx(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def shade(h, f):  # f>0 lighten toward white, f<0 darken toward black
    r = hx(h)
    t = 255 if f > 0 else 0
    f = abs(f)
    return '#%02x%02x%02x' % tuple(round(v + (t - v) * f) for v in r)


ACCENTS = [("RETROSPOT", "#e5566b"), ("RED", "#e5566b"), ("PINK", "#f48fb1"), ("BLUE", "#4c9aff"), ("GREEN", "#2fcf9b"),
           ("BLACK", "#33466b"), ("YELLOW", "#f5c04a"), ("IVORY", "#efe7d6"), ("CREAM", "#efe3c4"), ("WHITE", "#eef3fb"),
           ("SILVER", "#b9c6dc"), ("PURPLE", "#9b8cf2"), ("FAWN", "#c9a27e"), ("SCOTTIE", "#33466b"), ("SCOTTY", "#33466b")]
DEFAULTS = ["#22d3ee", "#3b82f6", "#7dd3fc", "#2dd4bf", "#60a5fa", "#38bdf8"]


def accent(n):
    u = n.upper()
    for k, c in ACCENTS:
        if k in u:
            return c
    return DEFAULTS[int(hashlib.md5(n.encode()).hexdigest(), 16) % len(DEFAULTS)]


class S:
    def __init__(s):
        s.defs, s.body, s.n = [], [], 0

    def grad(s, stops, kind="linear", **a):
        s.n += 1
        i = "g%d" % s.n
        if not a:
            a = dict(x1="0", x2="1", y1="0", y2="0") if kind == "linear" else dict(cx=".4", cy=".35", r=".75")
        at = " ".join('%s="%s"' % kv for kv in a.items())
        tag = "linearGradient" if kind == "linear" else "radialGradient"
        st = ""
        for o in stops:
            op = (' stop-opacity="%s"' % o[2]) if len(o) > 2 else ""
            st += '<stop offset="%s" stop-color="%s"%s/>' % (o[0], o[1], op)
        s.defs.append('<%s id="%s" %s>%s</%s>' % (tag, i, at, st, tag))
        return "url(#%s)" % i

    def hgrad(s, c):
        return s.grad([("0", shade(c, -.35)), ("0.35", shade(c, .18)), ("1", shade(c, -.45))])

    def vgrad(s, c):
        return s.grad([("0", shade(c, .25)), ("1", shade(c, -.4))], x1="0", x2="0", y1="0", y2="1")

    def rgrad(s, c):
        return s.grad([("0", shade(c, .55)), ("0.45", c), ("1", shade(c, -.5))], kind="radial")

    def glow(s, col, o="0.5"):
        return s.grad([("0", col, o), ("1", col, "0")], kind="radial", cx=".5", cy=".5", r=".5")

    def add(s, x):
        s.body.append(x)

    def pattern(s, kind):
        if not kind:
            return None
        s.n += 1
        i = "p%d" % s.n
        if kind == "dots":
            s.defs.append('<pattern id="%s" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="13" cy="13" r="5" fill="#fff" fill-opacity=".85"/></pattern>' % i)
        else:
            s.defs.append('<pattern id="%s" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="15" height="30" fill="#fff" fill-opacity=".5"/></pattern>' % i)
        return "url(#%s)" % i


def isobox(s, cx, by, w, d, h, c):
    a, b, ty = w / 2, d / 2, by - h
    s.add('<path d="M%g %g L%g %g L%g %g L%g %g Z" fill="%s"/>' % (cx - a, ty, cx, ty + b, cx, by + b, cx - a, by, s.vgrad(shade(c, -.1))))
    s.add('<path d="M%g %g L%g %g L%g %g L%g %g Z" fill="%s"/>' % (cx, ty + b, cx + a, ty, cx + a, by, cx, by + b, s.vgrad(shade(c, -.38))))
    s.add('<path d="M%g %g L%g %g L%g %g L%g %g Z" fill="%s"/>' % (cx, ty - b, cx + a, ty, cx, ty + b, cx - a, ty, shade(c, .3)))
    s.add('<path d="M%g %g L%g %g" stroke="#fff" stroke-opacity=".35" stroke-width="2" fill="none"/>' % (cx - a, ty, cx, ty + b))


def cyl(s, cx, top, bot, rx, ry, c, cap=None):
    s.add('<path d="M%g %g L%g %g A%g %g 0 0 0 %g %g L%g %g Z" fill="%s"/>' % (cx - rx, top, cx - rx, bot, rx, ry, cx + rx, bot, cx + rx, top, s.hgrad(c)))
    s.add('<ellipse cx="%g" cy="%g" rx="%g" ry="%g" fill="%s"/>' % (cx, top, rx, ry, cap or shade(c, .35)))


def ell(s, cx, cy, rx, ry, f, extra=""):
    s.add('<ellipse cx="%g" cy="%g" rx="%g" ry="%g" fill="%s" %s/>' % (cx, cy, rx, ry, f, extra))


def path(s, d, f, extra=""):
    s.add('<path d="%s" fill="%s" %s/>' % (d, f, extra))


def shine(s, d, o=.22):
    s.add('<path d="%s" fill="#fff" fill-opacity="%s"/>' % (d, o))


def flame(s, x, y, k=1.0):
    ell(s, x, y - 6 * k, 34 * k, 40 * k, s.glow("#fde68a", "0.9"))
    path(s, "M%g %g C%g %g %g %g %g %g C%g %g %g %g %g %g Z" % (x, y - 34 * k, x + 14 * k, y - 16 * k, x + 10 * k, y, x, y, x - 10 * k, y, x - 14 * k, y - 16 * k, x, y - 34 * k), "#fcd34d")


def hotwater(s, c, pat):
    d = "M205 205 Q205 168 242 165 L358 165 Q395 168 395 205 L405 440 Q405 474 370 474 L230 474 Q195 474 195 440 Z"
    path(s, d, s.hgrad(c))
    if pat:
        path(s, d, pat)
    for y in range(225, 440, 38):
        s.add('<path d="M205 %d Q300 %d 397 %d" stroke="#000" stroke-opacity=".18" stroke-width="5" fill="none"/>' % (y, y + 14, y))
    shine(s, "M222 200 Q218 330 228 450 L246 450 Q238 330 244 190 Z")
    cyl(s, 300, 128, 168, 34, 9, "#cbd5e1", "#e2e8f0")
    ell(s, 300, 128, 22, 5, "#64748b")


def tlight(s, c, tall=False):
    if tall:
        for i, (x, h) in enumerate([(240, 250), (300, 330), (360, 200)]):
            col = [c, shade(c, .15), shade(c, -.1)][i]
            cyl(s, x, 470 - h, 470, 24, 7, col, shade(col, .5))
            s.add('<rect x="%d" y="%d" width="3" height="14" fill="#334155"/>' % (x - 1, 470 - h - 16))
            flame(s, x, 470 - h - 18, .8)
        return
    ell(s, 300, 330, 100, 90, s.glow("#7dd3fc", "0.25"))
    cyl(s, 300, 330, 460, 82, 20, shade(c, -.1), shade(c, .2))
    s.add('<path d="M218 330 L218 460 A82 20 0 0 0 382 460 L382 330" fill="#bfe9ff" fill-opacity=".18" stroke="#e0f2fe" stroke-opacity=".6" stroke-width="3"/>')
    cyl(s, 300, 420, 450, 36, 9, "#fde7c4", "#fff7e6")
    flame(s, 300, 404, 1.2)
    shine(s, "M232 340 Q228 420 238 452 L250 452 Q242 420 246 340 Z", .3)


def heart(s, c):
    s.add('<path d="M300 70 L300 255" stroke="#cbd5e1" stroke-width="3"/>')
    d = "M300 440 C190 365 180 262 240 246 C274 238 300 262 300 288 C300 262 326 238 360 246 C420 262 410 365 300 440 Z"
    path(s, d, s.rgrad(c))
    shine(s, "M232 268 C220 290 226 320 244 340 C236 312 238 288 258 272 Z", .45)


def ball(s, c, grid=False):
    s.add('<path d="M300 70 L300 232" stroke="#cbd5e1" stroke-width="3"/>')
    cyl(s, 300, 222, 242, 16, 5, "#cbd5e1")
    ell(s, 300, 345, 108, 108, s.rgrad(c))
    if grid:
        g = "".join('<path d="M%d 237 Q%d 345 %d 453"/>' % (x, 300 + (x - 300) * 1.5, x) for x in range(220, 400, 30))
        g += "".join('<path d="M192 %d Q300 %d 408 %d"/>' % (y, y + (y - 345) * .4, y) for y in range(270, 440, 30))
        s.add('<clipPath id="cb"><circle cx="300" cy="345" r="108"/></clipPath><g clip-path="url(#cb)" stroke="#fff" stroke-opacity=".35" stroke-width="2" fill="none">%s</g>' % g)
    shine(s, "M240 290 C262 262 292 256 312 262 C288 266 262 282 248 312 Z", .55)


def flower(s, c):
    s.add('<path d="M300 70 L300 285" stroke="#cbd5e1" stroke-width="3"/>')
    for i in range(8):
        a = i * math.pi / 4
        x, y = 300 + 78 * math.cos(a), 330 + 78 * math.sin(a)
        ell(s, x, y, 46, 28, s.rgrad(c), 'transform="rotate(%d %g %g)"' % (i * 45, x, y))
    ell(s, 300, 330, 44, 44, s.rgrad("#f5c04a"))


def box(s, c, pat=None, ribbon=False):
    isobox(s, 300, 440, 220, 120, 150, c)
    isobox(s, 300, 292, 236, 132, 26, shade(c, .12))
    if ribbon:
        s.add('<path d="M300 220 L300 302 M214 262 L300 302 L386 262" stroke="#fff" stroke-opacity=".85" stroke-width="12" fill="none"/>')
    if pat:
        s.add('<path d="M190 292 L300 347 L300 440 L190 385 Z" fill="%s"/>' % pat)


def mug(s, c, pat=None):
    s.add('<path d="M360 290 C430 280 440 400 358 395" stroke="%s" stroke-width="26" fill="none" stroke-linecap="round"/>' % shade(c, -.2))
    cyl(s, 300, 250, 430, 90, 24, c)
    if pat:
        s.add('<path d="M210 250 L210 430 A90 24 0 0 0 390 430 L390 250 Z" fill="%s"/>' % pat)
    ell(s, 300, 250, 78, 18, "#3b2a1a")
    ell(s, 300, 254, 70, 12, "#6b4a2e")
    shine(s, "M222 262 Q220 360 230 424 L246 428 Q238 360 240 262 Z", .28)


def tumbler(s, c):
    s.add('<path d="M222 190 L378 190 L360 450 Q300 478 240 450 Z" fill="#bfe9ff" fill-opacity=".3" stroke="#e0f2fe" stroke-opacity=".7" stroke-width="3"/>')
    ell(s, 300, 190, 78, 14, "#e0f2fe", 'fill-opacity=".4"')
    path(s, "M232 330 L368 330 L358 446 Q300 470 242 446 Z", c, 'fill-opacity=".55"')
    shine(s, "M236 200 L250 200 L262 440 L248 436 Z", .35)


def bowl(s, c, pat=None):
    d = "M180 300 Q300 290 420 300 Q410 440 300 452 Q190 440 180 300 Z"
    path(s, d, s.hgrad(c))
    if pat:
        path(s, d, pat)
    ell(s, 300, 300, 120, 24, shade(c, .35))
    ell(s, 300, 304, 106, 17, shade(c, -.2))
    shine(s, "M198 320 Q206 400 240 436 L252 430 Q222 394 214 322 Z", .3)


def milkbottle(s, c):
    d = "M262 170 L338 170 L338 235 Q392 262 392 320 L392 440 Q392 470 362 470 L238 470 Q208 470 208 440 L208 320 Q208 262 262 235 Z"
    path(s, d, "#d8f1ff", 'fill-opacity=".28" stroke="#e0f2fe" stroke-opacity=".8" stroke-width="3"')
    path(s, "M216 340 L384 340 L384 440 Q384 464 360 464 L240 464 Q216 464 216 440 Z", "#f8fafc", 'fill-opacity=".92"')
    cyl(s, 300, 160, 182, 40, 10, "#94a3b8", "#cbd5e1")
    shine(s, "M226 300 Q222 400 232 450 L246 450 Q238 400 240 290 Z", .4)


def bag(s, c, pat=None):
    for dx in (0, 1):
        s.add('<path d="M%d 236 C%d 120 %d 120 %d 236" stroke="%s" stroke-width="12" fill="none" stroke-linecap="round"/>' % (240 + dx * 8, 240 + dx * 8, 330 + dx * 38, 330 + dx * 38, shade(c, -.3)))
    d = "M195 232 L405 232 L428 452 Q430 476 404 476 L196 476 Q170 476 172 452 Z"
    path(s, d, s.hgrad(c))
    if pat:
        path(s, d, pat)
    shine(s, "M205 250 L224 250 L214 460 L190 460 Z", .2)


def pencils(s, c, match=False, pat=None):
    cols = ["#ef4444", "#facc15", "#34d399", "#60a5fa", "#f472b6"]
    for i, (x, ang) in enumerate([(250, -14), (280, -5), (312, 4), (344, 13)]):
        g = 'transform="rotate(%d %d 330)"' % (ang, x)
        if match:
            s.add('<g %s><rect x="%d" y="140" width="8" height="190" fill="#d6b27a"/><ellipse cx="%d" cy="136" rx="11" ry="14" fill="#dc2626"/></g>' % (g, x - 4, x))
        else:
            s.add('<g %s><rect x="%d" y="150" width="18" height="190" fill="%s"/><path d="M%d 150 L%d 150 L%d 112 Z" fill="#e8c99a"/><path d="M%d 128 L%d 128 L%d 112 Z" fill="#334155"/></g>' % (g, x - 9, cols[i], x - 9, x + 9, x, x - 4, x + 4, x))
    cyl(s, 300, 330, 470, 82, 20, c, shade(c, .3))
    if pat:
        s.add('<path d="M218 330 L218 470 A82 20 0 0 0 382 470 L382 330 Z" fill="%s"/>' % pat)
    shine(s, "M228 340 Q226 430 234 468 L248 470 Q242 430 244 340 Z", .25)


def tissue(s, c):
    isobox(s, 300, 450, 230, 130, 120, c)
    s.add('<path d="M240 333 C250 250 270 240 285 262 C292 220 322 218 322 262 C340 236 372 262 352 340 Z" fill="#f8fafc"/><path d="M262 333 C268 280 282 276 290 300" stroke="#cbd5e1" fill="none" stroke-width="3"/>')
    isobox(s, 300, 335, 160, 70, 6, "#1e3a8a")


def lights(s, c):
    s.add('<path d="M60 150 Q180 260 300 170 T540 160" stroke="#334155" stroke-width="4" fill="none"/>')
    for i, x in enumerate(range(100, 520, 70)):
        y = 175 + 55 * math.sin(x / 90)
        col = ["#7dd3fc", "#fde68a", "#fda4af", "#86efac", c][i % 5]
        ell(s, x, y + 60, 44, 44, s.glow(col))
        s.add('<rect x="%d" y="%d" width="12" height="18" fill="#475569"/>' % (x - 6, y + 6))
        path(s, "M%d %d Q%d %d %d %d Q%d %d %d %d Z" % (x - 16, y + 24, x - 22, y + 80, x, y + 92, x + 22, y + 80, x + 16, y + 24), s.rgrad(col))


def cakestand(s, c):
    s.add('<rect x="294" y="250" width="12" height="220" fill="%s"/>' % shade(c, -.3))
    for cy, rx in [(450, 160), (350, 118), (250, 76)]:
        cyl(s, 300, cy, cy + 14, rx, rx * .22, c, shade(c, .3))
        ell(s, 300, cy - 4, rx - 14, rx * .17, shade(c, .5), 'fill-opacity=".5"')
    ell(s, 300, 232, 22, 14, "#f87171")
    ell(s, 300, 330, 30, 17, "#fde68a")


def cabinet(s, c, rows=3):
    isobox(s, 300, 470, 190, 110, 280, c)
    for i in range(rows):
        y = 470 - 280 + 60 + i * (200 / rows)
        s.add('<path d="M205 %g L300 %g" stroke="#000" stroke-opacity=".3" stroke-width="3"/>' % (y, y + 48))
        ell(s, 252, y + 36, 8, 8, "#e2e8f0")


def knob(s, c):
    cyl(s, 300, 440, 450, 70, 16, "#94a3b8", "#cbd5e1")
    cyl(s, 300, 400, 440, 20, 6, "#94a3b8")
    ell(s, 300, 330, 96, 96, s.rgrad(c))
    shine(s, "M236 300 C250 270 280 252 308 256 C280 266 258 286 250 318 Z", .55)


def letters(s, c, word):
    w = (word or "ABCD")[:4]
    step = 120
    x0 = 300 - step * len(w) / 2 + 8
    for i, ch in enumerate(w):
        x = x0 + i * step
        y = 280 + (i % 2) * 40
        s.add('<rect x="%g" y="%g" width="104" height="124" rx="14" fill="%s"/><rect x="%g" y="%g" width="104" height="124" rx="14" fill="%s"/>' % (x + 10, y + 12, shade(c, -.5), x, y, s.vgrad(c)))
        s.add('<text x="%g" y="%g" font-family="Georgia,serif" font-weight="700" font-size="76" text-anchor="middle" fill="#fff" fill-opacity=".92">%s</text>' % (x + 52, y + 88, ch))


def cards(s, c):
    for ang, dx in [(-20, -70), (0, 0), (20, 70)]:
        s.add('<g transform="translate(%d 330) rotate(%d)"><rect x="-70" y="-110" width="140" height="210" rx="14" fill="#000" fill-opacity=".3" transform="translate(6 8)"/><rect x="-70" y="-110" width="140" height="210" rx="14" fill="#f8fafc"/><rect x="-58" y="-98" width="116" height="186" rx="8" fill="none" stroke="%s" stroke-width="4"/><path d="M0 40 C-50 5 -48 -40 -22 -42 C-8 -43 0 -32 0 -22 C0 -32 8 -43 22 -42 C48 -40 50 5 0 40 Z" fill="%s"/></g>' % (300 + dx, ang, c, c))


def doll(s, c):
    path(s, "M236 300 L364 300 L392 462 L208 462 Z", s.hgrad(c))
    ell(s, 300, 232, 66, 66, s.rgrad("#f3d2b3"))
    path(s, "M236 222 Q300 130 364 222 Q330 180 236 222 Z", s.rgrad(shade(c, -.2)))
    ell(s, 276, 240, 6, 6, "#1e293b")
    ell(s, 324, 240, 6, 6, "#1e293b")
    s.add('<path d="M280 262 Q300 276 320 262" stroke="#b45309" stroke-width="4" fill="none"/>')
    ell(s, 250, 372, 24, 60, shade(c, -.1), 'transform="rotate(20 250 372)"')
    ell(s, 350, 372, 24, 60, shade(c, -.1), 'transform="rotate(-20 350 372)"')


def mice(s, c):
    for x, y, k in [(210, 420, .9), (300, 380, 1.1), (392, 430, .85)]:
        ell(s, x, y, 62 * k, 44 * k, s.rgrad("#cbd5e1"))
        ell(s, x + 48 * k, y - 22 * k, 34 * k, 30 * k, s.rgrad("#e2e8f0"))
        ell(s, x + 40 * k, y - 56 * k, 16 * k, 16 * k, s.rgrad(c))
        ell(s, x + 72 * k, y - 50 * k, 16 * k, 16 * k, s.rgrad(c))
        ell(s, x + 78 * k, y - 24 * k, 4 * k, 4 * k, "#1e293b")
        s.add('<path d="M%g %g Q%g %g %g %g" stroke="#f9a8d4" stroke-width="5" fill="none"/>' % (x - 60 * k, y + 6 * k, x - 100 * k, y + 20 * k, x - 110 * k, y - 14 * k))


def slate(s, c):
    s.add('<g transform="rotate(-8 300 320)"><rect x="170" y="190" width="260" height="290" rx="22" fill="#000" fill-opacity=".3" transform="translate(8 10)"/><rect x="170" y="190" width="260" height="290" rx="22" fill="%s"/><rect x="194" y="214" width="212" height="242" rx="10" fill="#0f172a"/><path d="M220 400 q30 -90 60 -20 t60 -60 t40 -90" stroke="#7dd3fc" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="262" cy="270" r="22" stroke="#fde68a" stroke-width="6" fill="none"/></g>' % s.vgrad(c))


def cloth(s, c, pat=None):
    for i, dy in enumerate((0, -52, -104)):
        d = "M170 %d Q300 %d 430 %d L420 %d Q300 %d 180 %d Z" % (440 + dy, 410 + dy, 440 + dy, 490 + dy, 458 + dy, 490 + dy)
        path(s, d, s.vgrad(shade(c, -.18 * (2 - i))))
        if pat:
            path(s, d, pat)
    shine(s, "M200 330 Q300 300 400 330 L402 340 Q300 312 198 342 Z", .25)


def umbrella(s, c, pat=None):
    d = "M110 330 C110 170 490 170 490 330 Q455 296 420 330 Q385 296 350 330 Q325 296 300 330 Q265 296 230 330 Q195 296 160 330 Q130 296 110 330 Z"
    path(s, d, s.hgrad(c))
    if pat:
        path(s, d, pat)
    s.add('<path d="M300 200 L300 440 Q300 488 252 480" stroke="#cbd5e1" stroke-width="12" fill="none" stroke-linecap="round"/>')
    shine(s, "M170 260 C220 210 290 196 340 200 C280 210 220 236 180 300 Z", .4)


def bracelet(s, c):
    ell(s, 300, 336, 150, 110, "none", 'stroke="%s" stroke-width="34"' % shade(c, -.25))
    ell(s, 300, 326, 150, 110, "none", 'stroke="%s" stroke-width="26"' % c)
    for i in range(10):
        a = i * math.pi / 5 + .3
        ell(s, 300 + 150 * math.cos(a), 326 + 110 * math.sin(a), 18, 18, s.rgrad("#f8fafc"))


def book(s, c):
    isobox(s, 300, 456, 250, 190, 52, "#e2e8f0")
    isobox(s, 300, 420, 250, 190, 40, c)
    s.add('<path d="M175 372 L300 438 L300 410 L175 346 Z" fill="#fff" fill-opacity=".25"/>')


def spool(s, c):
    cyl(s, 300, 340, 460, 108, 26, "#94a3b8", "#cbd5e1")
    cyl(s, 300, 360, 440, 80, 20, c, shade(c, .3))
    s.add('<path d="M380 360 Q460 380 440 460" stroke="%s" stroke-width="26" fill="none"/>' % c)
    cyl(s, 300, 300, 330, 108, 26, "#94a3b8", "#cbd5e1")


def stamp(s, c):
    ell(s, 300, 478, 140, 26, "#1e3a8a", 'opacity=".7"')
    cyl(s, 300, 410, 440, 100, 24, "#334155", "#475569")
    cyl(s, 300, 250, 410, 30, 10, c, shade(c, .3))
    ell(s, 300, 230, 56, 30, s.rgrad(c))


def lantern(s, c):
    s.add('<path d="M240 190 C240 100 360 100 360 190" stroke="#cbd5e1" stroke-width="8" fill="none"/>')
    cyl(s, 300, 200, 220, 78, 18, "#334155", "#475569")
    cyl(s, 300, 440, 466, 82, 20, "#334155", "#475569")
    s.add('<path d="M222 220 L222 440 A78 18 0 0 0 378 440 L378 220 Z" fill="%s" fill-opacity=".28"/>' % c)
    ell(s, 300, 330, 90, 100, s.glow("#fde68a", "0.8"))
    flame(s, 300, 400, 1.5)
    for x in (222, 261, 300, 339, 378):
        s.add('<path d="M%d 220 L%d 446" stroke="#334155" stroke-width="5"/>' % (x, x))


def popcorn(s, c, pat=None):
    for x, y in [(240, 260), (290, 236), (340, 258), (390, 270), (265, 285), (320, 290), (360, 292), (215, 292)]:
        ell(s, x, y, 34, 30, s.rgrad("#fff6d6"))
    d = "M200 300 L400 300 L368 470 L232 470 Z"
    path(s, d, s.hgrad(c))
    if pat:
        path(s, d, pat)
    ell(s, 300, 300, 100, 14, shade(c, .4))


def sign(s, c):
    s.add('<path d="M220 160 Q300 90 380 160" stroke="#cbd5e1" stroke-width="5" fill="none"/><rect x="156" y="190" width="300" height="190" rx="18" fill="#000" fill-opacity=".3"/><rect x="150" y="180" width="300" height="190" rx="18" fill="%s"/><rect x="170" y="200" width="260" height="150" rx="10" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="4"/><path d="M200 250 H400 M200 290 H360 M200 322 H320" stroke="#fff" stroke-opacity=".85" stroke-width="10" stroke-linecap="round"/>' % s.vgrad(c))


def badges(s, c):
    for x, y, col in [(220, 340, c), (320, 300, "#7dd3fc"), (390, 410, "#f9a8d4"), (260, 440, "#fde68a")]:
        ell(s, x, y, 70, 70, s.rgrad(col))
        ell(s, x, y, 52, 52, "none", 'stroke="#fff" stroke-opacity=".5" stroke-width="4"')
        shine(s, "M%g %g C%g %g %g %g %g %g C%g %g %g %g %g %g Z" % (x - 48, y - 12, x - 40, y - 40, x - 14, y - 56, x + 14, y - 52, x - 14, y - 44, x - 32, y - 28, x - 38, y - 4), .5)


def fan(s, c):
    for i in range(9):
        a = math.radians(-160 + i * 17.5)
        a2 = a + math.radians(17.5)
        s.add('<path d="M300 470 L%g %g L%g %g Z" fill="%s"/>' % (300 + 220 * math.cos(a), 470 + 220 * math.sin(a), 300 + 220 * math.cos(a2), 470 + 220 * math.sin(a2), shade(c, .12 if i % 2 else -.12)))
    ell(s, 300, 470, 18, 18, "#475569")


def bunting(s, c):
    s.add('<path d="M70 150 Q300 330 530 150" stroke="#cbd5e1" stroke-width="4" fill="none"/>')
    cols = [c, "#7dd3fc", "#f8fafc", shade(c, -.2), "#7dd3fc", "#f8fafc"]
    for i in range(6):
        t = (i + .6) / 6.4
        x = 70 + 460 * t
        y = 150 + 180 * math.sin(math.pi * t) * .93
        path(s, "M%g %g L%g %g L%g %g Z" % (x - 34, y - 4, x + 34, y - 4, x, y + 96), s.vgrad(cols[i]))


def sticks(s, c):
    for i, x in enumerate((250, 280, 310, 340, 370)):
        s.add('<path d="M%d 470 L%d 140" stroke="#c9a27e" stroke-width="8" stroke-linecap="round"/>' % (x - 20 + i * 4, x + (i - 2) * 18))
    for x, y in [(240, 170), (300, 140), (360, 170)]:
        ell(s, x, y, 36, 36, s.rgrad(c))
    cyl(s, 300, 410, 470, 74, 18, "#334155", "#475569")


def cases(s, c, pat=None):
    for i, (y, k) in enumerate([(450, 1), (394, .96), (338, .92), (282, .88)]):
        d = "M%g %g L%g %g L%g %g L%g %g Z" % (300 - 70 * k, y - 60, 300 + 70 * k, y - 60, 300 + 100 * k, y, 300 - 100 * k, y)
        path(s, d, s.vgrad(shade(c, -.1 * i)))
        if pat:
            path(s, d, pat)
        ell(s, 300, y - 60, 70 * k, 14 * k, shade(c, .35))


def trinket(s, c):
    cyl(s, 300, 300, 450, 100, 24, "#bfe9ff")
    s.add('<path d="M200 300 L200 450 A100 24 0 0 0 400 450 L400 300 Z" fill="#bfe9ff" fill-opacity=".22" stroke="#e0f2fe" stroke-opacity=".7" stroke-width="3"/>')
    path(s, "M300 420 C240 380 236 330 270 324 C288 321 300 334 300 348 C300 334 312 321 330 324 C364 330 360 380 300 420 Z", s.rgrad(c))


def build(desc):
    u = desc.upper()
    c = accent(desc)
    s = S()
    pat = s.pattern("dots" if ("POLKA" in u or "SPOT" in u) else "stripes" if ("STRIPE" in u or "GINGHAM" in u) else None)
    has = lambda *k: any(re.search(x, u) for x in k)
    if has("HOT WATER BOTTLE"): hotwater(s, c, pat)
    elif has("DINNER CANDLES", "PARTY CANDLES", "CANDLESTICK"): tlight(s, c, True)
    elif has("T-LIGHT", "HOLDER") and not has("POPCORN", "CARD HOLDER"): tlight(s, c)
    elif has("TRINKET POT"): trinket(s, c)
    elif has("DISCO BALL"): ball(s, "#cbd5e1", True)
    elif has("DAISY"): flower(s, c)
    elif has("HEART") and has("HANGING", "DECORATION", "GLITTER", "DOVE", "SWEETHEART") and not has("BRACELET"): heart(s, c)
    elif has("GARLAND", "BUNTING"): bunting(s, c)
    elif has("ANGEL", "BIRD ORNAMENT", "WREATH", "PEARS", "FILIGREE"): ball(s, c)
    elif has(r"\bLIGHTS\b"): lights(s, c)
    elif has("CAKESTAND", "CAKE STAND"): cakestand(s, c)
    elif has("CAKE CASES"): cases(s, c, pat)
    elif has("TUMBLER"): tumbler(s, c)
    elif has(r"\bMUG\b"): mug(s, c, pat)
    elif has("BOWL"): bowl(s, c, pat)
    elif has("MILK BOTTLE"): milkbottle(s, c)
    elif has(r"\bBAG\b"): bag(s, c, pat)
    elif has("MATCHES"): pencils(s, c, True)
    elif has("PENCILS"): pencils(s, c, False, pat)
    elif has("CHALK"): pencils(s, "#e2e8f0", False)
    elif has("TISSUE"): tissue(s, c)
    elif has("KNOB"): knob(s, c)
    elif has("CABINET"): cabinet(s, c, 4 if "WOOD" in u else 3)
    elif has("LETTERS"): letters(s, c, "LOVE" if "LOVE" in u else "NOEL" if "NOEL" in u else "ABCD")
    elif has(r"\bCARDS?\b", "DOMINOES", "SNAP"): cards(s, c)
    elif has("MICE"): mice(s, c)
    elif has("SLATE"): slate(s, c)
    elif has("DOLL"): doll(s, c)
    elif has("UMBRELLA"): umbrella(s, c, pat)
    elif has("BRACELET"): bracelet(s, c)
    elif has(r"\bFAN\b"): fan(s, c)
    elif has("LANTERN"): lantern(s, c)
    elif has("POPCORN"): popcorn(s, c, s.pattern("stripes"))
    elif has(r"\bSIGN\b"): sign(s, c)
    elif has("BADGES"): badges(s, c)
    elif has("INCENSE"): sticks(s, c)
    elif has("STAMP"): stamp(s, c)
    elif has("RIBBON"): spool(s, c)
    elif has("STATIONERY", "JOURNAL", "STICKER", "TAGS", "MANUAL", "SKETCHBOOK"): book(s, c)
    elif has("TOWEL", "GLOVE", "SCARF", "WARMER", "DOORMAT", "PLACEMAT", "COASTER", "COVER", "FELTCRAFT"): cloth(s, c, pat)
    elif has("PLASTERS", "TINS", r"\bBIN\b", "BOX", "SNACK", r"\bPOT\b", "KEY FOB"): box(s, c, pat)
    else: box(s, c, pat, True)
    bg = ('<defs><radialGradient id="bg" cx=".5" cy=".36" r=".85"><stop offset="0" stop-color="#1d4fa8"/><stop offset=".55" stop-color="#0c2252"/><stop offset="1" stop-color="#050d1f"/></radialGradient>'
          '<radialGradient id="gl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#22d3ee" stop-opacity=".28"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient>'
          '<filter id="bl" x="-30%%" y="-100%%" width="160%%" height="300%%"><feGaussianBlur stdDeviation="10"/></filter>%s</defs>' % "".join(s.defs))
    floor = '<rect width="600" height="600" fill="url(#bg)"/><circle cx="300" cy="300" r="250" fill="url(#gl)"/><ellipse cx="300" cy="492" rx="170" ry="24" fill="#000" fill-opacity=".5" filter="url(#bl)"/>'
    label = re.sub(r'[<>&"]', '', desc.title())
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" aria-label="%s">%s%s%s</svg>' % (label, bg, floor, "".join(s.body))


if __name__ == "__main__":
    t = open(os.path.join(ROOT, "data.js"), encoding="utf-8").read()
    data = json.loads(t[t.index("["):t.rindex("]") + 1])
    seen = {}
    for r in data:
        seen.setdefault(str(r["stockcode"]), r["description"].strip())
    for code, desc in seen.items():
        with open(os.path.join(OUT, "%s.svg" % re.sub(r'[^A-Za-z0-9_-]', '_', code)), "w", encoding="utf-8") as f:
            f.write(build(desc))
    print("generated", len(seen), "images")
