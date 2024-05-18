class IndexedPalette {

  #colors;
  #bitsPerChannel;
  #maxChannelValue;

  /**
   * @typedef IndexedPaletteOptions
   * @property {number} [bitsPerChannel=8] The number of bits used to store a single RGBA channel value.
   */


  /**
   * 
   * @param {number} colors Number of colours in the palette
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
   * ImageData object. Resulting palette colours are 8 bit per channel.
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
   * resulting palette colours are 8 bit per channel.
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
    return IndexedPalette.fromValueArray([0xffffffff, 0x000000ff])
  }


  toJSON() {
    return {
      length: this.length,
      bitsPerChannel: this.bitsPerChannel
    };
  }

  [Symbol.iterator]() {
    return this.#colors.values();
  }


}

/**
 * An interface for reading RGBA pixel data from an `ImageData` instance as an
 * indexed palette.
 */
class ImageDataIndexedPaletteReader {

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

/**
 * An interface for writing RGBA pixel data to an `ImageData` instance from an 
 * `IndexedPalette`.
 */
class ImageDataIndexedPaletteWriter {

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

/**
 * Provides an interface for reading pixel data from a planar image that is
 * encoded as a series bitplanes. The reader will walk the bitmap data, using
 * the `bytesPerBlock` and `blockStep` values passed to the constructor.
 * 
 * If you're working with bitplanes encoded as word-interleaved (Atari ST), 
 * line-interleaved (Amiga ILBM) or contiguous (Amiga ACBM), you can use the 
 * equivalent static methods to create a pre-configured reader instance.
 */
class BitplaneReader {

  /** @type {Uint8Array} */
  #buffer;

  /** @type {number} */
  #planes;

  /** @type {number} */
  #bytesPerBlock;

  /** @type {number} */
  #blockStep;

  /** @type {Array<number>} */
  #colors = [];

  #blocksPerLine;
  #lineStep;
  #planeStep;
  #byte = 0;
  #block = 0;
  #line = 0;
  #bit = 0;

  /**
   * @param {Uint8Array} buffer A Uint8Array containing the planar image data
   * @param {number} bytesPerBlock Number of concurrent bytes of bitplane chunk data
   * @param {number} blockStep Number of bytes to step over in order to reach next block of bitplane data
   * @param {number} blocksPerLine Number of blocks used to store a single scanline for a bitplane
   * @param {number} lineStep Number of bytes to step over in order to reach the next scanline of a bitplane
   * @param {number} planeStep Number of bytes to step over in order to reach the next bitplane
   * @param {number} planes Total number of bitplanes in the image 
   * @example <caption>Atari ST word-interleaved</caption>
   * new BitplaneReader(buffer, 2, planes * 2, 2, planes * 4, planes, 2) 
   * @example <caption>Amiga ILBM (line-interleaved)</caption>
   * const bytesPerLine = (width >> 3);
   * new BitplaneReader(buffer, bytesPerLine, 0, 1, bytesPerLine * planes, planes, bytesPerLine);
   * @example <caption>Amiga ACBM (contigous)</caption>
   * const bytesPerPlane = (width >> 3) * height;
   * new BitplaneReader(buffer, bytesPerPlane, 0, 1, 0, planes, bytesPerPlane);
  */
  constructor(buffer, bytesPerBlock, blockStep, blocksPerLine, lineStep, planes, planeStep) {
    this.#buffer = buffer;
    this.#planes = planes;
    this.#blocksPerLine = blocksPerLine;
    this.#bytesPerBlock = bytesPerBlock;
    this.#blockStep = blockStep;
    this.#lineStep = lineStep;
    this.#planeStep = planeStep;
  }
  

  /**
   * Reads the color palette index of the next pixel in the image.
   * 
   * @throws {RangeError} If the reader exceeds the bounds of the buffer
   * @returns {number} The palette index of the next pixel in the image
   */
  read() {

    const pos = this.#byte + (this.#block * this.#blockStep) + (this.#line * this.#lineStep);

    if (this.#bit === 0) {
      for (let bitNo = 0; bitNo < 8; bitNo++) {
        let color = 0;
        for (let plane = 0; plane < this.#planes; plane++) {
          const offset = pos + (plane * this.#planeStep);
          const byte = this.#buffer[offset];
          const bit = (byte >> (7 - bitNo)) & 1;
          color |= (bit << plane);
        }
        this.#colors[bitNo] = color;
      }
    }

    const color = this.#colors[this.#bit];
    this.#next();
    return color;
  }

  /**
   * Moves the reader forward by a specified number of pixels. Useful for 
   * clipping data.
   * @param {number} pixels The number of pixels to skip over
   */
  advance(pixels) {
    for (let c = pixels; c > 0; c--) {
      this.#next();
    }
  }

  /**
   * Advances the reader position by one pixel.
   */
  #next() {
    if (this.#bit < 7) {
      this.#bit++;
    } else {
      this.#bit = 0;
      if (this.#byte < this.#bytesPerBlock - 1) {
        this.#byte++;
      } else {
        this.#byte = 0;
        if (this.#block < this.#blocksPerLine - 1) {
          this.#block++;
        } else {
          this.#block = 0;
          this.#line++;
        }
      }
    }
  }

  /**
   * Creates a `BitplaneReader` instance configured for reading pixel data from 
   * a planar image that is encoded as a series of contiguous bitplanes.
   *
   * @param {Uint8Array} buffer A Uint8Array containing the planar image data
   * @param {number} planes Number of bitplanes in the image
   * @param {number} width The width of the image to decode in pixels
   * @param {number} height The height of the image to decode in pixels
   * @returns {BitplaneReader} A BitplaneReader instance configured to read contiguous planar data
   */
  static contiguous(buffer, planes, width, height) {
    const bytesPerPlane = (width >> 3) * height;
    return new BitplaneReader(buffer, bytesPerPlane, 0, 1, 0, planes, bytesPerPlane);
  }

  /**
   * Creates a `BitplaneReader` instance configured for reading pixel data from 
   * a planar image that is encoded as a series of line-interleaved bitplanes.
   *
   * @param {Uint8Array} buffer A Uint8Array containing the planar image data
   * @param {number} planes Number of bitplanes in the image
   * @param {number} width The width of the image in pixels
   * @returns {BitplaneReader} A BitplaneReader instance configured to read line-interleaved planar data
   */
  static line(buffer, planes, width) {
    const bytesPerLine = width >> 3;
    return new BitplaneReader(buffer, bytesPerLine, 0, 1, bytesPerLine * planes, planes, bytesPerLine);
  }

  /**
   * Creates a `BitplaneReader` instance configured for reading pixel data from 
   * a planar image that is encoded as a series of word-interleaved bitplanes.
   * 
   * @param {Uint8Array} buffer A Uint8Array containing the planar image data
   * @param {number} planes Number of bitplanes in the image
   * @returns {BitplaneReader} A BitplaneReader instance configured to read word-interleaved planar data
   */
  static word(buffer, planes) {
    return new BitplaneReader(buffer, 2, planes * 2, 2, planes * 4, planes, 2);
  }

}

/**
 * Provides an interface for writing pixel data to a planar image that is
 * encoded as a series bitplanes. The writer will walk the bitmap data, using
 * the `bytesPerBlock` and `blockStep` values passed to the constructor.
 * 
 * If you're working with bitplanes encoded as word-interleaved (Atari ST), 
 * line-interleaved (Amiga ILBM) or contiguous (Amiga ACBM), you can use the 
 * equivalent static methods to create a pre-configured writer instance. 
 */
class BitplaneWriter {

  /** @type {Uint8Array} */
  #buffer;

  /** @type {number} */
  #planes;

  /** @type {number} */
  #bytesPerBlock;

  /** @type {number} */
  #blockStep;

  #blocksPerLine;
  #lineStep;
  #planeStep;
  #byte = 0;
  #block = 0;
  #line = 0;
  #bit = 0;


  /**
   * 
   * @param {Uint8Array} buffer A Uint8Array containing the planar image data
   * @param {number} bytesPerBlock Number of concurrent bytes of bitplane data
   * @param {number} blockStep Number of bytes to step in order to reach next bitplane chunk 
   * @param {number} blocksPerLine Number of bytes used to store a single scanline for a bitplane
   * @param {number} lineStep Number of bytes to step in order to reach next scanline for a bitplane
   * @param {number} planeStep
   * @param {number} planes Number of bitplanes in the image 
   * @example <caption>Atari ST word-interleaved</caption>
   * const atariReader = new BitplaneWriter(buffer, 2, planes * 2, 2, planes * 4, planes, 2);
   * @example <caption>Amiga ILBM (line-interleaved)</caption>
   * const bytesPerLine = Math.ceil(width / 8);
   * const ilbmReader = new BitplaneWriter(buffer, bytesPerLine, 0, 1, bytesPerLine * planes, planes, bytesPerLine);
   * @example <caption>Amiga ACBM (contigous)</caption>
   * const bytesPerPlane = Math.ceil(width / 8) * height;
   * const acbmReader = new BitplaneWriter(buffer, bytesPerPlane, 0, 1, 0, planes, bytesPerPlane);
   */
  constructor(buffer, bytesPerBlock, blockStep, blocksPerLine, lineStep, planes, planeStep) {
    this.#buffer = buffer;
    this.#planes = planes;
    this.#blocksPerLine = blocksPerLine;
    this.#bytesPerBlock = bytesPerBlock;
    this.#blockStep = blockStep;
    this.#lineStep = lineStep;
    this.#planeStep = planeStep;
  }

  /**
   * Reads the next pixel and returns its color palette index.
   * 
   * @param {number} color The palette index of the next pixel in the image
   * @throws {RangeError} If the reader exceeds the bounds of the buffer
   */
  write(color) {

    const pos = this.#byte + (this.#block * this.#blockStep) + (this.#line * this.#lineStep);

    for (let plane = 0; plane < this.#planes; plane++) {
      const bit = color & 1;
      color >>= 1;
      if (bit) {
        const offset = pos + (plane * this.#planeStep);
        this.#buffer[offset] |= 1 << (7 - this.#bit);
      }
    }

    if (this.#bit < 7) {
      this.#bit++;
    } else {
      this.#bit = 0;
      if (this.#byte < this.#bytesPerBlock - 1) {
        this.#byte++;
      } else {
        this.#byte = 0;
        if (this.#block < this.#blocksPerLine - 1) {
          this.#block++;
        } else {
          this.#block = 0;
          this.#line++;
        }
      }
    }
  }

  /**
   * Creates a `BitplaneWriter` instance configured for writing pixel data to a 
   * planar image that is encoded as a series of contiguous bitplanes.
   *
   * @param {Uint8Array} buffer A Uint8Array containing the planar image data
   * @param {number} planes Number of bitplanes in the image
   * @param {number} width The width of the image in pixels.
   * @param {number} height The height of the image in pixels
   * @returns {BitplaneWriter} A BitplaneWriter instance configured to write contiguous planar data
   */
  static contiguous(buffer, planes, width, height) {
    const bytesPerPlane = Math.ceil(width / 8) * height;
    return new BitplaneWriter(buffer, bytesPerPlane, 0, 1, 0, planes, bytesPerPlane);
  }


  /**
   * Creates a `BitplaneWriter` instance configured for writing pixel data to a 
   * planar image that is encoded as a series of line-interleaved bitplanes.
   * 
   * @param {Uint8Array} buffer A Uint8Array containing the planar image data
   * @param {number} planes Number of bitplanes in the image
   * @param {number} width The width of the image in pixels
   * @returns {BitplaneWriter} A BitplaneWriter instance configured to write line-interleaved planar data
   */
  static line(buffer, planes, width) {
    const bytesPerLine = Math.ceil(width / 8);
    return new BitplaneWriter(buffer, bytesPerLine, 0, 1, bytesPerLine * planes, planes, bytesPerLine);
  }


  /**
   * Creates a `BitplaneWriter` instance configured for writing pixel data to a 
   * planar image that is encoded as a series of word-interleaved bitplanes.
   * 
   * @param {Uint8Array} buffer A Uint8Array containing the planar image data
   * @param {number} planes Number of bitplanes in the image
   * @returns {BitplaneWriter} A BitplaneWriter instance configured to write word-interleaved planar data
   */
  static word(buffer, planes) {
    return new BitplaneWriter(buffer, 2, planes * 2, 2, planes * 4, planes, 2);
  }

}

class PlanarCoderError extends Error {}

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
const parse4bitRgbColor = (value) => {
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
const parseAtariSteColor = (value) => {
  const { r, g, b } = parse4bitRgbColor(value);
  return {
    r: ((r & 8) >>> 3) | (r << 1) & 0xf,
    g: ((g & 8) >>> 3) | (g << 1) & 0xf,
    b: ((b & 8) >>> 3) | (b << 1) & 0xf 
  };
};


const createAtariSteIndexedPalette = (buffer, colors) => {  
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
const readAtariStIndexedPalette = (buffer, colors) => {  
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
const writeAtariStIndexedPalette = (buffer, palette) => {
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
const getPlaneCountForIndexedPalette = (palette) => {
  return Math.ceil(Math.log(palette.length) / Math.log(2))
};


/**
 * Extends a 32 colour palette by adding a 50% darker copy of every colour. This
 * palette mode is specific to Amiga hardware.
 * 
 * @param {IndexedPalette} palette - the palette to extend
 * @returns {IndexedPalette} the extended palette
 */
const createEhbPalette = (palette) => {
  const ehbPalette = new IndexedPalette(64);

  for (let c = 0; c < 32; c++) {
    const { r, g, b } = palette.getColor(c);
    ehbPalette.setColor(c, r, g, b);
    ehbPalette.setColor(c + 32, r / 2, g / 2, b / 2);
  }
  
  return ehbPalette;
};

/** Atari ST interleaved word format */
const ENCODING_FORMAT_WORD = 'word';

/** Amiga Interleaved Bitmap (ILBM) format */
const ENCODING_FORMAT_LINE = 'line';

/** Amiga Contiguous Bitmap (ACBM) format */
const ENCODING_FORMAT_CONTIGUOUS = 'contiguous';

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
 * Encodes `ImageData` to planar data and writes the result to a `Uint8Array`.
 *
 * @param {ImageData} imageData The image to convert
 * @param {IndexedPalette} palette The image palette
 * @param {import('./types.js').BitplaneEncodingOptions} options Conversion options
 * @returns {Uint8Array} A `Uint8Array` containing bitplane encoded data
 */
const encode$1 = (imageData, palette, options = {}) => {
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
const decode$1 = (buffer, width, height, palette, options = {}) => {

  const {
    planes = getPlaneCountForIndexedPalette(palette)
  } = options;

  const imageData = new ImageData(width, height);
  const { format = ENCODING_FORMAT_WORD } = options;
  const writer = new ImageDataIndexedPaletteWriter(imageData, palette);

  // Regardless of the output width, bitplanes are always stored in multiples of 
  // 16 bits. We need to calculate the width of the stored line for our reader
  // instance.
  const planeWidth = Math.ceil(width / 16) * 16;

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

/**
 * The IffChunkWriter provides an interface for writing IFF data to an 
 * underlying `ArrayBuffer`.
 */
class IffChunkWriter {

  /** @type {ArrayBuffer} */
  #buffer;

  /** @type {number} */
  #pos;

  /** @type {DataView} */
  #view;

  /** @type {TextEncoder} */
  #textEncoder;

  /** @type {Array<number>} */
  #chunkOffsetStack = [];

  /** @type {number} */
  #currentChunkOffset;

  /**
   * Creates a new IffChunkWriter that will fill an `ArrayBuffer`. An optional 
   * offset and length can be provided to limit the writer to a sub-set of data
   * with in the buffer.
   * 
   * @param {ArrayBuffer} buffer - The buffer to read from
   * @param {number?} byteOffset - byte offset into the buffer
   * @param {number?} byteLength - number of bytes to include
   */
  constructor(buffer, byteOffset, byteLength) {
    this.#pos = 0;
    this.#textEncoder = new TextEncoder();
    this.#view = new DataView(buffer, byteOffset, byteLength);
  }

  /**
   * Appends an empty IFF chunk to the buffer. The new chunk will become the 
   * context chunk, with write calls filling it with data until `endChunk()` is 
   * called. The chunk length field won't be set until `endChunk()` is called. 
   * 
   * As per the IFF spec, if the current buffer position isn't at an even offset
   * a padding byte will be added.
   * 
   * @param {string} type The four character code identifier for the chunk,
   */
  startChunk(type) {
    // if the pointer isn't on an even boundary, write a padding byte
    if (this.#pos % 2 === 1) {
      this.writeInt8(0);
    }
    this.writeString(type);
    this.writeUint32(0);
    this.#currentChunkOffset = this.#pos;
    this.#chunkOffsetStack.push(this.#currentChunkOffset);
  }

  /**
   * Closes the current chunk by writing the length into the chunk size field.
   * The context chunk will be set to the parent chunk.
   */
  endChunk() {
    let length = this.#pos - this.#currentChunkOffset;
    this.#view.setUint32(this.#currentChunkOffset - 4, length);
    this.#chunkOffsetStack.pop();
    this.#currentChunkOffset = this.#chunkOffsetStack[this.#chunkOffsetStack.length - 1];
    return length + 8;
  }

  writeUint8(value) {
    this.#view.setUint8(this.#pos++, value);
  }

  writeInt8(value) {
    this.#view.setInt8(this.#pos++, value);
  }

  writeUint16(value) {
    this.#view.setUint16(this.#pos, value);
    this.#pos += 2;
  }

  writeInt16(value) {
    this.#view.setInt16(this.#pos, value);
    this.#pos += 2;
  }

  writeUint32(value) {
    this.#view.setUint32(this.#pos, value);
    this.#pos += 4; 
  }

  writeInt32(value) {
    this.#view.setInt32(this.#pos, value);
    this.#pos += 2;
  }

  /**
   * Writes a specified number of bytes to the current chunk
   * 
   * @param {Uint8Array} value The bytes to write
   */
  writeBytes(value) {
    for (const byte of value) {
      this.writeUint8(byte);
    }
  }

  writeString(value) {
    return this.writeBytes(this.#textEncoder.encode(value));
  }

  trim() {
    if (this.#pos < this.#buffer.byteLength) {
      this.#buffer = this.#buffer.slice(0, this.#pos);
    }
  }

  get buffer() {
    return this.#buffer;
  }
}

/**
 * Decompresses data encoded with the packbits compression method
 * 
 * @param {ArrayBuffer} buffer A buffer containing the compressed data
 * @param {Number} size The number of bytes to decompress
 * @returns {ArrayBuffer} An array buffer containing the uncompressed data
 */
const depack = (buffer, size) => {
  const outputBuffer = new ArrayBuffer(size);
  const outView = new DataView(outputBuffer);
  const srcBuffer = new DataView(buffer);
  let srcPos = 0;
  let destPos = 0;

  while (destPos < size) {

    let byte = srcBuffer.getInt8(srcPos++);

    if (byte === -128) ; else if (byte < 0) {
      // One byte of data, repeated (1 − n) times in the decompressed output
      const byte2 = srcBuffer.getUint8(srcPos++);
      for (let c = 0; c < 1 - byte; c++) {
        outView.setUint8(destPos++, byte2);
      }
    } else {
      // (1 + n) literal bytes of data
      for (let c = 0; c < 1 + byte; c++) {
        outView.setUint8(destPos++, srcBuffer.getUint8(srcPos++));
      }
    }
  }
  return outputBuffer;
};



/**
 * Compress an entire image using the packbits compression method. Image is 
 * packed line-by-line to ensure decompression routines don't overflow.
 * 
 * @param {Uint8Array} source The uncompressed data
 * @param {number} bytesPerLine The number of bytes in a single scanline of data
 * @returns {Uint8Array} An array containing the compressed data
 */
const pack = (planeData, bytesPerLine) => {
  let pos = 0;
  const planeLength = bytesPerLine;
  const packedLineBuffer = new Uint8Array(planeLength * 2);
  const compressedData = new Uint8Array(planeData.length);

  for (let srcPos = 0; srcPos < planeData.byteLength; srcPos += planeLength) {
    const line = planeData.slice(srcPos, srcPos + planeLength);
    const packedLength = packLine(line, packedLineBuffer);
    compressedData.set(packedLineBuffer.slice(0, packedLength), pos);
    pos += packedLength;
  }

  return compressedData.slice(0, pos);
};



/**
 * Compress a single line of bit data using the packbits compression method
 * 
 * @param {Uint8Array} source The uncompressed data
 * @param {Uint8Array} dest The buffer to write compressed data to
 * @returns {number} The size of the compressed data
 */
const packLine = (source, dest) => {
  const RAW_DATA = 0;
  const RUN = 1;

  const MIN_RUN_LENGTH = 3;
  const MAX_RUN_LENGTH = 128;
  const MAX_DATA_LENGTH = 128;

  const cmdBuffer = new Uint8Array(MAX_DATA_LENGTH);

  function PutDump(count) {
    dest[destPos++] = count - 1;
    dest.set(cmdBuffer.slice(0, count), destPos);
    destPos += count;
  }

  function PutRun(count, byte) {
    dest[destPos++] = -(count - 1);
    dest[destPos++] = byte;
  }

  let srcPos = 0;
  let destPos = 0;
  let mode = RAW_DATA;
  let cmdBufferPos = 1;
  let rstart = 0;
  let rowSize = source.byteLength;

  let byte = source[srcPos];
  let lastByte = byte;
  cmdBuffer[0] = byte;
  rowSize--;
  srcPos++;

  while (rowSize) {
    // get next byte
    byte = source[srcPos];
    rowSize--;
    srcPos++;

    // add the byte to the command buffer
    cmdBuffer[cmdBufferPos] = byte;
    cmdBufferPos++;

    if (mode === RAW_DATA) {
      // A run of uncompressed bytes. 

      // If we've filled the command buffer copy it into the destination buffer 
      // and clear the command buffer ready for the next batch of data.
      if (cmdBufferPos > MAX_DATA_LENGTH) {
        PutDump(cmdBufferPos - 1);
        cmdBuffer[0] = byte;
        cmdBufferPos = 1;
        rstart = 0;
        break;
      }

      // If this byte matches the previous byte then we need to check that we've
      // had at least `MIN_RUN_LENGTH` copies before switching to RLE mode.
      if (byte === lastByte) {
        if (cmdBufferPos - rstart >= MIN_RUN_LENGTH) {
          if (rstart > 0) {
            PutDump(rstart);
          }
          mode = RUN;
        } else if (rstart === 0) {
          mode = RUN;
        }
      } else {
        rstart = cmdBufferPos - 1;
      }
    } else {
      // RLE
      if (byte !== lastByte || cmdBufferPos - rstart > MAX_RUN_LENGTH) {
        PutRun(cmdBufferPos - 1 - rstart, lastByte);
        cmdBuffer[0] = byte;
        cmdBufferPos = 1;
        rstart = 0;
        mode = RAW_DATA;
      }
    }
    lastByte = byte;
  }

  if (mode === RAW_DATA) {
    PutDump(cmdBufferPos);
  } else {
    PutRun(cmdBufferPos - rstart, lastByte);
  }

  return destPos;
};

/** Data is uncompressed */
const COMPRESSION_NONE = 0;

/** Data is compressed using the Packbits method */
const COMPRESSION_PACKBITS = 1;

/** Data is compressed using the Atari ST method (VDAT chunks in BODY) */
const COMPRESSION_ATARI = 2;

/** Image uses the Amiga Extra Half-Brite display mode */
const AMIGA_MODE_EHB = 0x0080;

/** Image uses the Amiga Hold and Modify display mode */
const AMIGA_MODE_HAM = 0x0800;

/** Image uses the Amiga high resolution display mode */
const AMIGA_MODE_HIRES = 0x8000;

/** Image uses the Amiga interlaced display mode */
const AMIGA_MODE_LACE = 0x0004;

const IFF_CHUNK_ID_FORM = 'FORM';
const IFF_CHUNK_ID_ILBM = 'ILBM';
const IFF_CHUNK_ID_ACBM = 'ACBM';
const IFF_CHUNK_ID_RAST = 'RAST';
const IFF_CHUNK_ID_BMHD = 'BMHD';
const IFF_CHUNK_ID_CAMG = 'CAMG';
const IFF_CHUNK_ID_CMAP = 'CMAP';
const IFF_CHUNK_ID_ABIT = 'ABIT';
const IFF_CHUNK_ID_BODY = 'BODY';
const IFF_CHUNK_ID_VDAT = 'VDAT';


const IFF_ENCODING_FORMAT_ILBM = 'ilbm';
const IFF_ENCODING_FORMAT_ACBM = 'acbm';

/**
 * @typedef {import('./types.js').IffEncodingOptions} IffEncodingOptions
 */

/**
 * Encodes a `ImageData` object into an IFF image
 * 
 * @param {ImageData} imageData - The image data to encode
 * @param {IndexedPalette} palette - The color palette to use
 * @param {IffEncodingOptions} options - The encoding options
 * @returns {ArrayBuffer} - The encoded IFF image bytes
 */
var encode = (imageData, palette, options = {}) => {

  /** @type {IndexedPalette} */
  let encodingPalette;

  const { 
    compression = COMPRESSION_PACKBITS,
    encoding = IFF_ENCODING_FORMAT_ILBM,
    amigaEhb = false,
    amigaLace = false,
    amigaHires = false,
    amigaHam = false,
    pageWidth = imageData.width,
    pageHeight = imageData.height,
    xAspectRatio = 1,
    yAspectRatio = 1
  } = options;

  const { height, width } = imageData;
  const format = encoding === IFF_ENCODING_FORMAT_ILBM ? ENCODING_FORMAT_LINE : ENCODING_FORMAT_CONTIGUOUS;
  const planeLength = Math.ceil(width / 8);

  // If the images uses extra-half-brite mode then we need to create the extra
  // palette colors before create the plane data.
  if (amigaEhb) {
    encodingPalette = createEhbPalette(palette);
  } else {
    encodingPalette = palette;
  }

  // Get the number of bitplanes required to store the palette
  const planes = getPlaneCountForIndexedPalette(encodingPalette);

  // Create the planar data using the relevant encoding format (`line` for ILBM 
  // or `contigous` for ACBM)
  let planeData = encode$1(imageData, encodingPalette, { format });

  // If compression is set and this is an ILBM, pack the planes. 
  if (compression && encoding === IFF_ENCODING_FORMAT_ILBM) {
    planeData = pack(planeData, planeLength);
  }

  const buffer = new ArrayBuffer(planeData.length + 2048);
  const writer = new IffChunkWriter(buffer);

  writer.startChunk(IFF_CHUNK_ID_FORM);
  
  if (encoding === IFF_ENCODING_FORMAT_ILBM) {
    writer.writeString(IFF_CHUNK_ID_ILBM);
  } else if (encoding === IFF_ENCODING_FORMAT_ACBM) {
    writer.writeString(IFF_CHUNK_ID_ACBM);
  } else {
    throw new PlanarCoderError('Unsupported IFF format');
  }

  // The header
  writer.startChunk(IFF_CHUNK_ID_BMHD);
  writer.writeUint16(width);            // [+0x00] image width
  writer.writeUint16(height);           // [+0x02] image height
  writer.writeInt16(0);                 // [+0x04] x-origin
  writer.writeInt16(0);                 // [+0x06] y-origin
  writer.writeUint8(planes);            // [+0x08] number of planes
  writer.writeUint8(0);                 // [+0x09] mask  
  writer.writeUint8(compression ? 1 : 0);  // [+0x0A] compression mode
  writer.writeUint8(0);                 // [+0x0B] padding byte  
  writer.writeUint16(0);                // [+0x0C] transparent color
  writer.writeUint8(xAspectRatio);      // [+0x0E] x aspect
  writer.writeUint8(yAspectRatio);      // [+0x0F] y aspect 
  writer.writeInt16(pageWidth);         // [+0x10] pageWidth
  writer.writeInt16(pageHeight);        // [+0x12] pageHeight
  writer.endChunk();
  
  // Write the CAMG chunk if it's needed.
  if (amigaEhb || amigaLace || amigaHires) {
    const flags = 
      (amigaEhb && AMIGA_MODE_EHB) |
      (amigaLace && AMIGA_MODE_LACE) |
      (amigaHires && AMIGA_MODE_HIRES);
    writer.startChunk(IFF_CHUNK_ID_CAMG);
    writer.writeUint32(flags);
    writer.endChunk();
  }

  // The palette
  writer.startChunk(IFF_CHUNK_ID_CMAP);
  for (const { r, g, b } of palette.resample(8)) {
    writer.writeUint8(r);
    writer.writeUint8(g);
    writer.writeUint8(b);
  }
  writer.endChunk();

  // Write the image body
  if (encoding === IFF_ENCODING_FORMAT_ILBM) {
    writer.startChunk(IFF_CHUNK_ID_BODY);
  } else {
    writer.startChunk(IFF_CHUNK_ID_ABIT);
  }
  writer.writeBytes(planeData);
  writer.endChunk();

  // Return the buffer
  return buffer.slice(0, writer.endChunk());
};

/**
 * Provides an interface for reading pixel data from a Amiga HAM encoded planar 
 * image.
 */
class HamReader extends BitplaneReader {

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

/** @typedef {import('./types.js').IffChunk} IffChunk */

/**
 * The IffChunkReader provides an interface for reading IFF data from an 
 * underlying `ArrayBuffer`.
 */
class IffChunkReader {
  
  /** @type {number} */
  #pos;

  /** @type {DataView} */
  #view;

  /** @type {TextDecoder} */
  #textDecoder;

  /**
   * Creates a new IffChunkReader from a `ArrayBuffer`. An optional offset and
   * length can be provided to limit the reader to a sub-set of data in the 
   * buffer.
   * 
   * @param {ArrayBuffer} buffer - The buffer to read from
   * @param {number?} byteOffset - byte offset into the buffer
   * @param {number?} byteLength - number of bytes to include
   */
  constructor(buffer, byteOffset, byteLength) {
    this.#pos = 0;
    this.#view = new DataView(buffer, byteOffset, byteLength);
    this.#textDecoder = new TextDecoder();
  }

  /**
   * Reads the next 8 bit value from the buffer.

   * @returns {number} 8 bit value
   */
  readUint8() {
    return this.#view.getUint8(this.#pos++);
  }

  /**
   * Reads the next 16 bit (big endian) value from the buffer.
   * 
   * @returns {number} 16 bit value
   */
  readUint16() {
    const value = this.#view.getUint16(this.#pos);
    this.#pos += 2;
    return value;
  }

  /**
   * Reads the next 32 bit (big endian) value from the buffer.
   * 
   * @returns {number} 32 bit value
   */
  readUint32() {
    const value = this.#view.getUint32(this.#pos);
    this.#pos += 4;
    return value;
  }

  /**
   * Reads a specified number of bytes from the buffer
   * 
   * @param {number} length The number of bytes to read
   * @returns {ArrayBuffer} an ArrayBuffer of bytes
   */
  readBytes(length) {
    const bytes = this.#view.buffer.slice(this.#view.byteOffset + this.#pos, this.#pos + this.#view.byteOffset + length);
    this.#pos += bytes.byteLength;
    return bytes;
  }

  /**
   * Reads an ASCII encoded string from the buffer
   * 
   * @param {number} length The number of bytes to read
   * @returns {string} The decoded string
   */
  readString(length) {
    return this.#textDecoder.decode(this.readBytes(length));
  }

  /**
   * Reads the next IFF chunk from the buffer.
   * 
   * @returns {IffChunk}
   */
  readChunk() {
    const id = this.readString(4);
    const length = this.readUint32();
    const dataStart = this.#view.byteOffset + this.#pos;
    const reader = new IffChunkReader(this.#view.buffer, dataStart, length);
    this.#pos += length;
    // IFF chunks are word aligned so, if the current offset is even, move over
    // the padding byte.
    if (this.#pos % 2 === 1 && !this.eof()) {
      // Some IFF writers don't honor the word aligment and forego the padding
      // byte. For compatability reasons we check that the next byte is a `0` 
      // before advancing the pointer.
      if (this.#view.getUint8(this.#pos) === 0) {
        this.#pos++;
      }
    }

    return {
      id,
      length,
      reader
    };
  }

  /**
   * Indicates if the reader has reached the end of the buffer or not.
   * 
   * @returns {boolean} `true` if all data has been read, or `false` if there is more to read.
   */
  eof() {
    return this.#pos === this.#view.byteLength;
  }

  /** 
   * Returns the current position in the output buffer
   * @type {number}
   */
  get position() {
    return this.#pos;
  }

  /** 
   * Returns the current length of the output buffer
   * @type {number}
   */
  get byteLength() {
    return this.#view.byteLength;
  }
}

/**
 * @typedef {import('./types.js').IffImage} IffImage
 * @typedef {import('./types.js').IffImageMetadata} IffImageMetadata
 */

/**
 * Decodes an IFF image and returns a ImageData object containing the
 * converted data. Supports:
 * - ILBM and ACBM formats
 * - Amiga Extra Half Brite (EHB)
 * - Amiga HAM6/8
 * - Compression (Uncompressed, Packbits and Atari ST vertical RLE)
 * 
 * @param {ArrayBuffer} buffer - An array buffer containing the IFF image
 * @returns {IffImage} The decoded image
 */
var decode = (buffer) => {

  let compression;
  let width;
  let height;
  let planes;
  let palette;
  let amigaMode;
  let bytesPerLine;
  let bitplaneData;
  let bitplaneEncoding;
  let xAspectRatio;
  let yAspectRatio;
  let pageWidth;
  let pageHeight;
  let rasters = [];

  const reader = new IffChunkReader(buffer);

  // Check this is an IFF
  const formChunk = reader.readChunk();
  if (formChunk.id !== IFF_CHUNK_ID_FORM) {
    error();
  }

  // Is this a bitmap image?
  const type = formChunk.reader.readString(4);
  if (type !== IFF_CHUNK_ID_ILBM && type !== IFF_CHUNK_ID_ACBM) {
    error();
  }

  // Some NEOchrome Master IFF images store their `RAST` data outside the `FORM` 
  // chunk so we need to check for that here. Since it's not uncommon for IFF 
  // files to contain trailing garbage, it's not safe to assume that the next 
  // blob of data is a valid IFF chunk, a new reader instance is used look ahead
  // to determine if the next chunk is valid without advancing the main reader.
  if (reader.position < reader.byteLength - 8) {
    const lookAheadReader = new IffChunkReader(buffer, reader.position, 8);
    const chunkId = lookAheadReader.readString(4);
    const chunkSize = lookAheadReader.readUint32();
    // A valid `RAST` chunk is exactly 6800 bytes. (34 bytes * 200 lines)
    if (chunkId === IFF_CHUNK_ID_RAST && chunkSize === 6800) {
      rasters = extractRasterData(reader.readChunk().reader);  
    }
  }

  // Decode the image chunks
  while (!formChunk.reader.eof()) {
    const { id, reader, length } = formChunk.reader.readChunk();

    // Parse the bitmap header.
    if (id === IFF_CHUNK_ID_BMHD) {
      width = reader.readUint16();          // [+0x00] image width
      height = reader.readUint16();         // [+0x02] image height
      reader.readUint16();                  // [+0x04] x-origin
      reader.readUint16();                  // [+0x06] y-origin
      planes = reader.readUint8();          // [+0x08] number of planes
      reader.readUint8();                   // [+0x09] mask  
      compression = reader.readUint8();     // [+0x0A] compression mode
      reader.readUint8();                   // [+0x0B] padding byte
      reader.readUint16();                  // [+0x0C] transparency
      xAspectRatio = reader.readUint8();    // [+ox0E] X aspect
      yAspectRatio = reader.readUint8();    // [+0x0F] Y aspect
      pageWidth = reader.readUint16();      // [+0x10] page width
      pageHeight = reader.readUint16();     // [+0x12] page height

      bytesPerLine = Math.ceil(width / 8);
    } 

    // The CAMG chunk. Contains Amiga mode meta data
    // - bit 3  -- Lace mode
    // - bit 7  -- EHB (Extra Half-Brite) mode
    // - bit 11 -- HAM Hold-And-Modify)
    // - bit 15 -- Hires mode
    else if (id === IFF_CHUNK_ID_CAMG) {
      amigaMode = reader.readUint32();
    }

    // The colour map. Stores the indexed palette.
    else if (id === IFF_CHUNK_ID_CMAP) {
      const size = length / 3;            // 3 bytes per colour entry
      palette = new IndexedPalette(size);
      for (let c = 0; c < size; c++) {
        const r = reader.readUint8();      // Red channel
        const g = reader.readUint8();      // Green channel
        const b = reader.readUint8();      // Blue channel
        palette.setColor(c, r, g, b);
      }
    }

    // NEOChrome Master ST rasters.
    else if (id === IFF_CHUNK_ID_RAST) {
      rasters = extractRasterData(reader);
    }

    // ABIT - ACBM bitmap data
    else if (id === IFF_CHUNK_ID_ABIT) {
      bitplaneData = reader.readBytes(length);
      bitplaneEncoding = ENCODING_FORMAT_CONTIGUOUS;
    }

    // Process the image body. If the image data is compressed then we 
    // decompress it into bitplane data.
    //
    // Note: We don't convert the image to `ImageData` here because some IFF 
    // implementations don't follow the spec properly and write the BODY chunk 
    // before other data.
    else if (id === IFF_CHUNK_ID_BODY) {
      
      // No compression. Images are stored in line-interleaved format.
      if (compression === COMPRESSION_NONE) {
        bitplaneData = reader.readBytes(length);
        bitplaneEncoding = ENCODING_FORMAT_LINE;
      }

      // Run-length encoded (Packbits)
      else if (compression === COMPRESSION_PACKBITS) {
        const outSize = bytesPerLine * height * planes;
        bitplaneData = depack(reader.readBytes(length), outSize);
        bitplaneEncoding = ENCODING_FORMAT_LINE;
      }

      // Atari ST "VDAT" compression. Images are stored as individual bitplanes
      // which are run-length encoded in 16 pixel vertical strips.
      else if (compression === COMPRESSION_ATARI) {
        const bytesPerPlane = bytesPerLine * height;
        const buffer = new Uint8Array(bytesPerPlane * planes);
        let offset = 0;

        // Each bitplane is stored in its own "VDAT" chunk. The data in these
        // chunks is compressed and stored as a set of contiguous bitplanes
        while (!reader.eof()) {
          const { id, reader: chunkReader } = reader.readChunk();
          if (id === IFF_CHUNK_ID_VDAT) {
            const planeBuffer = depackVdatChunk(chunkReader, bytesPerLine, height);
            buffer.set(new Uint8Array(planeBuffer), offset);
            offset += bytesPerPlane;
          }
        }

        // Combine all bitplanes and encode the result as contiguous
        bitplaneData = buffer.buffer;
        bitplaneEncoding = ENCODING_FORMAT_CONTIGUOUS;
      }
    }
  }

  // Assert that we have all the required structures before we try to convert
  // the image into an `ImageData` object.

  // FIXME: Only indexed palette images are currently supported
  if (!bitplaneData || !palette) {
    error();
  }

  // If the image uses the Amiga's Extra Half-Brite mode then force the palette
  // to contain a maximum of 32 entires as some images contain extra color data 
  // in the CMAP chunk.
  if (amigaMode & AMIGA_MODE_EHB && palette.length > 32) {
    palette = IndexedPalette.fromValueArray(palette.toValueArray().slice(0, 32));
  }

  // Decode the bitplane data into `ImageData` and return it along with the 
  // palette.
  let imageData = new ImageData(width, height);

  /** @type {IffImageMetadata} */
  const meta = {
    compression,
    xAspectRatio,
    yAspectRatio,
    pageWidth,
    pageHeight,
    encoding: bitplaneEncoding === ENCODING_FORMAT_LINE ? IFF_ENCODING_FORMAT_ILBM : IFF_ENCODING_FORMAT_ACBM,
    amigaLace: !!(amigaMode & AMIGA_MODE_LACE),
    amigaEhb: !!(amigaMode & AMIGA_MODE_EHB),
    amigaHam: !!(amigaMode & AMIGA_MODE_HAM),
    amigaHires: !!(amigaMode & AMIGA_MODE_HIRES),
    planeCount: planes,
    palette
  };

  // If the image uses the Amiga's Extra Half-Brite mode we need to add the 
  // extra half-bright colours to be able to decode the image correctly.
  if (amigaMode & AMIGA_MODE_EHB) {
    palette = createEhbPalette(palette);
  }

  // This is an Amiga HAM image.
  if (amigaMode & AMIGA_MODE_HAM) {
    imageData = decodeHamImage(bitplaneData, width, height, planes, palette);
  }

  // If the image uses `RAST` chunks then we need to process the image line by 
  // line, decoding it with the relevent palette.
  else if (rasters.length) {
    meta.palette = rasters;
    imageData = decodeRasterImage(bitplaneData, width, height, planes, palette, rasters);
  } 
  
  else {
    imageData = decode$1(new Uint8Array(bitplaneData), width, height, palette, { format: bitplaneEncoding });
  }

  return {
    imageData: imageData,
    meta
  };
};


/**
 * Decompresses a single bitplane of data (stored in a VDAT chunk)
 * 
 * @param {IffChunkReader} reader - A chunk reader instance
 * @param {number} bytesPerLine - Number of bytes in a bitplane scanline
 * @param {number} height - Number of vertical pixels in the image
 * @returns {ArrayBuffer} - Decompressed bitplane data
 */
const depackVdatChunk = (reader, bytesPerLine, height) => {
  const commandCount = reader.readUint16() - 2;
  const commands = new Int8Array(reader.readBytes(commandCount));
  const planeData = new Uint8Array(bytesPerLine * height);

  let xOffset = 0;
  let yOffset = 0;

  /** @type {number} */
  let count;

  for (let cmd = 0; cmd < commandCount; cmd++) {

    const command = commands[cmd];

    if (command <= 0) { 
      if (command === 0) {
        // If cmd == 0 the copy count is taken from the data
        count = reader.readUint16();
      } else {
        // If cmd < 0 the copy count is taken from the command
        count = -command;
      }
      
      // write the data to the bitplane buffer
      while (count-- > 0 && xOffset < bytesPerLine) {
        const offset = xOffset + yOffset * bytesPerLine;
        planeData[offset] = reader.readUint8();
        planeData[offset + 1] = reader.readUint8();
        if (++yOffset >= height) {
          yOffset = 0;
          xOffset += 2;
        }    
      }
      
    } else { 
      if (command == 1) {
        // If cmd == 1 the run-length count is taken from the data
        count = reader.readUint16();
      } else {
        // If cmd > 1 the command is used as the run-length count
        count = command;
      }

      // Read the 16 bit values to repeat.
      const hiByte = reader.readUint8();
      const loByte = reader.readUint8();
    
      // write the run-length encoded data to the bitplane buffer
      while (count-- > 0 && xOffset < bytesPerLine) {
        const offset = xOffset + yOffset * bytesPerLine;
        planeData[offset] = hiByte;
        planeData[offset + 1] = loByte;
        if (++yOffset >= height) {
          yOffset = 0;
          xOffset += 2;
        }
      }
    
      // Some images overflow so check EOF and bail out if we're done
      if (reader.eof()) {
        break;
      }

    }
  }
  return planeData.buffer;
};


/**
 * Parses an Atari ST `RAST` chunk
 * 
 * @param {IffChunkReader} reader The `RAST` IFF chunk
 * @returns {Array<IndexedPalette>} A palette for each scan line of the image
 */
const extractRasterData = (reader) => {
  const rasters = [];

  while (!reader.eof()) {
    const line = reader.readUint16();
    const colors = new Uint8Array(reader.readBytes(32));
    rasters[line] = readAtariStIndexedPalette(colors, 16);
  }

  // Rasters can be missing for scanlines so we fill in the gaps
  for (let r = 1; r < 200; r++) {
    if (!rasters[r]) {
      rasters[r] = rasters[r - 1];
    }
  }

  return rasters;
};


/**
 * Decodes a HAM (Hold and Modify) encoded image
 * 
 * @param {ArrayBuffer} bitplaneData A buffer containing the raw bitplane data
 * @param {number} width The width of the image
 * @param {number} height The height of the image
 * @param {number} planes The number of bitplanes for the image
 * @param {IndexedPalette} palette The 16 color base palette
 */
const decodeHamImage = (bitplaneData, width, height, planes, palette) => {
  const imageData = new ImageData(width, height);
  const reader = new HamReader(new Uint8Array(bitplaneData), planes, width, palette);
  const planeWidth = Math.ceil(width / 16) * 16;
  const pixels = new DataView(imageData.data.buffer);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels.setUint32((y * width + x) * 4, reader.read());
    }
    // Consume any remaining pixels if the image width is not a multiple of 16
    reader.advance(planeWidth - width);
  }

  return imageData;
};


/**
 * Decodes a ILBM encoded image that uses per-scanline rasters
 * 
 * @param {ArrayBuffer} bitplaneData A buffer containing the raw bitplane data
 * @param {number} width The width of the image
 * @param {number} height The height of the image
 * @param {number} planes The number of bitplanes for the image
 * @param {IndexedPalette} palette The color base palette
 * @param {IndexedPalette[]} rasters The raster color palettes
 * @returns {ImageData} A `ImageData` object containing the decoded data
 */
const decodeRasterImage = (bitplaneData, width, height, planes, palette, rasters) => {
  const imageData = new ImageData(width, height);
  const reader = BitplaneReader.line(new Uint8Array(bitplaneData), planes, width);
  const writer = new ImageDataIndexedPaletteWriter(imageData, palette);

  for (let y = 0; y < height; y++) {
    writer.setPalette(rasters[y].resample(8));
    for (let x = 0; x < width; x++) {
      writer.write(reader.read());
    }
  }

  return imageData;
};


/**
 * Helper method for reporting terminal errors
 */
const error = () => {
  throw new PlanarCoderError('Invalid file format');
};

export { BitplaneReader, BitplaneWriter, ENCODING_FORMAT_CONTIGUOUS, ENCODING_FORMAT_LINE, ENCODING_FORMAT_WORD, ImageDataIndexedPaletteReader, ImageDataIndexedPaletteWriter, IndexedPalette, decode$1 as decode, decode as decodeIff, encode$1 as encode, encode as encodeIff, readAtariStIndexedPalette, writeAtariStIndexedPalette };
