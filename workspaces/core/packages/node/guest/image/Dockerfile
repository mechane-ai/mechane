# Sandbox commands run as the unprivileged `node` user. The build folder contains only the guest bundle, tool installer,
# and license notices. The base repeats mise.toml's Node pin so host and container guests use one Node release.
FROM mirror.gcr.io/library/node:24.22.1-trixie-slim@sha256:89c5244bc22a9bc3287d89ebc7e49b9cb5bb84cd40e6175ac3421d5a9f68b95a
ARG TARGETARCH
RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates git xz-utils curl jq python3 python3-venv build-essential pkg-config libssl-dev unzip zstd ripgrep chromium xvfb ffmpeg fonts-liberation libnss3-tools \
  && rm -rf /var/lib/apt/lists/*
COPY install-tools.sh /opt/mechane/install-tools.sh
RUN sh /opt/mechane/install-tools.sh "$TARGETARCH" && rm /opt/mechane/install-tools.sh
COPY gh-LICENSE mise-LICENSE /usr/local/share/licenses/mechane-tools/
COPY guest.mjs /opt/mechane/guest.mjs
USER node
WORKDIR /home/node
EXPOSE 8080
CMD ["node", "/opt/mechane/guest.mjs"]
