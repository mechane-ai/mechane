#!/bin/sh
set -eu

# An explicit installation and key keep a developer's default Anthropic account out of this probe.
: "${ANTHROPIC_BASE_URL:?Set the installation origin}"
: "${ANTHROPIC_API_KEY:?Set an installation key}"
model=${1:?Pass a model ID that the installation offers}
unset ANTHROPIC_AUTH_TOKEN

expected='ant version 2.11.0'
actual=$(ant --version)
if [ "$actual" != "$expected" ]; then
  echo "Expected $expected, got $actual" >&2
  exit 1
fi

name="ant-qualification-$$"
agent=''
environment=''
session=''
cleanup() {
  status=$?
  trap - EXIT
  if [ -n "$session" ]; then ant beta:sessions archive --session-id "$session" >/dev/null || status=1; fi
  if [ -n "$agent" ]; then ant beta:agents archive --agent-id "$agent" >/dev/null || status=1; fi
  if [ -n "$environment" ]; then ant beta:environments archive --environment-id "$environment" >/dev/null || status=1; fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

agent=$(ant --raw-output --transform id beta:agents create --model "$model" --name "$name")
case "$agent" in agent_?*) ;; *) echo 'Missing agent ID' >&2; exit 1 ;; esac
environment=$(ant --raw-output --transform id beta:environments create --name "$name" --config '{"type":"self_hosted"}')
session=$(ant --raw-output --transform id beta:sessions create --agent "$agent" --environment-id "$environment")
case "$session" in sesn_?*) ;; *) echo 'Missing session ID' >&2; exit 1 ;; esac
observed=$(ant --raw-output --transform id beta:sessions retrieve --session-id "$session")
test "$observed" = "$session"
