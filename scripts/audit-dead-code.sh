#!/bin/bash

echo "🔍 Auditing for dead code..."
echo "========================================"

# Check for dead_code warnings
echo "📋 Checking for dead_code warnings..."
cargo build --workspace 2>&1 | grep -E "dead_code|unused" | tee /tmp/dead_code.log

if [ -s /tmp/dead_code.log ]; then
    echo ""
    echo "⚠️  Found potential dead code:"
    cat /tmp/dead_code.log
else
    echo "✅ No dead_code warnings found!"
fi

# Count lines of code in dispute module
echo ""
echo "📊 Dispute module statistics:"
find contracts/escrow/src -name "*.rs" -exec wc -l {} \; | sort -n

echo ""
echo "========================================"
echo "✅ Audit complete!"
