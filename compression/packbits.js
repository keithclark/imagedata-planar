/**
 * Decompresses data encoded with the packbits compression method
 * 
 * @param {ArrayBuffer} buffer A buffer containing the compressed data
 * @param {Number} size The number of bytes to decompress
 * @returns {ArrayBuffer} An array buffer containing the uncompressed data
 */
export const depack = (buffer, size) => {
  const outputBuffer = new ArrayBuffer(size);
  const outView = new DataView(outputBuffer);
  const srcBuffer = new DataView(buffer);
  let srcPos = 0;
  let destPos = 0;

  while (destPos < size) {

    let byte = srcBuffer.getInt8(srcPos++);

    if (byte === -128) {
      // No Op
    } else if (byte < 0) {
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
export const pack = (planeData, bytesPerLine) => {
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
export const packLine = (source, dest) => {
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
}
