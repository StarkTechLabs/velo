# Source this file to work on velo without touching your real data:
#
#   . scripts/dev-env.sh
#
# It points VELO_HOME at ./.velo-dev (config, database, logs and pid files all live there) and
# defines a `velo` function that runs the CLI built from this checkout. Works in bash and zsh.

VELO_REPO="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
export VELO_REPO
export VELO_HOME="${VELO_HOME:-$VELO_REPO/.velo-dev}"

velo() {
  if [ ! -f "$VELO_REPO/packages/cli/dist/main.js" ]; then
    echo "velo: the CLI isn't built yet. Run: npm run build" >&2
    return 1
  fi
  node "$VELO_REPO/packages/cli/dist/main.js" "$@"
}

case "$VELO_HOME" in
  "$HOME/.velo" | "$HOME/.velo/")
    echo "warning: VELO_HOME is your real data directory ($VELO_HOME)." >&2
    echo "         A development build can migrate that database. Unset VELO_HOME to use the sandbox." >&2
    ;;
  *)
    echo "velo dev environment: VELO_HOME=$VELO_HOME"
    ;;
esac
