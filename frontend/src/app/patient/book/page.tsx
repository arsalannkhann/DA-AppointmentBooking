"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { bookAppointment, searchSlotsBySpecialist } from "@/lib/api";
import { Calendar, Clock, User, Building2, Loader2 } from "lucide-react";

interface RoutedIssue {
    issue_index: number;
    symptom_cluster: string;
    urgency: string;
    specialist_type: string;
    requires_sedation?: boolean;
    procedure_id?: number | null;
    procedure_name?: string;
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

interface SlotSearchResponse {
    combo_slots?: SlotData[];
    single_slots?: SlotData[];
    total_found?: number;
    note?: string;
}

export default function PatientBookPage() {
    const router = useRouter();
    const [routedIssues, setRoutedIssues] = useState<RoutedIssue[]>([]);
    const [slots, setSlots] = useState<SlotData[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<SlotData | null>(null);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        const stored = sessionStorage.getItem("triageRoutedIssues");
        if (!stored) {
            setLoading(false);
            return;
        }

        try {
            const parsed = JSON.parse(stored) as RoutedIssue[];
            setRoutedIssues(Array.isArray(parsed) ? parsed : []);
        } catch {
            setRoutedIssues([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const loadSlots = async () => {
            if (!routedIssues.length) return;

            setLoading(true);
            setError(null);
            try {
                const requests = routedIssues.map(async (issue) => {
                    const res = await searchSlotsBySpecialist(
                        issue.specialist_type,
                        Boolean(issue.requires_sedation)
                    ) as SlotSearchResponse;
                    return [...(res.combo_slots || []), ...(res.single_slots || [])];
                });

                const slotBatches = await Promise.all(requests);
                const allSlots = slotBatches.flat();

                const seen = new Set<string>();
                const deduped = allSlots.filter((slot) => {
                    const key = `${slot.date}-${slot.time}-${slot.doctor_id}-${slot.room_name}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });

                setSlots(deduped);
            } catch (e) {
                console.error(e);
                setError("Unable to load slots right now. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        loadSlots();
    }, [routedIssues]);

    const primaryProcedureId = useMemo(() => {
        return routedIssues.find((issue) => issue.procedure_id != null)?.procedure_id ?? null;
    }, [routedIssues]);

    const handleBook = async () => {
        if (!selectedSlot) return;
        if (!primaryProcedureId) {
            setError("Procedure mapping was not found. Please return to chat and retry.");
            return;
        }

        const patientId = localStorage.getItem("patientId");
        if (!patientId) {
            setError("Patient session not found. Please sign in again.");
            return;
        }

        setBooking(true);
        setError(null);
        setSuccess(null);
        try {
            await bookAppointment(patientId, primaryProcedureId, selectedSlot as unknown as Record<string, unknown>);
            setSuccess("Appointment booked successfully.");
            setTimeout(() => router.push("/patient/appointments"), 700);
        } catch (e) {
            console.error(e);
            setError("Booking failed. Please select another slot or try again.");
        } finally {
            setBooking(false);
        }
    };

    return (
        <DashboardLayout role="patient" title="Available Slots" subtitle="Choose a specialist appointment time">
            <div className="max-w-4xl mx-auto space-y-4">
                {!routedIssues.length && !loading && (
                    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 text-sm text-[var(--text-secondary)]">
                        No routed issues found. Start from chat and click `View Slots` again.
                    </div>
                )}

                {error && (
                    <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-700">
                        {success}
                    </div>
                )}

                {loading ? (
                    <div className="flex h-[220px] items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)]">
                        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-primary)]" />
                    </div>
                ) : (
                    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)]">
                        <div className="p-4 border-b border-[var(--border-default)] text-sm text-[var(--text-secondary)]">
                            {slots.length > 0
                                ? `${slots.length} slots available`
                                : "No slots found for the current routing. Please return to chat and update details."}
                        </div>
                        <div className="p-3 space-y-2 max-h-[520px] overflow-y-auto">
                            {slots.map((slot, idx) => {
                                const selected = selectedSlot === slot;
                                return (
                                    <button
                                        key={`${slot.date}-${slot.time}-${slot.doctor_id}-${idx}`}
                                        type="button"
                                        onClick={() => setSelectedSlot(slot)}
                                        className={`w-full text-left rounded-lg border p-3 transition-colors ${selected
                                            ? "border-[var(--accent-primary)] bg-[var(--accent-subtle)]"
                                            : "border-[var(--border-default)] bg-[var(--bg-base)] hover:bg-[var(--bg-sunken)]"
                                            }`}
                                    >
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} />
                                                <span>{slot.date}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock size={14} />
                                                <span>{slot.time} - {slot.end_time}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <User size={14} />
                                                <span>{slot.doctor_name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Building2 size={14} />
                                                <span>{slot.clinic_name}</span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="p-4 border-t border-[var(--border-default)] flex gap-2">
                            <button
                                type="button"
                                onClick={() => router.push("/chat")}
                                className="px-4 py-2 rounded-md border border-[var(--border-default)] text-sm"
                            >
                                Back to Chat
                            </button>
                            <button
                                type="button"
                                onClick={handleBook}
                                disabled={!selectedSlot || booking || !slots.length}
                                className="px-4 py-2 rounded-md bg-[var(--accent-primary)] text-white text-sm disabled:opacity-50"
                            >
                                {booking ? "Booking..." : "Book Selected Slot"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
