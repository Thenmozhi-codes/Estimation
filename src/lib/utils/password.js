/*
 * Password hashing for the local (browser) user store.
 *
 * NOTE: this app keeps its data in the browser (mockStore), so this only
 * stops passwords from being saved as plain text. Real security needs a
 * backend that hashes and checks passwords on the server.
 */

function fallbackHash(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
  }
  return `f${(hash >>> 0).toString(16)}`;
}

export async function hashPassword(password, salt = "") {
  const text = `${salt}:${password}`;

  try {
    if (globalThis.crypto?.subtle) {
      const bytes = new TextEncoder().encode(text);
      const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);

      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    /* fall through to the simple hash */
  }

  return fallbackHash(text);
}