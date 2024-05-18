import { encode, encodeToBuffer } from '../../encode.js';
import { pack } from '../../compression/packbits.js';
import { ENCODING_FORMAT_WORD, ENCODING_FORMAT_LINE } from '../../consts.js';
import { writeAtariStIndexedPalette } from '../../IndexedPaletteHelpers.js';
import IndexedPalette from '../../lib/IndexedPalette.js';
import PlanarCoderError from '../../lib/PlanarCoderError.js';

/**
 * @typedef {import('./types.js').DegasImageEncodingOptions} DegasImageEncodingOptions
 */

/**
 * Encodes a `ImageData` object into an Degas image
 * 
 * @param {ImageData} imageData - The image data to encide
 * @param {IndexedPalette} palette - The color palette to use
 * @param {DegasImageEncodingOptions} options - The encoding options
 * @returns {Promise<ArrayBuffer>} The encoded Degas image bytes
 */
export default (imageData, palette, options = {}) => {
  const { compression = false } = options;
  const buffer = new ArrayBuffer(32034);
  const dataView = new DataView(buffer);
  const paletteData = new Uint8Array(buffer, 2, 32);
  const bitplaneData = new Uint8Array(buffer, 34, 32000);
  const { height, width } = imageData;
  let res;
  let colors;

  if (width === 320 && height === 200) {
    res = 0;
    colors = 16;
  } else if (width === 640 && height === 200) {
    res = 1;
    colors = 4;
  } else if (width === 640 && height === 400) {
    res = 2;
    colors = 2;
  } else {
    throw new PlanarCoderError('Degas images must be 320x200, 640x200 or 640x400');
  }

  // compression
  dataView.setUint8(0, compression ? 0x80 : 0);     
  
  // resolution
  dataView.setUint8(1, res);

  // palette
  if (palette.length > colors) {
    throw new PlanarCoderError('Too many colors');
  }
  writeAtariStIndexedPalette(paletteData, palette);

  // If the image isn't compressed we just encode the bitplanes and return the
  // buffer.
  if (!compression) {
    encodeToBuffer(bitplaneData, imageData, palette, { format: ENCODING_FORMAT_WORD });
    return buffer;  
  }

  // The image is compressed. When decompressing, Degas Elite uses a buffer 
  // that's sized to the length of a scanline.  To ensure we don't cause bus 
  // errors when decompressing this image, we must compress each scanline 
  // one-by-one rather than letting the RLE work across scanlines.
  const planeLength = [40, 80, 80][res];

  // Encode the ImageData into compressed bitplane data. Note that Degas uses
  // line interleaved encoding when compressing data.
  const uncompressedData = encode(imageData, palette, { format: ENCODING_FORMAT_LINE });
  const compressedData = pack(uncompressedData, planeLength)
  bitplaneData.set(compressedData)

  return buffer.slice(0, bitplaneData.byteOffset + compressedData.byteLength);

};
