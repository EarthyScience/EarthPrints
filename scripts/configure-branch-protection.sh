#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-EarthyScience/EarthPrints}"
CHECK_NAME="${2:-Lint and build}"

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run: gh auth login"
  exit 1
fi

echo "Configuring branch protection for ${REPO} (default branch)."
echo "Required status check: ${CHECK_NAME}"
echo

existing_ruleset_id="$(gh api "repos/${REPO}/rulesets" --jq ".[] | select(.name == \"Protect main\") | .id" 2>/dev/null || true)"

payload="$(cat <<EOF
{
  "name": "Protect main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["~DEFAULT_BRANCH"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "deletion"
    },
    {
      "type": "non_fast_forward"
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          {
            "context": "${CHECK_NAME}"
          }
        ]
      }
    }
  ]
}
EOF
)"

if [[ -n "${existing_ruleset_id}" ]]; then
  gh api "repos/${REPO}/rulesets/${existing_ruleset_id}" --method PUT --input - <<< "${payload}"
  echo "Updated existing ruleset (id: ${existing_ruleset_id})."
else
  gh api "repos/${REPO}/rulesets" --method POST --input - <<< "${payload}"
  echo "Created branch protection ruleset."
fi

echo
echo "Done. Merges to the default branch now require:"
echo "  - an open pull request"
echo "  - passing status check: ${CHECK_NAME}"
echo
echo "If the check name differs after the first CI run, rerun with:"
echo "  ./scripts/configure-branch-protection.sh ${REPO} \"<exact check name>\""
