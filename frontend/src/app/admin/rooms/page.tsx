"use client";

import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { getDashboardStats } from "@/lib/api";
import { motion, Variants } from "framer-motion";
import {
    Building2,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Wrench,
    Zap,
    CalendarDays,
} from "lucide-react";

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } },
};

interface RoomData {
    id: string;
    name: string;
    clinic: string;
    type: string;
    booked_slots: number;
    utilization_pct: number;
    scheduled_patients: Array<{
        appt_id: string;
        patient_name: string;
        procedure: string;
        time: string;
    }>;
}

export default function AdminRooms() {
    const [rooms, setRooms] = useState<RoomData[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadRooms = useCallback(async () => {
        try {
            setRefreshing(true);
            const data = await getDashboardStats();
            setRooms(data.room_utilization || []);
        } catch (err) {
            console.error("Failed to load rooms:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadRooms();
    }, [loadRooms]);

    if (loading) {
        return (
            <DashboardLayout role="admin" title="Room Management" subtitle="Treatment zone allocation and utilization">
                <div className="flex h-[400px] items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-accent border-t-transparent"></div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout role="admin" title="Room Management" subtitle="Treatment zone allocation and utilization">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-brand-accent/10 border border-brand-accent/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-accent">
                        {rooms.length} Rooms
                    </span>
                </div>
                <button
                    onClick={loadRooms}
                    disabled={refreshing}
                    className="group flex items-center gap-2 rounded-lg bg-brand-secondary border border-brand-default px-5 py-2.5 text-xs font-semibold text-brand-text-secondary transition-all hover:bg-brand-elevated hover:text-brand-text-primary disabled:opacity-50"
                >
                    <RefreshCw size={14} className={refreshing ? "animate-spin" : "transition-transform group-hover:rotate-180"} />
                    Refresh
                </button>
            </div>

            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
                {/* Room Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {rooms.map((room) => (
                        <motion.div
                            key={room.id}
                            variants={itemVariants}
                            className="group rounded-xl border border-brand-default bg-brand-card p-6 transition-all hover:border-brand-accent/30"
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-accent/10 border border-brand-accent/20">
                                        <Building2 size={20} className="text-brand-accent" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-brand-text-primary">{room.name}</h3>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mt-0.5">
                                            {room.type}
                                        </p>
                                    </div>
                                </div>
                                <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${room.utilization_pct > 70
                                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                                    : room.utilization_pct > 30
                                        ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                                        : "bg-brand-elevated border border-brand-default text-brand-text-muted"
                                    }`}>
                                    {room.utilization_pct > 70 ? "High" : room.utilization_pct > 30 ? "Medium" : "Low"}
                                </span>
                            </div>

                            {/* Utilization Bar */}
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Utilization</span>
                                    <span className="text-sm font-bold text-brand-text-primary">{room.utilization_pct}%</span>
                                </div>
                                <div className="h-2 rounded-full bg-brand-elevated overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${room.utilization_pct > 70 ? "bg-emerald-500" : room.utilization_pct > 30 ? "bg-amber-500" : "bg-brand-text-muted"
                                            }`}
                                        style={{ width: `${room.utilization_pct}%` }}
                                    />
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="flex items-center justify-between rounded-lg bg-brand-secondary border border-brand-default p-3">
                                <div className="text-center">
                                    <p className="text-lg font-bold text-brand-text-primary">{room.booked_slots}</p>
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-brand-text-muted">Booked</p>
                                </div>
                                <div className="h-8 w-px bg-brand-default" />
                                <div className="text-center">
                                    <p className="text-lg font-bold text-brand-text-primary">{32 - room.booked_slots}</p>
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-brand-text-muted">Available</p>
                                </div>
                                <div className="h-8 w-px bg-brand-default" />
                                <div className="text-center">
                                    <p className="text-lg font-bold text-brand-text-primary">{room.clinic}</p>
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-brand-text-muted">Clinic</p>
                                </div>
                            </div>

                            {/* Scheduled Patients Section */}
                            <div className="mt-6 border-t border-brand-default pt-4">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mb-3 flex items-center gap-2">
                                    <CalendarDays size={12} className="text-brand-accent" /> Scheduled Patients
                                </h4>
                                <div className="space-y-2">
                                    {room.scheduled_patients && room.scheduled_patients.length > 0 ? (
                                        room.scheduled_patients.map((p) => (
                                            <div key={p.appt_id} className="flex items-center justify-between rounded-lg bg-brand-secondary/40 border border-brand-default/50 p-2.5">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold text-brand-text-primary truncate">{p.patient_name}</p>
                                                    <p className="text-[10px] text-brand-text-muted truncate mt-0.5">{p.procedure}</p>
                                                </div>
                                                <div className="ml-3 shrink-0">
                                                    <span className="rounded bg-brand-accent/10 px-1.5 py-0.5 text-[9px] font-black text-brand-accent">
                                                        {p.time}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-[10px] text-brand-text-muted italic py-2">No patients scheduled</p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {rooms.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Building2 size={48} className="text-brand-text-muted mb-4" />
                        <p className="text-lg font-bold text-brand-text-primary">No rooms configured</p>
                        <p className="text-sm text-brand-text-muted mt-1">Rooms will appear here once added to the system</p>
                    </div>
                )}
            </motion.div>
        </DashboardLayout>
    );
}
