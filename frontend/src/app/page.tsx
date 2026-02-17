"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Shield,
  Calendar,
  Users,
  Activity,
  BarChart3,
  Brain,
  Lock,
  Zap,
  Building2,
  Clock,
} from "lucide-react";
import Navbar from "@/components/Navbar";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
};

const itemVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function LandingPage() {
  const router = useRouter();

  const features = [
    {
      icon: Brain,
      title: "Deterministic Clinical Routing",
      description:
        "Constraint-based triage engine with multi-condition analysis and specialist matching.",
    },
    {
      icon: Calendar,
      title: "Constraint-Aware Scheduling",
      description:
        "Real-time resource optimization across rooms, equipment, and provider availability.",
    },
    {
      icon: Activity,
      title: "Emergency Detection Protocol",
      description:
        "Automated urgency classification with airway risk assessment and priority escalation.",
    },
    {
      icon: BarChart3,
      title: "Operational Intelligence",
      description:
        "Utilization analytics, revenue forecasting, and predictive capacity planning.",
    },
    {
      icon: Users,
      title: "Multi-Tenant Architecture",
      description:
        "Enterprise-grade isolation with centralized patient registry and cross-clinic coordination.",
    },
    {
      icon: Lock,
      title: "Healthcare Compliance",
      description:
        "HIPAA-compliant infrastructure with audit logging and role-based access control.",
    },
  ];

  const workflow = [
    {
      step: "01",
      title: "Structured Intake",
      description:
        "Patients describe symptoms through guided clinical questionnaire with dynamic clarification.",
    },
    {
      step: "02",
      title: "Clinical Analysis",
      description:
        "AI-powered triage evaluates urgency, identifies procedures, and routes to appropriate specialists.",
    },
    {
      step: "03",
      title: "Optimized Booking",
      description:
        "Constraint solver allocates resources and reserves optimal appointment slots automatically.",
    },
  ];

  const stats = [
    { value: "95%", label: "Routing Accuracy" },
    { value: "<2min", label: "Avg. Intake Time" },
    { value: "40%", label: "Utilization Increase" },
    { value: "24/7", label: "System Availability" },
  ];

  return (
    <div className="min-h-screen bg-brand-primary text-brand-text-primary">
      <Navbar />

      {/* Hero Section */}
      <section className="px-6 pt-32 pb-20">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-white">
                Production Ready
              </span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight tracking-tight mb-6">
              Enterprise Clinical
              <br />
              <span className="text-indigo-400">Orchestration Platform</span>
            </h1>

            <p className="text-xl text-brand-text-secondary max-w-3xl mx-auto leading-relaxed mb-10">
              AI-powered appointment scheduling with constraint-based resource optimization,
              emergency triage, and multi-specialty coordination for modern healthcare operations.
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={() => router.push("/register/patient")}
                className="group flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-4 text-sm font-semibold text-white transition-all hover:bg-indigo-500"
              >
                Start Clinical Intake
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => router.push("/login")}
                className="rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-sm font-semibold text-white transition-all hover:bg-white/10"
              >
                Provider Login
              </button>
            </div>
          </motion.div>

          {/* Stats Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
          >
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-sm text-brand-text-muted uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 text-center">
            <h6 className="text-indigo-400 font-semibold uppercase tracking-wider mb-4">
              Platform Capabilities
            </h6>
            <h2 className="text-4xl font-bold text-white mb-4">
              Enterprise Healthcare Infrastructure
            </h2>
            <p className="text-lg text-brand-text-secondary max-w-2xl mx-auto">
              Built for high-volume clinical environments with deterministic routing
              and real-time resource optimization.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true }}
                className="group rounded-xl border border-white/10 bg-white/5 p-8 transition-all hover:border-indigo-500/40 hover:bg-white/10"
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <feature.icon size={28} strokeWidth={2} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-brand-text-secondary">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-24 px-6 border-t border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h6 className="text-indigo-400 font-semibold uppercase tracking-wider mb-4">
              Clinical Workflow
            </h6>
            <h2 className="text-4xl font-bold text-white mb-4">
              Streamlined Patient Journey
            </h2>
            <p className="text-lg text-brand-text-secondary">
              From symptom intake to appointment confirmation in under 2 minutes.
            </p>
          </div>

          <div className="grid gap-12 lg:grid-cols-3">
            {workflow.map((item, index) => (
              <div key={index} className="relative">
                <div className="mb-6 text-6xl font-bold text-white/5">
                  {item.step}
                </div>
                <h3 className="text-2xl font-semibold text-white mb-4">{item.title}</h3>
                <p className="text-base text-brand-text-secondary leading-relaxed">
                  {item.description}
                </p>
                {index < 2 && (
                  <div className="absolute -right-6 top-12 hidden h-px w-12 bg-white/10 lg:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-12">
            <div className="flex items-start gap-6 mb-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Shield size={32} strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-white mb-3">
                  Enterprise Security & Compliance
                </h3>
                <p className="text-base text-brand-text-secondary leading-relaxed">
                  HIPAA-compliant infrastructure with SOC 2 Type II certification.
                  Bank-grade encryption, comprehensive audit logging, and role-based access control.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 border-t border-white/10">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-emerald-400" />
                <span className="text-sm font-medium text-white">HIPAA Compliant</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-emerald-400" />
                <span className="text-sm font-medium text-white">SOC 2 Type II</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-emerald-400" />
                <span className="text-sm font-medium text-white">256-bit Encryption</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-emerald-400" />
                <span className="text-sm font-medium text-white">Audit Logging</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 p-16 shadow-2xl">
            <h2 className="text-4xl font-bold text-white mb-6">
              Ready to Transform Clinical Operations?
            </h2>
            <p className="text-lg text-indigo-100 mb-10 max-w-2xl mx-auto">
              Join healthcare organizations using AI-powered scheduling to optimize
              resource utilization and improve patient access.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={() => router.push("/register")}
                className="rounded-xl bg-white px-10 py-4 text-sm font-semibold text-indigo-600 transition-all hover:scale-105"
              >
                Get Started
              </button>
              <button
                onClick={() => router.push("/login")}
                className="rounded-xl border border-white/20 bg-white/10 px-10 py-4 text-sm font-semibold text-white transition-all hover:bg-white/20"
              >
                Schedule Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600">
                <Activity size={20} className="text-white" />
              </div>
              <span className="text-lg font-semibold text-white">Clinical Orchestration</span>
            </div>
            <p className="text-sm text-brand-text-muted">
              © 2026 Healthcare Platform. All rights reserved.
            </p>
            <div className="flex gap-8 text-sm text-brand-text-muted">
              <Link href="#" className="hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="#" className="hover:text-white transition-colors">
                Terms
              </Link>
              <Link href="#" className="hover:text-white transition-colors">
                Security
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
