"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function RedirectToChat() {
    const router = useRouter();
    const { isLoading } = useAuth();

    useEffect(() => {
        if (!isLoading) {
            router.replace("/chat");
        }
    }, [isLoading, router]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-brand-primary">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-accent border-t-transparent" />
        </div>
    );
}