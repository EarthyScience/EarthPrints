#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v vercel >/dev/null 2>&1; then
  echo "Installing Vercel CLI..."
  npm install --global vercel@latest
fi

echo "Log in to Vercel and link this project."
echo "When prompted, create or select the EarthPrints project."
vercel link

PROJECT_FILE="$ROOT_DIR/.vercel/project.json"
if [[ ! -f "$PROJECT_FILE" ]]; then
  echo "Expected $PROJECT_FILE after vercel link."
  exit 1
fi

ORG_ID="$(node -pe "JSON.parse(require('fs').readFileSync('$PROJECT_FILE','utf8')).orgId")"
PROJECT_ID="$(node -pe "JSON.parse(require('fs').readFileSync('$PROJECT_FILE','utf8')).projectId")"

echo
echo "Add these GitHub repository secrets for EarthyScience/EarthPrints:"
echo
echo "  VERCEL_ORG_ID=$ORG_ID"
echo "  VERCEL_PROJECT_ID=$PROJECT_ID"
echo "  VERCEL_TOKEN=<create at https://vercel.com/account/tokens>"
echo
echo "GitHub: Settings -> Secrets and variables -> Actions -> New repository secret"
echo
echo "After secrets are set, merge to main to trigger production deployment."
echo "Disable Vercel Git auto-deploy if you connected the repo in the Vercel dashboard:"
echo "Project -> Settings -> Git -> set Production Branch behavior or disconnect Git."
echo
echo "Then protect main with:"
echo "  ./scripts/configure-branch-protection.sh"
