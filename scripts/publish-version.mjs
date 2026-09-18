/**
 * Publish the deployed version to Firestore /version/current.
 *
 * Called by the deploy workflow AFTER the CloudFront invalidation:
 *   node scripts/publish-version.mjs 1.0.20
 *
 * The kiosk (src/hooks/useVersionReload.js) subscribes to that doc and
 * reloads when its value is NEWER than the build-time __APP_VERSION__ —
 * the replacement for the old service-worker poller (public/sw.js,
 * removed). Auth: dedicated service account via the Admin SDK, key in
 * the FIREBASE_DEPLOY_SA_KEY repo secret; Admin bypasses Firestore rules
 * (the /version match block keeps public writes out, reads open).
 */
import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`usage: node scripts/publish-version.mjs X.Y.Z (got: ${version})`);
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const app = getApps()[0]
  ?? initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore(app);

// Write both the string clients compare and the instant it was deployed
// (debugging "when did the kiosk last pick up a deploy?").
await db.doc('version/current').set({
  version,
  deployedAt: new Date().toISOString(),
});
console.log(`published version ${version} to Firestore /version/current`);