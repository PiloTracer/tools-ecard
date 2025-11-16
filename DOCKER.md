# Docker Deployment Guide

## Development Mode

### Features
- Hot-reload enabled for all services
- Source code mounted as volumes
- Debug logging enabled
- Custom port mappings (7xxx series)

### Quick Start

```bash
# Start all services in development mode
docker-compose -f docker-compose.dev.yml up --build

# Or run in detached mode
docker-compose -f docker-compose.dev.yml up --build -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# View specific service logs
docker-compose -f docker-compose.dev.yml logs -f front-cards

# Stop all services
docker-compose -f docker-compose.dev.yml down

# Stop and remove volumes (reset databases)
docker-compose -f docker-compose.dev.yml down -v
```

### Service Endpoints (Development)

- **Frontend**: http://localhost:7300
- **API Server**: http://localhost:7400
  - Health check: http://localhost:7400/health
- **PostgreSQL**: localhost:7432
- **Cassandra**: localhost:7042
- **Redis**: localhost:7379

### Hot Reload

All application services automatically reload when you edit source files:

- **front-cards**: Next.js Fast Refresh (instant updates)
- **api-server**: tsx watch (restarts on file change)
- **render-worker**: tsx watch (restarts on file change)

### Development Workflow

1. Make changes to your source code
2. Changes are automatically detected
3. Service restarts/reloads automatically
4. Test your changes immediately

---

## Production Mode

### Features
- Multi-stage builds (smaller images)
- Production-optimized builds
- Non-root users for security
- Health checks enabled
- Automatic restarts
- Scalable worker replicas

### Setup

1. Copy environment template:
   ```bash
   cp .env.prod.example .env.prod
   ```

2. Edit `.env.prod` with your production values:
   - Set strong passwords for databases
   - Configure external service URLs
   - Set JWT secret
   - Configure SeaweedFS credentials

3. Build and start services:
   ```bash
   docker-compose -f docker-compose.prod.yml --env-file .env.prod up --build -d
   ```

### Service Endpoints (Production)

Default ports (configurable via .env.prod):

- **Frontend**: http://localhost:3000
- **API Server**: http://localhost:4000
- **PostgreSQL**: localhost:5432
- **Cassandra**: localhost:9042
- **Redis**: localhost:6379

### Production Commands

```bash
# Start services
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart a service
docker-compose -f docker-compose.prod.yml restart api-server

# Scale render workers
docker-compose -f docker-compose.prod.yml up -d --scale render-worker=4

# Stop services
docker-compose -f docker-compose.prod.yml down

# Update and restart (after code changes)
docker-compose -f docker-compose.prod.yml up --build -d
```

### Health Checks

Production services include health checks:

```bash
# Check service health
docker-compose -f docker-compose.prod.yml ps

# Inspect specific service health
docker inspect ecards-api-prod | grep -A 10 Health
```

---

## LLM Configuration (Name Parsing)

### Overview

The E-Cards application uses LLM services for intelligent name parsing. You need to configure at least one provider to enable this feature.

### Quick Start - Development

1. **Get API Keys**

   Choose one or more providers:

   - **OpenAI**: https://platform.openai.com/api-keys
   - **Anthropic**: https://console.anthropic.com/settings/keys
   - **DeepSeek**: https://platform.deepseek.com/api_keys

2. **Configure Environment Variables**

   Edit `docker-compose.dev.yml` or create `.env.dev`:

   ```bash
   # Enable LLM
   LLM_ENABLED=true
   LLM_PRIMARY_PROVIDER=openai
   LLM_FALLBACK_PROVIDER=deepseek

   # OpenAI (Primary)
   OPENAI_API_KEY=sk-proj-YOUR-KEY-HERE
   OPENAI_MODEL=gpt-4o-mini

   # DeepSeek (Fallback)
   DEEPSEEK_API_KEY=sk-YOUR-KEY-HERE
   DEEPSEEK_MODEL=deepseek-chat
   ```

3. **Restart Services**

   ```bash
   docker-compose -f docker-compose.dev.yml restart api-server
   ```

### Production Setup

1. **Copy environment template:**
   ```bash
   cp .env.prod.example .env.prod
   ```

2. **Edit `.env.prod` with your API keys:**
   ```bash
   LLM_ENABLED=true
   LLM_PRIMARY_PROVIDER=anthropic
   LLM_FALLBACK_PROVIDER=openai

   ANTHROPIC_API_KEY_CUSTOM=sk-ant-PRODUCTION-KEY
   ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

   OPENAI_API_KEY=sk-proj-PRODUCTION-KEY
   OPENAI_MODEL=gpt-4o-mini
   ```

