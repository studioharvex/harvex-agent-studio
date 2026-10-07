// Deploy Harvex to YOUR Cloudflare account (Worker + D1 + custom domain).
// Reads deploy.config.json (copy from deploy.config.example.json), patches the generated
// dist/server/wrangler.json and runs wrangler. Usage:
//   npm run build && node scripts/deploy.mjs            # deploy
//   node scripts/deploy.mjs --migrate                   # apply pending D1 migrations to the REMOTE database
//   node scripts/deploy.mjs --dry                       # only write dist/server/wrangler.deploy.json
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfgPath = join(root, 'deploy.config.json');
if (!existsSync(cfgPath)) { console.error('Missing deploy.config.json. Copy deploy.config.example.json and fill in your values.'); process.exit(1); }
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
for (const k of ['workerName', 'd1DatabaseName', 'd1DatabaseId']) if (!cfg[k]) { console.error(`deploy.config.json: "${k}" is required.`); process.exit(1); }

const genPath = join(root, 'dist/server/wrangler.json');
if (!existsSync(genPath)) { console.error('dist/server/wrangler.json not found. Run `npm run build` first.'); process.exit(1); }
const w = JSON.parse(readFileSync(genPath, 'utf8'));
w.name = cfg.workerName; w.topLevelName = cfg.workerName;
w.d1_databases = [{ binding: 'DB', database_name: cfg.d1DatabaseName, database_id: cfg.d1DatabaseId }];
w.vars = { AI_ENABLED: String(cfg.aiEnabled ?? false), OPENAI_MODEL: cfg.openaiModel || '', PLATFORM_FEE_BPS: String(cfg.platformFeeBps ?? 0), APP_ORIGIN: cfg.origin || '', AUTH_TRUST_SITES_HEADERS: 'false',
  // the parts that are not open yet (lib/gate.ts): "chain,app,community,signin", "all" or "" for everything open
  CLOSED_SECTIONS: cfg.closedSections || '' };
if (cfg.domain) w.routes = [{ pattern: cfg.domain, custom_domain: true }, ...(cfg.wwwRedirect === false ? [] : [{ pattern: 'www.' + cfg.domain, custom_domain: true }])];
delete w.dev;
const outPath = join(root, 'dist/server/wrangler.deploy.json');
writeFileSync(outPath, JSON.stringify(w, null, 2));
console.log('Wrote', outPath);

const wrangler = join(root, 'node_modules/wrangler/bin/wrangler.js');
const run = (args) => { const r = spawnSync(process.execPath, [wrangler, ...args], { stdio: 'inherit', cwd: root, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } }); if (r.status !== 0) process.exit(r.status ?? 1); };
const flag = process.argv[2];
if (flag === '--dry') process.exit(0);
if (flag === '--migrate') {
  const files = readdirSync(join(root, 'drizzle')).filter(f => f.endsWith('.sql')).sort();
  const from = Number(process.argv[3] ?? 0);
  for (const f of files) { if (Number(f.slice(0, 4)) < from) continue; console.log('\n== applying', f); run(['d1', 'execute', 'DB', '--remote', '--config', outPath, '--file', join(root, 'drizzle', f)]); }
  process.exit(0);
}
run(['deploy', '--config', outPath]);
console.log(`\nDeployed. Secrets are set separately:\n  npx wrangler secret put OPENAI_API_KEY --config ${outPath}\n  npx wrangler secret put BETTER_AUTH_SECRET --config ${outPath}`);
