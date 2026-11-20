import { CSPProvider as BaseCSPProvider } from '@base-ui/react/csp-provider';
import type { CSPProviderProps } from '@base-ui/react/csp-provider';
import type { ReactNode } from 'react';

export function CSPProvider({ children, nonce, ...props }: CSPProviderProps): ReactNode {
  return (
    <BaseCSPProvider {...props} nonce={nonce}>
      <meta property="csp-nonce" nonce={nonce} />
      {children}
    </BaseCSPProvider>
  );
}
