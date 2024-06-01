import HamReader from './HamReader.js';
import IffChunkReader from './IffChunkReader.js';
import { depack as depackPackBits } from '../../compression/packbits.js';
import { ENCODING_FORMAT_CONTIGUOUS, ENCODING_FORMAT_LINE } from '../../consts.js';
import { readAtariStIndexedPalette, createEhbPalette } from '../../IndexedPaletteHelpers.js';

import { decode } from '../../decode.js';
import IndexedPalette from '../../lib/IndexedPalette.js';
import ImageDataIndexedPaletteWriter from '../../lib/ImageDataIndexedPaletteWriter.js';
import PlanarCoderError from '../../lib/PlanarCoderError.js';
import BitplaneReader from '../../lib/BitplaneReader.js';

import { 
  COMPRESSION_NONE,
  COMPRESSION_PACKBITS,
  COMPRESSION_ATARI,
  AMIGA_MODE_EHB,
  AMIGA_MODE_HAM,
  AMIGA_MODE_HIRES,
  AMIGA_MODE_LACE,
  IFF_CHUNK_ID_FORM,
  IFF_CHUNK_ID_ILBM,
  IFF_CHUNK_ID_ACBM,
  IFF_CHUNK_ID_RAST,
  IFF_CHUNK_ID_BMHD,
  IFF_CHUNK_ID_CMAP,
  IFF_CHUNK_ID_CAMG,
  IFF_CHUNK_ID_ABIT,
  IFF_CHUNK_ID_BODY,
  IFF_CHUNK_ID_VDAT,
  IFF_ENCODING_FORMAT_ACBM,
  IFF_ENCODING_FORMAT_ILBM,
  IFF_CHUNK_ID_CTBL,
  IFF_CHUNK_ID_BEAM,
  IFF_CHUNK_ID_SHAM
} from './consts.js';

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
export default (buffer) => {

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

      bytesPerLine = Math.ceil(width / 16) * 2;
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

    // Amiga "Sliced" HAM — various flavours
    else if (id === IFF_CHUNK_ID_CTBL || id === IFF_CHUNK_ID_BEAM || id === IFF_CHUNK_ID_SHAM) {
      if (id === IFF_CHUNK_ID_SHAM) {
        reader.readUint16(); 
      }
      rasters = [];
      const paletteCount = (reader.byteLength - reader.position) / 32;
      for (let paletteIndex = 0; paletteIndex < paletteCount; paletteIndex++) {
        const linePalette = new IndexedPalette(16, { bitsPerChannel: 4 });
        for (let colorIndex = 0; colorIndex < 16; colorIndex++) {
          const rgb = reader.readUint16();
          const r = (rgb >> 8) & 0xf;
          const g = (rgb >> 4) & 0xf;
          const b = (rgb) & 0xf;
          linePalette.setColor(colorIndex, r, g, b);
        }
        rasters.push(linePalette)
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
        bitplaneData = depackPackBits(reader.readBytes(length), outSize);
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
  // extra half-bright colors to be able to decode the image correctly.
  if (amigaMode & AMIGA_MODE_EHB) {
    palette = createEhbPalette(palette);
  }

  // This is an Amiga HAM image.
  if (amigaMode & AMIGA_MODE_HAM) {
    // Is this is a sliced HAM?
    if (rasters.length) {
      let colors = rasters;
      // `SHAM` chunks use the same palette for odd/even frames when rendering
      // laced images, so we need to double up the palette before decoding.
      // `CTBL` chunks contain an entry for each line.
      if (rasters.length < height) {
        colors = [];
        for (let c = 0; c < height; c++) {
          colors.push(rasters[c * rasters.length / height | 0])
        }
      }
      imageData = decodeSlicedHamImage(bitplaneData, width, height, planes, colors);
    } else {
      imageData = decodeHamImage(bitplaneData, width, height, planes, palette);
    }
  }

  // If the image uses `RAST` chunks then we need to process the image line by 
  // line, decoding it with the relevent palette.
  else if (rasters.length) {
    imageData = decodeRasterImage(bitplaneData, width, height, planes, palette, rasters);
  } 
  
  else {
    imageData = decode(new Uint8Array(bitplaneData), width, height, palette, { format: bitplaneEncoding });
  }

  if (rasters.length) {
    meta.palette = rasters;
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
 * @param {IndexedPalette} palette A single 16 color base palette
 */
const decodeHamImage = (bitplaneData, width, height, planes, palette) => {
  const imageData = new ImageData(width, height);
  const planeWidth = Math.ceil(width / 16) * 16;
  const pixels = new DataView(imageData.data.buffer);
  const reader = new HamReader(new Uint8Array(bitplaneData), planes, width, palette);
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
 * Decodes a Sliced HAM (Hold and Modify) encoded image. Decoding is identical
 * to the standard HAM method, but with a new palette set for each scanline.
 * 
 * @param {ArrayBuffer} bitplaneData A buffer containing the raw bitplane data
 * @param {number} width The width of the image
 * @param {number} height The height of the image
 * @param {number} planes The number of bitplanes for the image
 * @param {Array<IndexedPalette>} palette An array of 16 color palettes, one for each scanline
 */
const decodeSlicedHamImage = (bitplaneData, width, height, planes, palette) => {
  const imageData = new ImageData(width, height);
  const planeWidth = Math.ceil(width / 16) * 16;
  const pixels = new DataView(imageData.data.buffer);
  const reader = new HamReader(new Uint8Array(bitplaneData), planes, width, palette[0]);
  for (let y = 0; y < height; y++) {
    reader.setPalette(palette[y].resample(8))
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
