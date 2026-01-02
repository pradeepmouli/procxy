export class ConfiguredService {
  constructor(public config: { name: string; value: number }) {}

  getName() {
    return this.config.name;
  }

  getValue() {
    return this.config.value;
  }
}
