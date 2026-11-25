#!/bin/sh
# Aggiorna il parametro ?v= di CSS e moduli JS per forzare il browser a scaricare i file nuovi.
set -e
cd "$(dirname "$0")/.."
V=$(date +%Y%m%d%H%M)
sed -i '' -E "s/\?v=[0-9]+/?v=$V/g" index.html app.js manifest.webmanifest
echo "versione $V"
