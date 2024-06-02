/**
 * A class representing a fixed palette of colors that can be accessed by index.
 * 
 */
export default class IndexedPalette {

  #colors;
  #bitsPerChannel;
  #maxChannelValue;

  /**
   * @typedef IndexedPaletteOptions
   * @property {number} [bitsPerChannel=8] The number of bits used to store a single RGBA channel value.
   */


  /**
   * 
   * @param {number} colors Number of colors in the palette
   * @param {IndexedPaletteOptions} options Additional configuration options
   */
  constructor(colors, { bitsPerChannel = 8 } = {}) {
    this.#bitsPerChannel = bitsPerChannel;
    this.#maxChannelValue = (1 << this.#bitsPerChannel) - 1;
    this.#colors = new Array(colors);
  }


  /**
   * Sets an individual palette colors' RGBA components. Each channel value is 
   * clamped to ensure it doesn't overflow the palette `bitsPerChannel` setting.
   * 
   * @param {number} index The color index to set
   * @param {number} r The red channel value
   * @param {number} g The green channel value
   * @param {number} b The blue channel value 
   * @param {number} a The alpha channel value
   */
  setColor(index, r = 0, g = 0, b = 0, a = this.#maxChannelValue) {
    const max = this.#maxChannelValue;
    this.#colors[index] = {
      r: Math.max(0, Math.min(r, max)),
      g: Math.max(0, Math.min(g, max)),
      b: Math.max(0, Math.min(b, max)),
      a: Math.max(0, Math.min(a, max))
    };
  }


  /**
   * Returns the RGBA components for a palette color.
   * 
   * @param {number} index The color index to get
   * @returns {Color}
   */
  getColor(index) {
    return this.#colors[index];
  }


  /**
   * Creates a new indexed palette containing scaled RGBA values of the current
   * palette.
   * 
   * @param {number} bitsPerChannel The new color channel
   * @returns {IndexedPalette} The resampled palette
   */
  resample(bitsPerChannel) {
    const resampledMaxValue = (1 << bitsPerChannel) - 1;
    const resampledPalette = new IndexedPalette(this.length, { bitsPerChannel });
    this.#colors.forEach((color, index) => {
      resampledPalette.setColor(
        index,
        color.r / this.#maxChannelValue * resampledMaxValue,
        color.g / this.#maxChannelValue * resampledMaxValue,
        color.b / this.#maxChannelValue * resampledMaxValue,
        color.a / this.#maxChannelValue * resampledMaxValue
      );
    });
    return resampledPalette;
  }


  /**
   * Converts the palette into an array of unsigned integer values.
   * 
   * @param {number} bitsPerChannel Number of bits to store each channel value in.
   * @param {Boolean} alpha Include the alpha channel
   * @returns {Array<number>} Array of unsigned color values
   */
  toValueArray(bitsPerChannel = 8, alpha = true) {
    if (alpha) {
      return this.#colors.map((color) => {
        return (color.r << (bitsPerChannel * 3)) + 
        (color.g << (bitsPerChannel * 2)) + 
        (color.b << (bitsPerChannel)) + 
        color.a >>> 0;
      });
    }
    return this.#colors.map((color) => {
      return (color.r << (bitsPerChannel * 2)) + 
      (color.g << (bitsPerChannel)) + 
      color.b >>> 0;
    });
  }


  /**
   * The number of bits used to store a single RGBA channel value.
   * @type {number}
   */
  get bitsPerChannel() {
    return this.#bitsPerChannel;
  }


  /**
   * The number colors in the palette
   * @type {number}
   */
  get length() {
    return this.#colors.length;
  }


  /**
   * Creates a new indexed palette of the unique colour values stored in an 
   * ImageData object. Resulting palette colors are 8 bit per channel.
   * 
   * @param {ImageData} imageData The image data to create a palette from
   * @returns {IndexedPalette} The new palette
   */
  static fromImageData(imageData) {
    const uniqueColors = new Set();
    const rgbaView = new DataView(imageData.data.buffer);
    for (let c = 0; c < rgbaView.byteLength; c += 4) {
      uniqueColors.add(rgbaView.getUint32(c));
    }
    return IndexedPalette.fromValueArray(new Uint32Array(uniqueColors.values()));
  }


  /**
   * Creates a new indexed palette from an array of unsigned 32 bit values. The
   * resulting palette colors are 8 bit per channel.
   * 
   * @param {Array<number>} colors The colors to create a palette from
   * @returns {IndexedPalette} The new palette
   */
  static fromValueArray(colors) {
    const palette = new IndexedPalette(colors.length, { bitsPerChannel: 8 });
    colors.forEach((rgba, i) => {
      const r = rgba >> 24 & 0xff;
      const g = rgba >> 16 & 0xff;
      const b = rgba >> 8 & 0xff;
      const a = rgba & 0xff;
      palette.setColor(i, r, g, b, a);
    });
    return palette;
  }


  /**
   * Creates a new monochrome palette, with white as the first color index and 
   * black as the second.
   * 
   * @returns {IndexedPalette}
   */
  static monochrome() {
    return IndexedPalette.fromValueArray([0xffffffff, 0x000000ff]);
  }


  [Symbol.for('nodejs.util.inspect.custom')]() {
    return {
      length: this.length,
      bitsPerChannel: this.bitsPerChannel
    };
  }


  [Symbol.iterator]() {
    return this.#colors.values();
  }

}
