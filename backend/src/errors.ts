/** Error that is safe to show to the client. Anything else becomes a generic 500. */
export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

/** A signed webhook whose payload we cannot interpret. Retrying cannot fix it, so it is stored and acknowledged. */
export class MalformedEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedEventError';
  }
}
