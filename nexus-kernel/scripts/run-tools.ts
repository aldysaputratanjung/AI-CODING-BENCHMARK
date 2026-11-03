// Runner sandbox: panggil semua Tool Mesh v1 untuk membuktikan tool bekerja dengan data nyata.
import { listTools } from "../src/registry";
import "../src/tools"; // side-effect: registrasi tool CF

async function main() {
  for (const t of listTools()) {
    if (t.name === "ping") continue; // sudah teruji di unit test
    try {
      const out = await t.run({}, {});
      console.log(`\n=== TOOL ${t.name} ===`);
      console.log(JSON.stringify(out, null, 1).slice(0, 900));
    } catch (e: any) {
      console.log(`\n=== TOOL ${t.name} GAGAL === ${e.message}`);
    }
  }
}
main();
