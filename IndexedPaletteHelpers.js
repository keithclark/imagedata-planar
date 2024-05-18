import IndexedPalette from './lib/IndexedPalette.js';
import PlanarCoderError from './lib/PlanarCoderError.js';

/**
 * @typedef Color
 * @property {number} r The red channel intensity 
 * @property {number} g The green channel intensity 
 * @property {number} b The blue channel intensity 
*/


/**
 * Parses a 4-bit color into a Color object
 * @param {number} value - A 16-bit bit color value in Big Endian format.
 * @returns {Color} The parsed color
 */
export const parse4bitRgbColor = (value) => {
  return {
    r: (value >> 8) & 0xf,
    g: (value >> 4) & 0xf,
    b: (value) & 0xf
  };
};


/**
 * Parses a STE 4-bit color into a Color object
 * @param {number} value - A 16-bit bit color value in Big Endian format.
 * @returns {Color} The parsed color
 */
export const parseAtariSteColor = (value) => {
  const { r, g, b } = parse4bitRgbColor(value);
  return {
    r: ((r & 8) >>> 3) | (r << 1) & 0xf,
    g: ((g & 8) >>> 3) | (g << 1) & 0xf,
    b: ((b & 8) >>> 3) | (b << 1) & 0xf 
  };
};


export const createAtariSteIndexedPalette = (buffer, colors) => {  
  const palette = new IndexedPalette(colors, { bitsPerChannel: 4 });
  for (let c = 0; c < colors; c++) {
    const word = (buffer[c * 2] << 8) + buffer[c * 2 + 1];
    const { r, g, b } = parseAtariSteColor(word);
    palette.setColor(c, r, g, b);
  }
  return palette;
};


/**
 * Creates an index palette from a buffer of Atari ST or STe colors stored in 
 * either 3 or 4 bits per channel format.
 * 
 * @param {Uint8Array} buffer The array to read the palette from
 * @param {number} colors - Number of colors to read
 * @returns {IndexedPalette} The parsed color palette.
 */
export const readAtariStIndexedPalette = (buffer, colors) => {  
  const palette = new IndexedPalette(colors, { bitsPerChannel: 3 });
  for (let c = 0; c < colors; c++) {
    const word = (buffer[c * 2] << 8) + buffer[c * 2 + 1];
    const { r, g, b } = parse4bitRgbColor(word);
    if ((r & 8) || (g & 8) || (b & 8)) {
      return createAtariSteIndexedPalette(buffer, colors);
    }
    palette.setColor(c, r, g, b);
  }
  return palette;
};


/**
 * Writes a Atari ST or STe color palette stored in either 3 or 4 bits per 
 * channel format to an array.
 * 
 * @param {Uint8Array} buffer The array to write the encoded palette to
 * @param {IndexedPalette} palette The palette to write into the buffer
 */
export const writeAtariStIndexedPalette = (buffer, palette) => {
  if (palette.bitsPerChannel === 3) {
    for (let c = 0; c < palette.length; c++) {
      const { r, g, b } = palette.getColor(c);
      buffer[c * 2] = r;
      buffer[c * 2 + 1] = (g << 4) + b;
    }
  } else if (palette.bitsPerChannel === 4) {
    for (let c = 0; c < palette.length; c++) {
      const { r, g, b } = palette.getColor(c);
      const steR = (r << 3 & 0x8) | (r >> 1 & 0x7);
      const steG = (g << 3 & 0x8) | (g >> 1 & 0x7);
      const steB = (b << 3 & 0x8) | (b >> 1 & 0x7);
      buffer[c * 2] = steR;
      buffer[c * 2 + 1] = (steG << 4) + steB;
    }
  } else {
    throw new PlanarCoderError('Atari ST palettes must be either 3 or 4 bit per channel');
  }
};


/**
 * Computes the minimum number of bitplanes required to store a palette.
 * 
 * @param {IndexedPalette} palette The palette to compute plane count for.
 * @returns {number} The number of bitplanes required to store the palette.
 */
export const getPlaneCountForIndexedPalette = (palette) => {
  return Math.ceil(Math.log(palette.length) / Math.log(2))
};


/**
 * Extends a 32 colour palette by adding a 50% darker copy of every colour. This
 * palette mode is specific to Amiga hardware.
 * 
 * @param {IndexedPalette} palette - the palette to extend
 * @returns {IndexedPalette} the extended palette
 */
export const createEhbPalette = (palette) => {
  const ehbPalette = new IndexedPalette(64);

  for (let c = 0; c < 32; c++) {
    const { r, g, b } = palette.getColor(c);
    ehbPalette.setColor(c, r, g, b);
    ehbPalette.setColor(c + 32, r / 2, g / 2, b / 2);
  }
  
  return ehbPalette;
};
