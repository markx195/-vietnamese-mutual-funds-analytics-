#!/bin/bash
# Script to setup system cron for daily NAV crawl
# Run this once to enable daily crawling even when app is not running

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CRON_SCRIPT="$PROJECT_DIR/backend/scripts/daily-crawl.js"

# Create cron entry (runs daily at 9:00 AM)
CRON_JOB="0 9 * * * cd $PROJECT_DIR && node $CRON_SCRIPT >> $PROJECT_DIR/backend/logs/cron.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$CRON_SCRIPT"; then
    echo "Cron job already exists"
else
    # Add cron job
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✓ Cron job added: Daily crawl at 9:00 AM"
    echo "  View logs: tail -f $PROJECT_DIR/backend/logs/cron.log"
fi

# Show current cron jobs
echo ""
echo "Current cron jobs:"
crontab -l | grep -E "(daily-crawl|$CRON_SCRIPT)" || echo "  (none found)"

