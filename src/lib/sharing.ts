// ============================================================
// Sharing — URL param encoding/decoding with pako compression
// ============================================================

import pako from 'pako';

/**
 * Encode params into a URL-safe Base64 string.
 * JSON → deflate → Base64url
 */
export function encodeParams(params: Record<string, unknown>): string {
  try {
    const json = JSON.stringify(params);
    const compressed = pako.deflate(json);
    // Convert Uint8Array to Base64url
    const base64 = btoa(String.fromCharCode(...compressed));
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (err) {
    console.warn('Failed to encode params:', err);
    return '';
  }
}

/**
 * Decode a URL-safe Base64 string back into params.
 * Base64url → inflate → JSON
 */
export function decodeParams(encoded: string): Record<string, unknown> | null {
  try {
    // Restore standard Base64
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding
    while (base64.length % 4) base64 += '=';

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const json = pako.inflate(bytes, { to: 'string' });
    return JSON.parse(json) as Record<string, unknown>;
  } catch (err) {
    console.warn('Failed to decode shared params:', err);
    return null;
  }
}

/**
 * Build a shareable URL for an experiment with current params.
 */
export function buildShareUrl(slug: string, params: Record<string, unknown>): string {
  const encoded = encodeParams(params);
  const base = window.location.origin + window.location.pathname;
  return `${base}#/experiment/${slug}?v=${encoded}`;
}
