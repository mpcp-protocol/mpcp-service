// Artifact helpers
export {
  createSignedBudgetAuthorization,
  verifySignedBudgetAuthorization,
} from "./budget.js";
export {
  createSignedPaymentAuthorization,
  verifySignedPaymentAuthorizationForSettlement,
  verifySignedPaymentAuthorizationForSettlement as verifySettlement,
} from "./payment.js";

// Canonical intent helpers
export { canonicalJson, computeIntentHash } from "./intent.js";

// Policy-only settlement verification (no SPA)
export { enforcePayment } from "mpcp-service";

// Service client
export { MPCPClient } from "./client.js";
export type {
  MPCPClientConfig,
  GrantRequest,
  BudgetRequest,
  AuthorizeRequest,
  VerifySettlementRequest,
  VerificationResult,
  MPCPError,
} from "./client.js";

// Types
export type {
  Rail,
  Asset,
  SettlementResult,
  SettlementIntent,
  PaymentPolicyDecision,
  SessionPolicyGrant,
  PolicyGrant,
  SignedBudgetAuthorization,
  SignedPaymentAuthorization,
  EnforcementResult,
  Policy,
} from "./types.js";
