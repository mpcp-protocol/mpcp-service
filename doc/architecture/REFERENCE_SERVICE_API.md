# MPCP Reference Service API (PR17)

Lightweight facade for backend teams. Wraps protocol + verifier + anchor so adopters don't need to compose low-level APIs.

## Import

```ts
import {
  issueBudget,
  verifySettlementService,
  verifyDispute,
  verifyDisputeAsync,
  anchorIntent,
} from "mpcp-service/service";
```

## API

### issueBudget

Issue a signed budget authorization from a policy grant.

```ts
const sba = issueBudget({
  policyGrant,
  sessionId: "session-123",
  vehicleId: "vehicle-456",
  maxAmountMinor: "3000",
  destinationAllowlist: ["rParking", "rCharging"],
});

if (!sba) {
  // MPCP_SBA_SIGNING_PRIVATE_KEY_PEM not configured
}
```

**Requires:** `MPCP_SBA_SIGNING_PRIVATE_KEY_PEM` (and `MPCP_SBA_SIGNING_PUBLIC_KEY_PEM`, `MPCP_SBA_SIGNING_KEY_ID`).

---

### verifySettlementService

Verify a settlement against the full MPCP chain (PolicyGrant → SBA → SPA → Settlement).

```ts
const result = verifySettlementService(context);
// result: { valid: true } | { valid: false; reason: string }
```

---

### verifyDispute / verifyDisputeAsync

Verify a disputed settlement with optional ledger anchor.

```ts
// Sync (mock anchor, or Hedera with intentHash in anchor)
const result = verifyDispute({ context, ledgerAnchor });

// Async (Hedera HCS mirror verification)
const result = await verifyDisputeAsync({ context, ledgerAnchor });
```

---

### anchorIntent

Publish an intent hash to a ledger.

```ts
// Mock (development)
const anchor = await anchorIntent(intentHash, { rail: "mock" });

// Hedera HCS (requires HEDERA_OPERATOR_ACCOUNT_ID, etc.)
const anchor = await anchorIntent(intentHash, { rail: "hedera-hcs" });
```

---

## See Also

- [Protocol specification](../protocol/mpcp.md)
- Package subpath `mpcp-service/sdk` — lower-level artifact creation and hashing
- [Intent Anchoring](./INTENT_ANCHORING.md)
