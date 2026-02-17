"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import Link from "next/link";
import { Mail, Lock, ArrowRight, Loader2, Sparkles } from "lucide-react";

export default function LoginPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            await login({ email, password });
        } catch (err: any) {
            setError(err.message || "Login failed. Please checks your credentials.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-brand-primary p-4">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 w-full max-w-md space-y-8"
            >
                <div className="text-center">
                    <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-600 shadow-lg shadow-cyan-500/20">
                        <Sparkles className="h-7 w-7 text-white" />
                    </div>
                    <h2 className="text-3xl font-black tracking-tight text-white">Welcome back</h2>
                    <p className="mt-2 text-sm text-brand-text-secondary">
                        Sign in to your clinic dashboard
                    </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-brand-secondary/50 p-8 shadow-2xl backdrop-blur-xl">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-text-muted" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-brand-primary py-3 pl-10 pr-4 text-sm text-white placeholder-brand-text-muted outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                                    placeholder="doctor@clinic.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-text-muted" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-brand-primary py-3 pl-10 pr-4 text-sm text-white placeholder-brand-text-muted outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full flex items-center justify-center gap-2 rounded-xl bg-cyan-600 py-3 text-sm font-bold text-white transition-all hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-xs text-brand-text-secondary">
                        Don't have an account?{" "}
                        <Link href="/register" className="font-bold text-cyan-400 hover:text-cyan-300">
                            Register your clinic
                        </Link>
                    </div>

                    <div className="mt-4 border-t border-white/10 pt-4 text-center">
                        <p className="text-xs text-brand-text-secondary mb-2">Are you a patient?</p>
                        <Link
                            href="/login/patient"
                            className="text-xs font-medium text-cyan-300 hover:text-white transition-colors"
                        >
                            Go to Patient Portal
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
