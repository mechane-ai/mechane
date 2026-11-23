import type { ReactNode } from 'react';

export type CSPProviderProps = {
  /** The request nonce in the application's Content Security Policy. */
  readonly nonce?: string | undefined;
  readonly children?: ReactNode;
};

/** Gives UI SDK the policy's nonce through the `csp-nonce` meta tag, which it reads before adding its styles. */
export function CSPProvider({ children, nonce }: CSPProviderProps): ReactNode {
  return (
    <>
      <meta property="csp-nonce" nonce={nonce} />
      {children}
    </>
  );
}
