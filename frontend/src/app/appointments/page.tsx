"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
    Calendar,
    Clock,
    MapPin,
    User,
    X,
    AlertCircle,
    ChevronRight,
    Plus,
    MoreHorizontal,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { getPatientAppointments, cancelAppointment } from "@/lib/api";

interface AppointmentData {
    appt_id: string;
    procedure: string;
    doctor: string;
    room: string;
    clinic: string;
    start_time: string;
    end_time: string;
    status: "SCHEDULED" | "CANCELLED" | "COMPLETED" | "IN_PROGRESS";
    created_at: string;
}

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.05 },
    },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
    },
};

export default function AppointmentsPage() {
    const router = useRouter();
    const [appointments, setAppointments] = useState<AppointmentData[]>([]);
    const [loading, setLoading] = useState(true);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
    const [showCancelModal, setShowCancelModal] = useState<string | null>(null);

    const loadAppointments = useCallback(async (patientId: string) => {
        try {
            const data = await getPatientAppointments(patientId);
            setAppointments(data);
        } catch (error) {
            console.error("Failed to load appointments:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const pId = localStorage.getItem("patientId");
        if (!pId) {
            router.push("/onboarding");
            return;
        }
        loadAppointments(pId);
    }, [router, loadAppointments]);

    const handleCancel = async (apptId: string) => {
        setCancellingId(apptId);
        try {
            await cancelAppointment(apptId);
            setAppointments((prev) =>
                prev.map((a) =>
                    a.appt_id === apptId ? { ...a, status: "CANCELLED" } : a
                )
            );
            setShowCancelModal(null);
        } catch {
            alert("Failed to cancel appointment. Please try again.");
        } finally {
            setCancellingId(null);
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return {
                date: date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                }),
                time: date.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
                weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
            };
        } catch {
            return { date: dateStr, time: "", weekday: "" };
        }
    };

    const getDuration = (start: string, end: string) => {
        try {
            const startDate = new Date(start);
            const endDate = new Date(end);
            const diffMs = endDate.getTime() - startDate.getTime();
            const diffMins = Math.round(diffMs / 60000);
            return `${diffMins} min`;
        } catch {
            return "";
        }
    };

    const now = new Date();
    const upcomingAppointments = appointments.filter(
        (a) => new Date(a.start_time) >= now && a.status !== "CANCELLED"
    );
    const pastAppointments = appointments.filter(
        (a) => new Date(a.start_time) < now || a.status === "CANCELLED"
    );

    const displayedAppointments =
        activeTab === "upcoming" ? upcomingAppointments : pastAppointments;

    const getStatusConfig = (status: string) => {
        switch (status) {
            case "SCHEDULED":
                return {
                    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                    dot: "bg-emerald-500",
                    label: "Confirmed",
                };
            case "IN_PROGRESS":
                return {
                    color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
                    dot: "bg-cyan-500",
                    label: "In Progress",
                };
            case "COMPLETED":
                return {
                    color: "bg-brand-secondary text-brand-text-muted border-brand-default",
                    dot: "bg-brand-text-disabled",
                    label: "Completed",
                };
            case "CANCELLED":
                return {
                    color: "bg-rose-500/10 text-rose-500 border-rose-500/20",
                    dot: "bg-rose-500",
                    label: "Cancelled",
                };
            default:
                return {
                    color: "bg-brand-secondary text-brand-text-secondary",
                    dot: "bg-brand-text-disabled",
                    label: status,
                };
        }
    };

    if (loading) {
        return (
            <DashboardLayout role="patient" title="Clinical Schedule">
                <div className="flex h-[60vh] items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                        <p className="text-sm text-brand-text-secondary">Loading your schedule...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout
            role="patient"
            title="Clinical Schedule"
            subtitle="Manage your enterprise dental care timeline"
        >
            {/* Header Actions */}
            <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-1 rounded-xl border border-brand-default bg-brand-secondary p-1">
                    <button
                        onClick={() => setActiveTab("upcoming")}
                        className={`rounded-lg px-6 py-2 text-xs font-semibold transition-all ${activeTab === "upcoming"
                            ? "bg-cyan-600 text-brand-text-primary"
                            : "text-brand-text-secondary hover:text-brand-text-primary"
                            }`}
                    >
                        Upcoming ({upcomingAppointments.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("past")}
                        className={`rounded-lg px-6 py-2 text-xs font-semibold transition-all ${activeTab === "past"
                            ? "bg-cyan-600 text-brand-text-primary"
                            : "text-brand-text-secondary hover:text-brand-text-primary"
                            }`}
                    >
                        Past ({pastAppointments.length})
                    </button>
                </div>

                <button
                    onClick={() => router.push("/patient/book")}
                    className="group flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-6 py-3 text-sm font-semibold text-brand-text-primary transition-all hover:bg-cyan-500"
                >
                    <Plus size={18} />
                    New Appointment
                </button>
            </div>

            {appointments.length === 0 ? (
                // Empty State
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center rounded-xl border border-brand-default bg-brand-secondary py-20 text-center"
                >
                    <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-brand-secondary border border-brand-default">
                        <Calendar size={28} className="text-brand-text-secondary" />
                    </div>
                    <h3 className="text-xl font-bold text-brand-text-primary">No Appointments</h3>
                    <p className="mt-2 max-w-sm text-sm text-brand-text-muted">
                        You don&apos;t have any appointments scheduled yet. Start your journey with an AI intake.
                    </p>
                    <button
                        onClick={() => router.push("/patient/book")}
                        className="mt-8 flex items-center gap-2 rounded-lg bg-cyan-600 px-8 py-3 text-sm font-semibold text-brand-text-primary transition-all hover:bg-cyan-500"
                    >
                        <Plus size={18} />
                        Book Appointment
                    </button>
                </motion.div>
            ) : displayedAppointments.length === 0 ? (
                // Tab Empty State
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center rounded-xl border border-brand-default bg-brand-secondary py-16 text-center"
                >
                    <p className="text-sm text-brand-text-muted">
                        No {activeTab} appointments found.
                    </p>
                </motion.div>
            ) : (
                // Appointments List
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-3"
                >
                    <AnimatePresence mode="popLayout">
                        {displayedAppointments.map((appt) => {
                            const dateInfo = formatDate(appt.start_time);
                            const statusConfig = getStatusConfig(appt.status);
                            const duration = getDuration(appt.start_time, appt.end_time);

                            return (
                                <motion.div
                                    key={appt.appt_id}
                                    variants={itemVariants}
                                    layout
                                    className="group rounded-xl border border-brand-default bg-brand-card p-6 transition-all hover:border-cyan-500/40"
                                >
                                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                                        {/* Left: Date & Info */}
                                        <div className="flex gap-8">
                                            {/* Date Box */}
                                            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-brand-default bg-brand-secondary text-center">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                                    {dateInfo.weekday}
                                                </span>
                                                <span className="text-xl font-bold text-brand-text-primary tracking-tight">
                                                    {dateInfo.date.split(" ")[1].replace(",", "")}
                                                </span>
                                            </div>

                                            {/* Details */}
                                            <div className="flex flex-col justify-center">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <h3 className="text-lg font-bold text-brand-text-primary tracking-tight">
                                                        {appt.procedure}
                                                    </h3>
                                                    <span
                                                        className={`flex items-center gap-2 rounded-lg border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${statusConfig.color}`}
                                                    >
                                                        <span
                                                            className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`}
                                                        />
                                                        {statusConfig.label}
                                                    </span>
                                                </div>

                                                <div className="mt-3 flex flex-wrap items-center gap-6 text-[11px] font-medium text-brand-text-secondary">
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={14} className="text-cyan-400" />
                                                        <span>
                                                            {dateInfo.time} <span className="text-brand-text-muted">• {duration}</span>
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <User size={14} className="text-cyan-400" />
                                                        <span>{appt.doctor}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <MapPin size={14} className="text-cyan-400" />
                                                        <span>
                                                            {appt.clinic} <span className="text-brand-text-muted">|</span> {appt.room}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Actions */}
                                        <div className="flex items-center gap-3 lg:justify-end">
                                            {appt.status === "SCHEDULED" && activeTab === "upcoming" && (
                                                <>
                                                    <button
                                                        onClick={() => router.push(`/appointments/${appt.appt_id}`)}
                                                        className="rounded-lg border border-brand-default bg-brand-secondary px-4 py-2 text-xs font-semibold text-brand-text-secondary transition-all hover:bg-brand-tertiary"
                                                    >
                                                        Details
                                                    </button>
                                                    <button
                                                        onClick={() => setShowCancelModal(appt.appt_id)}
                                                        className="rounded-lg border border-rose-900/30 bg-rose-900/20 px-4 py-2 text-xs font-semibold text-rose-400 transition-all hover:bg-rose-900/30"
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            )}

                                            {(appt.status !== "SCHEDULED" || activeTab === "past") && (
                                                <button className="rounded-lg p-2 text-brand-text-muted transition-colors hover:bg-brand-secondary hover:text-brand-text-secondary">
                                                    <MoreHorizontal size={20} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </motion.div>
            )}

            {/* Cancel Confirmation Modal */}
            <AnimatePresence>
                {showCancelModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                        onClick={() => setShowCancelModal(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-md overflow-hidden rounded-xl border border-brand-default bg-brand-secondary shadow-2xl"
                        >
                            <div className="p-8">
                                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20">
                                    <AlertCircle className="text-rose-500" size={28} />
                                </div>
                                <h3 className="text-center text-xl font-bold text-brand-text-primary">
                                    Cancel Appointment?
                                </h3>
                                <p className="mt-2 text-center text-sm text-brand-text-muted leading-relaxed">
                                    This action cannot be undone. Your reserved time slot will be made available to other patients.
                                </p>

                                <div className="mt-8 flex flex-col gap-2">
                                    <button
                                        onClick={() => handleCancel(showCancelModal)}
                                        disabled={cancellingId === showCancelModal}
                                        className="w-full rounded-lg bg-rose-600 py-3 text-sm font-semibold text-brand-text-primary transition-all hover:bg-rose-700 disabled:opacity-50"
                                    >
                                        {cancellingId === showCancelModal
                                            ? "Cancelling..."
                                            : "Cancel Appointment"}
                                    </button>
                                    <button
                                        onClick={() => setShowCancelModal(null)}
                                        className="w-full rounded-lg border border-brand-default bg-brand-secondary py-3 text-sm font-semibold text-brand-text-secondary transition-all hover:bg-brand-tertiary hover:text-brand-text-primary"
                                    >
                                        Keep Appointment
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </DashboardLayout>
    );
}