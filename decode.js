import ImageDataIndexedPaletteWriter from './lib/ImageDataIndexedPaletteWriter.js';
import BitplaneReader from './lib/BitplaneReader.js';
import PlanarCoderError from './lib/PlanarCoderError.js';
import { getPlaneCountForIndexedPalette } from './IndexedPaletteHelpers.js';

import {
  ENCODING_FORMAT_CONTIGUOUS,
  ENCODING_FORMAT_LINE,
  ENCODING_FORMAT_WORD
} from './consts.js';


/**
 * Decodes a buffer of planar image data into an `ImageData` instance.
 *
 * @param {Uint8Array} buffer An array buffer containing the bitmap data
 * @param {number} width The width in pixels of the image to decode
 * @param {number} height The height in pixels of the image to decode
 * @param {IndexedPalette} palette The image palette
 * @param {import('./types.js').BitplaneEncodingOptions} options Decoder options
 * @returns {ImageData} The decoded image
 */
export const decode = (buffer, width, height, palette, options = {}) => {

  const {
    planes = getPlaneCountForIndexedPalette(palette)
  } = options;

  const imageData = new ImageData(width, height);
  const { format = ENCODING_FORMAT_WORD } = options;
  const writer = new ImageDataIndexedPaletteWriter(imageData, palette);

  // Regardless of the output width, bitplanes are always stored in multiples of 
  // 16 bits. We need to calculate the width of the stored line for our reader
  // instance.
  const planeWidth = Math.ceil(width / 8) * 8;

  let reader;

  if (format === ENCODING_FORMAT_CONTIGUOUS) { 
    reader = BitplaneReader.contiguous(buffer, planes, planeWidth, height);
  } else if (format === ENCODING_FORMAT_LINE) { 
    reader = BitplaneReader.line(buffer, planes, planeWidth);
  } else if (format === ENCODING_FORMAT_WORD) { 
    reader = BitplaneReader.word(buffer, planes);
  } else {
    throw new PlanarCoderError('Invalid format');
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      writer.write(reader.read());
    }
    // Skip over any unused pixels
    reader.advance(planeWidth - width);
  }

  return imageData;
};
