"""Split each spirit into a head layer and a body layer, and make a normal map, for the phosphor renderer.

    python tools/prepare_layers.py        (run tools/prepare_sprites.py first)

For each of marl, past, present, yet it writes assets/sprites/layers/:
  <key>_head.webp    just the head, with a soft edge at the neck, full image size
  <key>_body.webp    everything else; the middle of the head is inpainted so a slightly turned head reveals no double
  <key>_normal.webp  a normal map: an "inflated" silhouette for overall roundness plus relief from the drawing's shading

Both layers are full image size so they share the landmarks in assets/landmarks.json and the one normal map.
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SPR = ROOT / "assets" / "sprites"
OUT = SPR / "layers"

# Where each head ends: a cut line just below the neck pivot, an optional horizontal window, and the feather width.
HEADS = {
    "marl":    {"src": "marl_body.webp",    "cut": 285, "x": None,       "feather": 22},
    "past":    {"src": "past_body.webp",    "cut": 252, "x": None,       "feather": 22},
    "present": {"src": "present_body.webp", "cut": 262, "x": (175, 9e9), "feather": 22},
    "yet":     {"src": "yet_body.webp",     "cut": 208, "x": (165, 385), "feather": 26},
}


def smooth(a, b, x):
    k = np.clip((x - a) / (b - a), 0, 1)
    return k * k * (3 - 2 * k)


def head_mask(h, w, spec):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    f = spec["feather"]
    m = 1 - smooth(spec["cut"] - f / 2, spec["cut"] + f / 2, yy)
    if spec["x"]:
        x0, x1 = spec["x"]
        m *= smooth(x0 - f / 2, x0 + f / 2, xx) * (1 - smooth(x1 - f / 2, x1 + f / 2, xx))
    return m


def normal_map(alpha, lum):
    solid = (alpha > 0.2).astype(np.uint8)
    d = cv2.distanceTransform(solid, cv2.DIST_L2, 5)
    d = d / (d.max() + 1e-6)
    height = np.sqrt(d)                                      # an inflated, rounded silhouette
    height = cv2.GaussianBlur(height, (0, 0), 6)
    height += 0.22 * cv2.GaussianBlur(lum, (0, 0), 1.6)      # the drawing's own shading as surface relief
    gx = cv2.Sobel(height, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(height, cv2.CV_32F, 0, 1, ksize=3)
    s = 9.0
    n = np.dstack([-gx * s, -gy * s, np.ones_like(height)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    rgb = ((n * 0.5 + 0.5) * 255).astype(np.uint8)
    return np.dstack([rgb, (solid * 255).astype(np.uint8)])


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for key, spec in HEADS.items():
        im = np.asarray(Image.open(SPR / spec["src"]).convert("RGBA")).astype(np.float32) / 255
        h, w = im.shape[:2]
        rgb, a = im[..., :3], im[..., 3]
        # deepen the drawing's lines (unsharp mask) so faces survive the monitor's coarse pixels
        if key != "yet":
            soft = cv2.GaussianBlur(rgb, (0, 0), 2.6)
            rgb = np.clip(rgb + 1.6 * (rgb - soft), 0, 1)
            lines = cv2.GaussianBlur(rgb, (0, 0), 1.2).mean(2)
            rgb = np.clip(rgb * (0.55 + 0.45 * np.clip(lines * 1.3, 0, 1))[..., None], 0, 1)
        m = head_mask(h, w, spec)
        head = np.dstack([rgb, a * m])
        # body: inpaint the core of the head (eroded, so turned heads still cover the edge) and fade nothing else
        # only inside the head's filled silhouette, never the empty space around it
        solid = cv2.morphologyEx((a > 0.08).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
        ff = solid.copy(); cv2.floodFill(ff, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 1)
        solid = solid | (1 - ff)
        core = ((m > 0.6) & (solid > 0)).astype(np.uint8)
        core = cv2.erode(core, np.ones((3, 3), np.uint8), iterations=14) * 255
        pm = (np.clip(rgb * a[..., None], 0, 1) * 255).astype(np.uint8)
        pm_in = cv2.inpaint(pm, core, 9, cv2.INPAINT_TELEA).astype(np.float32) / 255
        a_in = cv2.inpaint((a * 255).astype(np.uint8), core, 9, cv2.INPAINT_TELEA).astype(np.float32) / 255
        body_rgb = np.where(a_in[..., None] > 1e-3, pm_in / np.maximum(a_in[..., None], 1e-3), 0)
        body = np.dstack([np.clip(body_rgb, 0, 1), a_in])
        Image.fromarray((head * 255).astype(np.uint8), "RGBA").save(OUT / f"{key}_head.webp", quality=92, method=6)
        Image.fromarray((body * 255).astype(np.uint8), "RGBA").save(OUT / f"{key}_body.webp", quality=92, method=6)
        lum = (0.3 * rgb[..., 0] + 0.59 * rgb[..., 1] + 0.11 * rgb[..., 2]) * a
        Image.fromarray(normal_map(a, lum), "RGBA").save(OUT / f"{key}_normal.webp", quality=90, method=6)
        print(key, w, h)
    # the gravestone gets a normal map too, so the spirits' light falls across it
    st = np.asarray(Image.open(SPR / "stone.webp").convert("RGBA")).astype(np.float32) / 255
    lum = (0.3 * st[..., 0] + 0.59 * st[..., 1] + 0.11 * st[..., 2]) * st[..., 3]
    Image.fromarray(normal_map(st[..., 3], lum), "RGBA").save(OUT / "stone_normal.webp", quality=90, method=6)


if __name__ == "__main__":
    main()
