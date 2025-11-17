#!/bin/bash

# Test script for simple-projects feature
# Run this after starting the Docker containers

echo "🧪 Testing Simple Projects Feature"
echo "=================================="

API_URL="http://localhost:7400/api/v1"

# Test 1: Ensure default project
echo "Test 1: Ensure default project exists"
curl -X POST "$API_URL/projects/ensure-default" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"

echo -e "\n---\n"

# Test 2: Get all projects
echo "Test 2: Get all projects"
curl -X GET "$API_URL/projects" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"

echo -e "\n---\n"

# Test 3: Create new project
echo "Test 3: Create new project"
curl -X POST "$API_URL/projects" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Project"}' \
  -w "\nHTTP Status: %{http_code}\n"

echo -e "\n---\n"

# Test 4: Get selected project
echo "Test 4: Get selected project"
curl -X GET "$API_URL/projects/selected" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"

echo -e "\n---\n"

# Test 5: Update selected project (use a mock UUID for testing)
echo "Test 5: Update selected project"
curl -X PUT "$API_URL/projects/selected" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"550e8400-e29b-41d4-a716-446655440000"}' \
  -w "\nHTTP Status: %{http_code}\n"

echo -e "\n---\n"

echo "✅ Tests completed! Check the output above for results."
echo "Note: These tests use a mock user ID. In production, authentication will be required."