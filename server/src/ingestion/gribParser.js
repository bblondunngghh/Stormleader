import logger from '../utils/logger.js';

/**
 * Best-effort GRIB2 parser for MRMS MESH data.
 *
 * GRIB2 structure:
 *   Section 0: Indicator (16 bytes) - "GRIB" magic, discipline, edition, total length
 *   Section 1: Identification - originating center, reference time, production status
 *   Section 2: Local Use (optional)
 *   Section 3: Grid Definition - grid template, number of points, lat/lon of first/last gridpoint
 *   Section 4: Product Definition - parameter category/number, generating process
 *   Section 5: Data Representation - template, number of data points, packing method
 *   Section 6: Bit-Map (optional)
 *   Section 7: Data - packed grid values
 *   Section 8: End ("7777")
 *
 * Production use should rely on a native GRIB2 library (e.g. grib2-simple, eccodes bindings).
 * This stub extracts header metadata and attempts to read grid values from simple packing.
 */
export function parseGrib(buffer) {
  const view = new DataView(buffer.buffer || buffer);

  // Verify GRIB magic bytes
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== 'GRIB') {
    throw new Error('Not a valid GRIB file');
  }

  const edition = view.getUint8(7);
  if (edition !== 2) {
    logger.warn(`GRIB edition ${edition}, expected 2`);
  }

  // Parse total message length from bytes 8-15 (8 bytes big-endian)
  const totalLength = Number(view.getBigUint64(8));
  logger.info(`GRIB2 message length: ${totalLength} bytes`);

  // Scan sections to find Section 3 (Grid Definition)
  // Each section starts with a 4-byte length and 1-byte section number
  let offset = 16; // skip Section 0 (Indicator)
  let width = 0;
  let height = 0;
  let bbox = { west: -130, south: 20, east: -60, north: 55 }; // CONUS defaults
  let dataOffset = -1;
  let numDataPoints = 0;
  let referenceValue = 0;
  let binaryScaleFactor = 0;
  let decimalScaleFactor = 0;
  let bitsPerValue = 0;

  try {
    while (offset < buffer.length - 4) {
      const sectionLength = view.getUint32(offset);
      if (sectionLength < 5 || sectionLength > buffer.length - offset) break;

      const sectionNumber = view.getUint8(offset + 4);

      if (sectionNumber === 3) {
        // Grid Definition Section
        // Template 0 (Lat/Lon grid): Ni at byte 30, Nj at byte 34
        numDataPoints = view.getUint32(offset + 6);
        if (sectionLength > 40) {
          width = view.getUint32(offset + 30);
          height = view.getUint32(offset + 34);
          // First gridpoint lat/lon at bytes 46-53 (scaled by 1e6)
          const lat1 = view.getInt32(offset + 46) / 1e6;
          const lon1 = view.getInt32(offset + 50) / 1e6;
          // Last gridpoint at bytes 55-62
          const lat2 = view.getInt32(offset + 55) / 1e6;
          const lon2 = view.getInt32(offset + 59) / 1e6;
          bbox = {
            south: Math.min(lat1, lat2),
            north: Math.max(lat1, lat2),
            west: Math.min(lon1, lon2),
            east: Math.max(lon1, lon2),
          };
        }
      }

      if (sectionNumber === 5) {
        // Data Representation Section - simple packing (template 0)
        numDataPoints = view.getUint32(offset + 5);
        // Reference value is an IEEE 754 float at byte 11
        referenceValue = view.getFloat32(offset + 11);
        binaryScaleFactor = view.getInt16(offset + 15);
        decimalScaleFactor = view.getInt16(offset + 17);
        bitsPerValue = view.getUint8(offset + 19);
      }

      if (sectionNumber === 7) {
        // Data Section - actual packed values start at byte 5
        dataOffset = offset + 5;
      }

      // Check for end section "7777"
      if (sectionNumber === 8 || (buffer.length >= offset + 4 &&
          view.getUint8(offset) === 55 && view.getUint8(offset + 1) === 55 &&
          view.getUint8(offset + 2) === 55 && view.getUint8(offset + 3) === 55)) {
        break;
      }

      offset += sectionLength;
    }
  } catch (err) {
    logger.warn({ err }, 'Error scanning GRIB sections, using defaults');
  }

  // Attempt to unpack grid values using simple packing formula:
  //   Y = R + (X * 2^E) / 10^D
  // where R = referenceValue, E = binaryScaleFactor, D = decimalScaleFactor
  const count = width * height || numDataPoints || 0;
  const values = new Float32Array(count);

  if (dataOffset > 0 && bitsPerValue > 0 && count > 0) {
    try {
      const binaryScale = Math.pow(2, binaryScaleFactor);
      const decimalScale = Math.pow(10, decimalScaleFactor);

      for (let i = 0; i < count; i++) {
        const bitOffset = i * bitsPerValue;
        const bytePos = dataOffset + Math.floor(bitOffset / 8);
        const bitPos = bitOffset % 8;

        if (bytePos + 2 >= buffer.length) break;

        // Read packed integer value (up to 16 bits)
        const raw = (view.getUint8(bytePos) << 8 | view.getUint8(bytePos + 1));
        const shifted = (raw >> (16 - bitPos - bitsPerValue)) & ((1 << bitsPerValue) - 1);

        values[i] = (referenceValue + shifted * binaryScale) / decimalScale;
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to unpack GRIB data values');
    }
  }

  if (!width || !height) {
    // Estimate square grid from point count
    const side = Math.ceil(Math.sqrt(count || 3500 * 1750));
    width = width || side;
    height = height || side;
  }

  logger.info(`Parsed GRIB: ${width}x${height} grid, bbox: [${bbox.west},${bbox.south},${bbox.east},${bbox.north}]`);

  return { width, height, values, bbox };
}
