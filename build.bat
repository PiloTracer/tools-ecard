docker compose -f docker-compose.dev.yml stop api-server
docker compose -f docker-compose.dev.yml stop front-cards
docker compose -f docker-compose.dev.yml build api-server
docker compose -f docker-compose.dev.yml build front-cards
docker compose -f docker-compose.dev.yml start api-server
docker compose -f docker-compose.dev.yml start front-cards