3. **Deploy with secrets** (recommended):
   ```bash
   # Using Docker secrets
   echo "sk-ant-PRODUCTION-KEY" | docker secret create anthropic_key -
   echo "sk-proj-PRODUCTION-KEY" | docker secret create openai_key -

   # Update docker-compose to use secrets
   docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
   ```

### Provider Configuration

#### Supported Providers

| Provider | Models Available | Recommended For |
|----------|------------------|-----------------|
| OpenAI | gpt-4o-mini, gpt-4o, gpt-3.5-turbo | General use, high volume |
| Anthropic | claude-3-5-sonnet, claude-3-haiku, claude-3-opus | Complex names, high accuracy |
| DeepSeek | deepseek-chat, deepseek-coder | Cost optimization |
| External | Custom API | Self-hosted models |

#### Environment Variables Reference

**Global Settings:**
```bash
LLM_ENABLED=true                    # Enable/disable LLM feature
LLM_PRIMARY_PROVIDER=openai         # openai | anthropic | deepseek | external
LLM_FALLBACK_PROVIDER=deepseek      # Same options + 'none'
LLM_CREDIT_COST=1                   # Credits per call (flat rate)
LLM_RETRY_ATTEMPTS=2                # Retries per provider
LLM_TIMEOUT_MS=10000                # Timeout in milliseconds
```

**OpenAI:**
```bash
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini            # or gpt-4o, gpt-3.5-turbo
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.3
```

**Anthropic:**
```bash
ANTHROPIC_API_KEY_CUSTOM=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022  # or claude-3-haiku, claude-3-opus
ANTHROPIC_MAX_TOKENS=500
ANTHROPIC_TEMPERATURE=0.3
```

**DeepSeek:**
```bash
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-chat        # or deepseek-coder
DEEPSEEK_MAX_TOKENS=500
DEEPSEEK_TEMPERATURE=0.3
```

**External/Custom:**
```bash
EXTERNAL_LLM_API=https://your-llm-server.com/api
```

### Testing LLM Configuration

After starting services, test the LLM configuration:

```bash
# Check API server logs
docker-compose -f docker-compose.dev.yml logs api-server | grep LLM

# Test name parsing endpoint (when implemented)
curl -X POST http://localhost:7400/api/v1/parse-name \
  -H "Content-Type: application/json" \
  -d '{"fullName": "Juan Carlos López Martínez"}'

# Expected response:
# {
#   "firstName": "Juan Carlos",
#   "lastName": "López",
#   "secondLastName": "Martínez",
#   "confidence": 0.95,
#   "creditsUsed": 1
# }
```

### Troubleshooting LLM Issues

#### API Key Not Working

```bash
# Check if key is set
docker-compose -f docker-compose.dev.yml exec api-server env | grep OPENAI_API_KEY

# Verify key format
# OpenAI: sk-proj-...
# Anthropic: sk-ant-...
# DeepSeek: sk-...
```

#### Provider Timeout

```bash
# Increase timeout
LLM_TIMEOUT_MS=30000  # 30 seconds

# Or switch to faster provider
LLM_PRIMARY_PROVIDER=deepseek  # Faster than GPT-4
```

#### High API Costs

```bash
# Use cheaper models
OPENAI_MODEL=gpt-4o-mini          # Instead of gpt-4o
ANTHROPIC_MODEL=claude-3-haiku     # Instead of claude-3-opus

# Or switch primary provider
LLM_PRIMARY_PROVIDER=deepseek      # Most cost-effective
LLM_FALLBACK_PROVIDER=none
```

#### LLM Not Being Called

```bash
# Check if feature is enabled
LLM_ENABLED=true

# Check user has credits
# Users need llmCredits > 0 in their account

# Check batch import uses LLM
# Request must include: useLLMParsing: true
```

### Security Best Practices

1. **Never commit API keys**
   ```bash
   # Add to .gitignore
   .env
   .env.local
   .env.prod
   .env.*.local
   ```

2. **Use environment variable injection** (production)
   ```bash
   # Use CI/CD secrets
   # GitHub Actions: ${{ secrets.OPENAI_API_KEY }}
   # GitLab CI: $OPENAI_API_KEY (protected variable)
   ```

3. **Rotate keys regularly**
   ```bash
   # Set calendar reminder to rotate every 90 days
   # Generate new key → Update .env.prod → Deploy → Revoke old key
   ```

