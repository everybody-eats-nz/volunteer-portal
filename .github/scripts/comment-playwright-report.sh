#!/bin/bash

# Exit immediately if a command exits with a non-zero status.

set -e

# Arguments

COMMIT_SHA="$1"
DEPLOY_URL="$2"
REPO="$3" # GH_REPO environment variable is usually available, but passing explicitly is safer

# Check if required arguments are provided

if [[-z "$COMMIT_SHA" || -z "$DEPLOY_URL" || -z "$REPO"]]; then
echo "Usage: $0 <commit-sha> <deploy-url> <repo>"
echo "Error: Missing required arguments."
exit 1
fi

# Check if GITHUB_TOKEN is set

if [[-z "$GITHUB_TOKEN"]]; then
echo "Error: GITHUB_TOKEN environment variable is not set."
exit 1
fi

echo "Commit SHA: $COMMIT_SHA"
echo "Report URL: $DEPLOY_URL"
echo "Repository: $REPO"

# Check if a test PR number is provided via environment variable

if [[-n "$TEST_PR_NUMBER"]]; then
echo "Using TEST_PR_NUMBER: $TEST_PR_NUMBER"
  PR_NUMBER="$TEST_PR_NUMBER"
else

# Find the open PR associated with the commit if not testing

echo "Finding open PR for commit $COMMIT_SHA..."

# Use process substitution and readarray for safer handling of gh output

# Handles cases where no PR is found gracefully without erroring

readarray -t PR_NUMBERS < <(gh pr list --repo "$REPO" --state open --search "$COMMIT_SHA" --json number --jq '.[].number // ""' 2>/dev/null)

# Check if the array is non-empty

if [[${#PR_NUMBERS[@]} -gt 0]]; then
PR_NUMBER="${PR_NUMBERS[0]}" # Take the first PR found
else
PR_NUMBER="" # Ensure PR_NUMBER is empty if none found
fi
fi

# Proceed only if we have a PR number (either from test or found via commit)

if [[-n "$PR_NUMBER"]]; then
echo "Targeting PR #$PR_NUMBER."

# Define the marker separately using single quotes to prevent history expansion

COMMENT_MARKER="Playwright Test Report"

# Construct the comment body using command substitution with cat and a here document

COMMENT_BODY=$(cat <<EOF
📊 **Playwright Test Report**

A new [report](${DEPLOY_URL}) for [commit](https://github.com/${REPO}/commit/${COMMIT_SHA}) is available.
EOF
)

# Create a temporary file for the comment body

BODY_TEMP_FILE=$(mktemp)

# Ensure cleanup even on error using trap

trap 'rm -f "$BODY_TEMP_FILE"' EXIT

# Write the body to the temp file using printf for robustness

printf "%s" "$COMMENT_BODY" > "$BODY_TEMP_FILE"

# Check if a comment with the marker already exists

readarray -t EXISTING_COMMENT_IDS < <(gh pr view "$PR_NUMBER" --repo "$REPO" --json comments --jq '.comments[] | select(.body | contains("'$COMMENT_MARKER'")) | .id' 2>/dev/null || true)

if [[${#EXISTING_COMMENT_IDS[@]} -gt 0]]; then
EXISTING_COMMENT_ID="${EXISTING_COMMENT_IDS[0]}" # Take the first one if multiple found
    echo "Updating existing comment $EXISTING_COMMENT_ID on PR #$PR_NUMBER." # Read body from temp file
gh pr comment "$PR_NUMBER" --repo "$REPO" --edit "$EXISTING_COMMENT_ID" --body-file "$BODY_TEMP_FILE"
else
echo "Creating new comment on PR #$PR_NUMBER."
    # Read body from temp file
    gh pr comment "$PR_NUMBER" --repo "$REPO" --body-file "$BODY_TEMP_FILE"
fi
echo "Successfully added/updated comment on PR #$PR_NUMBER."

# Temp file is cleaned up automatically by the EXIT trap

else
echo "No open PR found for commit $COMMIT_SHA. Skipping comment."

# Optional: Add logic here to search merged PRs if desired

fi

exit 0
