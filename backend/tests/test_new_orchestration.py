import pytest
from unittest.mock import patch, MagicMock
from app.main import app
from fastapi.testclient import TestClient
from core.auth import create_access_token

# Mock Rate Limiter to fail open
@pytest.fixture(scope="module")
def client():
    with patch("core.rate_limit.RateLimiter.is_allowed", return_value=(True, 0, 0)):
        with TestClient(app) as c:
            yield c

@pytest.fixture(scope="module")
def headers():
    token = create_access_token(
        user_id="e566effc-9bad-4d19-9bd2-459184763e63",
        tenant_id=None,
        role="patient"
    )
    return {"Authorization": f"Bearer {token}"}


def test_multi_condition_orchestration(client, headers):
    """
    Test that multiple distinct symptoms are routed separately
    with the correct specialist types.
    """
    with patch("core.intent_analyzer._llm_analyze") as mock_llm:
        from core.intent_analyzer import IntentResult, ClinicalIssue

        issues = [
            ClinicalIssue(
                symptom_cluster="upper right tooth severe night pain for 3 days",
                suspected_category="Endodontic",
                urgency="HIGH",
                reasoning="Night pain indicates pulpal involvement",
                location="UR Q1",
                reported_symptoms=["severe pain", "night pain"]
            ),
            ClinicalIssue(
                symptom_cluster="impacted lower left wisdom tooth swelling, no difficulty swallowing",
                suspected_category="Surgical",
                urgency="MEDIUM",
                reasoning="Swelling suggests pericoronitis",
                location="LL Q3",
                reported_symptoms=["swelling", "wisdom tooth"]
            )
        ]
        intent_res = IntentResult(
            issues=issues,
            overall_urgency="HIGH",
            requires_clarification=False,
            action_type="CLINICAL",
            patient_sentiment="Neutral"
        )
        mock_llm.return_value = intent_res

        response = client.post("/api/triage/analyze", json={"symptoms": "multiple issues"}, headers=headers)

        assert response.status_code == 200
        data = response.json()

        # Verify Orchestration Plan
        assert "routed_issues" in data
        assert len(data["routed_issues"]) == 2

        # Patient-safe view
        issue_0 = data["routed_issues"][0]
        issue_1 = data["routed_issues"][1]

        assert "triage" not in issue_0
        assert issue_0["specialist_type"] == "Endodontist"
        assert issue_0["appointment_type"] == "Evaluation"

        assert issue_1["specialist_type"] == "Oral Surgeon"
        assert issue_1["appointment_type"] == "Evaluation"

        assert data["suggested_action"] == "ORCHESTRATE"
        assert data["patient_sentiment"] == "Neutral"


def test_guardrail_no_diagnosis(client, headers):
    """
    Test that user request for specific procedure is handled safely.
    """
    with patch("core.intent_analyzer._llm_analyze") as mock_llm:
        from core.intent_analyzer import IntentResult, ClinicalIssue

        intent_res = IntentResult(
            issues=[
                ClinicalIssue(
                    symptom_cluster="user requested root canal evaluation, severe pain for a week",
                    suspected_category="Endodontic",
                    urgency="MEDIUM",
                    reasoning="Patient request for evaluation",
                    location="Upper",
                    reported_symptoms=["root canal request"]
                )
            ],
            overall_urgency="MEDIUM",
            action_type="CLINICAL"
        )
        mock_llm.return_value = intent_res

        response = client.post("/api/triage/analyze", json={"symptoms": "I need a root canal"}, headers=headers)
        data = response.json()

        assert data["suggested_action"] == "ORCHESTRATE"
        assert "Endodontist" in data["message"]
        assert "Root Canal Treatment" not in data["message"]
        assert "pulpitis" not in data["message"].lower()


def test_drilldown_clarification(client, headers):
    """
    Test that vague symptoms trigger clarification.
    """
    with patch("core.intent_analyzer._llm_analyze") as mock_llm:
        from core.intent_analyzer import IntentResult

        intent_res = IntentResult(
            requires_clarification=True,
            clarification_questions=["Where is the pain?", "How long have you had it?"],
            action_type="CLINICAL"
        )
        mock_llm.return_value = intent_res

        response = client.post("/api/triage/analyze", json={"symptoms": "it hurts"}, headers=headers)
        data = response.json()

        assert data["suggested_action"] == "CLARIFY"
        assert "Where is the pain?" in data["message"]


