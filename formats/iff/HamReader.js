import BitplaneReader from '../../lib/BitplaneReader.js';

/**
 * Provides an interface for reading pixel data from a Amiga HAM encoded planar 
 * image.
 */
export default class HamReader extends BitplaneReader {

  /** 
   * The base color palette
   * @type {Array<number>}
   */
  #colors;

  /**
   * The RGB scalar value used to convert a color for 32bit RGBA
   * @type {number}
   */
  #scale;

  /** 
   * The current color as a 32bit RGBA value
   * @type {number}
   */
  #currentColor;

  #mask;

  /** @type {number} */
  #planes;

  constructor(buffer, planes, width, palette) {
    // Ensure the reader is configured to consume images on a 16 bit boundary. 
    // This allows images that aren't multiple of 16 pixels to be correctly
    // decoded.
    const bytesPerLine = Math.ceil(width / 8);
    super(buffer, bytesPerLine, 0, 1, bytesPerLine * planes, planes, bytesPerLine);
    this.#planes = planes - 2;
    this.#colors = palette.toValueArray();
    this.#scale = 255 / (1 << this.#planes);
    this.#mask = (1 << this.#planes) - 1;
  }

  /**
   * Reads the next pixel and returns the 24 bit RGB colour value
   * 
   * @returns {number} A 32 bit RGBA colour value for the pixel
   */
  read() {
    this.#step();
    return this.#currentColor;
  }

  /**
   * Moves the reader forward by a given number of pixels.
   * 
   * @param {number} pixels 
   */
  advance(pixels) {
    for (let c = pixels; c > 0; c--) {
      this.#step();
    }
  }

  /**
   * Sets the HAM base color palette. Can be set mid-read allowing SHAM images
   * to be decoded.
   * @param {import('../../types.js').IndexedPalette} palette 
   */
  setPalette(palette) {
    this.#colors = palette.toValueArray()
  }
  
  #step() {
    const c = super.read();
    if (c <= this.#mask) {
      this.#currentColor = this.#colors[c];
    } else {
      const cmd = c >> this.#planes;
      const val = (c & this.#mask) * this.#scale;

      if (cmd === 1) {
        this.#currentColor = (this.#currentColor & 0xffff00ff) | (val << 8);
      } else if (cmd === 2) {
        this.#currentColor = (this.#currentColor & 0x00ffffff) | (val << 24);
      } else {
        this.#currentColor = (this.#currentColor & 0xff00ffff) | (val << 16);
      }
    }
  }

}
