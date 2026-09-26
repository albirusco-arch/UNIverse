// Helpers for scripts/setup-backend.mjs, kept free of I/O so they can be tested.

/** First JSON value in the CLI output (it may print notices around it), or null. */
export function parseCliJson(output) {
  const start = output.search(/[[{]/);
  if (start < 0) return null;
  const end = Math.max(output.lastIndexOf(']'), output.lastIndexOf('}'));
  try {
    return JSON.parse(output.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** The list in a CLI JSON answer: the value itself or its first array field. */
export function listFrom(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value).find(Array.isArray) ?? [];
  return [];
}

/** Project reference (the subdomain of the project URL). */
export const projectRef = (project) => project.ref ?? project.id;

/** The key the app ships with: the legacy anon key, or the publishable key on newer projects. */
export function publicKey(keys) {
  const list = listFrom(keys);
  const anon = list.find((key) => key.name === 'anon' && key.api_key);
  const publishable = list.find((key) => (key.type === 'publishable' || key.api_key?.startsWith('sb_publishable_')) && key.api_key);
  return (anon ?? publishable)?.api_key ?? null;
}

/** Sets `NAME=value` lines in a .env file's content, replacing existing ones and appending the rest. */
export function withEnv(content, values) {
  let result = content;
  for (const [name, value] of Object.entries(values)) {
    const line = `${name}=${value}`;
    const pattern = new RegExp(`^${name}=.*$`, 'm');
    result = pattern.test(result) ? result.replace(pattern, () => line) : `${result.replace(/\n*$/, '\n')}${line}\n`;
  }
  return result;
}

/** Claude API keys start with sk-ant- and have no spaces. */
export const looksLikeClaudeKey = (key) => /^sk-ant-[\w-]{20,}$/.test(key);

/** Total rows from a PostgREST Content-Range header ("0-0/10269"), or null. */
export function rowCount(contentRange) {
  const total = contentRange?.split('/')[1];
  return total && /^\d+$/.test(total) ? Number(total) : null;
}
