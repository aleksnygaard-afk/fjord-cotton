import sharp from "sharp";
import { MOCKUP_SHIRT_HEX } from "@/lib/tokens";

/**
 * Generate store imagery from a print file, on upload (04-gelato-fulfilment.md:
 * "Do not hand-make mockups. Composite the print file onto a garment template
 * with a Sharp/Canvas job").
 *
 * This is a lightweight compositor: the print is centred on a flat garment-
 * coloured canvas. It is intentionally simple — swapping in a real garment
 * template PNG (or Gelato's preview API) later means changing only this file.
 *
 *   mockup : 4:5 shirt render for tiles and the product hero.
 *   detail : 1:1 zoomed print close-up.
 *
 * Both are returned as WebP buffers (small, CDN-friendly, opaque once composited).
 */

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

async function composeOnGarment(
  printPng: Buffer,
  canvasW: number,
  canvasH: number,
  printFraction: number,
): Promise<Buffer> {
  const shirt = hexToRgb(MOCKUP_SHIRT_HEX);

  // Fit the print inside a box so it can never overflow the canvas, whatever
  // the source aspect ratio is.
  const boxW = Math.round(canvasW * printFraction);
  const boxH = Math.round(canvasH * printFraction);
  const fitted = await sharp(printPng)
    .resize({ width: boxW, height: boxH, fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();

  const meta = await sharp(fitted).metadata();
  const w = meta.width ?? boxW;
  const h = meta.height ?? boxH;
  const left = Math.max(0, Math.round((canvasW - w) / 2));
  const top = Math.max(0, Math.round((canvasH - h) / 2));

  return sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { ...shirt, alpha: 1 },
    },
  })
    .composite([{ input: fitted, top, left }])
    .webp({ quality: 82 })
    .toBuffer();
}

export async function renderMockups(
  printPng: Buffer,
): Promise<{ mockup: Buffer; detail: Buffer }> {
  const [mockup, detail] = await Promise.all([
    composeOnGarment(printPng, 1200, 1500, 0.52), // 4:5 tile / hero
    composeOnGarment(printPng, 1000, 1000, 0.86), // 1:1 print close-up
  ]);
  return { mockup, detail };
}
