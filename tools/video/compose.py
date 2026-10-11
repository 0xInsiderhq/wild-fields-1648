# v1 over v3, both doubled to 30 fps by optical flow, labels, 1080x1920 H.264 for X
import subprocess, os, sys, cv2, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from interp import Interp
from PIL import Image, ImageDraw, ImageFont
A, B = 'frames_v1', 'frames_v3'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'v1_vs_v3.mp4'
W, H, HALF, GAP = 1080, 1920, 952, 16
load = lambda d: [cv2.imread(f'{d}/{f}') for f in sorted(os.listdir(d)) if f.endswith('.jpg')]
fa, fb = load(A), load(B); n = min(len(fa), len(fb)); fa, fb = fa[:n], fb[:n]
ia, ib = Interp(fa), Interp(fb)
F1 = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-Bold.otf', 54); F2 = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-SemiBold.otf', 30)
def badge(d, x, y, big, small, accent):
    bw = int(max(d.textlength(big, font=F1), d.textlength(small, font=F2)) + 48)
    d.rounded_rectangle((x, y, x + bw, y + 118), 18, fill=(12, 10, 9, 205))
    d.rectangle((x, y + 18, x + 6, y + 100), fill=accent)
    d.text((x + 26, y + 10), big, font=F1, fill=(255, 255, 255, 255))
    d.text((x + 26, y + 72), small, font=F2, fill=(225, 214, 190, 255))
ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
badge(d, 32, 32, 'v1', 'Opus 5.5, first build', (150, 150, 150, 255))
badge(d, 32, HALF + GAP + 32, 'v3', 'Opus 5.5 + 25 Poly Haven scans', (214, 160, 60, 255))
ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', '30', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT], stdin=subprocess.PIPE)
def half(ip, t):
    im = np.clip(ip.at(t) * 255 + 0.5, 0, 255).astype(np.uint8)
    im = cv2.resize(im, (W, HALF), interpolation=cv2.INTER_LANCZOS4)
    return cv2.cvtColor(im, cv2.COLOR_BGR2RGB)
steps = (n - 1) * 2 + 1
for j in range(steps):
    t = j / 2
    canvas = np.full((H, W, 3), (14, 12, 10), np.uint8)
    canvas[:HALF] = half(ia, t); canvas[HALF + GAP:HALF + GAP + HALF] = half(ib, t)
    img = Image.alpha_composite(Image.fromarray(canvas).convert('RGBA'), ov).convert('RGB')
    ff.stdin.write(img.tobytes())
ff.stdin.close(); ff.wait()
print('frames', steps, OUT)
