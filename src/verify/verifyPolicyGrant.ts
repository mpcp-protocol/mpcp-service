import type { PolicyGrantLike } from "./types.js";

/**
 * Verify a policy grant is valid (not expired).
 *
 * @param grant - Policy grant artifact
 * @param options.nowMs - Verification time (default: Date.now())
 * @returns Deterministic result with clear failure reason
 */
export function verifyPolicyGrant(
  grant: PolicyGrantLike,
  options?: { nowMs?: number },
): { ok: true } | { ok: false; reason: string } {
  const nowMs = typeof options?.nowMs === "number" ? options.nowMs : Date.now();
  const expiresAt = grant.expiresAt ?? grant.expiresAtISO;
  if (!expiresAt) {
    return { ok: false, reason: "policy_grant_missing_expiry" };
  }
  const expiryMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiryMs)) {
    return { ok: false, reason: "policy_grant_invalid_expiry" };
  }
  if (expiryMs <= nowMs) {
    return { ok: false, reason: "policy_grant_expired" };
  }
  return { ok: true };
}
