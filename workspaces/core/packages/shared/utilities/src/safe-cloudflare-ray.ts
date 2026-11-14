import { Option } from 'effect';

const CLOUDFLARE_RAY = /^[0-9A-Fa-f]{16}(?:-[A-Za-z]{3})?$/u;
type SafeCloudflareRayInput = { readonly ray: Option.Option<string> };

/** Correlation headers are untrusted text, even when only their identifier is useful. */
export function safeCloudflareRay({ ray }: SafeCloudflareRayInput): Option.Option<string> {
  return Option.filter(ray, (value) => {
    const match = CLOUDFLARE_RAY.exec(value);
    const matched = Option.fromNullishOr(match);

    return Option.exists(matched, (captures) => captures[0] === value);
  });
}
