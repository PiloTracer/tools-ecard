# E-Cards Feature Development Order

**Version:** 1.0
**Last Updated:** 2025-11-15

---

## Development Sequence

This document defines the optimal order for implementing E-Cards features based on dependencies, risk, and value delivery.

## Phase 1: Foundation (Weeks 1-4)

### Stage 1.1: Infrastructure Setup ✅ COMPLETED
**Duration:** Week 1
**Status:** Done

- [x] Docker Compose configuration
- [x] PostgreSQL, Cassandra, Redis setup
- [x] Environment configuration (.env files)
- [x] Project structure (monorepo)

---

### Stage 1.2: Database Schema & Models
**Duration:** Week 2
**Priority:** **CRITICAL**
**Spec:** `.claude/features/database-setup.md`

**Why First:**
- All features depend on database models
- Schema changes are expensive later
- Enables parallel development of features

**Deliverables:**
- Prisma schema for PostgreSQL (User, Template, Batch, RenderJob)
- Cassandra keyspace and tables (event logging)
- TypeScript type definitions
- Database migrations
- Seed data for development

**Dependencies:** None

**Blockers:** None

---

### Stage 1.3: Auto-Auth (OAuth 2.0 + PKCE)
**Duration:** Weeks 3-4
**Priority:** **CRITICAL**
**Spec:** `.claude/features/auto-auth.md`, `.claude/features/auto-auth.external.md`

**Why Next:**
- All features require authentication
- External system integration takes time to coordinate
- Users can't access app without auth

**Deliverables:**
- Frontend: LandingPage, AuthCallback, useOAuthFlow, useAuth
- Backend: OAuth token exchange, user verification service
- User/UserSession database tables
- Protected route middleware
- Integration with epicdev.com/app (OAuth) and epicdev.com/admin (API)

**Dependencies:**
- Database schema (User, UserSession tables)
- External systems must implement OAuth server and Admin API

**Blockers:**
- Waiting for OAuth client registration from epicdev.com team
- Need API key for Admin API access

---

## Phase 2: Core Template System (Weeks 5-7)

### Stage 2.1: Template Designer
**Duration:** Weeks 5-6
**Priority:** **HIGH**
**Spec:** `.claude/features/template-designer.md`

**Why Next:**
- Users need templates before creating batches
- Most complex UI component - start early
- Independent of batch/rendering logic

**Deliverables:**
- Canvas editor (Fabric.js or Konva.js)
- Text, Image, QR code elements
- Property panels for configuration
- Background image upload to SeaweedFS
- Font management
- Template save/load API
- Auto-fit text configuration UI
- Per-word color rules UI

**Dependencies:**
- Auth (protected routes)
- Database (Template table)
- SeaweedFS client (background upload)

**Blockers:**
- SeaweedFS access credentials needed

---

### Stage 2.2: SeaweedFS Integration
**Duration:** Week 7
**Priority:** **HIGH**
**Spec:** `.claude/features/seaweedfs-integration.md`

**Why Now:**
- Needed by Template Designer (background images)
- Needed by Render Worker (output storage)
- Isolate storage logic before building dependent features

**Deliverables:**
- S3-compatible client setup
- Upload/download/delete operations
- Signed URL generation
- Multi-part upload for large files
- Storage quota tracking

**Dependencies:**
- Auth (user isolation in storage paths)

**Blockers:**
- SeaweedFS endpoint, access key, secret key required

---

## Phase 3: Data Import & Processing (Weeks 8-10)

### Stage 3.1: Batch Import (Data Parsing)
**Duration:** Weeks 8-9
**Priority:** **HIGH**
**Spec:** `.claude/features/batch-import.md`

**Why Next:**
- Users need to create batches to generate cards
- Core value proposition of the app
- LLM integration is complex - start early

**Deliverables:**
- Excel file upload and parsing (xlsx library)
- Text paste parsing with column detection
- Field mapping UI
- Name parser integration (LLM)
- Phone vs extension parsing logic
- Data validation
- Batch creation API

**Dependencies:**
- Auth (user association)
- Database (Batch, CanonicalStaff tables)
- Name Parser service (can be stubbed initially)

**Blockers:**
- LLM API credentials (OpenAI, Anthropic, or DeepSeek)

---

### Stage 3.2: Name Parser Service
**Duration:** Week 10
**Priority:** **MEDIUM**
**Spec:** `.claude/features/name-parser.md`

