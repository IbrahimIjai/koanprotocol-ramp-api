#!/bin/bash

BASE_URL="http://localhost:8787"

echo "Testing Currencies API..."
echo "----------------------------------------"

# Paycrest Tests
echo "1. Paycrest Supported Currencies"
curl -s "$BASE_URL/currencies?provider=paycrest" | jq .
echo -e "\n"

# Dexpay Tests
echo "2. Dexpay Supported Currencies"
curl -s "$BASE_URL/currencies?provider=dexpay" | jq .
echo -e "\n"

echo "----------------------------------------"
echo "Done."
