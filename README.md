# Bronn AI — Intelligent Dental Appointment Orchestration System

![System Status](https://img.shields.io/badge/System-Production%20Ready-success)
![Coverage](https://img.shields.io/badge/Triage%20Accuracy-100%25-brightgreen)
![Security](https://img.shields.io/badge/Tenant%20Isolation-Enforced-blue)

## 1. Project Overview

**Bronn AI** is a production-grade, multi-tenant SaaS platform designed to solve the complex "Tetris problem" of dental appointment scheduling. Unlike traditional booking systems that rely on static slots, Bronn utilizes a **deterministic-first AI triage engine** to dynamically analyze patient intent, map it to clinical constraints, and orchestrate optimal appointment slots across multiple resources (doctors, rooms, equipment) in real-time.

### Architectural Philosophy
*   **Deterministic-First Triage:** Hard-coded clinical rules always override LLM inference to ensure patient safety and predictable routing.
*   **Strict Multi-Tenancy:** Data isolation is enforced at the query level using `tenant_id` scoping, preventing cross-clinic leakage.
*   **Resource Intersection:** Slots are only valid if a qualified Doctor, a capable Room, and required Equipment are simultaneously available.
*   **Safety Guardrails:** Automatic detection of emergencies and post-operative complications with priority escalation.

---

## 2. System Architecture & Design

### 2.1 High-Level Architecture
The system follows a modern **Headless SaaS Pattern** with a clean separation between the presentation layer and the orchestration logic.

```mermaid
graph LR
    subgraph "Frontend Layer (Next.js 14)"
        UI[App Router / Client Hooks]
        State[AuthContext / Session]
    end

    subgraph "API Gateway (FastAPI)"
        Routes[API Endpoints]
        MW[Auth & Rate Limit Middlewares]
    end

    subgraph "Orchestration Layer (Core)"
        IA[Intent Analyzer]
        TE[Triage Engine]
        SE[Scheduling Engine]
        RE[Routing Engine]
    end

    subgraph "Persistence & Intelligence"
        DB[(PostgreSQL 16)]
        Cache[(Redis 7)]
        LLM[Gemini 1.5 Flash]
    end

    UI --> Routes
    Routes --> MW
    MW --> IA
    IA --> TE
    TE --> SE
    SE --> RE
    RE --> DB
    SE --> Cache
    IA --> LLM
```

### 2.2 Backend System Design
The backend is designed for high concurrency and strict clinical accuracy. It utilizes a layered approach where each component has a single responsibility.

```mermaid
flowchart TD
    Req[Incoming Request] --> Router{FastAPI Router}
    Router --> Auth[JWT & Tenant Validator]
    Auth --> TriageProc[Triage Pipeline]

    subgraph TriagePipeline [Clinical Triage Pipeline]
        Detect[Emergency Detection] -->|Safe| Intent[Intent Analyzer]
        Intent -->|Deterministic Check| Priority[Rule Engine]
        Priority -->|Fallback| LLMProc[Gemini Inference]
        LLMProc --> Guard[Confidence Guardrail]
    end

    TriageProc --> Map[Procedure Mapper]
    Map --> Solver[Constraint Solver]

    subgraph Solver [Scheduling Constraint Solver]
        Availability[Availability Intersection]
        Availability -->|Intersect| DocMask[Doctor Mask]
        Availability -->|Intersect| RoomMask[Room Mask]
        Availability -->|Intersect| StaffMask[Assistant Mask]
        DocMask & RoomMask & StaffMask --> Slots[Slot Generator]
    end

    Slots --> Out[Best Slot Response]
```

---

## 3. Data Architecture (ERD)

The database schema is designed to support complex resource mapping while maintaining strict tenant isolation.

```mermaid
erDiagram
    CLINIC ||--|{ USER : "has staff"
    CLINIC ||--|{ ROOM : "contains"
    CLINIC ||--|{ DOCTOR : "includes"
    CLINIC ||--|{ PROCEDURE : "defines"
    CLINIC ||--|{ APPOINTMENT : "manages"
    
    DOCTOR }|--|| CLINIC : "belongs to"
    DOCTOR ||--|{ DOCTOR_SPECIALIZATION : "has"
    SPECIALIZATION ||--|{ DOCTOR_SPECIALIZATION : "belongs to"
    
    ROOM }|--|| CLINIC : "belongs to"
    
    PATIENT ||--o{ APPOINTMENT : "books"
    PATIENT ||--|{ PATIENT_SETTINGS : "customizes"
    
    PROCEDURE }|--|| CLINIC : "belongs to"
    PROCEDURE }|--o| SPECIALIZATION : "requires"
    
    APPOINTMENT }|--|| DOCTOR : "assigned to"
    APPOINTMENT }|--|| ROOM : "located in"
    APPOINTMENT }|--|| PROCEDURE : "performs"
    APPOINTMENT ||--|{ CALENDAR_SLOT : "blocks"
    
    CALENDAR_SLOT }|--|| CLINIC : "tenant scoped"
```

---

## 4. Operational Flows

### 4.1 Triage-to-Booking Sequence
This diagram illustrates the journey from a patient's symptom description to a confirmed, locked appointment.

```mermaid
sequenceDiagram
    participant P as Patient
    participant C as Chatbot UI
    participant IA as Intent Analyzer
    participant TE as Triage Engine
    participant SE as Scheduling Engine
    participant DB as DB / Redis

    P->>C: "My tooth hurts badly (9/10)"
    C->>IA: analyze_intent(symptoms)
    IA->>IA: Check Red Flags (Regex)
    Note over IA: Emergency Detected!
    IA-->>C: Urgency: HIGH, Category: EMERGENCY
    
    C->>TE: triage(condition="emergency")
    TE->>DB: Get 'Emergency Triage' procedure & available Doctors
    DB-->>TE: Procedure Data + Doctor List
    TE-->>C: Triage Result (Proc ID, Doctors)
    
    C->>SE: find_slots(procedure, preferred_date)
    SE->>DB: Get resource availability masks
    DB-->>SE: Masks (Doc, Room, Staff)
    SE->>SE: Intersect Masks (AND logic)
    SE-->>C: Valid Slot Options
    
    P->>C: Selects 10:30 AM
    C->>SE: book_appointment(slot)
    SE->>DB: Lock CALENDAR_SLOTS (Atomicity)
    DB-->>SE: Success
    SE-->>P: Confirmation & Instructions
```

---

## 5. Implementation Details

### 5.1 Intent Analysis Pipeline
The logic is implemented in `backend/core/intent_analyzer.py` using a prioritized evaluation loop:
1.  **Safety Net:** Scans for "bleeding", "trauma", "fever". Returns `EMERGENCY` instantly.
2.  **Clinical Phrases:** Matches phrases like "cracked crown" or "wisdom tooth removal" to procedure keys.
3.  **LLM Enhancement:** If no high-confidence match, Gemini 1.5 Flash analyzes context.
4.  **Confidence Gate:** All results < 0.7 confidence trigger a `CLARIFY` action, asking the user specific follow-up questions.

### 5.2 Scheduling Constraint Solver
Located in `backend/core/scheduling_engine.py`, the solver implements a **Bitmask Intersection Algorithm**:
*   Generates boolean masks for Doctors, Rooms, and Equipment in 15-minute increments.
*   Performs a bitwise `AND` across all required resource masks.
*   Finds contiguous blocks of `True` bits matching the procedure duration.
*   Returns slots with a "Quality Score" (prioritizing doctor consistency and minimizing clinic gaps).

---

## 6. Security & Multi-Tenancy

### 6.1 Tenant Isolation
*   **Data Level:** Every table includes a `tenant_id`. Queries use a scoping dependency:
    ```python
    db.query(Appointment).filter(Appointment.clinic_id == tenant_id)
    ```
*   **Access Level:** JWT tokens are signed with the `tenant_id` claim. Accessing data from another tenant returns `403 Forbidden`.

### 6.2 Rate Limiting
*   **Redis-Backed:** Sliding window implementation for per-IP and per-User limits.
*   **LLM Protection:** Chatbot endpoint restricted to 10 messages/minute per tenant to prevent cost spikes.

---

## 7. Deployment & Operations

### Prerequisites
*   **Runtime:** Python 3.12, Node.js 20
*   **Storage:** PostgreSQL 16 (with UUID-OSSP), Redis 7
*   **AI:** Google Cloud Gemini API key

### Production Recommendations
*   **Scaling:** Use `uvicorn --workers N` to leverage multiple cores.
*   **DBSession:** Ensure `autocommit=False` for transactional integrity during slot locking.
*   **Async:** All external AI calls should be made using `httpx.AsyncClient`.

---

## 8. Development Team & Credits

**Project Owner:** Bronn Engineering
**Lead Engineer:** [Author Name / Lead Developer]
**Technical Contact:** [Support/Contact Email]

**© 2026 Bronn Engineering.**
*This system is proprietary and designed for clinical orchestration.*

---

## 8. Orchestration Constraints

The Scheduler solves for $x$ where:
$$x \in (\text{DoctorAvailability} \cap \text{RoomAvailability} \cap \text{EquipmentAvailability})$$

**Constraint Rules:**
1.  **Specialist Enforcement:** A `Root Canal` procedure *must* be booked with a doctor having the `Enodondist` specialization.
2.  **Room Capabilities:** An `Extraction` requiring `Sedation` *must* be booked in a room with `{"sedation_capable": true}`.
3.  **Duration Padding:** All appointments include hidden `cleanup_time` (defined in `procedures`) to prevent run-over.
4.  **Sequential Integrity:** Combo procedures (e.g., Exam + Cleaning) are scheduled back-to-back with the *same* room but potentially different providers (Hygienist then Dentist).

---

## 9. Rate Limiting & Cost Protection

Implemented via `backend/core/rate_limit.py` using Redis.

*   **Unauthenticated:** 5 requests / minute (IP-based).
*   **Authenticated:** 30 requests / minute (User-based).
*   **Chatbot:** 10 messages / minute (Strict limit to prevent LLM token abuse).

**Handling:** Returns `429 Too Many Requests` with `Retry-After` header.

---

## 10. Testing Strategy

The system is validated by a rigorous **Orchestration Stress Test Suite** (`backend/tests/test_orchestration_stress.py`).

### Stress Test Coverage
*   **26 Clinical Scenarios:**
    *   Basic Triage (Pain → General Checkup)
    *   Complex Routing (Wisdom Tooth → Oral Surgeon)
    *   Emergency Detection (10/10 Pain → Emergency Slot)
    *   Edge Cases ("My tooth feels weird" → Clarify)
*   **Isolation Integrity:** Verifies Tenant A cannot see Tenant B's appointments.
*   **Performance:** Validates <200ms response time for slot generation.

**Target:** >95% Accuracy. (Current Status: **100%**)

---

## 11. Deployment Guide

### Prerequisites
*   Docker & Docker Compose
*   Python 3.12+
*   Node.js 20+

### Environment Variables
Create a `.env` file:
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/bronn_db
SECRET_KEY=your_production_secret
GEMINI_API_KEY=your_google_ai_key
REDIS_URL=redis://localhost:6379
```

### Running Locally
1.  **Start Services:**
    ```bash
    docker-compose up -d db redis
    ```
2.  **Backend:**
    ```bash
    cd backend
    source venv/bin/activate
    python -m uvicorn main:app --reload
    ```
3.  **Frontend:**
    ```bash
    cd src
    npm install
    npm run dev
    ```

---

## 12. Scalability Considerations

*   **Stateless Backend:** FastAPI workers can be scaled horizontally behind a load balancer (NGINX/AWS ALB).
*   **Read Replicas:** Database queries are separated into Read (`Session`) and Write operations, allowing future read-replica implementation.
*   **Async Processing:** Making AI calls and Slot generation async prevents blocking the main thread during heavy load.

---

## 13. Safety & Clinical Guardrails

*   **Visual Confirmation:** The system matches intent to a *standardized clinical term* (e.g., "Upper Right Molar Pain" → "Limited Exam - Problem Focused") before booking.
*   **Override Rules:**
    *   "Bleeding after extraction" is **ALWAYS** an emergency, overriding any availability blocks.
    *   Sedation requests **ALWAYS** filter for specialized rooms.

---

## 14. Future Improvements

*   **Structured Feature Extraction:** Move beyond Regex to clinical entity extraction (e.g., extracting "Tooth #3" and "Duration: 3 days").
*   **Priority Weighted Rules:** Replace list-based keyword priorities with a numeric weight system for more nuanced routing.
*   **Load Balancing:** Smartly route generic checkups to the least-busy doctor to optimize clinic utilization.
*   **Analytics Dashboard:** Visualizing conversion rates (Chat → Booked Appointment) and "Loss Reasons" (e.g., "No slot available").

---

**© 2026 Arsalan Khan.** All Rights Reserved.
