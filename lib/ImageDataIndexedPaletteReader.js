/**
 * An interface for reading RGBA pixel data from an `ImageData` instance as an
 * indexed palette.
 */
export default class ImageDataIndexedPaletteReader {

  /** @type {Array<number>} */
  #palette;
  #pos;
  #view;

  /**
   * @param {ImageData} imageData The image data to read from
   * @param {import('./IndexedPalette.js').default} palette The indexed palette to use for resolving colors
   */
  constructor(imageData, palette) {
    this.#pos = 0;
    this.#view = new DataView(imageData.data.buffer);
    this.setPalette(palette);
  }

  /**
   * Reads the color of the next pixel and returns the index of the 
   * corresponding color in the palette.
   * 
   * @returns {number} the color index of the pixel
   * @throws {RangeError} if the color doesn't exist in the palette
   */
  read() {
    const color = this.#view.getUint32(this.#pos);
    const index = this.#palette.indexOf(color);
    if (index === -1) {
      throw new RangeError(`Color 0x${color.toString(16)} not in palette`);
    }
    this.#pos += 4;
    return index;
  }

  /**
   * Moves the reader forward by a specified number of pixels. Useful for 
   * clipping data.
   * @param {number} pixels The number of pixels to skip over
   */
  advance(pixels) {
    this.#pos += 4 * pixels;
  }

  /**
   * Replaces the current palette with a new one. This can be done mid-read to
   * allow processing of raster/copper image effects.
   * 
   * @param {import('./IndexedPalette.js').default} palette 
   */
  setPalette(palette) {
    this.#palette = palette.resample(8).toValueArray();
  }

  /**
   * Determines if the reader has reached the end of the input buffer or not.
   * 
   * @returns {boolean} `true` if the read has reached the end of the buffer, or `false` if not.
   */
  eof() {
    return this.#pos === this.#view.byteLength;
  }
}
