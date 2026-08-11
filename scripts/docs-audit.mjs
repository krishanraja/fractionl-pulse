import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const documentationFiles = [
  "README.md",
  "docs/AGENT_BRIEFING.md",
  "docs/AGENT_INTEGRATION.md",
  "docs/AUTONOMOUS_GTM_PLAYBOOK.md",
  "docs/CORPORATE_STRATEGY.md",
  "docs/DATA_SOURCES_ROADMAP.md",
  "docs/DESIGN_SYSTEM.md",
  "docs/DOCUMENTATION_GOVERNANCE.md",
  "docs/FLEET_WIRING.md",
  "docs/MCP_TOOL.md",
  "docs/MONETIZATION_STRATEGY.md",
  "docs/NORTH_STAR.md",
  "docs/SALES_PLAYBOOK.md",
  "docs/TECHNICAL_SPEC.md",
  "docs/WEEKLY_PIPELINE_AUDIT.md",
  "public/llms.txt",
];

const failures = [];
const contentByFile = new Map();

for (const relativePath of documentationFiles) {
  const absolutePath = resolve(root, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`${relativePath}: missing required documentation file`);
    continue;
  }

  const content = readFileSync(absolutePath, "utf8");
  contentByFile.set(relativePath, content);

  if (extname(relativePath) === ".md") {
    const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
    for (const match of content.matchAll(linkPattern)) {
      const target = match[1].trim().replace(/^<|>$/g, "").split("#", 1)[0];
      if (!target || /^(?:https?:|mailto:)/i.test(target)) continue;
      const targetPath = resolve(dirname(absolutePath), decodeURIComponent(target));
      if (!existsSync(targetPath)) {
        failures.push(`${relativePath}: broken relative link ${match[1]}`);
      }
    }
  }
}

const staleClaims = [
  [/composite settles weekly/i, "stale weekly-settle claim"],
  [/latest weekly score/i, "stale weekly-score claim"],
  [/react-router-dom`? v6/i, "stale router version"],
  [/supply_score numeric\(5,2\) NOT NULL/i, "stale non-null supply schema"],
  [/US coverage is primary and UK coverage secondary/i, "unsupported UK benchmark claim"],
  [/pulse-daily-redeploy[^\n]*(?:pings|refreshes daily)/i, "unverified production redeploy cron claim"],
];

for (const [relativePath, content] of contentByFile) {
  for (const [pattern, label] of staleClaims) {
    if (pattern.test(content)) failures.push(`${relativePath}: ${label}`);
  }
}

let truth;
try {
  truth = JSON.parse(readFileSync(resolve(root, "public/product-truth.json"), "utf8"));
} catch (error) {
  failures.push(`public/product-truth.json: invalid JSON (${error.message})`);
}

if (truth) {
  const requiredTopLevel = [
    "schema_version",
    "content_version",
    "last_reconciled",
    "product",
    "strategy",
    "coverage",
    "offers",
    "api",
    "live_product",
    "production_snapshot",
    "not_live",
    "commercial_operations",
    "do_not_say",
  ];
  for (const key of requiredTopLevel) {
    if (!(key in truth)) failures.push(`public/product-truth.json: missing ${key}`);
  }

  if (truth.coverage?.tracked_inputs !== 21) failures.push("public/product-truth.json: tracked_inputs must be 21");
  if (truth.coverage?.roles?.length !== 6) failures.push("public/product-truth.json: exactly six role-demand lanes are supported");
  if (!truth.strategy?.primary_paying_icp) failures.push("public/product-truth.json: primary paying ICP is missing");
  if (truth.offers?.public_instrument?.price !== "£0") failures.push("public/product-truth.json: public instrument price drift");
  if (truth.offers?.founding_benchmark_partner?.price !== "£1,500 for 90 days") failures.push("public/product-truth.json: founding pilot price drift");
  if (!truth.commercial_operations?.agent_requires_separate_authority_for?.includes("sending")) {
    failures.push("public/product-truth.json: autonomous sending boundary is missing");
  }
}

try {
  JSON.parse(readFileSync(resolve(root, "public/.well-known/ai-plugin.json"), "utf8"));
} catch (error) {
  failures.push(`public/.well-known/ai-plugin.json: invalid JSON (${error.message})`);
}

if (failures.length > 0) {
  console.error("Documentation audit failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Documentation audit passed: ${documentationFiles.length} required files, relative links, machine contracts, and stale-claim guards.`);