4. **Monitor API usage**
   ```bash
   # OpenAI: https://platform.openai.com/usage
   # Anthropic: https://console.anthropic.com/settings/usage
   # DeepSeek: https://platform.deepseek.com/usage
   ```

5. **Set billing alerts**
   - Configure spending limits on provider dashboards
   - Set up email notifications for unusual usage patterns

### Cost Optimization Tips

1. **Choose right model for the task:**
   - Name parsing → gpt-4o-mini or deepseek-chat (cheap, fast)
   - Complex parsing → claude-3-sonnet (accurate but expensive)

2. **Use fallback wisely:**
   - Primary: Cheap, fast model (deepseek)
   - Fallback: More reliable but pricier (gpt-4o-mini)

3. **Implement caching** (future):
   - Cache common name patterns
   - Reduce redundant API calls

4. **Per-user limits:**
   - Free tier: 10 LLM credits/month
   - Paid tier: Unlimited or higher limit

---

## Dockerfile Structure

### Development Dockerfiles (*.dev)

- Install dependencies only
- Mount source code as volumes
- Run in watch/dev mode
- Fast iteration

**Files:**
- `front-cards/Dockerfile.dev`
- `api-server/Dockerfile.dev`
- `render-worker/Dockerfile.dev`

### Production Dockerfiles (*.prod)

- Multi-stage builds
- Copy and build source code
- Production optimizations
- Run as non-root users
- Smaller final images

**Files:**
- `front-cards/Dockerfile.prod`
- `api-server/Dockerfile.prod`
- `render-worker/Dockerfile.prod`

---

## Troubleshooting

### Port Already in Use

If ports are already in use, modify the port mappings in the respective docker-compose file.

Development example:
```yaml
ports:
  - "7301:3000"  # Change 7300 to 7301
```

### Rebuild After Dependency Changes

When you modify `package.json`, rebuild the services:

```bash
# Development
docker-compose -f docker-compose.dev.yml up --build

# Production
docker-compose -f docker-compose.prod.yml up --build
```

### Clear Docker Cache

If you encounter build issues:

```bash
# Clear build cache
docker builder prune -f

# Remove all containers and images
docker-compose -f docker-compose.dev.yml down
docker system prune -a
```

### Database Connection Issues

Ensure databases are healthy before application services start:

```bash
# Check database health
docker-compose -f docker-compose.dev.yml ps

# View database logs
docker-compose -f docker-compose.dev.yml logs postgres
docker-compose -f docker-compose.dev.yml logs cassandra
docker-compose -f docker-compose.dev.yml logs redis
```

### Hot Reload Not Working

If changes aren't being detected:

1. Ensure volume mounts are correct in docker-compose.dev.yml
2. Check that node_modules is excluded via volume
3. Restart the specific service:
   ```bash
   docker-compose -f docker-compose.dev.yml restart front-cards
   ```

---

## Best Practices

### Development

- Use `.env` for local overrides
- Keep docker-compose.dev.yml for local development
- Commit docker-compose files, NOT .env files
- Use named volumes for database data

### Production

- Always use `.env.prod` for sensitive values
- Enable HTTPS with reverse proxy (nginx/traefik)
- Use Docker secrets for sensitive data in swarm mode
- Monitor resource usage and scale workers as needed
- Regular database backups
- Use read-only file systems where possible

### Security

- Never commit `.env` or `.env.prod` files
- Use strong passwords in production
- Update base images regularly
- Run containers as non-root users (prod does this)
- Use Docker secrets for credentials in production
- Enable firewall rules to restrict database access

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Network                          │
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐ │
│  │ front-cards │───▶│  api-server  │───▶│ render-worker │ │
│  │  (Next.js)  │    │  (Fastify)   │    │   (BullMQ)    │ │
│  └─────────────┘    └──────────────┘    └───────────────┘ │
│         │                   │                     │         │
│         │                   ▼                     ▼         │
│         │            ┌─────────────┐      ┌──────────────┐ │
│         │            │  PostgreSQL │      │  Cassandra   │ │
│         │            │ (Normalized)│      │ (Canonical)  │ │
│         │            └─────────────┘      └──────────────┘ │
│         │                   │                     │         │
│         │                   ▼─────────────────────▼         │
│         │                 ┌─────────────────────┐          │
│         └────────────────▶│       Redis         │          │
│                           │  (Cache + Queue)    │          │
│                           └─────────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  External Services    │
                    │  - SeaweedFS          │
                    │  - Auth API           │
                    │  - LLM Service        │
                    └───────────────────────┘
```

---

**Last Updated**: 2025-01-14
