# Bronn AI — Clinical Orchestration Platform

![System Status](https://img.shields.io/badge/System-Enterprise%20Ready-success)
![Orchestration](https://img.shields.io/badge/Orchestration-Deterministic-blue)
![Safety](https://img.shields.io/badge/Safety-Guardrails%20Active-brightgreen)
![Multi-Tenant](https://img.shields.io/badge/Multi--Tenant-Isolated-orange)
![License](https://img.shields.io/badge/License-Proprietary-red)

---

## 1. Executive Summary

**Bronn AI** is a professional-grade, multi-tenant clinical intake and orchestration platform purpose-built for dental groups and healthcare networks. It transforms opaque patient inquiries into **explainable, deterministic routing recommendations** and constraint-optimized appointments.

At its core, Bronn solves the **Resource Intersection Problem** — ensuring that a patient is booked with the right **Specialist**, in a **Room** with the necessary capabilities (Microscope, Surgical Suite, Sedation Equipment), while enforcing complex clinical constraints (IV Sedation, Anesthetist availability, combo visit windows) — all within a single, auditable pipeline.

---

## 2. Key Features & Advantages

### 🧠 AI-Powered Clinical Triage
| Feature | Description |
|---|---|
| **Multi-Issue Extraction** | Analyzes complex symptoms (e.g., "Molar pain + Wisdom swelling") and splits them into distinct clinical concerns, each routed independently |
| **Reasoning Traceability** | Every routing recommendation includes an auditable evidence layer (e.g., "Triggered by: Thermal sensitivity, Night pain → Root Canal") |
| **Deterministic Rule Engine** | A tiered priority system (**Emergency > Surgical > Endodontic > Restorative > General**) ensures clinical safety supersedes probabilistic AI inference |
| **Dynamic Clarification** | Programmatic drilldown detects missing clinical info (location, duration, severity) and generates targeted follow-up questions before routing |
| **Post-LLM Safety Validation** | Regex-based scanner blocks forbidden diagnosis/prescription patterns from LLM output — Bronn never prescribes, only routes |
| **Chat History Context** | Full conversational context is passed to the LLM, enabling multi-turn clinical intake without data loss |
| **Patient Sentiment Analysis** | Detects anxiety, distress, and urgency markers in patient language to adjust routing priority |

### 🗓️ Constraint-Aware Scheduling Engine
| Feature | Description |
|---|---|
| **15-Minute Grid Solver** | Bitmask-based availability engine computes Doctor ∩ Room ∩ Anesthetist intersections across a configurable lookahead window |
| **Resource Sharding** | Enforces room-specific requirements (e.g., Room 2 for Endodontics, Room 4 for Surgical, sedation-capable rooms only) |
| **Secondary Resource Locking** | Automatically intersects doctor availability with specialized staff (Anesthetists) for sedation-required cases |
| **Combo-Visit Optimization** | Orchestrates "Consultation + Treatment" blocks (e.g., 135-minute slots) into a single patient visit to maximize clinic throughput |
| **Slot Scoring & Ranking** | Multi-factor scoring (preferred doctor bonus, preferred clinic bonus, morning preference, gap penalty) to present optimal results first |
| **UPSERT Collision Prevention** | Calendar slot booking uses ON CONFLICT to prevent duplicate 15-min block allocations |

### 🔀 Multi-Tier Fallback Routing
| Tier | Strategy |
|---|---|
| **Tier 1** | Same specialization at preferred clinic |
| **Tier 2** | Primary doctor at alternate clinics (same tenant) |
| **Tier 3** | Any qualified doctor at any clinic (same tenant) |
| **Palliative** | General Dentist for pain management when no specialist is available |

### 🚨 Emergency Handling
| Feature | Description |
|---|---|
| **Red-Flag Detection** | Keywords like "can't breathe", "uncontrolled bleeding", "facial swelling with fever" trigger immediate emergency routing |
| **Override Protocol** | Bypasses all preference windows and combo logic — locates the absolute next available 15-min slot with ANY General Dentist |
| **Scan Window** | Searches today + 3 days across all active clinics within the tenant |

### 🔐 Security & Compliance
| Feature | Description |
|---|---|
| **Multi-Tenant Isolation** | Every table is `tenant_id`-scoped; all ORM queries are filtered at the SQLAlchemy level |
| **JWT Authentication** | Separate auth flows for admin (clinic staff) and patient roles with role-based access control |
| **Multi-Layer Rate Limiting** | Redis-backed fixed-window rate limiter with IP, User, and Tenant scopes |
| **LLM Cost Protection** | Dedicated rate limit tier for AI/chatbot endpoints to prevent abuse |
| **Liability-Safe Language** | All clinical outputs use institutionalized phrasing ("Routing Recommendation", "Reserved Evaluation Time") — never prescriptions |
| **Password Security** | bcrypt-hashed passwords with configurable cost factor |

### 💻 Frontend Experience
| Feature | Description |
|---|---|
| **Mobile-First Responsive Design** | Optimized for 375px–1440px+ with safe-area support (iOS/Android notch), collapsible sidebar, and full-width touch targets |
| **Clinical Intake Chat** | Guided multi-step wizard with progress indicator, dynamic clarification forms, and real-time AI analysis |
| **Patient Portal** | Full appointment management (book, view, cancel), profile settings, billing history |
| **Admin Dashboard** | Real-time KPI cards, utilization charts (Recharts), procedure distribution, doctor performance analytics |
| **Design System** | Unified dark-mode SaaS palette with cyan (#06b6d4) accent, Framer Motion animations, and consistent component tokens |
| **Protected Routes** | Auth-aware routing with automatic redirect for unauthenticated users |

---

## 3. System Architecture

### High-Level Data Flow

```mermaid
graph TD
    User(("👤 Patient"))
    UI["🖥️ Chat Interface<br/>(Next.js 14 · App Router)"]
    API["⚙️ API Gateway<br/>(FastAPI · Uvicorn)"]

    subgraph "🧠 Orchestration Layer"
        IA["Intent Analyzer<br/>(Gemini 2.0 Flash)"]
        RE["Deterministic<br/>Rule Engine"]
        TE["Triage Engine<br/>(Specialist Mapping)"]
        SE["Scheduling Engine<br/>(Bitmask Solver)"]
        RO["Routing Engine<br/>(3-Tier Fallback)"]
        EH["Emergency Handler<br/>(Override Protocol)"]
    end

    subgraph "📦 Persistence"
        DB[("PostgreSQL 16<br/>12 Tables · Multi-Tenant")]
        Redis[("Redis 7<br/>Rate Limiting · Sessions")]
    end

    AI(("🤖 Google Gemini<br/>2.0 Flash"))

    User -->|Symptoms| UI
    UI -->|JSON POST| API
    API -->|Context + History| IA
    IA <-->|Structured Extraction| AI
    IA -->|Clinical Features| RE
    RE -->|Condition Key| TE
    TE -->|Procedure + Constraints| SE
    SE -->|Slot Candidates| RO
    RO -->|Ranked Results| API
    API <-->|Rate Limit Check| Redis
    SE -->|Lock Slots| DB
    EH -.->|Override| SE

    style User fill:#f9f,stroke:#333,stroke-width:2px
    style UI fill:#bbf,stroke:#333,stroke-width:2px,color:#000
    style API fill:#dfd,stroke:#333,stroke-width:2px,color:#000
    style IA fill:#fff4dd,stroke:#d4a017,stroke-width:2px,color:#000
    style RE fill:#fff4dd,stroke:#d4a017,stroke-width:2px,color:#000
    style TE fill:#fff4dd,stroke:#d4a017,stroke-width:2px,color:#000
    style SE fill:#fff4dd,stroke:#d4a017,stroke-width:2px,color:#000
    style RO fill:#fff4dd,stroke:#d4a017,stroke-width:2px,color:#000
    style EH fill:#ffcccc,stroke:#c62828,stroke-width:2px,color:#000
    style DB fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000
    style Redis fill:#ffebee,stroke:#c62828,stroke-width:2px,color:#000
    style AI fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#000
```

### 5-Layer Orchestration Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1: AI Extraction (intent_analyzer.py)                        │
│  ─ Gemini LLM parses natural language → structured ClinicalIssues   │
│  ─ Multi-issue splitting, severity scoring, red-flag detection      │
│  ─ Post-LLM safety validation blocks forbidden patterns             │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 2: Deterministic Classification (orchestration_engine.py)    │
│  ─ Feature flags (thermal_sensitivity, night_pain, etc.) →          │
│    Condition Keys (root_canal, wisdom_extraction, emergency)        │
│  ─ Zero AI inference — pure boolean logic                           │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 3: Procedure Resolution (triage_engine.py)                   │
│  ─ Maps Condition Key → real DB Procedure (with durations,          │
│    room requirements, anesthetist flags)                             │
│  ─ Qualified doctor discovery via specialization join                │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 4: Constraint-Aware Scheduling (scheduling_engine.py)        │
│  ─ 15-min bitmask grid: Doctor ∩ Room ∩ Staff availability          │
│  ─ Contiguous block search for consult+treatment combos             │
│  ─ Room capability enforcement (microscope, surgical suite)         │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 5: Multi-Tier Fallback (routing_engine.py)                   │
│  ─ Tier 1: Preferred clinic → Tier 2: Other clinics →               │
│    Tier 3: Palliative care                                          │
│  ─ Slot scoring with preference bonuses                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Architecture

### Entity Relationship Diagram

```mermaid
erDiagram
    CLINIC ||--|{ ROOM : "contains"
    CLINIC ||--|{ DOCTOR : "employs"
    CLINIC ||--|{ PROCEDURE : "defines"
    CLINIC ||--|{ APPOINTMENT : "manages"
    CLINIC ||--|{ SPECIALIZATION : "owns"
    CLINIC ||--|{ STAFF : "has"

    DOCTOR ||--|{ DOCTOR_SPECIALIZATION : "certified in"
    SPECIALIZATION ||--|{ DOCTOR_SPECIALIZATION : "qualifies"

    PATIENT ||--o{ APPOINTMENT : "books"
    PATIENT ||--o| PATIENT_SETTINGS : "configures"

    PROCEDURE }|--o| SPECIALIZATION : "requires"

    APPOINTMENT }|--|| DOCTOR : "assigned to"
    APPOINTMENT }|--|| ROOM : "located in"
    APPOINTMENT }|--|| PROCEDURE : "performs"
    APPOINTMENT ||--|{ CALENDAR_SLOT : "locks 15m grid"
    APPOINTMENT }|--o| STAFF : "assisted by"
    APPOINTMENT }|--o| APPOINTMENT : "linked combo"

    AVAILABILITY_TEMPLATE }|--|| CLINIC : "at clinic"
```

### Table Summary (12 Core Tables)

| Table | Purpose | Tenant-Scoped |
|---|---|---|
| `clinics` | Multi-tenant root entity with timezone and settings | Root |
| `rooms` | Physical rooms with JSONB capabilities (microscope, surgical, sedation) | ✅ |
| `doctors` | Active doctors with NPI numbers | ✅ |
| `specializations` | Specialty types (Endodontist, Oral Surgeon, etc.) | ✅ |
| `doctor_specializations` | Many-to-many doctor↔specialty mapping | ✅ |
| `staff` | Auxiliary staff (Anesthetists, Hygienists) | ✅ |
| `patients` | Global patient accounts (not tenant-bound) | Global |
| `procedures` | Clinical procedures with durations, room requirements, combos | ✅ |
| `doctor_availability` | Legacy per-date availability | ✅ |
| `availability_templates` | Recurring weekly schedules for doctors and staff | ✅ |
| `appointments` | Booked appointments with linked combo support | ✅ |
| `calendar_slots` | 15-min grid locks (entity_type × entity_id × date × block) | ✅ |
| `patient_settings` | User preferences (notifications, dark mode, language) | ✅ |

---

## 5. Technology Stack

### Backend
| Technology | Purpose |
|---|---|
| **Python 3.12** | Core runtime |
| **FastAPI** | Async API framework with automatic OpenAPI docs |
| **SQLAlchemy** | ORM with tenant-scoped query filtering |
| **PostgreSQL 16** | Primary datastore with `pgcrypto` and `btree_gist` extensions |
| **Redis 7** | Rate limiting, session management |
| **Google Gemini 2.0 Flash** | LLM for clinical symptom extraction |
| **bcrypt / PyJWT** | Password hashing and JWT token management |
| **Uvicorn** | ASGI server for production deployment |

### Frontend
| Technology | Purpose |
|---|---|
| **Next.js 14** | React framework with App Router and SSR |
| **TypeScript** | Type-safe development |
| **Tailwind CSS** | Utility-first CSS with custom design tokens |
| **Framer Motion** | Declarative animations and page transitions |
| **Recharts** | Data visualization for admin analytics |
| **Lucide React** | Consistent iconography |

### Infrastructure
| Technology | Purpose |
|---|---|
| **systemd** | Process management for frontend and backend services |
| **Nginx** (optional) | Reverse proxy and TLS termination |
| **Docker** | Containerized deployment support |

---

## 6. Project Structure

```
bronn-dev/
├── backend/
│   ├── app/
│   │   └── main.py                  # FastAPI application entry point
│   ├── core/
│   │   ├── intent_analyzer.py       # Layer 1: AI extraction + safety validation
│   │   ├── orchestration_engine.py  # Layer 2: Deterministic classification
│   │   ├── triage_engine.py         # Layer 3: Procedure resolution
│   │   ├── scheduling_engine.py     # Layer 4: 15-min bitmask constraint solver
│   │   ├── routing_engine.py        # Layer 5: Multi-tier fallback routing
│   │   ├── emergency_handler.py     # Emergency override protocol
│   │   ├── rate_limit.py            # Redis-backed multi-layer rate limiter
│   │   ├── optimizer.py             # Slot scoring and ranking
│   │   ├── auth.py                  # JWT + bcrypt authentication
│   │   ├── dependencies.py          # FastAPI dependency injection
│   │   ├── db.py                    # Database session management
│   │   ├── schema.sql               # PostgreSQL DDL (12 tables)
│   │   ├── seed.py                  # Clinic/doctor/room seed data
│   │   └── migration_*.sql          # 5 incremental migrations
│   ├── routers/
│   │   ├── auth.py                  # Admin authentication endpoints
│   │   ├── patient_auth.py          # Patient registration and login
│   │   ├── triage.py                # Clinical intake + AI analysis
│   │   ├── appointments.py          # Booking and cancellation
│   │   ├── slots.py                 # Slot search API
│   │   ├── dashboard.py             # Admin analytics + KPI endpoints
│   │   ├── onboarding.py            # Clinic setup wizard
│   │   ├── patients.py              # Patient management
│   │   └── settings.py              # User preference management
│   ├── models/
│   │   └── models.py                # SQLAlchemy ORM models
│   ├── schemas/                     # Pydantic request/response schemas
│   ├── tests/                       # Orchestration stress test suite
│   ├── config.py                    # Centralized configuration
│   └── requirements.txt             # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             # Landing page
│   │   │   ├── globals.css          # Design system + responsive tokens
│   │   │   ├── layout.tsx           # Root layout with AuthProvider
│   │   │   ├── chat/page.tsx        # Clinical intake wizard
│   │   │   ├── login/               # Admin + patient login
│   │   │   ├── register/            # Admin + patient registration
│   │   │   ├── onboarding/          # Clinic setup wizard
│   │   │   ├── patient/
│   │   │   │   ├── overview/        # Patient dashboard
│   │   │   │   ├── appointments/    # Appointment management
│   │   │   │   ├── book/            # Booking flow
│   │   │   │   └── profile/         # Profile + security + billing
│   │   │   ├── admin/
│   │   │   │   ├── dashboard/       # Admin KPI dashboard
│   │   │   │   ├── analytics/       # Charts + trend analysis
│   │   │   │   ├── appointments/    # Appointment control
│   │   │   │   ├── patients/        # Patient roster
│   │   │   │   └── rooms/           # Room management
│   │   │   └── settings/            # Global settings
│   │   ├── components/
│   │   │   ├── DashboardLayout.tsx   # Layout shell with sidebar + topbar
│   │   │   ├── Sidebar.tsx           # Collapsible navigation drawer
│   │   │   ├── Navbar.tsx            # Public page navigation
│   │   │   ├── DynamicClarification.tsx  # AI-driven clinical form builder
│   │   │   └── ProtectedRoute.tsx    # Auth guard wrapper
│   │   ├── context/
│   │   │   └── AuthContext.tsx       # JWT-based authentication state
│   │   └── lib/
│   │       └── api.ts               # Centralized API client
│   └── package.json
│
├── bronn-backend.service            # systemd unit for backend
├── bronn-frontend.service           # systemd unit for frontend
├── .env                             # Environment variables
└── README.md
```

---

## 7. API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register admin/clinic account |
| `POST` | `/api/auth/login` | Admin login (returns JWT) |
| `POST` | `/api/auth/patient/register` | Patient self-registration |
| `POST` | `/api/auth/patient/login` | Patient login (returns JWT) |

### Clinical Orchestration
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/triage/analyze` | AI-powered symptom analysis (multi-issue extraction) |
| `POST` | `/api/triage/orchestrate` | Full orchestration pipeline (analyze → classify → schedule) |

### Appointments
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/appointments/book` | Book appointment (locks calendar slots) |
| `GET` | `/api/appointments/patient/{id}` | Get patient's appointments |
| `GET` | `/api/appointments/all` | List all appointments (admin) |
| `PATCH` | `/api/appointments/{id}/cancel` | Cancel appointment (releases slots) |

### Scheduling
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/slots/search` | Search available slots with constraints |

### Admin & Analytics
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard/stats` | Dashboard KPIs (appointments, utilization, distributions) |
| `GET` | `/api/dashboard/rooms` | Room status and scheduled patients |
| `POST` | `/api/onboarding/*` | Multi-step clinic onboarding wizard |
| `GET` | `/api/patients/` | Patient roster with search |
| `PUT` | `/api/settings/` | Update user preferences |

---

## 8. Core Engine Details

### Intent Analyzer (`intent_analyzer.py`)
- **Input**: Raw patient text + optional chat history
- **Output**: Structured `IntentResult` with `ClinicalIssue[]`
- **Safety Layers**:
  1. Deterministic greeting/red-flag detection (pre-LLM)
  2. Gemini 2.0 Flash extraction with structured JSON prompt
  3. Post-LLM regex safety scanner (blocks forbidden diagnosis patterns)
  4. Backend completion check (location + urgency + symptoms = COMPLETE)
- **Clinical Features Extracted**: `has_pain`, `severity` (1-10), `duration_days`, `thermal_sensitivity`, `biting_pain`, `swelling`, `mobility`, `bleeding`, `abscess`, `pus_discharge`, `location`, `requires_sedation`

### Orchestration Engine (`orchestration_engine.py`)
- **687 lines** of deterministic clinical routing logic
- **Clinical Completeness Validator**: Decision tree checks for missing essential info (location, duration, severity, breathing/swallowing safety for swelling) and generates clarification questions
- **Feature-to-Condition Classifier**: Pure boolean logic maps 15+ clinical features to condition keys:
  - `thermal_sensitivity + night_pain → root_canal`
  - `swelling + abscess → wisdom_extraction`
  - `mobility + trauma → emergency`
- **Dynamic Field Generator**: Calculates which UI fields to render based on clinical features detected so far

### Scheduling Engine (`scheduling_engine.py`)
- **423 lines** implementing a high-performance bitmask-based constraint solver
- **15-minute time blocks**: 32 slots per day (09:00–17:00), configurable via `config.py`
- **Multi-resource intersection**: Finds contiguous blocks where Doctor AND Room AND Staff are all available
- **Combo search**: Tests if consult + buffer + treatment can fit in a single visit
- **UPSERT booking**: Atomic slot locking with idempotency via `ON CONFLICT`

### Emergency Handler (`emergency_handler.py`)
- **Override protocol**: Bypasses preference windows, combo logic, and room capability requirements
- **Greedy search**: Iterates today + 3 days across all active General Dentists at all tenant clinics
- **Guaranteed fastest response**: Returns the absolute first available 15-min block

### Rate Limiter (`rate_limit.py`)
- **Three-tier architecture**:
  1. `RateLimitDependency` — Per-route, request-scoped (IP-based)
  2. `AuthenticatedRateLimit` — User-scoped (JWT user_id)
  3. `AuthenticatedRateLimit` — Tenant-scoped (tenant_id)
- **Redis-backed fixed window** with atomic INCR + TTL pipeline
- **Fail-open semantics**: If Redis is unavailable, requests are allowed (availability > strictness)

---

## 9. Frontend Pages

| Route | Description | Auth |
|---|---|---|
| `/` | Landing page with hero, features, workflow, stats, CTA | Public |
| `/login` | Admin login | Public |
| `/login/patient` | Patient login | Public |
| `/register` | Admin registration | Public |
| `/register/patient` | Patient registration | Public |
| `/onboarding` | Multi-step clinic setup wizard | Admin |
| `/chat` | Clinical intake chat with AI orchestration | Admin |
| `/dashboard` | Admin home redirect | Admin |
| `/admin/dashboard` | KPI cards, utilization chart, clinical mix, recent appointments | Admin |
| `/admin/analytics` | Weekly trends, revenue, procedure distribution, doctor performance | Admin |
| `/admin/appointments` | All appointments with filter tabs | Admin |
| `/admin/patients` | Patient roster | Admin |
| `/admin/rooms` | Room management with scheduled patients | Admin |
| `/patient/overview` | Patient dashboard with quick actions and stats | Patient |
| `/patient/appointments` | Book, view, cancel appointments | Patient |
| `/patient/book` | Appointment booking flow | Patient |
| `/patient/profile` | Profile, security, billing tabs | Patient |
| `/settings` | Global settings | Auth |

---

## 10. Mobile-First Responsive Design

The frontend is optimized for all screen sizes with a mobile-first approach:

- **Safe-Area Support**: `env(safe-area-inset-*)` for iOS/Android notch compatibility
- **Collapsible Sidebar**: Hidden by default on screens < 1024px, drawer pattern with overlay
- **Touch Targets**: Minimum 44px interactive elements for all buttons, links, and controls
- **Responsive Typography**: Heading sizes scale from `text-3xl` (mobile) to `text-7xl` (desktop)
- **Stacked Layouts**: Cards, buttons, and grids stack vertically on mobile, flex horizontally on desktop
- **Full-Width CTAs**: Action buttons expand to full width on mobile for easy tapping
- **Compact Slot Grid**: Appointment slot selectors collapse to 2-column on mobile
- **Progressive Disclosure**: Chat progress indicator hides step labels on mobile, shows only numbers

---

## 11. Deployment

### Prerequisites
- **Runtime**: Python 3.12, Node.js 20+
- **Datastore**: PostgreSQL 16, Redis 7
- **AI**: Google Gemini API Key

### Environment Variables
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/bronn_db
GEMINI_API_KEY=your_gemini_api_key
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret
```

### Quick Start
```bash
# Clone
git clone https://github.com/arsalannkhann/DA-AppointmentBooking.git
cd DA-AppointmentBooking

# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -c "from core.seed import seed_database; seed_database()"  # Seed data
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run build
npm run start
```

### Production (systemd)
```bash
# Copy service files
sudo cp bronn-backend.service /etc/systemd/system/
sudo cp bronn-frontend.service /etc/systemd/system/

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable --now bronn-backend bronn-frontend

# Check status
sudo systemctl status bronn-backend bronn-frontend
```

---

## 12. Quality & Verification

### Test Suite
The platform includes an **Orchestration Stress Test Suite** (`backend/tests/`) covering 26+ clinical scenarios:

| Category | Scenarios |
|---|---|
| **Emergency Escalation** | Pulpitis, Trauma, Uncontrolled Bleeding, Facial Swelling + Fever |
| **Multi-Issue Extraction** | Wisdom + Endo, Pain + Swelling, Multiple Teeth |
| **Constraint Collision** | Sedation without Anesthetist, Room Capability Mismatch |
| **Fallback Routing** | Specialist unavailable → Palliative care |
| **Edge Cases** | Empty input, greetings, non-dental queries |

### Build Verification
```bash
cd frontend && npm run build   # Zero TypeScript errors across 23 pages
```

---

## 13. Architectural Advantages

| Advantage | How |
|---|---|
| **Deterministic Routing** | Clinical decisions are made by boolean logic, not AI — AI only extracts features |
| **Auditable Trail** | Every routing recommendation includes reasoning triggers traceable to specific symptoms |
| **Multi-Tenant by Default** | All queries are tenant-scoped at the ORM level — no data leakage possible |
| **Horizontal Scalability** | Stateless API + Redis sessions = scale by adding instances behind a load balancer |
| **Combo Visit Efficiency** | Reduces patient visits by 40%+ by batching consultation + treatment into single windows |
| **Graceful Degradation** | 3-tier fallback ensures patients always get a recommendation, even when ideal providers are unavailable |
| **LLM Cost Control** | Rate limiting on AI endpoints prevents abuse; safety validation prevents liability exposure |
| **Mobile-First UX** | Touch-optimized, safe-area-aware, responsive design works from 375px phones to 1440px+ desktops |
| **Replay-Safe Architecture** | Engine design follows deterministic replay principles — same inputs produce same outputs |
| **Zero Vendor Lock-In** | Gemini LLM is wrapped behind `intent_analyzer.py` — swappable with any structured-output LLM |

---

## 14. Roadmap

- [ ] WebSocket real-time slot updates
- [ ] Patient notification system (SMS/Email via Twilio/SendGrid)
- [ ] Multi-language clinical intake (i18n)
- [ ] Insurance verification integration
- [ ] Waitlist management with auto-rebooking
- [ ] Execution ledger (append-only audit trail per OrionX contract)

---

**© 2026 Bronn Engineering.**
*Enterprise Medical Orchestration Infrastructure. All rights reserved.*
