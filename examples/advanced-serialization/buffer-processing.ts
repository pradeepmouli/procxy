/**
 * Example: Buffer Processing with Advanced Serialization
 *
 * Demonstrates using Buffer arguments and return values with procxy.
 * Requires serialization: 'advanced' mode.
 */

import { procxy } from '../../src/index.js';
import { fileURLToPath } from 'node:url';

/**
 * Image processor that works with binary data
 */
class ImageProcessor {
  /**
   * Apply a simple XOR filter to image data
   */
  applyFilter(imageData: Buffer, filterValue: number = 0xff): Buffer {
    const result = Buffer.alloc(imageData.length);
    for (let i = 0; i < imageData.length; i++) {
      result[i] = imageData[i] ^ filterValue;
    }
    return result;
  }

  /**
   * Get image dimensions from header (simplified example)
   */
  getDimensions(imageData: Buffer): { width: number; height: number } {
    // Simplified: assume first 8 bytes are width/height as 32-bit integers
    const width = imageData.readUInt32LE(0);
    const height = imageData.readUInt32LE(4);
    return { width, height };
  }

  /**
   * Concatenate multiple image buffers
   */
  concat(buffers: Buffer[]): Buffer {
    return Buffer.concat(buffers);
  }
}

async function main() {
  console.log('🖼️  Buffer Processing Example\n');

  // Create processor with advanced serialization
  console.log('Creating ImageProcessor with advanced serialization...');
  await using processor = await procxy(ImageProcessor, {
    modulePath: fileURLToPath(import.meta.url),
    serialization: 'advanced'
  });

  // Example 1: Apply filter to binary data
  console.log('\n📝 Example 1: Applying XOR filter');
  const imageData = Buffer.from([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77]);
  console.log('Input:', imageData);

  const filtered = await processor.applyFilter(imageData, 0xff);
  console.log('Filtered:', filtered);
  console.log('Verification:', Buffer.from([0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa, 0x99, 0x88]));

  // Example 2: Get dimensions from header
  console.log('\n📏 Example 2: Reading image dimensions');
  const header = Buffer.alloc(8);
  header.writeUInt32LE(1920, 0); // width
  header.writeUInt32LE(1080, 4); // height

  const dimensions = await processor.getDimensions(header);
  console.log('Dimensions:', dimensions);

  // Example 3: Concatenate buffers
  console.log('\n🔗 Example 3: Concatenating buffers');
  const part1 = Buffer.from('Hello, ');
  const part2 = Buffer.from('World!');
  const combined = await processor.concat([part1, part2]);
  console.log('Combined:', combined.toString());

  console.log('\n✅ Buffer processing completed successfully!');
}

// Run the example
main().catch(console.error);
