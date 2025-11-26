#!/bin/bash

# Get all running container IDs
containers=$(docker ps -q)

if [ -z "$containers" ]; then
  echo "No running containers found."
  exit 0
fi

# Loop through each container and stream logs in the background
for cid in $containers; do
  name=$(docker inspect --format='{{.Name}}' "$cid" | sed 's/^\/\(.*\)/\1/')
  echo "Streaming logs for container: $name (ID: $cid)"
  docker logs -f --tail 100 "$cid" 2>&1 | sed "s/^/[$name] /" &
done

# Wait indefinitely to keep background jobs alive
echo "Press Ctrl+C to stop all log streams."
wait