#!/bin/sh
#
# Web icons, derived from icon-1024.png — the same artwork as the iOS app icon,
# so the thing on the home screen is the thing your friend already recognises.
#
# TWO SHAPES, because Android does two different things with an icon:
#
#   icon-192 / icon-512   "any" — used as drawn, on whatever the launcher does
#                         with it. A straight downscale of the master.
#   icon-maskable-512     "maskable" — the launcher CROPS this to its own shape,
#                         a circle or a squircle, and only the middle 80% is
#                         guaranteed to survive. The master's ghost reaches
#                         about 86% of the way out at its bottom-right corner,
#                         so a circular mask would shave the tail. Padding the
#                         canvas to 1422 (1024 / 0.72) pulls everything inside
#                         the safe zone; the padding is paper, so the join is
#                         invisible.
#
# macOS only — sips is what's here and this is where the icons get made.
#
#   sh tools/make_icons.sh
#
set -e
cd "$(dirname "$0")/.."

PAPER=E6E8DB      # SwimTheme.paper

sips -s format png -Z 512 icon-1024.png --out icon-512.png >/dev/null
sips -s format png -Z 192 icon-1024.png --out icon-192.png >/dev/null

sips -p 1422 1422 --padColor "$PAPER" icon-1024.png --out /tmp/ghost-padded.png >/dev/null
sips -s format png -Z 512 /tmp/ghost-padded.png --out icon-maskable-512.png >/dev/null
rm -f /tmp/ghost-padded.png

for f in icon-192.png icon-512.png icon-maskable-512.png; do
  printf '%-24s %s\n' "$f" "$(sips -g pixelWidth -g pixelHeight "$f" | tail -2 | tr -d ' \n')"
done
