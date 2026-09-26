/**
 * Builds every app icon and the splash image from the uploaded logo
 * (assets/brand/logo-original.png: the "U" with its orbit ring above the old
 * "UNIVERSE" wordmark).
 *
 * - The mark is cut out of the original pixels (not redrawn): the near-black
 *   background is keyed out so the mark can sit on any dark background, and the
 *   old wordmark below it is left out.
 * - The "UNIverse" wordmark is built from the Outfit typeface outlines
 *   (@fontsource/outfit, SIL Open Font License), so the app and the splash
 *   share the exact same shapes without loading a font at runtime.
 *
 * Usage: npm run gen:brand
 */
import { Buffer } from 'node:buffer';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import opentype from 'opentype.js';
import sharp from 'sharp';

// opentype.js is CommonJS: named imports fail at runtime, so take them from the default export.
// eslint-disable-next-line import/no-named-as-default-member
const { parse: parseFont, Path } = opentype;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = (p) => join(root, p);

const BACKGROUND = '#070A13'; // colors.bg in src/theme/tokens.ts and app.json
const TEXT = '#F4F5FF';

// ---------------------------------------------------------------------------
// 1. Cut the mark out of the original logo

const original = await sharp(path('assets/brand/logo-original.png'))
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: W, height: H } = original.info;
const src = original.data;

/** Median colour of the image border: the logo's background. */
function borderColour() {
  const samples = [[], [], []];
  for (let i = 0; i < W; i += 4) {
    for (const [x, y] of [
      [i, 0],
      [i, H - 1],
      [0, i],
      [W - 1, i],
    ]) {
      const o = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) samples[c].push(src[o + c]);
    }
  }
  return samples.map((s) => s.sort((a, b) => a - b)[s.length >> 1]);
}
const bg = borderColour();

/** Rows that contain something brighter than the background (the mark, then the old wordmark). */
function brightRows(threshold = 40) {
  const runs = [];
  let start = -1;
  for (let y = 0; y < H; y++) {
    let on = false;
    for (let x = 0; x < W && !on; x++) {
      const o = (y * W + x) * 3;
      on = Math.max(src[o], src[o + 1], src[o + 2]) > threshold;
    }
    if (on && start < 0) start = y;
    if (!on && start >= 0) {
      runs.push([start, y - 1]);
      start = -1;
    }
  }
  return runs;
}
const runs = brightRows();
if (runs.length < 2) throw new Error(`Expected the mark and a wordmark below it, found ${runs.length} blocks`);
const [markTop, markBottom] = runs[0];
const cut = Math.round((markBottom + runs[1][0]) / 2); // halfway to the old wordmark

// Key out the background: alpha grows with the distance from the background
// colour, and the colour is un-blended so that compositing the mark back on the
// original background reproduces the original pixels.
const LOW = 6; // film grain in the background stays transparent
const HIGH = 70;
const PAD = 24;
let minX = W;
let maxX = 0;
let minY = H;
let maxY = 0;
const keyed = Buffer.alloc(W * H * 4);
for (let y = Math.max(0, markTop - PAD); y < cut; y++) {
  for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 3;
    const diff = [0, 1, 2].map((c) => Math.max(0, src[o + c] - bg[c]));
    const alpha = Math.min(1, Math.max(0, (Math.max(...diff) - LOW) / (HIGH - LOW)));
    if (alpha <= 0) continue;
    const k = (y * W + x) * 4;
    for (let c = 0; c < 3; c++) keyed[k + c] = Math.min(255, Math.round(bg[c] + diff[c] / alpha));
    keyed[k + 3] = Math.round(alpha * 255);
    if (alpha > 0.02) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
}
const markBox = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
const mark = await sharp(keyed, { raw: { width: W, height: H, channels: 4 } })
  .extract(markBox)
  .png()
  .toBuffer();

/** The mark resized to `width` px (height follows). */
const markAt = (width) => sharp(mark).resize({ width, kernel: 'lanczos3' }).png().toBuffer();
const heightFor = (width) => Math.round((markBox.height * width) / markBox.width);

