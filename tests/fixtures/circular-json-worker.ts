/**
 * Fixture for JSON serialization fallback when child sends circular property updates.
 */
export class CircularJsonWorker {
  public payload: { self?: unknown } | null = null;

  setCircular(): void {
    const obj: { self?: unknown } = {};
    obj.self = obj;
    this.payload = obj;
  }
}