def test_post_llm_safety_validation(client, headers):
    """
    Test that LLM output containing diagnosis language is caught by safety scanner.
    """
    with patch("core.intent_analyzer._llm_analyze") as mock_llm:
        from core.intent_analyzer import IntentResult

        # Simulate safety validation failure — _llm_analyze returns safe fallback
        intent_res = IntentResult(
            requires_clarification=True,
            clarification_questions=[
                "I'd like to understand your symptoms better so I can connect you with the right specialist.",
                "Could you describe what you're experiencing?"
            ],
            action_type="CLINICAL",
            overall_urgency="MEDIUM"
        )
        mock_llm.return_value = intent_res

        response = client.post("/api/triage/analyze", json={"symptoms": "test"}, headers=headers)
        data = response.json()

        assert data["suggested_action"] == "CLARIFY"
        assert "specialist" in data["message"].lower()


def test_sedation_propagation(client, headers):
    """
    Test that sedation flag flows from ClinicalIssue through to routing output.
    """
    with patch("core.intent_analyzer._llm_analyze") as mock_llm:
        from core.intent_analyzer import IntentResult, ClinicalIssue

        intent_res = IntentResult(
            issues=[
                ClinicalIssue(
                    symptom_cluster="broken front tooth, sharp edge, very scared of dentists",
                    suspected_category="Restorative",
                    urgency="MEDIUM",
                    reasoning="Broken tooth with dental anxiety",
                    requires_sedation=True,
                    location="Upper",
                    reported_symptoms=["broken tooth", "sharp edge"]
                )
            ],
            overall_urgency="MEDIUM",
            action_type="CLINICAL",
            patient_sentiment="Anxious"
        )
        mock_llm.return_value = intent_res

        response = client.post("/api/triage/analyze", json={"symptoms": "broken tooth scared"}, headers=headers)
        data = response.json()

        assert data["suggested_action"] == "ORCHESTRATE"
        assert data["patient_sentiment"] == "Anxious"
        assert data["routed_issues"][0]["requires_sedation"] == True
        assert "sedation" in data["message"].lower()


def test_chat_history_context(client, headers):
    """
    Test that chat history is properly passed to the analyzer.
    """
    with patch("core.intent_analyzer._llm_analyze") as mock_llm:
        from core.intent_analyzer import IntentResult, ClinicalIssue

        intent_res = IntentResult(
            issues=[
                ClinicalIssue(
                    symptom_cluster="upper right tooth pain for 2 days, sensitive to cold",
                    suspected_category="Endodontic",
                    urgency="HIGH",
                    reasoning="Pain with cold sensitivity and duration provided",
                    location="UR Q1",
                    reported_symptoms=["pain", "cold sensitivity"]
                )
            ],
            overall_urgency="HIGH",
            action_type="CLINICAL"
        )
        mock_llm.return_value = intent_res

        history = [
            {"role": "assistant", "content": "How can I help you?"},
            {"role": "user", "content": "My upper right tooth hurts"},
            {"role": "assistant", "content": "How long have you had this pain?"},
        ]

        response = client.post("/api/triage/analyze", json={
            "symptoms": "About 2 days, and it's sensitive to cold",
            "history": history
        }, headers=headers)

        data = response.json()

        # Verify the LLM was called with history context
        assert mock_llm.called
        call_args = mock_llm.call_args
        assert call_args[0][1] is not None  # history was passed
        assert len(call_args[0][1]) == 3

        assert data["suggested_action"] == "ORCHESTRATE"


def test_sentiment_anxious_response(client, headers):
    """
    Test that anxious patients get a gentler clarification response.
    """
    with patch("core.intent_analyzer._llm_analyze") as mock_llm:
        from core.intent_analyzer import IntentResult

        intent_res = IntentResult(
            requires_clarification=True,
            clarification_questions=["Where is the pain?"],
            action_type="CLINICAL",
            patient_sentiment="Anxious"
        )
        mock_llm.return_value = intent_res

        response = client.post("/api/triage/analyze", json={"symptoms": "scared, tooth hurts"}, headers=headers)
        data = response.json()

        assert data["suggested_action"] == "CLARIFY"
        assert "concerning" in data["message"].lower()
        assert data["patient_sentiment"] == "Anxious"
