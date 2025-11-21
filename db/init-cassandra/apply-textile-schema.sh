#!/bin/bash

# ============================================================
# Apply Template-Textile Cassandra Schema
# ============================================================
#
# Purpose: Apply the template-textile schema to a running Cassandra instance
# Usage: ./apply-textile-schema.sh [container_name]
#
# Default container name: ecards-cassandra
# ============================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Container name (default: ecards-cassandra)
CONTAINER_NAME="${1:-ecards-cassandra}"
SCHEMA_FILE="03-template-textile-tables.cql"

echo -e "${YELLOW}📦 Template-Textile Schema Application${NC}"
echo "Container: $CONTAINER_NAME"
echo "Schema file: $SCHEMA_FILE"
echo "----------------------------------------"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${RED}❌ Error: Container '$CONTAINER_NAME' is not running${NC}"
    echo "Please start the container with: docker-compose -f docker-compose.dev.yml up -d cassandra"
    exit 1
fi

# Check if schema file exists
if [ ! -f "$SCHEMA_FILE" ]; then
    echo -e "${RED}❌ Error: Schema file '$SCHEMA_FILE' not found${NC}"
    echo "Make sure you're running this script from the db/init-cassandra directory"
    exit 1
fi

echo -e "${YELLOW}🔄 Applying schema...${NC}"

# Copy schema file to container
docker cp "$SCHEMA_FILE" "${CONTAINER_NAME}:/tmp/${SCHEMA_FILE}"

# Execute the schema file
if docker exec "$CONTAINER_NAME" cqlsh -f "/tmp/${SCHEMA_FILE}"; then
    echo -e "${GREEN}✅ Schema applied successfully!${NC}"

    # Verify tables were created
    echo -e "\n${YELLOW}📋 Verifying tables...${NC}"
    docker exec "$CONTAINER_NAME" cqlsh -e "USE ecards_canonical; DESCRIBE TABLES;" | grep textile || true

    # Clean up
    docker exec "$CONTAINER_NAME" rm "/tmp/${SCHEMA_FILE}"

    echo -e "\n${GREEN}✨ Template-Textile schema is ready!${NC}"
else
    echo -e "${RED}❌ Failed to apply schema${NC}"
    exit 1
fi