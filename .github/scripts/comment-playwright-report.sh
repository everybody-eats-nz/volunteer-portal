#!/bin/bash
set -e

# Arguments
COMMIT_SHA="$1"
DEPLOY_URL="$2"
REPO="$3"

SUMMARY_FILE="web/playwright-report/summary.json"

# Validate arguments
if [[ -z "$COMMIT_SHA" || -z "$DEPLOY_URL" || -z "$REPO" ]]; then
  echo "Usage: $0 <commit-sha> <deploy-url> <repo>"
  echo "Error: Missing required arguments."
  exit 1
fi

# Validate GITHUB_TOKEN
if [[ -z "$GITHUB_TOKEN" ]]; then
  echo "Error: GITHUB_TOKEN is not set."
  exit 1
fi

echo "Commit SHA: $COMMIT_SHA"
echo "Report URL: $DEPLOY_URL"
echo "Repository: $REPO"

# Load summary if it exists
if [[ -f "$SUMMARY_FILE" ]]; then
  PASSED=$(jq .passed "$SUMMARY_FILE")
  FAILED=$(jq .failed "$SUMMARY_FILE")
  SKIPPED=$(jq .skipped "$SUMMARY_FILE")
else
  PASSED=0
  FAILED=0
  SKIPPED=0
fi

# Determine PR number
if [[ -n "$TEST_PR_NUMBER" ]]; then
  PR_NUMBER="$TEST_PR_NUMBER"
else
  echo "Finding open PR for commit $COMMIT_SHA..."
  readarray -t PR_NUMBERS < <(
    gh pr list --repo "$REPO" --state open --search "$COMMIT_SHA" --json number --jq '.[].number // ""' 2>/dev/null
  )

  if [[ ${#PR_NUMBERS[@]} -gt 0 ]]; then
    PR_NUMBER="${PR_NUMBERS[0]}"
  else
    PR_NUMBER=""
  fi
fi

if [[ -z "$PR_NUMBER" ]]; then
  echo "No open PR found for commit $COMMIT_SHA. Skipping comment."
  exit 0
fi

echo "Targeting PR #$PR_NUMBER"

# Construct PR comment
COMMENT_BODY=$(cat <<EOF
# 📊 Playwright Test Report

### 🧪 Test Run for [\`${COMMIT_SHA:0:7}\`](https://github.com/${REPO}/commit/${COMMIT_SHA})

**Test Summary:**
- ✅ Passed: $PASSED
- ❌ Failed: $FAILED
- ⚠️ Skipped: $SKIPPED

📄 **View detailed report:**  
👉 <${DEPLOY_URL}>

---
EOF
)

# Write comment to temp file
BODY_TEMP_FILE=$(mktemp)
trap 'rm -f "$BODY_TEMP_FILE"' EXIT
printf "%s" "$COMMENT_BODY" > "$BODY_TEMP_FILE"

# Post comment safely
# --edit-last edits your last comment made by this workflow
# --create-if-none creates a new comment if none exists
gh pr comment "$PR_NUMBER" --repo "$REPO" --edit-last --body-file "$BODY_TEMP_FILE" --create-if-none

echo "Successfully added/updated comment on PR #$PR_NUMBER."
exit 0
