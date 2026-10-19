"""Rebuild every sprite in assets/sprites from the original art in assets/originals.

    pip install -r tools/requirements.txt
    python tools/prepare_sprites.py            # writes assets/sprites/*
    python tools/prepare_sprites.py --grid     # also writes grid overlays to assets/sprites/_grids/ for measuring landmarks

Steps, per character:
  1. Cut out: glowing art on black becomes transparent by brightness (see glow_cutout.py), so the glow fades
     smoothly instead of being chopped. The hooded spirit and the gravestone are mostly dark, so they use a
     "solid" cut-out instead: anything not near-black stays opaque.
  2. Paint out the eyes (the glowing ghosts only), so the app can draw live eyes that track, blink and flare.
     The original with eyes is kept too (*_orig.webp) for the "still image" comparison.
  3. Make a glow layer: a blurred, padded silhouette (70 px padding, 26 px blur, half resolution). The app tints it.
  4. Pick 400 particle spawn points from the dissolving lower part of the body.

Landmarks (eyes, mouth, neck, hands...) live in assets/landmarks.json. They match these exact crops.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from glow_cutout import cutout  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
ORIG = ROOT / "assets" / "originals"
OUT = ROOT / "assets" / "sprites"
TMP = OUT / "_tmp"


def crop_offset(src):
    """Where glow_cutout's crop starts in the original image (needed to paint eyes in original coordinates)."""
    rgb = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
    a = np.clip((rgb.max(2) - 14) / 241, 0, 1)
    ys, xs = np.where(a > 0.03)
    return max(xs.min() - 6, 0), max(ys.min() - 6, 0)


def paint_out_eyes(src, eyes, paint_radius, lum_threshold):
    """Inpaint the bright eye glow on the original (black background) image, then cut it out the same way."""
    ox, oy = crop_offset(src)
    img = np.asarray(Image.open(src).convert("RGB")).copy()
    lum = img.mean(2)
    mask = np.zeros(img.shape[:2], np.uint8)
    yy, xx = np.ogrid[: img.shape[0], : img.shape[1]]
    rx, ry = paint_radius
    for ex, ey in eyes:
        ell = ((xx - ex - ox) / rx) ** 2 + ((yy - ey - oy) / ry) ** 2 <= 1
        mask[ell & (lum > lum_threshold)] = 255
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=2)
    painted = cv2.inpaint(img, mask, 7, cv2.INPAINT_TELEA)
    TMP.mkdir(parents=True, exist_ok=True)
    tmp = TMP / "painted.jpg"
    Image.fromarray(painted).save(tmp, quality=97)
    return cutout(str(tmp), None)


def solid_cutout(src, lo=8, ramp=26, pad=6):
    """For dark art: anything brighter than near-black stays opaque, so a black robe doesn't turn see-through."""
    rgb = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
    a = np.clip((rgb.max(2) - lo) / ramp, 0, 1)
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
    ys, xs = np.where(a > 0.05)
    box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad, rgb.shape[1]), min(ys.max() + pad, rgb.shape[0]))
    return Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8), "RGBA").crop(box)


def glow_layer(body, name):
    a = np.asarray(body)[..., 3].astype(np.float32) / 255
    pad = 70
    padded = np.zeros((a.shape[0] + 2 * pad, a.shape[1] + 2 * pad), np.float32)
    padded[pad:-pad, pad:-pad] = a
    blur = Image.fromarray((padded * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(26))
    blur = blur.resize((blur.width // 2, blur.height // 2), Image.LANCZOS)
    g = np.asarray(blur).astype(np.float32) / 255
    white = np.full_like(g, 255)
    Image.fromarray(np.dstack([white, white, white, np.clip(g * 1.3, 0, 1) * 255]).astype(np.uint8), "RGBA") \
        .save(OUT / f"{name}_glow.webp", quality=85, method=6)


def spawn_points(body, name, start=0.7, seed=7):
    a = np.asarray(body)[..., 3].astype(np.float32) / 255
    h, w = a.shape
    rng = np.random.default_rng(seed)
    cand = np.argwhere((a > 0.25) & (np.arange(h)[:, None] > h * start))
    pick = cand[rng.choice(len(cand), min(400, len(cand)), replace=False)]
    (OUT / f"{name}_spawn.json").write_text(json.dumps([[round(x / w, 3), round(y / h, 3)] for y, x in pick]))


def save(img, name, quality=90):
    img.save(OUT / f"{name}.webp", quality=quality, method=6)


def grid(img, name):
    d = OUT / "_grids"
    d.mkdir(exist_ok=True)
    bg = Image.new("RGBA", img.size, (60, 40, 80, 255))
    bg.alpha_composite(img.convert("RGBA"))
    draw = ImageDraw.Draw(bg)
    for x in range(0, img.width, 25):
        draw.line([(x, 0), (x, img.height)], fill=(255, 80, 80, 140 if x % 100 == 0 else 60))
    for y in range(0, img.height, 25):
        draw.line([(0, y), (img.width, y)], fill=(255, 80, 80, 140 if y % 100 == 0 else 60))
    bg.convert("RGB").save(d / f"{name}_grid.png")


def main(with_grid=False):
    OUT.mkdir(parents=True, exist_ok=True)
    marks = json.loads((ROOT / "assets" / "landmarks.json").read_text())

    # Chain parts and the chain-demo Marlware
    for src, name, h in [("chain-link-face.jpg", "link", 160), ("chain-link-edge.jpg", "edge", 160), ("padlock-folder.jpg", "padlock", 150), ("marlware.jpg", "marlware", 520)]:
        img = cutout(str(ORIG / src), h)
        save(img, name)
        img.save(OUT / f"{name}.png")

    # The three glowing spirits: original, eyes painted out, glow, particles
    for key, src, name, lum, spawn_start, seed in [
        ("marlware", "marlware.jpg", "marl", 150, 0.72, 3),
        ("past", "past.jpg", "past", 140, 0.7, 7),
        ("present", "present.jpg", "present", 140, 0.7, 7),
    ]:
        m = marks[key]
        orig = cutout(str(ORIG / src), None)
        body = paint_out_eyes(str(ORIG / src), m["eyes"], m["eyePaintRadius"], lum)
        assert body.size == orig.size == tuple(m["size"]), f"{key}: crop changed to {body.size}; re-measure landmarks"
        save(orig, f"{name}_orig", 92)
        save(body, f"{name}_body", 92)
        glow_layer(body, name)
        spawn_points(body, name, spawn_start, seed)
        if with_grid:
            grid(body, name)

    # The hooded spirit and the gravestone: solid cut-outs
    yet = solid_cutout(ORIG / "yet-to-come.jpg")
    save(yet, "yet_body")
    glow_layer(yet, "yet")
    spawn_points(yet, "yet")
    stone = solid_cutout(ORIG / "gravestone.jpg")
    stone = stone.resize((stone.width * 2 // 3, stone.height * 2 // 3), Image.LANCZOS)
    save(stone, "stone")
    if with_grid:
        grid(yet, "yet")
        grid(stone, "stone")
    print("Sprites written to", OUT)


if __name__ == "__main__":
    main("--grid" in sys.argv)
