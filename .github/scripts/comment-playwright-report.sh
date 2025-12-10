#!/bin/bash
set -e

COMMIT_SHA="$1"
DEPLOY_URL="$2"
REPO="$3"

# Validate args
if [[ -z "$COMMIT_SHA" || -z "$DEPLOY_URL" || -z "$REPO" ]]; then
  echo "Usage: $0 <commit-sha> <deploy-url> <repo>"
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

# PR override
if [[ -n "$TEST_PR_NUMBER" ]]; then
  echo "Using TEST_PR_NUMBER: $TEST_PR_NUMBER"
  PR_NUMBER="$TEST_PR_NUMBER"
else
  echo "Finding open PR for commit $COMMIT_SHA..."

  PR_NUMBER=$(gh pr list \
    --repo "$REPO" \
    --state open \
    --search "$COMMIT_SHA" \
    --json number \
    --jq '.[0].number // empty' 2>/dev/null || true)
fi

if [[ -z "$PR_NUMBER" ]]; then
  echo "No open PR found for commit. Skipping."
  exit 0
fi

echo "Targeting PR #$PR_NUMBER"

COMMENT_BODY=$(cat <<EOF
# 📊 Playwright Test Report

### 🧪 Test Run for [\`${COMMIT_SHA:0:7}\`](https://github.com/${REPO}/commit/${COMMIT_SHA})

📄 **View detailed report:**  
👉 <${DEPLOY_URL}>

---
EOF
)

BODY_TEMP_FILE=$(mktemp)
trap 'rm -f "$BODY_TEMP_FILE"' EXIT
printf "%s" "$COMMENT_BODY" > "$BODY_TEMP_FILE"

echo "Updating last comment if exists (or creating new one)..."

# Try editing last comment
if gh pr comment "$PR_NUMBER" \
    --repo "$REPO" \
    --edit-last \
    --body-file "$BODY_TEMP_FILE" 2>/dev/null; then
  echo "Updated last comment."
else
  echo "No previous comment found. Creating new one..."
  gh pr comment "$PR_NUMBER" \
    --repo "$REPO" \
    --body-file "$BODY_TEMP_FILE"
fi

echo "Done — comment posted to PR #$PR_NUMBER."
exit 0
