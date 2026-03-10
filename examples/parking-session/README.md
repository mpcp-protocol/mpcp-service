# Parking Session Example

A full MPCP settlement flow for a parking payment scenario.

## Flow

**Reference artifact** (static, not generated):

- **fleet-policy.json** — Fleet policy constraints. A minimal policy for illustration; the generate script does not use or produce this file.

**Generated artifacts** (created by `generate.mjs`):

1. **policy-grant.json** — Grant derived from policy constraints
2. **budget-auth.json** — Unsigned budget authorization
3. **signed-budget-auth.json** — Signed budget auth (SBA)
4. **spa.json** — Signed payment authorization
5. **settlement-intent.json** — Settlement intent
6. **settlement.json** — Settlement result
7. **settlement-bundle.json** — Combined bundle for verification

## Generate and Verify

```bash
npm run build
npm run example:parking
```

Or:

```bash
node examples/parking-session/generate.mjs
```

The script:

- Creates ephemeral signing keys
- Generates all artifacts using the SDK
- Writes each artifact to a JSON file
- Runs `mpcp verify settlement-bundle.json --explain`
- Exits 0 if verification passes

## Verify Only

If you have already run generate and want to re-verify:

```bash
npx mpcp verify examples/parking-session/settlement-bundle.json --explain
```

The bundle is self-contained: it includes `sbaPublicKeyPem` and `spaPublicKeyPem`, so anyone can run `mpcp verify` on it without setting env vars or regenerating.

Committed artifacts use fixed timestamps (`expiresAt: 2030-12-31`, `nowISO: 2026-01-15`) so they remain verifiable indefinitely.
