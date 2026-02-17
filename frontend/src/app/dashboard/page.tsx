"use client";

import { useState, useEffect } from "react";
import { motion, Variants } from "framer-motion";
import {
    Activity,
    Calendar,
    CheckCircle2,
    AlertTriangle,
    Clock,
    TrendingUp,
    Users,
    Building2,
    Stethoscope,
    DoorOpen,
    MapPin,
    MoreHorizontal,
    ArrowUpRight,
    ArrowDownRight,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
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
} from "recharts";
import { getDashboardStats } from "@/lib/api";

interface DashboardData {
    overview: {
        total_appointments: number;
        scheduled: number;
        completed: number;
        cancelled: number;
        emergency_bookings: number;
    };
    doctor_utilization: Array<{
        id: string;
        name: string;
        specialty?: string;
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
    clinic_breakdown: Array<{
        id: string;
        name: string;
        location: string;
        scheduled_appointments: number;
    }>;
}

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1 },
    },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
    },
};

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#10b981"];

export default function DashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");

    useEffect(() => {
        getDashboardStats()
            .then(setData)
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <DashboardLayout role="admin" title="Operations Intelligence">
                <div className="flex h-[60vh] items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                        <p className="text-sm text-brand-text-secondary">Loading operational data...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (!data) {
        return (
            <DashboardLayout role="admin" title="Operations Intelligence">
                <div className="flex h-[60vh] flex-col items-center justify-center rounded-xl border border-brand-default bg-brand-secondary p-12 text-center">
                    <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-brand-secondary border border-brand-default">
                        <Activity size={28} className="text-brand-text-secondary" />
                    </div>
                    <h3 className="text-xl font-bold text-brand-text-primary">Connection Error</h3>
                    <p className="mt-2 max-w-sm text-sm text-brand-text-secondary">
                        Unable to establish a connection with the clinical data stream.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-8 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-brand-text-primary transition-all hover:bg-indigo-500"
                    >
                        Retry Connection
                    </button>
                </div>
            </DashboardLayout>
        );
    }

    const { overview, doctor_utilization, room_utilization, clinic_breakdown } =
        data;

    // Calculate metrics
    const completionRate =
        overview.total_appointments > 0
            ? Math.round((overview.completed / overview.total_appointments) * 100)
            : 0;
    const cancellationRate =
        overview.total_appointments > 0
            ? Math.round((overview.cancelled / overview.total_appointments) * 100)
            : 0;

    // Chart data
    const statusData = [
        { name: "Scheduled", value: overview.scheduled, color: "#6366f1" },
        { name: "Completed", value: overview.completed, color: "#10b981" },
        { name: "Cancelled", value: overview.cancelled, color: "#f43f5e" },
    ];

    const kpiCards = [
        {
            title: "Total Appointments",
            value: overview.total_appointments,
            change: "+12.5%",
            trend: "up",
            icon: Calendar,
            color: "indigo",
        },
        {
            title: "Scheduled Today",
            value: overview.scheduled,
            change: "+5.2%",
            trend: "up",
            icon: Clock,
            color: "blue",
        },
        {
            title: "Completed",
            value: overview.completed,
            change: `${completionRate}%`,
            trend: "up",
            icon: CheckCircle2,
            color: "emerald",
            isPercentage: true,
        },
        {
            title: "Emergency Bookings",
            value: overview.emergency_bookings,
            change: cancellationRate > 10 ? "High" : "Normal",
            trend: overview.emergency_bookings > 5 ? "up" : "down",
            icon: AlertTriangle,
            color: "rose",
            alert: overview.emergency_bookings > 5,
        },
    ];

    return (
        <DashboardLayout
            role="admin"
            title="Operations Intelligence"
            subtitle="Clinical performance and predictive utilization metrics"
        >
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-6"
            >
                {/* Header Controls */}
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-1 rounded-xl border border-brand-default bg-brand-secondary p-1">
                        {(["24h", "7d", "30d"] as const).map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${timeRange === range
                                    ? "bg-indigo-600 text-brand-text-primary"
                                    : "text-brand-text-secondary hover:text-brand-text-primary"
                                    }`}
                            >
                                {range === "24h" ? "24h" : `${range}`}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2.5 bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-500/20">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">System Live</span>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {kpiCards.map((kpi, idx) => (
                        <motion.div
                            key={idx}
                            variants={itemVariants}
                            className="group rounded-xl border border-brand-default bg-brand-card p-6 transition-all hover:border-indigo-500/40"
                        >
                            <div className="relative">
                                <div className="flex items-start justify-between">
                                    <div
                                        className={`flex h-10 w-10 items-center justify-center rounded-lg border ${kpi.color === "indigo"
                                            ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                                            : kpi.color === "emerald"
                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                : kpi.color === "rose"
                                                    ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                                    : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                            }`}
                                    >
                                        <kpi.icon size={20} strokeWidth={2} />
                                    </div>
                                    {kpi.alert && (
                                        <span className="flex h-2 w-2 rounded-full bg-rose-500" />
                                    )}
                                </div>
                                <div className="mt-8">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                        {kpi.title}
                                    </p>
                                    <div className="mt-2 flex items-baseline gap-3">
                                        <h3 className="text-3xl font-bold text-brand-text-primary tracking-tight">
                                            {kpi.value}
                                        </h3>
                                        <div
                                            className={`flex items-center gap-1 text-[10px] font-bold ${kpi.trend === "up" && !kpi.alert
                                                ? "text-emerald-500"
                                                : kpi.alert
                                                    ? "text-rose-500"
                                                    : "text-brand-text-muted"
                                                }`}
                                        >
                                            {kpi.change}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Specialist Utilization - Takes 2 cols */}
                    <motion.div
                        variants={itemVariants}
                        className="lg:col-span-2 rounded-xl border border-brand-default bg-brand-card p-6"
                    >
                        <div className="mb-8 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-brand-text-primary">
                                    Specialist Matrix
                                </h3>
                                <p className="text-sm text-brand-text-muted mt-1">
                                    Provider throughput & allocation metrics
                                </p>
                            </div>
                            <button className="rounded-lg border border-brand-default bg-brand-secondary px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-text-primary transition-all hover:bg-brand-tertiary">
                                Full Directory
                            </button>
                        </div>

                        <div className="space-y-6">
                            {doctor_utilization.map((doc) => (
                                <div
                                    key={doc.id}
                                    className="group rounded-xl border border-brand-default bg-brand-secondary p-5 transition-all hover:bg-brand-tertiary"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-secondary border border-brand-default text-brand-text-secondary">
                                                <span className="text-xs font-bold uppercase">
                                                    {doc.name.split(" ").map((n) => n[0]).join("")}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-bold text-brand-text-primary tracking-tight">{doc.name}</p>
                                                <p className="text-[10px] font-medium text-brand-text-muted mt-0.5 uppercase tracking-wider">
                                                    {doc.booked_slots} slots allocated
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span
                                                className={`text-lg font-bold tracking-tight ${doc.utilization_pct > 80
                                                    ? "text-rose-500"
                                                    : doc.utilization_pct > 60
                                                        ? "text-amber-500"
                                                        : "text-emerald-500"
                                                    }`}
                                            >
                                                {doc.utilization_pct}%
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-secondary border border-brand-default">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${doc.utilization_pct}%` }}
                                                transition={{ duration: 1, ease: "easeOut" }}
                                                className={`h-full rounded-full ${doc.utilization_pct > 80
                                                    ? "bg-rose-500"
                                                    : doc.utilization_pct > 60
                                                        ? "bg-amber-500"
                                                        : "bg-emerald-500"
                                                    }`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Status Distribution & Quick Stats */}
                    <motion.div variants={itemVariants} className="space-y-6">
                        {/* Appointment Status Chart */}
                        <div className="rounded-xl border border-brand-default bg-brand-card p-6">
                            <h3 className="mb-6 text-xl font-bold text-brand-text-primary">
                                Progress Matrix
                            </h3>
                            <div className="h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={statusData}
                                            innerRadius={50}
                                            outerRadius={70}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {statusData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: "#1F2937",
                                                borderColor: "#374151",
                                                borderRadius: "8px",
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-4 space-y-2">
                                {statusData.map((item) => (
                                    <div
                                        key={item.name}
                                        className="flex items-center justify-between text-sm"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="h-2.5 w-2.5 rounded-full"
                                                style={{ backgroundColor: item.color }}
                                            />
                                            <span className="text-brand-text-secondary">{item.name}</span>
                                        </div>
                                        <span className="font-medium text-brand-text-primary">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Room Utilization Table */}
                <motion.div
                    variants={itemVariants}
                    className="rounded-xl border border-brand-default bg-brand-card p-6"
                >
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold text-brand-text-primary">
                                Clinical Occupancy
                            </h3>
                            <p className="text-sm text-brand-text-muted mt-1">
                                Real-time clinical treatment area allocation
                            </p>
                        </div>
                        <button className="rounded-lg border border-brand-default bg-brand-secondary px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-text-primary transition-all hover:bg-brand-tertiary">
                            Manage
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-brand-default">
                                    <th className="pb-4 text-left text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                        Clinical Zone
                                    </th>
                                    <th className="pb-4 text-left text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                        Campus
                                    </th>
                                    <th className="pb-4 text-left text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                        Taxonomy
                                    </th>
                                    <th className="pb-4 text-right text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                        Throughput
                                    </th>
                                    <th className="pb-4 text-right text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                        Efficiency
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {room_utilization.map((room) => (
                                    <tr
                                        key={room.id}
                                        className="group transition-colors hover:bg-white/5"
                                    >
                                        <td className="py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-secondary border border-brand-default">
                                                    <DoorOpen size={18} className="text-indigo-500" />
                                                </div>
                                                <span className="font-bold text-brand-text-primary tracking-tight">
                                                    {room.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <div className="flex items-center gap-2.5 text-xs font-medium text-brand-text-secondary">
                                                <Building2 size={16} className="text-brand-text-disabled" />
                                                {room.clinic}
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <span className="rounded-lg border border-brand-default bg-brand-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-text-secondary">
                                                {room.type}
                                            </span>
                                        </td>
                                        <td className="py-4 text-right text-xs font-bold text-brand-text-secondary">
                                            {room.booked_slots} UNITS
                                        </td>
                                        <td className="py-4">
                                            <div className="flex items-center justify-end gap-4">
                                                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-brand-secondary border border-brand-default">
                                                    <div
                                                        className="h-full rounded-full bg-indigo-600"
                                                        style={{ width: `${room.utilization_pct}%` }}
                                                    />
                                                </div>
                                                <span className="w-12 text-right text-sm font-bold text-brand-text-primary">
                                                    {room.utilization_pct}%
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

                {/* Clinic Breakdown Cards */}
                <motion.div variants={itemVariants}>
                    <div className="mb-6 flex items-center justify-between">
                        <h3 className="text-xl font-bold text-brand-text-primary">Clinical Network</h3>
                        <button className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 hover:text-indigo-400 transition-colors">
                            Regional Insights
                        </button>
                    </div>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {clinic_breakdown.map((clinic) => (
                            <div
                                key={clinic.id}
                                className="group rounded-xl border border-brand-default bg-brand-card p-6 transition-all hover:border-indigo-500/40"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-secondary border border-brand-default">
                                        <MapPin size={20} className="text-indigo-500" />
                                    </div>
                                    <button className="rounded-lg p-2 text-brand-text-muted opacity-0 transition-all group-hover:opacity-100 hover:bg-brand-secondary hover:text-brand-text-primary">
                                        <MoreHorizontal size={20} />
                                    </button>
                                </div>
                                <div className="mt-8">
                                    <p className="text-3xl font-bold text-brand-text-primary tracking-tight">
                                        {clinic.scheduled_appointments}
                                    </p>
                                    <p className="mt-2 text-lg font-bold text-brand-text-primary">
                                        {clinic.name}
                                    </p>
                                    <p className="mt-1 text-[10px] font-bold text-brand-text-muted uppercase tracking-widest">
                                        {clinic.location}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </motion.div>
        </DashboardLayout>
    );
}