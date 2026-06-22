#!/bin/bash
set -e

REPO_DIR="/Users/jjgardner3/Library/CloudStorage/GoogleDrive-jjgardner3@gmail.com/My Drive/UAW 2026/UAW 2026/gallery-matcher"

cd "$REPO_DIR"

# Clean up any stale git lock files (Google Drive sync can leave these)
find .git -name "*.lock" -delete 2>/dev/null || true

# Rename branch to main
git branch -m main 2>/dev/null || git checkout -b main 2>/dev/null || true

echo "✓ Branch set to main"
echo ""

# Check for gh CLI
if ! command -v gh &>/dev/null; then
  echo "The GitHub CLI (gh) isn't installed."
  echo "Install it with: brew install gh"
  echo "Then run this script again."
  exit 1
fi

# Check if already authenticated
if ! gh auth status &>/dev/null; then
  echo "Logging in to GitHub..."
  gh auth login
fi

# Create the repo and push
gh repo create uaw-2026-gallery-matcher \
  --public \
  --source=. \
  --remote=origin \
  --push \
  --description "UAW 2026 Gallery Matcher"

echo ""
echo "✓ All done! Repo is live on GitHub."
echo "  Next: go to netlify.com → Add new site → Import from Git → pick uaw-2026-gallery-matcher"
