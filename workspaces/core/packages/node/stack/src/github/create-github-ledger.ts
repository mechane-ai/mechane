import { Option } from 'effect';
import { LOCAL_GITHUB } from '../constants.ts';
import type { GitHubLedger } from './types.ts';

/** A code the sign-in form granted: who signed in, for the callback that receives the code. */
type Grant = { readonly login: string; readonly redirectUri: string };

/** A fresh ledger; only its own functions change what it remembers. */
export function createGitHubLedger(): GitHubLedger {
  const grants = new Map<string, Grant>();
  const logins = new Map<string, string>();
  const userIds = new Map<string, number>();

  const grantCode: GitHubLedger['grantCode'] = ({ login, redirectUri }) => {
    const code = crypto.randomUUID();

    grants.set(code, { login, redirectUri });

    return code;
  };

  const redeemCode: GitHubLedger['redeemCode'] = ({ code, redirectUri }) => {
    const grant = Option.filter(Option.fromNullishOr(grants.get(code)), (found) => found.redirectUri === redirectUri);

    grants.delete(code);

    return Option.map(grant, (found) => found.login);
  };

  const issueAccessToken: GitHubLedger['issueAccessToken'] = ({ login }) => {
    const token = `${LOCAL_GITHUB.accessTokenPrefix}${crypto.randomUUID()}`;

    logins.set(token, login);

    return token;
  };

  const tokenLogin: GitHubLedger['tokenLogin'] = ({ token }) => Option.fromNullishOr(logins.get(token));

  const userId: GitHubLedger['userId'] = ({ login }) => {
    const id = Option.getOrElse(Option.fromNullishOr(userIds.get(login)), () => userIds.size + 1);

    userIds.set(login, id);

    return id;
  };

  return { grantCode, redeemCode, issueAccessToken, tokenLogin, userId };
}
