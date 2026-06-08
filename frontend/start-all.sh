#!/bin/bash
# CPTrack — Start both frontend apps

NVM_NODE="$HOME/.nvm/versions/node/v24.13.0/bin"
export PATH="$NVM_NODE:$PATH"

ROOT="$(dirname "$0")"

echo "🚀 Starting CPTrack Student Portal on http://localhost:5173"
(cd "$ROOT/student" && npm run dev) &
STUDENT_PID=$!

echo "🛡️  Starting CPTrack Admin Dashboard on http://localhost:5174"
(cd "$ROOT/admin" && npm run dev) &
ADMIN_PID=$!

echo ""
echo "Student Portal: http://localhost:5173"
echo "Admin Dashboard: http://localhost:5174"
echo ""
echo "Press Ctrl+C to stop both apps"

trap "kill $STUDENT_PID $ADMIN_PID 2>/dev/null; echo 'Stopped.'" INT
wait
