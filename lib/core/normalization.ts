const EMAIL_PATTERN =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function normalizeEmail(value: string): string | null {
  const email = value
    .trim()
    .replace(/^mailto:/i, "")
    .split(/[?\s]/, 1)[0]
    .toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

export function normalizeUrl(input: string): string {
  const withProtocol = /^https?:\/\//i.test(input.trim())
    ? input.trim()
    : `https://${input.trim()}`;
  const url = new URL(withProtocol);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "http:" && url.port === "80")
  ) {
    url.port = "";
  }
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export function hostname(input: string): string {
  return new URL(normalizeUrl(input)).hostname;
}

export function sameDomain(a: string, b: string): boolean {
  const left = hostname(a);
  const right = hostname(b);
  return (
    left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`)
  );
}
