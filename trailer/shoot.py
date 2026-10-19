"""Capture frames from trailer_render.html. Usage: python shoot.py preview t1,t2,...  |  python shoot.py video out.mp4"""
import asyncio, base64, subprocess, sys, time
from pathlib import Path
from playwright.async_api import async_playwright
HERE = Path(__file__).parent
async def main():
    mode = sys.argv[1]
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--allow-file-access-from-files"])
        pg = await b.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        await pg.goto("file://" + str(HERE / "trailer_render.html"))
        await pg.wait_for_function("window.trailerReady === true", timeout=60000)
        cdp = await pg.context.new_cdp_session(pg)
        async def grab(i, fmt="jpeg"):
            await pg.evaluate(f"window.renderFrame({i})")
            r = await pg.evaluate("document.getElementById('out').toDataURL('image/jpeg', 0.93)")
            return base64.b64decode(r.split(",", 1)[1])
        if mode == "preview":
            times = [float(x) for x in sys.argv[2].split(",")]
            fps = 30
            out = HERE / "preview"; out.mkdir(exist_ok=True)
            # run frames sequentially from a little before each time so particles and state build up
            for tt in times:
                target = int(round(tt * fps))
                start = max(0, target - 45)
                for i in range(start, target):
                    await pg.evaluate(f"window.renderFrame({i})")
                (out / f"t{tt:06.2f}.jpg").write_bytes(await grab(target))
            print("preview frames:", len(times))
        else:
            dest = sys.argv[2]; fps = 30; n = int(round(__import__('json').load(open(HERE / 'timeline.json'))['duration'] * fps))
            ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg", "-i", "-",
                                   "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-tune", "grain", "-pix_fmt", "yuv420p", "-r", str(fps), dest], stdin=subprocess.PIPE)
            t0 = time.time()
            for i in range(n):
                ff.stdin.write(await grab(i))
                if i % 300 == 0: print(f"frame {i}/{n}  {time.time()-t0:.0f}s", flush=True)
            ff.stdin.close(); ff.wait()
            print("video done", time.time() - t0)
        print("\n".join(errs[:10]) or "no errors")
        await b.close()
asyncio.run(main())
