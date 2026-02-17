import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";

interface MissingField {
    field_key: string;
    label: string;
    type: "text" | "select" | "slider" | "boolean";
    required: boolean;
    options?: string[];
    min?: number;
    max?: number;
}

interface ClarifyIssue {
    issue_id: string;
    summary: string;
    missing_fields: MissingField[];
}

interface ClarificationPanelProps {
    issues: ClarifyIssue[];
    onComplete: (data: Record<string, any>) => void;
    loading: boolean;
}

const FieldRenderer = ({
    field,
    value,
    onChange
}: {
    field: MissingField;
    value: any;
    onChange: (val: any) => void;
}) => {
    switch (field.type) {
        case "text":
            return (
                <div className="space-y-2">
                    <label className="text-sm font-medium text-brand-text-secondary">
                        {field.label} {field.required && <span className="text-red-400">*</span>}
                    </label>
                    <input
                        className="w-full bg-brand-input border border-[var(--border-primary)] rounded-lg px-4 py-3 text-white placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                        placeholder="Type your answer..."
                        value={value || ""}
                        onChange={(e) => onChange(e.target.value)}
                    />
                </div>
            );

        case "select":
            return (
                <div className="space-y-2">
                    <label className="text-sm font-medium text-brand-text-secondary">
                        {field.label} {field.required && <span className="text-red-400">*</span>}
                    </label>
                    <div className="relative">
                        <select
                            className="w-full bg-brand-input border border-[var(--border-primary)] rounded-lg px-4 py-3 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                            value={value || ""}
                            onChange={(e) => onChange(e.target.value)}
                        >
                            <option value="" disabled>Select an option</option>
                            {field.options?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-text-muted">
                            ▼
                        </div>
                    </div>
                </div>
            );

        case "slider":
            return (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-brand-text-secondary">
                            {field.label} {field.required && <span className="text-red-400">*</span>}
                        </label>
                        <span className="text-sm font-bold text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded">
                            {value || field.min || 1}/10
                        </span>
                    </div>
                    <input
                        type="range"
                        min={field.min || 1}
                        max={field.max || 10}
                        step={1}
                        value={value || field.min || 1}
                        onChange={(e) => onChange(parseInt(e.target.value))}
                        className="w-full h-2 bg-brand-elevated rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <div className="flex justify-between text-xs text-brand-text-muted px-1">
                        <span>Mild</span>
                        <span>Moderate</span>
                        <span>Severe</span>
                    </div>
                </div>
            );

        case "boolean":
            return (
                <div className="space-y-2">
                    <label className="text-sm font-medium text-brand-text-secondary">
                        {field.label} {field.required && <span className="text-red-400">*</span>}
                    </label>
                    <div className="flex gap-3">
                        <button
                            onClick={() => onChange(true)}
                            className={`flex-1 py-3 px-4 rounded-lg border transition-all ${value === true
                                ? "bg-rose-500/20 border-rose-500/50 text-rose-200"
                                : "bg-brand-input border-[var(--border-primary)] text-brand-text-muted hover:bg-brand-elevated"
                                }`}
                        >
                            Yes
                        </button>
                        <button
                            onClick={() => onChange(false)}
                            className={`flex-1 py-3 px-4 rounded-lg border transition-all ${value === false
                                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-200"
                                : "bg-brand-input border-[var(--border-primary)] text-brand-text-muted hover:bg-brand-elevated"
                                }`}
                        >
                            No
                        </button>
                    </div>
                </div>
            );

        default:
            return null;
    }
};

export const ClarificationPanel = ({ issues, onComplete, loading }: ClarificationPanelProps) => {
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [canSubmit, setCanSubmit] = useState(false);

    // Initial validation check
    useEffect(() => {
        if (!issues) return;
        const isValid = issues.every(issue =>
            issue.missing_fields.every(field => {
                const val = formData[`${issue.issue_id}_${field.field_key}`];
                if (field.required) return val !== undefined && val !== "" && val !== null;
                return true;
            })
        );
        setCanSubmit(isValid);
    }, [formData, issues]);

    const handleChange = (issueId: string, fieldKey: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [`${issueId}_${fieldKey}`]: value
        }));
    };

    const handleSubmit = () => {
        if (!canSubmit) return;
        onComplete(formData);
    };

    return (
        <div className="space-y-6">
            <div className="card">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--border-subtle)]">
                    <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                        <HelpCircle className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Clinical Clarification Required</h3>
                        <p className="text-sm text-brand-text-muted">Please provide the following details to proceed with routing.</p>
                    </div>
                </div>

                <div className="space-y-8">
                    {issues.map((issue, idx) => (
                        <div key={issue.issue_id} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                            {/* Issue Header */}
                            <div className="flex items-center gap-2 mb-4">
                                <span className="badge badge-neutral text-xs">
                                    Issue {idx + 1}
                                </span>
                                <h4 className="text-brand-text-secondary font-medium capitalize">
                                    {issue.summary}
                                </h4>
                            </div>

                            {/* Dynamic Fields Grid */}
                            <div className="grid gap-6 pl-4 border-l-2 border-[var(--border-primary)] ml-1">
                                {issue.missing_fields.map(field => (
                                    <FieldRenderer
                                        key={field.field_key}
                                        field={field}
                                        value={formData[`${issue.issue_id}_${field.field_key}`]}
                                        onChange={(val) => handleChange(issue.issue_id, field.field_key, val)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Submit Action */}
                <div className="mt-8 pt-6 border-t border-[var(--border-subtle)] flex justify-end">
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit || loading}
                        className={`
                            flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all
                            ${canSubmit && !loading
                                ? "btn-primary"
                                : "bg-brand-elevated text-brand-text-muted cursor-not-allowed border border-[var(--border-primary)]"}
                        `}
                    >
                        {loading ? (
                            <>Processing...</>
                        ) : (
                            <>
                                Continue to Routing
                                <CheckCircle2 className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
