docker compose -f docker-compose.dev.yml down --remove-orphans --volumes
docker compose -f docker-compose.dev.yml build
docker compose -f docker-compose.dev.yml up -d