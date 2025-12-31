export class Greeter {
  greet(name: string, greeting?: string): string {
    return `${greeting || 'Hello'}, ${name}`;
  }

  greetMultiple(name: string, greeting?: string, punctuation?: string): string {
    return `${greeting || 'Hello'}, ${name}${punctuation || '.'}`;
  }

  formatMessage(name: string, priority?: string, punctuation?: string): string {
    return `[${priority?.toUpperCase() || 'INFO'}] ${name}${punctuation || '.'}`;
  }
}

export default Greeter;
