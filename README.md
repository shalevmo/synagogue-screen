# Synagogue Screen

Digital display screen for synagogue information: zmanim (Jewish prayer times), Hebrew calendar, weekly parsha, prayer schedule, and holiday images.

Built with **React + Vite** and deployed to **AWS S3 + CloudFront** via GitHub Actions.
Live data (prayer times, images, config) is loaded from **Firebase Firestore**.

## Live site

https://synagogue.moriamoyal.com/

## Development

```bash
cd /root/synagogue-screen
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## Firebase setup

The app expects a Firebase project with Firestore enabled.

1. Create a Firebase web app and copy its config into the GitHub repository secrets listed below.
2. Enable **Cloud Firestore** in the Firebase Console.
3. Deploy the security rules from `firestore.rules`:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules
   ```

   Or paste the contents of `firestore.rules` into
   Firebase Console → Firestore Database → Rules.

4. (Optional) Upload holiday images to Firebase Storage and create `/images` documents in Firestore with:
   - `name`, `imageUrl`
   - `startDay`, `startMonth`, `endDay`, `endMonth`
   - `year` (or `null` for recurring every year)

## Firestore schema

- `/config/app-config` — `title`, `location`, `defaultViewDuration`, `imageDisplayDuration`
- `/prayers/{id}` — `order`, `name`, `time`
- `/images/{id}` — `name`, `imageUrl`, `startDay`, `startMonth`, `endDay`, `endMonth`, `year`
- `/version/current` — `version`, `deployedAt` — written by the deploy workflow; kiosk clients watch it and reload when newer than the build-time version (see `src/hooks/useVersionReload.js`)

## Deployment

The workflow in `.github/workflows/deploy.yml` deploys on every green Tests run for `master`:

1. Bump `package.json` to the next semver patch (tag-derived), build with it baked in (shown under the clock).
2. Sync `dist/` to S3 + invalidate CloudFront.
3. Write the version to Firestore `/version/current` — running kiosks detect it and reload themselves.
4. Tag a GitHub release and commit the version bump back to `master` (`[skip ci]`).

Required repository secrets (Settings → Secrets and variables → Actions):

| Secret | Description |
|--------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `AWS_ACCESS_KEY_ID` | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key |
| `AWS_REGION` | AWS region, e.g. `eu-central-1` |
| `S3_BUCKET` | S3 bucket name |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution ID |
| `FIREBASE_DEPLOY_SA_KEY` | JSON key of the `github-deploy-version` service account (Firestore write for `/version/current`) |
| `FIREBASE_ADMIN_SA_KEY` | JSON key of the `github-firestore-crud` service account (role *Cloud Datastore User*) — used by the **Firestore CRUD** workflow |

## Editing Firestore from GitHub

The **Firestore CRUD** workflow (`.github/workflows/firestore-crud.yml`, Actions → Firestore CRUD → Run workflow) reads and writes the kiosk's data without the Firebase Console:

| Operation | Path | Data |
|-----------|------|------|
| `list` | `images` | — |
| `get` | `images/sukkot-5787` | — |
| `add` | `prayers` (auto id) | JSON object |
| `set` | `images/sukkot-5787` (create / replace) | JSON object |
| `update` | `config/app-config` (merge) | JSON object |
| `delete` | `images/sukkot-5787` | — |

Only `config`, `prayers`, `images` and `version` are reachable. JSON numbers stay numbers (the kiosk compares `year` strictly). Every write logs the document's previous state in the run summary, so a mistake can be undone with a `set` of the old data.

## AWS IAM policy

The deployer IAM user needs at minimum:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR_BUCKET",
        "arn:aws:s3:::YOUR_BUCKET/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "arn:aws:cloudfront::*:distribution/YOUR_DISTRIBUTION_ID"
    }
  ]
}
```

## Notes

- The app is designed for a fixed 1920×1080 screen.
- Click anywhere to toggle fullscreen.
- The default fallback prayers and Netivot location are used when Firestore is unavailable.
