import crypto from 'crypto';

type Serializable = Record<string, unknown> | unknown[] | string | number | boolean | null;

function canonicalize(value: Serializable): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalize(item as Serializable));
    return `[${items.join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, Serializable>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${JSON.stringify(key)}:${canonicalize(val as Serializable)}`);

  return `{${entries.join(',')}}`;
}

export function computeEtag(value: Serializable): string {
  const canonical = canonicalize(value);
  const hash = crypto.createHash('sha256').update(canonical).digest('hex');
  return `"${hash}"`;
}
