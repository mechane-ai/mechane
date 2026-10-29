# The image every machine of a sandbox runs: the guest on Node, with bash, git and the CA certificates a public clone
# needs. Its build folder holds only this file and the guest bundle, so nothing secret can enter the image, and its
# commands run as the unprivileged `node` user from that user's home. The base repeats mise.toml's Node pin, so a host
# machine and a container run the guest on one Node release.
FROM mirror.gcr.io/library/node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205
RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates git \
  && rm -rf /var/lib/apt/lists/*
COPY guest.mjs /opt/mechane/guest.mjs
USER node
WORKDIR /home/node
EXPOSE 8080
CMD ["node", "/opt/mechane/guest.mjs"]