**Why Now:**
- Required by Batch Import
- LLM integration is isolated - can be built in parallel
- Fallback logic allows batch import to work without it

**Deliverables:**
- LLM provider integrations (OpenAI, Anthropic, DeepSeek)
- Credit check and deduction logic
- Name parsing algorithm (Spanish/Latin American names)
- Fallback to "as-is" when no credits
- Provider failover (primary → fallback)

**Dependencies:**
- Auth (user LLM credits)
- Database (User.rateLimit.llmCredits)

**Blockers:**
- LLM API keys required

---

## Phase 4: Rendering Pipeline (Weeks 11-13)

### Stage 4.1: Render Worker (Core Engine)
**Duration:** Weeks 11-12
**Priority:** **CRITICAL**
**Spec:** `.claude/features/render-worker.md`

**Why Now:**
- Batches are useless without rendering
- Most technically complex component
- Can work in parallel with Batch Management UI

**Deliverables:**
- BullMQ job processor
- Canvas rendering (node-canvas or Puppeteer)
- Auto-fit text algorithm (InDesign replication)
- Multi-color text (first word vs rest)
- Right edge calculation for icon positioning
- Dynamic "In" icon placement
- QR code generation
- PNG/JPG export with DPI settings
- SeaweedFS upload
- Job status updates
- Error handling and retry logic

**Dependencies:**
- Database (RenderJob, Template, CanonicalStaff tables)
- Redis (BullMQ queue)
- SeaweedFS (output storage)

**Blockers:**
- None (can use test templates)

---

### Stage 4.2: C# Logic Porting
**Duration:** Week 13
**Priority:** **HIGH**
**Spec:** `.claude/features/csharp-porting.md`

**Why Now:**
- Render Worker needs layout calculation logic
- InDesign behavior must be preserved exactly
- Unit tests validate correctness

**Deliverables:**
- CalculateLayout function (TypeScript port)
- ValidateString, ToTitleCaseCorrect utilities
- Phone number formatting (Costa Rican format)
- GetEmailClean for file naming
- 100% unit test coverage

**Dependencies:**
- None (pure utility functions)

**Blockers:**
- Access to legacy C# source code

---

## Phase 5: User Experience (Weeks 14-15)

### Stage 5.1: Batch Management UI
**Duration:** Week 14
**Priority:** **MEDIUM**
**Spec:** `.claude/features/batch-management.md`

**Why Now:**
- Users need to view/download rendered cards
- Simple CRUD interface - quick to build
- Works with completed render pipeline

**Deliverables:**
- Batch list view with filters
- Batch detail view with records
- Card preview modal
- Download single card
- Download batch as ZIP
- Regenerate failed cards
- Delete batch
- Real-time progress updates (WebSocket)

**Dependencies:**
- Auth (user batches only)
- Database (Batch, CanonicalStaff, RenderJob tables)
- Render Worker (for regeneration)
- SeaweedFS (for downloads)

**Blockers:**
- None

---

### Stage 5.2: User Profile & Settings
**Duration:** Week 15
**Priority:** **LOW**
**Spec:** `.claude/features/user-profile.md`

**Why Last:**
- Nice-to-have, not core functionality
- Subscription info comes from Admin API (already integrated)
- Simple UI over existing data

**Deliverables:**
- User profile page
- Subscription tier display
- Usage statistics (cards generated, LLM credits)
- Rate limit indicators
- Font library management
- Color palette management

**Dependencies:**
- Auth (current user)
- Database (User table)
- Admin API (subscription data)

**Blockers:**
- None

---

## Phase 6: Polish & Production (Weeks 16-18)

### Stage 6.1: Testing & QA
**Duration:** Week 16
**Priority:** **CRITICAL**
**Spec:** `.claude/features/testing-qa.md`

**Deliverables:**
- Unit tests (80%+ coverage)
- Integration tests (API endpoints)
- E2E tests (critical user flows)
- Performance testing (batch rendering)
- Load testing (concurrent users)
- Security audit

---

### Stage 6.2: WebSocket Real-Time Updates
**Duration:** Week 17
**Priority:** **MEDIUM**
**Spec:** `.claude/features/websocket-updates.md`

**Why Now:**
- Enhances UX but not critical
- Works across multiple features (auth, render progress)

**Deliverables:**
- WebSocket server in api-server
- Subscription status updates (from Admin API)
- Render progress updates (from Render Worker)
- Frontend WebSocket client integration

