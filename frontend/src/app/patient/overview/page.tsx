"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    CalendarDays,
    MessageSquarePlus,
    User,
    Clock,
    ArrowRight,
    Activity,
    TrendingUp,
    Sparkles,
    CalendarCheck,
    Stethoscope,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { getPatientAppointments } from "@/lib/api";
import { format, formatDistanceToNow, isPast, isFuture, isToday, parseISO } from "date-fns";

interface Appointment {
    appt_id: string;
    doctor: string;
    procedure: string;
    room: string;
    clinic: string;
    start_time: string;
    end_time: string;
    status: string;
}

const stagger = {
    animate: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const } },
};

export default function PatientOverviewPage() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (!user) return;

        const fetchAppointments = async () => {
            try {
                const data = await getPatientAppointments(user.user_id);
                setAppointments(Array.isArray(data) ? data : data.appointments || []);
            } catch (err) {
                console.error("Failed to load appointments:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAppointments();
    }, [user, authLoading]);

    if (authLoading || !user) return null;

    const upcomingAppointments = appointments
        .filter(
            (a) =>
                (a.status === "SCHEDULED" || a.status === "IN_PROGRESS") &&
                (!isPast(parseISO(a.start_time)) || isToday(parseISO(a.start_time)))
        )
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 3);

    const pastAppointments = appointments.filter(
        (a) =>
            a.status === "CANCELLED" ||
            a.status === "COMPLETED" ||
            (isPast(parseISO(a.start_time)) && !isToday(parseISO(a.start_time)))
    );

    const nextAppointment = upcomingAppointments[0];
    const patientName = user.patient_name || "Patient";
    const firstName = patientName.split(" ")[0];

    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

    const quickActions = [
        {
            title: "Book Appointment",
            description: "Chat with our AI assistant to find the perfect time",
            icon: MessageSquarePlus,
            href: "/patient/book",
            color: "from-indigo-500 to-violet-500",
            shadowColor: "shadow-indigo-500/20",
        },
        {
            title: "My Appointments",
            description: "View upcoming visits and past history",
            icon: CalendarDays,
            href: "/patient/appointments",
            color: "from-emerald-500 to-teal-500",
            shadowColor: "shadow-emerald-500/20",
        },
        {
            title: "My Profile",
            description: "Update your personal and medical information",
            icon: User,
            href: "/patient/profile",
            color: "from-amber-500 to-orange-500",
            shadowColor: "shadow-amber-500/20",
        },
    ];

    return (
        <DashboardLayout role="patient" title={`${greeting}, ${firstName}`} subtitle="Here's your health overview">
            <motion.div
                variants={stagger}
                initial="initial"
                animate="animate"
                className="space-y-8"
            >
                {/* Quick Actions */}
                <motion.div variants={fadeUp}>
                    <div className="mb-4 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-indigo-400" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-text-muted">
                            Quick Actions
                        </h2>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {quickActions.map((action) => {
                            const Icon = action.icon;
                            return (
                                <Link key={action.title} href={action.href}>
                                    <motion.div
                                        whileHover={{ y: -4, scale: 1.01 }}
                                        whileTap={{ scale: 0.98 }}
                                        className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-brand-secondary/50 p-6 backdrop-blur-sm transition-all hover:border-white/20 hover:shadow-xl ${action.shadowColor}`}
                                    >
                                        <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${action.color} shadow-lg ${action.shadowColor}`}>
                                            <Icon className="h-6 w-6 text-white" />
                                        </div>
                                        <h3 className="text-lg font-bold text-white">{action.title}</h3>
                                        <p className="mt-1 text-sm text-brand-text-secondary">
                                            {action.description}
                                        </p>
                                        <ArrowRight className="absolute bottom-6 right-6 h-5 w-5 text-brand-text-muted transition-all group-hover:translate-x-1 group-hover:text-white" />
                                    </motion.div>
                                </Link>
                            );
                        })}
                    </div>
                </motion.div>

                {/* Stats Row */}
                <motion.div variants={fadeUp} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-brand-secondary/50 p-5 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
                                <CalendarCheck className="h-5 w-5 text-indigo-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-black text-white">{upcomingAppointments.length}</p>
                                <p className="text-xs font-medium text-brand-text-muted">Upcoming</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-brand-secondary/50 p-5 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                                <TrendingUp className="h-5 w-5 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-black text-white">{pastAppointments.length}</p>
                                <p className="text-xs font-medium text-brand-text-muted">Past Visits</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-brand-secondary/50 p-5 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                                <Activity className="h-5 w-5 text-violet-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-black text-white">{appointments.length}</p>
                                <p className="text-xs font-medium text-brand-text-muted">Total Visits</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-brand-secondary/50 p-5 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                                <Clock className="h-5 w-5 text-amber-400" />
                            </div>
                            <div>
                                <p className="text-lg font-black text-white">
                                    {nextAppointment
                                        ? formatDistanceToNow(parseISO(nextAppointment.start_time), { addSuffix: false })
                                        : "—"}
                                </p>
                                <p className="text-xs font-medium text-brand-text-muted">Next Visit</p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Upcoming Appointments */}
                <motion.div variants={fadeUp}>
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-indigo-400" />
                            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-text-muted">
                                Upcoming Appointments
                            </h2>
                        </div>
                        {upcomingAppointments.length > 0 && (
                            <Link
                                href="/patient/appointments"
                                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                                View All →
                            </Link>
                        )}
                    </div>

                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="skeleton h-20 rounded-2xl" />
                            ))}
                        </div>
                    ) : upcomingAppointments.length > 0 ? (
                        <div className="space-y-3">
                            {upcomingAppointments.map((appt, index) => (
                                <motion.div
                                    key={appt.appt_id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.08 }}
                                    className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-brand-secondary/50 p-5 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-brand-secondary/70"
                                >
                                    {/* Date Badge */}
                                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-500/10 text-center">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                                            {format(parseISO(appt.start_time), "MMM")}
                                        </span>
                                        <span className="text-xl font-black text-white leading-none">
                                            {format(parseISO(appt.start_time), "dd")}
                                        </span>
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-white truncate">
                                            {appt.procedure || "Dental Visit"}
                                        </h3>
                                        <div className="mt-1 flex items-center gap-3 text-xs text-brand-text-secondary">
                                            <span className="flex items-center gap-1">
                                                <Stethoscope className="h-3 w-3" />
                                                {appt.doctor || "Dr. TBD"}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {format(parseISO(appt.start_time), "h:mm a")}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Time Badge */}
                                    <div className="hidden sm:block shrink-0">
                                        <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 text-xs font-bold text-indigo-400">
                                            {formatDistanceToNow(parseISO(appt.start_time), { addSuffix: true })}
                                        </span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-white/10 bg-brand-secondary/50 p-10 text-center backdrop-blur-sm">
                            <CalendarDays className="mx-auto h-12 w-12 text-brand-text-muted/50 mb-4" />
                            <h3 className="text-lg font-bold text-white mb-2">No Upcoming Appointments</h3>
                            <p className="text-sm text-brand-text-secondary mb-6">
                                Ready to schedule your next visit? Our AI assistant will help you find the perfect time.
                            </p>
                            <Link
                                href="/patient/book"
                                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-indigo-500"
                            >
                                <MessageSquarePlus className="h-4 w-4" />
                                Book an Appointment
                            </Link>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </DashboardLayout>
    );
}