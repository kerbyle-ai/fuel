#!/usr/bin/env python3
"""Generate PWA icons from toplivo avatar."""
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Install Pillow: pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(r"C:\Users\user\.cursor\projects\c-Users-user-cursor\assets\toplivo-boosty-avatar.png")
OUT = ROOT / "frontend" / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

img = Image.open(SRC).convert("RGBA")
for size in (192, 512):
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(OUT / f"icon-{size}.png", "PNG")
    print(f"Wrote {OUT / f'icon-{size}.png'}")
