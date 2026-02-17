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
            className="fixed left-0 right-0 top-0 z-50 border-b border-white/5 bg-brand-primary/90 backdrop-blur-xl"
        >
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg">
                        <img src="/logo.png" alt="Logo" className="h-full w-full object-cover" />
                    </div>
                    <span className="text-lg font-semibold tracking-tight text-white">
                        Clinical Orchestration
                    </span>
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden items-center gap-8 md:flex">
                    {NAV_LINKS.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`relative text-sm font-medium transition-colors ${
                                pathname === link.href
                                    ? "text-white"
                                    : "text-brand-text-secondary hover:text-white"
                            }`}
                        >
                            {link.label}
                            {pathname === link.href && (
                                <motion.div
                                    layoutId="navbar-underline"
                                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-indigo-500"
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
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-500"
                        >
                            Dashboard
                        </Link>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-white/10"
                            >
                                Sign In
                            </Link>
                            <Link
                                href="/register"
                                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-500"
                            >
                                Get Started
                            </Link>
                        </>
                    )}
                </div>

                {/* Mobile Menu Button */}
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="rounded-lg p-2 text-brand-text-secondary transition-colors hover:bg-brand-secondary hover:text-white md:hidden"
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
                    className="border-t border-white/5 bg-brand-primary/95 backdrop-blur-xl md:hidden"
                >
                    <div className="space-y-1 px-6 py-4">
                        {NAV_LINKS.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`block rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                                    pathname === link.href
                                        ? "bg-indigo-500/10 text-indigo-400"
                                        : "text-brand-text-secondary hover:bg-brand-secondary hover:text-white"
                                }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                        <div className="mt-4 border-t border-white/5 pt-4 space-y-2">
                            {user ? (
                                <Link
                                    href={user.role === "admin" ? "/admin/dashboard" : "/patient/overview"}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="block w-full rounded-lg bg-indigo-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-indigo-500"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href="/login"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="block w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-medium text-white hover:bg-white/10"
                                    >
                                        Sign In
                                    </Link>
                                    <Link
                                        href="/register"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="block w-full rounded-lg bg-indigo-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-indigo-500"
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