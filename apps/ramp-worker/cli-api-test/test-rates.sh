#!/bin/bash

BASE_URL="http://localhost:8787"

echo "Testing Rates API..."
echo "----------------------------------------"

# Paycrest Tests
echo "1. Paycrest - USDT to NGN (Base)"
curl -s "$BASE_URL/rates?token=USDT&amount=100&currency=NGN&network=base&provider=paycrest" | jq .
echo -e "\n"

echo "2. Paycrest - USDT to KES (Base)"
curl -s "$BASE_URL/rates?token=USDT&amount=100&currency=KES&network=base&provider=paycrest" | jq .
echo -e "\n"

echo "3. Paycrest - USDT to GHS (Base)"
curl -s "$BASE_URL/rates?token=USDT&amount=100&currency=GHS&network=base&provider=paycrest" | jq .
echo -e "\n"

# Dexpay Tests
echo "4. Dexpay - USDT to NGN (Base)"
curl -s "$BASE_URL/rates?token=USDT&amount=100&currency=NGN&network=base&provider=dexpay" | jq .
echo -e "\n"

echo "5. Dexpay - USDT to USD (Base)"
curl -s "$BASE_URL/rates?token=USDT&amount=100&currency=USD&network=base&provider=dexpay" | jq .
echo -e "\n"

echo "----------------------------------------"
echo "Done."
