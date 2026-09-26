// Connects the app to its own Supabase backend in one go. Usage: npm run setup:backend
//
// Signs in to Supabase in the browser (or uses SUPABASE_ACCESS_TOKEN), creates
// or reuses the `universe` project in the EU, loads the database, stores the
// Claude API key as a function secret, deploys the server functions and writes
// .env.local. Keys are typed with hidden input (or read from ANTHROPIC_API_KEY)
// and never printed. Safe to run again: it reuses the linked project.
//
// Options: --org <id>  --project-ref <ref>  --region <region> (default eu-central-1)
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { listFrom, looksLikeClaudeKey, parseCliJson, projectRef, publicKey, rowCount, withEnv } from './lib/backend-setup.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const NAME = 'universe';
const { values: options } = parseArgs({
  options: {
    org: { type: 'string' },
    'project-ref': { type: 'string' },
    region: { type: 'string', default: 'eu-central-1' },
  },
});
const interactive = Boolean(process.stdin.isTTY);
const windows = process.platform === 'win32';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------- terminal

const step = (n, text) => console.log(`\n[${n}/7] ${text}`);
const info = (text) => console.log(`      ${text}`);
function fail(text) {
  console.error(`\n✗ ${text}`);
  process.exit(1);
}

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

/** Reads a line without echoing it (for keys and passwords). */
function askHidden(question) {
  if (!interactive) return Promise.resolve('');
  return new Promise((resolve) => {
    const stdin = process.stdin;
    let value = '';
    const done = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      process.stdout.write('\n');
      resolve(value.trim());
    };
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') return done();
        if (char === '\u0003') {
          stdin.setRawMode(false);
          process.exit(130);
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    };
    process.stdout.write(question);
    stdin.setEncoding('utf8');
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

// ------------------------------------------------------------ supabase cli

function supabase(args, { capture = false, env = {} } = {}) {
  const quoted = windows ? args.map((arg) => (/[\s"]/.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg)) : args;
  const result = spawnSync('npx', ['--yes', 'supabase', ...quoted], {
    cwd: root,
    stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    shell: windows,
    env: { ...process.env, ...env },
  });
  return { ok: result.status === 0, output: `${result.stdout ?? ''}`, errors: `${result.stderr ?? ''}` };
}

function supabaseList(args) {
  const result = supabase([...args, '-o', 'json'], { capture: true });
  return result.ok ? listFrom(parseCliJson(result.output)) : null;
}

// ------------------------------------------------------------------- steps

async function signIn() {
  step(1, 'Supabase account');
  if (supabaseList(['projects', 'list'])) return info('Signed in.');
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    fail('Supabase rejected SUPABASE_ACCESS_TOKEN. Create a new token at https://supabase.com/dashboard/account/tokens (it starts with sbp_), or unset the variable to sign in in the browser.');
  }
  if (!interactive) fail('Not signed in to Supabase. Run `npx supabase login` first, or set SUPABASE_ACCESS_TOKEN.');
  info('A browser window opens: sign in to Supabase (create a free account if you have none).');
  if (!supabase(['login']).ok || !supabaseList(['projects', 'list'])) fail('Supabase sign-in did not complete. Run the command again.');
  info('Signed in.');
}

async function chooseOrganization() {
  const orgs = supabaseList(['orgs', 'list']) ?? [];
  if (options.org) return options.org;
  if (orgs.length === 0) fail('Your Supabase account has no organization: create one at https://supabase.com/dashboard, then run this again.');
  if (orgs.length === 1) return orgs[0].id;
  if (!interactive) fail(`You belong to several organizations: run again with --org <id> (${orgs.map((org) => `${org.id} = ${org.name}`).join(', ')}).`);
  orgs.forEach((org, index) => info(`${index + 1}. ${org.name}`));
  const choice = Number(await ask('      Organization for the project (number): '));
  if (!orgs[choice - 1]) fail('No such organization.');
  return orgs[choice - 1].id;
}

async function waitUntilReady(ref) {
  process.stdout.write('      Starting the project (usually 1–3 minutes)');
  for (let i = 0; i < 60; i++) {
    const project = (supabaseList(['projects', 'list']) ?? []).find((p) => projectRef(p) === ref);
    if (project?.status === 'ACTIVE_HEALTHY') return process.stdout.write(' ready.\n');
    process.stdout.write('.');
    await sleep(10_000);
  }
  process.stdout.write('\n');
  info('The project is still starting; carrying on anyway.');
}

/** Returns { ref, password } — password only when the project was created now. */
async function chooseProject() {
  step(2, `Project "${NAME}"`);
  const linkedFile = join(root, 'supabase', '.temp', 'project-ref');
  const linked = existsSync(linkedFile) ? readFileSync(linkedFile, 'utf8').trim() : '';
  const projects = supabaseList(['projects', 'list']) ?? [];
  const known = (ref) => projects.some((p) => projectRef(p) === ref);

  const given = options['project-ref'] ?? (known(linked) ? linked : undefined);
  if (given) {
    info(`Using project ${given}.`);
    return { ref: given };
  }
  const existing = projects.find((p) => p.name === NAME);
  if (existing) {
    const answer = interactive ? await ask(`      A project called "${NAME}" exists (${projectRef(existing)}). Use it? [Y/n] `) : 'y';
    if (!/^n/i.test(answer)) return { ref: projectRef(existing) };
  }

  const org = await chooseOrganization();
  const password = randomBytes(24).toString('base64url');
  info(`Creating "${NAME}" in ${options.region}…`);
  if (!supabase(['projects', 'create', NAME, '--org-id', org, '--region', options.region, '--db-password', password]).ok) {
    fail('Supabase could not create the project (the Free plan allows 2 active projects per account). Free a slot or pass --project-ref <ref> to use an existing project.');
  }
  const created = (supabaseList(['projects', 'list']) ?? []).find((p) => p.name === NAME && !known(projectRef(p)));
  if (!created) fail('The project was created but does not show up yet: run this again in a minute.');
  const ref = projectRef(created);
  await waitUntilReady(ref);
  info('The database password was generated and not stored; reset it any time in Project Settings → Database.');
  return { ref, password };
}

async function loadDatabase(ref, password) {
  step(3, 'Database: tables, access rules and ~10,000 universities');
  const env = password ? { SUPABASE_DB_PASSWORD: password } : {};
  if (!password && interactive) info('If asked, type the database password (reset it in Project Settings → Database if you do not have it).');
  if (!supabase(['link', '--project-ref', ref], { env }).ok) fail('Could not link the project.');
  const push = ['db', 'push', '--include-seed', ...(password || !interactive ? ['--yes'] : [])];
  for (let attempt = 1; ; attempt++) {
    if (supabase(push, { env }).ok) return info('Database ready.');
    if (!password || attempt === 3) fail('Loading the database failed (see the message above). Run this again to retry.');
    info('The new database is still waking up: retrying in 20 seconds…');
    await sleep(20_000);
  }
}

async function claudeKey() {
  step(4, 'Claude API key (for the AI research features)');
  let key = process.env.ANTHROPIC_API_KEY?.trim() ?? '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!key) {
      if (!interactive) break;
      info('Create one at https://console.anthropic.com → API keys → Create key, then copy it.');
      key = await askHidden('      Paste the key here and press Enter (it stays hidden; Enter alone skips): ');
      if (!key) break;
    }
    if (!looksLikeClaudeKey(key)) {
      info('That is not a Claude API key (it starts with sk-ant- and is about 100 characters long).');
      key = '';
      continue;
    }
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    }).catch(() => null);
    if (response?.status === 401) {
      info('Claude rejected this key: it may be revoked or mistyped.');
      key = '';
      continue;
    }
    if (!response?.ok) info('Could not check the key right now; saving it anyway.');
    return key;
  }
  info('Skipped: the app works, but AI research stays off until you run this again with a key.');
  return null;
}

