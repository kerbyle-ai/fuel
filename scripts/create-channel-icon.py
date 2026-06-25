#!/usr/bin/env python3
"""Create 512x512 channel icon from fuel-map brand SVG design."""
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    raise SystemExit("Install Pillow: pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
OUT_PATHS = [
    ROOT / "marketing" / "assets" / "bot-profile-512.png",
    Path(r"C:\Users\user\.cursor\projects\c-Users-user-cursor\assets\icon-512.png"),
    ROOT / "frontend" / "public" / "icons" / "icon-512.png",
]

SIZE = 512
BG = "#1a5f2a"
ACCENT = "#4ade80"

img = Image.new("RGBA", (SIZE, SIZE), BG)
draw = ImageDraw.Draw(img)

# Rounded rect background (rx=96 on 512 canvas)
radius = 96
draw.rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=radius, fill=BG)

# Simplified fuel pump silhouette (white), scaled from SVG path bbox
white = "#ffffff"
cx, cy = SIZE // 2, SIZE // 2
# Body
draw.rounded_rectangle((cx - 72, cy - 120, cx + 72, cy + 88), radius=24, fill=white)
# Nozzle neck
draw.rectangle((cx - 28, cy - 168, cx + 28, cy - 120), fill=white)
# Top cap
draw.ellipse((cx - 52, cy - 204, cx + 52, cy - 148), fill=white)
# Status dot
dot_r = 36
draw.ellipse((cx - dot_r, cy + 52 - dot_r, cx + dot_r, cy + 52 + dot_r), fill=ACCENT)

for out in OUT_PATHS:
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG")
    print(f"Wrote {out}")
