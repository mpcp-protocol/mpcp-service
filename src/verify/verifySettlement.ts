import type {
  SettlementVerificationContext,
  VerificationReport,
  VerificationResult,
  VerificationStep,
} from "./types.js";
import { signedBudgetAuthorizationSchema } from "../schema/signedBudgetAuthorization.js";
import { signedPaymentAuthorizationSchema } from "../schema/paymentAuthorization.js";
import { policyGrantForVerificationSchema } from "../schema/verifySchemas.js";
import { settlementIntentForVerificationSchema } from "../schema/verifySchemas.js";
import { verifyBudgetAuthorization } from "./verifyBudgetAuthorization.js";
import { verifyPaymentAuthorization } from "./verifyPaymentAuthorization.js";
import { verifyPolicyGrant } from "./verifyPolicyGrant.js";
import { verifySettlementIntent } from "./verifySettlementIntent.js";

function parseArtifact(
  name: string,
  schema: { safeParse: (v: unknown) => { success: boolean; error?: { errors: unknown[]; message: string } } },
  value: unknown,
): VerificationResult {
  const result = schema.safeParse(value);
  if (result.success) return { valid: true };
  const first = (result as { error: { errors: Array<{ path?: string[]; message?: string }> } }).error.errors[0];
  const path = first?.path?.length ? first.path.join(".") + ": " : "";
  return { valid: false, reason: `invalid_artifact: ${name} ${path}${first?.message ?? (result as { error: { message: string } }).error.message}`, artifact: name };
}

/**
 * Verify a full MPCP settlement chain.
 *
 * Order: 1 schema validation, 2 hash validation, 3 artifact linkage,
 *        4 budget limits, 5 policy constraints (via sub-verifiers).
 *
 * @param ctx - Full verification context
 * @returns Deterministic result with clear failure reason
 */
export function verifySettlement(
  ctx: SettlementVerificationContext,
): VerificationResult {
  // 1. Schema validation
  const grantCheck = parseArtifact("policyGrant", policyGrantForVerificationSchema, ctx.policyGrant);
  if (!grantCheck.valid) return grantCheck;
  const sbaCheck = parseArtifact("signedBudgetAuthorization", signedBudgetAuthorizationSchema, ctx.signedBudgetAuthorization);
  if (!sbaCheck.valid) return sbaCheck;
  const spaCheck = parseArtifact("signedPaymentAuthorization", signedPaymentAuthorizationSchema, ctx.signedPaymentAuthorization);
  if (!spaCheck.valid) return spaCheck;
  // 1. Schema validation (settlement intent when present)
  if (ctx.settlementIntent) {
    const intentCheck = parseArtifact("settlementIntent", settlementIntentForVerificationSchema, ctx.settlementIntent);
    if (!intentCheck.valid) return intentCheck;
  }
  if (
    ctx.signedPaymentAuthorization.authorization.intentHash &&
    !ctx.settlementIntent
  ) {
    return { valid: false, reason: "intent_required", artifact: "signedPaymentAuthorization" };
  }

  const grantResult = verifyPolicyGrant(ctx.policyGrant, {
    nowMs: ctx.nowMs,
  });
  if (!grantResult.valid) return grantResult;

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
  if (!paymentResult.valid) return paymentResult;

  if (ctx.settlementIntent) {
    const intentResult = verifySettlementIntent(
      ctx.signedPaymentAuthorization,
      ctx.settlementIntent as Record<string, unknown>,
    );
    if (!intentResult.valid) return intentResult;
  } else if (ctx.signedPaymentAuthorization.authorization.intentHash) {
    return { valid: false, reason: "intent_required", artifact: "signedPaymentAuthorization" };
  }

  return { valid: true };
}

function recordStep(steps: VerificationStep[], name: string, result: VerificationResult): boolean {
  const ok = result.valid;
  steps.push({ name, ok, reason: ok ? undefined : result.reason });
  return ok;
}

/**
 * Verify settlement and return a per-step report for CLI and debugging.
 * Runs the full chain and records each step, short-circuiting on first failure.
 * Display order: intent hash (if applicable), payment auth, budget auth, policy grant.
 */
export function verifySettlementWithReport(ctx: SettlementVerificationContext): VerificationReport {
  const steps: VerificationStep[] = [];

  const grantCheck = parseArtifact("policyGrant", policyGrantForVerificationSchema, ctx.policyGrant);
  if (!grantCheck.valid) {
    return { result: grantCheck, steps };
  }
  const sbaCheck = parseArtifact("signedBudgetAuthorization", signedBudgetAuthorizationSchema, ctx.signedBudgetAuthorization);
  if (!sbaCheck.valid) return { result: sbaCheck, steps };
  const spaCheck = parseArtifact("signedPaymentAuthorization", signedPaymentAuthorizationSchema, ctx.signedPaymentAuthorization);
  if (!spaCheck.valid) return { result: spaCheck, steps };
  if (ctx.settlementIntent) {
    const intentCheck = parseArtifact("settlementIntent", settlementIntentForVerificationSchema, ctx.settlementIntent);
    if (!intentCheck.valid) return { result: intentCheck, steps };
  }
  if (ctx.signedPaymentAuthorization.authorization.intentHash && !ctx.settlementIntent) {
    return { result: { valid: false, reason: "intent_required", artifact: "signedPaymentAuthorization" }, steps };
  }

  const grantResult = verifyPolicyGrant(ctx.policyGrant, { nowMs: ctx.nowMs });
  if (!recordStep(steps, "policy grant valid", grantResult)) {
    return { result: grantResult, steps };
  }

  const budgetResult = verifyBudgetAuthorization(
    ctx.signedBudgetAuthorization,
    ctx.policyGrant,
    ctx.paymentPolicyDecision,
    { nowMs: ctx.nowMs },
  );
  if (!recordStep(steps, "budget authorization valid", budgetResult)) {
    return { result: budgetResult, steps };
  }

  const paymentResult = verifyPaymentAuthorization(
    ctx.signedPaymentAuthorization,
    ctx.signedBudgetAuthorization,
    ctx.policyGrant,
    ctx.paymentPolicyDecision,
    ctx.settlement,
    { nowMs: ctx.nowMs, settlementIntent: ctx.settlementIntent },
  );
  if (!recordStep(steps, "payment authorization valid", paymentResult)) {
    return { result: paymentResult, steps };
  }

  if (ctx.settlementIntent) {
    const intentResult = verifySettlementIntent(
      ctx.signedPaymentAuthorization,
      ctx.settlementIntent as Record<string, unknown>,
    );
    if (!recordStep(steps, "intent hash valid", intentResult)) {
      return { result: intentResult, steps };
    }
  }

  return { result: { valid: true }, steps };
}

/**
 * Safe wrapper for verifySettlement. Catches any thrown exceptions (e.g. from
 * JSON parsing, crypto, or unexpected errors) and returns a VerificationResult
 * instead of crashing. Use this in CLI or other contexts where exceptions
 * should not propagate.
 */
export function verifySettlementSafe(
  ctx: SettlementVerificationContext,
): VerificationResult {
  try {
    return verifySettlement(ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, reason: `verification_error: ${message}` };
  }
}

/**
 * Safe wrapper for verifySettlementWithReport. Catches thrown exceptions and
 * returns a report with a single failed step. Use in CLI.
 */
export function verifySettlementWithReportSafe(ctx: SettlementVerificationContext): VerificationReport {
  try {
    return verifySettlementWithReport(ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      result: { valid: false, reason: `verification_error: ${message}` },
      steps: [{ name: "verification", ok: false, reason: message }],
    };
  }
}
