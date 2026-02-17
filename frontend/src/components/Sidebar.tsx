"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
    LayoutDashboard,
    CalendarDays,
    MessageSquarePlus,
    User,
    Settings,
    LogOut,
    Users,
    Building2,
    BarChart3,
    Stethoscope,
    ChevronLeft,
    ChevronRight,
    Shield,
} from "lucide-react";

interface SidebarProps {
    role: "patient" | "admin";
    isOpen?: boolean;
    onToggle?: () => void;
}

export default function Sidebar({
    role,
    isOpen: controlledIsOpen,
    onToggle,
}: SidebarProps) {
    const { user, logout } = useAuth();
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isHovering, setIsHovering] = useState(false);

    // Sync with parent control if provided
    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : !isCollapsed;

    const userName = (role === "patient" ? user?.patient_name : user?.clinic_name) || (role === "admin" ? "Administrator" : "Patient");
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleToggle = () => {
        if (onToggle) {
            onToggle();
        } else {
            setIsCollapsed(!isCollapsed);
        }
    };

    const patientLinks = [
        {
            name: "Overview",
            href: "/patient/overview",
            icon: LayoutDashboard,
            description: "Dashboard & quick actions",
        },
        {
            name: "Book Appointment",
            href: "/patient/book",
            icon: MessageSquarePlus,
            description: "AI-powered scheduling",
        },
        {
            name: "My Appointments",
            href: "/patient/appointments",
            icon: CalendarDays,
            description: "View & manage visits",
        },
        {
            name: "Profile",
            href: "/patient/profile",
            icon: User,
            description: "Personal settings",
        },
    ];

    const adminLinks = [
        {
            name: "Dashboard",
            href: "/admin/dashboard",
            icon: LayoutDashboard,
            description: "Operations overview",
        },
        {
            name: "Doctors",
            href: "/admin/doctors",
            icon: Stethoscope,
            description: "Specialist management",
        },
        {
            name: "Rooms",
            href: "/admin/rooms",
            icon: Building2,
            description: "Resource allocation",
        },
        {
            name: "Appointments",
            href: "/admin/appointments",
            icon: CalendarDays,
            description: "Schedule management",
        },
        {
            name: "Analytics",
            href: "/admin/analytics",
            icon: BarChart3,
            description: "Performance insights",
        },
        {
            name: "Patients",
            href: "/admin/patients",
            icon: Users,
            description: "Patient records",
        },
    ];

    const links = role === "admin" ? adminLinks : patientLinks;

    const handleLogout = async () => {
        await logout();
    };

    return (
        <>
            {/* Mobile Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleToggle}
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{
                    width: isMobile ? 280 : (isOpen ? 280 : 72),
                    x: isMobile ? (isOpen ? 0 : -280) : 0,
                }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                className={`fixed left-0 top-0 z-50 h-screen border-r border-white/5 bg-brand-primary flex flex-col ${isOpen ? "shadow-2xl shadow-black/40" : ""
                    }`}
            >
                {/* Logo Area */}
                <div className="flex h-16 items-center border-b border-white/5 px-4 bg-brand-primary">
                    <Link
                        href="/"
                        className={`flex items-center gap-3 ${!isOpen && "justify-center"}`}
                    >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                            <img src="/logo.png" alt="Bronn Logo" className="h-full w-full object-cover" />
                        </div>
                        <AnimatePresence>
                            {isOpen && (
                                <motion.span
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="whitespace-nowrap text-xl font-black tracking-tight text-white"
                                >
                                    Bronn
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </Link>

                    {/* Collapse Toggle (Desktop) */}
                    <button
                        onClick={handleToggle}
                        className={`ml-auto hidden rounded-lg p-1.5 text-brand-text-muted transition-colors hover:bg-brand-secondary hover:text-white lg:flex ${!isOpen && "absolute -right-3 top-5 h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-brand-secondary text-xs"
                            }`}
                    >
                        {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-4 px-3">
                    <AnimatePresence>
                        {isOpen && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="mb-4 px-3"
                            >
                                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand-text-muted">
                                    {role === "admin" ? "Operations" : "Patient Portal"}
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex flex-col gap-1">
                        {links.map((link) => {
                            const Icon = link.icon;
                            const isActive =
                                pathname === link.href || pathname.startsWith(link.href + "/");

                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all ${isActive
                                        ? "bg-brand-accent/10 text-brand-accent"
                                        : "text-brand-text-secondary hover:bg-brand-secondary hover:text-white"
                                        } ${!isOpen && "justify-center"}`}
                                >
                                    {/* Active Indicator */}
                                    {isActive && isOpen && (
                                        <motion.div
                                            layoutId="activeNav"
                                            className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-brand-accent"
                                        />
                                    )}

                                    <div
                                        className={`flex h-5 w-5 items-center justify-center transition-colors ${isActive ? "text-brand-accent" : "text-brand-text-muted group-hover:text-white"
                                            }`}
                                    >
                                        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                                    </div>

                                    <AnimatePresence>
                                        {isOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -10 }}
                                                className="flex flex-col"
                                            >
                                                <span className="whitespace-nowrap font-semibold leading-none">{link.name}</span>
                                                <span className="mt-1 text-[10px] font-medium text-brand-text-muted">
                                                    {link.description}
                                                </span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Tooltip for collapsed state */}
                                    {!isOpen && (
                                        <div className="absolute left-full top-1/2 z-50 ml-4 -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-brand-secondary px-3 py-2 text-xs font-bold text-white opacity-0 shadow-2xl transition-all group-hover:opacity-100 group-hover:translate-x-1">
                                            {link.name}
                                            <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-b border-l border-white/10 bg-brand-secondary" />
                                        </div>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                </nav>

                {/* System Status */}
                <AnimatePresence>
                    {isOpen && role === "admin" && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mx-3 mb-4 overflow-hidden"
                        >
                            <div className="rounded-xl border border-white/5 bg-brand-secondary p-3">
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                                    </span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">
                                        System Operational
                                    </span>
                                </div>
                                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-500/80">
                                    <Shield size={10} />
                                    <span className="font-medium">HIPAA Compliant</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Footer */}
                <div className="border-t border-white/5 p-4 bg-brand-primary">
                    {/* Settings & Logout */}
                    <div className="flex flex-col gap-1">
                        <Link
                            href="/settings"
                            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-text-secondary transition-colors hover:bg-brand-secondary hover:text-white ${!isOpen && "justify-center"
                                }`}
                        >
                            <Settings size={20} />
                            <AnimatePresence>
                                {isOpen && (
                                    <motion.span
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="whitespace-nowrap"
                                    >
                                        Settings
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </Link>

                        <button
                            onClick={handleLogout}
                            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300 ${!isOpen && "justify-center"
                                }`}
                        >
                            <LogOut size={20} />
                            <AnimatePresence>
                                {isOpen && (
                                    <motion.span
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="whitespace-nowrap"
                                    >
                                        Logout
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </button>
                    </div>

                    {/* User Profile */}
                    <div
                        className={`mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-brand-secondary/30 p-3 transition-colors hover:bg-brand-secondary/50 ${!isOpen && "flex-col"
                            }`}
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-brand-accent to-brand-accent-secondary text-sm font-bold text-white">
                            {userName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                        </div>
                        <AnimatePresence>
                            {isOpen && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex min-w-0 flex-col"
                                >
                                    <span className="truncate text-sm font-bold text-white">
                                        {userName}
                                    </span>
                                    <span className="text-[10px] font-medium text-brand-text-muted">
                                        {role === "admin" ? "Administrator" : "Standard Plan"}
                                    </span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </motion.aside>
        </>
    );
}