---

### Stage 6.3: Deployment & Documentation
**Duration:** Week 18
**Priority:** **CRITICAL**

**Deliverables:**
- Production Docker Compose
- Environment configuration (production)
- Deployment guide
- User manual
- API documentation (OpenAPI/Swagger)
- Video tutorials

---

## Feature Dependency Graph

```
Infrastructure Setup (Week 1)
  └─> Database Schema (Week 2)
       ├─> Auto-Auth (Weeks 3-4)
       │    ├─> Template Designer (Weeks 5-6)
       │    │    └─> Batch Import (Weeks 8-9)
       │    │         └─> Render Worker (Weeks 11-12) ──> Batch Management (Week 14)
       │    │              └─> C# Logic Porting (Week 13)
       │    └─> Name Parser (Week 10) ──┘
       └─> SeaweedFS Integration (Week 7) ──┘
            └─> User Profile (Week 15)
                 └─> WebSocket Updates (Week 17)
                      └─> Testing & Deployment (Weeks 16, 18)
```

---

## Critical Path (Longest Dependency Chain)

**18 weeks total:**

1. Infrastructure → Database → Auto-Auth → Template Designer → SeaweedFS → Batch Import → Name Parser → Render Worker → C# Porting → Batch Management → User Profile → Testing → Deployment

**Earliest possible completion: 18 weeks (4.5 months)**

---

## Parallel Development Opportunities

**Weeks 8-10 (3 teams):**
- Team A: Batch Import UI
- Team B: Name Parser service
- Team C: C# Logic Porting (prep for Render Worker)

**Weeks 11-14 (2 teams):**
- Team A: Render Worker
- Team B: Batch Management UI

---

## Risk Mitigation

### High-Risk Items
1. **Render Worker** - Most complex, requires InDesign replication
   - **Mitigation:** Start early, incremental testing, parallel C# porting

2. **External System Integration** - Dependency on epicdev.com teams
   - **Mitigation:** Mock endpoints for development, clear API contracts

3. **LLM Provider Reliability** - API outages, rate limits
   - **Mitigation:** Multi-provider fallback, "as-is" fallback

### External Dependencies
- **epicdev.com/app team**: OAuth server implementation (needed Week 3)
- **epicdev.com/admin team**: Admin API implementation (needed Week 3)
- **SeaweedFS admin**: Access credentials (needed Week 5)
- **LLM providers**: API keys (needed Week 10)

---

## MVP (Minimum Viable Product)

**What's absolutely required for launch:**

✅ **Must Have (MVP):**
1. Auto-Auth (OAuth login)
2. Template Designer (create templates)
3. Batch Import (upload Excel)
4. Render Worker (generate cards)
5. Batch Management (download cards)

❌ **Can Launch Without:**
- Name Parser (use "as-is" fallback)
- User Profile (subscription shown in header)
- WebSocket updates (polling fallback)
- Advanced features (regenerate, ZIP download can be manual)

**MVP Timeline: 12 weeks (3 months)**

---

## Iteration Strategy

### Version 1.0 (MVP) - Week 12
- Basic auth, template creation, batch import, rendering, download

### Version 1.1 - Week 15
- Name Parser, Batch Management enhancements

### Version 1.2 - Week 17
- User Profile, WebSocket updates

### Version 2.0 - Week 18+
- Advanced features, analytics, multi-tenancy improvements

---

## Success Metrics

**Week 6 Checkpoint:**
- [ ] Users can log in via OAuth
- [ ] Users can create basic templates

**Week 10 Checkpoint:**
- [ ] Users can import Excel batches
- [ ] Name parsing works (with fallback)

**Week 14 Checkpoint:**
- [ ] Render worker generates cards
- [ ] Users can download rendered cards

**Week 18 (Production):**
- [ ] All features complete
- [ ] Performance targets met (see CONTEXT.md)
- [ ] Security audit passed

---

## Next Steps

1. **Now → Week 2**: Implement Database Schema
2. **Week 3**: Coordinate with epicdev.com teams on OAuth/Admin API
3. **Week 5**: Obtain SeaweedFS credentials
4. **Week 8**: Secure LLM API keys
5. **Week 12**: MVP deployment to staging
6. **Week 18**: Production launch

---

**Document Owner:** E-Cards Development Team
**Review Schedule:** Weekly during active development

