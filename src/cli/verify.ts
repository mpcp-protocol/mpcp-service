import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SettlementVerificationContext } from "../verify/types.js";
import {
  verifySettlementDetailedSafe,
  verifySettlementWithReportSafe,
} from "../verify/index.js";
import { formatVerificationReport } from "./formatReport.js";
import { formatExplainOutput } from "./formatExplain.js";
import { isSettlementBundle, bundleToContext } from "./bundle.js";

export interface VerifyOptions {
  explain?: boolean;
  json?: boolean;
}

export function runVerify(
  filePath: string,
  options: VerifyOptions = {},
): { ok: boolean; output: string } {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), filePath), "utf-8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, output: `Error: cannot read file ${filePath}: ${msg}` };
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, output: `Error: invalid JSON in ${filePath}: ${msg}` };
  }

  // Inject bundle public keys into env so verification can proceed without env config
  if (isSettlementBundle(data)) {
    if (data.sbaPublicKeyPem) {
      process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = data.sbaPublicKeyPem;
      process.env.MPCP_SBA_SIGNING_KEY_ID = data.sba.keyId;
    }
    if (data.spaPublicKeyPem) {
      process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM = data.spaPublicKeyPem;
      process.env.MPCP_SPA_SIGNING_KEY_ID = data.spa.keyId;
    }
  }

  const ctx: SettlementVerificationContext = isSettlementBundle(data)
    ? bundleToContext(data)
    : (data as SettlementVerificationContext);

  if (options.explain || options.json) {
    const report = verifySettlementDetailedSafe(ctx);
    if (options.json) {
      return {
        ok: report.valid,
        output: JSON.stringify(report, null, 2),
      };
    }
    return {
      ok: report.valid,
      output: formatExplainOutput(report),
    };
  }

  const report = verifySettlementWithReportSafe(ctx);
  return {
    ok: report.result.valid,
    output: formatVerificationReport(report),
  };
}
