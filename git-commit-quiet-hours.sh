#!/bin/bash

# Git commands to commit the Quiet Hours feature
# Run this script manually: chmod +x git-commit-quiet-hours.sh && ./git-commit-quiet-hours.sh

echo "Creating feature branch..."
git checkout -b feature/quiet-hours-notifications

echo ""
echo "Staging files..."
git add db/knex_migrations/2026-09-07-0000-quiet-hours.js
git add server/model/quiet-hours.js
git add server/model/monitor.js
git add server/socket-handlers/quiet-hours-socket-handler.js
git add server/server.js
git add src/components/QuietHours.vue
git add test/backend-test/test-quiet-hours.js
git add test/backend-test/test-quiet-hours-integration.js
git add validate-quiet-hours.js
git add QUIET_HOURS_FEATURE.md
git add git-commit-quiet-hours.sh

echo ""
echo "Checking status..."
git status

echo ""
echo "Creating commit..."
git commit -m "feat: add Quiet Hours feature for notification suppression

- Add database migration for quiet_hours table
- Implement QuietHours model with pure business logic
- Integrate quiet hours check into Monitor.sendNotification()
- Create socket handler for CRUD operations
- Add Vue component for managing quiet hours
- Automatic timezone detection using Intl API
- Support recurring daily windows with weekday selection
- Handle midnight-spanning time windows
- Add comprehensive tests (25+ test cases)
- Maintain backwards compatibility (fail-safe design)

The feature allows users to define time windows where Down/Recovery
notifications are suppressed. Monitor heartbeats and status changes
continue normally. Timezone is automatically detected from browser.

Closes #XXXX"

echo ""
echo "Done! Branch created and changes committed."
echo ""
echo "Next steps:"
echo "1. Review the changes: git show"
echo "2. Run tests: npm run test-backend"
echo "3. Push to remote: git push -u origin feature/quiet-hours-notifications"
echo "4. Create pull request on GitHub"
