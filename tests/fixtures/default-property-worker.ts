/**
 * Test fixture for class field initializers (default values).
 * Properties with default values set at class scope should be synced.
 */
export class DefaultPropertyWorker {
  // Default values set at class field level (not in constructor)
  public name = 'default-name';
  public counter = 0;
  public enabled = true;
  private _internal = 'secret';

  constructor(overrideName?: string) {
    // Constructor may or may not override the defaults
    if (overrideName) {
      this.name = overrideName;
    }
  }

  /**
   * Update counter.
   */
  incrementCounter(): void {
    this.counter++;
  }

  /**
   * Get current state.
   */
  getState(): { name: string; counter: number; enabled: boolean } {
    return {
      name: this.name,
      counter: this.counter,
      enabled: this.enabled
    };
  }
}
