#!/usr/bin/env bash
# Reviewer agent loop.
# Each invocation reviews one PR (or exits if nothing to review).
# If work was done, immediately checks for more. Only sleeps when idle.
# Falls back through Claude → Codex → Gemini if a model runs out of credits.
# Retries on transient errors (network, GitHub). Logs errors for later review.
#
# Usage: ./scripts/reviewer.sh

# Fail on unset variables, but NOT on command errors — we handle those ourselves.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKTREE="/home/nhoj/Documents/learning/cq-reviewer"
PROMPT_FILE="$SCRIPT_DIR/prompts/reviewer.md"
LOGDIR="$REPO_ROOT/logs/reviewer"
ERRORLOG="$REPO_ROOT/logs/reviewer-errors.log"
LOCKFILE="/tmp/cq-reviewer.lock"
POLL_INTERVAL=300   # 5 minutes
MAX_RETRIES=3
RETRY_DELAY=60      # 1 minute between retries
MAX_BACKOFF=3600    # Cap at 1 hour
CONSECUTIVE_FAILURES=0

# --- Prevent overlapping runs ---
if [ -f "$LOCKFILE" ]; then
    pid=$(cat "$LOCKFILE")
    if kill -0 "$pid" 2>/dev/null; then
        echo "Reviewer agent already running (pid $pid), exiting."
        exit 0
    fi
    rm -f "$LOCKFILE"
fi
echo $$ > "$LOCKFILE"
trap 'rm -f "$LOCKFILE"' EXIT

# --- Ensure worktree exists ---
if [ ! -d "$WORKTREE" ]; then
    echo "Creating worktree at $WORKTREE"
    git -C "$REPO_ROOT" worktree add "$WORKTREE" --detach origin/main
fi

# --- Error logging ---
log_error() {
    local msg="$1"
    mkdir -p "$(dirname "$ERRORLOG")"
    echo "$(date): [reviewer] $msg" | tee -a "$ERRORLOG"
}

# --- Retry a command up to MAX_RETRIES times ---
retry() {
    local attempt=1
    local cmd="$*"
    while [ $attempt -le $MAX_RETRIES ]; do
        if eval "$cmd"; then
            return 0
        fi
        log_error "Attempt $attempt/$MAX_RETRIES failed: $cmd"
        if [ $attempt -lt $MAX_RETRIES ]; then
            echo "Retrying in ${RETRY_DELAY}s..."
            sleep "$RETRY_DELAY"
        fi
        attempt=$((attempt + 1))
    done
    log_error "All $MAX_RETRIES attempts failed: $cmd"
    return 1
}

# --- Credit exhaustion detection ---
is_out_of_credits() {
    local output="$1"
    echo "$output" | grep -qi "extra usage" && return 0
    echo "$output" | grep -qi "exceeded your current quota" && return 0
    echo "$output" | grep -qi "exhausted your daily quota" && return 0
    return 1
}

# --- Run agent with fallback cascade ---
run_agent() {
    local prompt="$1"
    local logfile="$2"
    local output

    # Try Claude
    echo "$(date): Trying Claude..." | tee -a "$logfile"
    output=$(claude -p "$prompt" --dangerously-skip-permissions --verbose 2>&1) || true
    echo "$output" | tee -a "$logfile"
    if ! is_out_of_credits "$output"; then
        return 0
    fi
    echo "$(date): Claude out of credits, trying Codex..." | tee -a "$logfile"

    # Try Codex
    output=$(codex exec "$prompt" --yolo 2>&1) || true
    echo "$output" | tee -a "$logfile"
    if ! is_out_of_credits "$output"; then
        return 0
    fi
    echo "$(date): Codex out of credits, trying Gemini..." | tee -a "$logfile"

    # Try Gemini
    output=$(cat "$PROMPT_FILE" | gemini -y -p "Follow these instructions" 2>&1) || true
    echo "$output" | tee -a "$logfile"
    if is_out_of_credits "$output"; then
        log_error "All models exhausted."
        return 1
    fi
    return 0
}

# --- Backoff sleep ---
backoff_sleep() {
    local base="$1"
    local delay=$((base * (2 ** CONSECUTIVE_FAILURES)))
    if [ $delay -gt $MAX_BACKOFF ]; then
        delay=$MAX_BACKOFF
    fi
    echo "Sleeping ${delay}s (failure streak: $CONSECUTIVE_FAILURES)..."
    sleep "$delay"
}

# --- Main loop ---
while true; do
    mkdir -p "$LOGDIR"
    LOGFILE="$LOGDIR/$(date +%Y%m%d-%H%M%S).log"

    cd "$WORKTREE"

    # Fetch and reset — retry on network failures
    if ! retry "git fetch origin 2>&1"; then
        CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
        log_error "Cannot reach GitHub after $MAX_RETRIES attempts. (streak: $CONSECUTIVE_FAILURES)"
        backoff_sleep "$POLL_INTERVAL"
        continue
    fi
    git checkout --detach origin/main 2>/dev/null || true

    echo "$(date): Starting reviewer agent" | tee "$LOGFILE"

    PROMPT="$(cat "$PROMPT_FILE")"
    if ! run_agent "$PROMPT" "$LOGFILE"; then
        CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
        log_error "Agent run failed. (streak: $CONSECUTIVE_FAILURES)"
        backoff_sleep "$POLL_INTERVAL"
        continue
    fi

    echo "$(date): Reviewer agent finished" | tee -a "$LOGFILE"

    # Success — reset backoff
    CONSECUTIVE_FAILURES=0

    # If the agent did work, check for more immediately.
    # "Nothing to review" means the agent found no work — sleep and poll later.
    if grep -qi "nothing to review" "$LOGFILE"; then
        echo "No work found. Sleeping ${POLL_INTERVAL}s..."
        sleep "$POLL_INTERVAL"
    else
        echo "Work done. Checking for more..."
    fi
done
