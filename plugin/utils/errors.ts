export class PluginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginError";
  }
}

export class AclDeniedError extends PluginError {
  constructor(message: string) {
    super(message);
    this.name = "AclDeniedError";
  }
}
