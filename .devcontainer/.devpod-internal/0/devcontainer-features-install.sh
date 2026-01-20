#!/bin/sh
set -e

on_exit () {
	[ $? -eq 0 ] && exit
	echo 'ERROR: Feature "Supabase CLI (via Github Releases)" (ghcr.io/devcontainers-extra/features/supabase-cli) failed to install! Look at the documentation at ${documentation} for help troubleshooting this error.'
}

trap on_exit EXIT

set -a
. ../devcontainer-features.builtin.env
. ./devcontainer-features.env
set +a

echo ===========================================================================

echo 'Feature       : Supabase CLI (via Github Releases)'
echo 'Description   : The Supabase CLI provides tools to develop your project locally and deploy to the Supabase Platform. You can also use the CLI to manage your Supabase projects, handle database migrations and CI/CD workflows, and generate types directly from your database schema.'
echo 'Id            : ghcr.io/devcontainers-extra/features/supabase-cli'
echo 'Version       : 1.0.7'
echo 'Documentation : http://github.com/devcontainers-extra/features/tree/main/src/supabase-cli'
echo 'Options       :'
echo '    VERSION="latest"'
echo 'Environment   :'
printenv
echo ===========================================================================

chmod +x ./install.sh
./install.sh
