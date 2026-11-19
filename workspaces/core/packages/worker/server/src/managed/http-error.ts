export class ManagedHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);

    this.name = 'ManagedHttpError';
    this.status = status;
  }
}
