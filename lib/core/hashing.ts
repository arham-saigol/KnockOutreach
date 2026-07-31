export async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.replace(/\r\n/g, "\n").trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashSources(
  pages: Array<{ url: string; content: string }>,
): Promise<string[]> {
  const ordered = [...pages].sort((a, b) => a.url.localeCompare(b.url));
  return Promise.all(
    ordered.map((page) => sha256(`${page.url}\n${page.content}`)),
  );
}
