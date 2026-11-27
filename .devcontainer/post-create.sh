#!/usr/bin/env bash
# Runs once when the dev container is created. Installs the repo's pinned
# toolchain (mise.toml) and its dependencies. Everything stays in the container.
set -euo pipefail

# Volume mounts are root-owned, and so are the parent folders Docker creates
# for them (~/.local, ~/.local/share). Hand them to the container user.
me="$(id -u):$(id -g)"
sudo chown "$me" "$HOME/.local" "$HOME/.local/share"
for d in "$HOME/.local/share/mise"  "$PWD/node_modules"; do
    if [[ -d "$d" && "$(stat -c %u "$d")" != "$(id -u)" ]]; then sudo chown -R "$me" "$d"; fi
done
mkdir -p "$HOME/.local/bin"

if ! command -v mise >/dev/null; then
    curl -fsSL https://mise.run | sh
fi
export PATH="$HOME/.local/bin:$HOME/.local/share/mise/shims:$PATH"

if [[ -f mise.toml || -f .mise.toml || -f .tool-versions ]]; then
    mise trust
    mise install
fi

# Dependencies, by lockfile.
if [[ -f pnpm-lock.yaml ]]; then
    mise exec -- pnpm install --frozen-lockfile
elif [[ -f package-lock.json ]]; then
    mise exec -- npm ci
elif [[ -f yarn.lock ]]; then
    mise exec -- yarn install --frozen-lockfile
elif [[ -f bun.lock || -f bun.lockb ]]; then
    mise exec -- bun install --frozen-lockfile
fi
if [[ -f uv.lock ]]; then mise exec -- uv sync --frozen; fi
if [[ -f Cargo.toml ]]; then mise exec -- cargo fetch; fi
if [[ -f go.mod ]]; then mise exec -- go mod download; fi

if [[ -x .devcontainer/post-create.local.sh ]]; then .devcontainer/post-create.local.sh; fi
echo "post-create: done"
