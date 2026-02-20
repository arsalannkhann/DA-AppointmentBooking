"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    AlertTriangle,
    CheckCircle2,
    Shield,
    RotateCcw,
    Phone,
    MapPin,
    Send,
    Loader2,
    Bot,
    Paperclip,
    Mic,
    ArrowUp
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { analyzeSymptoms } from "@/lib/api";

type ClarificationFieldType = "text" | "select" | "multiselect" | "slider" | "boolean" | "textarea";
type ClarificationValue = string | number | string[];

interface ClarificationField {
    field_key: string;
    label: string;
    type: ClarificationFieldType;
    options?: string[];
    required: boolean;
    min?: number;
    max?: number;
}

interface RoutedIssue {
    issue_index: number;
    symptom_cluster: string;
    urgency: string;
    specialist_type: string;
    appointment_type: string;
    requires_sedation: boolean;
    procedure_id?: number | null;
    procedure_name?: string;
}

interface Message {
    id: string;
    role: "bot" | "user";
    content: string;
    timestamp: Date;
    isEmergency?: boolean;
    clarification_fields?: ClarificationField[];
    field_submission?: Record<string, ClarificationValue>;
    suggested_action?: "CLARIFY" | "ROUTE" | "ESCALATE" | "GREETING" | "SMALL_TALK" | "ORCHESTRATE";
    routed_issues?: RoutedIssue[];
}

interface TriageResponse {
    message: string;
    suggested_action: "CLARIFY" | "ROUTE" | "ESCALATE" | "GREETING" | "SMALL_TALK" | "ORCHESTRATE";
    clarification_questions?: string[];
    clarification_fields?: ClarificationField[];
    routed_issues?: RoutedIssue[];
    emergency_slot?: unknown;
    overall_urgency?: string;
    allow_free_text_with_clarification?: boolean;
    issues?: unknown[]; // Full clinical state from backend
    clarification?: {
        issues?: Array<{
            issue_id: string;
            summary: string;
            missing_fields: ClarificationField[];
            status?: string;
            missing_elements?: string[];
        }>;
        mode?: string;
    };
}

function flattenClarificationFieldsFromPayload(data: TriageResponse): ClarificationField[] | undefined {
    const issues = data.clarification?.issues || [];
    if (!issues.length) return undefined;

    const dedupedByKey = new Map<string, ClarificationField>();
    issues.forEach((issue, issueIndex) => {
        (issue.missing_fields || []).forEach((field, fieldIndex) => {
            const baseKey = field.field_key || `field_${issueIndex + 1}_${fieldIndex + 1}`;
            const key = dedupedByKey.has(baseKey) ? `${baseKey}_${issueIndex + 1}` : baseKey;
            dedupedByKey.set(key, { ...field, field_key: key });
        });
    });

    return Array.from(dedupedByKey.values());
}

function getClarificationSignature(fields?: ClarificationField[]): string {
    if (!fields?.length) return "";
    return fields.map((field) => field.field_key).sort().join("|");
}

function formatFieldValue(value: ClarificationValue | undefined): string {
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "number") return `${value}`;
    return value || "Not provided";
}

function isFieldFilled(field: ClarificationField, value: ClarificationValue | undefined): boolean {
    if (!field.required) return true;
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
}

function buildHistory(messages: Message[]): { role: "assistant" | "user"; content: string }[] {
    return messages.map((message) => ({
        role: message.role === "bot" ? "assistant" : "user",
        content: message.content,
    }));
}

function cleanAssistantContent(content: string): string {
    return content
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1");
}

function summarizeClarificationContent(content: string): string {
    const stripped = cleanAssistantContent(content)
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("•"))
        .join("\n")
        .trim();
    return stripped || "Please complete the required fields below.";
}

