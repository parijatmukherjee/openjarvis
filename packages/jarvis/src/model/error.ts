import type { ModelErrorCode } from "./types.js";

export class ModelError extends Error {
  override readonly name = "ModelError" as const;
  readonly code: ModelErrorCode;

  constructor(code: ModelErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}