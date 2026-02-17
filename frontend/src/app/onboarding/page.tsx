"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Building2,
    User,
    CheckCircle2,
    ArrowRight,
    ArrowLeft,
    Sparkles,
    Plus,
    Trash2,
    Clock,
    Stethoscope
} from "lucide-react";
import {
    getOnboardingStatus,
    addRooms,
    addDoctors,
    completeOnboarding,
    listSpecializations
} from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";

// Types
type Room = { name: string; type: string };
type Doctor = { name: string; specialization_ids: number[]; availability: any[] };

export default function OnboardingPage() {
    return (
        <ProtectedRoute>
            <OnboardingContent />
        </ProtectedRoute>
    );
}

function OnboardingContent() {
    const router = useRouter();
    const [step, setStep] = useState<"loading" | "rooms" | "doctors" | "complete">("loading");
    const [isLoading, setIsLoading] = useState(false);

    // Data State
    const [rooms, setRooms] = useState<Room[]>([{ name: "Operatory 1", type: "operatory" }]);
    const [doctors, setDoctors] = useState<Doctor[]>([{ name: "", specialization_ids: [1], availability: [] }]);

    // Check Status on Mount
    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const status = await getOnboardingStatus();
            if (status.missing_rooms) {
                setStep("rooms");
            } else if (status.missing_doctors) {
                setStep("doctors");
            } else {
                setStep("complete");
            }
        } catch (err) {
            console.error("Failed to check status", err);
        }
    };

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleSaveRooms = async () => {
        setIsLoading(true);
        try {
            await addRooms(rooms);
            setStep("doctors");
        } catch (err) {
            alert("Failed to save rooms");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveDoctors = async () => {
        setIsLoading(true);
        try {
            // Simplified availability for MVP
            const docs = doctors.map(d => ({
                ...d,
                availability: [
                    { day_of_week: 1, start_time: "09:00", end_time: "17:00" },
                    { day_of_week: 2, start_time: "09:00", end_time: "17:00" },
                    { day_of_week: 3, start_time: "09:00", end_time: "17:00" },
                    { day_of_week: 4, start_time: "09:00", end_time: "17:00" },
                    { day_of_week: 5, start_time: "09:00", end_time: "17:00" },
                ]
            }));
            await addDoctors(docs);
            await completeOnboarding();
            setStep("complete");
            setTimeout(() => router.push("/admin/dashboard"), 2000);
        } catch (err) {
            alert("Failed to save doctors");
        } finally {
            setIsLoading(false);
        }
    };

    // ── Render Helpers ───────────────────────────────────────────────────────

    const addRoomField = () => setRooms([...rooms, { name: "", type: "operatory" }]);
    const removeRoomField = (idx: number) => setRooms(rooms.filter((_, i) => i !== idx));
    const updateRoom = (idx: number, field: keyof Room, val: string) => {
        const newRooms = [...rooms];
        newRooms[idx] = { ...newRooms[idx], [field]: val };
        setRooms(newRooms);
    };

    const addDoctorField = () => setDoctors([...doctors, { name: "", specialization_ids: [1], availability: [] }]);
    const removeDoctorField = (idx: number) => setDoctors(doctors.filter((_, i) => i !== idx));
    const updateDoctor = (idx: number, val: string) => {
        const newDocs = [...doctors];
        newDocs[idx] = { ...newDocs[idx], name: val };
        setDoctors(newDocs);
    };

    if (step === "loading") return null;

    return (
        <div className="relative flex min-h-screen items-center justify-center bg-brand-primary p-4">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 w-full max-w-2xl"
            >
                {/* Header */}
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-600 shadow-lg">
                        <Sparkles className="h-7 w-7 text-white" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-white mb-2">
                        {step === "rooms" && "Setup Your Clinic"}
                        {step === "doctors" && "Add Your Team"}
                        {step === "complete" && "All Set!"}
                    </h1>
                    <p className="text-brand-text-secondary">
                        {step === "rooms" && "Let's define your physical spaces."}
                        {step === "doctors" && "Who will be treating patients?"}
                        {step === "complete" && "Redirecting to dashboard..."}
                    </p>
                </div>

                {/* Main Card */}
                <div className="rounded-2xl border border-white/10 bg-brand-secondary/50 p-8 shadow-2xl backdrop-blur-xl">
                    <AnimatePresence mode="wait">

                        {/* STEP 1: ROOMS */}
                        {step === "rooms" && (
                            <motion.div
                                key="rooms"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="space-y-4">
                                    {rooms.map((room, idx) => (
                                        <div key={idx} className="flex gap-4 items-center">
                                            <div className="flex-1 space-y-2">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Room Name</label>
                                                <div className="relative">
                                                    <Building2 className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-text-muted" />
                                                    <input
                                                        type="text"
                                                        value={room.name}
                                                        onChange={(e) => updateRoom(idx, "name", e.target.value)}
                                                        className="w-full rounded-xl border border-white/10 bg-brand-primary py-3 pl-10 pr-4 text-sm text-white focus:border-cyan-500 outline-none"
                                                        placeholder="e.g. Operatory 1"
                                                    />
                                                </div>
                                            </div>
                                            <div className="w-40 space-y-2">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Type</label>
                                                <select
                                                    value={room.type}
                                                    onChange={(e) => updateRoom(idx, "type", e.target.value)}
                                                    className="w-full rounded-xl border border-white/10 bg-brand-primary py-3 px-4 text-sm text-white focus:border-cyan-500 outline-none appearance-none"
                                                >
                                                    <option value="operatory">Operatory</option>
                                                    <option value="hygiene">Hygiene</option>
                                                    <option value="imaging">Imaging</option>
                                                    <option value="consult">Consult</option>
                                                </select>
                                            </div>
                                            {rooms.length > 1 && (
                                                <button onClick={() => removeRoomField(idx)} className="mt-6 p-3 text-red-400 hover:bg-red-400/10 rounded-xl">
                                                    <Trash2 size={20} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <button onClick={addRoomField} className="flex items-center gap-2 text-sm font-bold text-cyan-400 hover:text-cyan-300">
                                    <Plus size={16} /> Add Another Room
                                </button>

                                <div className="pt-6 border-t border-white/5 flex justified-end">
                                    <button
                                        onClick={handleSaveRooms}
                                        disabled={isLoading}
                                        className="ml-auto flex items-center gap-2 rounded-xl bg-cyan-600 px-8 py-3 text-sm font-bold text-white hover:bg-cyan-500"
                                    >
                                        {isLoading ? "Saving..." : "Next Step"} <ArrowRight size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 2: DOCTORS */}
                        {step === "doctors" && (
                            <motion.div
                                key="doctors"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="space-y-4">
                                    {doctors.map((doc, idx) => (
                                        <div key={idx} className="flex gap-4 items-center">
                                            <div className="flex-1 space-y-2">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">Doctor Name</label>
                                                <div className="relative">
                                                    <Stethoscope className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-text-muted" />
                                                    <input
                                                        type="text"
                                                        value={doc.name}
                                                        onChange={(e) => updateDoctor(idx, e.target.value)}
                                                        className="w-full rounded-xl border border-white/10 bg-brand-primary py-3 pl-10 pr-4 text-sm text-white focus:border-cyan-500 outline-none"
                                                        placeholder="e.g. Dr. Smith"
                                                    />
                                                </div>
                                            </div>
                                            {doctors.length > 1 && (
                                                <button onClick={() => removeDoctorField(idx)} className="mt-6 p-3 text-red-400 hover:bg-red-400/10 rounded-xl">
                                                    <Trash2 size={20} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <p className="text-xs text-brand-text-muted italic">
                                        * Default full-time availability (M-F 9-5) will be applied. You can edit this later.
                                    </p>
                                </div>

                                <button onClick={addDoctorField} className="flex items-center gap-2 text-sm font-bold text-cyan-400 hover:text-cyan-300">
                                    <Plus size={16} /> Add Another Doctor
                                </button>

                                <div className="pt-6 border-t border-white/5 flex justified-end">
                                    <button
                                        onClick={handleSaveDoctors}
                                        disabled={isLoading}
                                        className="ml-auto flex items-center gap-2 rounded-xl bg-green-600 px-8 py-3 text-sm font-bold text-white hover:bg-green-500"
                                    >
                                        {isLoading ? "Finalizing..." : "Complete Setup"} <CheckCircle2 size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 3: COMPLETE */}
                        {step === "complete" && (
                            <motion.div
                                key="complete"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-12"
                            >
                                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20">
                                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                                </div>
                                <h2 className="text-2xl font-bold text-white">Setup Complete!</h2>
                                <p className="mt-2 text-brand-text-secondary">Redirecting you to your dashboard...</p>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}