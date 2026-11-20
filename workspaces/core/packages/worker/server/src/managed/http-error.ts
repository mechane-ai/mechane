export class ManagedHttpError extends Error {
  readonly status: number;
  readonly headers: Headers | undefined;
  constructor(status: number, message: string, headers?: HeadersInit) {
    super(message);

    this.name = 'ManagedHttpError';
    this.status = status;

    if (headers !== undefined) {
      this.headers = new Headers(headers);
    }
  }
}
