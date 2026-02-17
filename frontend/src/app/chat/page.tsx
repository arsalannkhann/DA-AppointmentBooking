"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    AlertTriangle,
    ChevronRight,
    Clock,
    Calendar,
    CheckCircle2,
    Shield,
    Activity,
    User,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { analyzeSymptoms, searchSlotsBySpecialist, bookAppointment } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ClarificationPanel } from "@/components/DynamicClarification";

// ── Types ────────────────────────────────────────────────────────────────────

interface ClinicalIssue {
    symptom_cluster: string;
    has_pain: boolean;
    severity?: number;
    duration_days?: number;
    swelling: boolean;
    airway_compromise: boolean;
    location?: string;
    thermal_sensitivity: boolean;
    biting_pain: boolean;
    trauma: boolean;
    bleeding: boolean;
    impacted_wisdom: boolean;
}

interface RoutedIssue {
    specialist_type: string;
    urgency: string;
    requires_sedation: boolean;
    description: string;
    symptoms: string[];
    reasoning_triggers: string[]; // Added for reasoning traceability
    // Constraint-aware fields
    procedure_id: number | null;
    procedure_name: string;
    appointment_type: string;
    duration_minutes: number;
    consult_minutes: number;
    room_capability: Record<string, boolean> | null;
    requires_anesthetist: boolean;
    slots: {
        tier: number;
        tier_label: string;
        combo_slots: SlotData[];
        single_slots: SlotData[];
        total_found: number;
        note?: string;
    } | null;
    fallback_tier: number;
    fallback_note: string | null;
    error: string | null;
}

interface OrchestrationData {
    is_emergency: boolean;
    overall_urgency: string;
    routed_issues: RoutedIssue[];
    issues?: ClinicalIssue[]; // Added for CLARIFY state
    suggested_action: string;
    combined_visit_possible: boolean;
    patient_sentiment: string;
    clarification_questions: string[];
    emergency_slots?: Record<string, unknown>;
    message?: string;
}

interface SlotData {
    date: string;
    time: string;
    end_time: string;
    doctor_name: string;
    doctor_id: string;
    room_name: string;
    clinic_name: string;
    procedure: string;
    type: string;
    duration_minutes: number;
    score: number;
}


interface MissingField {
    field_key: string;
    label: string;
    type: "text" | "select" | "slider" | "boolean";
    required: boolean;
    options?: string[];
    min?: number;
    max?: number;
}

interface ClarifyIssue {
    issue_id: string;
    summary: string;
    missing_fields: MissingField[];
}

type IntakePhase = "INPUT" | "CLARIFY" | "RESULTS" | "SLOTS" | "CONFIRM" | "BOOKED";

// ── Constants ────────────────────────────────────────────────────────────────

const DURATION_OPTIONS = [
    { value: "less than 24 hours", label: "Less than 24 hours" },
    { value: "1-3 days", label: "1–3 days" },
    { value: "4-7 days", label: "4–7 days" },
    { value: "1-2 weeks", label: "1–2 weeks" },
    { value: "more than 2 weeks", label: "More than 2 weeks" },
];

const STEP_MAP: Record<IntakePhase, { step: number; label: string }> = {
    INPUT: { step: 1, label: "Describe Concern" },
    CLARIFY: { step: 2, label: "Clinical Clarification" },
    RESULTS: { step: 3, label: "Specialist Routing" },
    SLOTS: { step: 3, label: "Appointment Selection" },
    CONFIRM: { step: 3, label: "Confirm Appointment" },
    BOOKED: { step: 3, label: "Complete" },
};

const MAX_CHARS = 1000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function urgencyColor(u: string): string {
    switch (u.toUpperCase()) {
        case "EMERGENCY": case "HIGH": return "var(--clinical-urgent)";
        case "MEDIUM": return "var(--clinical-warning)";
        case "LOW": return "var(--clinical-safe)";
        default: return "var(--clinical-info)";
    }
}

function urgencyLabel(u: string): string {
    switch (u.toUpperCase()) {
        case "EMERGENCY": return "Immediate Clinical Attention Required";
        case "HIGH": return "High Priority";
        case "MEDIUM": return "Medium Priority";
        case "LOW": return "Routine";
        default: return u;
    }
}

// Map backend duration days to frontend dropdown
function mapDurationToOption(days?: number): string {
    if (days === undefined || days === null) return "";
    if (days < 1) return "less than 24 hours";
    if (days <= 3) return "1-3 days";
    if (days <= 7) return "4-7 days";
    if (days <= 14) return "1-2 weeks";
    return "more than 2 weeks";
}

