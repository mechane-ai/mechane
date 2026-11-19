type BearerInput = { readonly authorization: string };

/** Reads the token from a single bearer authorization value. */
export function bearerToken({ authorization }: BearerInput): string | null {
  return /^Bearer ([^\s]+)$/iu.exec(authorization)?.[1] ?? null;
}
