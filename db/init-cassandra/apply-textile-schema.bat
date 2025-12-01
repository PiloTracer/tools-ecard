@echo off
REM ============================================================
REM Apply Template-Textile Cassandra Schema (Windows)
REM ============================================================
REM
REM Purpose: Apply the template-textile schema to a running Cassandra instance
REM Usage: apply-textile-schema.bat [container_name]
REM
REM Default container name: ecards-cassandra
REM ============================================================

setlocal enabledelayedexpansion

REM Set container name (default: ecards-cassandra)
set CONTAINER_NAME=%1
if "%CONTAINER_NAME%"=="" set CONTAINER_NAME=ecards-cassandra

set SCHEMA_FILE=03-template-textile-tables.cql

echo ============================================
echo Template-Textile Schema Application
echo Container: %CONTAINER_NAME%
echo Schema file: %SCHEMA_FILE%
echo ============================================

REM Check if container is running
docker ps --format "{{.Names}}" | findstr /B /E "%CONTAINER_NAME%" >nul
if %errorlevel% neq 0 (
    echo ERROR: Container '%CONTAINER_NAME%' is not running
    echo Please start the container with: docker-compose -f docker-compose.dev.yml up -d cassandra
    exit /b 1
)

REM Check if schema file exists
if not exist "%SCHEMA_FILE%" (
    echo ERROR: Schema file '%SCHEMA_FILE%' not found
    echo Make sure you're running this script from the db\init-cassandra directory
    exit /b 1
)

echo Applying schema...

REM Copy schema file to container
docker cp "%SCHEMA_FILE%" "%CONTAINER_NAME%:/tmp/%SCHEMA_FILE%"
if %errorlevel% neq 0 (
    echo ERROR: Failed to copy schema file to container
    exit /b 1
)

REM Execute the schema file
docker exec %CONTAINER_NAME% cqlsh -f "/tmp/%SCHEMA_FILE%"
if %errorlevel% neq 0 (
    echo ERROR: Failed to apply schema
    exit /b 1
)

echo Schema applied successfully!

REM Verify tables were created
echo.
echo Verifying tables...
docker exec %CONTAINER_NAME% cqlsh -e "USE ecards_canonical; DESCRIBE TABLES;" | findstr textile

REM Clean up
docker exec %CONTAINER_NAME% rm "/tmp/%SCHEMA_FILE%"

echo.
echo Template-Textile schema is ready!