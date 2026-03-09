export type {
  Rail,
  Asset,
  SettlementResult,
  PaymentPolicyDecision,
  SessionPolicyGrant,
  PolicyGrant,
  SignedSessionBudgetAuthorization,
  SignedBudgetAuthorization,
  SignedPaymentAuthorization,
  EnforcementResult,
  Policy,
} from "mpcp-service";

/** Intent object for settlement (rail-specific). Use unknown for custom shapes. */
export type SettlementIntent = unknown;
