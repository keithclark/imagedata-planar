import IndexedPalette from '../../lib/IndexedPalette.js';
import { depack } from '../../compression/packbits.js';
import { decode } from '../../decode.js';
import { ENCODING_FORMAT_WORD, ENCODING_FORMAT_LINE } from '../../consts.js';
import { readAtariStIndexedPalette } from '../../IndexedPaletteHelpers.js';
import PlanarCoderError from '../../lib/PlanarCoderError.js';

/**
 * @typedef {import('./types.js').DegasImage} DegasImage
 */

/**
 * Decodes a Degas image and generates a ImageData object containing the
 * converted data, along with the original image palette.
 *
 * Degas images are stored as word interleaved bitplanes in the following
 * formats (width x height x planes):
 * 
 * - 320 x 200 x 4
 * - 640 x 200 x 2
 * - 640 x 400 x 1
 *
 * @param {ArrayBuffer} buffer - An array buffer containing the Degas image
 * @returns {DegasImage} Image data and palette for the image
 */
export default (buffer) => {
  const dataView = new DataView(buffer);
  const compressed = dataView.getUint8(0);
  const res = dataView.getUint8(1);
  if ((compressed !== 0x80 && compressed !== 0) || (res < 0 || res > 2)) {
    throw new PlanarCoderError('Invalid file format');
  }
  
  let palette;

  const width = res === 0 ? 320 : 640;
  const height = res === 2 ? 400 : 200;
  const planes = 4 >> res;
  const colors = 1 << planes;
  if (planes === 1) {
    palette = IndexedPalette.monochrome();
  } else {
    palette = readAtariStIndexedPalette(new Uint8Array(buffer, 2, colors * 2), colors);
  }
  let imageData;
  if (compressed) {
    const bitplaneData = new Uint8Array(depack(buffer.slice(34), 32000));
    imageData = decode(bitplaneData, width, height, palette, { format: ENCODING_FORMAT_LINE });
  } else {
    const bitplaneData = new Uint8Array(buffer, 34, 32000);
    imageData = decode(bitplaneData, width, height, palette, { format: ENCODING_FORMAT_WORD });
  }
  return {
    imageData,
    meta: { 
      palette,
      compression: !!compressed
    }
  };
};
