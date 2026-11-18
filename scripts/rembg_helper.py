"""Optional helper for MOCHI cutouts. Source files remain read-only."""
from pathlib import Path
import sys

try:
    from rembg import remove
except ImportError:
    print('rembg not installed; run npm run assets for placeholders.', file=sys.stderr)
    raise SystemExit(0)

source = Path(sys.argv[1]) if len(sys.argv) > 1 else None
target = Path(sys.argv[2]) if len(sys.argv) > 2 else None
if not source or not target:
    print('usage: python scripts/rembg_helper.py SOURCE TARGET')
    raise SystemExit(2)
target.parent.mkdir(parents=True, exist_ok=True)
target.write_bytes(remove(source.read_bytes()))
print(target)
