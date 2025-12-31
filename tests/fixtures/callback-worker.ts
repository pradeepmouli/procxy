/**
 * Test fixture for callback functionality.
 */
export class CallbackWorker {
  private value = 0;

  /**
   * Invoke a callback immediately with a value.
   */
  invoke(callback: (value: number) => void, value: number): void {
    callback(value);
  }

  /**
   * Invoke a callback asynchronously.
   */
  async invokeAsync(callback: (value: number) => Promise<void>, value: number): Promise<void> {
    await callback(value);
  }

  /**
   * Invoke a callback multiple times.
   */
  invokeMultiple(callback: (value: number) => void, count: number): void {
    for (let i = 0; i < count; i++) {
      callback(i);
    }
  }

  /**
   * Pass callback to another method.
   */
  transform(input: number[], mapper: (value: number) => number): number[] {
    return input.map(mapper);
  }

  /**
   * Callback with multiple parameters.
   */
  multiParam(callback: (a: number, b: string, c: boolean) => void): void {
    callback(42, 'hello', true);
  }

  /**
   * Callback that returns a value.
   */
  withReturn(callback: (x: number) => number, x: number): number {
    return callback(x) * 2;
  }

  /**
   * Callback in nested object.
   */
  nested(options: { onSuccess: (value: number) => void; multiplier: number }): void {
    options.onSuccess(10 * options.multiplier);
  }

  /**
   * Callback that throws.
   */
  async invokeWithError(callback: () => void): Promise<void> {
    callback();
  }
}
