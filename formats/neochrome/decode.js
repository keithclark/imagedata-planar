import { ENCODING_FORMAT_WORD } from '../../consts.js';
import { readAtariStIndexedPalette } from '../../IndexedPaletteHelpers.js';
import { decode } from '../../decode.js';

/**
 * @typedef {import('./types.js').NeochromeImage} NeochromeImage
 */

/**
 * Decodes a NEOchrome image and returns a ImageData object containing the
 * converted data. Colors are converted from 12bit RGB to 32bit RGBA format
 *
 * NEOchrome images are always 320 x 200, 4 plane images with word interleaved
 * bitplanes.
 *
 * @param {ArrayBuffer} buffer - An array buffer containing the NEOChrome image
 * @returns {NeochromeImage} Decoded image data
 */
export default (buffer) => {
  const paletteData = new Uint8Array(buffer, 4, 32);
  const bitplaneData = new Uint8Array(buffer, 128, 32000);
  const palette = readAtariStIndexedPalette(paletteData, 16);
  const decodingOptions = { format: ENCODING_FORMAT_WORD };
  const imageData = decode(bitplaneData, 320, 200, palette, decodingOptions);
  return {
    imageData,
    meta: {
      palette
    }
  };
};
