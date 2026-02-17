"""
Pydantic schemas for the Clinical Triage Pipeline.
Enforces strict typing at the API boundary between LLM output and scheduling logic.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Literal


# ── Request Models ───────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    """A single message in the conversation history."""
    role: Literal["user", "assistant"]
    content: str


class TriageRequest(BaseModel):
    """Incoming patient message with conversation context."""
    symptoms: str
    history: Optional[List[ChatMessage]] = None


# ── LLM Output Models (Internal) ────────────────────────────────────────────

class SymptomCluster(BaseModel):
    """A single identified clinical concern extracted by the LLM."""
    id: str = Field(default="SC-1", description="Unique ID for this cluster, e.g. SC-1, SC-2")
    description: str = Field(..., description="Brief clinical description of the concern")
    reported_symptoms: List[str] = Field(default_factory=list, description="Individual symptoms listed")
    location: Optional[str] = Field(default=None, description="Dental location, e.g. 'UR Q1', 'LL Q3'")
    severity: Literal["Low", "Medium", "High", "Critical"] = "Medium"
    suspected_category: Literal[
        "General", "Endodontic", "Surgical", "Periodontal",
        "Restorative", "Orthodontic", "Pediatric", "Hygiene", "Emergency"
    ] = "General"
    requires_sedation: bool = False


class TriageAnalysis(BaseModel):
    """Complete structured output from the LLM triage analysis."""
    emergency_alert: bool = False
    emergency_message: Optional[str] = None
    clarification_needed: bool = False
    clarification_question: Optional[str] = None
    symptom_clusters: List[SymptomCluster] = Field(default_factory=list)
    patient_sentiment: Literal["Anxious", "Neutral", "Frustrated"] = "Neutral"
    safety_compliant: bool = Field(
        default=True,
        description="LLM self-attestation that no diagnosis was offered"
    )


# ── Response Models (Patient-Facing) ────────────────────────────────────────

class RoutedIssueResponse(BaseModel):
    """A single routed concern in the orchestration plan (patient-safe view)."""
    issue_index: int
    symptom_cluster: str
    urgency: str
    specialist_type: str
    appointment_type: str = "Evaluation"
    requires_sedation: bool = False
    error: Optional[str] = None


class OrchestrationResponse(BaseModel):
    """The full orchestration plan returned to the frontend."""
    is_emergency: bool = False
    overall_urgency: str = "LOW"
    routed_issues: List[RoutedIssueResponse] = Field(default_factory=list)
    suggested_action: str  # ORCHESTRATE, ESCALATE, CLARIFY, GREETING, SMALL_TALK
    combined_visit_possible: bool = False
    patient_sentiment: str = "Neutral"
    message: str = ""
    clarification_questions: List[str] = Field(default_factory=list)
    emergency_slot: Optional[dict] = None
