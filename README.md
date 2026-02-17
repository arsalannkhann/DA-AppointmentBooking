# Bronn AI — Clinical Orchestration Platform

![System Status](https://img.shields.io/badge/System-Enterprise%20Ready-success)
![Routing](https://img.shields.io/badge/Orchestration-Deterministic-blue)
![Compliance](https://img.shields.io/badge/Safety-Guardrails%20Active-brightgreen)

## 1. Executive Summary

**Bronn AI** is a professional-grade clinical intake and orchestration platform designed for multi-tenant dental groups. It transforms opaque patient inquiries into **explainable, deterministic routing recommendations** and optimized appointments.

At its core, Bronn solves the **Resource Intersection Problem**: ensuring that a patient is booked with the right **Specialist**, in a **Room** with the necessary capabilities (Microscope, Surgical Suite), while enforcing complex clinical constraints (IV Sedation, Anesthetist availability).

---

## 2. Core Capabilities

### 🧠 Intelligent Clinical Triage
- **Multi-Issue Extraction**: Analyzes complex symptoms (e.g., "Molar pain + Wisdom swelling") and splits them into distinct clinical concerns.
- **Reasoning Traceability**: Every routing recommendation includes an auditable evidence layer (e.g., "Triggered by: Thermal sensitivity, Night pain").
- **Deterministic Rule Engine**: A tiered priority system (Emergency > Surgical > Endodontic > Restorative) ensures clinical safety over probabilistic AI inference.

### 🗓️ Constraint-Aware Orchestration
- **Resource Sharding**: Enforces room-specific requirements (Room 2 for Endodontics, Room 4 for Surgical).
- **Secondary Resource Locking**: Automatically intersects doctor availability with specialized staff (Anesthetists) for sedation cases.
- **Combo-Visit Optimization**: Orchestrates "Consult + Treatment" blocks (e.g., 135-min slots) into a single patient visit to maximize clinic efficiency.

---

## 3. High-Level System Design

The architecture is built for **resilience and observability**, utilizing a modular 3-tier approach with specialized clinical sub-systems.

```mermaid
graph TD
    %% Node Definitions
    User(("fa:fa-user Patient"))
    UI["fa:fa-desktop Chat Interface<br/>(Next.js 14)"]
    API["fa:fa-gears API Gateway<br/>(FastAPI)"]
    
    subgraph "Orchestration Layer"
        IA["fa:fa-brain Intent Analyzer"]
        RE["fa:fa-vial Rule Engine"]
        Solver["fa:fa-calendar-check Constraint Solver"]
    end
    
    subgraph "Persistence"
        DB[("fa:fa-database PostgreSQL")]
        Redis[("fa:fa-bolt Redis")]
    end
    
    AI(("fa:fa-microchip Google Gemini"))

    %% Flow
    User -->|Symptoms| UI
    UI -->|JSON| API
    API -->|Context| IA
    IA <-->|Parse| AI
    IA -->|Features| RE
    RE -->|Clinical ID| Solver
    Solver -->|Lock| DB
    API <-->|Rate Limit| Redis

    %% Styling
    style User fill:#f9f,stroke:#333,stroke-width:2px
    style UI fill:#bbf,stroke:#333,stroke-width:2px,color:#000
    style API fill:#dfd,stroke:#333,stroke-width:2px,color:#000
    style IA fill:#fff4dd,stroke:#d4a017,stroke-width:2px,color:#000
    style RE fill:#fff4dd,stroke:#d4a017,stroke-width:2px,color:#000
    style Solver fill:#fff4dd,stroke:#d4a017,stroke-width:2px,color:#000
    style DB fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000
    style Redis fill:#ffebee,stroke:#c62828,stroke-width:2px,color:#000
    style AI fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#000
```

---

## 4. Data Architecture (ERD)

The system utilizes a 20-table high-integrity schema designed for strict tenant isolation and atomic resource locking.

```mermaid
erDiagram
    CLINIC ||--|{ ROOM : "contains"
    CLINIC ||--|{ DOCTOR : "includes"
    CLINIC ||--|{ PROCEDURE : "defines"
    CLINIC ||--|{ APPOINTMENT : "manages"
    
    DOCTOR ||--|{ DOCTOR_SPECIALIZATION : "has"
    SPECIALIZATION ||--|{ DOCTOR_SPECIALIZATION : "belongs to"
    
    PATIENT ||--o{ APPOINTMENT : "books"
    
    PROCEDURE }|--o| SPECIALIZATION : "requires"
    
    APPOINTMENT }|--|| DOCTOR : "assigned to"
    APPOINTMENT }|--|| ROOM : "located in"
    APPOINTMENT }|--|| PROCEDURE : "performs"
    APPOINTMENT ||--|{ CALENDAR_SLOT : "locks 15m grid"
```

---

## 4. The Orchestration Pipeline

The backend implements a **5-Layer Clinical Pipeline**:

1.  **AI Extraction Layer**: LLM parses natural language into structured features.
2.  **Deterministic Classification**: Feature-based rules map symptoms to clinical condition keys.
3.  **Procedure Resolution**: Maps condition keys to real clinic procedures, durations, and room requirements.
4.  **Constraint Search**: A high-performance bitmask solver intersects Doctor, Room, and Staff availability.
5.  **Multi-Tier Fallback**: Automatically provides Primary, Alternate, and Palliative options if the preferred slot is unavailable.

---

## 5. Security & Operations

- **Multi-Tenancy**: Data isolation enforced via `tenant_id` sharding at the SQLAlchemy query level.
- **Rate Limiting**: Multi-layer Redis sliding window (IP, User, and LLM-cost protection).
- **Liability Safety**: Language is institutionalized ("Routing Recommendation", "Reserved Evaluation Time") to prevent medical prescription.
- **Auditability**: Complete append-only execution ledger support.

---

## 6. Deployment & Support

### Prerequisites
- **Runtime**: Python 3.12, Node.js 20
- **Store**: PostgreSQL 16, Redis 7
- **AI**: Gemini 2.0 Flash

### Environment Variables
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/bronn_db
GEMINI_API_KEY=your_key_here
REDIS_URL=redis://localhost:6379
```

### Quick Start
```bash
# Backend
cd backend && pip install -r requirements.txt
python -m uvicorn app.main:app

# Frontend
cd frontend && npm install && npm run build
npm run start
```

---

## 7. Quality & Verification

The platform is backed by an **Orchestration Stress Test Suite** (`backend/tests/`) covering 26+ clinical scenarios, including:
- Emergency Escalation (Pulpitis, Trauma)
- Multi-Issue Extraction (Wisdom + Endo)
- Constraint Collision (Sedation without Anesthetist)

**© 2026 Bronn Engineering.**
*Enterprise Medical Orchestration Infrastructure.*
