"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
    Send,
    Calendar,
    Clock,
    MapPin,
    User,
    Stethoscope,
    AlertCircle,
    CheckCircle2,
    X,
    ChevronRight,
    Sparkles,
    Shield,
    RotateCcw,
    ArrowRight,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { analyzeSymptoms, searchSlots, bookAppointment } from "@/lib/api";

interface Message {
    role: "assistant" | "user";
    content: string;
    slots?: SlotData[];
    emergency?: boolean;
    emergencySlot?: Record<string, unknown>;
    booked?: boolean;
    triage?: TriageData;
}

interface SlotData {
    type: string;
    date: string;
    time: string;
    end_time: string;
    time_block: number;
    duration_minutes: number;
    doctor_id: string;
    doctor_name: string;
    room_id: string;
    room_name: string;
    clinic_id: string;
    staff_id?: string;
    staff_name?: string;
    procedure: string;
    consult_end_time?: string;
    treatment_start_time?: string;
    score: number;
}

interface TriageData {
    procedure_name: string;
    specialist_type: string;
    treatment_minutes: number;
    consult_minutes: number;
    requires_sedation: boolean;
    room_capability: boolean;
    procedure_id: number;
}

type FlowStep = "WELCOME" | "TRIAGE" | "SLOTS" | "CONFIRM" | "DONE";

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1 },
    },
};

const messageVariants: Variants = {
    hidden: { opacity: 0, y: 10, scale: 0.95 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
    },
};

import { useAuth } from "@/context/AuthContext";

// ... (imports remain the same, just adding useAuth)

