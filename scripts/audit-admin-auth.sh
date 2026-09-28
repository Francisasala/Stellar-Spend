#!/bin/bash

echo "🔍 Auditing admin authorization checks..."
echo "========================================"

# Find all admin functions across contracts
echo "📁 Finding admin functions..."
find contracts/ -name "*.rs" -exec grep -l "admin" {} \; | while read -r file; do
    echo ""
    echo "📄 $file"
    
    # Check if the file has authorization checks
    if grep -q "require_auth" "$file"; then
        echo "  ✅ Has require_auth checks"
    else
        echo "  ⚠️  No require_auth found - needs audit"
    fi
    
    # Check if the file has admin functions
    grep -n "admin" "$file" | head -5
done

echo ""
echo "========================================"
echo "🔍 Checking for unauthorized call patterns..."

# Look for admin functions that might be missing authorization
find contracts/ -name "*.rs" -exec grep -A 5 "fn.*admin" {} \; | grep -v "require_auth" | grep -v "tests" | head -20

echo ""
echo "✅ Audit complete!"
