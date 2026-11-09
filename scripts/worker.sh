#!/bin/sh
# Daily Reddit sync, weekly AniList and IGDB refresh, then reload the database
# Load the cache right away so a fresh deploy never serves an empty database
npm run db:seed
while true; do
  if [ "$(date -u +%u)" = "1" ] || [ ! -f data/cache/anilist.json ]; then
    npm run sync:catalog
  fi
  if [ -n "$IGDB_CLIENT_ID" ] && { [ "$(date -u +%u)" = "1" ] || [ ! -f data/cache/igdb.json ]; }; then
    npm run sync:games
  fi
  npm run sync:threads && npm run db:seed
  npm run db:cleanup
  sleep 86400
done