export default function ChatPage() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [step, setStep] = useState<FlowStep>("WELCOME");
    const [loading, setLoading] = useState(false);
    const [patientId, setPatientId] = useState<string | null>(null);
    const [patientName, setPatientName] = useState("");
    const [triageData, setTriageData] = useState<TriageData | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<SlotData | null>(null);
    const [clarificationCount, setClarificationCount] = useState(0);

    useEffect(() => {
        if (authLoading) return;

        if (!user || user.role !== "patient") {
            // AuthContext handles redirect
            return;
        }

        const pId = user.user_id;
        const pName = user.patient_name || "Patient";
        setPatientId(pId);
        setPatientName(pName);

        if (messages.length === 0) {
            setMessages([
                {
                    role: "assistant",
                    content: `Hello${pName ? ", " + pName : ""}! I'm your SmartDental AI assistant. I can help you book the right dental appointment.`,
                },
            ]);
            setStep("TRIAGE");
        }
    }, [user, authLoading]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    const addMsg = (msg: Message) => setMessages((prev) => [...prev, msg]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        const text = input.trim();
        setInput("");
        addMsg({ role: "user", content: text });

        if (step === "TRIAGE") {
            await handleTriage(text, messages);
        }
    };

    const handleTriage = async (text: string, history: Message[]) => {
        setLoading(true);
        try {
            const res = await analyzeSymptoms(text, history);
            const action = res.action || "ROUTE";
            const intent = res.intent || {};

            if (action === "GREET") {
                addMsg({ role: "assistant", content: res.message });
                setClarificationCount(0);
                return;
            }

            if (action === "CLARIFY") {
                const count = clarificationCount + 1;
                setClarificationCount(count);
                let msg = res.message;
                if (count >= 3) {
                    msg +=
                        "\n\n**Tip:** Try describing location, pain type, duration, and visible issues.";
                }
                addMsg({ role: "assistant", content: msg });
                return;
            }

            if (action === "EMERGENCY") {
                setTriageData(res.triage);
                addMsg({
                    role: "assistant",
                    content: res.message,
                    emergency: true,
                    emergencySlot: res.emergency_slot,
                });
                if (res.emergency_slot) {
                    setSelectedSlot(res.emergency_slot as unknown as SlotData);
                    setStep("CONFIRM");
                }
                setClarificationCount(0);
                return;
            }

            if (!res.triage) {
                addMsg({
                    role: "assistant",
                    content:
                        res.message ||
                        "I couldn't find a matching procedure. Could you provide additional details?",
                });
                return;
            }

            const triage: TriageData = res.triage;
            setTriageData(triage);
            setClarificationCount(0);

            addMsg({
                role: "assistant",
                content: `**Analysis Complete**\n\nI've identified your needs. Searching for available slots...`,
                triage: triage,
            });

            const slotsRes = await searchSlots(
                triage.procedure_id,
                triage.requires_sedation
            );
            const allSlots = [
                ...(slotsRes.combo_slots || []),
                ...(slotsRes.single_slots || []),
            ];

            if (allSlots.length === 0) {
                addMsg({
                    role: "assistant",
                    content: `${slotsRes.note || "No available slots found."}\n\nPlease contact the clinic directly.`,
                });
                return;
            }

            addMsg({
                role: "assistant",
                content: `I found **${allSlots.length}** available slots. Please select one from the panel on the right.`,
                slots: allSlots,
            });
            setStep("SLOTS");
        } catch (err: unknown) {
            addMsg({
                role: "assistant",
                content: `Sorry, I encountered an error. Please try again.`,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSelectSlot = (slot: SlotData) => {
        setSelectedSlot(slot);
        setStep("CONFIRM");
        addMsg({
            role: "assistant",
            content: `Perfect! I've selected **${slot.doctor_name}** on ${slot.date} at ${slot.time}. Please review the details and confirm your booking.`,
        });
    };

    const handleConfirm = async () => {
        if (!selectedSlot || !patientId || !triageData) return;
        setLoading(true);
        try {
            const res = await bookAppointment(
                patientId,
                triageData.procedure_id,
                selectedSlot as unknown as Record<string, unknown>
            );
            addMsg({
                role: "assistant",
                content: `**Appointment Confirmed!**\n\nYour booking is confirmed. You can view all details in your appointments.`,
                booked: true,
            });
            setStep("DONE");
        } catch {
            addMsg({
                role: "assistant",
                content: `Booking failed. Please try again.`,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
            });
        } catch {
            return dateStr;
        }
    };

    const resetBooking = () => {
        setMessages([
            {
                role: "assistant",
                content: "Ready for another booking! Describe your dental concern.",
            },
        ]);
        setTriageData(null);
        setSelectedSlot(null);
        setClarificationCount(0);
        setStep("TRIAGE");
    };

    // Get latest slots from messages (search from end to find most recent)
    const latestSlots = [...messages].reverse().find((m) => m.slots)?.slots || [];
    const isEmergency = messages.some((m) => m.emergency);
    const emergencySlot = [...messages].reverse().find((m) => m.emergencySlot)?.emergencySlot as SlotData | undefined;

    return (
        <DashboardLayout
            role="patient"
            title="Medical Triage"
            subtitle="Secure AI-driven clinical assessment and scheduling"
        >
            <div className="grid h-[calc(100vh-8rem)] grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Left: Chat Interface */}
                <div className="flex flex-col lg:col-span-7 h-full min-h-[500px]">
                    <div className="flex flex-col flex-1 overflow-hidden rounded-xl border border-brand-default bg-brand-card">
                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <motion.div
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                                className="space-y-6"
                            >
                                {messages.map((msg, i) => (
                                    <motion.div
                                        key={i}
                                        variants={messageVariants}
                                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"
                                            }`}
                                    >
                                        <div
                                            className={`max-w-[70%] rounded-xl px-5 py-3.5 ${msg.role === "user"
                                                ? "bg-indigo-600 text-brand-text-primary rounded-tr-none"
                                                : "border border-brand-default bg-brand-secondary text-brand-text-secondary rounded-tl-none"
                                                }`}
                                        >
                                            <div className="whitespace-pre-wrap text-sm font-medium leading-relaxed">
                                                {msg.content.split(/(\*\*.*?\*\*)/).map((part, j) =>
                                                    part.startsWith("**") && part.endsWith("**") ? (
                                                        <span key={j} className="font-bold text-brand-text-primary">
                                                            {part.slice(2, -2)}
                                                        </span>
                                                    ) : (
                                                        part
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}

                                {loading && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex justify-start"
                                    >
                                        <div className="flex items-center gap-2 rounded-xl border border-brand-subtle bg-brand-secondary/40 px-6 py-3 backdrop-blur-sm">
                                            <div className="flex gap-1.5">
                                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-accent [animation-delay:-0.3s]" />
                                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-accent [animation-delay:-0.15s]" />
                                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-accent" />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                                <div ref={messagesEndRef} />
                            </motion.div>
                        </div>

                        {/* Input Area */}
                        <div className="border-t border-brand-default bg-brand-secondary p-6">
                            {step === "DONE" ? (
                                <div className="flex h-full items-center gap-4">
                                    <button
                                        onClick={() => router.push("/patient/appointments")}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-brand-default bg-brand-card py-3.5 text-[10px] font-bold uppercase tracking-widest text-brand-text-primary transition-all hover:bg-brand-elevated"
                                    >
                                        <Calendar size={16} />
                                        Records
                                    </button>
                                    <button
                                        onClick={resetBooking}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3.5 text-[10px] font-bold uppercase tracking-widest text-brand-text-primary transition-all hover:bg-indigo-500"
                                    >
                                        <RotateCcw size={16} />
                                        New Booking
                                    </button>
                                </div>
                            ) : step === "CONFIRM" ? (
                                <div className="flex h-full items-center gap-4">
                                    <button
                                        onClick={() => {
                                            setSelectedSlot(null);
                                            setStep("SLOTS");
                                        }}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-brand-default bg-brand-card py-3.5 text-[10px] font-bold uppercase tracking-widest text-brand-text-primary transition-all hover:bg-brand-elevated"
                                    >
                                        <X size={16} />
                                        Adjust Slot
                                    </button>
                                    <button
                                        onClick={handleConfirm}
                                        disabled={loading}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3.5 text-[10px] font-bold uppercase tracking-widest text-brand-text-primary transition-all hover:bg-emerald-500 disabled:opacity-50"
                                    >
                                        <CheckCircle2 size={16} />
                                        Authorize Booking
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        disabled={loading || step === "SLOTS"}
                                        placeholder={
                                            step === "TRIAGE"
                                                ? "How can we help today?"
                                                : "Select a slot above..."
                                        }
                                        className="w-full rounded-lg border border-brand-default bg-brand-card py-4 pl-6 pr-16 text-sm text-brand-text-primary placeholder-brand-text-disabled outline-none transition-all focus:border-indigo-500/50 disabled:opacity-50"
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={loading || !input.trim() || step === "SLOTS"}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-brand-text-primary transition-all hover:bg-indigo-500 disabled:opacity-20"
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Live Summary & Slots Panel */}
                <div className="flex flex-col gap-6 lg:col-span-5">
                    {/* Live Appointment Summary Card */}
                    <div className="rounded-xl border border-brand-default bg-brand-card p-6">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                Case Summary
                            </h3>
                            {isEmergency && (
                                <span className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-rose-400">
                                    <AlertCircle size={12} />
                                    Emergency
                                </span>
                            )}
                        </div>

                        {triageData ? (
                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                                        <Stethoscope size={24} className="text-indigo-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-disabled">Procedure</p>
                                        <p className="text-base font-bold text-brand-text-primary mt-0.5 leading-tight">
                                            {triageData.procedure_name}
                                        </p>
                                        <p className="text-[10px] font-bold text-indigo-400 mt-1 uppercase tracking-widest">
                                            {triageData.specialist_type}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-secondary border border-brand-default">
                                            <Clock size={16} className="text-brand-text-muted" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-disabled">Time</p>
                                            <p className="text-xs font-bold text-brand-text-primary mt-0.5">
                                                {triageData.treatment_minutes}m
                                            </p>
                                        </div>
                                    </div>

                                    {triageData.requires_sedation && (
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
                                                <Shield size={16} className="text-amber-400" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-disabled">Type</p>
                                                <p className="text-xs font-bold text-amber-400 mt-0.5">Sedation</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {selectedSlot && (
                                    <div className="mt-6 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
                                        <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                                            Selected Appointment
                                        </p>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3 text-xs font-bold text-brand-text-primary">
                                                <Calendar size={14} className="text-indigo-400" />
                                                {formatDate(selectedSlot.date)} • {selectedSlot.time}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs font-semibold text-brand-text-secondary">
                                                <User size={14} className="text-brand-text-disabled" />
                                                {selectedSlot.doctor_name}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs font-semibold text-brand-text-secondary">
                                                <MapPin size={14} className="text-brand-text-disabled" />
                                                {selectedSlot.room_name}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-secondary border border-brand-default">
                                    <Sparkles size={24} className="text-brand-text-disabled" />
                                </div>
                                <p className="text-xs font-medium text-brand-text-disabled max-w-[180px] leading-relaxed">
                                    Start chatting to build your assessment summary
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Available Slots Panel */}
                    {(latestSlots.length > 0 || emergencySlot) && (
                        <div className="flex flex-col flex-1 overflow-hidden rounded-xl border border-brand-default bg-brand-card">
                            <div className="border-b border-brand-default bg-brand-secondary p-5">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                    Available Slots
                                </h3>
                                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                                    {(latestSlots.length + (emergencySlot ? 1 : 0))} Options Found
                                </p>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                <div className="space-y-4">
                                    {/* Helper function to confirm selection */}
                                    {emergencySlot && (
                                        <button
                                            onClick={() => handleSelectSlot(emergencySlot)}
                                            disabled={step === "CONFIRM" && selectedSlot !== emergencySlot}
                                            className={`group w-full rounded-xl border p-5 text-left transition-all relative overflow-hidden ${selectedSlot === emergencySlot
                                                ? "border-rose-500 bg-rose-500/10"
                                                : "border-rose-500/30 bg-rose-500/5 hover:border-rose-500/50"
                                                }`}
                                        >
                                            <div className="absolute right-0 top-0 rounded-bl-xl bg-rose-500 px-3 py-1 text-[8px] font-bold uppercase tracking-widest text-white">
                                                Priority Slot
                                            </div>
                                            <div className="relative z-10 flex items-start justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-bold text-brand-text-primary tracking-tight">
                                                            {emergencySlot.doctor_name}
                                                        </p>
                                                    </div>
                                                    <div className="mt-2 flex items-center gap-4 text-xs font-medium text-brand-text-secondary">
                                                        <span className="flex items-center gap-1.5 text-rose-400">
                                                            <Clock size={14} />
                                                            {emergencySlot.time} (Immediate)
                                                        </span>
                                                        <span className="flex items-center gap-1.5">
                                                            <MapPin size={14} />
                                                            {emergencySlot.room_name}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-500 transition-colors group-hover:bg-rose-500 group-hover:text-white">
                                                    <ChevronRight size={16} />
                                                </div>
                                            </div>
                                        </button>
                                    )}

                                    {latestSlots.map((slot, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSelectSlot(slot)}
                                            disabled={step === "CONFIRM" && selectedSlot !== slot}
                                            className={`group w-full rounded-xl border p-5 text-left transition-all ${selectedSlot === slot
                                                ? "border-indigo-500 bg-indigo-500/10"
                                                : "border-brand-default bg-brand-secondary hover:border-brand-hover"
                                                }`}
                                        >
                                            <div className="relative z-10 flex items-start justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-bold text-brand-text-primary tracking-tight">
                                                            {slot.doctor_name}
                                                        </p>
                                                        {slot.type === "COMBO" && (
                                                            <span className="flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-emerald-400">
                                                                <Sparkles size={10} />
                                                                Combo
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-brand-text-muted mt-1">
                                                        {slot.room_name}
                                                        {slot.staff_name && ` • ${slot.staff_name}`}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-semibold text-indigo-400">
                                                        {slot.time}
                                                    </p>
                                                    <p className="text-xs text-brand-text-muted">
                                                        {formatDate(slot.date)}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-3 flex items-center justify-between border-t border-brand-default/50 pt-3">
                                                <span className="text-xs text-brand-text-muted">
                                                    {slot.duration_minutes} minutes
                                                </span>
                                                <ChevronRight
                                                    size={16}
                                                    className={`text-brand-text-disabled transition-transform group-hover:translate-x-1 ${selectedSlot === slot ? "text-indigo-400" : ""
                                                        }`}
                                                />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quick Help Card */}
                    {!triageData && (
                        <div className="rounded-xl border border-brand-default bg-brand-card p-6">
                            <p className="mb-5 text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                Common Concerns
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    "Acute Toothache",
                                    "Wisdom Impaction",
                                    "Scale & Polish",
                                    "Crown Restoration",
                                    "Emergency Trauma",
                                ].map((symptom) => (
                                    <button
                                        key={symptom}
                                        onClick={() => {
                                            setInput(symptom);
                                        }}
                                        className="rounded-lg border border-brand-default bg-brand-secondary px-4 py-2.5 text-[11px] font-bold text-brand-text-secondary transition-all hover:border-brand-hover hover:text-brand-text-primary"
                                    >
                                        {symptom}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout >
    );
}