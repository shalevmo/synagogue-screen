#!/usr/bin/env bash
# Upload an image to the synagogue-screen site's static S3 folder WITHOUT
# committing it to the repository.
#
# How it works: the image is attached to a temporary GitHub draft release
# (never enters the repo tree), a workflow is dispatched which downloads it,
# uploads it to S3, invalidates CloudFront, and deletes the draft release.
#
# Usage:
#   scripts/upload-screen-image.sh <image-file> [s3-filename]
#
# Result: https://synagogue.moriamoyal.com/screen/<s3-filename>
set -euo pipefail

REPO="shalevmo/synagogue-screen"
WORKFLOW="upload-screen-image.yml"
BASE_URL="https://synagogue.moriamoyal.com"
FOLDER="screen"
TAG="screen-upload"

IMG="${1:-}"
if [[ -z "$IMG" || ! -f "$IMG" ]]; then
  echo "Usage: $0 <image-file> [s3-filename]" >&2
  exit 1
fi

NAME="${2:-$(basename "$IMG")}"
NAME=$(printf '%s' "$NAME" | tr -c 'A-Za-z0-9._-' '_')
NAME="${NAME%_}"
[[ -n "$NAME" ]] || { echo "Invalid filename" >&2; exit 1; }

echo "→ Cleaning up stale upload drafts…"
for id in $(gh api "repos/$REPO/releases" --paginate --jq '.[] | select(.draft and .tag_name == "screen-upload") | .id'); do
  gh api -X DELETE "repos/$REPO/releases/$id" >/dev/null || true
done
gh api -X DELETE "repos/$REPO/git/refs/tags/$TAG" >/dev/null 2>&1 || true

echo "→ Creating temporary draft release…"
RELEASE_ID=$(gh api -X POST "repos/$REPO/releases" \
  -f tag_name="$TAG" -f name="Screen image upload" -F draft=true --jq .id)

echo "→ Attaching $IMG as $NAME…"
# Asset uploads go to uploads.github.com (from the release's upload_url),
# not api.github.com — posting to the API path returns 404.
UPLOAD_URL=$(gh api "repos/$REPO/releases/$RELEASE_ID" --jq '.upload_url' | cut -d'{' -f1)
gh api --method POST "$UPLOAD_URL?name=$NAME" \
  -H "Content-Type: application/octet-stream" --input "$IMG" --jq .id >/dev/null

echo "→ Dispatching workflow…"
dispatched=""
for attempt in 1 2 3 4 5; do
  if gh workflow run "$WORKFLOW" -R "$REPO" \
    -f release_id="$RELEASE_ID" -f filename="$NAME" -f s3_folder="$FOLDER"; then
    dispatched="yes"
    break
  fi
  echo "  (workflow not triggerable yet, retry in 5s — attempt $attempt)"
  sleep 5
done
[[ -n "$dispatched" ]] || { echo "Could not dispatch workflow." >&2; exit 1; }

echo "→ Waiting for the workflow run…"
RUN_ID=""
for _ in $(seq 1 12); do
  RUN_ID=$(gh run list -R "$REPO" -w "$WORKFLOW" -L 5 --json databaseId,status \
    --jq '[.[] | select(.status=="queued" or .status=="in_progress")][0].databaseId // empty')
  [[ -n "$RUN_ID" ]] && break
  sleep 5
done
[[ -n "$RUN_ID" ]] || { echo "Could not find the workflow run." >&2; exit 1; }

if ! gh run watch "$RUN_ID" -R "$REPO" --exit-status --interval 5 >/dev/null 2>&1; then
  echo "✗ Workflow failed — see: https://github.com/$REPO/actions/runs/$RUN_ID" >&2
  exit 1
fi

URL="$BASE_URL/$FOLDER/$NAME"
echo "✓ Uploaded: $URL"
curl -fsSI --max-time 20 "$URL" | head -n 1 || echo "(URL not reachable yet — CloudFront invalidation may still be in progress)"