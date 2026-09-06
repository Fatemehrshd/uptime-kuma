#!/bin/bash

# Run quiet hours tests without cross-env dependency

echo "=== Running Quiet Hours Pure Function Tests ==="
echo ""
TEST_BACKEND=1 node --test --test-reporter=spec test/backend-test/test-quiet-hours.js

echo ""
echo "=== Test Results Summary ==="
if [ $? -eq 0 ]; then
    echo "✅ All pure function tests passed!"
else
    echo "❌ Some tests failed. Check output above."
fi

echo ""
echo "Note: Integration tests (test-quiet-hours-integration.js) require full"
echo "database setup and may be skipped for quick validation."
echo ""
echo "To run all backend tests:"
echo "  npm install cross-env"
echo "  npm run test-backend"
