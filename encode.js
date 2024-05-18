import ImageDataIndexedPaletteReader from './lib/ImageDataIndexedPaletteReader.js';
import BitplaneWriter from './lib/BitplaneWriter.js';
import PlanarCoderError from './lib/PlanarCoderError.js';
import { getPlaneCountForIndexedPalette } from './IndexedPaletteHelpers.js';

import { 
  ENCODING_FORMAT_CONTIGUOUS,
  ENCODING_FORMAT_LINE,
  ENCODING_FORMAT_WORD
} from './consts.js';


/**
 * Encodes image data into bitplane format
 *
 * @param {Uint8Array} buffer The buffer to write encoded data to
 * @param {ImageData} imageData The image to convert
 * @param {IndexedPalette} palette The image palette
 * @param {number} planes Number of bitplanes to encode
 * @param {import('./types.js').BitplaneEncodingFormat} format The Encoding format
 */
const encodeInternal = (buffer, imageData, palette, planes, format) => {
  const { width, height } = imageData;
  const reader = new ImageDataIndexedPaletteReader(imageData, palette);
  let writer;

  if (format === ENCODING_FORMAT_CONTIGUOUS) { 
    writer = BitplaneWriter.contiguous(buffer, planes, width, height);
  } else if (format === ENCODING_FORMAT_LINE) { 
    writer = BitplaneWriter.line(buffer, planes, width);
  } else if (format === ENCODING_FORMAT_WORD) { 
    writer = BitplaneWriter.word(buffer, planes);
  } else {
    throw new PlanarCoderError('Invalid format');
  }

  // Be tollerant of oversized buffers and only read the number of pixels 
  // required to fill the destination image data.
  let bytesToRead = width * height;
  while (bytesToRead) {
    writer.write(reader.read());
    bytesToRead--;
  }
};


/**
 * Encodes `ImageData` to planar data and writes the result to an existing 
 * `Uint8Array`.
 *
 * @param {Uint8Array} buffer The buffer to write encoded data to
 * @param {ImageData} imageData The image to convert
 * @param {IndexedPalette} palette The image palette
 * @param {import('./types.js').BitplaneEncodingOptions} options Conversion options
 */
export const encodeToBuffer = (buffer, imageData, palette, options = {}) => {
  const {
    planes = getPlaneCountForIndexedPalette(palette),
    format = ENCODING_FORMAT_WORD
  } = options;

  const { width, height } = imageData;
  const bufferSize = width / 8 * height * planes;

  // Ensure the image width is a multiple of 16 pixels
  if (width % 16 !== 0) {
    throw new PlanarCoderError('Image width must be a multiple of 16');
  }

  if (buffer.byteLength < bufferSize) {
    throw new PlanarCoderError('Encode buffer too small');
  }

  encodeInternal(buffer, imageData, palette, planes, format);
};


/**
 * Encodes `ImageData` to planar data and writes the result to a `Uint8Array`.
 *
 * @param {ImageData} imageData The image to convert
 * @param {IndexedPalette} palette The image palette
 * @param {import('./types.js').BitplaneEncodingOptions} options Conversion options
 * @returns {Uint8Array} A `Uint8Array` containing bitplane encoded data
 */
export const encode = (imageData, palette, options = {}) => {
  const {
    planes = getPlaneCountForIndexedPalette(palette),
    format = ENCODING_FORMAT_WORD
  } = options;

  const { width, height } = imageData;
  const bufferSize = width / 8 * height * planes;

  // Ensure the image width is a multiple of 16 pixels
  if (width % 16 !== 0) {
    throw new PlanarCoderError('Image width must be a multiple of 16');
  }

  const buffer = new Uint8Array(bufferSize);
  encodeInternal(buffer, imageData, palette, planes, format);
  return buffer;
};

