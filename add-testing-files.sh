#!/bin/bash

# Add the new testing files to the existing commit

echo "Adding new testing documentation files..."

git add LOCALHOST_TESTING_GUIDE.md
git add test-quiet-hours-api.html
git add run-quiet-hours-tests.sh
git add IMPLEMENTATION_COMPLETE.md

echo ""
echo "Checking what will be committed..."
git status

echo ""
echo "Amending the previous commit to include testing files..."
git commit --amend --no-edit

echo ""
echo "✅ Done! The testing files have been added to your commit."
echo ""
echo "Files added:"
echo "  - LOCALHOST_TESTING_GUIDE.md"
echo "  - test-quiet-hours-api.html"
echo "  - run-quiet-hours-tests.sh"
echo "  - IMPLEMENTATION_COMPLETE.md"
echo ""
echo "Next steps:"
echo "  1. Review: git show"
echo "  2. Push: git push -u origin feature/quiet-hours-notifications"
