"use client";

import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { motion, Variants } from "framer-motion";
import {
    Users,
    RefreshCw,
    Search,
    Phone,
    Mail,
    Calendar,
    UserPlus,
    ChevronRight,
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

interface PatientItem {
    patient_id: string;
    name: string;
    phone: string;
    email: string | null;
    dob: string | null;
    is_new: boolean;
    created_at: string;
}

export default function AdminPatients() {
    const [patients, setPatients] = useState<PatientItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const loadPatients = useCallback(async () => {
        try {
            // Fetch from dashboard stats to get active patient count
            const res = await fetch(`${API_BASE}/api/dashboard/stats`);
            const data = await res.json();
            // Since there's no dedicated list-all-patients endpoint yet,
            // we show the patient count from dashboard and provide a search
            setPatients([]);
        } catch (err) {
            console.error("Failed to load patients:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    const searchPatient = async () => {
        if (!searchQuery.trim()) return;
        try {
            // Try to find patient by phone (login endpoint)
            const res = await fetch(`${API_BASE}/api/patients/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: searchQuery }),
            });
            if (res.ok) {
                const data = await res.json();
                setPatients([data]);
            } else {
                setPatients([]);
            }
        } catch (err) {
            console.error("Search failed:", err);
        }
    };

    useEffect(() => {
        loadPatients();
    }, [loadPatients]);

    if (loading) {
        return (
            <DashboardLayout role="admin" title="Patient Records" subtitle="Patient management and directory">
                <div className="flex h-[400px] items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-accent border-t-transparent"></div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout role="admin" title="Patient Records" subtitle="Patient management and directory">
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
                {/* Search + Actions */}
                <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <div className="flex-1 flex items-center gap-2 rounded-xl border border-brand-default bg-brand-secondary px-4 py-3 transition-all focus-within:border-brand-accent/50 focus-within:ring-4 focus-within:ring-brand-accent/5">
                        <Search size={18} className="text-brand-text-muted shrink-0" />
                        <input
                            type="text"
                            placeholder="Search by phone number..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && searchPatient()}
                            className="flex-1 bg-transparent text-sm text-brand-text-primary placeholder-brand-text-muted outline-none"
                        />
                        <button
                            onClick={searchPatient}
                            className="rounded-lg bg-brand-accent px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white transition-all hover:bg-brand-accent/90"
                        >
                            Search
                        </button>
                    </div>
                    <button
                        onClick={loadPatients}
                        className="flex items-center justify-center gap-2 rounded-xl bg-brand-secondary border border-brand-default px-5 py-3 text-xs font-semibold text-brand-text-secondary transition-all hover:bg-brand-elevated hover:text-brand-text-primary"
                    >
                        <RefreshCw size={14} />
                        Refresh
                    </button>
                </motion.div>

                {/* Patient Cards */}
                {patients.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {patients.map((patient) => (
                            <motion.div
                                key={patient.patient_id}
                                variants={itemVariants}
                                className="group rounded-xl border border-brand-default bg-brand-card p-6 transition-all hover:border-brand-accent/30"
                            >
                                <div className="flex items-start gap-4 mb-6">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-accent to-indigo-400 text-lg font-bold text-white shrink-0">
                                        {patient.name
                                            .split(" ")
                                            .map((n) => n[0])
                                            .join("")
                                            .toUpperCase()
                                            .slice(0, 2)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-base font-bold text-brand-text-primary truncate">{patient.name}</h3>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mt-1">
                                            ID: {patient.patient_id.slice(0, 8)}...
                                        </p>
                                        {patient.is_new && (
                                            <span className="mt-2 inline-block rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-400">
                                                New Patient
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-sm">
                                        <Phone size={14} className="text-brand-text-muted shrink-0" />
                                        <span className="text-brand-text-secondary font-medium truncate">{patient.phone}</span>
                                    </div>
                                    {patient.email && (
                                        <div className="flex items-center gap-3 text-sm">
                                            <Mail size={14} className="text-brand-text-muted shrink-0" />
                                            <span className="text-brand-text-secondary font-medium truncate">{patient.email}</span>
                                        </div>
                                    )}
                                    {patient.dob && (
                                        <div className="flex items-center gap-3 text-sm">
                                            <Calendar size={14} className="text-brand-text-muted shrink-0" />
                                            <span className="text-brand-text-secondary font-medium">{patient.dob}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-6 pt-4 border-t border-brand-default">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                        Registered {new Date(patient.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <motion.div variants={itemVariants} className="rounded-xl border border-brand-default bg-brand-card">
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <Users size={48} className="text-brand-text-muted mb-4" />
                            <p className="text-lg font-bold text-brand-text-primary">Search for patients</p>
                            <p className="text-sm text-brand-text-muted mt-1 max-w-md">
                                Enter a phone number above to look up patient records. Patients are added when they register through the booking system.
                            </p>
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </DashboardLayout>
    );
}
