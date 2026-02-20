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
    Activity,
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
            description: "Dashboard overview",
        },
        {
            name: "Book Appointment",
            href: "/chat",
            icon: MessageSquarePlus,
            description: "Clinical intake",
        },
        {
            name: "Appointments",
            href: "/patient/appointments",
            icon: CalendarDays,
            description: "View schedule",
        },
        {
            name: "Profile",
            href: "/patient/profile",
            icon: User,
            description: "Account settings",
        },
    ];

    const adminLinks = [
        {
            name: "Dashboard",
            href: "/admin/dashboard",
            icon: LayoutDashboard,
            description: "Operations center",
        },
        {
            name: "Providers",
            href: "/admin/doctors",
            icon: Stethoscope,
            description: "Specialist roster",
        },
        {
            name: "Facilities",
            href: "/admin/rooms",
            icon: Building2,
            description: "Resource allocation",
        },
        {
            name: "Schedule",
            href: "/admin/appointments",
            icon: CalendarDays,
            description: "Appointment grid",
        },
        {
            name: "Analytics",
            href: "/admin/analytics",
            icon: BarChart3,
            description: "Performance metrics",
        },
        {
            name: "Patients",
            href: "/admin/patients",
            icon: Users,
            description: "Patient registry",
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
                className={`fixed left-0 top-0 z-50 h-screen border-r border-[#e2e8f0] bg-white flex flex-col ${isOpen ? "shadow-[20px_0_40px_-15px_rgba(0,0,0,0.05)]" : ""
                    }`}
            >
                {/* Logo Area */}
                <div className="flex h-16 items-center border-b border-[#e2e8f0] px-4 bg-white">
                    <Link
                        href="/"
                        className={`flex items-center gap-3 ${!isOpen && "justify-center"}`}
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary">
                            <Activity size={24} />
                        </div>
                        <AnimatePresence>
                            {isOpen && (
                                <motion.span
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="whitespace-nowrap text-base font-[700] tracking-tight text-slate-900"
                                >
                                    Clinical Platform
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </Link>

                    {/* Collapse Toggle (Desktop) */}
                    <button
                        onClick={handleToggle}
                        className={`ml-auto hidden rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 lg:flex ${!isOpen && "absolute right-2 top-5 h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-xs shadow-sm"
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
                                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
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
                                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-3.5 text-sm font-medium transition-all duration-200 ${isActive
                                        ? "bg-primary/10 text-primary font-semibold shadow-sm"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-primary"
                                        } ${!isOpen && "justify-center"}`}
                                    onClick={() => { if (isMobile && onToggle) onToggle(); }}
                                >
                                    {/* Active Pulse Indicator */}
                                    {isActive && isOpen && (
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary animate-pulse" />
                                    )}

                                    <div
                                        className={`flex h-[22px] w-[22px] items-center justify-center transition-colors ${isActive ? "text-primary" : "text-slate-400 group-hover:text-primary"
                                            }`}
                                    >
                                        <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                                    </div>

                                    <AnimatePresence>
                                        {isOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -10 }}
                                                className="flex flex-col"
                                            >
                                                <span className="whitespace-nowrap leading-none">{link.name}</span>
                                                <span className={`mt-1 text-[10px] ${isActive ? "text-primary/80 font-medium" : "text-slate-400 font-normal"}`}>
                                                    {link.description}
                                                </span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Tooltip for collapsed state */}
                                    {!isOpen && (
                                        <div className="absolute left-full top-1/2 z-50 ml-4 -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 opacity-0 shadow-lg transition-all group-hover:opacity-100 group-hover:translate-x-1">
                                            {link.name}
                                            <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-b border-l border-slate-200 bg-white" />
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
                            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/80 opacity-75"></span>
                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                                    </span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                                        System Operational
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-primary/80">
                                    <Shield size={10} />
                                    <span className="font-medium">HIPAA Compliant</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Footer */}
                <div className="border-t border-[#e2e8f0] p-4 bg-white" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                    {/* Settings & Logout */}
                    <div className="flex flex-col gap-1">
                        <Link
                            href="/settings"
                            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 ${!isOpen && "justify-center"
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
                            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-600 ${!isOpen && "justify-center"
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
                        className={`mt-4 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 transition-colors hover:bg-slate-100 cursor-pointer ${!isOpen && "flex-col"
                            }`}
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow-sm border-2 border-white pointer-events-none">
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
                                    <span className="truncate text-sm font-[650] text-slate-800">
                                        {userName}
                                    </span>
                                    <span className="text-[10px] font-medium text-slate-500">
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
