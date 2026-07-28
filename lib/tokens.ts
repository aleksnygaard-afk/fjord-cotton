/**
 * Design tokens needed on the server. The full palette lives in app/globals.css;
 * these are the values referenced by data-generation logic.
 */

// Tile background palette. Product tiles cycle through these (01-design-spec.md).
// tile_bg is derived from a rotating palette on upload (04-gelato-fulfilment.md).
export const TILE_BGS = [
  "#e9e3d4",
  "#ded9cb",
  "#e4e0d2",
  "#dfe2dc",
  "#e7e0d8",
  "#dcdcd4",
  "#e6e2d0",
  "#e1dcd0",
] as const;

/** Pick the next tile background by rotating through the palette by index. */
export function rotatingTileBg(index: number): string {
  const i = ((index % TILE_BGS.length) + TILE_BGS.length) % TILE_BGS.length;
  return TILE_BGS[i];
}

// Default garment colour used for the primary generated mockup (a warm sand
// reads well behind most prints). Only mockup_url/detail_url are stored on the
// design row; per-colour renders are a later enhancement.
export const MOCKUP_SHIRT_HEX = "#d8cdb6";
