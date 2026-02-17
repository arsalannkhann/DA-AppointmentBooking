"use client";

import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { getDashboardStats } from "@/lib/api";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
} from "recharts";
import {
    Users,
    Calendar,
    Clock,
    AlertTriangle,
    MoreHorizontal,
    ArrowUpRight,
    ArrowDownRight,
    RefreshCw,
} from "lucide-react";
import { motion, Variants } from "framer-motion";

// Types for DB Stats
interface DBStats {
    overview: {
        total_appointments: number;
        scheduled: number;
        completed: number;
        cancelled: number;
        emergency_bookings: number;
        active_patients: number;
    };
    recent_activity: Array<{
        id: number;
        user: string;
        action: string;
        target: string;
        time: string;
        status: string;
        avatar: string;
    }>;
    procedure_distribution: Array<{
        name: string;
        count: number;
        value: number;
        color: string;
    }>;
    doctor_utilization: Array<{
        id: string;
        name: string;
        booked_slots: number;
        utilization_pct: number;
    }>;
    room_utilization: Array<{
        id: string;
        name: string;
        clinic: string;
        type: string;
        booked_slots: number;
        utilization_pct: number;
    }>;
}

// Simulated trend data (since backend is current-state only for now)
const utilizationTrend = [
    { name: "Mon", value: 65, target: 80 },
    { name: "Tue", value: 78, target: 80 },
    { name: "Wed", value: 85, target: 80 },
    { name: "Thu", value: 72, target: 80 },
    { name: "Fri", value: 60, target: 80 },
    { name: "Sat", value: 45, target: 60 },
    { name: "Sun", value: 30, target: 40 },
];

// Animation variants
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } },
};

