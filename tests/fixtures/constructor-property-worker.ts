/**
 * Test fixture for constructor property synchronization.
 * Properties are set during construction and should be immediately available.
 */
export class ConstructorPropertyWorker {
  public name: string;
  public age: number;
  public active: boolean;
  private _internal = 'secret';

  constructor(name: string, age: number, active = true) {
    this.name = name;
    this.age = age;
    this.active = active;
  }

  /**
   * Update name property.
   */
  setName(newName: string): void {
    this.name = newName;
  }

  /**
   * Increment age.
   */
  incrementAge(): void {
    this.age++;
  }

  /**
   * Toggle active status.
   */
  toggleActive(): void {
    this.active = !this.active;
  }

  /**
   * Get internal value (should not be synced).
   */
  getInternal(): string {
    return this._internal;
  }
}
