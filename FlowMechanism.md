# Appointment Booking Flow Mechanism

Here is a detailed breakdown of how the backend processes user input from the first message to generating scheduled appointment options, followed by a Mermaid sequence diagram visualizing the architecture.

## 1. Entry Point: `/analyze` API
When a user sends a message describing their symptoms (e.g., "I have a toothache and I need a cleaning"), the frontend sends a `POST` request to the `/analyze` endpoint in [routers/triage.py](file:///home/ubuntu/bronn-dev/backend/routers/triage.py). This endpoint manages rate limiting and authenticates the tenant/user before starting the orchestration pipeline.

## 2. Intent Analysis ([intent_analyzer.py](file:///home/ubuntu/bronn-dev/backend/core/intent_analyzer.py))
The user's symptoms, along with previous chat history and any structured data fragments, are passed to the **Intent Analyzer**. 
- It uses a structured LLM call to extract specific **Clinical Issues** (e.g., pain severity, swelling, bleeding).
- It identifies the patient's sentiment and determines if there are immediate safety flags or an overall emergency state.

## 3. Clinical Gate Assessment ([clinical_gate.py](file:///home/ubuntu/bronn-dev/backend/core/clinical_gate.py))
Before routing scheduling, the **Clinical Gate** acts as an AI "Doctor". It evaluates the clinical issues extracted by the Intent Analyzer to determine if crucial information is missing.
- If information is missing, the gate generates strict, doctor-like follow-up questions (e.g., "Is the pain sensitive to hot or cold?").
- The system interrupts the flow and returns these clarification questions to the user (`suggested_action = "CLARIFY"`).

## 4. Clinical Rules Classification ([orchestration_engine.py](file:///home/ubuntu/bronn-dev/backend/core/orchestration_engine.py))
If the clinical gate determines the information is complete, the **Orchestration Engine** takes over.
- It applies deterministic **Clinical Rules** ([_classify_condition](file:///home/ubuntu/bronn-dev/backend/core/orchestration_engine.py#200-261)) to map the extracted feature flags (like swelling + wisdom) into a standardized `condition_key` (e.g., `wisdom_extraction`, `root_canal`).
- This guarantees that similar symptom presentations predictably result in the same medical categorization without hallucination.

## 5. Procedure Resolution ([orchestration_engine.py](file:///home/ubuntu/bronn-dev/backend/core/orchestration_engine.py))
The engine maps the generated `condition_key` to a real DB `Procedure` record ([_resolve_procedure](file:///home/ubuntu/bronn-dev/backend/core/orchestration_engine.py#266-293)), taking tenant scoping into account. For instance, `root_canal` might resolve to the "Endodontic Evaluation (Microscope)" procedure, which dictate base duration and anesthetist requirements.

## 6. Constraint-Aware Scheduling ([routing_engine.py](file:///home/ubuntu/bronn-dev/backend/core/routing_engine.py) & [scheduling_engine.py](file:///home/ubuntu/bronn-dev/backend/core/scheduling_engine.py))
For each resolved procedure, the Orchestration Engine calls the **Constraint-Aware Scheduler** ([_find_slots](file:///home/ubuntu/bronn-dev/backend/core/orchestration_engine.py#298-317)).
- It enforces hardware and resource constraints (e.g., does this room have the right equipment? Do we need an anesthetist for sedation?).
- It retrieves ranked slot options based on availability, falling back to alternative providers or modalities if primary options are unavailable.

## 7. Orchestration Combiner
If a user presents multiple issues (e.g., a toothache and a cleaning), the Orchestration Engine tries to combine them. It checks if the suggested slots for different procedures share the same `clinic_id` and overlapping resource availability to offer a **single visit** to the patient.

## 8. Response Delivery
Finally, the [routers/triage.py](file:///home/ubuntu/bronn-dev/backend/routers/triage.py) endpoint packages the [OrchestrationPlan](file:///home/ubuntu/bronn-dev/backend/core/orchestration_engine.py#47-98) into a final response payload containing:
- The suggested action (`ORCHESTRATE`, `CLARIFY`, `ESCALATE`).
- Liability-safe routing language.
- The scheduled slot times and specialist types.

---

> [!NOTE]
> The engine strictly prioritizes explicit constraints and clinical completeness. If a symptom is deemed an emergency at any stage, it entirely bypasses the clinical gate and immediately flags the session for an Emergency Override (`ESCALATE`), locking down an emergency slot if available.

### Architecture Diagram

```mermaid
flowchart TD
    Patient([Patient]) --> |"Symptoms (e.g., 'Tooth hurts')"| API[fa:fa-server /analyze API]
    API --> |"analyze_intent(symptoms, history)"| Analyzer[Intent Analyzer]
    Analyzer --> |"Extracted Clinical Issues & Sentiment"| Orchestrator[Orchestration Engine]
    
    %% Emergency Check
    Orchestrator --> EmergencyCheck{Emergency<br>Override?}
    EmergencyCheck --> |Yes| Bypass[Bypass limits for emergency slots]
    Bypass --> SchedEmerg[Scheduler]
    SchedEmerg -.-> DB[(PostgreSQL)]
    SchedEmerg --> |"Emergency Slot"| APIEmerg[Action: ESCALATE]
    APIEmerg --> |"🚨 EMERGENCY DETECTED"| Patient

    %% Normal Flow
    EmergencyCheck --> |No| Gate{Clinical Gate<br>Missing Info?}
    
    %% Clarification
    Gate --> |Yes| Clarify[Get Validation Questions]
    Clarify --> APIClarify[Action: CLARIFY]
    APIClarify --> |"I need a bit more info: Is there swelling?"| Patient
    
    %% Gate Open
    Gate --> |No (Gate Open)| Loop[[For each Clinical Issue]]
    Loop --> Rules[Clinical Rules Classification<br>_classify_condition]
    Rules --> |"condition_key"| Resolve[Resolve Procedure]
    Resolve -.-> DB
    Resolve --> Scheduler[Constraint-Aware Scheduler<br>_find_slots]
    Scheduler -.-> DB
    Scheduler --> |"Ranked Slots (Primary/Fallback)"| CombineCheck{Multiple<br>Issues?}
    
    CombineCheck --> |Yes| CheckCombos[Check if slots share Clinic/Time]
    CheckCombos --> Plan[Build Orchestration Plan]
    CombineCheck --> |No| Plan
    
    Plan --> APIPlan[Action: ORCHESTRATE]
    APIPlan --> |"Based on symptoms, here are slots..."| Patient
```