export default function AdminDashboard() {
    const [stats, setStats] = useState<DBStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadStats = useCallback(async () => {
        try {
            setRefreshing(true);
            const data = await getDashboardStats();
            setStats(data);
        } catch (err) {
            console.error("Failed to load dashboard stats:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    if (loading && !stats) {
        return (
            <DashboardLayout role="admin" title="Operations Overview" subtitle="Real-time clinic performance metrics">
                <div className="flex h-[400px] items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
                </div>
            </DashboardLayout>
        );
    }

    // Use real data if available, otherwise fail gracefully (shouldn't happen with loading check)
    if (!stats) return null;

    const kpiStats = [
        { title: "Total Appointments", value: stats.overview.total_appointments.toLocaleString(), change: "+12.5%", trend: "up", icon: Calendar, subtext: "vs last month" },
        { title: "Active Patients", value: stats.overview.active_patients.toLocaleString(), change: "+3.2%", trend: "up", icon: Users, subtext: "vs last month" },
        { title: "Avg. Wait Time", value: "14m", change: "-2m", trend: "down", isPositive: true, icon: Clock, subtext: "vs last week" },
        { title: "Emergency Cases", value: stats.overview.emergency_bookings.toString(), change: "+5", trend: "up", alert: true, icon: AlertTriangle, subtext: "requires attention" },
    ];

    return (
        <DashboardLayout role="admin" title="Operations Intelligence" subtitle="Real-time clinical performance and predictive utilization metrics">

            {/* Header Actions */}
            <div className="mb-8 flex justify-end">
                <button
                    onClick={loadStats}
                    disabled={refreshing}
                    className="group flex items-center gap-2 rounded-lg bg-brand-secondary border border-brand-default px-5 py-2.5 text-xs font-semibold text-brand-text-secondary transition-all hover:bg-brand-elevated hover:text-brand-text-primary disabled:opacity-50"
                >
                    <RefreshCw size={14} className={refreshing ? "animate-spin" : "transition-transform group-hover:rotate-180"} />
                    Recalibrate Analytics
                </button>
            </div>

            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">

                {/* KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {kpiStats.map((stat, i) => (
                        <motion.div key={i} variants={itemVariants} className="group rounded-xl border border-brand-default bg-brand-card p-6 transition-all hover:border-indigo-500/40">
                            <div className="relative">
                                <div className="flex items-start justify-between">
                                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.alert ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"}`}>
                                        <stat.icon size={22} strokeWidth={2} />
                                    </div>
                                    {stat.alert ? (
                                        <span className="flex h-2 w-2 rounded-full bg-rose-500" />
                                    ) : (
                                        <button className="rounded-lg p-2 text-brand-text-muted transition-colors hover:bg-brand-elevated hover:text-brand-text-primary">
                                            <MoreHorizontal size={18} />
                                        </button>
                                    )}
                                </div>
                                <div className="mt-8">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">{stat.title}</p>
                                    <div className="mt-2 flex items-baseline gap-2">
                                        <h3 className="text-3xl font-bold text-brand-text-primary tracking-tight">{stat.value}</h3>
                                        <div className={`flex items-center gap-1 text-[10px] font-bold ${stat.isPositive ? "text-emerald-500" : stat.alert ? "text-rose-500" : "text-emerald-500"}`}>
                                            {stat.change}
                                        </div>
                                    </div>
                                    <p className="mt-2 text-[10px] font-medium text-brand-text-muted uppercase tracking-widest">{stat.subtext}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Main Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <motion.div variants={itemVariants} className="lg:col-span-2 rounded-xl border border-brand-default bg-brand-card p-6">
                        <div className="mb-10 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-brand-text-primary">Clinical Utilization</h3>
                                <p className="text-sm text-brand-text-muted mt-1">Network occupancy performance index</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-text-muted border-r border-brand-default pr-4">
                                    <div className="h-2 w-2 rounded-full bg-indigo-500" /> {stats.overview.scheduled} Scheduled
                                </div>
                                <select className="rounded-lg border border-brand-default bg-brand-secondary px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-text-primary outline-none transition-all hover:border-indigo-500/40 cursor-pointer">
                                    <option>View: Week</option>
                                    <option>View: Month</option>
                                </select>
                            </div>
                        </div>
                        <div className="h-[340px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={utilizationTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorUtil" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.05)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 10, fontWeight: 600 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 10, fontWeight: 600 }} tickFormatter={(value) => `${value}%`} />
                                    <Tooltip content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="rounded-lg border border-brand-default bg-brand-secondary p-3">
                                                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">{label}</p>
                                                    <p className="text-sm font-bold text-brand-text-primary">{payload[0].value}% <span className="text-[10px] font-medium text-indigo-400 ml-1">Utilization</span></p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }} />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#6366f1"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorUtil)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants} className="rounded-xl border border-brand-default bg-brand-card p-6">
                        <div className="mb-10">
                            <h3 className="text-xl font-bold text-brand-text-primary">Clinical Mix</h3>
                            <p className="text-sm text-brand-text-muted mt-1">Case distribution taxonomy</p>
                        </div>
                        <div className="relative h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.procedure_distribution}
                                        innerRadius={70}
                                        outerRadius={90}
                                        paddingAngle={6}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {stats.procedure_distribution.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.color}
                                                className="outline-none"
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="rounded-lg border border-brand-default bg-brand-secondary p-3">
                                                    <p className="text-sm font-bold text-brand-text-primary">{data.name}</p>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mt-1">{data.count} cases ({data.value}%)</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                                <p className="text-3xl font-black text-brand-text-primary">{stats.overview.total_appointments}</p>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-text-muted mt-1">Total</p>
                            </div>
                        </div>
                        <div className="mt-8 space-y-3">
                            {stats.procedure_distribution.map((item, i) => (
                                <div key={i} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-sm font-medium text-brand-text-secondary group-hover:text-brand-text-primary transition-colors">{item.name}</span>
                                    </div>
                                    <span className="text-sm font-bold text-brand-text-primary">{item.value}%</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>

                {/* 3. Specialist Utilization & Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <motion.div variants={itemVariants} className="rounded-xl border border-brand-default bg-brand-card p-6">
                        <div className="mb-10">
                            <h3 className="text-xl font-bold text-brand-text-primary">Specialist Matrix</h3>
                            <p className="text-sm text-brand-text-muted mt-1">Provider throughput & allocation</p>
                        </div>
                        <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.doctor_utilization} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255, 255, 255, 0.05)" />
                                    <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 10, fontWeight: 600 }} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 11, fontWeight: 600 }} width={80} />
                                    <Tooltip
                                        cursor={{ fill: "rgba(255, 255, 255, 0.02)" }}
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="rounded-lg border border-brand-default bg-brand-secondary p-3">
                                                        <p className="text-sm font-bold text-brand-text-primary">{label}</p>
                                                        <p className="text-xs font-bold text-indigo-400 mt-1">{payload[0].value}% <span className="text-[10px] font-medium text-brand-text-muted">Utilization</span></p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="utilization_pct" radius={[0, 4, 4, 0]} barSize={24}>
                                        {stats.doctor_utilization.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.utilization_pct > 80 ? "#6366f1" : entry.utilization_pct > 50 ? "#818cf8" : "#374151"}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants} className="rounded-xl border border-brand-default bg-brand-card p-6">
                        <div className="mb-10 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-brand-text-primary">Clinical Stream</h3>
                                <p className="text-sm text-brand-text-muted mt-1">Real-time enterprise event log</p>
                            </div>
                            <div className="flex items-center gap-2.5 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Live</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {stats.recent_activity.map((act) => (
                                <div key={act.id} className="group flex items-start gap-4 rounded-xl border border-brand-default bg-brand-secondary p-4 transition-all hover:bg-brand-tertiary">
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${act.status === "success" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/10" : act.status === "warning" ? "bg-amber-500/10 text-amber-500 border border-amber-500/10" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/10"}`}>
                                        {act.avatar}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="truncate text-sm font-bold text-brand-text-primary group-hover:text-indigo-400 transition-colors">{act.action}</p>
                                            <span className="shrink-0 text-[10px] font-medium text-brand-text-muted uppercase tracking-wider">{act.time}</span>
                                        </div>
                                        <p className="mt-1 text-xs font-medium text-brand-text-muted">{act.user} • <span className="text-brand-text-secondary">{act.target}</span></p>
                                        <div className="mt-2 flex items-center gap-2">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-accent/70 px-1.5 py-0.5 rounded bg-brand-accent/5 border border-brand-accent/10">Doctor: {stats.doctor_utilization.find(d => d.id === String(act.id))?.name || "Primary Specialist"}</span>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted px-1.5 py-0.5 rounded bg-brand-secondary border border-brand-default">Branch: {stats.room_utilization[0]?.clinic || "Main Clinic"}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {stats.recent_activity.length === 0 && (
                                <p className="text-sm font-medium text-brand-text-muted text-center py-8">No recent activity recorded</p>
                            )}
                        </div>
                    </motion.div>
                </div>

                {/* Room Heatmap */}
                <motion.div variants={itemVariants} className="rounded-xl border border-brand-default bg-brand-card p-6">
                    <div className="mb-10">
                        <h3 className="text-xl font-bold text-brand-text-primary">Spatial Intelligence</h3>
                        <p className="text-sm text-brand-text-muted mt-1">Clinical treatment zone density map</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                        {stats.room_utilization.map((room) => (
                            <div key={room.id} className="group p-5 rounded-xl bg-brand-secondary border border-brand-default transition-all hover:border-indigo-500/30">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mb-4">{room.name}</p>
                                <div className="flex items-end gap-1.5 h-16 mb-4">
                                    <div className="flex-1 bg-brand-elevated rounded-md h-full"></div>
                                    <div className="flex-1 bg-indigo-500/30 rounded-md transition-all group-hover:bg-indigo-500/50" style={{ height: `${room.utilization_pct}%` }}></div>
                                </div>
                                <div className="flex justify-between items-center bg-brand-secondary px-3 py-1.5 rounded-lg border border-brand-default">
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-brand-text-muted">{room.booked_slots} SLOTS</span>
                                    <span className="text-[10px] font-bold text-brand-text-primary">{room.utilization_pct}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </motion.div>
        </DashboardLayout>
    );
}