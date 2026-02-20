#!/usr/bin/env node
/**
 * Generates favicon.png (32x32) for browser compatibility (e.g. Chrome).
 * No npm dependencies. Uses Python (stdlib) to create a valid PNG in Hone brand color (#111827).
 * Run: node scripts/generate-favicon.mjs
 * Or: npm run generate-favicon
 *
 * For a logo-shaped favicon, export a 32x32 PNG from your design tool and save as public/favicon.png.
 */
import { writeFileSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pngPath = join(root, 'public', 'favicon.png');

const pyScript = join(root, 'scripts', '_favicon_gen.py');
writeFileSync(
  pyScript,
  `
import struct
import zlib
import sys

def png_chunk(chunk_type, data):
    chunk = chunk_type + data
    return struct.pack('>I', len(data)) + chunk + struct.pack('>I', zlib.crc32(chunk) & 0xffffffff)

w, h = 32, 32
raw = b''
for y in range(h):
    raw += b'\\x00'
    for x in range(w):
        raw += b'\\x11\\x18\\x27\\xff'
comp = zlib.compress(raw, 9)
ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
png = b'\\x89PNG\\r\\n\\x1a\\n' + png_chunk(b'IHDR', ihdr) + png_chunk(b'IDAT', comp) + png_chunk(b'IEND', b'')
with open(sys.argv[1], 'wb') as f:
    f.write(png)
`.trim()
);

try {
  execSync(`python3 "${pyScript}" "${pngPath}"`, { stdio: 'inherit' });
  unlinkSync(pyScript);
  console.log('Generated public/favicon.png (32x32)');
} catch (e) {
  try { unlinkSync(pyScript); } catch (_) {}
  console.error('Python3 is required. Run: python3 -c "import zlib" to verify, or add public/favicon.png manually.');
  process.exit(1);
}
