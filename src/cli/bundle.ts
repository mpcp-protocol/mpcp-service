import type {
  PaymentPolicyDecision,
  SettlementResult,
} from "../policy-core/types.js";
import type { SignedSessionBudgetAuthorization } from "../protocol/sba.js";
import type { SignedPaymentAuthorization } from "../protocol/spa.js";
import type { PolicyGrantLike } from "../verify/types.js";
import type { SettlementVerificationContext } from "../verify/types.js";

/**
 * JSON artifact bundle format for CLI verification.
 * Alternative to full SettlementVerificationContext — artifacts keyed by type.
 */
export interface SettlementBundle {
  settlement: SettlementResult;
  intent?: unknown;
  spa: SignedPaymentAuthorization;
  sba: SignedSessionBudgetAuthorization;
  policyGrant: PolicyGrantLike;
  paymentPolicyDecision?: PaymentPolicyDecision;
}

function isBundleLike(obj: unknown): obj is Record<string, unknown> {
  return obj !== null && typeof obj === "object" && !Array.isArray(obj);
}

/**
 * Detect if parsed JSON is a settlement bundle (artifact-keyed) vs full context.
 */
export function isSettlementBundle(obj: unknown): obj is SettlementBundle {
  if (!isBundleLike(obj)) return false;
  return (
    "settlement" in obj &&
    "spa" in obj &&
    "sba" in obj &&
    "policyGrant" in obj &&
    !("signedBudgetAuthorization" in obj) &&
    !("signedPaymentAuthorization" in obj)
  );
}

/**
 * Build a minimal PaymentPolicyDecision from SPA authorization.
 * Used when bundle omits paymentPolicyDecision.
 */
function decisionFromSpa(spa: SignedPaymentAuthorization): PaymentPolicyDecision {
  const a = spa.authorization;
  const quote = {
    quoteId: a.quoteId,
    rail: a.rail,
    amount: { amount: a.amount, decimals: 6 },
    destination: a.destination ?? "",
    expiresAt: a.expiresAt,
    asset: a.asset,
  };
  return {
    decisionId: a.decisionId,
    policyHash: a.policyHash,
    action: "ALLOW",
    reasons: ["OK"],
    expiresAtISO: a.expiresAt,
    rail: a.rail,
    asset: a.asset,
    chosen: { rail: a.rail, quoteId: a.quoteId },
    settlementQuotes: [quote],
  };
}

/**
 * Convert a settlement bundle to SettlementVerificationContext.
 */
export function bundleToContext(bundle: SettlementBundle): SettlementVerificationContext {
  const decision =
    bundle.paymentPolicyDecision ?? decisionFromSpa(bundle.spa);
  return {
    policyGrant: bundle.policyGrant,
    signedBudgetAuthorization: bundle.sba,
    signedPaymentAuthorization: bundle.spa,
    settlement: bundle.settlement,
    paymentPolicyDecision: decision,
    decisionId: bundle.spa.authorization.decisionId,
    settlementIntent: bundle.intent,
  };
}
