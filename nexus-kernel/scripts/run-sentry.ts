// Runner SENTRY di sandbox — bukti Tahap 3 dengan data nyata.
import { runSentry } from "../src/sentry";

async function main() {
  const report = await runSentry({ CF_API_TOKEN: process.env.CF_API_TOKEN });
  console.log(report.narrative);
  console.log("\n--- RAW ---");
  console.log(JSON.stringify({ ...report, narrative: undefined }, null, 1));
}
main();
