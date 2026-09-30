/** `messages.ciphertext` is bytea; PostgREST moves it as `\x…` hex. The bytes are the UTF-8 JSON envelope. */

export function encodeEnvelope(envelope: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(envelope));
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return `\\x${hex}`;
}

export function decodeEnvelope<T = unknown>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    const hex = value.startsWith('\\x') ? value.slice(2) : value;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}
