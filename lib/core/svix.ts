function decodeSecret(secret: string) {
  const encoded = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function signSvixPayload(
  secret: string,
  messageId: string,
  timestamp: string,
  payload: string,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    decodeSecret(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${messageId}.${timestamp}.${payload}`),
  );
  return bytesToBase64(new Uint8Array(signature));
}

export async function verifySvixSignature(input: {
  secret: string;
  payload: string;
  messageId: string;
  timestamp: string;
  signature: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}) {
  const timestamp = Number(input.timestamp);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (
    !Number.isFinite(timestamp) ||
    Math.abs(now - timestamp) > (input.toleranceSeconds ?? 300)
  )
    return false;
  const expected = await signSvixPayload(
    input.secret,
    input.messageId,
    input.timestamp,
    input.payload,
  );
  return input.signature
    .split(/\s+/)
    .map((item) => item.split(",", 2))
    .some(
      ([version, value]) =>
        version === "v1" && Boolean(value) && safeEqual(value, expected),
    );
}
