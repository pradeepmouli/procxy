/**
 * Test fixture for property getter/setter synchronization.
 */
export class PropertyWorker {
  public counter = 0;
  public name = '';
  public $cache?: string;
  private _value = 0;
  private _secret?: string;

  /**
   * Increment counter property.
   */
  incrementCounter(): void {
    this.counter++;
  }

  /**
   * Get current counter value.
   */
  getCounter(): number {
    return this.counter;
  }

  /**
   * Set name property.
   */
  setName(newName: string): void {
    this.name = newName;
  }

  /**
   * Get name property.
   */
  getName(): string {
    return this.name;
  }

  /**
   * Property with getter.
   */
  get value(): number {
    return this._value;
  }

  /**
   * Property with setter.
   */
  set value(v: number) {
    this._value = v * 2; // Doubles the value when set
  }

  /**
   * Get the internal value.
   */
  getInternalValue(): number {
    return this._value;
  }

  setPrivateState(secret: string): { secret: string | undefined; cache: string | undefined } {
    this._secret = secret;
    this.$cache = `cache:${secret}`;
    return { secret: this._secret, cache: this.$cache };
  }

  getPrivateState(): { secret: string | undefined; cache: string | undefined } {
    return { secret: this._secret, cache: this.$cache };
  }
}
