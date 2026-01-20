#!/bin/sh
set -e

on_exit () {
	[ $? -eq 0 ] && exit
	echo 'ERROR: Feature "Python" (ghcr.io/devcontainers/features/python) failed to install! Look at the documentation at ${documentation} for help troubleshooting this error.'
}

trap on_exit EXIT

set -a
. ../devcontainer-features.builtin.env
. ./devcontainer-features.env
set +a

echo ===========================================================================

echo 'Feature       : Python'
echo 'Description   : Installs the provided version of Python, as well as PIPX, and other common Python utilities.  JupyterLab is conditionally installed with the python feature. Note: May require source code compilation.'
echo 'Id            : ghcr.io/devcontainers/features/python'
echo 'Version       : 1.8.0'
echo 'Documentation : https://github.com/devcontainers/features/tree/main/src/python'
echo 'Options       :'
echo '    CONFIGUREJUPYTERLABALLOWORIGIN=""
    ENABLESHARED="false"
    HTTPPROXY=""
    INSTALLJUPYTERLAB="false"
    INSTALLPATH="/usr/local/python"
    INSTALLTOOLS="true"
    OPTIMIZE="false"
    TOOLSTOINSTALL="flake8,autopep8,black,yapf,mypy,pydocstyle,pycodestyle,bandit,pipenv,virtualenv,pytest,pylint"
    VERSION="3.11"'
echo 'Environment   :'
printenv
echo ===========================================================================

chmod +x ./install.sh
./install.sh
