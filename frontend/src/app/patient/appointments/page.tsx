"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { format, parseISO, isPast, isToday, isTomorrow } from "date-fns";
import {
    CalendarDays,
    MapPin,
    User,
    Clock,
    MoreVertical,
    Trash2,
    FileText,
    AlertCircle,
    ChevronRight,
    Plus,
    CheckCircle2,
    XCircle,
    CalendarClock,
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

import { useAuth } from "@/context/AuthContext";

// ... (imports remain the same, just adding useAuth)

export default function PatientAppointments() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const [appointments, setAppointments] = useState<AppointmentData[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [showCancelModal, setShowCancelModal] = useState<string | null>(null);

    useEffect(() => {
        if (authLoading) return;

        if (!user || user.role !== "patient") {
            // AuthContext handles redirect
            return;
        }

        loadAppointments(user.user_id);
    }, [user, authLoading]);

    const loadAppointments = async (patientId: string) => {
        try {
            const data = await getPatientAppointments(patientId);
            setAppointments(data);
        } catch (error) {
            console.error("Failed to load appointments:", error);
        } finally {
            setLoading(false);
        }
    };

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

    const getStatusConfig = (status: string, date: string) => {
        const isPastDate = isPast(parseISO(date)) && !isToday(parseISO(date));

        switch (status) {
            case "SCHEDULED":
                return {
                    color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
                    dot: "bg-cyan-400",
                    label: isToday(parseISO(date)) ? "Today" : isTomorrow(parseISO(date)) ? "Tomorrow" : "Upcoming",
                    icon: CalendarClock,
                };
            case "IN_PROGRESS":
                return {
                    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
                    dot: "bg-amber-500",
                    label: "In Progress",
                    icon: Clock,
                };
            case "COMPLETED":
                return {
                    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                    dot: "bg-emerald-500",
                    label: "Completed",
                    icon: CheckCircle2,
                };
            case "CANCELLED":
                return {
                    color: "bg-rose-500/10 text-rose-500 border-rose-500/20",
                    dot: "bg-rose-500",
                    label: "Cancelled",
                    icon: XCircle,
                };
            default:
                return {
                    color: "bg-brand-elevated text-brand-text-secondary border-brand-default",
                    dot: "bg-brand-text-disabled",
                    label: status,
                    icon: AlertCircle,
                };
        }
    };

    const getRelativeDate = (dateStr: string) => {
        const date = parseISO(dateStr);
        if (isToday(date)) return "Today";
        if (isTomorrow(date)) return "Tomorrow";
        return format(date, "EEEE, MMM d");
    };

    const now = new Date();
    const upcomingAppointments = appointments.filter(
        (a) =>
            (a.status === "SCHEDULED" || a.status === "IN_PROGRESS") &&
            !isPast(parseISO(a.start_time)) || isToday(parseISO(a.start_time))
    ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    const pastAppointments = appointments.filter(
        (a) =>
            a.status === "CANCELLED" ||
            a.status === "COMPLETED" ||
            (a.status === "SCHEDULED" && isPast(parseISO(a.start_time)) && !isToday(parseISO(a.start_time)))
    ).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

    const displayedAppointments =
        activeTab === "upcoming" ? upcomingAppointments : pastAppointments;

    if (loading) {
        return (
            <DashboardLayout role="patient" title="My Appointments">
                <div className="flex h-[60vh] items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                        <p className="text-sm text-brand-text-muted">Loading appointments...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout
            role="patient"
            title="My Appointments"
            subtitle="View and manage your dental care schedule"
        >
            <div className="space-y-6">
                {/* Header Actions */}
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-1 rounded-xl border border-brand-default bg-brand-secondary p-1">
                        <button
                            onClick={() => setActiveTab("upcoming")}
                            className={`rounded-lg px-5 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === "upcoming"
                                ? "bg-cyan-600 text-brand-text-primary"
                                : "text-brand-text-muted hover:text-brand-text-primary"
                                }`}
                        >
                            Upcoming ({upcomingAppointments.length})
                        </button>
                        <button
                            onClick={() => setActiveTab("past")}
                            className={`rounded-lg px-5 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === "past"
                                ? "bg-cyan-600 text-brand-text-primary"
                                : "text-brand-text-muted hover:text-brand-text-primary"
                                }`}
                        >
                            Past History ({pastAppointments.length})
                        </button>
                    </div>

                    <button
                        onClick={() => router.push("/patient/book")}
                        className="group flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-brand-text-primary transition-all hover:bg-cyan-500 active:scale-[0.98]"
                    >
                        <Plus size={16} />
                        New Booking
                    </button>
                </div>

                {appointments.length === 0 ? (
                    // Empty State
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center justify-center rounded-xl border border-brand-default bg-brand-card py-20 text-center"
                    >
                        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-xl bg-brand-secondary border border-brand-default">
                            <CalendarDays size={36} className="text-cyan-400" />
                        </div>
                        <h3 className="text-xl font-bold text-brand-text-primary tracking-tight">
                            No Records Found
                        </h3>
                        <p className="mt-2 max-w-sm text-sm font-medium text-brand-text-muted leading-relaxed">
                            Start by booking a specialist consultation through our AI dashboard.
                        </p>
                        <button
                            onClick={() => router.push("/patient/book")}
                            className="mt-8 flex items-center gap-2 rounded-xl bg-cyan-600 px-8 py-3.5 text-[10px] font-bold uppercase tracking-widest text-brand-text-primary transition-all hover:bg-cyan-500"
                        >
                            <Plus size={16} />
                            Start New Booking
                        </button>
                    </motion.div>
                ) : displayedAppointments.length === 0 ? (
                    // Tab Empty State
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center rounded-xl border border-brand-default bg-brand-card py-16 text-center"
                    >
                        <p className="text-sm font-medium text-brand-text-muted">
                            No active {activeTab} records.
                        </p>
                        {activeTab === "upcoming" && (
                            <button
                                onClick={() => router.push("/patient/book")}
                                className="mt-4 text-[10px] font-bold uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-colors"
                            >
                                Book New Session →
                            </button>
                        )}
                    </motion.div>
                ) : (
                    // Appointments List
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="grid gap-6"
                    >
                        <AnimatePresence mode="popLayout">
                            {displayedAppointments.map((appt) => {
                                const statusConfig = getStatusConfig(appt.status, appt.start_time);
                                const isUpcoming = activeTab === "upcoming";

                                return (
                                    <motion.div
                                        key={appt.appt_id}
                                        variants={itemVariants}
                                        layout
                                        className="group relative overflow-hidden rounded-xl border border-brand-default bg-brand-card p-6 transition-all hover:border-brand-hover active:scale-[0.99]"
                                    >
                                        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                                            {/* Left: Date & Info */}
                                            <div className="flex gap-6">
                                                {/* Date Visual */}
                                                <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-secondary border border-brand-default text-center transition-transform group-hover:scale-105">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-text-disabled">
                                                        {format(parseISO(appt.start_time), "MMM")}
                                                    </span>
                                                    <span className="text-3xl font-bold text-brand-text-primary leading-none mt-1">
                                                        {format(parseISO(appt.start_time), "d")}
                                                    </span>
                                                </div>

                                                {/* Details */}
                                                <div className="flex flex-col justify-center">
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <h3 className="text-lg font-bold text-brand-text-primary tracking-tight group-hover:text-cyan-400 transition-colors">
                                                            {appt.procedure}
                                                        </h3>
                                                        <span
                                                            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${statusConfig.color}`}
                                                        >
                                                            <span
                                                                className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`}
                                                            />
                                                            {statusConfig.label}
                                                        </span>
                                                    </div>

                                                    <div className="mt-3 flex flex-wrap items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                                        <div className="flex items-center gap-2">
                                                            <Clock size={16} className="text-cyan-400" />
                                                            <span className="text-brand-text-secondary">
                                                                {format(parseISO(appt.start_time), "h:mm a")} - {" "}
                                                                {format(parseISO(appt.end_time), "h:mm a")}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <User size={16} className="text-cyan-400" />
                                                            <span className="text-brand-text-secondary">{appt.doctor}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <MapPin size={16} className="text-cyan-400" />
                                                            <span className="text-brand-text-secondary">
                                                                {appt.clinic} • {appt.room}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right: Actions */}
                                            <div className="flex items-center gap-4 lg:justify-end">
                                                {isUpcoming && appt.status === "SCHEDULED" && (
                                                    <>
                                                        <button
                                                            onClick={() => router.push(`/appointments/${appt.appt_id}`)}
                                                            className="flex items-center gap-2 rounded-lg border border-brand-default bg-brand-secondary px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-brand-text-primary transition-all hover:bg-brand-elevated"
                                                        >
                                                            Portal
                                                            <ChevronRight size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => setShowCancelModal(appt.appt_id)}
                                                            className="flex items-center gap-2 rounded-lg border border-rose-500/10 bg-rose-500/10 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-rose-500 transition-all hover:bg-rose-500/20"
                                                        >
                                                            <Trash2 size={14} />
                                                            Cancel
                                                        </button>
                                                    </>
                                                )}

                                                {!isUpcoming && (
                                                    <button className="rounded-xl p-3 text-brand-text-muted transition-colors hover:bg-white/5 hover:text-brand-text-primary">
                                                        <MoreVertical size={22} />
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
            </div>

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
                            className="w-full max-w-sm overflow-hidden rounded-xl border border-brand-default bg-brand-card shadow-xl"
                        >
                            <div className="p-8">
                                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20">
                                    <AlertCircle className="text-rose-500" size={24} />
                                </div>
                                <h3 className="text-center text-xl font-bold text-brand-text-primary tracking-tight">
                                    Cancel Session?
                                </h3>
                                <p className="mt-2 text-center text-sm font-medium text-brand-text-muted leading-relaxed">
                                    This action will release your specialized clinical slot.
                                </p>

                                <div className="mt-10 flex gap-3">
                                    <button
                                        onClick={() => setShowCancelModal(null)}
                                        className="flex-1 rounded-xl border border-brand-default bg-brand-secondary py-3.5 text-[10px] font-bold uppercase tracking-widest text-brand-text-primary transition-all hover:bg-brand-elevated"
                                    >
                                        Keep Session
                                    </button>
                                    <button
                                        onClick={() => handleCancel(showCancelModal)}
                                        disabled={cancellingId === showCancelModal}
                                        className="flex-1 rounded-xl bg-rose-500 py-3.5 text-[10px] font-bold uppercase tracking-widest text-brand-text-primary transition-all hover:bg-rose-600 disabled:opacity-50"
                                    >
                                        {cancellingId === showCancelModal
                                            ? "Wait..."
                                            : "Cancel Slot"}
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