function saveSecret(ref, key) {
  // Passed through a private temporary file so the key never appears in a command line.
  const dir = mkdtempSync(join(tmpdir(), 'universe-'));
  const file = join(dir, 'secrets.env');
  try {
    writeFileSync(file, `ANTHROPIC_API_KEY=${key}\n`, { mode: 0o600 });
    if (!supabase(['secrets', 'set', '--env-file', file, '--project-ref', ref]).ok) fail('Could not save the Claude key in Supabase.');
    info('Key saved as a function secret.');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function deployFunctions(ref) {
  step(5, 'Server functions');
  const names = readdirSync(join(root, 'supabase', 'functions'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name);
  const failed = names.filter((name) => !supabase(['functions', 'deploy', name, '--use-api', '--project-ref', ref]).ok);
  if (failed.length) fail(`Deploy failed for: ${failed.join(', ')}. Run this again to retry.`);
  info(`Deployed: ${names.join(', ')}.`);
}

function writeAppConfig(ref) {
  step(6, 'App configuration (.env.local)');
  const url = `https://${ref}.supabase.co`;
  const key = publicKey(supabaseList(['projects', 'api-keys', '--project-ref', ref]));
  if (!key) fail('Could not read the project API key. Copy it by hand from Project Settings → API into .env.local.');
  const target = join(root, '.env.local');
  const current = existsSync(target) ? readFileSync(target, 'utf8') : readFileSync(join(root, '.env.example'), 'utf8');
  writeFileSync(target, withEnv(current, { EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: key }));
  info(`Written: ${url} and its public key.`);
  return { url, key };
}

async function verify({ url, key }) {
  step(7, 'Check');
  const universities = await fetch(`${url}/rest/v1/universities?select=id&limit=1`, {
    headers: { apikey: key, Prefer: 'count=exact' },
  }).catch(() => null);
  const count = rowCount(universities?.headers.get('content-range'));
  info(count ? `Catalogue: ${count.toLocaleString('en')} universities.` : 'Catalogue: could not count the universities yet.');
  const guest = await fetch(`${url}/functions/v1/research`, { method: 'POST', headers: { apikey: key } }).catch(() => null);
  info(guest?.status === 401 ? 'AI research refuses guests, as it should.' : `AI research answered ${guest?.status ?? 'nothing'} to a guest (expected 401).`);
}

// -------------------------------------------------------------------- main

console.log('UNIverse backend setup');
await signIn();
const { ref, password } = await chooseProject();
await loadDatabase(ref, password);
const key = await claudeKey();
if (key) saveSecret(ref, key);
deployFunctions(ref);
const app = writeAppConfig(ref);
await verify(app);

console.log(`
✓ Backend connected: https://supabase.com/dashboard/project/${ref}

Two settings to finish in the dashboard (1 minute), so sign-in emails carry a 6-digit code:
  • https://supabase.com/dashboard/project/${ref}/auth/templates
    add {{ .Token }} to the "Magic Link" and "Confirm signup" templates
  • https://supabase.com/dashboard/project/${ref}/auth/providers → Email → Email OTP Length: 6

Then start the app with:  npx expo start
AI research runs 1–3 minutes: the Free plan stops functions after 150 seconds, so production needs the Pro plan.`);
