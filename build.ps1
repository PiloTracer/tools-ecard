# Stop services
docker compose -f docker-compose.dev.yml stop api-server
docker compose -f docker-compose.dev.yml stop front-cards

# Build with logs
docker compose -f docker-compose.dev.yml build api-server 2>&1 | Tee-Object -FilePath build-api-server.log
docker compose -f docker-compose.dev.yml build front-cards 2>&1 | Tee-Object -FilePath build-front-cards.log

# Start services
docker compose -f docker-compose.dev.yml start api-server
docker compose -f docker-compose.dev.yml start front-cards