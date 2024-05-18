import { ENCODING_FORMAT_WORD } from '../../consts.js';
import { writeAtariStIndexedPalette } from '../../IndexedPaletteHelpers.js';
import PlanarCoderError from '../../lib/PlanarCoderError.js';
import { encodeToBuffer } from '../../encode.js';

/**
 * Encodes a `ImageData` object into an NEOchrome image
 * 
 * @param {ImageData} imageData - The image data to encode
 * @param {IndexedPalette} palette - The color palette to use
 * @returns {ArrayBuffer} - The encoded NEOchrome image bytes
 */
export default (imageData, palette) => {
  if (imageData.width !== 320 || imageData.height !== 200 || palette.length !== 16) {
    throw new PlanarCoderError('NEOchrome images must be 320x200, 16 color');
  }
  const encodingOptions = { format: ENCODING_FORMAT_WORD };
  const buffer = new ArrayBuffer(32128);

  // Write the palette
  const paletteData = new Uint8Array(buffer, 4, 32);
  writeAtariStIndexedPalette(paletteData, palette);

  // Add the `NEO!` watermark. This helps other coders with format discovery
  const watermarkData = new Uint8Array(buffer, 124, 4);
  watermarkData.set([0x4e, 0x45, 0x4f, 0x21]);

  // Add the bitplanes
  const bitplaneData = new Uint8Array(buffer, 128, 32000);
  encodeToBuffer(bitplaneData, imageData, palette, encodingOptions);

  // Return the encoded image
  return buffer;
};