// ══════════════════════════════════════════════════════════════════════════════

export default function ClinicalIntakePage() {
    const { user } = useAuth();
    const role = (user?.role as "patient" | "admin") || "patient";

    // Core State
    const [phase, setPhase] = useState<IntakePhase>("INPUT");
    const [symptomText, setSymptomText] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [orchestration, setOrchestration] = useState<OrchestrationData | null>(null);
    const [systemMessage, setSystemMessage] = useState<string | null>(null);

    // Clarification State
    const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([]);
    const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({});
    const [painSeverity, setPainSeverity] = useState(5);
    const [duration, setDuration] = useState("");
    const [breathingDifficulty, setBreathingDifficulty] = useState<boolean | null>(null);
    const [locationInput, setLocationInput] = useState("");
    const [parsedIssues, setParsedIssues] = useState<ClinicalIssue[]>([]);
    const [clarificationIssues, setClarificationIssues] = useState<ClarifyIssue[] | null>(null);

    // Booking State
    const [conversationContext, setConversationContext] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
    const [slots, setSlots] = useState<SlotData[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<SlotData | null>(null);
    const [bookingNotes, setBookingNotes] = useState("");
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [phase, orchestration, slots]);

    const updateTimestamp = () => {
        setLastUpdated(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    };

    // ── Submit Initial Symptoms ──────────────────────────────────────────────
    const handleAnalyze = async () => {
        if (!symptomText.trim() || loading) return;
        setLoading(true);
        setError(null);
        setSystemMessage(null);

        const userEntry = { role: "user" as const, content: symptomText };
        const newContext = [...conversationContext, userEntry];
        setConversationContext(newContext);

        try {
            const res = await analyzeSymptoms(symptomText, newContext);
            const action = res.suggested_action || res.action || "CLARIFY";
            const assistantEntry = { role: "assistant" as const, content: res.message || "" };
            setConversationContext([...newContext, assistantEntry]);
            updateTimestamp();

            if (action === "ESCALATE") {
                setOrchestration(res);
                setSystemMessage(res.message);
                setPhase("RESULTS");
                if (res.emergency_slot) {
                    setSelectedSlot(res.emergency_slot as unknown as SlotData);
                    setPhase("CONFIRM");
                }
            } else if (action === "GREETING" || action === "SMALL_TALK" || action === "GREET") {
                setSystemMessage(res.message);
            } else if (action === "CLARIFY") {
                // Enterprise UX: Smart Prefill & Dynamic Form
                const issues = res.issues || [];
                setParsedIssues(issues);

                // Phase 2: Dynamic Clarification Interface
                if (res.clarification && res.clarification.issues) {
                    setClarificationIssues(res.clarification.issues);
                } else {
                    setClarificationIssues(null);
                }

                // Legacy Prefill (Keep for now, but UI will prefer Dynamic Panel)
                const primary = issues[0];
                if (primary) {
                    if (primary.severity) setPainSeverity(primary.severity);
                    if (primary.location) setLocationInput(primary.location);
                    if (primary.duration_days !== undefined && primary.duration_days !== null) {
                        setDuration(mapDurationToOption(primary.duration_days));
                    }
                    if (primary.airway_compromise) setBreathingDifficulty(true);
                }

                setClarificationQuestions(res.clarification_questions || []);
                setSystemMessage(res.message);
                setPhase("CLARIFY");
            } else if (action === "ORCHESTRATE") {
                setOrchestration(res);
                setSystemMessage(res.message);
                setPhase("RESULTS");
                await searchSlotsForIssues(res);
            } else {
                setSystemMessage(res.message || "Please provide more detail about your concern.");
            }
        } catch {
            setError("We were unable to process the information provided. Please refine your description with more clinical details such as location, duration, and severity.");
        } finally {
            setLoading(false);
        }
    };

    // ── Submit Clarification ─────────────────────────────────────────────────
    const handleClarificationSubmit = async (dynamicData?: Record<string, any>) => {
        if (loading) return;
        setLoading(true);
        setError(null);

        let responseText = "";

        if (dynamicData && clarificationIssues) {
            // Enterprise UX: Convert structured form data to natural language for the LLM
            const parts: string[] = [];
            clarificationIssues.forEach(issue => {
                issue.missing_fields.forEach(field => {
                    const key = `${issue.issue_id}_${field.field_key}`;
                    const val = dynamicData[key];
                    if (val !== undefined && val !== null && val !== "") {
                        if (field.type === "boolean") {
                            parts.push(`${field.label}: ${val ? "Yes" : "No"}`);
                        } else {
                            parts.push(`${field.label}: ${val}`);
                        }
                    }
                });
            });
            responseText = parts.join(". ");
        } else {
            // Fallback to text input
            responseText = symptomText;
        }

        if (!responseText.trim()) {
            setLoading(false);
            return;
        }

        const userEntry = { role: "user" as const, content: responseText };
        const newContext = [...conversationContext, userEntry];
        setConversationContext(newContext);
        setSymptomText(""); // Clear input

        try {
            const res = await analyzeSymptoms(responseText, newContext);
            const action = res.suggested_action || res.action || "CLARIFY";
            const assistantEntry = { role: "assistant" as const, content: res.message || "" };
            setConversationContext([...newContext, assistantEntry]);
            updateTimestamp();

            if (action === "ESCALATE") {
                setOrchestration(res);
                setSystemMessage(res.message);
                setPhase("RESULTS");
                if (res.emergency_slot) {
                    setSelectedSlot(res.emergency_slot as unknown as SlotData);
                    setPhase("CONFIRM");
                }
            } else if (action === "GREETING" || action === "SMALL_TALK" || action === "GREET") {
                setSystemMessage(res.message);
            } else if (action === "CLARIFY") {
                const issues = res.issues || [];
                setParsedIssues(issues);

                if (res.clarification && res.clarification.issues) {
                    setClarificationIssues(res.clarification.issues);
                } else {
                    setClarificationIssues(null);
                }

                setClarificationQuestions(res.clarification_questions || []);
                setSystemMessage(res.message);
                setPhase("CLARIFY");
            } else if (action === "ORCHESTRATE") {
                setOrchestration(res);
                setSystemMessage(res.message);
                setPhase("RESULTS");
                await searchSlotsForIssues(res);
            } else {
                setSystemMessage(res.message || "Please provide more detail about your concern.");
            }
        } catch {
            setError("We were unable to process your response. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ── Slot Search (uses pre-attached slots from orchestration) ───────────────
    const searchSlotsForIssues = async (orch: OrchestrationData) => {
        if (!orch.routed_issues?.length) return;

        // Collect slots from all routed issues (pre-attached by orchestration engine)
        const allSlots: SlotData[] = [];
        for (const issue of orch.routed_issues) {
            if (issue.slots) {
                allSlots.push(...(issue.slots.combo_slots || []), ...(issue.slots.single_slots || []));
            }
        }

        if (allSlots.length > 0) {
            setSlots(allSlots);
            setPhase("SLOTS");
            return;
        }

        // Fallback: if orchestration didn't attach slots, search by specialist
        const primaryIssue = orch.routed_issues.reduce((prev, curr) => {
            const m: Record<string, number> = { EMERGENCY: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
            return (m[curr.urgency] || 1) > (m[prev.urgency] || 1) ? curr : prev;
        });
        try {
            const slotRes = await searchSlotsBySpecialist(primaryIssue.specialist_type, primaryIssue.requires_sedation);
            const fallbackSlots = [...(slotRes.combo_slots || []), ...(slotRes.single_slots || [])];
            if (fallbackSlots.length > 0) {
                setSlots(fallbackSlots);
                setPhase("SLOTS");
            }
        } catch { /* slot search failed silently */ }
    };

    // ── Derived State ────────────────────────────────────────────────────────
    const isEmergency = orchestration?.is_emergency || breathingDifficulty === true;
    const triageStatus = orchestration
        ? (isEmergency
            ? "Urgent Triage"
            : (orchestration.routed_issues.some(i => i.procedure_id != null) ? "Specialist Evaluation Identified" : "Review Required"))
        : "Pending";
    const bookingBlocked = isEmergency || triageStatus === "Pending";

    // ── Booking ──────────────────────────────────────────────────────────────────────
    const handleConfirmBooking = async () => {
        if (!selectedSlot || loading || bookingBlocked) return;
        setLoading(true);
        setError(null);

        // Resolve procedure_id from the primary routed issue
        const primaryIssue = orchestration?.routed_issues?.find(r => r.procedure_id != null);
        const procId = primaryIssue?.procedure_id ?? null;

        try {
            await bookAppointment(user?.user_id || "", procId as unknown as number, { ...selectedSlot, notes: bookingNotes || symptomText });
            setPhase("BOOKED");
            updateTimestamp();
        } catch {
            setError(
                isEmergency
                    ? "Booking paused due to emergency triage. Please contact the clinic directly."
                    : "We were unable to complete the booking due to a system error. Please try again or contact the clinic."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleNewIntake = () => {
        setPhase("INPUT");
        setSymptomText("");
        setOrchestration(null);
        setSystemMessage(null);
        setClarificationQuestions([]);
        setClarificationAnswers({});
        setPainSeverity(5);
        setDuration("");
        setBreathingDifficulty(null);
        setLocationInput("");
        setConversationContext([]);
        setSlots([]);
        setSelectedSlot(null);
        setBookingNotes("");
        setError(null);
        setLastUpdated(null);
    };

    const currentStep = STEP_MAP[phase];
    const charCount = symptomText.length;

    // ══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════════════════════════

    return (
        <DashboardLayout role={role} title="Clinical Routing Console" subtitle="Constraint-based specialist evaluation and appointment orchestration">
            <div className="max-w-[1400px] mx-auto">
                {/* Progress Indicator */}
                <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-8 px-1">
                    {[
                        { n: 1, label: "Clinical Intake" },
                        { n: 2, label: "Evaluation" },
                        { n: 3, label: "Scheduling" },
                    ].map((s, i) => (
                        <div key={s.n} className="flex items-center gap-2 sm:gap-3">
                            {i > 0 && (
                                <div className={`w-6 sm:w-12 h-0.5 transition-colors ${currentStep.step > i ? "bg-cyan-500" : "bg-white/10"}`} />
                            )}
                            <div className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs font-semibold transition-all ${currentStep.step >= s.n ? "bg-cyan-600 text-white" : "bg-white/5 text-brand-text-muted border border-white/10"}`}>
                                {currentStep.step > s.n ? <CheckCircle2 size={14} /> : s.n}
                            </div>
                            <span className={`text-sm font-medium transition-colors hidden sm:inline ${currentStep.step >= s.n ? "text-white" : "text-brand-text-muted"}`}>
                                {s.label}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Main Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
                    {/* LEFT COLUMN - Primary Workflow */}
                    <div
                        ref={scrollRef}
                        className="flex flex-col gap-5 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto lg:pr-2 custom-scrollbar"
                    >
                        {/* Error Banner */}
                        {error && (
                            <div className="border-l-4 border-red-500 bg-red-500/10 rounded-lg p-4">
                                <p className="text-sm text-red-200 leading-relaxed">{error}</p>
                            </div>
                        )}

                        {/* SECTION 1: Symptom Input */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Clinical Intake</h3>
                                <p className="card-subtitle">Describe your primary concern</p>
                            </div>
                            <div className="flex flex-col gap-4">
                                {phase === "INPUT" && (
                                    <div className="text-sm text-brand-text-muted leading-relaxed pb-4 border-b border-white/5">
                                        <p className="font-medium mb-2">Please provide the following information:</p>
                                        <ul className="space-y-1 ml-4">
                                            <li>• Location (upper/lower, left/right)</li>
                                            <li>• Duration (how long symptoms have persisted)</li>
                                            <li>• Severity (pain level 1-10)</li>
                                            <li>• Associated symptoms (swelling, bleeding, fever)</li>
                                        </ul>
                                    </div>
                                )}

                                <div className="relative">
                                    <textarea
                                        value={symptomText}
                                        onChange={(e) => {
                                            if (e.target.value.length <= MAX_CHARS) setSymptomText(e.target.value);
                                        }}
                                        placeholder="Example: Sharp pain in lower left molar for 3 days. Worsens at night and sensitive to cold. No swelling."
                                        disabled={loading || (phase !== "INPUT" && phase !== "CLARIFY")}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey && phase === "INPUT") {
                                                e.preventDefault();
                                                handleAnalyze();
                                            }
                                        }}
                                        className="w-full min-h-[120px] resize-vertical p-4 pb-10 text-sm leading-relaxed bg-brand-input border border-white/10 rounded-lg text-white placeholder-brand-text-muted focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                                    />
                                    <span className={`absolute bottom-3 right-4 text-xs ${charCount > MAX_CHARS * 0.9 ? "text-amber-400" : "text-brand-text-disabled"}`}>
                                        {charCount}/{MAX_CHARS}
                                    </span>
                                </div>

                                {phase === "INPUT" && (
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                                        <button
                                            onClick={handleAnalyze}
                                            disabled={!symptomText.trim() || loading}
                                            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {loading ? "Processing..." : "Begin Clinical Review"}
                                        </button>
                                        <span className="text-xs text-brand-text-disabled text-center sm:text-left">
                                            Does not constitute medical advice
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* System Message */}
                        {systemMessage && phase === "INPUT" && (
                            <div className="card">
                                <p className="text-sm text-brand-text-secondary leading-relaxed">
                                    {systemMessage}
                                </p>
                            </div>
                        )}

                        {/* SECTION 2: Identified Concerns */}
                        <AnimatePresence>
                            {orchestration && orchestration.routed_issues.length > 0 && phase !== "INPUT" && (
                                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">Identified Clinical Concerns</h3>
                                            <p className="card-subtitle">Structured symptom analysis</p>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            {orchestration.routed_issues.map((issue, i) => (
                                                <div key={i} className="border-l-4 p-4 bg-brand-input rounded-lg" style={{ borderLeftColor: urgencyColor(issue.urgency) }}>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <h4 className="text-sm font-semibold text-white mb-1">
                                                                Concern {i + 1}: {issue.description}
                                                            </h4>
                                                            <p className="text-xs text-brand-text-muted">
                                                                Specialist: {issue.specialist_type}
                                                                {issue.requires_sedation && " • Sedation capability available"}
                                                            </p>
                                                        </div>
                                                        <span className="badge text-xs px-2 py-1" style={{
                                                            backgroundColor: `${urgencyColor(issue.urgency)}20`,
                                                            color: urgencyColor(issue.urgency),
                                                            border: `1px solid ${urgencyColor(issue.urgency)}40`,
                                                            textTransform: "uppercase",
                                                            letterSpacing: "0.04em",
                                                        }}>
                                                            {urgencyLabel(issue.urgency)}
                                                        </span>
                                                    </div>
                                                    {/* Reasoning Traceability Layer */}
                                                    {issue.reasoning_triggers?.length > 0 && (
                                                        <div className="mt-3 p-2 bg-brand-card rounded border border-[var(--border-primary)]">
                                                            <div className="text-[0.6875rem] font-semibold text-brand-text-muted uppercase mb-1">
                                                                Reason Traceability
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {issue.reasoning_triggers.map((t, ti) => (
                                                                    <span key={ti} className="text-xs text-cyan-400 flex items-center gap-1">
                                                                        <CheckCircle2 size={10} /> {t}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Emergency Alert */}
                        {isEmergency && phase !== "INPUT" && (
                            <div className="border-l-4 border-red-500 bg-red-500/10 rounded-lg p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertTriangle size={18} className="text-red-500" />
                                    <h4 className="text-sm font-semibold text-red-400 uppercase tracking-wider">
                                        Immediate Clinical Attention Required
                                    </h4>
                                </div>
                                <p className="text-sm text-red-200 mb-4 leading-relaxed">
                                    {systemMessage || "Your symptoms indicate a condition requiring immediate clinical attention."}
                                </p>
                                <div className="p-4 bg-brand-input rounded-lg border border-white/10">
                                    <p className="text-sm font-medium text-white mb-2">
                                        Please proceed to the nearest emergency facility or call the clinic directly.
                                    </p>
                                    <p className="text-xs text-brand-text-muted">
                                        Online booking is not available for emergency cases.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ── SECTION 3: Clinical Details (Dynamic) ────── */}
                        <AnimatePresence>
                            {phase === "CLARIFY" && clarificationIssues && (
                                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                                    <ClarificationPanel
                                        issues={clarificationIssues}
                                        loading={loading}
                                        onComplete={(data) => handleClarificationSubmit(data)}
                                    />
                                </motion.div>
                            )}

                            {/* Legacy Fallback for unstructured clarification */}
                            {phase === "CLARIFY" && !clarificationIssues && (
                                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                                    <Section title="Complete Required Clinical Details">
                                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                            <p style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", margin: 0, lineHeight: 1.6, paddingBottom: "10px", borderBottom: "1px solid var(--border-primary)" }}>
                                                Please provide more details about your concern.
                                            </p>
                                            <div className="relative">
                                                <textarea
                                                    value={symptomText}
                                                    onChange={(e) => setSymptomText(e.target.value)}
                                                    className="w-full bg-brand-input border border-[var(--border-primary)] rounded-lg p-4 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all resize-none h-32"
                                                    placeholder="Describe here..."
                                                    disabled={loading}
                                                    style={{ width: "100%", minHeight: "100px" }}
                                                />
                                                <button
                                                    onClick={handleAnalyze}
                                                    disabled={loading || !symptomText.trim()}
                                                    className="absolute bottom-4 right-4 p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    style={{ marginTop: "10px" }}
                                                >
                                                    Submit
                                                </button>
                                            </div>
                                        </div>
                                    </Section>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* SECTION 4: Risk Assessment Grid */}
                        <AnimatePresence>
                            {orchestration && (phase === "RESULTS" || phase === "SLOTS" || phase === "CONFIRM") && (
                                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15, delay: 0.05 }}>
                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">Clinical Risk Assessment</h3>
                                            <p className="card-subtitle">Automated triage evaluation</p>
                                        </div>

                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                            <div className="p-4 bg-brand-input rounded-lg border border-white/5">
                                                <h6 className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-2">
                                                    Urgency Level
                                                </h6>
                                                <div className="text-sm font-semibold" style={{ color: urgencyColor(orchestration.overall_urgency) }}>
                                                    {urgencyLabel(orchestration.overall_urgency)}
                                                </div>
                                            </div>

                                            <div className="p-4 bg-brand-input rounded-lg border border-white/5">
                                                <h6 className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-2">
                                                    Emergency Status
                                                </h6>
                                                <div className="text-sm font-semibold" style={{ color: isEmergency ? "var(--clinical-urgent)" : "var(--clinical-safe)" }}>
                                                    {isEmergency ? "Detected" : "Not Detected"}
                                                </div>
                                            </div>

                                            <div className="p-4 bg-brand-input rounded-lg border border-white/5">
                                                <h6 className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-2">
                                                    Airway Risk
                                                </h6>
                                                <div className="text-sm font-semibold" style={{ color: breathingDifficulty ? "var(--clinical-urgent)" : "var(--clinical-safe)" }}>
                                                    {breathingDifficulty ? "Reported" : "Not Reported"}
                                                </div>
                                            </div>

                                            <div className="p-4 bg-brand-input rounded-lg border border-white/5">
                                                <h6 className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-2">
                                                    Clinical Status
                                                </h6>
                                                <div className="text-sm font-semibold text-white">
                                                    {triageStatus}
                                                </div>
                                            </div>
                                        </div>

                                        {bookingBlocked && (
                                            <div className="border-l-4 border-amber-500 bg-amber-500/10 rounded-lg p-4 mb-3">
                                                <p className="text-sm font-medium text-amber-200">
                                                    {isEmergency
                                                        ? "Online booking is disabled for emergency cases. Please contact the clinic directly."
                                                        : "Clinical review required before booking. Additional information may be needed."
                                                    }
                                                </p>
                                            </div>
                                        )}

                                        <p className="text-xs text-brand-text-disabled leading-relaxed">
                                            Clinical review required — all assessments are subject to provider verification
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* SECTION 5: Specialist Routing Recommendation */}
                        <AnimatePresence>
                            {orchestration && orchestration.routed_issues.length > 0 && (phase === "RESULTS" || phase === "SLOTS" || phase === "CONFIRM") && (
                                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15, delay: 0.1 }}>
                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">Specialist Evaluation Recommendation</h3>
                                            <p className="card-subtitle">Constraint-based clinical routing</p>
                                        </div>

                                        {/* Liability Disclaimer */}
                                        <div className="p-3 mb-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                                            <p className="text-xs text-cyan-200 leading-relaxed">
                                                <strong>Routing Recommendation:</strong> Based on reported symptoms and structured intake responses.
                                                Final clinical decisions are made by the treating provider.
                                            </p>
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            {orchestration.routed_issues.map((issue, i) => (
                                                <div key={i} className="p-4 bg-brand-input rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex-1">
                                                            <h4 className="text-sm font-semibold text-white mb-1">
                                                                {issue.procedure_name || `${issue.specialist_type} Evaluation`}
                                                            </h4>
                                                            <p className="text-xs text-brand-text-muted">
                                                                {issue.specialist_type} • {issue.appointment_type || "Consultation"} • {issue.duration_minutes || 30} min
                                                            </p>
                                                        </div>
                                                        <ChevronRight size={16} className="text-brand-text-disabled" />
                                                    </div>

                                                    {/* Resource Requirements */}
                                                    {(issue.room_capability || issue.requires_sedation || issue.requires_anesthetist) && (
                                                        <div className="flex flex-wrap gap-2 mb-2">
                                                            {issue.room_capability && Object.entries(issue.room_capability)
                                                                .filter(([, v]) => v === true)
                                                                .map(([k]) => (
                                                                    <span key={k} className="text-xs px-2 py-1 bg-brand-elevated rounded border border-white/10 text-brand-text-secondary">
                                                                        {k.charAt(0).toUpperCase() + k.slice(1)}
                                                                    </span>
                                                                ))}
                                                            {issue.requires_sedation && (
                                                                <span className="text-xs px-2 py-1 bg-brand-elevated rounded border border-white/10 text-brand-text-secondary">
                                                                    Sedation Capability
                                                                </span>
                                                            )}
                                                            {issue.requires_anesthetist && (
                                                                <span className="text-xs px-2 py-1 bg-brand-elevated rounded border border-white/10 text-brand-text-secondary">
                                                                    Anesthetist Available
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Fallback Tier Notice */}
                                                    {issue.fallback_tier > 1 && issue.fallback_note && (
                                                        <p className="text-xs text-cyan-400 italic mt-2">
                                                            {issue.fallback_note}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}

                                            {orchestration.combined_visit_possible && (
                                                <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                                                    <p className="text-xs text-cyan-200">
                                                        Combined visit possible — appointments may be scheduled together to minimize visits
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* SECTION 6: Available Appointment Slots */}
                        <AnimatePresence>
                            {(phase === "SLOTS" || phase === "CONFIRM") && slots.length > 0 && (
                                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15, delay: 0.15 }}>
                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">Available Appointments ({slots.length})</h3>
                                            <p className="card-subtitle">Select your preferred time slot</p>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            {slots.slice(0, 8).map((slot, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => { setSelectedSlot(slot); setPhase("CONFIRM"); }}
                                                    className={`grid grid-cols-[100px_80px_1fr_auto] gap-4 items-center p-4 w-full text-left rounded-lg border transition-all ${selectedSlot === slot
                                                        ? "bg-cyan-500/10 border-cyan-500"
                                                        : "bg-brand-input border-white/5 hover:border-white/20"
                                                        }`}
                                                >
                                                    <span className="text-sm font-medium text-white">{slot.date}</span>
                                                    <span className="text-sm font-semibold text-cyan-400">{slot.time}</span>
                                                    <div className="min-w-0">
                                                        <p className="text-sm text-brand-text-secondary truncate">
                                                            {slot.doctor_name}
                                                        </p>
                                                        <p className="text-xs text-brand-text-muted truncate">
                                                            {slot.clinic_name}
                                                        </p>
                                                    </div>
                                                    <span className="text-xs text-brand-text-muted whitespace-nowrap">
                                                        {slot.duration_minutes} min
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* SECTION 7: Appointment Confirmation */}
                        <AnimatePresence>
                            {phase === "CONFIRM" && selectedSlot && (
                                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">Confirm Appointment</h3>
                                            <p className="card-subtitle">Review and finalize booking</p>
                                        </div>

                                        {/* Appointment Details Grid */}
                                        <div className="grid grid-cols-2 gap-4 p-4 bg-brand-input rounded-lg mb-4">
                                            <div className="flex items-start gap-3">
                                                <Calendar size={16} className="text-brand-text-muted mt-0.5" />
                                                <div>
                                                    <p className="text-xs text-brand-text-muted uppercase tracking-wider mb-1">Date</p>
                                                    <p className="text-sm font-medium text-white">{selectedSlot.date}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <Clock size={16} className="text-brand-text-muted mt-0.5" />
                                                <div>
                                                    <p className="text-xs text-brand-text-muted uppercase tracking-wider mb-1">Time</p>
                                                    <p className="text-sm font-medium text-white">{selectedSlot.time} – {selectedSlot.end_time}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <User size={16} className="text-brand-text-muted mt-0.5" />
                                                <div>
                                                    <p className="text-xs text-brand-text-muted uppercase tracking-wider mb-1">Provider</p>
                                                    <p className="text-sm font-medium text-white">{selectedSlot.doctor_name}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <Activity size={16} className="text-brand-text-muted mt-0.5" />
                                                <div>
                                                    <p className="text-xs text-brand-text-muted uppercase tracking-wider mb-1">Duration</p>
                                                    <p className="text-sm font-medium text-white">{selectedSlot.duration_minutes} min</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Optional Notes */}
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-brand-text-secondary mb-2">
                                                Notes for Provider (optional)
                                            </label>
                                            <textarea
                                                value={bookingNotes}
                                                onChange={(e) => setBookingNotes(e.target.value)}
                                                placeholder="Any additional information..."
                                                className="w-full min-h-[80px] resize-vertical p-3 text-sm leading-relaxed bg-brand-input border border-white/10 rounded-lg text-white placeholder-brand-text-muted focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                                            />
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-3">
                                            {bookingBlocked ? (
                                                <div className="flex-1 border-l-4 border-amber-500 bg-amber-500/10 rounded-lg p-4">
                                                    <p className="text-sm font-medium text-amber-200 mb-2">
                                                        {isEmergency
                                                            ? "Online booking is not available for emergency cases."
                                                            : "Additional clinical review is required before booking."
                                                        }
                                                    </p>
                                                    <p className="text-xs text-amber-300/70">
                                                        Please contact the clinic directly to schedule your appointment.
                                                    </p>
                                                </div>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={handleConfirmBooking}
                                                        disabled={loading}
                                                        className="btn-primary flex-1"
                                                    >
                                                        {loading ? "Booking..." : "Confirm Appointment"}
                                                    </button>
                                                    <button
                                                        onClick={() => { setSelectedSlot(null); setPhase("SLOTS"); }}
                                                        className="btn-secondary"
                                                    >
                                                        Back
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Booking Confirmation Success */}
                        <AnimatePresence>
                            {phase === "BOOKED" && (
                                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                                    <div className="border-l-4 border-emerald-500 bg-emerald-500/10 rounded-lg p-5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <CheckCircle2 size={18} className="text-emerald-500" />
                                            <h4 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">
                                                Appointment Confirmed
                                            </h4>
                                        </div>
                                        {selectedSlot && (
                                            <p className="text-sm text-emerald-200 mb-4">
                                                {selectedSlot.date} at {selectedSlot.time} with {selectedSlot.doctor_name}
                                            </p>
                                        )}
                                        <button
                                            onClick={handleNewIntake}
                                            className="btn-secondary text-sm"
                                        >
                                            New Intake
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* RIGHT PANEL - Case Summary */}
                    <div className="flex flex-col gap-4 lg:sticky lg:top-6">
                        {/* Case Summary Card */}
                        <div className="card">
                            <h6 className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-4">
                                Case Summary
                            </h6>
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-brand-text-muted">Status</span>
                                    <span className="text-xs font-medium text-white">
                                        {phase === "INPUT" ? "Awaiting Information" :
                                            phase === "CLARIFY" ? "Pending Clarification" :
                                                phase === "RESULTS" ? "Under Review" :
                                                    phase === "SLOTS" ? "Slot Selection" :
                                                        phase === "CONFIRM" ? "Pending Confirmation" :
                                                            "Complete"}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-brand-text-muted">Urgency</span>
                                    <span className="text-xs font-medium" style={{
                                        color: orchestration ? urgencyColor(orchestration.overall_urgency) : "var(--text-white)"
                                    }}>
                                        {orchestration ? urgencyLabel(orchestration.overall_urgency) : "—"}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-brand-text-muted">Issues Identified</span>
                                    <span className="text-xs font-medium text-white">
                                        {orchestration ? `${Math.max(orchestration.routed_issues.length, isEmergency ? 1 : 0)}` : "—"}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-brand-text-muted">Risk Flags</span>
                                    <span className="text-xs font-medium" style={{
                                        color: isEmergency ? "var(--clinical-urgent)" : "var(--text-white)"
                                    }}>
                                        {isEmergency ? (breathingDifficulty ? "Emergency • Airway" : "Emergency") : "None"}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-brand-text-muted">Last Updated</span>
                                    <span className="text-xs font-medium text-white">{lastUpdated || "—"}</span>
                                </div>
                            </div>

                            {/* Selected Slot Preview */}
                            {selectedSlot && (
                                <div className="pt-4 mt-4 border-t border-white/5">
                                    <h6 className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-2">
                                        Selected Appointment
                                    </h6>
                                    <p className="text-sm font-medium text-white mb-1">
                                        {selectedSlot.date} at {selectedSlot.time}
                                    </p>
                                    <p className="text-xs text-brand-text-secondary">
                                        {selectedSlot.doctor_name}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Clinical Safety Notice */}
                        <div className="card">
                            <div className="flex items-center gap-2 mb-3">
                                <Shield size={14} className="text-brand-text-muted" />
                                <h6 className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                                    Clinical Safety Notice
                                </h6>
                            </div>
                            <p className="text-xs text-brand-text-disabled leading-relaxed">
                                This system assists with appointment routing only. It does not provide diagnosis or treatment.
                                All cases are reviewed by licensed dental professionals.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout >
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="card">
            <h6 className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-4">
                {title}
            </h6>
            {children}
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-brand-text-secondary">{label}</label>
            {children}
        </div>
    );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="p-3 bg-brand-input rounded-lg">
            <h6 className="text-xs font-medium text-brand-text-muted uppercase tracking-wider mb-1">
                {label}
            </h6>
            <div className="text-sm font-semibold" style={{ color }}>
                {value}
            </div>
        </div>
    );
}

function SummaryRow({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-xs text-brand-text-muted">{label}</span>
            <span className="text-xs font-medium" style={{ color: color || "var(--text-primary)" }}>
                {value}
            </span>
        </div>
    );
}

function DetailField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-start gap-3">
            <span className="text-brand-text-muted mt-0.5">{icon}</span>
            <div>
                <p className="text-xs text-brand-text-muted uppercase tracking-wider mb-1">{label}</p>
                <p className="text-sm font-medium text-white">{value}</p>
            </div>
        </div>
    );
}