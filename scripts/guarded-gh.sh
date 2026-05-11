#!/usr/bin/env bash
# Guarded gh wrapper for author agents. It delegates every gh command except
# PR merges, where it enforces the repository rule that CI must be green first.

set -euo pipefail

REAL_GH="${CQ_AUTHOR_REAL_GH:-}"

if [ -z "$REAL_GH" ] || [ ! -x "$REAL_GH" ]; then
    echo "Author CI guard: CQ_AUTHOR_REAL_GH is not set to an executable gh binary." >&2
    exit 1
fi

is_pull_request_merge() {
    [ "$#" -ge 2 ] && [ "$1" = "pr" ] && [ "$2" = "merge" ]
}

find_pull_request_ref() {
    local arg

    for arg in "$@"; do
        case "$arg" in
            ''|-*) ;;
            https://github.com/*/pull/*|http://github.com/*/pull/*|[0-9]*)
                printf '%s\n' "$arg"
                return 0
                ;;
        esac
    done

    return 1
}

resolve_pull_request_ref() {
    local pull_request_ref

    if pull_request_ref="$(find_pull_request_ref "${@:3}")"; then
        printf '%s\n' "$pull_request_ref"
        return 0
    fi

    if ! pull_request_ref="$("$REAL_GH" pr view --json number --jq '.number')"; then
        echo "Author CI guard: cannot determine the current branch PR; refusing to merge." >&2
        return 1
    fi
    printf '%s\n' "$pull_request_ref"
}

check_status_checks_green() {
    local pull_request_ref="$1"
    local failing_checks

    # shellcheck disable=SC2016 # jq expression must stay single-quoted.
    if ! failing_checks="$("$REAL_GH" pr view "$pull_request_ref" --json statusCheckRollup --jq '
        (.statusCheckRollup // []) as $checks
        | if ($checks | length) == 0 then
            "no status checks reported"
          else
            $checks[]
            | {
                name: (.name // .context // .workflowName // "unknown check"),
                result: (.conclusion // .state // .status // "UNKNOWN")
              }
            | select((.result == "SUCCESS" or .result == "SKIPPED") | not)
            | "\(.name): \(.result)"
          end
    ')"; then
        echo "Author CI guard: could not read status checks for PR $pull_request_ref; refusing to merge." >&2
        return 1
    fi

    if [ -n "$failing_checks" ]; then
        echo "Author CI guard: refusing to merge PR $pull_request_ref; status checks are not green:" >&2
        printf '%s\n' "$failing_checks" >&2
        return 1
    fi

    return 0
}

if is_pull_request_merge "$@"; then
    pull_request_ref="$(resolve_pull_request_ref "$@")"
    check_status_checks_green "$pull_request_ref"
fi

exec "$REAL_GH" "$@"
