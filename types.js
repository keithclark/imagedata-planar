/* eslint-disable no-unused-vars */
import { 
  ENCODING_FORMAT_CONTIGUOUS,
  ENCODING_FORMAT_LINE,
  ENCODING_FORMAT_WORD
} from './consts.js';

/**
 * @typedef {ENCODING_FORMAT_CONTIGUOUS|ENCODING_FORMAT_LINE|ENCODING_FORMAT_WORD} BitplaneEncodingFormat
 */

/** 
 * @typedef BitplaneEncodingOptions
 * @property {BitplaneEncodingFormat} format Bitplane encoding format.
 * @property {Number} planes The number of bitplanes to encode. If omitted the plane count will be determined by the number of colors in the palette.
*/

/**
 * @typedef {import('./lib/IndexedPalette.js').default} IndexedPalette
 */

/**
 * @typedef {(buffer:ArrayBuffer)=>{imageData:ImageData,meta?:{}}} PlanarImageDecoder
 */

/**
 * @typedef {(imageData:ImageData,palette:IndexedPalette)=>ArrayBuffer} PlanarImageEncoder
 */


export default null;
