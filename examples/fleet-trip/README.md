# Fleet Trip Demo

Demonstrates a robotaxi (EV-001) completing a full commercial trip with three autonomous service payments, cumulative budget enforcement, and a post-trip fleet audit.

## What It Shows

| Concept | Description |
|---------|-------------|
| Multi-payment session | Same PolicyGrant and SBA used across 3 payments |
| Cumulative budget enforcement | Vehicle wallet tracks spend; 4th payment refused |
| Signed PolicyGrant | Fleet operator signs grant; verifier enforces signature |
| Destination allowlist | Only pre-approved service types accepted |
| Stateless audit | Each bundle verifies independently after the trip |
| Tamper detection | Modified settlement amount detected at audit time |

## Trip Scenario

**Vehicle:** EV-001 (robotaxi, fleet-robotaxi-west)
**Session budget:** $40.00 XRPL / RLUSD
**Allowed destinations:** toll booth, EV charging, parking garage

| Stop | Service | Amount | Cumulative |
|------|---------|--------|------------|
| 1 | Toll Booth (I-280 N) | $6.00 | $6.00 |
| 2 | EV Charging (ChargePoint SF-04) | $18.00 | $24.00 |
| 3 | Parking Garage (Market St) | $12.00 | $36.00 |
| 4 | Charging again | $8.00 | **REJECTED** ($44 > $40 budget) |

## Run

```bash
npm run build
npm run example:fleet-trip
```

## Generated Files

| File | Description |
|------|-------------|
| `bundle-stop1-toll.json` | Settlement bundle — toll payment |
| `bundle-stop2-charging.json` | Settlement bundle — EV charging payment |
| `bundle-stop3-parking.json` | Settlement bundle — parking payment |
| `bundle-stop2-charging-TAMPERED.json` | Modified bundle (tamper detection demo) |

Each bundle is self-contained and can be verified independently:

```bash
npx mpcp verify examples/fleet-trip/bundle-stop1-toll.json --explain
npx mpcp verify examples/fleet-trip/bundle-stop3-parking.json --explain
npx mpcp verify examples/fleet-trip/bundle-stop2-charging-TAMPERED.json --explain
# Last one fails: SignedPaymentAuthorization.valid payment_auth_mismatch
```

## How Cumulative Budget Enforcement Works

The vehicle wallet acts as the **session authority** — it tracks cumulative spending and refuses to sign a new SPA when the running total would exceed `maxAmountMinor`.

```
Before Stop 1:  cumulativeSpent = $0     →  $0 + $6  = $6   ≤ $40  ✓
Before Stop 2:  cumulativeSpent = $6     →  $6 + $18 = $24  ≤ $40  ✓
Before Stop 3:  cumulativeSpent = $24    →  $24 + $12 = $36 ≤ $40  ✓
Before Stop 4:  cumulativeSpent = $36    →  $36 + $8 = $44  > $40  ✗ REJECTED
```

The verifier is stateless — it checks each bundle independently. Cumulative enforcement lives in the wallet, which must persist this counter in trusted local storage.

## See Also

- [Machine Wallet Guardrails](../../docs/implementation/machine-wallet-guardrails.md)
- [SignedBudgetAuthorization — Cumulative Enforcement](https://mpcp-protocol.github.io/mpcp-spec/protocol/SignedBudgetAuthorization/#cumulative-enforcement)
- [Offline Payment Demo](../parking/demo-offline.mjs) — same concept, no connectivity
