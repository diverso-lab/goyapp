#!/usr/bin/env bash
# Smoke test: hit key endpoints, verify login + project lifecycle.
# Exits non-zero on failure. Requires: curl, jq.
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
EMAIL="${EMAIL:-demo@goyapp.local}"
PASSWORD="${PASSWORD:-demo1234}"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; exit 1; }

echo "→ Probing public endpoints"
http=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/login");   [ "$http" = "200" ] && pass "GET /login $http" || fail "GET /login $http"
http=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/");        [ "$http" = "200" ] && pass "GET / $http" || fail "GET / $http"

echo "→ Authenticating"
csrf=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/auth/csrf" | jq -r .csrfToken)
[ -n "$csrf" ] && pass "CSRF token acquired" || fail "no CSRF token"

curl -s -o /dev/null -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -H "content-type: application/x-www-form-urlencoded" \
  -d "csrfToken=$csrf&email=$EMAIL&password=$PASSWORD&callbackUrl=$BASE/dashboard&json=true" \
  "$BASE/api/auth/callback/credentials"

session=$(curl -s -b "$COOKIE_JAR" "$BASE/api/auth/session")
uid=$(echo "$session" | jq -r '.user.id // empty')
role=$(echo "$session" | jq -r '.user.role // empty')
[ -n "$uid" ] && pass "Session user id=$uid role=$role" || fail "login failed: $session"
[ "$role" = "ADMIN" ] && pass "Demo user is ADMIN" || fail "Demo user should be ADMIN, got: $role"

echo "→ Templates endpoint"
tlist=$(curl -s -b "$COOKIE_JAR" "$BASE/api/templates" | jq '.templates | length')
[ "$tlist" -ge 4 ] && pass "Templates listed: $tlist" || fail "Expected ≥4 templates, got: $tlist"

tid=$(curl -s -b "$COOKIE_JAR" "$BASE/api/templates" | jq -r '.templates[0].id')

echo "→ Project lifecycle"
proj=$(curl -s -b "$COOKIE_JAR" -H "content-type: application/json" \
  -d "{\"name\":\"Smoke test\",\"templateId\":\"$tid\"}" \
  "$BASE/api/projects")
pid=$(echo "$proj" | jq -r '.project.id // empty')
[ -n "$pid" ] && pass "Created project $pid" || fail "Create project failed: $proj"

got=$(curl -s -b "$COOKIE_JAR" "$BASE/api/projects/$pid" | jq -r '.project.id // empty')
[ "$got" = "$pid" ] && pass "GET project succeeds" || fail "GET project failed"

del=$(curl -s -b "$COOKIE_JAR" -X DELETE "$BASE/api/projects/$pid" | jq -r '.ok // empty')
[ "$del" = "true" ] && pass "Deleted project" || fail "Delete project failed"

echo "→ Admin users endpoint"
ulist=$(curl -s -b "$COOKIE_JAR" "$BASE/api/admin/users" | jq '.users | length')
[ "$ulist" -ge 1 ] && pass "Admin can list users ($ulist)" || fail "Admin list failed"

echo "→ PDF worker health"
health=$(curl -s "http://localhost:4000/health" | jq -r .ok)
[ "$health" = "true" ] && pass "pdf-worker healthy" || fail "pdf-worker unhealthy"

echo ""
echo "All smoke checks passed ✓"