export default function ClinicalIntakeChat() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const role = (user?.role as "patient" | "admin") || "patient";

    const [messages, setMessages] = useState<Message[]>([
        {
            id: "bot-init",
            role: "bot",
            content: "Welcome to SmartDental Clinical Intake. I'm here to help you get the right care. Please describe your symptoms or concern in your own words.",
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
    const [activeAction, setActiveAction] = useState<string>("");

    const [activeClarificationFields, setActiveClarificationFields] = useState<ClarificationField[] | null>(null);
    const [pendingStructuredData, setPendingStructuredData] = useState<Record<string, ClarificationValue>>({});
    const [activeClarificationSignature, setActiveClarificationSignature] = useState<string | null>(null);
    const [lastClarificationSignature, setLastClarificationSignature] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [allowFreeTextDuringClarification, setAllowFreeTextDuringClarification] = useState(false);

    // Store the full clinical state (issues) returned by the backend
    const [clinicalState, setClinicalState] = useState<{ issues: unknown[] } | null>(null);

    const lastStructuredSubmissionSignatureRef = useRef<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping, suggestedQuestions]);

    const applyResponse = useCallback((data: TriageResponse) => {
        const structuredFieldsFromPayload = flattenClarificationFieldsFromPayload(data);
        const incomingFields = structuredFieldsFromPayload && structuredFieldsFromPayload.length > 0
            ? structuredFieldsFromPayload
            : data.clarification_fields && data.clarification_fields.length > 0
                ? data.clarification_fields
                : undefined;
        const incomingSignature = getClarificationSignature(incomingFields);
        const repeatedAfterStructuredSubmit = Boolean(
            incomingSignature &&
            incomingSignature === lastClarificationSignature &&
            incomingSignature === lastStructuredSubmissionSignatureRef.current
        );

        if (repeatedAfterStructuredSubmit) {
            const fallbackMessage: Message = {
                id: `bot-loop-guard-${Date.now()}`,
                role: "bot",
                content: "Thank you. Processing your information.",
                timestamp: new Date(),
                suggested_action: data.suggested_action,
                isEmergency: data.suggested_action === "ESCALATE",
                routed_issues: data.routed_issues || [],
            };

            setMessages((prev) => [...prev, fallbackMessage]);
            setSuggestedQuestions([]);
            setActiveAction(data.suggested_action);
            setActiveClarificationFields(null);
            setPendingStructuredData({});
            setFieldErrors({});
            setActiveClarificationSignature(null);
            setAllowFreeTextDuringClarification(false);

            // Update clinical state so we don't lose context
            if (data.issues) {
                setClinicalState({ issues: data.issues });
            }
            return;
        }

        const botMessage: Message = {
            id: `bot-${Date.now()}`,
            role: "bot",
            content: data.message,
            timestamp: new Date(),
            suggested_action: data.suggested_action,
            isEmergency: data.suggested_action === "ESCALATE",
            clarification_fields: incomingFields,
            routed_issues: data.routed_issues || [],
        };

        setMessages((prev) => [...prev, botMessage]);
        setSuggestedQuestions(
            data.suggested_action === "CLARIFY" && (!incomingFields || incomingFields.length === 0)
                ? (data.clarification_questions || [])
                : []
        );
        setActiveAction(data.suggested_action);

        // Update clinical state
        if (data.issues) {
            setClinicalState({ issues: data.issues });
        }

        if (incomingFields?.length) {
            setActiveClarificationFields(incomingFields);
            setPendingStructuredData({});
            setFieldErrors({});
            setActiveClarificationSignature(incomingSignature);
            setLastClarificationSignature(incomingSignature);
            setAllowFreeTextDuringClarification(Boolean(data.allow_free_text_with_clarification));
        } else {
            setActiveClarificationFields(null);
            setPendingStructuredData({});
            setFieldErrors({});
            setActiveClarificationSignature(null);
            setAllowFreeTextDuringClarification(false);
        }
    }, [lastClarificationSignature]);

    const sendTextMessage = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        if (isAuthLoading || !isAuthenticated) {
            setMessages((prev) => [
                ...prev,
                {
                    id: `bot-auth-required-${Date.now()}`,
                    role: "bot",
                    content: "Please sign in before using clinical triage.",
                    timestamp: new Date(),
                    isEmergency: false,
                },
            ]);
            return;
        }

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: "user",
            content: trimmed,
            timestamp: new Date(),
        };

        const nextMessages = [...messages, userMessage];
        setMessages(nextMessages);
        setInput("");
        setSuggestedQuestions([]);
        setIsLoading(true);
        setIsTyping(true);

        try {
            const data: TriageResponse = await analyzeSymptoms({
                symptoms: trimmed,
                user_input: trimmed,
                structured_data: clinicalState, // Pass current clinical state
                history: buildHistory(nextMessages),
            });

            setTimeout(() => {
                applyResponse(data);
                setIsLoading(false);
                setIsTyping(false);

                if (
                    data.suggested_action === "CLARIFY" ||
                    data.suggested_action === "GREETING" ||
                    data.suggested_action === "SMALL_TALK"
                ) {
                    setTimeout(() => inputRef.current?.focus(), 100);
                }
            }, 450);
        } catch (error) {
            console.error("API Error:", error);
            setIsLoading(false);
            setIsTyping(false);

            const errMsg = error instanceof Error ? error.message : "Unknown error";
            setMessages((prev) => [
                ...prev,
                {
                    id: `bot-err-${Date.now()}`,
                    role: "bot",
                    content: errMsg.includes("401") || errMsg.includes("Unauthorized")
                        ? "Your session has expired. Please log in again."
                        : "I apologize, but I'm having trouble connecting to the clinical engine right now. Please try again or call our office.",
                    timestamp: new Date(),
                    isEmergency: false,
                },
            ]);
        }
    }, [messages, applyResponse, isAuthenticated, isAuthLoading, clinicalState]);

    const handleInputSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendTextMessage(input);
    };

    const handleSuggestionClick = (question: string) => {
        sendTextMessage(question);
    };

    const handleViewSlots = useCallback((issues?: RoutedIssue[]) => {
        if (issues?.length) {
            try {
                sessionStorage.setItem("triageRoutedIssues", JSON.stringify(issues));
            } catch {
                // Ignore storage failures and continue navigation
            }
        }
        if (role === "patient") {
            router.push("/patient/book");
            return;
        }
        router.push("/admin/appointments");
    }, [role, router]);

    const handleStructuredFieldChange = (field: ClarificationField, value: ClarificationValue) => {
        setPendingStructuredData((prev) => ({
            ...prev,
            [field.field_key]: value,
        }));

        if (fieldErrors[field.field_key]) {
            setFieldErrors((prev) => {
                const updated = { ...prev };
                delete updated[field.field_key];
                return updated;
            });
        }
    };

    const handleStructuredSubmit = async () => {
        if (!activeClarificationFields?.length || isLoading) return;
        if (isAuthLoading || !isAuthenticated) {
            setMessages((prev) => [
                ...prev,
                {
                    id: `bot-auth-required-${Date.now()}`,
                    role: "bot",
                    content: "Your session is not active. Please sign in and try again.",
                    timestamp: new Date(),
                    isEmergency: false,
                },
            ]);
            return;
        }

        const validationErrors: Record<string, string> = {};
        activeClarificationFields.forEach((field) => {
            const value = pendingStructuredData[field.field_key];
            if (!isFieldFilled(field, value)) {
                validationErrors[field.field_key] = `${field.label} is required`;
            }
        });

        if (Object.keys(validationErrors).length > 0) {
            setFieldErrors(validationErrors);
            return;
        }

        const submission = activeClarificationFields.reduce<Record<string, ClarificationValue>>((acc, field) => {
            const value = pendingStructuredData[field.field_key];
            if (value !== undefined) acc[field.field_key] = value;
            return acc;
        }, {});

        const submissionSummary = activeClarificationFields
            .map((field) => `- ${field.label}: ${formatFieldValue(submission[field.field_key])}`)
            .join("\n");

        const userSubmissionMessage: Message = {
            id: `user-structured-${Date.now()}`,
            role: "user",
            content: `Submitted clarification:\n${submissionSummary}`,
            timestamp: new Date(),
            field_submission: submission,
        };

        const nextMessages = [...messages, userSubmissionMessage];
        setMessages(nextMessages);

        lastStructuredSubmissionSignatureRef.current = activeClarificationSignature;
        setActiveClarificationFields(null);
        setPendingStructuredData({});
        setFieldErrors({});
        setActiveClarificationSignature(null);
        setAllowFreeTextDuringClarification(false);
        setSuggestedQuestions([]);

        setIsLoading(true);
        setIsTyping(true);

        try {
            const data: TriageResponse = await analyzeSymptoms({
                symptoms: "",
                user_input: null,
                structured_data: {
                    issues: clinicalState?.issues || [],
                    answers: submission,
                },
                history: buildHistory(nextMessages),
            });

            setTimeout(() => {
                applyResponse(data);
                setIsLoading(false);
                setIsTyping(false);
            }, 450);
        } catch (error) {
            console.error("Structured API Error:", error);
            setIsLoading(false);
            setIsTyping(false);

            setMessages((prev) => [
                ...prev,
                {
                    id: `bot-structured-err-${Date.now()}`,
                    role: "bot",
                    content: "I couldn't process the clarification response. Please try again.",
                    timestamp: new Date(),
                    isEmergency: false,
                },
            ]);
        }
    };

    const handleReset = useCallback(() => {
        setMessages([]);
        setTimeout(() => {
            const initialMessage: Message = {
                id: "bot-init",
                role: "bot",
                content: "Welcome to SmartDental Clinical Intake. I'm here to help you get the right care. Please describe your symptoms or concern in your own words.",
                timestamp: new Date(),
            };
            setMessages([initialMessage]);
            setInput("");
            setSuggestedQuestions([]);
            setActiveAction("");
            setActiveClarificationFields(null);
            setPendingStructuredData({});
            setFieldErrors({});
            setActiveClarificationSignature(null);
            setLastClarificationSignature(null);
            setAllowFreeTextDuringClarification(false);
            setClinicalState(null);
            lastStructuredSubmissionSignatureRef.current = null;
        }, 100);
    }, []);

    const hasActiveStructuredClarification = Boolean(activeClarificationFields && activeClarificationFields.length > 0);
    const textInputDisabled = isLoading
        || isAuthLoading
        || !isAuthenticated
        || activeAction === "ESCALATE"
        || (hasActiveStructuredClarification && !allowFreeTextDuringClarification);

    return (
        <DashboardLayout
            role={role}
            title="Clinical Intake"
            subtitle="AI-Powered Clinical Triage & Orchestration"
        >
            <div className="flex-1 flex flex-col relative h-[calc(100vh-8rem)] bg-background-light rounded-2xl overflow-hidden border border-border-subtle">
                <header className="glass absolute top-0 w-full z-10 border-b border-border-subtle/50 h-[72px] flex items-center justify-between px-6 transition-colors rounded-t-2xl">
                    <div className="flex items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-xs text-text-secondary mb-0.5">
                                <span>Patients</span>
                                <span className="material-symbols-outlined text-[10px] font-bold">&gt;</span>
                                <span>Active Session</span>
                            </div>
                            <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                                Intake Session
                                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wide">Live</span>
                            </h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="p-2 text-text-secondary hover:text-primary hover:bg-primary/5 rounded-full transition-colors relative">
                            <Shield size={20} className={activeAction === "ESCALATE" ? "text-red-500" : ""} />
                            {activeAction === "ESCALATE" && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>}
                        </button>
                        <div className="h-8 w-px bg-border-subtle mx-1"></div>
                        <button onClick={handleReset} className="bg-primary hover:bg-primary-dark text-white text-sm font-semibold py-2.5 px-5 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center gap-2 group">
                            <RotateCcw size={18} className="group-hover:-rotate-90 transition-transform" />
                            Restart
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto scrollbar-hide pt-[80px] pb-[100px] px-4 md:px-8">
                    <div className="max-w-3xl mx-auto flex flex-col gap-6 py-6">
                        <div className="flex justify-center flex-col items-center gap-2">
                            <span className="bg-slate-100 text-text-secondary text-xs font-medium px-4 py-1.5 rounded-full">
                                Today, {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div className="p-3 bg-white border border-border-subtle text-center rounded-lg max-w-[90%] shadow-sm">
                                <p className="text-[10px] text-text-secondary">
                                    This is a clinical decision support tool. Final diagnosis and treatment planning require evaluation by a licensed medical professional.
                                </p>
                            </div>
                        </div>

                        {messages.map((message) => {
                            const messageSignature = getClarificationSignature(message.clarification_fields);
                            const renderStructuredForm = Boolean(
                                message.clarification_fields?.length &&
                                message.role === "bot" &&
                                activeClarificationSignature &&
                                messageSignature === activeClarificationSignature
                            );

                            return (
                                <motion.div
                                    key={message.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex gap-4 items-end group ${message.role === "bot" ? "" : "justify-end"}`}
                                >
                                    {message.role === "bot" && (
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                                            {message.isEmergency ? <AlertTriangle size={16} /> : <Bot size={16} />}
                                        </div>
                                    )}

                                    <div className={`flex flex-col gap-1 max-w-[80%] ${message.role === "bot" ? "" : "items-end"}`}>
                                        <span className={`text-xs font-medium text-text-secondary ${message.role === "bot" ? "ml-1" : "mr-1"}`}>
                                            {message.role === "bot" ? "HealthAI Bot" : user?.patient_name || user?.clinic_name || "Dr. Smith"}
                                        </span>

                                        <div className={`${message.role === "bot"
                                            ? `bg-white p-4 rounded-2xl rounded-bl-sm shadow-soft border border-slate-100 text-text-main leading-relaxed ${message.isEmergency ? "border-red-500 bg-red-50" : ""}`
                                            : "bg-primary text-white p-4 rounded-2xl rounded-br-sm shadow-md shadow-primary/10 leading-relaxed"
                                            }`}>

                                            {message.isEmergency && (
                                                <div className="flex items-center gap-2 text-red-600 font-bold text-sm mb-2">
                                                    <AlertTriangle size={16} />
                                                    <span>Emergency Alert</span>
                                                </div>
                                            )}

                                            <div className="whitespace-pre-wrap">
                                                {renderStructuredForm
                                                    ? summarizeClarificationContent(message.content)
                                                    : cleanAssistantContent(message.content)}
                                            </div>

                                            {renderStructuredForm && message.clarification_fields && (
                                                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4 shadow-sm">
                                                    {message.clarification_fields.map((field) => {
                                                        const value = pendingStructuredData[field.field_key];
                                                        const error = fieldErrors[field.field_key];

                                                        return (
                                                            <div key={field.field_key} className="space-y-2">
                                                                <label className="block text-sm font-medium text-slate-700">
                                                                    {field.label}
                                                                    {field.required && <span className="text-red-500 ml-1">*</span>}
                                                                </label>

                                                                {field.type === "text" && (
                                                                    <input
                                                                        type="text"
                                                                        value={typeof value === "string" ? value : ""}
                                                                        onChange={(e) => handleStructuredFieldChange(field, e.target.value)}
                                                                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none"
                                                                        placeholder={`Enter ${field.label.toLowerCase()}`}
                                                                    />
                                                                )}

                                                                {field.type === "textarea" && (
                                                                    <textarea
                                                                        value={typeof value === "string" ? value : ""}
                                                                        onChange={(e) => handleStructuredFieldChange(field, e.target.value)}
                                                                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none min-h-[88px]"
                                                                        placeholder={`Enter ${field.label.toLowerCase()}`}
                                                                    />
                                                                )}

                                                                {field.type === "select" && (
                                                                    <select
                                                                        value={typeof value === "string" ? value : ""}
                                                                        onChange={(e) => handleStructuredFieldChange(field, e.target.value)}
                                                                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none"
                                                                    >
                                                                        <option value="">Select an option</option>
                                                                        {(field.options || []).map((option) => (
                                                                            <option key={option} value={option}>
                                                                                {option}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                )}

                                                                {field.type === "boolean" && (
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleStructuredFieldChange(field, "Yes")}
                                                                            className={`px-3 py-1.5 rounded-md text-xs border font-medium ${value === "Yes"
                                                                                ? "bg-primary text-white border-primary"
                                                                                : "bg-white text-slate-700 border-slate-300 hover:border-primary transition-colors"
                                                                                }`}
                                                                        >
                                                                            Yes
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleStructuredFieldChange(field, "No")}
                                                                            className={`px-3 py-1.5 rounded-md text-xs border font-medium ${value === "No"
                                                                                ? "bg-primary text-white border-primary"
                                                                                : "bg-white text-slate-700 border-slate-300 hover:border-primary transition-colors"
                                                                                }`}
                                                                        >
                                                                            No
                                                                        </button>
                                                                    </div>
                                                                )}

                                                                {field.type === "multiselect" && (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {(field.options || []).map((option) => {
                                                                            const selectedValues = Array.isArray(value) ? value : [];
                                                                            const isSelected = selectedValues.includes(option);
                                                                            return (
                                                                                <button
                                                                                    key={option}
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const nextValues = isSelected
                                                                                            ? selectedValues.filter((item) => item !== option)
                                                                                            : [...selectedValues, option];
                                                                                        handleStructuredFieldChange(field, nextValues);
                                                                                    }}
                                                                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${isSelected
                                                                                        ? "bg-primary text-white border-primary"
                                                                                        : "bg-white text-slate-700 border-slate-300 hover:border-primary"
                                                                                        }`}
                                                                                >
                                                                                    {option}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}

                                                                {field.type === "slider" && (
                                                                    <div className="space-y-2">
                                                                        <input
                                                                            type="range"
                                                                            min={field.min ?? 1}
                                                                            max={field.max ?? 10}
                                                                            value={typeof value === "number" ? value : field.min ?? 1}
                                                                            onChange={(e) => handleStructuredFieldChange(field, Number(e.target.value))}
                                                                            className="w-full accent-primary"
                                                                        />
                                                                        <div className="text-xs text-slate-500 font-medium text-center">
                                                                            Value: {typeof value === "number" ? value : field.min ?? 1}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {error && (
                                                                    <p className="text-xs text-red-600 font-medium">{error}</p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}

                                                    <button
                                                        type="button"
                                                        onClick={handleStructuredSubmit}
                                                        disabled={isLoading}
                                                        className="w-full rounded-xl bg-primary shadow-sm shadow-primary/20 text-white py-3 text-sm font-semibold tracking-wide hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                    >
                                                        Submit Response
                                                    </button>
                                                </div>
                                            )}

                                            {message.routed_issues && message.routed_issues.length > 0 && (
                                                <div className="mt-3 rounded-xl p-4 border border-slate-200 bg-slate-50 shadow-sm text-slate-900">
                                                    {message.routed_issues.map((issue, idx) => (
                                                        <div key={idx} className="flex items-start gap-2 mb-2 last:mb-0">
                                                            <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                                                            <div className="text-sm">
                                                                <span className="font-semibold block text-slate-800">{issue.specialist_type} Evaluation</span>
                                                                <span className="text-xs text-slate-500">{issue.symptom_cluster}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <div className="mt-3 pt-3 border-t border-slate-200 flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleViewSlots(message.routed_issues)}
                                                            className="flex-1 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-dark shadow-sm shadow-primary/10 transition-colors"
                                                        >
                                                            View Slots
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="flex-1 py-2 bg-white border border-slate-200 shadow-sm text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                                                        >
                                                            Coordinator
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {message.isEmergency && (
                                                <div className="mt-3 flex flex-col gap-2">
                                                    <a href="tel:911" className="flex items-center justify-center gap-2 py-2 bg-red-600/10 text-red-700 border border-red-200 rounded-lg font-bold text-sm hover:bg-red-600/20 shadow-sm">
                                                        <Phone size={16} /> Call Emergency Services
                                                    </a>
                                                    <a href="#" className="flex items-center justify-center gap-2 py-2 bg-white text-slate-800 border border-slate-200 rounded-lg font-semibold text-sm hover:bg-slate-50 shadow-sm">
                                                        <MapPin size={16} /> Find Urgent Care
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {message.role === "user" && (
                                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white shrink-0 shadow-sm border border-slate-200 text-xs font-bold">
                                            {(user?.patient_name || user?.clinic_name || "Pt").substring(0, 2).toUpperCase()}
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}

                        {!hasActiveStructuredClarification && suggestedQuestions.length > 0 && (
                            <div className="flex gap-4 items-end group">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                                    <Bot size={16} />
                                </div>
                                <div className="flex flex-col gap-1 max-w-[80%]">
                                    <span className="text-xs font-medium text-text-secondary ml-1">Suggested Options</span>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {suggestedQuestions.map((question, index) => (
                                            <button
                                                key={`${question}-${index}`}
                                                type="button"
                                                onClick={() => handleSuggestionClick(question)}
                                                className="text-xs bg-white border border-slate-200 hover:border-primary hover:text-primary text-text-secondary px-3 py-1.5 rounded-full transition-colors font-medium shadow-sm"
                                            >
                                                {question}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {isTyping && (
                            <div className="flex gap-4 items-end group">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-sm opacity-50">
                                    <Bot size={16} />
                                </div>
                                <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm shadow-soft border border-slate-100 flex items-center gap-1.5 h-[48px]">
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background-light via-background-light to-transparent pointer-events-none">
                    <div className="max-w-3xl mx-auto pointer-events-auto">
                        {activeAction === "ESCALATE" && (
                            <div className="mb-3 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm text-center backdrop-blur-md">
                                Emergency escalation is active. Text input is disabled while urgent instructions are shown.
                            </div>
                        )}

                        <form onSubmit={handleInputSubmit} className="bg-white rounded-full shadow-floating border border-slate-200 p-2 pl-6 flex items-center gap-3 transition-shadow focus-within:shadow-xl focus-within:border-primary/30">
                            <button type="button" className="text-text-secondary hover:text-primary transition-colors p-1" title="Attach File">
                                <Paperclip size={20} />
                            </button>
                            <button type="button" className="text-text-secondary hover:text-primary transition-colors p-1" title="Voice Input">
                                <Mic size={20} />
                            </button>
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={
                                    textInputDisabled && hasActiveStructuredClarification
                                        ? "Please submit the clarification form above..."
                                        : isLoading
                                            ? "Analyzing..."
                                            : "Type patient response or symptoms..."
                                }
                                disabled={textInputDisabled}
                                className="flex-1 bg-transparent border-none outline-none text-text-main placeholder-slate-400 text-sm focus:ring-0 h-10 shadow-none ring-0 w-full"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || textInputDisabled}
                                className="bg-primary hover:bg-primary-dark text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                title="Send Message"
                            >
                                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} />}
                            </button>
                        </form>

                        <div className="text-center mt-3">
                            <p className="text-[10px] text-text-secondary">AI can make mistakes. Please review generated notes.</p>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
