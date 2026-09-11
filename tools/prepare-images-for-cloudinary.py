#!/usr/bin/env python3
"""Prepare portfolio images for Cloudinary's free-plan image limit.

Approved processing profile:
- max long side: 2560 px
- output: WebP
- quality: 84
- color space: sRGB
- no upscaling
- EXIF stripped from output
- originals never modified
- separate output folder: cloudinary-ready/

Usage:
    python tools/prepare-images-for-cloudinary.py assets/img

Optional custom output folder:
    python tools/prepare-images-for-cloudinary.py assets/img --output cloudinary-ready

Dependency:
    pip install Pillow
"""

from __future__ import annotations

import argparse
import csv
import io
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageCms, ImageOps, UnidentifiedImageError

MAX_LONG_SIDE = 2560
WEBP_QUALITY = 84
CLOUDINARY_IMAGE_LIMIT_BYTES = 10_000_000  # 10 MB, decimal
SUPPORTED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".tif",
    ".tiff",
    ".bmp",
    ".avif",
}


@dataclass
class Result:
    source: str
    output: str
    source_bytes: int
    output_bytes: int | None
    source_size: str
    output_size: str
    resized: str
    status: str
    note: str = ""


def human_mb(size: int | None) -> str:
    if size is None:
        return "-"
    return f"{size / 1_000_000:.2f} MB"


