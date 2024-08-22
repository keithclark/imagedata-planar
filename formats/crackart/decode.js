import { decompress } from './compression.js';
import { ERROR_MESSAGE_INVALID_FILE_FORMAT, FILE_HEADER } from './consts.js';
import { ENCODING_FORMAT_WORD } from '../../consts.js';
import { readAtariStIndexedPalette } from '../../IndexedPaletteHelpers.js';
import { decode as decodeBitplanes } from '../../decode.js';
import IndexedPalette from '../../lib/IndexedPalette.js';
import PlanarCoderError from '../../lib/PlanarCoderError.js';

/**
 * @typedef {import('./types.js').CrackArtImage} CrackArtImage
 */
/**
 * Decodes a Crack Art image and returns a ImageData object containing the
 * converted data. Colors are converted from 12bit RGB to 32bit RGBA format.
 * Supports CA1, CA2 and CA3 formats.
 *
 * @param {ArrayBuffer} buffer - An array buffer containing the Crack Art image
 * @returns {CrackArtImage} Decoded image data
 * @throws {Error} If the image data is invalid
 */
export default (buffer) => {
  const dataView = new DataView(buffer);

  if (dataView.getUint16(0) !== FILE_HEADER) {
    throw new PlanarCoderError(ERROR_MESSAGE_INVALID_FILE_FORMAT);
  }

  const compressed = dataView.getUint8(2);
  const res = dataView.getUint8(3);

  if ((compressed !== 1 && compressed !== 0) || (res < 0 || res > 2)) {
    throw new PlanarCoderError(ERROR_MESSAGE_INVALID_FILE_FORMAT);
  }

  let palette;
  let pos = 4;

  if (res === 2) {
    palette = new IndexedPalette(2, { bitsPerChannel: 1 });
    palette.setColor(0, 1, 1, 1);
    palette.setColor(1, 0, 0, 0);
  } else {
    if (res === 0) {
      palette = readAtariStIndexedPalette(new Uint8Array(buffer, 4, 32), 16);
    } else {
      palette = readAtariStIndexedPalette(new Uint8Array(buffer, 4, 8), 4);
    }
    pos += palette.length * 2;
  }

  const width = res === 0 ? 320 : 640;
  const height = res === 2 ? 400 : 200;
  let bitplaneData = buffer.slice(pos);

  if (compressed) {
    bitplaneData = decompress(bitplaneData);
  }

  const imageData = decodeBitplanes(new Uint8Array(bitplaneData), width, height, palette, { format: ENCODING_FORMAT_WORD });

  return {
    imageData,
    meta: {
      palette,
      compression: !!compressed
    }
  };

};
