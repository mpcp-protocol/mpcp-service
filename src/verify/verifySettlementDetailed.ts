import { computeSettlementIntentHash } from "../hash/computeSettlementIntentHash.js";
import { settlementIntentForVerificationSchema } from "../schema/verifySchemas.js";
import type {
  DetailedVerificationReport,
  SettlementVerificationContext,
  VerificationCheck,
} from "./types.js";
import { verifyBudgetAuthorization } from "./verifyBudgetAuthorization.js";
import { verifyPaymentAuthorization } from "./verifyPaymentAuthorization.js";
import { verifyPolicyGrant } from "./verifyPolicyGrant.js";
import { signedBudgetAuthorizationSchema } from "../schema/signedBudgetAuthorization.js";
import { signedPaymentAuthorizationSchema } from "../schema/paymentAuthorization.js";
import { policyGrantForVerificationSchema } from "../schema/verifySchemas.js";

function addCheck(
  checks: VerificationCheck[],
  name: string,
  valid: boolean,
  opts?: { reason?: string; expected?: unknown; actual?: unknown; artifact?: string },
): boolean {
  checks.push({
    name,
    valid,
    reason: opts?.reason,
    expected: opts?.expected,
    actual: opts?.actual,
    artifact: opts?.artifact,
  });
  return valid;
}

/**
 * Verify settlement and return a detailed report for CLI --explain and --json.
 * Includes schema checks per artifact and expected/actual for mismatches (e.g. intent hash).
 */
export function verifySettlementDetailed(
  ctx: SettlementVerificationContext,
): DetailedVerificationReport {
  const checks: VerificationCheck[] = [];

  // Schema validation
  const grantParse = policyGrantForVerificationSchema.safeParse(ctx.policyGrant);
  if (!addCheck(checks, "PolicyGrant schema valid", grantParse.success, {
    reason: grantParse.success ? undefined : (grantParse as { error: { message: string } }).error.message,
    artifact: grantParse.success ? undefined : "policyGrant",
  })) {
    return { valid: false, checks };
  }

  const sbaParse = signedBudgetAuthorizationSchema.safeParse(ctx.signedBudgetAuthorization);
  if (!addCheck(checks, "SignedBudgetAuthorization schema valid", sbaParse.success, {
    reason: sbaParse.success ? undefined : (sbaParse as { error: { message: string } }).error.message,
    artifact: sbaParse.success ? undefined : "signedBudgetAuthorization",
  })) {
    return { valid: false, checks };
  }

  const spaParse = signedPaymentAuthorizationSchema.safeParse(ctx.signedPaymentAuthorization);
  if (!addCheck(checks, "SignedPaymentAuthorization schema valid", spaParse.success, {
    reason: spaParse.success ? undefined : (spaParse as { error: { message: string } }).error.message,
    artifact: spaParse.success ? undefined : "signedPaymentAuthorization",
  })) {
    return { valid: false, checks };
  }

  if (ctx.settlementIntent) {
    const intentParse = settlementIntentForVerificationSchema.safeParse(ctx.settlementIntent);
    if (!addCheck(checks, "SettlementIntent schema valid", intentParse.success, {
      reason: intentParse.success ? undefined : (intentParse as { error: { message: string } }).error.message,
      artifact: intentParse.success ? undefined : "settlementIntent",
    })) {
      return { valid: false, checks };
    }
  }

  if (ctx.signedPaymentAuthorization.authorization.intentHash && !ctx.settlementIntent) {
    addCheck(checks, "SettlementIntent required", false, {
      reason: "intent_required",
      artifact: "signedPaymentAuthorization",
    });
    return { valid: false, checks };
  }

  // Policy grant
  const grantResult = verifyPolicyGrant(ctx.policyGrant, { nowMs: ctx.nowMs });
  if (!addCheck(checks, "PolicyGrant valid", grantResult.valid, {
    reason: grantResult.valid ? undefined : grantResult.reason,
    artifact: grantResult.valid ? undefined : "policyGrant",
  })) {
    return { valid: false, checks };
  }

  // Budget
  const budgetResult = verifyBudgetAuthorization(
    ctx.signedBudgetAuthorization,
    ctx.policyGrant,
    ctx.paymentPolicyDecision,
    { nowMs: ctx.nowMs },
  );
  if (!addCheck(checks, "SignedBudgetAuthorization valid", budgetResult.valid, {
    reason: budgetResult.valid ? undefined : budgetResult.reason,
    artifact: budgetResult.valid ? undefined : "signedBudgetAuthorization",
  })) {
    return { valid: false, checks };
  }

  // Intent hash with expected/actual when SPA binds to intent (before payment; payment will re-verify)
  if (ctx.settlementIntent && ctx.signedPaymentAuthorization.authorization.intentHash) {
    const intentParsed = settlementIntentForVerificationSchema.safeParse(ctx.settlementIntent);
    if (intentParsed.success) {
      const auth = ctx.signedPaymentAuthorization.authorization;
      const expectedHash = computeSettlementIntentHash(intentParsed.data);
      const actualHash = auth.intentHash;
      const hashMatch = expectedHash === actualHash;
      if (!addCheck(checks, "SettlementIntentHash", hashMatch, {
        reason: hashMatch ? undefined : "mismatch",
        expected: hashMatch ? undefined : expectedHash,
        actual: hashMatch ? undefined : actualHash,
        artifact: hashMatch ? undefined : "settlementIntent",
      })) {
        return { valid: false, checks };
      }
    }
  }

  // Payment (SPA signature, settlement match, linkage; intent hash already checked above)
  const paymentResult = verifyPaymentAuthorization(
    ctx.signedPaymentAuthorization,
    ctx.signedBudgetAuthorization,
    ctx.policyGrant,
    ctx.paymentPolicyDecision,
    ctx.settlement,
    { nowMs: ctx.nowMs, settlementIntent: ctx.settlementIntent },
  );
  if (!addCheck(checks, "SignedPaymentAuthorization valid", paymentResult.valid, {
    reason: paymentResult.valid ? undefined : paymentResult.reason,
    artifact: paymentResult.valid ? undefined : "signedPaymentAuthorization",
  })) {
    return { valid: false, checks };
  }

  return { valid: true, checks };
}

/**
 * Safe wrapper for verifySettlementDetailed. Catches thrown exceptions.
 */
export function verifySettlementDetailedSafe(
  ctx: SettlementVerificationContext,
): DetailedVerificationReport {
  try {
    return verifySettlementDetailed(ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      checks: [{ name: "verification", valid: false, reason: message }],
    };
  }
}
