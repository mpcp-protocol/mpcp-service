import type { SettlementVerificationContext } from "./types.js";
import { verifyPolicyGrant } from "./verifyPolicyGrant.js";
import { verifyPaymentAuthorization } from "./verifyPaymentAuthorization.js";
import { verifySettlementIntent } from "./verifySettlementIntent.js";

/**
 * Verify a full MPCP settlement chain.
 *
 * Performs all verification steps in order:
 * 1. Policy grant valid (not expired)
 * 2. Budget authorization valid (chain, limits, signature)
 * 3. Payment authorization valid (chain, signature, settlement match)
 * 4. If intentHash present: settlement intent matches SPA
 *
 * @param ctx - Full verification context
 * @returns Deterministic result with clear failure reason
 */
export function verifySettlement(
  ctx: SettlementVerificationContext,
): { ok: true } | { ok: false; reason: string } {
  if (
    ctx.signedPaymentAuthorization.authorization.intentHash &&
    !ctx.settlementIntent
  ) {
    return { ok: false, reason: "intent_required" };
  }

  const grantResult = verifyPolicyGrant(ctx.policyGrant, {
    nowMs: ctx.nowMs,
  });
  if (!grantResult.ok) return grantResult;

  const paymentResult = verifyPaymentAuthorization(
    ctx.signedPaymentAuthorization,
    ctx.signedBudgetAuthorization,
    ctx.policyGrant,
    ctx.paymentPolicyDecision,
    ctx.settlement,
    {
      nowMs: ctx.nowMs,
      settlementIntent: ctx.settlementIntent,
    },
  );
  if (!paymentResult.ok) return paymentResult;

  if (ctx.settlementIntent) {
    const intentResult = verifySettlementIntent(
      ctx.signedPaymentAuthorization,
      ctx.settlementIntent as Record<string, unknown>,
    );
    if (!intentResult.ok) return intentResult;
  } else if (ctx.signedPaymentAuthorization.authorization.intentHash) {
    return { ok: false, reason: "intent_required" };
  }

  return { ok: true };
}
