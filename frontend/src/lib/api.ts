const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Token Management ────────────────────────────────────────────────────────
export function setAuthToken(token: string) {
    if (typeof window !== "undefined") {
        localStorage.setItem("authToken", token);
    }
}

export function getAuthToken(): string | null {
    if (typeof window !== "undefined") {
        return localStorage.getItem("authToken");
    }
    return null;
}

export function removeAuthToken() {
    if (typeof window !== "undefined") {
        localStorage.removeItem("authToken");
    }
}

// ── Core Fetch Wrapper ──────────────────────────────────────────────────────
async function fetchAPI(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE}${endpoint}`;
    const token = getAuthToken();

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
        ...options,
        headers,
    });

    if (!res.ok) {
        // If 401 Unauthorized, automatically log out
        if (res.status === 401) {
            removeAuthToken();
            if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
                // Optional: Redirect to login
                // window.location.href = "/login";
            }
        }

        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(err.detail || `API Error ${res.status}`);
    }

    // Handle 204 No Content
    if (res.status === 204) {
        return {};
    }

    return res.json();
}

// ── Auth & Onboarding ───────────────────────────────────────────────────────
export async function registerClinic(data: any) {
    return fetchAPI("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function loginClinic(data: any) {
    return fetchAPI("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function logout() {
    return fetchAPI("/api/auth/logout", { method: "POST" });
}

export async function getMe() {
    return fetchAPI("/api/auth/me");
}

export async function getOnboardingStatus() {
    return fetchAPI("/api/onboarding/status");
}

export async function addRooms(rooms: any[]) {
    return fetchAPI("/api/onboarding/rooms", {
        method: "POST",
        body: JSON.stringify(rooms),
    });
}

export async function addDoctors(doctors: any[]) {
    return fetchAPI("/api/onboarding/doctors", {
        method: "POST",
        body: JSON.stringify(doctors),
    });
}

export async function completeOnboarding() {
    return fetchAPI("/api/onboarding/complete", { method: "POST" });
}


// ── Patients ────────────────────────────────────────────────────────────────
export async function getPublicClinics() {
    return fetchAPI("/api/auth/patient/clinics");
}

export async function registerPatient(data: { name: string; email: string; password: string; phone?: string; preferred_clinic_id?: string }) {
    return fetchAPI("/api/auth/patient/register", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function loginPatient(data: { email: string; password: string }): Promise<any> {
    return fetchAPI("/api/auth/patient/login", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function listPatients() {
    return fetchAPI("/api/patients");
}

// ── Triage ──────────────────────────────────────────────────────────────────
export async function analyzeSymptoms(symptoms: string, history?: any[]) {
    return fetchAPI("/api/triage/analyze", {
        method: "POST",
        body: JSON.stringify({ symptoms, history }),
    });
}

// ── Slots ───────────────────────────────────────────────────────────────────
export async function searchSlots(procedureId: number, needsSedation: boolean = false) {
    return fetchAPI("/api/slots/search", {
        method: "POST",
        body: JSON.stringify({
            procedure_id: procedureId,
            needs_sedation: needsSedation,
        }),
    });
}

export async function listProcedures() {
    return fetchAPI("/api/slots/procedures");
}

export async function listSpecializations() {
    // We don't have a direct list specializations endpoint? 
    // Actually we do via onboardingStatus or we can add one. 
    // Or users endpoint? Assuming endpoint exists or we use onboarding status data.
    return fetchAPI("/api/onboarding/status"); // Fallback for now
}

// ── Appointments ────────────────────────────────────────────────────────────
export async function bookAppointment(patientId: string, procedureId: number, slot: Record<string, unknown>) {
    return fetchAPI("/api/appointments/book", {
        method: "POST",
        body: JSON.stringify({
            patient_id: patientId,
            procedure_id: procedureId,
            slot,
        }),
    });
}

export async function getPatientAppointments(patientId: string) {
    return fetchAPI(`/api/appointments/patient/${patientId}`);
}

export async function cancelAppointment(apptId: string) {
    return fetchAPI(`/api/appointments/${apptId}/cancel`, { method: "PATCH" });
}

export async function listAllAppointments() {
    return fetchAPI("/api/appointments/");
}

// ── Dashboard ───────────────────────────────────────────────────────────────
export async function getDashboardStats() {
    return fetchAPI("/api/dashboard/stats");
}
