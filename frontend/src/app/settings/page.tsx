"use client";

import { useState, useEffect } from "react";
import { motion, Variants } from "framer-motion";
import {
    User,
    Mail,
    Phone,
    Shield,
    Camera,
    Edit3,
    Check,
    Lock,
    Bell,
    Moon,
    Globe,
    ChevronRight,
    AlertCircle,
    Save,
    Loader2,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [activeTab, setActiveTab] = useState<"profile" | "preferences" | "security">("profile");

    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        dob: "",
        notifications: true,
        dark_mode: true,
        language: "en",
    });

    const [patientId, setPatientId] = useState<string | null>(null);

    useEffect(() => {
        const id = localStorage.getItem("patientId");
        if (!id) {
            setLoading(false);
            return;
        }
        setPatientId(id);
        fetch(`${API_BASE}/api/settings/${id}`)
            .then((r) => r.json())
            .then((data) => {
                setForm({
                    name: data.name || "",
                    email: data.email || "",
                    phone: data.phone || "",
                    dob: data.dob || "",
                    notifications: data.notifications ?? true,
                    dark_mode: data.dark_mode ?? true,
                    language: data.language || "en",
                });
            })
            .catch(() => {
                // If fetch fails, use localStorage fallback
                const name = localStorage.getItem("patientName") || "";
                setForm((prev) => ({ ...prev, name }));
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        if (!patientId) return;
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE}/api/settings/${patientId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                const data = await res.json();
                localStorage.setItem("patientName", data.name);
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            }
        } catch (e) {
            console.error("Failed to save settings:", e);
        } finally {
            setSaving(false);
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    if (loading) {
        return (
            <DashboardLayout role="patient" title="Settings" subtitle="Loading your preferences...">
                <div className="flex items-center justify-center py-32">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-accent" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout
            role="patient"
            title="Settings"
            subtitle="Manage your account and preferences"
        >
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="mx-auto max-w-5xl"
            >
                {/* Header Card */}
                <motion.div
                    variants={itemVariants}
                    className="relative mb-8 overflow-hidden rounded-xl border border-brand-default bg-brand-card p-6"
                >
                    <div className="relative flex flex-col items-center gap-8 sm:flex-row sm:items-center">
                        <div className="relative flex shrink-0">
                            <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-brand-default bg-brand-secondary text-3xl font-bold text-brand-text-primary">
                                {getInitials(form.name || "U")}
                            </div>
                            <button className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-accent text-white transition-all hover:bg-brand-accent/90">
                                <Camera size={18} />
                            </button>
                        </div>

                        <div className="flex-1 text-center sm:text-left">
                            <h1 className="text-2xl font-bold text-brand-text-primary tracking-tight">
                                {form.name || "Patient"}
                            </h1>
                            <p className="mt-1 text-base font-medium text-brand-text-muted">
                                {form.email || "No email set"}
                            </p>
                            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                                <span className="rounded-lg bg-brand-accent/10 border border-brand-accent/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-accent">
                                    Standard Plan
                                </span>
                                <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                                    Active
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 rounded-lg bg-brand-accent px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-white transition-all hover:bg-brand-accent/90 disabled:opacity-50"
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Saving...
                                </>
                            ) : saved ? (
                                <>
                                    <Check size={16} />
                                    Saved!
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>

                {/* Tab Navigation */}
                <div className="mb-8 flex items-center gap-1 rounded-xl border border-brand-default bg-brand-secondary p-1">
                    {[
                        { id: "profile", label: "Profile", icon: User },
                        { id: "preferences", label: "Preferences", icon: Bell },
                        { id: "security", label: "Security", icon: Shield },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === tab.id
                                ? "bg-brand-accent text-white"
                                : "text-brand-text-muted hover:text-brand-text-primary"
                                }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Profile Tab */}
                {activeTab === "profile" && (
                    <motion.div variants={itemVariants} className="space-y-6">
                        <div className="rounded-xl border border-brand-default bg-brand-card p-6">
                            <h3 className="mb-8 text-xl font-bold text-brand-text-primary tracking-tight">
                                Personal Details
                            </h3>
                            <div className="grid gap-6 sm:grid-cols-2">
                                <div>
                                    <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        className="w-full rounded-lg border border-brand-default bg-brand-secondary px-4 py-3 text-sm font-semibold text-brand-text-primary outline-none transition-all focus:border-brand-accent/50 focus:ring-4 focus:ring-brand-accent/5"
                                    />
                                </div>
                                <div>
                                    <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        className="w-full rounded-lg border border-brand-default bg-brand-secondary px-4 py-3 text-sm font-semibold text-brand-text-primary outline-none transition-all focus:border-brand-accent/50 focus:ring-4 focus:ring-brand-accent/5"
                                    />
                                </div>
                                <div>
                                    <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                        Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        className="w-full rounded-lg border border-brand-default bg-brand-secondary px-4 py-3 text-sm font-semibold text-brand-text-primary outline-none transition-all focus:border-brand-accent/50 focus:ring-4 focus:ring-brand-accent/5"
                                    />
                                </div>
                                <div>
                                    <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                        Date of Birth
                                    </label>
                                    <input
                                        type="date"
                                        value={form.dob}
                                        onChange={(e) => setForm({ ...form, dob: e.target.value })}
                                        className="w-full rounded-lg border border-brand-default bg-brand-secondary px-4 py-3 text-sm font-semibold text-brand-text-primary outline-none transition-all focus:border-brand-accent/50 focus:ring-4 focus:ring-brand-accent/5"
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Preferences Tab */}
                {activeTab === "preferences" && (
                    <motion.div variants={itemVariants} className="space-y-6">
                        <div className="rounded-xl border border-brand-default bg-brand-card p-6">
                            <h3 className="mb-8 text-xl font-bold text-brand-text-primary tracking-tight">
                                Application Preferences
                            </h3>
                            <div className="space-y-6">
                                {/* Notifications Toggle */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-secondary border border-brand-default">
                                            <Bell size={18} className="text-brand-accent" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-brand-text-primary">
                                                Clinical Alerts
                                            </p>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mt-1">
                                                Appointment reminders and notifications
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setForm({ ...form, notifications: !form.notifications })}
                                        className={`relative h-6 w-11 rounded-full transition-all ${form.notifications ? "bg-brand-accent" : "bg-brand-secondary"
                                            }`}
                                    >
                                        <span
                                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${form.notifications ? "right-0.5" : "left-0.5"
                                                }`}
                                        />
                                    </button>
                                </div>

                                {/* Dark Mode Toggle */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-secondary border border-brand-default">
                                            <Moon size={18} className="text-brand-accent" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-brand-text-primary">
                                                Dark Mode
                                            </p>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mt-1">
                                                Professional dark interface theme
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setForm({ ...form, dark_mode: !form.dark_mode })}
                                        className={`relative h-6 w-11 rounded-full transition-all ${form.dark_mode ? "bg-brand-accent" : "bg-brand-secondary"
                                            }`}
                                    >
                                        <span
                                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${form.dark_mode ? "right-0.5" : "left-0.5"
                                                }`}
                                        />
                                    </button>
                                </div>

                                {/* Language */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-secondary border border-brand-default">
                                            <Globe size={18} className="text-brand-accent" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-brand-text-primary">
                                                Language
                                            </p>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mt-1">
                                                Interface display language
                                            </p>
                                        </div>
                                    </div>
                                    <select
                                        value={form.language}
                                        onChange={(e) => setForm({ ...form, language: e.target.value })}
                                        className="rounded-lg border border-brand-default bg-brand-secondary px-3 py-2 text-sm font-semibold text-brand-text-primary outline-none transition-all focus:border-brand-accent/50"
                                    >
                                        <option value="en">English</option>
                                        <option value="hi">Hindi</option>
                                        <option value="es">Spanish</option>
                                        <option value="fr">French</option>
                                        <option value="ar">Arabic</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Security Tab */}
                {activeTab === "security" && (
                    <motion.div variants={itemVariants} className="space-y-6">
                        <div className="rounded-xl border border-brand-default bg-brand-card p-6">
                            <h3 className="mb-8 text-xl font-bold text-brand-text-primary tracking-tight">
                                Security Settings
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between rounded-xl border border-brand-default bg-brand-secondary p-5">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-secondary border border-brand-default">
                                            <Lock size={18} className="text-brand-accent" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-brand-text-primary">
                                                Master Password
                                            </p>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mt-1">
                                                Last changed 3 months ago
                                            </p>
                                        </div>
                                    </div>
                                    <button className="rounded-lg border border-brand-default bg-brand-secondary px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-text-primary transition-all hover:bg-brand-elevated">
                                        Update
                                    </button>
                                </div>
                                <div className="flex items-center justify-between rounded-xl border border-brand-default bg-brand-secondary p-5">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-secondary border border-brand-default">
                                            <Shield size={18} className="text-brand-accent" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-brand-text-primary">
                                                Two-Factor Auth
                                            </p>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mt-1">
                                                Add extra layer of security
                                            </p>
                                        </div>
                                    </div>
                                    <button className="relative h-6 w-11 rounded-full bg-brand-secondary transition-colors">
                                        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-brand-text-disabled shadow-sm" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Security Alert */}
                        <div className="flex items-start gap-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 shrink-0">
                                <AlertCircle size={22} className="text-amber-400" />
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-amber-500">
                                    Recommendation
                                </p>
                                <p className="mt-2 text-sm font-medium text-brand-text-secondary leading-relaxed">
                                    Activate Multi-Factor Authentication to strengthen the security of your clinical records and personal data.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </DashboardLayout>
    );
}
