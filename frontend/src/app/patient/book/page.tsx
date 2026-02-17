"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
    Send,
    Bot,
    User,
    Calendar,
    Clock,
    MapPin,
    Stethoscope,
    CheckCircle2,
    AlertTriangle,
    Sparkles,
    Shield,
    ChevronRight,
    RotateCcw,
    ArrowRight,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { analyzeSymptoms, searchSlots, bookAppointment } from "@/lib/api";

// Types
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
    hidden: { opacity: 0, y: 10, scale: 0.98 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
    },
};

import { useAuth } from "@/context/AuthContext";

// ... (imports remain the same, just adding useAuth)

export default function PatientBooking() {
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
            // AuthContext handles redirect, but we can verify here
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
                    content: `Hello${pName ? ", " + pName : ""}! I'm your SmartDental AI assistant. I can help you book the right dental appointment.\n\nPlease describe your dental concern or symptoms in detail.`,
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
            await handleTriage(text);
        }
    };

    const handleTriage = async (text: string) => {
        setLoading(true);
        try {
            const res = await analyzeSymptoms(text);
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
                        "\n\n**Tip:** Try describing: location, pain type, duration, and triggers.";
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
                    content: res.message || "I couldn't match that to a procedure.",
                });
                return;
            }

            const triage: TriageData = res.triage;
            setTriageData(triage);
            setClarificationCount(0);

            addMsg({
                role: "assistant",
                content: `**Analysis Complete**\n\nCondition: ${intent.condition?.replace(/_/g, " ")}\nProcedure: ${triage.procedure_name}\n\nSearching for available slots...`,
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
                    content: "No available slots found in the next 14 days.",
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
                content: "Sorry, I encountered an error. Please try again.",
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
            content: `Perfect! I've selected **${slot.doctor_name}** on ${slot.date} at ${slot.time}. Please review and confirm your booking.`,
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
                content: "Booking failed. Please try again.",
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
                        {/* Chat Header */}
                        <div className="flex items-center gap-4 border-b border-brand-default bg-brand-card p-5">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-brand-text-primary">
                                <Bot size={22} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-brand-text-primary tracking-tight">Dr. AIVA</h3>
                                <div className="flex items-center gap-2">
                                    <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                        Clinical AI Assistant
                                    </p>
                                </div>
                            </div>
                            {isEmergency && (
                                <span className="ml-auto flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-rose-500">
                                    <AlertTriangle size={12} />
                                    Priority Triage
                                </span>
                            )}
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                            <motion.div
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                                className="space-y-4"
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
                                                : "border border-brand-default bg-brand-card text-brand-text-secondary rounded-tl-none"
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
                                        <div className="flex items-center gap-2 rounded-xl border border-brand-default bg-brand-card px-5 py-4">
                                            <div className="flex gap-1.5">
                                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.3s]" />
                                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.15s]" />
                                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500" />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                                <div ref={messagesEndRef} />
                            </motion.div>
                        </div>

                        {/* Input Area */}
                        <div className="border-t border-brand-default bg-brand-secondary p-5">
                            {step === "DONE" ? (
                                <div className="flex h-full items-center gap-3">
                                    <button
                                        onClick={() => router.push("/patient/appointments")}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-brand-default bg-brand-elevated py-3 text-xs font-bold uppercase tracking-widest text-brand-text-primary transition-all hover:bg-brand-elevated"
                                    >
                                        <Calendar size={16} />
                                        Portal Overview
                                    </button>
                                    <button
                                        onClick={resetBooking}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 text-xs font-bold uppercase tracking-widest text-brand-text-primary transition-all hover:bg-indigo-500"
                                    >
                                        <RotateCcw size={16} />
                                        New Session
                                    </button>
                                </div>
                            ) : step === "CONFIRM" ? (
                                <div className="flex h-full items-center gap-3">
                                    <button
                                        onClick={() => {
                                            setSelectedSlot(null);
                                            setStep("SLOTS");
                                        }}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-brand-default bg-brand-elevated py-3 text-xs font-bold uppercase tracking-widest text-brand-text-primary transition-all hover:bg-brand-elevated"
                                    >
                                        Adjust Slot
                                    </button>
                                    <button
                                        onClick={handleConfirm}
                                        disabled={loading}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-xs font-bold uppercase tracking-widest text-brand-text-primary transition-all hover:bg-emerald-500 disabled:opacity-50"
                                    >
                                        <CheckCircle2 size={16} />
                                        Authorize Booking
                                    </button>
                                </div>
                            ) : (
                                <div className="flex h-full gap-3">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            disabled={loading || step === "SLOTS"}
                                            placeholder={
                                                step === "TRIAGE"
                                                    ? "Describe your symptoms in detail..."
                                                    : "Select an available slot..."
                                            }
                                            className="w-full rounded-lg border border-brand-default bg-brand-card px-4 py-3 text-sm text-brand-text-primary placeholder-brand-text-disabled outline-none transition-all focus:border-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                                        />
                                    </div>
                                    <button
                                        onClick={handleSend}
                                        disabled={loading || !input.trim() || step === "SLOTS"}
                                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-brand-text-primary transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Send size={20} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Live Summary & Slots Panel */}
                <div className="flex flex-col gap-4 lg:col-span-5">
                    {/* Live Appointment Summary Card */}
                    <div className="rounded-xl border border-brand-default bg-brand-card p-6">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                Session Summary
                            </h3>
                            {isEmergency && (
                                <span className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-rose-500">
                                    <AlertTriangle size={12} />
                                    Emergency
                                </span>
                            )}
                        </div>

                        {triageData ? (
                            <div className="space-y-6">
                                <div className="flex items-start gap-4 p-4 rounded-xl border border-brand-default bg-brand-secondary">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/10">
                                        <Stethoscope size={22} className="text-indigo-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Procedure Type</p>
                                        <p className="text-lg font-bold text-brand-text-primary tracking-tight">
                                            {triageData.procedure_name}
                                        </p>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mt-1">
                                            {triageData.specialist_type}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-4 p-4 rounded-xl border border-brand-default bg-brand-secondary">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-elevated border border-brand-default">
                                            <Clock size={16} className="text-brand-text-secondary" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Duration</p>
                                            <p className="text-sm font-bold text-brand-text-primary">
                                                {triageData.treatment_minutes}m
                                                {triageData.consult_minutes > 0 && (
                                                    <span className="text-brand-text-muted">
                                                        {" "}+{triageData.consult_minutes}c
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {triageData.requires_sedation && (
                                        <div className="flex items-center gap-4 p-4 rounded-xl border border-amber-500/10 bg-amber-500/5">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/10">
                                                <Shield size={16} className="text-amber-500" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Anesthesia</p>
                                                <p className="text-sm font-bold text-amber-500">Required</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {selectedSlot ? (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="mt-6 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5"
                                    >
                                        <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                                            Selected Clinical Slot
                                        </p>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3 text-sm font-semibold text-brand-text-primary">
                                                <Calendar size={16} className="text-indigo-400" />
                                                {selectedSlot.date} at {selectedSlot.time}
                                            </div>
                                            <div className="flex items-center gap-3 text-sm font-semibold text-brand-text-secondary">
                                                <User size={16} className="text-indigo-400" />
                                                {selectedSlot.doctor_name}
                                            </div>
                                            <div className="flex items-center gap-3 text-sm font-semibold text-brand-text-secondary">
                                                <MapPin size={16} className="text-indigo-400" />
                                                {selectedSlot.room_name}
                                                {selectedSlot.staff_name &&
                                                    ` • ${selectedSlot.staff_name}`}
                                            </div>
                                            {selectedSlot.type === "COMBO" && (
                                                <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                                                    <Sparkles size={14} />
                                                    Optimized Session
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ) : (
                                    <div className="mt-4 rounded-xl border border-dashed border-brand-default bg-brand-secondary py-8 text-center">
                                        <p className="text-[10px] font-bold text-brand-text-disabled uppercase tracking-widest">
                                            Awaiting Slot Selection
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-brand-default rounded-xl bg-brand-secondary">
                                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-brand-elevated border border-brand-default">
                                    <Stethoscope size={32} className="text-brand-text-disabled" />
                                </div>
                                <p className="text-xs font-bold uppercase tracking-widest text-brand-text-muted leading-relaxed px-6">
                                    Provide clinical details to<br />initialize triage analysis
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
                                                                Optimized
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                                        {slot.room_name}
                                                        {slot.staff_name && ` • ${slot.staff_name}`}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-indigo-400 tracking-widest">
                                                        {slot.time}
                                                    </p>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-disabled mt-1">{slot.date}</p>
                                                </div>
                                            </div>

                                            <div className="mt-4 flex items-center justify-between border-t border-brand-default pt-4">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-text-disabled">
                                                    Duration: {slot.duration_minutes}m
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
                        <div className="rounded-xl border border-brand-default bg-brand-secondary p-6">
                            <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                Quick Topics
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    "Toothache",
                                    "Wisdom teeth",
                                    "Cleaning",
                                    "Crown",
                                    "Emergency",
                                ].map((symptom) => (
                                    <button
                                        key={symptom}
                                        onClick={() => {
                                            setInput(symptom);
                                        }}
                                        className="rounded-lg border border-brand-default bg-brand-secondary px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-text-secondary transition-all hover:border-indigo-500/30 hover:text-brand-text-primary"
                                    >
                                        {symptom}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}