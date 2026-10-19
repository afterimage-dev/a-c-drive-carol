"""Build the trailer pages.

    python build.py render   -> trailer_render.html (local PixiJS, no audio) for frame capture
    python build.py live     -> trailer.html (PixiJS from jsDelivr, soundtrack embedded) for the player artifact
"""
import base64
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
SPRITES = HERE.parent / "assets" / "sprites"
FS = HERE / "node_modules" / "@fontsource"
PIXI_LOCAL = "file://" + str(HERE / "node_modules" / "pixi.js" / "dist" / "pixi.min.js")
PIXI_CDN = "https://cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.min.js"
LIB = HERE.parent / "prototypes" / "phosphor" / "spirits-phosphor.js"


def b64(path, mime):
    return f"data:{mime};base64," + base64.b64encode(Path(path).read_bytes()).decode()


def assets():
    a = {}
    for k in ["marl_glow", "past_glow", "present_glow", "yet_glow", "stone", "link", "edge"]:
        a[k] = b64(SPRITES / f"{k}.webp", "image/webp")
    for k in ["marl", "past", "present", "yet"]:
        for part in ["body", "head", "normal"]:
            a[f"{k}_{part}"] = b64(SPRITES / "layers" / f"{k}_{part}.webp", "image/webp")
    for k in ["marl", "past", "present", "yet"]:
        a[f"{k}_spawn"] = json.loads((SPRITES / f"{k}_spawn.json").read_text())
    return a


def fonts():
    spec = [
        ("Fell", "im-fell-english", "400", "normal"), ("Fell", "im-fell-english", "400", "italic"),
        ("Cinzel", "cinzel", "700", "normal"), ("Cormorant", "cormorant-garamond", "300", "italic"),
        ("Abril", "abril-fatface", "400", "normal"), ("JBMono", "jetbrains-mono", "400", "normal"),
        ("JBMono", "jetbrains-mono", "600", "normal"), ("Plex", "ibm-plex-mono", "300", "normal"),
        ("Atkinson", "atkinson-hyperlegible", "400", "normal"), ("Atkinson", "atkinson-hyperlegible", "400", "italic"),
    ]
    out = []
    for fam, pkg, w, st in spec:
        f = FS / pkg / "files" / f"{pkg}-latin-{w}-{st}.woff2"
        out.append({"family": fam, "weight": w, "style": st, "src": b64(f, "font/woff2")})
    return out


def build(mode):
    src = (HERE / "trailer.src.html").read_text(encoding="utf-8")
    audio = ""
    if mode == "live" and (HERE / "soundtrack.mp3").exists():
        audio = b64(HERE / "soundtrack.mp3", "audio/mpeg")
    html = (src.replace("__MODE__", mode)
               .replace("__PIXI__", PIXI_LOCAL if mode == "render" else PIXI_CDN)
               .replace("__TIMELINE__", (HERE / "timeline.json").read_text())
               .replace("__ASSETS__", json.dumps(assets()))
               .replace("__FONTS__", json.dumps(fonts()))
               .replace("__AUDIO__", audio)
               .replace("__LIB__", LIB.read_text(encoding="utf-8")))
    name = "trailer_render.html" if mode == "render" else "trailer.html"
    if mode == "render":
        html = '<meta charset="utf-8">' + html
    (HERE / name).write_text(html, encoding="utf-8")
    print(name, len(html) // 1024, "KB")


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "render")
