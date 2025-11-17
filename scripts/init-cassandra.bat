@echo off
REM Initialize Cassandra Keyspace
REM Run this script once after starting docker-compose to create the keyspace

echo.
echo ==================================================
echo   Initializing Cassandra Keyspace
echo ==================================================
echo.

echo Waiting for Cassandra to be ready...
:wait_loop
docker exec ecards-cassandra cqlsh -e "DESCRIBE KEYSPACES" >nul 2>&1
if errorlevel 1 (
    echo    Cassandra is starting up - waiting...
    timeout /t 3 /nobreak >nul
    goto wait_loop
)

echo.
echo Cassandra is ready!
echo.
echo Creating keyspace 'ecards_canonical'...
docker exec ecards-cassandra cqlsh -f /docker-entrypoint-initdb.d/01-create-keyspace.cql

if errorlevel 1 (
    echo.
    echo ERROR: Failed to create keyspace
    pause
    exit /b 1
)

echo.
echo ==================================================
echo   Cassandra initialization complete!
echo ==================================================
echo.
echo Keyspace 'ecards_canonical' is now ready to use.
echo.
pause
