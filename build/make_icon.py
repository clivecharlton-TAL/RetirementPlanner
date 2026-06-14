"""
RetirementPlanner icon — warm cream background, terracotta growth chart, golden sun.
Concept: Wealth growing toward the golden horizon of retirement.
"""
from PIL import Image, ImageDraw, ImageFilter
import os

SIZE = 1024
SCALE = 2
W, H = SIZE * SCALE, SIZE * SCALE

# Design system colours
BG_TOP    = (252, 248, 242)    # warm cream top
BG_BOT    = (235, 228, 215)    # slightly deeper cream bottom
NAVY      = (26, 26, 46)       # #1a1a2e for curve line
TERRACOTA = (196, 93, 46)      # #c45d2e
TERRA_LT  = (215, 118, 72)     # lighter terracotta
GOLD      = (208, 162, 48)     # warm gold
GOLD_LT   = (232, 196, 100)    # lighter gold glow
CREAM_LN  = (245, 236, 218)    # cream for line on dark mode version

def bezier(P0, P1, P2, P3, t):
    mt = 1 - t
    x = mt**3*P0[0] + 3*mt**2*t*P1[0] + 3*mt*t**2*P2[0] + t**3*P3[0]
    y = mt**3*P0[1] + 3*mt**2*t*P1[1] + 3*mt*t**2*P2[1] + t**3*P3[1]
    return (int(x), int(y))

# ----- canvas -----
img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# ----- background: warm gradient cream -----
# Build gradient on a separate layer then clip to rounded rect
grad = Image.new('RGBA', (W, H), BG_TOP + (255,))
gd   = ImageDraw.Draw(grad)
for y in range(H):
    ratio = y / H
    r = int(BG_TOP[0] + (BG_BOT[0]-BG_TOP[0])*ratio)
    g = int(BG_TOP[1] + (BG_BOT[1]-BG_TOP[1])*ratio)
    b = int(BG_TOP[2] + (BG_BOT[2]-BG_TOP[2])*ratio)
    gd.line([(0, y), (W, y)], fill=(r, g, b, 255))

# rounded-rect mask
RADIUS = 210 * SCALE
mask = Image.new('L', (W, H), 0)
Image.Draw = ImageDraw.Draw   # alias
mask_draw = ImageDraw.Draw(mask)
mask_draw.rounded_rectangle([0, 0, W-1, H-1], radius=RADIUS, fill=255)

# paste gradient onto transparent canvas using mask
img.paste(grad, (0, 0), mask)
draw = ImageDraw.Draw(img)

# ----- subtle inner shadow at top edge -----
shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
for i in range(60):
    alpha = int(18 * (1 - i/60))
    sd.rounded_rectangle([i, i, W-1-i, H-1-i], radius=max(0, RADIUS-i), outline=(180, 170, 155, alpha), width=1)
img = Image.alpha_composite(img, shadow)
draw = ImageDraw.Draw(img)

# ----- bezier curve: exponential growth shape -----
P0 = (95*SCALE,  895*SCALE)
P1 = (240*SCALE, 895*SCALE)
P2 = (560*SCALE, 340*SCALE)
P3 = (870*SCALE, 180*SCALE)

N = 400
curve = [bezier(P0, P1, P2, P3, i/N) for i in range(N+1)]

# ----- filled area below curve (terracotta) -----
area_poly = curve + [(P3[0]+2, 960*SCALE), (P0[0]-2, 960*SCALE)]
draw.polygon(area_poly, fill=TERRACOTA)

# ----- lighter terracotta band along the top of the area -----
band_h = 22 * SCALE
for i in range(len(curve)-1):
    x0, y0 = curve[i]
    x1, y1 = curve[i+1]
    pts = [(x0, y0), (x1, y1), (x1, y1+band_h), (x0, y0+band_h)]
    draw.polygon(pts, fill=TERRA_LT)

# ----- sun glow layers at curve endpoint -----
sx, sy = P3
for r_mult, alpha in [(1.7, 35), (1.35, 70), (1.0, 200)]:
    sun_r = int(80 * SCALE * r_mult)
    col = GOLD_LT if r_mult > 1.0 else GOLD
    draw.ellipse([sx-sun_r, sy-sun_r, sx+sun_r, sy+sun_r], fill=(*col, alpha))

# solid gold sun
sun_r = int(80 * SCALE)
draw.ellipse([sx-sun_r, sy-sun_r, sx+sun_r, sy+sun_r], fill=GOLD)

# specular highlight inside sun
hl_r = int(28*SCALE)
hl_ox, hl_oy = int(-22*SCALE), int(-22*SCALE)
draw.ellipse([sx+hl_ox-hl_r, sy+hl_oy-hl_r,
              sx+hl_ox+hl_r, sy+hl_oy+hl_r], fill=(252, 235, 175, 180))

# ----- growth line (dark navy, drawn over area and sun glow) -----
line_w = int(8 * SCALE)
for i in range(len(curve)-1):
    draw.line([curve[i], curve[i+1]], fill=NAVY, width=line_w)

# ----- milestone dots on the line -----
for frac in [0.22, 0.48, 0.73]:
    px, py = bezier(P0, P1, P2, P3, frac)
    dr = int(11 * SCALE)
    draw.ellipse([px-dr, py-dr, px+dr, py+dr], fill=BG_TOP)  # cream ring
    dr2 = int(6 * SCALE)
    draw.ellipse([px-dr2, py-dr2, px+dr2, py+dr2], fill=NAVY)  # navy core

# ----- soft gaussian glow behind the sun -----
glow_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
gl = ImageDraw.Draw(glow_layer)
gr = int(130 * SCALE)
gl.ellipse([sx-gr, sy-gr, sx+gr, sy+gr], fill=(*GOLD_LT, 80))
glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=28*SCALE))
img = Image.alpha_composite(img, glow_layer)

# ----- final downscale -----
img = img.resize((SIZE, SIZE), Image.LANCZOS)

out = os.path.join(os.path.dirname(__file__), 'icon_1024.png')
img.save(out)
print(f'Saved {out}')
