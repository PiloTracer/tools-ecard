@echo off
REM Initialize Cassandra (dev) — uses docker compose + repo root .env (COMPOSE_PROJECT_NAME, TD_*)
setlocal
cd /d "%~dp0\.."
if not exist "%CD%\.env" if not exist "%CD%\.env.dev" (
  echo Missing .env or .env.dev. Copy .env.dev.example to .env first.
  exit /b 1
)
if exist "%CD%\.env" (set "ENVFILE=.env") else (set "ENVFILE=.env.dev")
echo.
echo Initializing Cassandra keyspace (project from %ENVFILE%)...
:wait_loop
docker compose -f docker-compose.dev.yml --env-file %ENVFILE% exec -T cassandra cqlsh -e "DESCRIBE KEYSPACES" >nul 2>&1
if errorlevel 1 (
  echo    Cassandra is starting - waiting...
  timeout /t 3 /nobreak >nul
  goto wait_loop
)
echo Cassandra is ready.
docker compose -f docker-compose.dev.yml --env-file %ENVFILE% exec -T cassandra cqlsh -f /docker-entrypoint-initdb.d/01-create-keyspace.cql
if errorlevel 1 ( echo ERROR: keyspace init failed. & exit /b 1 )
echo Done.
endlocal
