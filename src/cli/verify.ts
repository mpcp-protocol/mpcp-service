import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SettlementVerificationContext } from "../verify/types.js";
import { verifySettlementWithReportSafe } from "../verify/index.js";
import { formatVerificationReport } from "./formatReport.js";
import { isSettlementBundle, bundleToContext } from "./bundle.js";

export function runVerify(filePath: string): { ok: boolean; output: string } {
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

  const ctx: SettlementVerificationContext = isSettlementBundle(data)
    ? bundleToContext(data)
    : (data as SettlementVerificationContext);

  const report = verifySettlementWithReportSafe(ctx);
  return {
    ok: report.result.valid,
    output: formatVerificationReport(report),
  };
}
