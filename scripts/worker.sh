#!/bin/sh
# Daily Reddit sync, weekly AniList refresh, then reload the database
while true; do
  if [ "$(date -u +%u)" = "1" ] || [ ! -f data/cache/anilist.json ]; then
    npm run sync:catalog
  fi
  npm run sync:threads && npm run db:seed
  sleep 86400
done
