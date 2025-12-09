#!/bin/bash
set -e

COMMIT_SHA="$1"
DEPLOY_URL="$2"
REPO="$3"

SUMMARY_FILE="web/playwright-report/summary.json"

# Validate args
if [[ -z "$COMMIT_SHA" || -z "$DEPLOY_URL" || -z "$REPO" ]]; then
  echo "Usage: $0 <commit-sha> <deploy-url> <repo>"
  echo "Error: Missing required arguments."
  exit 1
fi

# Validate token
if [[ -z "$GITHUB_TOKEN" ]]; then
  echo "Error: GITHUB_TOKEN is not set."
  exit 1
fi

echo "Commit SHA: $COMMIT_SHA"
echo "Report URL: $DEPLOY_URL"
echo "Repository: $REPO"

# Load summary if exists
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

COMMENT_MARKER="Playwright Test Report"

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

BODY_TEMP_FILE=$(mktemp)
trap 'rm -f "$BODY_TEMP_FILE"' EXIT

printf "%s" "$COMMENT_BODY" > "$BODY_TEMP_FILE"

# Find existing comment
readarray -t EXISTING_COMMENT_IDS < <(
  gh pr view "$PR_NUMBER" --repo "$REPO" --json comments --jq '.comments[] | select(.body | contains("'"$COMMENT_MARKER"'")) | .id' 2>/dev/null || true
)

if [[ ${#EXISTING_COMMENT_IDS[@]} -gt 0 ]]; then
  EXISTING_COMMENT_ID="${EXISTING_COMMENT_IDS[0]}"
  echo "Updating existing comment $EXISTING_COMMENT_ID"
  gh pr comment "$PR_NUMBER" --repo "$REPO" --edit "$EXISTING_COMMENT_ID" --body-file "$BODY_TEMP_FILE"
else
  echo "Creating new comment"
  gh pr comment "$PR_NUMBER" --repo "$REPO" --body-file "$BODY_TEMP_FILE"
fi

echo "Successfully added/updated comment on PR #$PR_NUMBER."
exit 0
