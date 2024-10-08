/**
 * Provides an interface for reading pixel data from a planar image that is
 * encoded as a series bitplanes. The reader will walk the bitmap data, using
 * the `bytesPerBlock` and `blockStep` values passed to the constructor.
 * 
 * If you're working with bitplanes encoded as word-interleaved (Atari ST), 
 * line-interleaved (Amiga ILBM) or contiguous (Amiga ACBM), you can use the 
 * equivalent static methods to create a pre-configured reader instance.
 */
export default class BitplaneReader {

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
