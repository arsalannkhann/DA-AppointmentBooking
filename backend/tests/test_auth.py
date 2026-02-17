import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.main import app
from core.db import Base, get_db
from models.models import User, Clinic, AuditLog, TokenBlacklist
from core.auth import hash_password, create_access_token
from config import DATABASE_URL

# Use the actual DB for testing, but we'll try to be somewhat careful
# Ideally we'd validte against a test DB, but per instructions we use the running environment.
# We will create unique test data.

@pytest.fixture(scope="module")
def client():
    # Override get_db if needed, but for integration testing the real DB is fine
    # provided we clean up or use distinct identifiers.
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="module")
def db_session():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_register_login_flow(client, db_session):
    # 1. Register
    email = f"test_{uuid.uuid4()}@example.com"
    password = "SecurePassword123!"
    clinic_name = f"Test Clinic {uuid.uuid4()}"
    
    reg_payload = {
        "clinic_name": clinic_name,
        "email": email,
        "password": password,
        "full_name": "Test Admin"
    }
    
    response = client.post("/api/auth/register", json=reg_payload)
    assert response.status_code == 201
    data = response.json()
    assert "token" in data
    assert data["user"]["email"] == email
    assert data["user"]["role"] == "admin"
    
    token = data["token"]
    user_id = data["user"]["user_id"]
    tenant_id = data["user"]["tenant_id"]

    # 2. Login
    login_payload = {
        "email": email,
        "password": password
    }
    response = client.post("/api/auth/login", json=login_payload)
    assert response.status_code == 200
    assert "token" in response.json()

    # 3. Access Protected Route (/me)
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    me_data = response.json()
    assert me_data["email"] == email
    assert me_data["tenant_id"] == tenant_id

    # 4. Check Onboarding Status (Admin)
    response = client.get("/api/onboarding/status", headers=headers)
    assert response.status_code == 200
    status_data = response.json()
    assert status_data["complete"] is False

    # 5. Add Rooms (Onboarding Step 1)
    rooms_payload = [
        {"name": "Room A", "type": "operatory", "capabilities": {}, "equipment": []}
    ]
    response = client.post("/api/onboarding/rooms", json=rooms_payload, headers=headers)
    assert response.status_code == 201
    assert response.json()["count"] == 1

    # 6. Logout
    response = client.post("/api/auth/logout", headers=headers)
    assert response.status_code == 200

    # 7. Try to use blacklisted token
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 401

def test_tenant_isolation(client, db_session):
    # Create Tenant A
    email_a = f"tenant_a_{uuid.uuid4()}@example.com"
    resp_a = client.post("/api/auth/register", json={
        "clinic_name": "Clinic A", "email": email_a, "password": "Pass123!A", "full_name": "Admin A"
    })
    token_a = resp_a.json()["token"]
    
    # Create Tenant B
    email_b = f"tenant_b_{uuid.uuid4()}@example.com"
    resp_b = client.post("/api/auth/register", json={
        "clinic_name": "Clinic B", "email": email_b, "password": "Pass123!B", "full_name": "Admin B"
    })
    token_b = resp_b.json()["token"]

    # Tenant A creates a patient
    headers_a = {"Authorization": f"Bearer {token_a}"}
    patient_payload = {"name": "Patient A", "phone": "555-0001"}
    resp_pat = client.post("/api/patients/register", json=patient_payload, headers=headers_a)
    assert resp_pat.status_code == 200
    patient_id_a = resp_pat.json()["patient_id"]

    # Tenant B tries to get Tenant A's patient
    headers_b = {"Authorization": f"Bearer {token_b}"}
    resp_get = client.get(f"/api/patients/{patient_id_a}", headers=headers_b)
    assert resp_get.status_code == 404  # Not found for Tenant B

    # Tenant B lists patients - should be empty (or at least not contain Patient A)
    resp_list = client.get("/api/patients/", headers=headers_b)
    assert len(resp_list.json()) == 0
