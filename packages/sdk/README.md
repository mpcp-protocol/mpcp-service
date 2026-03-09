# @mpcp/sdk

Minimal developer-facing SDK for the Machine Payment Control Protocol (MPCP).

For scope, exports, and discipline, see [SDK_MINIMAL_PLAN.md](../../doc/SDK_MINIMAL_PLAN.md).

## Installation

```bash
pnpm add @mpcp/sdk
```

## API

### MPCPClient

```ts
const client = new MPCPClient({ baseUrl: "https://mpcp.example.com", apiKey: "..." });

await client.createGrant(input);       // → Promise<PolicyGrant>
await client.createBudget(input);      // → Promise<SignedBudgetAuthorization>
await client.createAuthorization(input); // → Promise<SignedPaymentAuthorization>
await client.verifySettlement(input);  // → Promise<VerificationResult>
await client.computeIntentHash(intent); // → Promise<{ intentHash: string; canonicalIntent: object }>
```

### Local helpers

```ts
// Canonical intent
computeIntentHash(intent: SettlementIntent): string
canonicalJson(value: unknown): string

// Budget (SBA)
createSignedBudgetAuthorization(...)
verifySignedBudgetAuthorization(...)

// Payment (SPA)
createSignedPaymentAuthorization(...)
verifySignedPaymentAuthorizationForSettlement(...)
```
