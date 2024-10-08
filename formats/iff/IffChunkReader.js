/** @typedef {import('./types.js').IffChunk} IffChunk */

/**
 * The IffChunkReader provides an interface for reading IFF data from an 
 * underlying `ArrayBuffer`.
 */
export default class IffChunkReader {
  
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
