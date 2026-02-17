"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
    getMe,
    loginClinic,
    loginPatient as apiLoginPatient,
    logout as apiLogout,
    setAuthToken,
    removeAuthToken,
    getAuthToken,
} from "@/lib/api";

type User = {
    user_id: string;
    tenant_id: string;
    role: "admin" | "doctor" | "staff" | "patient";
    clinic_name?: string;
    patient_name?: string;
};

type AuthContextType = {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (data: any) => Promise<void>;
    loginPatient: (data: any) => Promise<void>;
    logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Initial Auth Check
    useEffect(() => {
        const initAuth = async () => {
            const token = getAuthToken();
            if (!token) {
                setIsLoading(false);
                return;
            }

            try {
                const userData = await getMe();
                setUser(userData);
            } catch (err) {
                console.error("Auth check failed:", err);
                removeAuthToken();
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();
    }, []);

    // Redirect logic for protected routes
    useEffect(() => {
        if (!isLoading) {
            const isProtectedAdmin = pathname.startsWith("/admin") || pathname.startsWith("/onboarding");
            const isProtectedPatient = pathname.startsWith("/patient");
            const isPublicAuth = pathname === "/login" || pathname === "/register" || pathname.startsWith("/register/");

            if (!user) {
                if (isProtectedAdmin) router.push("/login"); // Staff login
                if (isProtectedPatient) router.push("/login/patient"); // Patient login
            } else {
                // User is logged in
                if (isPublicAuth) {
                    if (user.role === "patient") {
                        router.push("/patient/overview");
                    } else {
                        router.push("/admin/dashboard");
                    }
                }
                // Prevent patients from accessing admin routes
                if (user.role === "patient" && isProtectedAdmin) {
                    router.push("/patient/overview");
                }
                // Prevent staff from accessing patient routes? Maybe not strict but good practice
                if (user.role !== "patient" && isProtectedPatient) {
                    router.push("/admin/dashboard");
                }
            }
        }
    }, [user, isLoading, pathname, router]);

    const login = async (credentials: any) => {
        try {
            const res = await loginClinic(credentials);
            setAuthToken(res.token);
            setUser({
                user_id: res.user.user_id,
                tenant_id: res.user.tenant_id,
                role: res.user.role,
                clinic_name: res.user.clinic_name,
            });

            // Redirect based on onboarding
            if (res.onboarding_complete === false) {
                router.push("/onboarding");
            } else {
                router.push("/admin/dashboard");
            }
        } catch (err) {
            throw err;
        }
    };

    const handleLoginPatient = async (credentials: { email: string; password: string }) => {
        try {
            const res = await apiLoginPatient(credentials);
            setAuthToken(res.access_token);

            // Set initial user state from login response
            setUser({
                user_id: res.patient_id,
                tenant_id: "",
                role: "patient",
                patient_name: res.patient_name,
            });

            // Store for backward compatibility
            localStorage.setItem("patientId", res.patient_id);
            localStorage.setItem("patientName", res.patient_name || "");

            router.push("/patient/overview");
        } catch (err) {
            throw err;
        }
    };

    const logout = async () => {
        try {
            await apiLogout();
        } catch (err) {
            console.error("Logout error:", err);
        } finally {
            removeAuthToken();
            localStorage.removeItem("patientId");
            localStorage.removeItem("patientName");
            setUser(null);
            router.push("/login");
        }
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, loginPatient: handleLoginPatient, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
