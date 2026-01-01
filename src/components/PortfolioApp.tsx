"use client";

import { useEffect, useState } from "react";
import ApiKeyForm from "./ApiKeyForm";
import Dashboard from "./Dashboard";

export default function PortfolioApp() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        // Check if keys exist in session storage
        const t212 = sessionStorage.getItem("t212_key");
        const cryptoKey = sessionStorage.getItem("crypto_key");
        const cryptoSecret = sessionStorage.getItem("crypto_secret");

        if (t212 || (cryptoKey && cryptoSecret)) {
            setIsAuthenticated(true);
        }
        setIsLoading(false);
    }, []);

    const handleLogin = () => {
        setIsAuthenticated(true);
    };

    const handleLogout = () => {
        sessionStorage.clear();
        setIsAuthenticated(false);
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen bg-black text-white">Loading...</div>;
    }

    if (!isAuthenticated) {
        return <ApiKeyForm onComplete={handleLogin} />;
    }

    return <Dashboard onLogout={handleLogout} />;
}
