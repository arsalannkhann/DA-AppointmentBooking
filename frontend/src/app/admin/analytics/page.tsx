"use client";

import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { getDashboardStats } from "@/lib/api";
import { motion, Variants } from "framer-motion";
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
    LineChart,
    Line,
} from "recharts";
import {
    BarChart3,
    RefreshCw,
    TrendingUp,
    Users,
    Calendar,
    Clock,
} from "lucide-react";

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } },
};

// Weekly trend data
const weeklyTrend = [
    { day: "Mon", appointments: 12, patients: 10, cancellations: 1 },
    { day: "Tue", appointments: 18, patients: 15, cancellations: 2 },
    { day: "Wed", appointments: 22, patients: 19, cancellations: 1 },
    { day: "Thu", appointments: 15, patients: 13, cancellations: 3 },
    { day: "Fri", appointments: 20, patients: 17, cancellations: 2 },
    { day: "Sat", appointments: 8, patients: 7, cancellations: 0 },
    { day: "Sun", appointments: 3, patients: 3, cancellations: 0 },
];

const monthlyRevenue = [
    { month: "Sep", value: 42000 },
    { month: "Oct", value: 48000 },
    { month: "Nov", value: 51000 },
    { month: "Dec", value: 46000 },
    { month: "Jan", value: 55000 },
    { month: "Feb", value: 58000 },
];

