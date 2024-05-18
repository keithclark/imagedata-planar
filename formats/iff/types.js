import IffChunkReader from "./IffChunkReader.js";
import {
  COMPRESSION_NONE,
  COMPRESSION_PACKBITS,
  COMPRESSION_ATARI,
  IFF_ENCODING_FORMAT_ILBM,
  IFF_ENCODING_FORMAT_ACBM
} from "./consts.js";

/**
 * @typedef {IFF_ENCODING_FORMAT_ILBM|IFF_ENCODING_FORMAT_ACBM} IffImageEncodingType
 */

/**
 * @typedef {COMPRESSION_NONE|COMPRESSION_PACKBITS|COMPRESSION_ATARI} IffImageCompressionType
 */

/**
 * @typedef IffCoderOptions
 * @property {IffImageCompressionType} compression Should the image be compressed
 * @property {IffImageEncodingType} encoding The encoding format 
 * @property {boolean} amigaLace Indicates if this image requires the Amiga interlaced graphics mode
 * @property {boolean} amigaEhb Indicates if this image requires the Amiga EHB (extra half-brite) graphics mode
 * @property {boolean} amigaHam Indicates if this image requires the Amiga HAM (hold-and-modify) graphics mode
 * @property {boolean} amigaHires Indicates if this image requires the Amiga high resolution graphics mode
 * @property {number} pageWidth width of the raster device this image was created for
 * @property {number} pageHeight height of the raster device this image was created for
 * @property {number} xAspectRatio x component of the aspect ratio
 * @property {number} yAspectRatio y component of the aspect ratio
 */

/**
 * @typedef IffDecodeProperties
 * @property {IndexedPalette|IndexedPalette[]} palette The palette or raster palettes for the image
 */

/**
 * @typedef {IffEncodingOptions & IffDecodeProperties} IffImageMetadata
 */

/**
 * @typedef IffImage
 * @property {ImageData} imageData - The decoded image data
 * @property {IffImageMetadata} meta - The image metadata
 */

/**
 * @typedef {IffCoderOptions} IffEncodingOptions
 */

/**
 * @typedef IffChunk
 * @property {string} id - The four-character chunk identifier
 * @property {number} length - The length of the chunk data
 * @property {IffChunkReader} reader - A `IffChunkReader` instance for reading chunk contents
 */
