import { ENCODING_FORMAT_WORD } from '../../consts.js';
import { readAtariStIndexedPalette } from '../../IndexedPaletteHelpers.js';
import { decode } from '../../decode.js';
import decompress from './decompress.js';

/**
 * @typedef {import('imagedata-coder-bitplane').IndexedPalette} IndexedPalette
 */


/**
 * @typedef TinyStuffImageMetadata
 * @property {IndexedPalette} palette The color palette for the image
 */

/**
 * @typedef TinyStuffImage
 * @property {ImageData} imageData - The ImageData object containing the image
 * @property {TinyStuffImageMetadata} meta - The indexed palette containing the image colors
 */

/**
 * Decodes a Tiny image and generates a ImageData object containing the
 * converted data, along with the original image palette.
 *
 * @param {ArrayBuffer} buffer - An array buffer containing the image to decode
 * @returns {TinyStuffImage} Image data and palette for the image
 */
export default (buffer) => {
  const dataView = new DataView(buffer);
  const res = dataView.getUint8(0);

  if (res > 2) {
    throw 'colour animation variant not supported yet';
  }

  const width = res === 0 ? 320 : 640;
  const height = res < 2 ? 200 : 400;
  const planes = 4 >> res;
  const colors = 1 << planes;
  const palette = readAtariStIndexedPalette(new Uint8Array(buffer.slice(1, 33)), colors);
  const controlByteCount = dataView.getUint16(33);
  const dataWordCount = dataView.getUint16(35);
  const controlBytes = new DataView(dataView.buffer, 37, controlByteCount);
  const dataWords = new DataView(dataView.buffer, 37 + controlByteCount, dataWordCount * 2);
  
  const bitplaneData = new Uint8Array((width / 8) * height * planes);
  decompress(controlBytes, dataWords, bitplaneData.buffer);

  const imageData = decode(bitplaneData, width, height, palette, { format: ENCODING_FORMAT_WORD });

  return {
    imageData,
    meta: {
      palette
    }
  };
};