export default function AdminAnalytics() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async () => {
        try {
            setRefreshing(true);
            const data = await getDashboardStats();
            setStats(data);
        } catch (err) {
            console.error("Failed to load analytics:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading) {
        return (
            <DashboardLayout role="admin" title="Analytics" subtitle="Performance insights and trends">
                <div className="flex h-[400px] items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-accent border-t-transparent"></div>
                </div>
            </DashboardLayout>
        );
    }

    const overview = stats?.overview || {};

    return (
        <DashboardLayout role="admin" title="Analytics Intelligence" subtitle="Operational performance insights and predictive trends">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                        Live Data
                    </span>
                </div>
                <button
                    onClick={loadData}
                    disabled={refreshing}
                    className="group flex items-center gap-2 rounded-lg bg-brand-secondary border border-brand-default px-5 py-2.5 text-xs font-semibold text-brand-text-secondary transition-all hover:bg-brand-elevated hover:text-brand-text-primary disabled:opacity-50"
                >
                    <RefreshCw size={14} className={refreshing ? "animate-spin" : "transition-transform group-hover:rotate-180"} />
                    Refresh Data
                </button>
            </div>

            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: "Total Appointments", value: overview.total_appointments ?? 0, icon: Calendar, trend: "+12.5%", color: "text-brand-accent" },
                        { label: "Active Patients", value: overview.active_patients ?? 0, icon: Users, trend: "+3.2%", color: "text-cyan-400" },
                        { label: "Completion Rate", value: overview.total_appointments ? `${Math.round((overview.completed / overview.total_appointments) * 100)}%` : "0%", icon: TrendingUp, trend: "+5%", color: "text-emerald-400" },
                        { label: "Cancellation Rate", value: overview.total_appointments ? `${Math.round((overview.cancelled / overview.total_appointments) * 100)}%` : "0%", icon: Clock, trend: "-2%", color: "text-rose-400" },
                    ].map((kpi, i) => (
                        <motion.div key={i} variants={itemVariants} className="rounded-xl border border-brand-default bg-brand-card p-6">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-brand-secondary border border-brand-default mb-6`}>
                                <kpi.icon size={20} className={kpi.color} />
                            </div>
                            <p className="text-3xl font-bold text-brand-text-primary tracking-tight">{kpi.value}</p>
                            <div className="flex items-center justify-between mt-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">{kpi.label}</p>
                                <span className="text-[10px] font-bold text-emerald-500">{kpi.trend}</span>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Weekly Trend */}
                    <motion.div variants={itemVariants} className="rounded-xl border border-brand-default bg-brand-card p-6">
                        <div className="mb-10">
                            <h3 className="text-xl font-bold text-brand-text-primary">Weekly Activity</h3>
                            <p className="text-sm text-brand-text-muted mt-1">Appointments vs patients per day</p>
                        </div>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weeklyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 10, fontWeight: 600 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 10, fontWeight: 600 }} />
                                    <Tooltip
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="rounded-lg border border-brand-default bg-brand-secondary p-3">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mb-1">{label}</p>
                                                        {payload.map((p: any, i: number) => (
                                                            <p key={i} className="text-xs font-bold" style={{ color: p.color }}>
                                                                {p.value} {p.dataKey}
                                                            </p>
                                                        ))}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="appointments" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Bar dataKey="cancellations" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    {/* Revenue Trend */}
                    <motion.div variants={itemVariants} className="rounded-xl border border-brand-default bg-brand-card p-6">
                        <div className="mb-10">
                            <h3 className="text-xl font-bold text-brand-text-primary">Revenue Trend</h3>
                            <p className="text-sm text-brand-text-muted mt-1">Monthly performance over 6 months</p>
                        </div>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={monthlyRevenue} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 10, fontWeight: 600 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 10, fontWeight: 600 }} tickFormatter={(v) => `$${v / 1000}k`} />
                                    <Tooltip
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="rounded-lg border border-brand-default bg-brand-secondary p-3">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mb-1">{label}</p>
                                                        <p className="text-sm font-bold text-emerald-400">${(payload[0].value as number).toLocaleString()}</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>
                </div>

                {/* Procedure Distribution + Doctor Performance */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Procedure Distribution */}
                    <motion.div variants={itemVariants} className="rounded-xl border border-brand-default bg-brand-card p-6">
                        <div className="mb-10">
                            <h3 className="text-xl font-bold text-brand-text-primary">Procedure Distribution</h3>
                            <p className="text-sm text-brand-text-muted mt-1">Case type breakdown</p>
                        </div>
                        {stats?.procedure_distribution && stats.procedure_distribution.length > 0 ? (
                            <>
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
                                                {stats.procedure_distribution.map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                                        <p className="text-3xl font-black text-brand-text-primary">{overview.total_appointments}</p>
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-text-muted mt-1">Total</p>
                                    </div>
                                </div>
                                <div className="mt-6 space-y-3">
                                    {stats.procedure_distribution.map((item: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                                <span className="text-sm font-medium text-brand-text-secondary">{item.name}</span>
                                            </div>
                                            <span className="text-sm font-bold text-brand-text-primary">{item.value}%</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center py-16">
                                <p className="text-sm text-brand-text-muted">No procedure data available</p>
                            </div>
                        )}
                    </motion.div>

                    {/* Doctor Utilization */}
                    <motion.div variants={itemVariants} className="rounded-xl border border-brand-default bg-brand-card p-6">
                        <div className="mb-10">
                            <h3 className="text-xl font-bold text-brand-text-primary">Doctor Performance</h3>
                            <p className="text-sm text-brand-text-muted mt-1">Specialist utilization rates</p>
                        </div>
                        {stats?.doctor_utilization && stats.doctor_utilization.length > 0 ? (
                            <div className="h-[340px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.doctor_utilization} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
                                        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 10, fontWeight: 600 }} />
                                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 11, fontWeight: 600 }} width={80} />
                                        <Tooltip
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="rounded-lg border border-brand-default bg-brand-secondary p-3">
                                                            <p className="text-sm font-bold text-brand-text-primary">{label}</p>
                                                            <p className="text-xs font-bold text-cyan-400 mt-1">{payload[0].value}% Utilization</p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="utilization_pct" radius={[0, 4, 4, 0]} barSize={24}>
                                            {stats.doctor_utilization.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={entry.utilization_pct > 80 ? "#06b6d4" : entry.utilization_pct > 50 ? "#22d3ee" : "#374151"} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center py-16">
                                <p className="text-sm text-brand-text-muted">No doctor data available</p>
                            </div>
                        )}
                    </motion.div>
                </div>
            </motion.div>
        </DashboardLayout>
    );
}
