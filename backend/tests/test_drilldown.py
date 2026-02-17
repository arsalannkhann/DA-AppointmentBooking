import pytest
from unittest.mock import patch, MagicMock
from app.main import app
from fastapi.testclient import TestClient
from core.auth import create_access_token

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

def test_drilldown_strictness(client, headers):
    """
    Test that missing duration/severity triggers clarification, NOT routing.
    """
    # Simulate LLM returning clarification required due to missing fields
    mock_llm_response = {
        "action_type": "CLINICAL",
        "issues": [
             {
                "symptom_cluster": "upper right tooth severe pain",
                "suspected_category": "endodontic concern",
                "urgency": "HIGH",
                "reasoning": "Severe pain, but duration missing."
            }
        ],
        "overall_urgency": "HIGH",
        "requires_clarification": True,
        "clarification_questions": ["How long have you had this pain?", "Is it sensitive to hot/cold?"],
        "safety_flag": False
    }

    with patch("core.intent_analyzer._llm_analyze") as mock_llm:
        from core.intent_analyzer import IntentResult, ClinicalIssue
        
        issues = [ClinicalIssue(**i) for i in mock_llm_response["issues"]]
        intent_res = IntentResult(
            issues=issues,
            overall_urgency="HIGH",
            requires_clarification=True, # Correctly flagged by LLM
            clarification_questions=mock_llm_response["clarification_questions"],
            action_type="CLINICAL"
        )
        mock_llm.return_value = intent_res

        # Input is missing duration
        response = client.post("/api/triage/analyze", json={"symptoms": "I have severe tooth pain"}, headers=headers)
        data = response.json()
        
        # Should NOT route
        assert data["suggested_action"] == "CLARIFY"
        # Should ask specific questions
        assert "How long have you had this pain?" in data["message"]
        # Should NOT mention "Evaluation by Endodontist" yet
        assert "Evaluation by Endodontist" not in data["message"]
