#!/usr/bin/env bash

# Custom HTTP health check
# Author: Karan
# Version: 1.0.0
#
# Nagios exit codes:
#   OK=0, WARNING=1, CRITICAL=2, UNKNOWN=3

STATE_OK=0
STATE_WARNING=1
STATE_CRITICAL=2
STATE_UNKNOWN=3

STATUS_TEXT="UNKNOWN"
DETAILS=""

print_help() {
  cat <<EOF
Custom HTTP health check

Usage: \$0

Runs the following command and interprets the result as a Nagios plugin.
Command (not executed by this script until runtime):
  curl -fsS http://localhost:3000/

Exit codes:
  OK=0, WARNING=1, CRITICAL=2, UNKNOWN=3
EOF
}

print_version() {
  echo "1.0.0"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      print_help
      exit $STATE_OK
      ;;
    -V|--version)
      print_version
      exit $STATE_OK
      ;;
    *)
      echo "Unknown option: $1"
      exit $STATE_UNKNOWN
      ;;
  esac
done

CMD_OUTPUT=""
CMD_EXIT=0

# NOTE: This command is user-supplied and is only run when the plugin is executed by Nagios.
CMD_OUTPUT=$(eval "curl -fsS http://localhost:3000/" 2>&1)
CMD_EXIT=$?

DETAILS="$CMD_OUTPUT"

if [[ $CMD_EXIT -eq 0 ]]; then
  STATUS_TEXT="OK"
  EXIT_CODE=$STATE_OK
elif [[ -n "" && $CMD_EXIT -ne 0 ]]; then
  STATUS_TEXT="CRITICAL"
  EXIT_CODE=$STATE_CRITICAL
elif [[ -n "" && $CMD_EXIT -ne 0 ]]; then
  STATUS_TEXT="WARNING"
  EXIT_CODE=$STATE_WARNING
else
  STATUS_TEXT="UNKNOWN"
  EXIT_CODE=$STATE_UNKNOWN
fi

MESSAGE="CHECK: ${STATUS_TEXT} - ${DETAILS:-no details}"
eval "echo \"$MESSAGE\""

exit $EXIT_CODE

