/**
 * Test fixture for V8 advanced serialization mode
 * Demonstrates usage of Buffer, TypedArray, Map, Set, BigInt, etc.
 */
export class BinaryProcessor {
  private cache: Map<string, Buffer> = new Map();
  private processedIds: Set<number> = new Set();

  /**
   * Process binary data (Buffer)
   */
  processBuffer(data: Buffer): Buffer {
    // Simple transformation: XOR with 0xFF
    const result = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] ^ 0xff;
    }
    return result;
  }

  /**
   * Process TypedArray data
   */
  processTypedArray(data: Uint8Array): Uint8Array {
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] * 2;
    }
    return result;
  }

  /**
   * Store data in cache (Map)
   */
  cacheData(key: string, data: Buffer): void {
    this.cache.set(key, data);
  }

  /**
   * Retrieve data from cache (Map)
   */
  getCachedData(key: string): Buffer | undefined {
    return this.cache.get(key);
  }

  /**
   * Get all cache entries
   */
  getAllCache(): Map<string, Buffer> {
    return new Map(this.cache);
  }

  /**
   * Mark ID as processed (Set)
   */
  markProcessed(id: number): void {
    this.processedIds.add(id);
  }

  /**
   * Check if ID was processed (Set)
   */
  isProcessed(id: number): boolean {
    return this.processedIds.has(id);
  }

  /**
   * Get all processed IDs
   */
  getProcessedIds(): Set<number> {
    return new Set(this.processedIds);
  }

  /**
   * Process BigInt values
   */
  multiplyBigInt(a: bigint, b: bigint): bigint {
    return a * b;
  }

  /**
   * Calculate large timestamp
   */
  getNanosTimestamp(): bigint {
    return BigInt(Date.now()) * BigInt(1000000);
  }

  /**
   * Process Date objects
   */
  addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Test RegExp
   */
  testPattern(pattern: RegExp, text: string): boolean {
    return pattern.test(text);
  }

  /**
   * Extract error information
   */
  processError(error: Error): { message: string; name: string } {
    return {
      message: error.message,
      name: error.name
    };
  }

  /**
   * Complex operation using multiple V8 types
   */
  complexOperation(data: {
    buffer: Buffer;
    map: Map<string, number>;
    set: Set<string>;
    bigint: bigint;
    date: Date;
  }): {
    processedBuffer: Buffer;
    mapSize: number;
    setArray: string[];
    doubleBigInt: bigint;
    dayOfWeek: number;
  } {
    return {
      processedBuffer: this.processBuffer(data.buffer),
      mapSize: data.map.size,
      setArray: Array.from(data.set),
      doubleBigInt: data.bigint * BigInt(2),
      dayOfWeek: data.date.getDay()
    };
  }

  /**
   * Process Float32Array
   */
  sumFloat32Array(arr: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      sum += arr[i];
    }
    return sum;
  }

  /**
   * Process Int32Array
   */
  maxInt32Array(arr: Int32Array): number {
    let max = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] > max) {
        max = arr[i];
      }
    }
    return max;
  }
}
