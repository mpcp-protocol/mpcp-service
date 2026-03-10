import { canonicalJson } from "../canonical/canonicalJson.js";
import type { SettlementResult } from "../policy-core/types.js";
import type { PolicyGrantLike } from "./types.js";
import { verifyPolicyGrant } from "./verifyPolicyGrant.js";
import { verifyBudgetAuthorization } from "./verifyBudgetAuthorization.js";
import type { SignedPaymentAuthorization } from "../protocol/spa.js";
import type { SignedSessionBudgetAuthorization } from "../protocol/sba.js";
import type { PaymentPolicyDecision } from "../policy-core/types.js";
import {
  verifySignedPaymentAuthorizationForSettlement,
} from "../protocol/spa.js";

function assetMatches(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

/**
 * Verify a signed payment authorization (SPA) against the budget chain and settlement.
 *
 * Checks:
 * - Grant valid (not expired)
 * - SBA chain: policyHash, sessionId, rail/asset/destination within budget
 * - SPA signature valid
 * - SPA not expired
 * - If intentHash present: must match settlementIntent
 * - Settlement matches SPA (amount, rail, asset, destination)
 *
 * @param envelope - SPA envelope
 * @param sba - Signed budget authorization this SPA derives from
 * @param grant - Policy grant the budget derives from
 * @param decision - Payment decision (for budget limit verification)
 * @param settlement - Executed settlement to verify against
 * @param options - nowMs, settlementIntent (required if SPA has intentHash)
 */
export function verifyPaymentAuthorization(
  envelope: SignedPaymentAuthorization,
  sba: SignedSessionBudgetAuthorization,
  grant: PolicyGrantLike,
  decision: PaymentPolicyDecision,
  settlement: SettlementResult,
  options?: { nowMs?: number; settlementIntent?: unknown },
): { ok: true } | { ok: false; reason: string } {
  if (envelope.authorization.sessionId !== sba.authorization.sessionId) {
    return { ok: false, reason: "payment_auth_session_mismatch" };
  }
  if (envelope.authorization.policyHash !== sba.authorization.policyHash) {
    return { ok: false, reason: "payment_auth_policy_hash_mismatch" };
  }

  const budgetResult = verifyBudgetAuthorization(
    sba,
    grant,
    decision,
    options,
  );
  if (!budgetResult.ok) return budgetResult;

  const spaResult = verifySignedPaymentAuthorizationForSettlement(
    envelope,
    envelope.authorization.decisionId,
    settlement,
    {
      nowMs: options?.nowMs,
      settlementIntent: options?.settlementIntent,
    },
  );
  if (!spaResult.ok) {
    const reason =
      spaResult.reason === "invalid_signature"
        ? "payment_auth_invalid_signature"
        : spaResult.reason === "expired"
          ? "payment_auth_expired"
          : "payment_auth_mismatch";
    return { ok: false, reason };
  }

  const auth = envelope.authorization;
  if (!sba.authorization.allowedRails.includes(auth.rail as "xrpl" | "evm" | "stripe" | "hosted")) {
    return { ok: false, reason: "payment_auth_rail_not_in_budget" };
  }
  if (
    sba.authorization.allowedAssets.length > 0 &&
    auth.asset &&
    !sba.authorization.allowedAssets.some((a) => assetMatches(a, auth.asset))
  ) {
    return { ok: false, reason: "payment_auth_asset_not_in_budget" };
  }
  if (
    sba.authorization.destinationAllowlist.length > 0 &&
    auth.destination &&
    !sba.authorization.destinationAllowlist.includes(auth.destination)
  ) {
    return { ok: false, reason: "payment_auth_destination_not_in_budget" };
  }

  return { ok: true };
}
