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
                    <label className="text-sm font-medium text-slate-300">
                        {field.label} {field.required && <span className="text-rose-400">*</span>}
                    </label>
                    <input
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                        placeholder="Type your answer..."
                        value={value || ""}
                        onChange={(e) => onChange(e.target.value)}
                    />
                </div>
            );

        case "select":
            return (
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                        {field.label} {field.required && <span className="text-rose-400">*</span>}
                    </label>
                    <div className="relative">
                        <select
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            value={value || ""}
                            onChange={(e) => onChange(e.target.value)}
                        >
                            <option value="" disabled>Select an option</option>
                            {field.options?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                            ▼
                        </div>
                    </div>
                </div>
            );

        case "slider":
            return (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-slate-300">
                            {field.label} {field.required && <span className="text-rose-400">*</span>}
                        </label>
                        <span className="text-sm font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
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
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-slate-500 px-1">
                        <span>Mild</span>
                        <span>Moderate</span>
                        <span>Severe</span>
                    </div>
                </div>
            );

        case "boolean":
            return (
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                        {field.label} {field.required && <span className="text-rose-400">*</span>}
                    </label>
                    <div className="flex gap-3">
                        <button
                            onClick={() => onChange(true)}
                            className={`flex-1 py-3 px-4 rounded-lg border transition-all ${value === true
                                ? "bg-rose-500/20 border-rose-500/50 text-rose-200"
                                : "bg-slate-900/50 border-slate-700 text-slate-400 hover:bg-slate-800"
                                }`}
                        >
                            Yes
                        </button>
                        <button
                            onClick={() => onChange(false)}
                            className={`flex-1 py-3 px-4 rounded-lg border transition-all ${value === false
                                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-200"
                                : "bg-slate-900/50 border-slate-700 text-slate-400 hover:bg-slate-800"
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
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700/50">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                        <HelpCircle className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-slate-100">Clinical Clarification Required</h3>
                        <p className="text-sm text-slate-400">Please provide the following details to proceed with routing.</p>
                    </div>
                </div>

                <div className="space-y-8">
                    {issues.map((issue, idx) => (
                        <div key={issue.issue_id} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                            {/* Issue Header */}
                            <div className="flex items-center gap-2 mb-4">
                                <span className="bg-slate-700 text-slate-300 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                                    Issue {idx + 1}
                                </span>
                                <h4 className="text-slate-200 font-medium capitalize">
                                    {issue.summary}
                                </h4>
                            </div>

                            {/* Dynamic Fields Grid */}
                            <div className="grid gap-6 pl-4 border-l-2 border-slate-700/50 ml-1">
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
                <div className="mt-8 pt-6 border-t border-slate-700/50 flex justify-end">
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit || loading}
                        className={`
                            flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all
                            ${canSubmit && !loading
                                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                                : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"}
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
