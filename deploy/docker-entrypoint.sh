#!/bin/sh
# Container entrypoint.
#
# The production guard in server/src/config.js refuses to start when secrets come
# from process environment alone (`SECRET_PROVIDER=env`). Hosts such as Railway
# and Render only offer environment variables for secrets, so when
# FLAMINGO_SECRETS_JSON is present this materialises the JSON file that
# `SECRET_PROVIDER=file` expects (see server/src/lib/secrets.js).
#
# The value never enters the image or a repository: it is written at boot into
# the container's tmpfs and removed when the container stops. On a host with a
# mounted secret file instead, that file is used untouched.
set -eu

if [ -n "${FLAMINGO_SECRETS_JSON:-}" ]; then
  secret_file="${FLAMINGO_SECRETS_FILE:-/tmp/flamingo-secrets.json}"
  if [ ! -f "$secret_file" ]; then
    mkdir -p "$(dirname "$secret_file")"
    umask 077
    printf '%s' "$FLAMINGO_SECRETS_JSON" > "$secret_file"
    echo "Secrets: wrote $(basename "$secret_file") from FLAMINGO_SECRETS_JSON"
  fi
  export FLAMINGO_SECRETS_FILE="$secret_file"
fi

exec "$@"