/**
 * The mark in white for Android themed icons: the ring and planet (near white
 * in the original) stay opaque, the blue U is half transparent so the ring
 * still reads where it crosses it.
 */
async function monochrome(width) {
  const { data, info } = await sharp(await markAt(width)).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const whiteness = Math.min(1, Math.max(0, (Math.min(data[i], data[i + 1], data[i + 2]) - 90) / 110));
    const alpha = data[i + 3] < 40 ? 0 : data[i + 3];
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.round(alpha * (0.5 + 0.5 * whiteness));
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

// ---------------------------------------------------------------------------
// 2. "UNIverse" wordmark from the font outlines

const outfit = (weight) =>
  parseFont(readFileSync(path(`node_modules/@fontsource/outfit/files/outfit-latin-${weight}-normal.woff`)).buffer);
const WORDMARK = [
  { text: 'UNI', font: outfit(600) },
  { text: 'verse', font: outfit(300) },
];
const TRACKING = 0.12; // em

function buildWordmark(size = 100) {
  let x = 0;
  const outline = new Path();
  for (const part of WORDMARK) {
    for (const char of part.text) {
      const glyph = part.font.charToGlyph(char);
      outline.extend(glyph.getPath(x, 0, size));
      x += (glyph.advanceWidth / part.font.unitsPerEm) * size + TRACKING * size;
    }
  }
  const box = outline.getBoundingBox();
  // Move the outline to the origin so its viewBox is 0 0 width height.
  for (const command of outline.commands) {
    for (const [kx, ky] of [
      ['x', 'y'],
      ['x1', 'y1'],
      ['x2', 'y2'],
    ]) {
      if (command[kx] !== undefined) {
        command[kx] -= box.x1;
        command[ky] -= box.y1;
      }
    }
  }
  return {
    d: outline.toPathData(2),
    width: Math.round((box.x2 - box.x1) * 100) / 100,
    height: Math.round((box.y2 - box.y1) * 100) / 100,
  };
}
const wordmark = buildWordmark();

const wordmarkSvg = (fill = TEXT) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${wordmark.width}" height="${wordmark.height}" viewBox="0 0 ${wordmark.width} ${wordmark.height}"><path d="${wordmark.d}" fill="${fill}"/></svg>`;
const wordmarkAt = (width) => sharp(Buffer.from(wordmarkSvg()), { density: 72 * (width / wordmark.width) * 1.02 })
  .resize({ width })
  .png()
  .toBuffer();

/** Wordmark width relative to the mark width, used by the splash and the app (src/components/brand.tsx). */
const LOCKUP = { wordmarkWidth: 0.86, gap: 0.1 };

// ---------------------------------------------------------------------------
// 3. Outputs

const backgroundSvg = (size) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <radialGradient id="glow" cx="0.5" cy="0.44" r="0.6">
      <stop offset="0" stop-color="#1B2466" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#1B2466" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="violet" cx="0.78" cy="0.9" r="0.55">
      <stop offset="0" stop-color="#6A2C8F" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#6A2C8F" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="${BACKGROUND}"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <rect width="100%" height="100%" fill="url(#violet)"/>
</svg>`);

/** Largest distance of any visible pixel from the canvas centre, as a fraction of the canvas size. */
async function reach(png) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  let max = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 25) {
        max = Math.max(max, Math.hypot(x + 0.5 - info.width / 2, y + 0.5 - info.height / 2));
      }
    }
  }
  return max / info.width;
}

async function centred(size, layers) {
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers)
    .png()
    .toBuffer();
}

const written = [];
async function write(file, buffer) {
  await sharp(buffer).png({ compressionLevel: 9 }).toFile(path(file));
  written.push(file);
}

/** The mark on the brand background, `fill` = share of the width it takes. */
async function squareIcon(size, fill) {
  const width = Math.round(size * fill);
  const height = heightFor(width);
  return sharp(backgroundSvg(size))
    .composite([{ input: await markAt(width), left: Math.round((size - width) / 2), top: Math.round((size - height) / 2) }])
    .flatten({ background: BACKGROUND })
    .png()
    .toBuffer();
}

// iOS / store icon: full-bleed square, no transparency. The favicon uses a
// larger mark so it stays legible at 48px.
await write('assets/images/icon.png', await squareIcon(1024, 0.72));
await write(
  'assets/images/favicon.png',
  await sharp(await squareIcon(512, 0.92)).resize(48, 48, { kernel: 'lanczos3' }).png().toBuffer(),
);

// Android adaptive icon: the launcher masks the 108dp layer to a shape that
// always contains the central 66dp circle (61% of the canvas).
{
  const size = 1024;
  const width = Math.round(size * 0.56);
  const height = heightFor(width);
  const place = { left: Math.round((size - width) / 2), top: Math.round((size - height) / 2) };
  const foreground = await centred(size, [{ input: await markAt(width), ...place }]);
  const r = await reach(foreground);
  if (r > 0.305) throw new Error(`Adaptive icon foreground leaves the safe zone (${r.toFixed(3)} > 0.305)`);
  await write('assets/images/android-icon-foreground.png', foreground);
  await write('assets/images/android-icon-monochrome.png', await centred(size, [{ input: await monochrome(width), ...place }]));
}

// Splash: mark with the wordmark underneath, on a transparent square shown on
// the brand background. Android 12+ masks the splash icon to a circle of 2/3
// of its size, so the lockup must fit in it.
let splashSize;
{
  const markWidth = markBox.width; // original pixels, no upscaling
  const markHeight = markBox.height;
  const wordWidth = Math.round(markWidth * LOCKUP.wordmarkWidth);
  const wordHeight = Math.round((wordmark.height * wordWidth) / wordmark.width);
  const gap = Math.round(markWidth * LOCKUP.gap);
  const lockupHeight = markHeight + gap + wordHeight;
  const halfDiagonal = Math.hypot(markWidth / 2, lockupHeight / 2);
  splashSize = Math.ceil((halfDiagonal / 0.32) / 2) * 2;
  const top = Math.round((splashSize - lockupHeight) / 2);
  const splash = await centred(splashSize, [
    { input: mark, left: Math.round((splashSize - markWidth) / 2), top },
    { input: await wordmarkAt(wordWidth), left: Math.round((splashSize - wordWidth) / 2), top: top + markHeight + gap },
  ]);
  const r = await reach(splash);
  if (r > 0.33) throw new Error(`Splash lockup does not fit the Android 12 circle (${r.toFixed(3)} > 0.33)`);
  await write('assets/images/splash-icon.png', splash);
}

// In-app mark (src/components/brand.tsx) and the vector wordmark.
await write('assets/images/logo-mark.png', mark);
writeFileSync(path('assets/brand/wordmark.svg'), `${wordmarkSvg()}\n`);
written.push('assets/brand/wordmark.svg');

writeFileSync(
  path('src/components/brand-assets.ts'),
  `// Generated by scripts/generate-brand-assets.mjs — do not edit.

/** Size of assets/images/logo-mark.png in pixels. */
export const MARK = { width: ${markBox.width}, height: ${markBox.height} } as const;

/** "UNIverse" in Outfit (UNI SemiBold, verse Light), as one SVG path. */
export const WORDMARK = {
  width: ${wordmark.width},
  height: ${wordmark.height},
  d: '${wordmark.d}',
} as const;

/** Proportions of the splash lockup, relative to the mark width. */
export const LOCKUP = { wordmarkWidth: ${LOCKUP.wordmarkWidth}, gap: ${LOCKUP.gap} } as const;
`,
);
written.push('src/components/brand-assets.ts');

console.log(`Background of the original: rgb(${bg.join(', ')}); mark ${markBox.width}×${markBox.height}px`);
console.log(`Splash canvas ${splashSize}px: set "imageWidth" so the mark shows at the size you want (mark = ${(markBox.width / splashSize).toFixed(2)} of it).`);
for (const file of written) console.log(`wrote ${file}`);
