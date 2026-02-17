"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Shield,
  Zap,
  Calendar,
  Users,
  Clock,
  Activity,
  ChevronRight,
  Sparkles,
  Brain,
  Lock,
  BarChart3,
} from "lucide-react";
import Navbar from "@/components/Navbar";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// New variants for features
const itemVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function LandingPage() {
  const router = useRouter(); // Initialize useRouter

  // Define features array for the new Features Grid
  const features = [
    {
      icon: Brain,
      title: "AI-Powered Triage",
      description:
        "Instant symptom analysis with 95%+ accuracy. Automatically routes patients to the right specialist.",
    },
    {
      icon: Calendar,
      title: "Smart Scheduling",
      description:
        "Constraint-solving engine optimizes room, doctor, and equipment allocation in real-time.",
    },
    {
      icon: Activity,
      title: "Emergency Detection",
      description:
        "Identifies urgent cases instantly and prioritizes scheduling for critical care needs.",
    },
    {
      icon: BarChart3,
      title: "Analytics Dashboard",
      description:
        "Real-time insights into utilization, revenue, and patient flow with predictive forecasting.",
    },
    {
      icon: Users,
      title: "Multi-Clinic Support",
      description:
        "Manage multiple locations, staff, and resources from a single unified platform.",
    },
    {
      icon: Lock,
      title: "Enterprise Security",
      description:
        "Bank-grade encryption, HIPAA compliance, and SOC 2 Type II certified infrastructure.",
    },
  ];

  return (
    <div className="min-h-screen bg-brand-primary text-brand-text-primary">
      <Navbar />

      {/* Hero Section */}
      <section className="px-6 pt-40 pb-24">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1.5 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-primary">Live Operations Alpha</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-brand-text-primary leading-[1.1] tracking-tight">
              Intelligent Scheduling for <span className="text-indigo-500">Modern Dental Care</span>
            </h1>

            <p className="mt-8 text-lg font-medium text-brand-text-secondary max-w-lg leading-relaxed">
              AI-powered triage and real-time resource optimization built for enterprise dental clinics and patient flow management.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <button
                onClick={() => router.push("/register/patient")}
                className="group relative flex items-center justify-center gap-3 rounded-xl bg-indigo-600 px-8 py-4 text-[10px] font-black uppercase tracking-widest text-brand-text-primary transition-all hover:bg-indigo-500 active:scale-95"
              >
                Start AI Intake
                <ChevronRight size={16} strokeWidth={3} className="transition-transform group-hover:translate-x-1" />
              </button>
              <button className="rounded-xl border border-brand-default bg-brand-secondary/50 px-8 py-4 text-[10px] font-black uppercase tracking-widest text-brand-text-primary transition-all hover:bg-brand-secondary active:scale-95">
                View Enterprise Demo
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="rounded-xl border border-brand-default bg-brand-secondary p-4 shadow-2xl">
              <div className="aspect-[16/10] overflow-hidden rounded-xl bg-brand-card">
                {/* Product Mock Placeholder */}
                <div className="flex h-full w-full items-center justify-center text-brand-text-muted font-black uppercase tracking-widest text-center px-12">
                  [ Dashboard Interface Live Stream ]
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-20">
            <h2 className="text-3xl font-black text-brand-text-primary tracking-tight">Enterprise Infrastructure</h2>
            <p className="mt-4 text-brand-text-secondary font-medium">Built for the demands of high-volume clinical environments.</p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true }}
                className="group rounded-xl border border-brand-default bg-brand-secondary p-6 transition-all hover:border-indigo-500/40"
              >
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-card border border-brand-default text-indigo-500">
                  <feature.icon size={28} strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-black text-brand-text-primary tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-4 text-sm font-medium leading-relaxed text-brand-text-secondary">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-t border-brand-default bg-brand-secondary/30 py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-bold tracking-tight text-brand-text-primary sm:text-5xl">
              How it works
            </h2>
            <p className="mt-6 text-lg text-brand-text-secondary">
              Get started in minutes, not months.
            </p>
          </div>

          <div className="mt-16 grid gap-12 lg:grid-cols-3">
            {[
              {
                step: "01",
                title: "Describe Symptoms",
                description:
                  "Patients describe their concerns in natural language. Our AI understands context and urgency.",
              },
              {
                step: "02",
                title: "AI Analysis",
                description:
                  "Our system analyzes symptoms, identifies procedures needed, and checks resource availability.",
              },
              {
                step: "03",
                title: "Instant Booking",
                description:
                  "The optimal slot is reserved automatically, with all resources allocated in real-time.",
              },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="mb-6 text-6xl font-black text-brand-accent/10">
                  {item.step}
                </div>
                <h3 className="text-2xl font-bold text-brand-text-primary mb-4">{item.title}</h3>
                <p className="text-lg text-brand-text-secondary leading-relaxed">{item.description}</p>
                {index < 2 && (
                  <div className="absolute -right-6 top-1/2 hidden h-px w-12 bg-white/5 lg:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto rounded-[2rem] bg-gradient-to-br from-indigo-600 to-indigo-700 p-16 text-center shadow-2xl">
          <h2 className="text-4xl font-black text-brand-text-primary tracking-tight">
            Ready to Transform Your Clinic?
          </h2>
          <p className="mt-6 text-lg font-medium text-indigo-100">
            Join modern dental operations globally. Deploy AI-powered triage in minutes.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <button
              onClick={() => router.push("/patient/book")}
              className="rounded-xl bg-white px-10 py-5 text-[10px] font-black uppercase tracking-widest text-indigo-600 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Get Started Now
            </button>
            <button className="rounded-xl border border-white/20 bg-white/10 px-10 py-5 text-[10px] font-black uppercase tracking-widest text-brand-text-primary transition-all hover:bg-white/20">
              Book a Demo
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-brand-default bg-brand-primary py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-8 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-accent to-brand-accent-secondary text-brand-text-primary">
                <Sparkles size={20} />
              </div>
              <span className="text-xl font-bold text-brand-text-primary">SmartDental AI</span>
            </div>
            <p className="text-base text-brand-text-muted">
              © 2026 SmartDental AI. All rights reserved.
            </p>
            <div className="flex gap-8 text-base text-brand-text-muted">
              <Link href="#" className="hover:text-brand-text-primary transition-colors">
                Privacy
              </Link>
              <Link href="#" className="hover:text-brand-text-primary transition-colors">
                Terms
              </Link>
              <Link href="#" className="hover:text-brand-text-primary transition-colors">
                Security
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}