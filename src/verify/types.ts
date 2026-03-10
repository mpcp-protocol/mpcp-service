import type {
  PaymentPolicyDecision,
  SettlementResult,
} from "../policy-core/types.js";
import type { SignedSessionBudgetAuthorization } from "../protocol/sba.js";
import type { SignedPaymentAuthorization } from "../protocol/spa.js";

/** Minimal grant shape for verification */
export interface PolicyGrantLike {
  grantId?: string;
  policyHash: string;
  expiresAt?: string;
  expiresAtISO?: string;
  allowedRails: string[];
  allowedAssets?: unknown[];
}

/** Result of a verification step */
export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: string };

/** Context for full settlement verification */
export interface SettlementVerificationContext {
  policyGrant: PolicyGrantLike;
  signedBudgetAuthorization: SignedSessionBudgetAuthorization;
  signedPaymentAuthorization: SignedPaymentAuthorization;
  settlement: SettlementResult;
  /** Decision used to create the SPA; required for budget limit verification */
  paymentPolicyDecision: PaymentPolicyDecision;
  settlementIntent?: unknown;
  decisionId: string;
  nowMs?: number;
}
