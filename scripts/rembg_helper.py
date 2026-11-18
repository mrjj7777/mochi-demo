"""Transparent cutout generator for MOCHI packshots and stand.

Sources remain strictly read-only. Uses rembg (birefnet-general with fallback to
isnet-general-use / u2net) plus edge decontamination so translucent silicone
tubes and milky caps sit cleanly on both cream (#F2EDE4) and dark backgrounds.

Usage:
  python scripts/rembg_helper.py SOURCE TARGET [--max-height 1600]
  python scripts/rembg_helper.py --batch jobs.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

try:
    from rembg import new_session, remove
except ImportError:
    print("rembg not installed; skipping cutout generation.", file=sys.stderr)
    raise SystemExit(1)


MODEL_PRIORITY = ("birefnet-general", "isnet-general-use", "u2net")


def create_session(preferred: str | None = None):
    candidates = [preferred] if preferred else []
    for name in MODEL_PRIORITY:
        if name not in candidates:
            candidates.append(name)

    last_err: Exception | None = None
    for model_name in candidates:
        try:
            return new_session(model_name), model_name
        except Exception as exc:  # pragma: no cover - fallback chain
            last_err = exc
    raise RuntimeError(f"Unable to load any rembg session: {last_err}")


def refine_rgba_matte(image: Image.Image) -> Image.Image:
    """Clean stray alpha noise and decontaminate studio fringe on semi-transparent edges."""
    arr = np.array(image.convert("RGBA"), dtype=np.uint8)
    alpha = arr[:, :, 3].copy()

    # Clamp near-zero dust and solid interior
    alpha[alpha < 10] = 0
    alpha[alpha > 250] = 255
    # Guarantee outer border corners stay 100% transparent
    alpha[:2, :] = 0
    alpha[-2:, :] = 0
    alpha[:, :2] = 0
    alpha[:, -2:] = 0

    rgb = arr[:, :, :3].astype(np.float32)
    solid_mask = alpha >= 232
    semi_mask = (alpha > 0) & (alpha < 232)

    if np.any(solid_mask) and np.any(semi_mask):
        # Propagate nearby solid interior RGB outward across a few pixels to remove studio grey fringe
        filled_rgb = rgb.copy()
        filled_mask = solid_mask.copy()
        h, w = alpha.shape
        for _ in range(5):
            need = ~filled_mask
            if not np.any(need):
                break
            accum = np.zeros((h, w, 3), dtype=np.float32)
            count = np.zeros((h, w), dtype=np.float32)
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
                sy0 = max(0, -dy)
                sy1 = h - max(0, dy)
                ty0 = max(0, dy)
                ty1 = h - max(0, -dy)
                sx0 = max(0, -dx)
                sx1 = w - max(0, dx)
                tx0 = max(0, dx)
                tx1 = w - max(0, -dx)
                m = filled_mask[sy0:sy1, sx0:sx1]
                accum[ty0:ty1, tx0:tx1][m] += filled_rgb[sy0:sy1, sx0:sx1][m]
                count[ty0:ty1, tx0:tx1][m] += 1.0
            update = need & (count > 0)
            if not np.any(update):
                break
            filled_rgb[update] = accum[update] / count[update, None]
            filled_mask[update] = True

        # Blend semi-transparent fringe pixels toward clean interior colour
        blend = ((232.0 - alpha[semi_mask].astype(np.float32)) / 232.0) * 0.78
        rgb[semi_mask] = rgb[semi_mask] * (1.0 - blend[:, None]) + filled_rgb[semi_mask] * blend[:, None]

    out = np.empty_like(arr)
    out[:, :, :3] = np.clip(np.round(rgb), 0, 255).astype(np.uint8)
    out[:, :, 3] = alpha
    return Image.fromarray(out, mode="RGBA")


def process_one(session, source: Path, target: Path, max_height: int = 1600, webp_target: Path | None = None):
    if not source.exists():
        raise FileNotFoundError(f"Source file not found: {source}")
    with Image.open(source) as src_im:
        rgba = src_im.convert("RGBA")
        cutout = remove(rgba, session=session)
    cleaned = refine_rgba_matte(cutout)
    if max_height > 0 and cleaned.height > max_height:
        new_w = max(1, round(cleaned.width * (max_height / cleaned.height)))
        cleaned = cleaned.resize((new_w, max_height), Image.Resampling.LANCZOS)

    target.parent.mkdir(parents=True, exist_ok=True)
    cleaned.save(target, format="PNG", optimize=True)
    if webp_target is not None:
        webp_target.parent.mkdir(parents=True, exist_ok=True)
        cleaned.save(webp_target, format="WEBP", quality=92, method=6)
    arr = np.array(cleaned)
    corners = [int(arr[0, 0, 3]), int(arr[0, -1, 3]), int(arr[-1, 0, 3]), int(arr[-1, -1, 3])]
    return {"source": str(source), "target": str(target), "width": cleaned.width, "height": cleaned.height, "cornersAlpha": corners}


def main():
    parser = argparse.ArgumentParser(description="MOCHI transparent cutout generator")
    parser.add_argument("source", nargs="?", help="Source PNG path")
    parser.add_argument("target", nargs="?", help="Target PNG path")
    parser.add_argument("--webp", dest="webp_target", default=None, help="Optional WebP output path")
    parser.add_argument("--max-height", type=int, default=1600)
    parser.add_argument("--model", default=None)
    parser.add_argument("--batch", default=None, help="JSON file with list of {source, target, webp, maxHeight}")
    args = parser.parse_args()

    session, model_name = create_session(args.model)

    if args.batch:
        jobs = json.loads(Path(args.batch).read_text(encoding="utf-8"))
        results = []
        for job in jobs:
            res = process_one(
                session,
                Path(job["source"]),
                Path(job["target"]),
                max_height=int(job.get("maxHeight", args.max_height)),
                webp_target=Path(job["webp"]) if job.get("webp") else None,
            )
            res["model"] = model_name
            results.append(res)
            print(f"[rembg:{model_name}] {res['target']} ({res['width']}x{res['height']}) corners={res['cornersAlpha']}")
        return

    if not args.source or not args.target:
        parser.print_help()
        raise SystemExit(2)

    res = process_one(
        session,
        Path(args.source),
        Path(args.target),
        max_height=args.max_height,
        webp_target=Path(args.webp_target) if args.webp_target else None,
    )
    print(f"[rembg:{model_name}] {res['target']} ({res['width']}x{res['height']}) corners={res['cornersAlpha']}")


if __name__ == "__main__":
    main()
