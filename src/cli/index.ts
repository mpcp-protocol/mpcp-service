#!/usr/bin/env node

/**
 * MPCP Verifier CLI
 *
 * Usage: mpcp verify <settlement.json>
 *
 * Reads a JSON file with SettlementVerificationContext and prints the verification chain.
 */

import { runVerify } from "./verify.js";

const HELP = `Usage:
  mpcp verify <settlement-file> [options]

Options:
  --explain   Step-by-step diagnostics (schema checks, expected/actual)
  --json      Machine-readable JSON output

Accepts:
  - Full SettlementVerificationContext (policyGrant, signedBudgetAuthorization, etc.)
  - JSON artifact bundle: settlement, intent, spa, sba, policyGrant

Example:
  mpcp verify examples/parking-session/settlement-bundle.json
  mpcp verify settlement.json --explain
`;

function main(): number {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") {
    process.stdout.write(HELP);
    return 0;
  }

  if (cmd !== "verify") {
    process.stderr.write(`Unknown command: ${cmd}\n`);
    process.stderr.write(`Usage: mpcp verify <file>\n`);
    return 1;
  }

  const rest = args.slice(1);
  const explain = rest.includes("--explain");
  const json = rest.includes("--json");
  const filePath = rest.filter((a) => !a.startsWith("--"))[0];

  if (!filePath) {
    process.stderr.write("Error: missing file path\n");
    process.stderr.write(`Usage: mpcp verify <file>\n`);
    return 1;
  }

  const { ok, output } = runVerify(filePath, { explain, json });

  process.stdout.write(output);
  process.stdout.write("\n");
  return ok ? 0 : 1;
}

process.exitCode = main();
