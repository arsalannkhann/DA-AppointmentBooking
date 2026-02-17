import pytest
import json
import os
from fastapi.testclient import TestClient
from app.main import app
from models.models import Patient
from core.auth import create_access_token
from core.db import get_db

@pytest.fixture(scope="module")
def client():
    # Bypass rate limits for the stress test by mocking the underlying limiter
    from unittest.mock import patch
    with patch("core.rate_limit.RateLimiter.is_allowed", return_value=(True, 0, 0)):
        with TestClient(app) as c:
            yield c

@pytest.fixture(scope="module")
def patient_token():
    # We'll use a hardcoded patient from seed data if possible, or create one
    # For now, let's create a temporary token for a known patient ID or just a dummy one
    # as the triage route only needs a valid token/user context.
    token = create_access_token(
        user_id="e566effc-9bad-4d19-9bd2-459184763e63", # Arsalan Khan
        tenant_id=None,
        role="patient"
    )
    return token

def load_test_cases():
    suite_path = os.path.join(os.path.dirname(__file__), "orchestration_suite.json")
    with open(suite_path, "r") as f:
        return json.load(f)

@pytest.mark.parametrize("case", load_test_cases())
def test_orchestration_accuracy(client, patient_token, case):
    """
    Validates triage mapping, specialist assignment, and orchestration logic.
    """
    headers = {"Authorization": f"Bearer {patient_token}"}
    payload = {"symptoms": case["prompt"]}
    
    response = client.post("/api/triage/analyze", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    
    try:
        expected = case["expected"]
        
        # Check Intent Category if specified
        if "category" in expected:
            assert data["intent"]["category"] == expected["category"]
            
        # Check Action (ROUTE, CLARIFY, EMERGENCY)
        if "action" in expected:
            assert data["action"] == expected["action"]
            
        # Check Triage Result details
        if (expected.get("action") == "ROUTE" or "condition" in expected) and data.get("action") != "EMERGENCY":
            # If expected is ROUTE, triage must exist
            if expected.get("action") == "ROUTE":
                assert data.get("triage") is not None
                
            if data.get("triage") or data["intent"]["condition"]:
                triage = data.get("triage")
                
                # 1. Condition/Procedure Mapping
                if "condition" in expected:
                    assert data["intent"]["condition"] == expected["condition"]
                
                # 2. Specialist Type
                if "specialist" in expected:
                    assert triage is not None, f"Expected specialist {expected['specialist']} but triage result is None"
                    assert triage["specialist_type"] == expected["specialist"]
                    
                # 3. Duration
                if "duration" in expected:
                    assert triage is not None, f"Expected duration {expected['duration']} but triage result is None"
                    total_duration = triage["consult_minutes"] + triage["treatment_minutes"]
                    assert total_duration >= expected["duration"]
                    
                # 4. Sedation/Anesthetist
                if "requires_sedation" in expected:
                    assert triage is not None
                    assert triage["requires_sedation"] == expected["requires_sedation"]
                if "requires_anesthetist" in expected:
                    assert triage is not None
                    assert triage["requires_anesthetist"] == expected["requires_anesthetist"]
                    
                # 5. Same Day Combo
                if "allow_combo" in expected:
                    assert triage is not None
                    assert triage["allow_combo"] == expected["allow_combo"]
    except AssertionError as e:
        # FAILED CASE logs or handling
        raise e

    # Emergency check
    if expected.get("is_emergency") is not None:
        assert data["is_emergency"] == expected["is_emergency"]
