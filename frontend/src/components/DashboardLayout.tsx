"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Bell,
    Search,
    Menu,
    X,
} from "lucide-react";
import Sidebar from "./Sidebar";

interface DashboardLayoutProps {
    children: React.ReactNode;
    role: "patient" | "admin";
    title?: string;
    subtitle?: string;
}

export default function DashboardLayout({
    children,
    role,
    title,
    subtitle,
}: DashboardLayoutProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [userName, setUserName] = useState("");
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        // Get user info from localStorage
        const storedName =
            role === "admin"
                ? localStorage.getItem("adminName")
                : localStorage.getItem("patientName");
        setUserName(storedName || (role === "admin" ? "Administrator" : "Patient"));

        // Handle scroll for topbar styling
        const handleScroll = () => {
            setScrolled(window.scrollY > 10);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [role]);

    const notifications = [
        {
            id: 1,
            title: "Emergency booking received",
            message: "Dr. Khan - Room 3 - 2:30 PM",
            time: "2 min ago",
            type: "urgent",
            unread: true,
        },
        {
            id: 2,
            title: "Appointment confirmed",
            message: "Patient #4821 scheduled for tomorrow",
            time: "15 min ago",
            type: "success",
            unread: true,
        },
        {
            id: 3,
            title: "System maintenance",
            message: "Scheduled for tonight at 2:00 AM",
            time: "1 hour ago",
            type: "info",
            unread: false,
        },
    ];

    const unreadCount = notifications.filter((n) => n.unread).length;

    return (
        <div className="flex min-h-screen bg-brand-primary text-brand-text-primary">
            {/* Sidebar */}
            <Sidebar
                role={role}
                isOpen={isSidebarOpen}
                onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            />

            {/* Main Content Area */}
            <div
                className={`flex flex-1 flex-col transition-all duration-300 ${isSidebarOpen ? "lg:ml-[280px]" : "lg:ml-[72px]"
                    }`}
            >
                {/* Topbar */}
                <header
                    className={`sticky top-0 z-40 flex h-16 items-center justify-between border-b px-6 transition-all duration-300 ${scrolled
                        ? "border-white/5 bg-brand-primary/95 backdrop-blur-xl shadow-sm"
                        : "border-transparent bg-brand-primary"
                        }`}
                >
                    {/* Left Section */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="rounded-lg p-2 text-brand-text-secondary transition-colors hover:bg-brand-secondary hover:text-white lg:hidden"
                        >
                            <Menu size={20} />
                        </button>

                        <div className="flex flex-col">
                            {title && (
                                <h1 className="text-lg font-semibold tracking-tight text-white leading-tight">
                                    {title}
                                </h1>
                            )}
                            {subtitle && (
                                <p className="text-xs font-medium text-brand-text-muted mt-0.5">{subtitle}</p>
                            )}
                        </div>
                    </div>

                    {/* Right Section */}
                    <div className="flex items-center gap-3">
                        {/* Global Search */}
                        <div className="relative hidden md:block">
                            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-brand-secondary/50 px-3 py-2 transition-all focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/10">
                                <Search size={16} className="text-brand-text-muted" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-40 bg-transparent text-sm text-white placeholder-brand-text-muted outline-none transition-all focus:w-56"
                                />
                                <kbd className="hidden rounded border border-white/5 bg-brand-primary px-1.5 py-0.5 text-[10px] font-medium text-brand-text-muted sm:block">
                                    ⌘K
                                </kbd>
                            </div>
                        </div>

                        {/* Notifications */}
                        <div className="relative">
                            <button
                                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                                className="relative rounded-lg p-2 text-brand-text-secondary transition-colors hover:bg-brand-secondary hover:text-white"
                            >
                                <Bell size={18} />
                                {unreadCount > 0 && (
                                    <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500"></span>
                                    </span>
                                )}
                            </button>

                            {/* Notifications Dropdown */}
                            <AnimatePresence>
                                {isNotificationsOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                        className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-xl border border-white/10 bg-brand-secondary shadow-2xl backdrop-blur-xl"
                                    >
                                        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                                            <span className="text-sm font-semibold text-white">
                                                Notifications
                                            </span>
                                            <span className="text-xs font-medium text-brand-text-muted">
                                                {unreadCount} unread
                                            </span>
                                        </div>
                                        <div className="max-h-80 overflow-y-auto">
                                            {notifications.map((notification) => (
                                                <div
                                                    key={notification.id}
                                                    className={`flex gap-3 border-b border-white/5 p-4 transition-colors hover:bg-white/5 ${notification.unread ? "bg-white/5" : ""
                                                        }`}
                                                >
                                                    <div
                                                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.type === "urgent"
                                                            ? "bg-rose-500"
                                                            : notification.type === "success"
                                                                ? "bg-emerald-500"
                                                                : "bg-indigo-500"
                                                            }`}
                                                    />
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-white">
                                                            {notification.title}
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-brand-text-secondary leading-normal">
                                                            {notification.message}
                                                        </p>
                                                        <p className="mt-2 text-[10px] font-medium text-brand-text-muted">
                                                            {notification.time}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="border-t border-white/5 p-2">
                                            <button className="w-full rounded-lg py-2.5 text-xs font-medium text-brand-text-muted transition-colors hover:bg-white/10 hover:text-white">
                                                View all notifications
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Divider */}
                        <div className="hidden h-6 w-px bg-brand-elevated sm:block" />
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-6 lg:p-8">
                    <div className="mx-auto max-w-[1400px]">{children}</div>
                </main>
            </div>

            {/* Click outside to close dropdowns */}
            {isNotificationsOpen && (
                <div
                    className="fixed inset-0 z-30"
                    onClick={() => {
                        setIsNotificationsOpen(false);
                    }}
                />
            )}
        </div>
    );
}
