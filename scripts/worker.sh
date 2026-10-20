#!/bin/sh
# Daily Reddit sync, weekly AniList refresh, then reload the database
# Load the cache right away so a fresh deploy never serves an empty database
npm run db:seed
while true; do
  if [ "$(date -u +%u)" = "1" ] || [ ! -f data/cache/anilist.json ]; then
    npm run sync:catalog
  fi
  npm run sync:threads && npm run db:seed
  sleep 86400
done
