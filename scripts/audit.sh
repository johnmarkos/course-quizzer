#!/usr/bin/env bash
# Milestone-audit one-shot.
# Planner-triggered. Reads a phase from ROADMAP.md, runs Codex once to audit
# the phase's code against AGENTS.md checklists, instructs Codex to file one
# GitHub issue per finding, and exits.
#
# Differences from author.sh / reviewer.sh:
#   - Single shot. No poll loop, no backoff.
#   - Codex only. No fallback cascade. If Codex fails, the planner reruns
#     manually (or escalates to Gemini by hand).
#   - No cooldown handling. The planner decides when to retry.
#
# Usage: ./scripts/audit.sh <phase-number>
# Example: ./scripts/audit.sh 3

# Fail on unset variables, but NOT on command errors — we handle those ourselves.
set -uo pipefail

# --- Argument parsing ---
if [ $# -ne 1 ]; then
    echo "Usage: $0 <phase-number>" >&2
    exit 2
fi
PHASE="$1"
if ! [[ "$PHASE" =~ ^[0-9]+$ ]]; then
    echo "Phase must be a non-negative integer (got: '$PHASE')" >&2
    exit 2
fi

# --- Paths ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# Worktree path is configurable so the script works on multiple machines.
WORKTREE="${CQ_WORKTREE_AUDIT:-$REPO_ROOT/../cq-audit}"
PROMPT_FILE="$SCRIPT_DIR/prompts/audit.md"
LOGDIR="$REPO_ROOT/logs/audit"
LOCKFILE="/tmp/cq-audit.lock"

# --- Prevent overlapping runs ---
# The script is one-shot, but a planner could accidentally launch it twice.
if [ -f "$LOCKFILE" ]; then
    pid=$(cat "$LOCKFILE")
    if kill -0 "$pid" 2>/dev/null; then
        echo "Audit already running (pid $pid). Exiting." >&2
        exit 1
    fi
    rm -f "$LOCKFILE"
fi
echo $$ > "$LOCKFILE"
trap 'rm -f "$LOCKFILE"' EXIT

# --- Ensure worktree exists, fetch latest, detach to origin/main ---
# The auditor reads code, so it needs a clean view of origin/main rather than
# whatever the planner happens to have checked out.
if [ ! -d "$WORKTREE" ]; then
    echo "Creating audit worktree at $WORKTREE"
    if ! git -C "$REPO_ROOT" worktree add "$WORKTREE" --detach origin/main; then
        echo "Failed to create worktree at $WORKTREE" >&2
        exit 4
    fi
fi
cd "$WORKTREE"
if ! git fetch origin 2>&1; then
    echo "Could not fetch origin. Check network." >&2
    exit 5
fi
git checkout --detach origin/main 2>/dev/null || true

# --- Extract Phase N section from ROADMAP.md ---
# Phase headers look like "## Phase N: ...". A section ends at the next
# "## Phase" header or end-of-file.
PHASE_SCOPE=$(awk -v p="$PHASE" '
    BEGIN { in_phase = 0 }
    /^## Phase / {
        if (in_phase) { exit }
        if ($0 ~ ("^## Phase " p ":")) { in_phase = 1 }
    }
    in_phase
' ROADMAP.md)

if [ -z "$PHASE_SCOPE" ]; then
    echo "Could not find 'Phase $PHASE:' header in ROADMAP.md" >&2
    exit 3
fi

# --- Build prompt: template + phase scope ---
PROMPT=$(cat "$PROMPT_FILE")
PROMPT+="

---

## Phase $PHASE scope (from ROADMAP.md)

$PHASE_SCOPE"

# --- Log setup ---
mkdir -p "$LOGDIR"
LOGFILE="$LOGDIR/$(date +%Y%m%d-%H%M%S)-phase-$PHASE.log"

{
    echo "$(date): Starting milestone audit for Phase $PHASE"
    echo "Worktree: $WORKTREE"
    echo "Log file: $LOGFILE"
    echo "---"
} | tee "$LOGFILE"

# --- Run Codex once ---
# No fallback. If Codex fails (credits, network, refusal), the planner reruns.
if codex exec "$PROMPT" --yolo 2>&1 | tee -a "$LOGFILE"; then
    echo "$(date): Audit completed" | tee -a "$LOGFILE"
    exit 0
else
    status=$?
    echo "$(date): Audit failed with exit code $status" | tee -a "$LOGFILE"
    exit "$status"
fi
