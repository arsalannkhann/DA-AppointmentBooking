"use client";

import { useState, useEffect } from "react";
import { motion, Variants } from "framer-motion";
import {
    User,
    Mail,
    Phone,
    MapPin,
    Shield,
    CreditCard,
    Camera,
    Edit3,
    Check,
    X,
    Lock,
    Bell,
    Moon,
    Globe,
    ChevronRight,
    AlertCircle,
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

export default function PatientProfile() {
    const [patient, setPatient] = useState({
        name: "Test Patient",
        email: "patient@example.com",
        phone: "+91 98765 43210",
        address: "123 Dental Street, Mumbai, India",
        id: "PAT-2026-001",
        plan: "Premium Member",
        joined: "January 2024",
    });

    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState<"general" | "security" | "billing">("general");

    useEffect(() => {
        const name = localStorage.getItem("patientName");
        const id = localStorage.getItem("patientId");
        if (name) setPatient((prev) => ({ ...prev, name }));
        if (id) setPatient((prev) => ({ ...prev, id }));
    }, []);

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <DashboardLayout
            role="patient"
            title="Profile Settings"
            subtitle="Manage your account information and preferences"
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
                                {getInitials(patient.name)}
                            </div>
                            <button className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 text-brand-text-primary transition-all hover:bg-cyan-500">
                                <Camera size={18} />
                            </button>
                        </div>

                        <div className="flex-1 text-center sm:text-left">
                            <h1 className="text-2xl font-bold text-brand-text-primary tracking-tight">{patient.name}</h1>
                            <p className="mt-1 text-base font-medium text-brand-text-muted">{patient.email}</p>
                            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                                <span className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                                    {patient.plan}
                                </span>
                                <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                                    Active
                                </span>
                                <span className="rounded-lg bg-brand-elevated border border-brand-default px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-text-secondary">
                                    Since {patient.joined}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className={`flex items-center gap-2 rounded-lg px-5 py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${isEditing
                                ? "bg-emerald-600 text-brand-text-primary"
                                : "bg-brand-elevated border border-brand-default text-brand-text-primary hover:bg-brand-elevated"
                                }`}
                        >
                            {isEditing ? (
                                <>
                                    <Check size={16} />
                                    Save Changes
                                </>
                            ) : (
                                <>
                                    <Edit3 size={16} />
                                    Edit Profile
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>

                {/* Tab Navigation */}
                <div className="mb-8 flex items-center gap-1 rounded-xl border border-brand-default bg-brand-secondary p-1">
                    {[
                        { id: "general", label: "Profile", icon: User },
                        { id: "security", label: "Security", icon: Shield },
                        { id: "billing", label: "Billing", icon: CreditCard },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === tab.id
                                ? "bg-cyan-600 text-brand-text-primary"
                                : "text-brand-text-muted hover:text-brand-text-primary"
                                }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Left Column - Contact Info */}
                    <motion.div variants={itemVariants} className="space-y-6 lg:col-span-1">
                        <div className="rounded-xl border border-brand-default bg-brand-card p-6">
                            <h3 className="mb-6 text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                Contact Information
                            </h3>
                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-secondary border border-brand-default">
                                        <Mail size={18} className="text-cyan-400" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Email Address</p>
                                        <p className="truncate text-sm font-semibold text-brand-text-primary mt-0.5">
                                            {patient.email}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-secondary border border-brand-default">
                                        <Phone size={18} className="text-cyan-400" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Phone Number</p>
                                        <p className="truncate text-sm font-semibold text-brand-text-primary mt-0.5">
                                            {patient.phone}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-secondary border border-brand-default">
                                        <MapPin size={18} className="text-cyan-400" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Home Address</p>
                                        <p className="text-sm font-semibold text-brand-text-primary mt-0.5 leading-relaxed">
                                            {patient.address}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="rounded-xl border border-brand-default bg-brand-card p-6">
                            <h3 className="mb-6 text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                Account Overview
                            </h3>
                            <div className="space-y-5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Appointments</span>
                                    <span className="text-sm font-bold text-brand-text-primary">12 Total</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Last Visit</span>
                                    <span className="text-sm font-bold text-cyan-400">Feb 14, 2026</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Health Score</span>
                                    <span className="text-sm font-bold text-emerald-500">92 / 100</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right Column - Settings */}
                    <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
                        {activeTab === "general" && (
                            <div className="space-y-6">
                                {/* Personal Info */}
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
                                                defaultValue={patient.name}
                                                disabled={!isEditing}
                                                className="w-full rounded-lg border border-brand-default bg-brand-secondary px-4 py-3 text-sm font-semibold text-brand-text-primary outline-none transition-all focus:border-cyan-500/50 disabled:opacity-50"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                                Email Address
                                            </label>
                                            <input
                                                type="email"
                                                defaultValue={patient.email}
                                                disabled={!isEditing}
                                                className="w-full rounded-lg border border-brand-default bg-brand-secondary px-4 py-3 text-sm font-semibold text-brand-text-primary outline-none transition-all focus:border-cyan-500/50 disabled:opacity-50"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                                Phone Number
                                            </label>
                                            <input
                                                type="tel"
                                                defaultValue={patient.phone}
                                                disabled={!isEditing}
                                                className="w-full rounded-lg border border-brand-default bg-brand-secondary px-4 py-3 text-sm font-semibold text-brand-text-primary outline-none transition-all focus:border-cyan-500/50 disabled:opacity-50"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                                Date of Birth
                                            </label>
                                            <input
                                                type="date"
                                                disabled={!isEditing}
                                                className="w-full rounded-lg border border-brand-default bg-brand-secondary px-4 py-3 text-sm font-semibold text-brand-text-primary outline-none transition-all focus:border-cyan-500/50 disabled:opacity-50"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                                Residential Address
                                            </label>
                                            <textarea
                                                defaultValue={patient.address}
                                                disabled={!isEditing}
                                                rows={3}
                                                className="w-full rounded-lg border border-brand-default bg-brand-secondary px-4 py-3 text-sm font-semibold text-brand-text-primary outline-none transition-all focus:border-cyan-500/50 disabled:opacity-50 resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Preferences */}
                                <div className="rounded-xl border border-brand-default bg-brand-card p-6">
                                    <h3 className="mb-8 text-xl font-bold text-brand-text-primary tracking-tight">
                                        Preferences
                                    </h3>
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-secondary border border-brand-default">
                                                    <Bell size={18} className="text-cyan-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-brand-text-primary">
                                                        Clinical Alerts
                                                    </p>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mt-1">
                                                        Reminders and notifications
                                                    </p>
                                                </div>
                                            </div>
                                            <button className="relative h-6 w-11 rounded-full bg-cyan-600 transition-all">
                                                <span className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm" />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-secondary border border-brand-default">
                                                    <Moon size={18} className="text-cyan-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-brand-text-primary">
                                                        Dark Mode
                                                    </p>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mt-1">
                                                        Professional interface theme
                                                    </p>
                                                </div>
                                            </div>
                                            <button className="relative h-6 w-11 rounded-full bg-cyan-600 transition-all">
                                                <span className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm" />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-secondary border border-brand-default">
                                                    <Globe size={18} className="text-cyan-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-brand-text-primary">
                                                        Language
                                                    </p>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mt-1">
                                                        English (United States)
                                                    </p>
                                                </div>
                                            </div>
                                            <button className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-brand-text-secondary hover:text-brand-text-primary transition-colors">
                                                Change
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "security" && (
                            <div className="space-y-6">
                                {/* Password */}
                                <div className="rounded-xl border border-brand-default bg-brand-card p-6">
                                    <h3 className="mb-8 text-xl font-bold text-brand-text-primary tracking-tight">
                                        Security Settings
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between rounded-xl border border-brand-default bg-brand-secondary p-5">
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-secondary border border-brand-default">
                                                    <Lock size={18} className="text-cyan-400" />
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
                                            <button className="rounded-lg border border-brand-default bg-brand-secondary px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-text-primary transition-all hover:bg-brand-tertiary">
                                                Update
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between rounded-xl border border-brand-default bg-brand-secondary p-5">
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-secondary border border-brand-default">
                                                    <Shield size={18} className="text-cyan-400" />
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
                                            Tactical Recommendation
                                        </p>
                                        <p className="mt-2 text-sm font-medium text-brand-text-secondary leading-relaxed">
                                            Activate Multi-Factor Authentication to solidify the perimeter of your clinical records and biometric data.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "billing" && (
                            <div className="animate-fade-in space-y-6">
                                {/* Payment Methods */}
                                <div className="rounded-xl border border-brand-default bg-brand-card p-6">
                                    <h3 className="mb-4 text-lg font-semibold text-brand-text-primary">
                                        Payment Methods
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between rounded-xl border border-brand-default bg-brand-secondary p-4">
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-10 w-14 items-center justify-center rounded-xl bg-white">
                                                    <div className="flex gap-1">
                                                        <div className="h-4 w-4 rounded-full bg-red-500" />
                                                        <div className="h-4 w-4 rounded-full bg-orange-500" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-brand-text-primary">
                                                        Mastercard •••• 4242
                                                    </p>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                                        Exp 12/28
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-cyan-400">
                                                Default
                                            </span>
                                        </div>

                                        <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand-default bg-brand-secondary py-4 text-xs font-bold text-brand-text-muted transition-all hover:border-brand-hover hover:text-brand-text-primary">
                                            + Add Payment Method
                                        </button>
                                    </div>
                                </div>

                                {/* Billing History */}
                                <div className="rounded-xl border border-brand-default bg-brand-card p-6">
                                    <h3 className="mb-6 text-xl font-bold text-brand-text-primary tracking-tight">
                                        Detailed Ledger
                                    </h3>
                                    <div className="space-y-3">
                                        {[
                                            {
                                                date: "Feb 10, 2026",
                                                desc: "Root Canal Sync",
                                                amount: "$150.00",
                                                status: "Cleared",
                                            },
                                            {
                                                date: "Jan 15, 2026",
                                                desc: "Hygiene Protocol",
                                                amount: "$80.00",
                                                status: "Cleared",
                                            },
                                        ].map((tx, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center justify-between rounded-xl bg-brand-secondary border border-brand-default p-4"
                                            >
                                                <div>
                                                    <p className="text-sm font-semibold text-brand-text-primary">
                                                        {tx.desc}
                                                    </p>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mt-1">{tx.date}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-brand-text-primary">
                                                        {tx.amount}
                                                    </p>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mt-1">{tx.status}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button className="mt-6 w-full rounded-lg py-2 text-[10px] font-bold uppercase tracking-widest text-brand-text-muted transition-colors hover:text-brand-text-primary">
                                        Extract Full History
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
            </motion.div>
        </DashboardLayout>
    );
}