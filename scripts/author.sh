#!/usr/bin/env bash
# Author agent loop.
# Each invocation does one thing (revise a PR or implement an issue), then exits.
# If work was done, immediately checks for more. Only sleeps when idle.
# Falls back through Claude → Codex → Gemini if a model runs out of credits.
# Retries on transient errors (network, GitHub). Logs errors for later review.
#
# Usage: ./scripts/author.sh

# Fail on unset variables, but NOT on command errors — we handle those ourselves.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKTREE="/home/nhoj/Documents/learning/cq-author"
PROMPT_FILE="$SCRIPT_DIR/prompts/author.md"
LOGDIR="$REPO_ROOT/logs/author"
ERRORLOG="$REPO_ROOT/logs/author-errors.log"
LOCKFILE="/tmp/cq-author.lock"
POLL_INTERVAL=300   # 5 minutes
MAX_RETRIES=3
RETRY_DELAY=60      # 1 minute between retries
MAX_BACKOFF=3600    # Cap at 1 hour
CONSECUTIVE_FAILURES=0

# --- Prevent overlapping runs ---
if [ -f "$LOCKFILE" ]; then
    pid=$(cat "$LOCKFILE")
    if kill -0 "$pid" 2>/dev/null; then
        echo "Author agent already running (pid $pid), exiting."
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
    echo "$(date): [author] $msg" | tee -a "$ERRORLOG"
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
    echo "$output" | grep -qi "hit your limit" && return 0
    echo "$output" | grep -qi "usage limit" && return 0
    echo "$output" | grep -qi "rate limit" && return 0
    return 1
}

# --- Cooldown management ---
# Marker files in logs/cooldown/ prevent trying exhausted models for 1 hour.
COOLDOWN_DIR="$REPO_ROOT/logs/cooldown"
mkdir -p "$COOLDOWN_DIR"

check_cooldown() {
    local model="$1"
    local marker="$COOLDOWN_DIR/$model"
    if [ -f "$marker" ]; then
        # If marker is older than 60 mins, remove it and return success (not in cooldown)
        if [ -n "$(find "$marker" -mmin +60)" ]; then
            rm -f "$marker"
            return 1
        fi
        return 0 # Still in cooldown
    fi
    return 1 # Not in cooldown
}

set_cooldown() {
    local model="$1"
    touch "$COOLDOWN_DIR/$model"
}

# --- Run agent with fallback cascade ---
run_agent() {
    local prompt="$1"
    local logfile="$2"
    local output
    local status

    # Try Claude
    if check_cooldown "claude"; then
        echo "$(date): Skipping Claude (cooldown active)..." | tee -a "$logfile"
    else
        echo "$(date): Trying Claude..." | tee -a "$logfile"
        if output=$(claude -p "$prompt" --dangerously-skip-permissions --verbose 2>&1); then
            status=0
        else
            status=$?
        fi
        echo "$output" | tee -a "$logfile"
        if [ "$status" -eq 0 ]; then
            return 0
        fi
        if is_out_of_credits "$output"; then
            set_cooldown "claude"
            echo "$(date): Claude out of credits, set 1h cooldown." | tee -a "$logfile"
        else
            log_error "Claude failed with exit code $status."
            return 1
        fi
    fi

    # Try Codex
    if check_cooldown "codex"; then
        echo "$(date): Skipping Codex (cooldown active)..." | tee -a "$logfile"
    else
        echo "$(date): Trying Codex..." | tee -a "$logfile"
        if output=$(codex exec "$prompt" --yolo 2>&1); then
            status=0
        else
            status=$?
        fi
        echo "$output" | tee -a "$logfile"
        if [ "$status" -eq 0 ]; then
            return 0
        fi
        if is_out_of_credits "$output"; then
            set_cooldown "codex"
            echo "$(date): Codex out of credits, set 1h cooldown." | tee -a "$logfile"
        else
            log_error "Codex failed with exit code $status."
            return 1
        fi
    fi

    # Try Gemini
    if check_cooldown "gemini"; then
        echo "$(date): Skipping Gemini (cooldown active)..." | tee -a "$logfile"
    else
        echo "$(date): Trying Gemini..." | tee -a "$logfile"
        if output=$(cat "$PROMPT_FILE" | gemini -y -p "Follow these instructions" 2>&1); then
            status=0
        else
            status=$?
        fi
        echo "$output" | tee -a "$logfile"
        if [ "$status" -eq 0 ]; then
            return 0
        fi
        if is_out_of_credits "$output"; then
            set_cooldown "gemini"
            echo "$(date): Gemini out of credits, set 1h cooldown." | tee -a "$logfile"
            log_error "All models exhausted (Gemini hit limit)."
        else
            log_error "Gemini failed with exit code $status."
        fi
    fi
    return 1
}

# --- Backoff sleep ---
# On consecutive failures, double the sleep each time up to MAX_BACKOFF.
# Any success resets to normal.
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

    echo "$(date): Starting author agent" | tee "$LOGFILE"

    PROMPT="$(cat "$PROMPT_FILE")"
    if ! run_agent "$PROMPT" "$LOGFILE"; then
        CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
        log_error "Agent run failed. (streak: $CONSECUTIVE_FAILURES)"
        backoff_sleep "$POLL_INTERVAL"
        continue
    fi

    echo "$(date): Author agent finished" | tee -a "$LOGFILE"

    # Success — reset backoff
    CONSECUTIVE_FAILURES=0

    # If the agent did work, check for more immediately.
    # "Nothing to do" means the agent found no work — sleep and poll later.
    if grep -qi "nothing to do" "$LOGFILE"; then
        echo "No work found. Sleeping ${POLL_INTERVAL}s..."
        sleep "$POLL_INTERVAL"
    else
        echo "Work done. Checking for more..."
    fi
done
