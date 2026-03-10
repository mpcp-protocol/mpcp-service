import type { PaymentPolicyDecision } from "../policy-core/types.js";
import type { PolicyGrantLike } from "./types.js";
import { verifySignedSessionBudgetAuthorizationForDecision } from "../protocol/sba.js";
import type { SignedSessionBudgetAuthorization } from "../protocol/sba.js";
import { verifyPolicyGrant } from "./verifyPolicyGrant.js";

/**
 * Verify a signed budget authorization (signature, expiry, grant chain).
 *
 * @param envelope - SBA envelope
 * @param grant - Policy grant this budget derives from
 * @param decision - Payment decision to verify fits within budget
 * @param options.nowMs - Verification time (default: Date.now())
 * @returns Deterministic result with clear failure reason
 */
export function verifyBudgetAuthorization(
  envelope: SignedSessionBudgetAuthorization,
  grant: PolicyGrantLike,
  decision: PaymentPolicyDecision,
  options?: { nowMs?: number },
): { ok: true } | { ok: false; reason: string } {
  if (envelope.authorization.policyHash !== grant.policyHash) {
    return { ok: false, reason: "budget_policy_hash_mismatch" };
  }

  const grantResult = verifyPolicyGrant(grant, options);
  if (!grantResult.ok) return grantResult;

  const grantRails = new Set(grant.allowedRails);
  for (const rail of envelope.authorization.allowedRails) {
    if (!grantRails.has(rail)) {
      return { ok: false, reason: "budget_rail_not_in_grant" };
    }
  }

  const result = verifySignedSessionBudgetAuthorizationForDecision(envelope, {
    sessionId: envelope.authorization.sessionId,
    decision,
    nowMs: options?.nowMs,
  });
  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true };
}
