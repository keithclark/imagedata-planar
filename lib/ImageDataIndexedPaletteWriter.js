/**
 * An interface for writing RGBA pixel data to an `ImageData` instance from an 
 * `IndexedPalette`.
 */
export default class ImageDataIndexedPaletteWriter {

  /** @type {Array<number>} */
  #palette;
  #pos;
  #view;

  /**
   * @param {ImageData} imageData The image data to write to
   * @param {import('./IndexedPalette.js').default} palette The indexed palette to use for resolving colors
   */
  constructor(imageData, palette) {
    this.#pos = 0;
    this.#view = new DataView(imageData.data.buffer);
    this.setPalette(palette);
  }

  /**
   * Writes the palette color at the specified index to the next pixel.
   * 
   * @param {number} color the index of the palette color to set the pixel to
   */
  write(color) {
    this.#view.setUint32(this.#pos, this.#palette[color]);
    this.#pos += 4;
  }

  /**
   * Replaces the current palette with a new one. This can be done mid-write to
   * allow processing of raster/copper image effects.
   * 
   * @param {import('./IndexedPalette.js').default} palette 
   */
  setPalette(palette) {
    this.#palette = palette.resample(8).toValueArray();
  }

}
