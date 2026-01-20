#!/bin/sh
set -e

on_exit () {
	[ $? -eq 0 ] && exit
	echo 'ERROR: Feature "Docker (Docker-in-Docker)" (ghcr.io/devcontainers/features/docker-in-docker) failed to install! Look at the documentation at ${documentation} for help troubleshooting this error.'
}

trap on_exit EXIT

set -a
. ../devcontainer-features.builtin.env
. ./devcontainer-features.env
set +a

echo ===========================================================================

echo 'Feature       : Docker (Docker-in-Docker)'
echo 'Description   : Create child containers *inside* a container, independent from the host'\''s docker instance. Installs Docker extension in the container along with needed CLIs.'
echo 'Id            : ghcr.io/devcontainers/features/docker-in-docker'
echo 'Version       : 2.14.0'
echo 'Documentation : https://github.com/devcontainers/features/tree/main/src/docker-in-docker'
echo 'Options       :'
echo '    AZUREDNSAUTODETECTION="true"
    DISABLEIP6TABLES="false"
    DOCKERDASHCOMPOSEVERSION="v2"
    DOCKERDEFAULTADDRESSPOOL=""
    INSTALLDOCKERBUILDX="true"
    INSTALLDOCKERCOMPOSESWITCH="false"
    MOBY="true"
    MOBYBUILDXVERSION="latest"
    VERSION="latest"'
echo 'Environment   :'
printenv
echo ===========================================================================

chmod +x ./install.sh
./install.sh
