import { encode } from '../../encode.js';
import IffChunkWriter from './IffChunkWriter.js';
import { pack } from '../../compression/packbits.js';
import PlanarCoderError from '../../lib/PlanarCoderError.js';
import { getPlaneCountForIndexedPalette, createEhbPalette } from '../../IndexedPaletteHelpers.js';

import {
  ENCODING_FORMAT_CONTIGUOUS,
  ENCODING_FORMAT_LINE
} from '../../consts.js';

import { 
  AMIGA_MODE_EHB,
  AMIGA_MODE_HIRES,
  AMIGA_MODE_LACE,
  COMPRESSION_PACKBITS,
  IFF_CHUNK_ID_ABIT,
  IFF_CHUNK_ID_ACBM,
  IFF_CHUNK_ID_BMHD,
  IFF_CHUNK_ID_BODY,
  IFF_CHUNK_ID_CAMG,
  IFF_CHUNK_ID_CMAP,
  IFF_CHUNK_ID_FORM,
  IFF_CHUNK_ID_ILBM,
  IFF_ENCODING_FORMAT_ACBM,
  IFF_ENCODING_FORMAT_ILBM
} from './consts.js';

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
export default (imageData, palette, options = {}) => {

  /** @type {IndexedPalette} */
  let encodingPalette;

  const { 
    compression = COMPRESSION_PACKBITS,
    encoding = IFF_ENCODING_FORMAT_ILBM,
    amigaEhb = false,
    amigaLace = false,
    amigaHires = false,
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
  let planeData = encode(imageData, encodingPalette, { format });

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
