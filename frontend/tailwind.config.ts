import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    primary: "var(--bg-primary)",
                    secondary: "var(--bg-secondary)",
                    tertiary: "var(--bg-tertiary)",
                    card: "var(--bg-card)",
                    "card-hover": "var(--bg-card-hover)",
                    elevated: "var(--bg-elevated)",
                    accent: {
                        DEFAULT: "var(--accent-primary)",
                        secondary: "var(--accent-secondary)",
                    },
                    text: {
                        primary: "var(--text-primary)",
                        secondary: "var(--text-secondary)",
                        muted: "var(--text-muted)",
                        disabled: "var(--text-disabled)",
                    },
                },
            },
            borderColor: {
                "brand-default": "var(--border-default)",
                "brand-subtle": "var(--border-subtle)",
                "brand-hover": "var(--border-hover)",
                "brand-accent": "var(--border-accent)",
            },
            borderRadius: {
                "brand-sm": "var(--radius-sm)",
                "brand-md": "var(--radius-md)",
                "brand-lg": "var(--radius-lg)",
                "brand-xl": "var(--radius-xl)",
            },
            boxShadow: {
                "brand-sm": "var(--shadow-sm)",
                "brand-md": "var(--shadow-md)",
                "brand-lg": "var(--shadow-lg)",
                "brand-glow": "var(--shadow-glow)",
            },
            spacing: {
                "brand-1": "var(--space-1)",
                "brand-2": "var(--space-2)",
                "brand-3": "var(--space-3)",
                "brand-4": "var(--space-4)",
                "brand-5": "var(--space-5)",
                "brand-6": "var(--space-6)",
                "brand-8": "var(--space-8)",
            },
            animation: {
                "brand-fade-in": "fadeIn 0.4s ease forwards",
                "brand-fade-in-up": "fadeInUp 0.5s ease forwards",
                "brand-slide-in-right": "slideInRight 0.4s ease forwards",
                "brand-pulse-slow": "pulse 3s ease-in-out infinite",
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: "0", transform: "translateY(10px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                fadeInUp: {
                    "0%": { opacity: "0", transform: "translateY(20px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                slideInRight: {
                    "0%": { opacity: "0", transform: "translateX(20px)" },
                    "100%": { opacity: "1", transform: "translateX(0)" },
                },
            },
        },
    },
    plugins: [],
};
export default config;
