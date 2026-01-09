#!/bin/bash
# Install nsjail for Python code sandboxing
# This script installs nsjail from the official Debian/Ubuntu package or builds from source

set -e

# Check if nsjail is already installed
if command -v nsjail &> /dev/null; then
    echo "nsjail is already installed: $(nsjail --version 2>&1 | head -1)"
    exit 0
fi

echo "Installing nsjail..."

# Try to install from package first (available in Debian 12+ / Ubuntu 22.04+)
if sudo apt-get update && sudo apt-get install -y nsjail 2>/dev/null; then
    echo "nsjail installed from package"
    nsjail --version 2>&1 | head -1
    exit 0
fi

# If package not available, build from source
echo "Package not available, building from source..."

# Install build dependencies
sudo apt-get update
sudo apt-get install -y \
    autoconf \
    bison \
    flex \
    gcc \
    g++ \
    git \
    libprotobuf-dev \
    libnl-3-dev \
    libnl-route-3-dev \
    libseccomp-dev \
    pkg-config \
    protobuf-compiler \
    make

# Clone and build nsjail
NSJAIL_DIR=$(mktemp -d)
cd "$NSJAIL_DIR"
git clone --depth 1 https://github.com/google/nsjail.git
cd nsjail
make -j$(nproc)

# Install
sudo cp nsjail /usr/local/bin/
sudo chmod +x /usr/local/bin/nsjail

# Cleanup
cd /
rm -rf "$NSJAIL_DIR"

echo "nsjail installed successfully"
nsjail --version 2>&1 | head -1
