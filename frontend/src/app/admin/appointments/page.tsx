"use client";

import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { getDashboardStats, listAllAppointments } from "@/lib/api";
import { motion, Variants } from "framer-motion";
import {
    CalendarDays,
    RefreshCw,
    Clock,
    User,
    Stethoscope,
    Building2,
    CheckCircle2,
    XCircle,
    AlertTriangle,
} from "lucide-react";

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } },
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AppointmentItem {
    appt_id: string;
    patient_name: string;
    procedure: string;
    doctor: string;
    room: string;
    clinic: string;
    start_time: string;
    end_time: string;
    status: string;
    created_at: string;
}

export default function AdminAppointments() {
    const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "SCHEDULED" | "COMPLETED" | "CANCELLED">("all");

    const loadData = useCallback(async () => {
        try {
            const dashData = await getDashboardStats();
            setStats(dashData.overview);

            // Fetch all appointments directly
            const data = await listAllAppointments();
            setAppointments(data || []);
        } catch (err) {
            console.error("Failed to load data:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading) {
        return (
            <DashboardLayout role="admin" title="Appointment Control" subtitle="Schedule management and oversight">
                <div className="flex h-[400px] items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-accent border-t-transparent"></div>
                </div>
            </DashboardLayout>
        );
    }

    const statusIcon = (status: string) => {
        switch (status) {
            case "SCHEDULED": return <Clock size={14} className="text-brand-accent" />;
            case "COMPLETED": return <CheckCircle2 size={14} className="text-emerald-500" />;
            case "CANCELLED": return <XCircle size={14} className="text-rose-500" />;
            default: return <Clock size={14} className="text-brand-text-muted" />;
        }
    };

    const statusColor = (status: string) => {
        switch (status) {
            case "SCHEDULED": return "bg-brand-accent/10 border-brand-accent/20 text-brand-accent";
            case "COMPLETED": return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
            case "CANCELLED": return "bg-rose-500/10 border-rose-500/20 text-rose-400";
            default: return "bg-brand-elevated border-brand-default text-brand-text-muted";
        }
    };

    return (
        <DashboardLayout role="admin" title="Appointment Control" subtitle="Schedule management and oversight">
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
                {/* KPI Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: "Total", value: stats?.total_appointments ?? 0, icon: CalendarDays, color: "bg-brand-accent/10 text-brand-accent border-brand-accent/20" },
                        { label: "Scheduled", value: stats?.scheduled ?? 0, icon: Clock, color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
                        { label: "Completed", value: stats?.completed ?? 0, icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
                        { label: "Cancelled", value: stats?.cancelled ?? 0, icon: XCircle, color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
                    ].map((kpi, i) => (
                        <motion.div key={i} variants={itemVariants} className="rounded-xl border border-brand-default bg-brand-card p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${kpi.color}`}>
                                    <kpi.icon size={20} />
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-brand-text-primary tracking-tight">{kpi.value}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mt-2">{kpi.label}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 rounded-xl border border-brand-default bg-brand-secondary p-1">
                    {(["all", "SCHEDULED", "COMPLETED", "CANCELLED"] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`flex-1 rounded-lg px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all ${filter === f
                                ? "bg-brand-accent text-white"
                                : "text-brand-text-muted hover:text-brand-text-primary"
                                }`}
                        >
                            {f === "all" ? "All" : f}
                        </button>
                    ))}
                </div>

                {/* Appointments Table */}
                <motion.div variants={itemVariants} className="rounded-xl border border-brand-default bg-brand-card overflow-hidden">
                    <div className="p-6 border-b border-brand-default">
                        <h3 className="text-xl font-bold text-brand-text-primary tracking-tight">Appointment Records</h3>
                        <p className="text-sm text-brand-text-muted mt-1">View and manage all scheduled appointments</p>
                    </div>

                    {appointments.length > 0 ? (
                        <div className="divide-y divide-brand-default">
                            {appointments
                                .filter((a) => filter === "all" || a.status === filter)
                                .map((appt) => (
                                    <div key={appt.appt_id} className="flex items-center gap-4 p-5 transition-colors hover:bg-brand-secondary/50">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-brand-text-primary truncate">{appt.patient_name}</p>
                                            <p className="text-xs text-brand-text-muted truncate mt-0.5">{appt.procedure}</p>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                                    <Stethoscope size={12} /> {appt.doctor}
                                                </span>
                                                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                                    <Building2 size={12} /> {appt.room}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-xs font-semibold text-brand-text-secondary">
                                                {new Date(appt.start_time).toLocaleDateString()}
                                            </p>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mt-0.5">
                                                {new Date(appt.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                        </div>
                                        <span className={`shrink-0 flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${statusColor(appt.status)}`}>
                                            {statusIcon(appt.status)} {appt.status}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <CalendarDays size={48} className="text-brand-text-muted mb-4" />
                            <p className="text-lg font-bold text-brand-text-primary">No appointments found</p>
                            <p className="text-sm text-brand-text-muted mt-1">
                                Appointments will appear here as patients book through the system
                            </p>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </DashboardLayout>
    );
}
