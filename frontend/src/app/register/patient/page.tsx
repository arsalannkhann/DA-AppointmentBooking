"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { User, Mail, Lock, Building, Phone, ArrowRight, Loader2, Heart } from "lucide-react";
import { registerPatient, getPublicClinics } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function PatientRegisterPage() {
    const router = useRouter();
    const { loginPatient: authLoginPatient } = useAuth();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [clinics, setClinics] = useState<{ id: string; name: string }[]>([]);

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        preferred_clinic_id: "",
        phone: "",
    });

    useEffect(() => {
        getPublicClinics()
            .then(setClinics)
            .catch(() => { });
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const payload: Record<string, string> = {
                name: formData.name,
                email: formData.email,
                password: formData.password,
            };
            if (formData.phone) payload.phone = formData.phone;
            if (formData.preferred_clinic_id) payload.preferred_clinic_id = formData.preferred_clinic_id;

            await registerPatient(payload as any);

            await authLoginPatient({
                email: formData.email,
                password: formData.password,
            });
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Registration failed. Please try again.");
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
                    <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-500/20">
                        <Heart className="h-7 w-7 text-white" />
                    </div>
                    <h2 className="text-3xl font-black tracking-tight text-white">Create Account</h2>
                    <p className="mt-2 text-sm text-brand-text-secondary">
                        Join Bronn to manage your dental care
                    </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-brand-secondary/50 p-8 shadow-2xl backdrop-blur-xl">
                    <form className="space-y-5" onSubmit={handleSubmit}>
                        {error && (
                            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-text-muted" />
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-white/10 bg-brand-primary py-3 pl-10 pr-4 text-sm text-white placeholder-brand-text-muted outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                    placeholder="John Doe"
                                />
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
                                    className="w-full rounded-xl border border-white/10 bg-brand-primary py-3 pl-10 pr-4 text-sm text-white placeholder-brand-text-muted outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                    placeholder="patient@example.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Phone Number <span className="text-brand-text-muted/50">(optional)</span></label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-text-muted" />
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-white/10 bg-brand-primary py-3 pl-10 pr-4 text-sm text-white placeholder-brand-text-muted outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                    placeholder="(555) 123-4567"
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
                                    className="w-full rounded-xl border border-white/10 bg-brand-primary py-3 pl-10 pr-4 text-sm text-white placeholder-brand-text-muted outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                    placeholder="••••••••"
                                    minLength={8}
                                />
                            </div>
                        </div>

                        {/* Optional: Preferred Clinic */}
                        {clinics.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                                    Preferred Clinic <span className="text-brand-text-muted/50">(optional)</span>
                                </label>
                                <div className="relative">
                                    <Building className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-text-muted" />
                                    <select
                                        name="preferred_clinic_id"
                                        value={formData.preferred_clinic_id}
                                        onChange={handleChange}
                                        className="w-full rounded-xl border border-white/10 bg-brand-primary py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none"
                                    >
                                        <option value="">Auto-match based on your needs</option>
                                        {clinics.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white transition-all hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
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
                        <Link href="/login/patient" className="font-bold text-indigo-400 hover:text-indigo-300">
                            Sign In
                        </Link>
                    </div>

                    <div className="mt-4 border-t border-white/10 pt-4 text-center">
                        <p className="text-xs text-brand-text-secondary mb-2">Are you a clinic administrator?</p>
                        <Link
                            href="/register"
                            className="text-xs font-medium text-indigo-300 hover:text-white transition-colors"
                        >
                            Register your Clinic
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
