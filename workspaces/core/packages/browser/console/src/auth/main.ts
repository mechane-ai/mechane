import { browserAuthenticationMessage, completeBrowserAuthentication } from '@mechane/console-data';

type AuthenticationStatusInput = { readonly message: string };

function authenticationStatus({ message }: AuthenticationStatusInput): void {
  const status = document.querySelector('#authentication-status');

  if (status !== null) {
    status.textContent = message;
  }
}

function authenticate(): void {
  const lifetime = new AbortController();

  globalThis.addEventListener('pagehide', () => lifetime.abort(), { once: true, signal: lifetime.signal });
  authenticationStatus({ message: 'Completing authentication…' });

  const authentication = completeBrowserAuthentication({
    url: new URL(globalThis.location.href),
    signal: lifetime.signal,
  });

  void authentication.then(
    (destination) => {
      lifetime.abort();
      globalThis.location.assign(destination.href);
    },
    (failure: unknown) => {
      lifetime.abort();
      authenticationStatus({ message: browserAuthenticationMessage({ failure }) });
    },
  );
}

function main(): void {
  const form = document.querySelector('#authentication-form');

  if (form !== null) {
    authenticationStatus({ message: 'Confirm that you want to sign out.' });
    form.addEventListener('submit', (event) => {
      event.preventDefault();

      if (event.isTrusted) {
        authenticate();
      }
    });

    return;
  }

  authenticate();
}

main();
