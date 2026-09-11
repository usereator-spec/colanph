#!/usr/bin/env python3
"""Upload prepared ColanPh portfolio images to Cloudinary.

This script is intentionally separate from the website. It uploads only files
from a prepared folder such as ``cloudinary-ready/`` and never stores Cloudinary
credentials in the repository.

Expected environment variable:
    CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME

Install dependency:
    python -m pip install cloudinary

Typical usage:
    python tools/upload-to-cloudinary.py cloudinary-ready

Dry run (no network calls):
    python tools/upload-to-cloudinary.py cloudinary-ready --dry-run

Public IDs are deterministic and match the website configuration, for example:
    events/events01.webp -> colanph/events/events01
    hero/ritratti fabio-18.webp -> colanph/hero/ritratti-fabio-18

A JSON manifest is written after a successful upload so the uploaded resources
can be audited without exposing API credentials.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Iterable

MAX_BYTES = 10_000_000
SUPPORTED_EXTENSIONS = {".webp", ".jpg", ".jpeg", ".png", ".avif"}
DEFAULT_ROOT_PUBLIC_ID = "colanph"


def slug_segment(value: str) -> str:
    """Create a stable, Cloudinary-safe path segment."""
    value = value.strip().replace(" ", "-")
    value = re.sub(r"[?&#\\%<>+]", "-", value)
    value = re.sub(r"-+", "-", value)
    return value.strip("-/")


def public_id_for(path: Path, source_root: Path, root_public_id: str) -> str:
    relative = path.relative_to(source_root).with_suffix("")
    parts = [slug_segment(p) for p in relative.parts]
    root = "/".join(slug_segment(p) for p in root_public_id.split("/") if p.strip())
    return "/".join([root, *parts])


def iter_images(source_root: Path) -> Iterable[Path]:
    for path in sorted(source_root.rglob("*")):
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS:
            yield path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Upload prepared ColanPh images to Cloudinary using deterministic public IDs."
    )
    parser.add_argument("source", type=Path, help="Prepared image directory, e.g. cloudinary-ready")
    parser.add_argument(
        "--root-public-id",
        default=DEFAULT_ROOT_PUBLIC_ID,
        help=f"Cloudinary public ID prefix (default: {DEFAULT_ROOT_PUBLIC_ID})",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("cloudinary-upload-manifest.json"),
        help="JSON manifest destination",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate files and print public IDs without uploading",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source_root = args.source.expanduser().resolve()

    if not source_root.is_dir():
        print(f"Error: source folder does not exist: {source_root}", file=sys.stderr)
        return 2

    images = list(iter_images(source_root))
    if not images:
        print(f"Error: no supported images found in {source_root}", file=sys.stderr)
        return 2

    over_limit = [p for p in images if p.stat().st_size > MAX_BYTES]
    if over_limit:
        print("Error: these prepared images still exceed 10 MB:", file=sys.stderr)
        for path in over_limit:
            print(f"  - {path.relative_to(source_root)} ({path.stat().st_size / 1_000_000:.2f} MB)", file=sys.stderr)
        print("Run prepare-images-for-cloudinary.py first.", file=sys.stderr)
        return 2

    plan = [
        {
            "local_file": path.relative_to(source_root).as_posix(),
            "public_id": public_id_for(path, source_root, args.root_public_id),
            "bytes": path.stat().st_size,
        }
        for path in images
    ]

    print(f"Images ready: {len(plan)}")
    print(f"Public ID root: {args.root_public_id}")

    if args.dry_run:
        for item in plan:
            print(f"{item['local_file']} -> {item['public_id']}")
        print("Dry run complete: no files uploaded.")
        return 0

    if not os.environ.get("CLOUDINARY_URL"):
        print(
            "Error: CLOUDINARY_URL is not set. Set it in your shell; never commit it to the repository.",
            file=sys.stderr,
        )
        return 2

    try:
        import cloudinary
        import cloudinary.uploader
    except ImportError:
        print(
            "Error: Cloudinary Python SDK not installed. Run: python -m pip install cloudinary",
            file=sys.stderr,
        )
        return 2

    cloudinary.config(secure=True)
    uploaded: list[dict] = []
    failed: list[dict] = []

    for index, (path, item) in enumerate(zip(images, plan), start=1):
        public_id = item["public_id"]
        print(f"[{index:02}/{len(images):02}] Uploading {item['local_file']} -> {public_id}")
        try:
            result = cloudinary.uploader.upload(
                str(path),
                resource_type="image",
                public_id=public_id,
                overwrite=True,
                invalidate=True,
                unique_filename=False,
                use_filename=False,
            )
            uploaded.append(
                {
                    **item,
                    "asset_id": result.get("asset_id"),
                    "version": result.get("version"),
                    "format": result.get("format"),
                    "width": result.get("width"),
                    "height": result.get("height"),
                    "secure_url": result.get("secure_url"),
                }
            )
        except Exception as exc:  # Cloudinary SDK exception classes vary by version.
            failed.append({**item, "error": str(exc)})
            print(f"  FAILED: {exc}", file=sys.stderr)

    manifest = {
        "root_public_id": args.root_public_id,
        "uploaded_count": len(uploaded),
        "failed_count": len(failed),
        "assets": uploaded,
        "failed": failed,
    }
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\nUploaded: {len(uploaded)}")
    print(f"Failed:   {len(failed)}")
    print(f"Manifest: {args.manifest}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
