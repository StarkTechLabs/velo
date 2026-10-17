#!/usr/bin/env bash
# Packs the three publishable packages and tests them the way a user gets them: install the
# tarballs into an empty prefix, then drive the installed commands. Catches what the monorepo hides:
# a missing dependency, a file left out of (or leaked into) the tarball, a bin that doesn't start.
#
#   scripts/smoke-pack.sh            # builds first
#   SKIP_BUILD=1 scripts/smoke-pack.sh
#
# Needs network access (npm installs the packages' dependencies, including better-sqlite3).
# Everything runs in a temp directory with its own VELO_HOME and free ports; your real ~/.velo,
# login items and default ports are never touched.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
pass=0
bin=""

cleanup() {
  if [ -n "$bin" ]; then "$bin/velo" stop >/dev/null 2>&1 || true; fi
  rm -rf "$work"
}
trap cleanup EXIT

ok() { pass=$((pass + 1)); printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1" >&2; [ -n "${2:-}" ] && printf '%s\n' "$2" | sed 's/^/       /' >&2; exit 1; }
# check "description" "expected substring" command...
check() {
  local what="$1" want="$2"; shift 2
  local out
  out="$("$@" 2>&1)" || fail "$what (command failed)" "$out"
  case "$out" in *"$want"*) ok "$what" ;; *) fail "$what (wanted: $want)" "$out" ;; esac
}
free_port() { node -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }

if [ -z "${SKIP_BUILD:-}" ]; then
  echo "== build"
  (cd "$repo" && npm run build >/dev/null)
fi

echo "== pack"
mkdir -p "$work/tarballs"
(cd "$repo" && npm pack -w @starktech/velo -w @starktech/velo-api -w @starktech/velo-dashboard --silent \
  --pack-destination "$work/tarballs" >/dev/null)
version="$(node -p "require('$repo/packages/cli/package.json').version")"

for pkg in velo velo-api velo-dashboard; do
  tgz="$work/tarballs/starktech-$pkg-$version.tgz"
  [ -f "$tgz" ] || fail "tarball for $pkg exists" "$(ls "$work/tarballs")"
  listing="$(tar -tzf "$tgz")"
  echo "$listing" | grep -q '^package/dist/main.js$' || fail "$pkg ships dist/main.js"
  echo "$listing" | grep -q '^package/LICENSE$' || fail "$pkg ships LICENSE"
  echo "$listing" | grep -q '^package/README.md$' || fail "$pkg ships README.md"
  if echo "$listing" | grep -E '\.map$|/lib/|\.spec\.|esbuild\.config|tsconfig|jest\.config|vite\.config|/server/|/src/' >/dev/null; then
    fail "$pkg ships only built files" "$(echo "$listing" | grep -E '\.map$|/lib/|\.spec\.|esbuild\.config|tsconfig|jest\.config|vite\.config|/server/|/src/')"
  fi
  # the manifest users install from must not depend on anything unpublished
  tar -xzOf "$tgz" package/package.json | node -e '
    const p = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const all = { ...p.dependencies, ...p.optionalDependencies, ...p.peerDependencies };
    const bad = Object.keys(all).filter((d) => d === "@starktech/core" || all[d].startsWith("file:") || all[d] === "*");
    if (bad.length) { console.error("unpublishable dependencies: " + bad); process.exit(1) }
  ' || fail "$pkg depends only on published packages"
  ok "$pkg tarball: built files only, LICENSE + README, publishable dependencies"
done

echo "== install (as a user would: npm install -g)"
prefix="$work/prefix"
npm install -g --prefix "$prefix" --no-audit --no-fund \
  "$work/tarballs/starktech-velo-$version.tgz" \
  "$work/tarballs/starktech-velo-api-$version.tgz" \
  "$work/tarballs/starktech-velo-dashboard-$version.tgz" >"$work/install.log" 2>&1 \
  || fail "npm install -g of the three tarballs" "$(tail -20 "$work/install.log")"
bin="$prefix/bin"
ok "installed into an empty prefix"

export VELO_HOME="$work/home"
api_port="$(free_port)"; dash_port="$(free_port)"

echo "== cli"
check "velo --version" "$version" "$bin/velo" --version
check "velo init" "initialized" "$bin/velo" init
check "velo configure (own ports)" "$api_port" "$bin/velo" configure --api-port "$api_port" --dashboard-port "$dash_port"
check "velo log" "smoke test" "$bin/velo" log smoke 45m "smoke test"
check "velo list" "smoke" "$bin/velo" list
check "velo export csv header" "date,project,description,hours" "$bin/velo" export
check "velo stats today" "smoke" "$bin/velo" stats today
if [ -d "$prefix/lib/node_modules/@starktech/velo/node_modules/pg" ]; then ok "optional pg is installed (for velo import postgres)"; fi

echo "== api + dashboard, found next to the cli"
check "velo start" "Dashboard started" "$bin/velo" start
check "velo status" "running" "$bin/velo" status
check "api /api/health" '"name":"velo-api"' curl -fsS "http://127.0.0.1:$api_port/api/health"
check "api reports this data directory" "$VELO_HOME" curl -fsS "http://127.0.0.1:$api_port/api/health"
check "dashboard /config.json" '"name":"velo-dashboard"' curl -fsS "http://127.0.0.1:$dash_port/config.json"
check "dashboard serves the app" "<title>velo</title>" curl -fsS "http://127.0.0.1:$dash_port/"
check "api create (what the dashboard does)" '"minutes":30' curl -fsS "http://127.0.0.1:$api_port/api/events" \
  -H 'Content-Type: application/json' -d '{"project":"smoke","timeframe":"30m","description":"via api"}'
check "cli sees the api's event (shared database)" "via api" "$bin/velo" list
check "api CSV export" "smoke" curl -fsS "http://127.0.0.1:$api_port/api/export.csv"
case "$(uname)" in
  Darwin) want="RunAtLoad" ;;
  *) want="WantedBy=default.target" ;;
esac
check "velo service install --dry-run" "$want" "$bin/velo" service install --dry-run
check "velo stop" "API stopped" "$bin/velo" stop
sleep 1
if curl -fsS -m 2 "http://127.0.0.1:$api_port/api/health" >/dev/null 2>&1; then fail "api is stopped after velo stop"; fi
ok "nothing left listening after velo stop"

echo "== cli alone (the api and dashboard are optional)"
alone="$work/alone"
npm install -g --prefix "$alone" --no-audit --no-fund "$work/tarballs/starktech-velo-$version.tgz" >"$work/install2.log" 2>&1 \
  || fail "npm install -g of the cli alone" "$(tail -20 "$work/install2.log")"
export VELO_HOME="$work/home-alone"
check "cli alone: velo init" "initialized" "$alone/bin/velo" init
check "cli alone: velo log" "alone" "$alone/bin/velo" log smoke 5m alone
bin="$alone/bin"
out="$("$alone/bin/velo" api start 2>&1 || true)"
case "$out" in
  *"npm install -g @starktech/velo-api"*) ok "cli alone: api start explains how to install it" ;;
  *) fail "cli alone: api start explains how to install it" "$out" ;;
esac

printf '\nsmoke test passed (%s checks)\n' "$pass"
