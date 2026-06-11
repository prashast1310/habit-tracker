#!/bin/bash
# AuraHabit App Launcher for Nihu

# Move to the directory where this script is located
cd "$(dirname "$0")"

echo "============================================="
echo "   🌅 AuraHabit - Nihu's Daily Rituals 🌌     "
echo "============================================="
echo "Starting local app server..."

# Check if something is running on port 8088 and clear it
PID=$(lsof -t -i:8088)
if [ ! -z "$PID" ]; then
  kill -9 $PID >/dev/null 2>&1
fi

# Run Python web server in the background
python3 -m http.server 8088 > /dev/null 2>&1 &
SERVER_PID=$!

# Wait for server initialization
sleep 1

# Open in default web browser
open "http://localhost:8088"

echo ""
echo "🚀 AuraHabit is now open in your browser!"
echo "---------------------------------------------"
echo "To close the server, close this Terminal window"
echo "or press [Control + C]."
echo "============================================="

# Block and keep server running
wait $SERVER_PID
