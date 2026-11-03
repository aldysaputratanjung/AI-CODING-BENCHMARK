# GUARDIAN v1 — Reasoning Cards (2026-11-03)
Zone: westconid.cftenant.com · Mode: READ-ONLY (tidak ada write yang dieksekusi)

Data dasar (GraphQL, 24 jam):
- 5.309 block total, 909 managed_challenge
- Top rules: [ALDY] Allow only Indonesia - aldy-studio (block, 2.537), managedChallenge-to-worker (1.925), Code Injection CVE-2022-29078 (1.374), Drupal/WP Anomaly Header CVE-2018-14773 (1.040), Version Control Info Disclosure (955), Wordpress RCE CVE-2026-63030 (852), DLP: UK National Insurance Number (log, 9)

## Draft G-001 — Escalate DLP NINO rule: log → block
- Reasoning: 9 hit/24h pola PII sensitif tanpa use-case bisnis yang sah; false-positive risk rendah.
- Risk: LOW · Reversible: YES (edit expression action saja) · Status: MENUNGGU APPROVAL

## Draft G-002 — Audit 12 custom rule disabled
- Reasoning: 29 rule ada, 17 aktif; rule mati >6 bulan biasanya sisa eksperimen — bersihkan supaya rulebase mudah diaudit.
- Risk: NONE · Reversible: YES · Status: MENUNGGU APPROVAL

## Draft G-003 — Observasi managedChallenge-to-worker
- Reasoning: 1.925 challenge/hari perlu data rasio solve sebelum disarankan escalate.
- Risk: N/A (data-only) · Status: DATA COLLECTION
