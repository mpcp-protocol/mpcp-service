# Parking Session Example

A full MPCP settlement flow for a parking payment scenario.

## Flow

1. **fleet-policy.json** — Fleet policy constraints (reference)
2. **policy-grant.json** — Grant derived from fleet policy
3. **budget-auth.json** — Unsigned budget authorization
4. **signed-budget-auth.json** — Signed budget auth (SBA)
5. **spa.json** — Signed payment authorization
6. **settlement-intent.json** — Settlement intent
7. **settlement.json** — Settlement result
8. **settlement-bundle.json** — Combined bundle for verification

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

Verification is self-contained: the bundle includes signed payloads with embedded public keys, so anyone can run `mpcp verify` on the bundle without regenerating it.
