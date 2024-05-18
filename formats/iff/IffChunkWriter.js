/**
 * The IffChunkWriter provides an interface for writing IFF data to an 
 * underlying `ArrayBuffer`.
 */
export default class IffChunkWriter {

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
