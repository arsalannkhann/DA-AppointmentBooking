"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

const NAV_LINKS = [
    { href: "/", label: "Platform" },
    { href: "/#features", label: "Capabilities" },
    { href: "/#workflow", label: "Workflow" },
];

export default function Navbar() {
    const pathname = usePathname();
    const { user } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Don't show navbar on dashboard routes
    if (pathname.startsWith("/admin") || pathname.startsWith("/patient")) {
        return null;
    }

    return (
        <motion.nav
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl"
        >
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg">
                        <img src="/logo.png" alt="Logo" className="h-full w-full object-cover" />
                    </div>
                    <span className="text-lg font-bold tracking-tight text-slate-900">
                        Clinical Orchestration
                    </span>
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden items-center gap-8 md:flex">
                    {NAV_LINKS.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`relative text-sm transition-colors ${pathname === link.href
                                ? "text-primary font-bold"
                                : "text-slate-500 font-medium hover:text-slate-900"
                                }`}
                        >
                            {link.label}
                            {pathname === link.href && (
                                <motion.div
                                    layoutId="navbar-underline"
                                    className="absolute -bottom-[21px] left-0 right-0 h-[2px] bg-primary rounded-t-full"
                                />
                            )}
                        </Link>
                    ))}
                </div>

                {/* CTA Buttons */}
                <div className="hidden items-center gap-3 md:flex">
                    {user ? (
                        <Link
                            href={user.role === "admin" ? "/admin/dashboard" : "/patient/overview"}
                            className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-primary-dark shadow-sm shadow-primary/20 hover:shadow-md"
                        >
                            Dashboard
                        </Link>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 shadow-sm"
                            >
                                Sign In
                            </Link>
                            <Link
                                href="/register"
                                className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-primary-dark shadow-sm shadow-primary/20 hover:shadow-md"
                            >
                                Get Started
                            </Link>
                        </>
                    )}
                </div>

                {/* Mobile Menu Button */}
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 md:hidden"
                >
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-slate-200 bg-white/95 backdrop-blur-xl md:hidden shadow-lg"
                >
                    <div className="space-y-1 px-6 py-4">
                        {NAV_LINKS.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`block rounded-lg px-4 py-3 text-sm font-medium transition-colors ${pathname === link.href
                                    ? "bg-primary/5 text-primary font-bold"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                    }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                        <div className="mt-4 border-t border-slate-200 pt-4 space-y-2">
                            {user ? (
                                <Link
                                    href={user.role === "admin" ? "/admin/dashboard" : "/patient/overview"}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="block w-full rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white hover:bg-primary-dark shadow-sm shadow-primary/20"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href="/login"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                                    >
                                        Sign In
                                    </Link>
                                    <Link
                                        href="/register"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="block w-full rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white hover:bg-primary-dark shadow-sm shadow-primary/20"
                                    >
                                        Get Started
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </motion.nav>
    );
}