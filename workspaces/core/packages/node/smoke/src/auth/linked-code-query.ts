/** The query parameter a phishing link would carry the code in, which the device page must ignore. */
const LINKED_CODE_PARAMETER = 'code';

/** The code a link carries. */
type LinkedCodeQueryInput = { readonly userCode: string };

/** The query of a link that carries a login's code, as a phishing link would. */
export function linkedCodeQuery({ userCode }: LinkedCodeQueryInput): string {
  const query = new URLSearchParams({ [LINKED_CODE_PARAMETER]: userCode });

  return `?${query.toString()}`;
}
