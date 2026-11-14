# Sandbox commands run as the unprivileged `node` user. The build folder contains the guest and CLI bundles, tool
# installer, and license notices. The base repeats mise.toml's Node pin so host and container guests use one Node release.
FROM mirror.gcr.io/library/node:24.22.1-trixie-slim@sha256:89c5244bc22a9bc3287d89ebc7e49b9cb5bb84cd40e6175ac3421d5a9f68b95a
ARG TARGETARCH
RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates git xz-utils curl jq python3 python3-venv build-essential pkg-config libssl-dev openssl nix-bin unzip zstd ripgrep chromium xvfb ffmpeg fonts-liberation libnss3-tools \
  && rm -rf /var/lib/apt/lists/*
RUN install -d -o node -g node /nix \
  && install -d /etc/nix \
  && printf 'experimental-features = nix-command flakes\nbuild-users-group =\nsandbox = false\n' > /etc/nix/nix.conf
COPY install-tools.sh /opt/mechane/install-tools.sh
RUN sh /opt/mechane/install-tools.sh "$TARGETARCH" && rm /opt/mechane/install-tools.sh
RUN install -d -m 755 /usr/local/share/licenses/mechane-tools
COPY --chmod=644 gh-LICENSE mise-LICENSE /usr/local/share/licenses/mechane-tools/
COPY --chmod=644 guest.mjs mechane.mjs /opt/mechane/
COPY --chmod=755 mechane /usr/local/bin/mechane
USER node
RUN nix store info --store local \
  && test "$(nix eval --expr '2 + 2')" = 4 \
  && node --check /opt/mechane/guest.mjs \
  && node --check /opt/mechane/mechane.mjs \
  && test -r /usr/local/share/licenses/mechane-tools/gh-LICENSE \
  && test -r /usr/local/share/licenses/mechane-tools/mise-LICENSE
WORKDIR /home/node
EXPOSE 8080
CMD ["node", "/opt/mechane/guest.mjs"]
