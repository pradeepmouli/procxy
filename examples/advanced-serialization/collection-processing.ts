/**
 * Example: Collection Processing with Advanced Serialization
 *
 * Demonstrates using Map and Set collections with procxy.
 * Requires serialization: 'advanced' mode.
 */

import { procxy } from '../../src/index.js';
import { fileURLToPath } from 'node:url';

/**
 * Data analyzer that works with Map and Set collections
 */
class DataAnalyzer {
  private cache = new Map<string, any>();
  private processedKeys = new Set<string>();

  /**
   * Analyze word frequencies in text
   */
  analyzeWordFrequency(text: string): Map<string, number> {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const frequency = new Map<string, number>();

    for (const word of words) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }

    return frequency;
  }

  /**
   * Find unique values in arrays
   */
  getUniqueValues(arrays: string[][]): Set<string> {
    const unique = new Set<string>();
    for (const array of arrays) {
      for (const value of array) {
        unique.add(value);
      }
    }
    return unique;
  }

  /**
   * Merge multiple maps
   */
  mergeMaps(maps: Map<string, number>[]): Map<string, number> {
    const result = new Map<string, number>();

    for (const map of maps) {
      for (const [key, value] of map.entries()) {
        result.set(key, (result.get(key) || 0) + value);
      }
    }

    return result;
  }

  /**
   * Filter map by value threshold
   */
  filterByThreshold(data: Map<string, number>, threshold: number): Map<string, number> {
    const filtered = new Map<string, number>();

    for (const [key, value] of data.entries()) {
      if (value >= threshold) {
        filtered.set(key, value);
      }
    }

    return filtered;
  }

  /**
   * Get intersection of multiple sets
   */
  intersection(sets: Set<string>[]): Set<string> {
    if (sets.length === 0) return new Set();
    if (sets.length === 1) return new Set(sets[0]);

    const result = new Set(sets[0]);

    for (let i = 1; i < sets.length; i++) {
      for (const item of result) {
        if (!sets[i].has(item)) {
          result.delete(item);
        }
      }
    }

    return result;
  }

  /**
   * Cache and retrieve data
   */
  async cacheData(key: string, data: Map<string, any>): Promise<void> {
    this.cache.set(key, data);
    this.processedKeys.add(key);
  }

  /**
   * Get cached data
   */
  getCachedData(key: string): Map<string, any> | undefined {
    return this.cache.get(key);
  }

  /**
   * Get all processed keys
   */
  getProcessedKeys(): Set<string> {
    return new Set(this.processedKeys);
  }
}

async function main() {
  console.log('🗂️  Collection Processing Example\n');

  // Create analyzer with advanced serialization
  console.log('Creating DataAnalyzer with advanced serialization...');
  await using analyzer = await procxy(DataAnalyzer, {
    modulePath: fileURLToPath(import.meta.url),
    serialization: 'advanced'
  });

  // Example 1: Word frequency analysis
  console.log('\n📝 Example 1: Word frequency analysis');
  const text = 'the quick brown fox jumps over the lazy dog the fox is quick';
  const frequency = await analyzer.analyzeWordFrequency(text);

  console.log('Word frequencies:');
  for (const [word, count] of frequency.entries()) {
    console.log(`  ${word}: ${count}`);
  }

  // Example 2: Find unique values
  console.log('\n📝 Example 2: Finding unique values');
  const arrays = [
    ['apple', 'banana', 'cherry'],
    ['banana', 'date', 'apple'],
    ['cherry', 'elderberry', 'fig']
  ];
  const unique = await analyzer.getUniqueValues(arrays);
  console.log('Unique values:', Array.from(unique));

  // Example 3: Merge maps
  console.log('\n📝 Example 3: Merging frequency maps');
  const map1 = new Map([
    ['a', 5],
    ['b', 3],
    ['c', 8]
  ]);
  const map2 = new Map([
    ['a', 2],
    ['b', 7],
    ['d', 4]
  ]);
  const merged = await analyzer.mergeMaps([map1, map2]);

  console.log('Merged map:');
  for (const [key, value] of merged.entries()) {
    console.log(`  ${key}: ${value}`);
  }

  // Example 4: Filter by threshold
  console.log('\n📝 Example 4: Filter by threshold');
  const filtered = await analyzer.filterByThreshold(merged, 5);
  console.log('Values >= 5:', Array.from(filtered.entries()));

  // Example 5: Set intersection
  console.log('\n📝 Example 5: Set intersection');
  const set1 = new Set(['a', 'b', 'c', 'd']);
  const set2 = new Set(['b', 'c', 'd', 'e']);
  const set3 = new Set(['c', 'd', 'e', 'f']);
  const intersection = await analyzer.intersection([set1, set2, set3]);
  console.log('Intersection:', Array.from(intersection));

  // Example 6: Caching with collections
  console.log('\n📝 Example 6: Caching with collections');
  await analyzer.cacheData('freq1', frequency);
  await analyzer.cacheData('merged', merged);

  const cached = await analyzer.getCachedData('freq1');
  console.log('Cached data retrieved:', cached instanceof Map);

  const keys = await analyzer.getProcessedKeys();
  console.log('Processed keys:', Array.from(keys));

  console.log('\n✅ Collection processing completed successfully!');
  console.log('\n💡 With JSON mode, you would need to convert:');
  console.log('   Map → Array.from(map.entries())');
  console.log('   Set → Array.from(set)');
  console.log('   Then convert back on the other side!');
}

// Run the example
main().catch(console.error);
