/**
 * Firestore CRUD — driven by the "Firestore CRUD" workflow
 * (.github/workflows/firestore-crud.yml), usable locally too:
 *
 *   FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" \
 *     node scripts/firestore-crud.mjs <op> <path> [json-data]
 *
 *   list    <collection>              all docs (id + data)
 *   get     <collection>/<id>         one doc
 *   add     <collection>   '{…}'      new doc, auto id
 *   set     <collection>/<id> '{…}'   create / fully replace
 *   update  <collection>/<id> '{…}'   merge fields into an existing doc
 *   delete  <collection>/<id>         remove
 *
 * JSON types are kept as-is: numbers stay numbers, which matters — the
 * kiosk compares /images `year` strictly (5787 !== "5787").
 *
 * Every write logs the document's state BEFORE the change, so any
 * mistake can be undone from the run log with a `set` of the old data.
 *
 * Auth: dedicated service account (FIREBASE_ADMIN_SA_KEY repo secret) via
 * the Admin SDK, which bypasses firestore.rules. Only the collections the
 * app actually uses are reachable (ALLOWED_COLLECTIONS).
 */
import { appendFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const ALLOWED_COLLECTIONS = ['config', 'prayers', 'images', 'version'];
const OPS = {
  list:   { target: 'collection', data: false },
  get:    { target: 'doc',        data: false },
  add:    { target: 'collection', data: true  },
  set:    { target: 'doc',        data: true  },
  update: { target: 'doc',        data: true  },
  delete: { target: 'doc',        data: false },
};

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

// ── Validate args ──
const [op, rawPath, rawData] = process.argv.slice(2);
const spec = OPS[op];
if (!spec) fail(`unknown op '${op}' (expected: ${Object.keys(OPS).join(', ')})`);

const path = (rawPath ?? '').trim().replace(/^\/+|\/+$/g, '');
const segments = path.split('/');
if (!path || !segments.every(s => /^[A-Za-z0-9_.-]+$/.test(s) && s !== '.' && s !== '..')) {
  fail(`invalid path '${rawPath}'`);
}
if (!ALLOWED_COLLECTIONS.includes(segments[0])) {
  fail(`collection '${segments[0]}' not allowed (allowed: ${ALLOWED_COLLECTIONS.join(', ')})`);
}
const isDocPath = segments.length % 2 === 0;
if (spec.target === 'doc' && !isDocPath) fail(`'${op}' needs a document path (collection/id), got '${path}'`);
if (spec.target === 'collection' && isDocPath) fail(`'${op}' needs a collection path, got '${path}'`);

let data;
if (spec.data) {
  try {
    data = JSON.parse(rawData ?? '');
  } catch (e) {
    fail(`data is not valid JSON: ${e.message}`);
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) fail('data must be a JSON object');
} else if (rawData && rawData.trim()) {
  fail(`'${op}' takes no data`);
}

// ── Firestore ──
if (!process.env.FIREBASE_SERVICE_ACCOUNT) fail('FIREBASE_SERVICE_ACCOUNT is not set');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const app = getApps()[0]
  ?? initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore(app);

/** Timestamps → ISO strings so results print as plain JSON */
const plain = (v) => JSON.parse(JSON.stringify(v, (_k, x) =>
  x instanceof Timestamp ? x.toDate().toISOString() : x));

const snapOf = (snap) => (snap.exists ? { id: snap.id, ...plain(snap.data()) } : null);

let before;
let result;
switch (op) {
  case 'list': {
    const snap = await db.collection(path).get();
    result = snap.docs.map(snapOf);
    break;
  }
  case 'get': {
    result = snapOf(await db.doc(path).get());
    if (!result) fail(`document '${path}' does not exist`);
    break;
  }
  case 'add': {
    const ref = await db.collection(path).add(data);
    result = snapOf(await ref.get());
    break;
  }
  case 'set': {
    before = snapOf(await db.doc(path).get());
    await db.doc(path).set(data);
    result = snapOf(await db.doc(path).get());
    break;
  }
  case 'update': {
    before = snapOf(await db.doc(path).get());
    if (!before) fail(`document '${path}' does not exist (use 'set' to create it)`);
    await db.doc(path).update(data);
    result = snapOf(await db.doc(path).get());
    break;
  }
  case 'delete': {
    before = snapOf(await db.doc(path).get());
    if (!before) fail(`document '${path}' does not exist`);
    await db.doc(path).delete();
    result = null;
    break;
  }
}

// ── Report ──
const fmt = (v) => JSON.stringify(v, null, 2);
if (before !== undefined) console.log(`before:\n${fmt(before)}`);
console.log(`${op} ${path}${op === 'delete' ? ' → deleted' : `:\n${fmt(result)}`}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  let md = `## Firestore \`${op}\` \`${path}\`\n\n`;
  if (before !== undefined) md += `**Before**\n\n\`\`\`json\n${fmt(before)}\n\`\`\`\n\n`;
  md += op === 'delete' ? '**Deleted.**\n\n' : `**Result**\n\n\`\`\`json\n${fmt(result)}\n\`\`\`\n\n`;
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}