def iter_images(source_root: Path, output_root: Path) -> Iterable[Path]:
    output_resolved = output_root.resolve()
    for path in sorted(source_root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        try:
            # Avoid recursively re-processing the output if it is placed inside source.
            path.resolve().relative_to(output_resolved)
            continue
        except ValueError:
            pass
        yield path


def _has_alpha(image: Image.Image) -> bool:
    return image.mode in {"RGBA", "LA"} or (
        image.mode == "P" and "transparency" in image.info
    )


def to_srgb(image: Image.Image, icc_bytes: bytes | None) -> Image.Image:
    """Convert pixels to sRGB while preserving alpha when present."""
    has_alpha = _has_alpha(image)
    alpha = image.convert("RGBA").getchannel("A") if has_alpha else None

    base = image.convert("RGB")
    if icc_bytes:
        try:
            source_profile = ImageCms.ImageCmsProfile(io.BytesIO(icc_bytes))
            srgb_profile = ImageCms.createProfile("sRGB")
            base = ImageCms.profileToProfile(
                base,
                source_profile,
                srgb_profile,
                outputMode="RGB",
                renderingIntent=ImageCms.Intent.PERCEPTUAL,
            )
        except Exception as exc:
            # Some files contain malformed or unsupported ICC profiles.
            # In that case we keep the decoded RGB values and explicitly save as sRGB.
            print(
                f"Warning: ICC conversion skipped ({exc.__class__.__name__}: {exc})",
                file=sys.stderr,
            )

    if alpha is not None:
        base.putalpha(alpha)
    return base


def resize_no_upscale(image: Image.Image) -> tuple[Image.Image, bool]:
    width, height = image.size
    longest = max(width, height)
    if longest <= MAX_LONG_SIDE:
        return image, False

    scale = MAX_LONG_SIDE / longest
    new_size = (
        max(1, round(width * scale)),
        max(1, round(height * scale)),
    )
    return image.resize(new_size, Image.Resampling.LANCZOS), True


def srgb_icc_bytes() -> bytes:
    profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB"))
    return profile.tobytes()


def process_image(source: Path, source_root: Path, output_root: Path) -> Result:
    relative = source.relative_to(source_root)
    output = output_root / relative.with_suffix(".webp")
    output.parent.mkdir(parents=True, exist_ok=True)

    source_bytes = source.stat().st_size

    try:
        with Image.open(source) as opened:
            source_size = f"{opened.width}x{opened.height}"
            icc_bytes = opened.info.get("icc_profile")
            image = ImageOps.exif_transpose(opened)
            image, resized = resize_no_upscale(image)
            image = to_srgb(image, icc_bytes)
            output_size = f"{image.width}x{image.height}"

            # EXIF is intentionally omitted. The ICC profile is embedded so browsers
            # consistently interpret the output as sRGB.
            image.save(
                output,
                format="WEBP",
                quality=WEBP_QUALITY,
                method=4,
                icc_profile=srgb_icc_bytes(),
                exact=True,
            )

        output_bytes = output.stat().st_size
        if output_bytes > CLOUDINARY_IMAGE_LIMIT_BYTES:
            return Result(
                source=relative.as_posix(),
                output=output.relative_to(output_root).as_posix(),
                source_bytes=source_bytes,
                output_bytes=output_bytes,
                source_size=source_size,
                output_size=output_size,
                resized="yes" if resized else "no",
                status="OVER_LIMIT",
                note=(
                    "Output still exceeds 10 MB. No additional quality reduction was "
                    "applied because quality 84 is the approved setting."
                ),
            )

        return Result(
            source=relative.as_posix(),
            output=output.relative_to(output_root).as_posix(),
            source_bytes=source_bytes,
            output_bytes=output_bytes,
            source_size=source_size,
            output_size=output_size,
            resized="yes" if resized else "no",
            status="OK",
        )

    except (UnidentifiedImageError, OSError, ValueError) as exc:
        return Result(
            source=relative.as_posix(),
            output=output.relative_to(output_root).as_posix(),
            source_bytes=source_bytes,
            output_bytes=None,
            source_size="-",
            output_size="-",
            resized="-",
            status="ERROR",
            note=str(exc),
        )


def print_summary(results: list[Result], source_root: Path, output_root: Path) -> None:
    total_in = sum(r.source_bytes for r in results)
    total_out = sum(r.output_bytes or 0 for r in results)
    ok = sum(r.status == "OK" for r in results)
    over_limit = sum(r.status == "OVER_LIMIT" for r in results)
    errors = sum(r.status == "ERROR" for r in results)
    resized = sum(r.resized == "yes" for r in results)

    print("\n=== Cloudinary preparation summary ===")
    print(f"Source:       {source_root}")
    print(f"Output:       {output_root}")
    print(f"Images found: {len(results)}")
    print(f"Processed OK: {ok}")
    print(f"Resized:      {resized}")
    print(f"Over 10 MB:   {over_limit}")
    print(f"Errors:       {errors}")
    print(f"Input total:  {human_mb(total_in)}")
    print(f"Output total: {human_mb(total_out)}")
    if total_in:
        print(f"Size change:  {(1 - total_out / total_in) * 100:.1f}% smaller")

    print("\nPer-file results:")
    for r in results:
        print(
            f"[{r.status:10}] {r.source} | "
            f"{r.source_size} {human_mb(r.source_bytes)} -> "
            f"{r.output_size} {human_mb(r.output_bytes)} | resized: {r.resized}"
        )
        if r.note:
            print(f"             {r.note}")


def write_csv_report(results: list[Result], report_path: Path) -> None:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with report_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "source",
                "output",
                "source_size_bytes",
                "output_size_bytes",
                "source_dimensions",
                "output_dimensions",
                "resized",
                "status",
                "note",
            ]
        )
        for r in results:
            writer.writerow(
                [
                    r.source,
                    r.output,
                    r.source_bytes,
                    r.output_bytes if r.output_bytes is not None else "",
                    r.source_size,
                    r.output_size,
                    r.resized,
                    r.status,
                    r.note,
                ]
            )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Create Cloudinary-ready WebP copies: max 2560 px long side, quality 84, "
            "sRGB, no upscaling, EXIF stripped, originals preserved."
        )
    )
    parser.add_argument(
        "source",
        type=Path,
        help="Folder containing the original images (for example assets/img)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("cloudinary-ready"),
        help="Output folder (default: ./cloudinary-ready)",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=Path("cloudinary-ready-report.csv"),
        help="CSV report path (default: ./cloudinary-ready-report.csv)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source_root = args.source.expanduser().resolve()
    output_root = args.output.expanduser().resolve()
    report_path = args.report.expanduser().resolve()

    if not source_root.is_dir():
        print(f"Error: source folder does not exist: {source_root}", file=sys.stderr)
        return 1

    if source_root == output_root:
        print("Error: source and output folders must be different.", file=sys.stderr)
        return 1

    images = list(iter_images(source_root, output_root))
    if not images:
        print(f"No supported images found in: {source_root}")
        return 0

    output_root.mkdir(parents=True, exist_ok=True)

    results: list[Result] = []
    for index, source in enumerate(images, start=1):
        print(f"[{index}/{len(images)}] {source.relative_to(source_root)}")
        results.append(process_image(source, source_root, output_root))

    write_csv_report(results, report_path)
    print_summary(results, source_root, output_root)
    print(f"\nCSV report:   {report_path}")

    if any(r.status in {"ERROR", "OVER_LIMIT"} for r in results):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
