#!/usr/bin/env python3
"""
Genie Bath & Kitchen — Build & Asset Integrity Verification Script
Checks that all referenced assets, frames, videos, swatches, and fonts exist and are valid.
"""

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_DIR = ROOT / "site"

def check_file(rel_path, required=True):
    p = SITE_DIR / rel_path
    exists = p.is_file()
    size = p.stat().st_size if exists else 0
    return exists, size, str(p)

def run_verification():
    print("=" * 60)
    print("Genie Bath & Kitchen — Asset & Build Integrity Verification")
    print("=" * 60)
    
    if not SITE_DIR.is_dir():
        print(f"[-] ERROR: site directory not found at {SITE_DIR}")
        sys.exit(1)

    index_html = SITE_DIR / "index.html"
    if not index_html.is_file():
        print(f"[-] ERROR: index.html not found in {SITE_DIR}")
        sys.exit(1)

    html_content = index_html.read_text(encoding="utf-8")
    
    errors = []
    warnings = []
    
    # 1. Check Core Files
    core_files = [
        "index.html",
        "favicon.png",
        "assets/css/main.css",
        "assets/js/main.js",
        "assets/js/gsap.min.js",
        "assets/js/ScrollTrigger.min.js",
        "assets/fonts/fonts.css",
        "assets/img/exploded-hero.png",
        "assets/img/hero-portrait-poster.jpg",
        "assets/img/logo-dark.png",
        "assets/img/logo-light.png",
        "assets/img/og-card.jpg",
        "assets/video/hero.mp4",
        "assets/video/hero-portrait.mp4",
    ]
    
    print("\n[+] Checking Core Files...")
    total_core_size = 0
    for rel in core_files:
        exists, size, full = check_file(rel)
        if not exists:
            errors.append(f"Missing core file: {rel}")
            print(f"  ❌ MISSING: {rel}")
        elif size == 0:
            errors.append(f"Empty core file: {rel}")
            print(f"  ❌ EMPTY: {rel}")
        else:
            total_core_size += size
            print(f"  ✓ {rel} ({size / 1024:.1f} KB)")

    # 2. Check 291 Landscape Frames
    print("\n[+] Checking Landscape Film Frames (291 frames expected)...")
    landscape_dir = SITE_DIR / "assets" / "frames"
    missing_landscape = []
    landscape_bytes = 0
    for i in range(1, 292):
        fname = f"f{i:04d}.webp"
        fp = landscape_dir / fname
        if not fp.is_file() or fp.stat().st_size == 0:
            missing_landscape.append(fname)
        else:
            landscape_bytes += fp.stat().st_size
            
    if missing_landscape:
        errors.append(f"Landscape frames missing ({len(missing_landscape)}): {missing_landscape[:5]}...")
        print(f"  ❌ Missing {len(missing_landscape)} landscape frames!")
    else:
        print(f"  ✓ All 291 landscape WebP frames present ({landscape_bytes / (1024*1024):.2f} MB)")

    # 3. Check 291 Portrait Frames
    print("\n[+] Checking Portrait Film Frames (291 frames expected)...")
    portrait_dir = SITE_DIR / "assets" / "frames-portrait"
    missing_portrait = []
    portrait_bytes = 0
    for i in range(1, 292):
        fname = f"f{i:04d}.webp"
        fp = portrait_dir / fname
        if not fp.is_file() or fp.stat().st_size == 0:
            missing_portrait.append(fname)
        else:
            portrait_bytes += fp.stat().st_size

    if missing_portrait:
        errors.append(f"Portrait frames missing ({len(missing_portrait)}): {missing_portrait[:5]}...")
        print(f"  ❌ Missing {len(missing_portrait)} portrait frames!")
    else:
        print(f"  ✓ All 291 portrait WebP frames present ({portrait_bytes / (1024*1024):.2f} MB)")

    # 4. Check 18 Color Swatches
    print("\n[+] Checking 18 WishStone Color Swatches...")
    colors_dir = SITE_DIR / "assets" / "img" / "colors"
    expected_colors = [
        "frio.jpg", "atlas.jpg", "sand-castle.jpg", "navajo.jpg", "blanco.jpg",
        "aria.jpg", "sedona.jpg", "ferrera.jpg", "alps.jpg", "juneau.jpg",
        "danville.jpg", "calcutta-brown.jpg", "crema-white.jpg", "white-castle.jpg",
        "ice-cap.jpg", "manchester.jpg", "milano.jpg", "statuary-gray.jpg"
    ]
    missing_colors = []
    color_bytes = 0
    for c in expected_colors:
        fp = colors_dir / c
        if not fp.is_file() or fp.stat().st_size == 0:
            missing_colors.append(c)
        else:
            color_bytes += fp.stat().st_size
    if missing_colors:
        errors.append(f"Missing color swatches: {missing_colors}")
        print(f"  ❌ Missing swatches: {missing_colors}")
    else:
        print(f"  ✓ All 18 color swatches verified ({color_bytes / 1024:.1f} KB)")

    # 5. Check 12 Gallery Images
    print("\n[+] Checking 12 Gallery Images...")
    gallery_dir = SITE_DIR / "assets" / "img" / "gallery"
    expected_gallery = [
        "frio-bathroom.jpg", "manchester-surround.jpg", "ice-cap-tub.jpg",
        "ferrera-shower.jpg", "sedona-surround.jpg", "crema-white-shower.jpg",
        "calcutta-brown-shower.jpg", "danville-surround.jpg", "crema-white-walls.jpg",
        "frio-niche.jpg", "ice-cap-bathroom.jpg", "aria-tub.jpg"
    ]
    missing_gallery = []
    gallery_bytes = 0
    for g in expected_gallery:
        fp = gallery_dir / g
        if not fp.is_file() or fp.stat().st_size == 0:
            missing_gallery.append(g)
        else:
            gallery_bytes += fp.stat().st_size
    if missing_gallery:
        errors.append(f"Missing gallery images: {missing_gallery}")
        print(f"  ❌ Missing gallery images: {missing_gallery}")
    else:
        print(f"  ✓ All 12 gallery images verified ({gallery_bytes / (1024*1024):.2f} MB)")

    # 6. Check Sequence Poster Images
    print("\n[+] Checking Sequence Poster Images...")
    seq_dir = SITE_DIR / "assets" / "img" / "sequence"
    expected_seq = [
        "01-before-dated-tile.png", "02-demo-to-studs.png", "03-walkin-pan-installed.png",
        "04-six-inch-flange-detail.png", "05-new-valve.png", "06-moisture-barrier-backer.png",
        "07-reinforced-corners.png", "08-wishstone-walls.png", "09-fixtures-and-door.png",
        "10-finished-beauty.png"
    ]
    missing_seq = []
    for s in expected_seq:
        fp = seq_dir / s
        if not fp.is_file() or fp.stat().st_size == 0:
            missing_seq.append(s)
    if missing_seq:
        warnings.append(f"Missing sequence images: {missing_seq}")
        print(f"  ⚠️ Missing sequence images: {missing_seq}")
    else:
        print(f"  ✓ All 10 sequence poster images verified")

    # 7. Check Fonts referenced in fonts.css
    print("\n[+] Checking Font Files referenced in fonts.css...")
    fonts_css = SITE_DIR / "assets" / "fonts" / "fonts.css"
    font_urls = set(re.findall(r'url\(([^)]+\.woff2)\)', fonts_css.read_text()))
    missing_fonts = []
    font_bytes = 0
    for fu in font_urls:
        fu_clean = fu.strip("'\"")
        fpath = SITE_DIR / "assets" / "fonts" / fu_clean
        if not fpath.is_file() or fpath.stat().st_size == 0:
            missing_fonts.append(fu_clean)
        else:
            font_bytes += fpath.stat().st_size
    if missing_fonts:
        errors.append(f"Missing font files: {missing_fonts}")
        print(f"  ❌ Missing font files: {missing_fonts}")
    else:
        print(f"  ✓ All {len(font_urls)} font files present ({font_bytes / 1024:.1f} KB)")

    # 8. Check HTML asset references
    print("\n[+] Checking HTML Internal References...")
    src_refs = re.findall(r'(?:src|href)=["\']([^"\'#:]+)["\']', html_content)
    broken_refs = []
    for ref in src_refs:
        # Ignore external links or protocols
        if ref.startswith("http") or ref.startswith("//") or ref.startswith("tel:") or ref.startswith("mailto:"):
            continue
        target = SITE_DIR / ref
        if not target.is_file():
            broken_refs.append(ref)
    if broken_refs:
        errors.append(f"Broken references in index.html: {broken_refs}")
        print(f"  ❌ Broken references in index.html: {broken_refs}")
    else:
        print(f"  ✓ All {len(src_refs)} local asset links in index.html resolve properly")

    # Summary
    print("\n" + "=" * 60)
    total_site_size = sum(f.stat().st_size for f in SITE_DIR.rglob("*") if f.is_file())
    print(f"Verification Results:")
    print(f"  Total Site Size: {total_site_size / (1024*1024):.2f} MB")
    print(f"  Total Files in web root: {sum(1 for f in SITE_DIR.rglob('*') if f.is_file())}")
    print(f"  Errors: {len(errors)}")
    print(f"  Warnings: {len(warnings)}")
    print("=" * 60)

    if errors:
        print("\n❌ Build Verification FAILED with errors:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    else:
        print("\n✅ Build Verification PASSED! Package is complete and deployment-ready.")
        sys.exit(0)

if __name__ == "__main__":
    run_verification()
