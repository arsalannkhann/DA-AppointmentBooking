"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { Mail, Lock, User, Building2, Phone, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { registerClinic, loginClinic, setAuthToken } from "@/lib/api";

export default function RegisterPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    // Form State
    const [formData, setFormData] = useState({
        clinic_name: "",
        full_name: "",
        email: "",
        phone: "",
        password: ""
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            // 1. Register
            const res = await registerClinic(formData);

            // 2. Auto Login (Wait, register endpoint returns token?)
            // If backend register returns token, use it. 
            // My backend register returns `access_token`? Let's check `auth.py`. 
            // Ah, `register_clinic` returns `TokenResponse` (access_token, token_type, user, onboarding_complete).
            // So we can log in immediately.

            if (res.access_token) {
                setAuthToken(res.access_token);
                // 3. User is effectively logged in, redirect to onboarding
                // Ideally we should update AuthContext state too, but `window.location.reload()` or plain redirect might miss context update?
                // Since `AuthProvider` checks existing token on mount/reload, a simpler way is to `window.location.href = "/onboarding"`.
                // Or better: Use `login` from AuthContext? But register API differs from login API signature.
                // Force a reload to let AuthProvider pick up the token.
                window.location.href = "/onboarding";
            } else {
                // Fallback if no token returned (unlikely based on my code)
                router.push("/login");
            }

        } catch (err: any) {
            setError(err.message || "Registration failed. Try again.");
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-brand-primary p-4 py-12">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 w-full max-w-lg space-y-8"
            >
                <div className="text-center">
                    <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-600 shadow-lg shadow-cyan-500/20">
                        <Sparkles className="h-7 w-7 text-white" />
                    </div>
                    <h2 className="text-3xl font-black tracking-tight text-white">Join SmartDental</h2>
                    <p className="mt-2 text-sm text-brand-text-secondary">
                        Set up your digital clinic in minutes
                    </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-brand-secondary/50 p-8 shadow-2xl backdrop-blur-xl">
                    <form className="space-y-5" onSubmit={handleSubmit}>
                        {error && (
                            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                                {error}
                            </div>
                        )}

                        <div className="grid gap-5 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Clinic Name</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-text-muted" />
                                    <input
                                        type="text"
                                        name="clinic_name"
                                        required
                                        value={formData.clinic_name}
                                        onChange={handleChange}
                                        className="w-full rounded-xl border border-white/10 bg-brand-primary py-3 pl-10 pr-4 text-sm text-white placeholder-brand-text-muted outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                                        placeholder="City Dental"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Your Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-text-muted" />
                                    <input
                                        type="text"
                                        name="full_name"
                                        required
                                        value={formData.full_name}
                                        onChange={handleChange}
                                        className="w-full rounded-xl border border-white/10 bg-brand-primary py-3 pl-10 pr-4 text-sm text-white placeholder-brand-text-muted outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                                        placeholder="Dr. John Doe"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-text-muted" />
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-white/10 bg-brand-primary py-3 pl-10 pr-4 text-sm text-white placeholder-brand-text-muted outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                                    placeholder="admin@clinic.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Phone Number</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-text-muted" />
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-white/10 bg-brand-primary py-3 pl-10 pr-4 text-sm text-white placeholder-brand-text-muted outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                                    placeholder="+1 (555) 000-0000"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-text-muted" />
                                <input
                                    type="password"
                                    name="password"
                                    required
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-white/10 bg-brand-primary py-3 pl-10 pr-4 text-sm text-white placeholder-brand-text-muted outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                                    placeholder="Min 8 chars, mixed case"
                                />
                            </div>
                            <p className="text-[10px] text-brand-text-muted">Must be 8+ chars with uppercase, lowercase, number & symbol.</p>
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
                                    Create Account
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-xs text-brand-text-secondary">
                        Already have an account?{" "}
                        <Link href="/login" className="font-bold text-cyan-400 hover:text-cyan-300">
                            Sign in
                        </Link>
                    </div>

                    <div className="mt-4 border-t border-white/10 pt-4 text-center">
                        <p className="text-xs text-brand-text-secondary mb-2">Are you a patient?</p>
                        <Link
                            href="/register/patient"
                            className="text-xs font-medium text-cyan-300 hover:text-white transition-colors"
                        >
                            Register as a Patient
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
