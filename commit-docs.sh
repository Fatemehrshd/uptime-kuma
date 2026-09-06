#!/bin/bash

echo "Staging documentation and testing files..."

# Add the documentation files that were created after the first commit
git add LOCALHOST_TESTING_GUIDE.md
git add test-quiet-hours-api.html
git add run-quiet-hours-tests.sh
git add IMPLEMENTATION_COMPLETE.md
git add add-testing-files.sh
git add commit-docs.sh

# Add package-lock.json (likely from npm install)
git add package-lock.json

echo ""
echo "Files to be committed:"
git status --short

echo ""
echo "Creating commit..."
git commit -m "docs: add comprehensive testing guides and tools for Quiet Hours

- Add LOCALHOST_TESTING_GUIDE.md with step-by-step testing instructions
- Add test-quiet-hours-api.html - interactive HTML tool for API testing
- Add run-quiet-hours-tests.sh - automated test runner script
- Add IMPLEMENTATION_COMPLETE.md - implementation summary and next steps
- Update package-lock.json from dependency installation"

echo ""
echo "✅ Done! Documentation committed."
echo ""
echo "Commit log:"
git log --oneline -2

echo ""
echo "Next step: Push to remote"
echo "  git push -u origin feature/quiet-hours-notifications"
