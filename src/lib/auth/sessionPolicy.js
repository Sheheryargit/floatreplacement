/** Fixed workspace session length (gate + SSO); filters/prefs stay in localStorage. */
export const SESSION_MAX_MS = 60 * 60 * 1000;

/**
 * @param {unknown} raw
 * @returns {number | undefined}
 */
function parseExpiresAt(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * @typedef {{ displayName?: string; userSub?: string | null; sessionExpiresAt?: number }} SessionProfileMirror
 */

/**
 * @param {SessionProfileMirror | null | undefined} mirror
 */
export function isSessionExpired(mirror) {
  const exp = parseExpiresAt(mirror?.sessionExpiresAt);
  if (!exp) return false;
  return Date.now() > exp;
}

/**
 * @param {SessionProfileMirror} mirror
 * @param {boolean} [refreshExpiry]
 */
export function withSessionExpiry(mirror, refreshExpiry = true) {
  if (!refreshExpiry && parseExpiresAt(mirror?.sessionExpiresAt)) {
    return mirror;
  }
  return { ...mirror, sessionExpiresAt: Date.now() + SESSION_MAX_MS };
}
