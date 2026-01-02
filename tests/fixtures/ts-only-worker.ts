/**
 * Test fixture for module resolution with .ts extension
 */
export class TsOnlyWorker {
  greet(name: string): string {
    return `Hello from TS, ${name}!`;
  }
}
