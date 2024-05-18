/**
 * Provides an interface for writing pixel data to a planar image that is
 * encoded as a series bitplanes. The writer will walk the bitmap data, using
 * the `bytesPerBlock` and `blockStep` values passed to the constructor.
 * 
 * If you're working with bitplanes encoded as word-interleaved (Atari ST), 
 * line-interleaved (Amiga ILBM) or contiguous (Amiga ACBM), you can use the 
 * equivalent static methods to create a pre-configured writer instance. 
 */
export default class BitplaneWriter {

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
