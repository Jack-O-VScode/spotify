// ---------------------------------------------------------------------------
// PKCE helpers: random verifier generation and S256 challenge derivation.
// No dependencies — uses only Web Crypto, available on every modern browser
// including iOS Safari (required since we're a static, no-build-step site).
// ---------------------------------------------------------------------------

const VERIFIER_CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

export function generateCodeVerifier(length = 128) {
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  let verifier = "";
  for (const value of randomValues) {
    verifier += VERIFIER_CHARSET[value % VERIFIER_CHARSET.length];
  }
  return verifier;
}

export async function generateCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return base64UrlEncode(digest);
}

export function generateState() {
  return generateCodeVerifier(32);
}

function base64UrlEncode(arrayBuffer) {
  let binary = "";
  for (const byte of new Uint8Array(arrayBuffer)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
