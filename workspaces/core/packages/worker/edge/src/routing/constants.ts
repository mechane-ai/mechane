/** An IPv4 address in dotted decimal, or IPv6 text in hex groups, which may end in a dotted IPv4 address. */
export const PEER_ADDRESS_PATTERN = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[\dA-Fa-f]*:[\dA-Fa-f:.]*)$/;

/** A country as Cloudflare's edge reports it: an ISO 3166 code, or one of its own two-character codes such as `T1`. */
export const PEER_COUNTRY_PATTERN = /^[A-Z\d]{2}$/;
