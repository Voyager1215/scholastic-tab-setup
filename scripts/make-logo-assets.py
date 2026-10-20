#!/usr/bin/env python3
"""Derives the web assets from the Scholastic Science Academy splash image.

The source is a full-bleed 1280x960 splash (dark green leather with the logo
centred). The web portal needs two things out of it:

  scholastic-lockup.jpg - the complete logo block, for the site header and
                           the admin sign-in page
  scholastic-hero.jpg   - the whole image, for the home page banner

Re-run after replacing temp/scholastic_logo.jpeg with a new source image.
"""
from pathlib import Path

from PIL import Image

SRC = Path("/home/ved/Desktop/VED/tab-setup/tab-boot/temp/scholastic_logo.jpeg")
OUT = Path("/home/ved/Desktop/VED/tab-setup/tab-boot/web-portal/frontend/public")

src = Image.open(SRC).convert("RGB")


def save(image, name, quality=82):
    path = OUT / name
    image.save(path, quality=quality, optimize=True, progressive=True)
    size = path.stat().st_size / 1024
    print(f"{name:30} {size:7.1f} KB  {image.size}")


# --- logo block: "SCHOLASTIC" + the atom, the divider and "SCIENCE ACADEMY" ---
save(src.crop((290, 340, 990, 566)).resize((700, 226), Image.LANCZOS), "scholastic-lockup.jpg", 88)

# --- the whole splash, used as the home page banner ---
save(src.resize((1280, 960), Image.LANCZOS), "scholastic-hero.jpg", 65)
