"use client";

import { useState, useEffect } from "react";
import { Lock, ShieldCheck, TrendingUp, Key, Trash2 } from "lucide-react";
import AES from "crypto-js/aes";
import encUtf8 from "crypto-js/enc-utf8";
import { cn } from "@/lib/utils";

interface ApiKeyFormProps {
    onComplete: () => void;
}

export default function ApiKeyForm({ onComplete }: ApiKeyFormProps) {
    // Mode: 'loading' | 'setup' | 'login'
    const [mode, setMode] = useState<"loading" | "setup" | "login">("loading");

    // Vault State
    const [pin, setPin] = useState("");
    const [confirmPin, setConfirmPin] = useState("");
    const [error, setError] = useState<string | null>(null);

    // Form State (for setup)
    const [t212Key, setT212Key] = useState("");
    const [t212Secret, setT212Secret] = useState("");
    const [t212Practice, setT212Practice] = useState(false);
    const [cryptoKey, setCryptoKey] = useState("");
    const [cryptoSecret, setCryptoSecret] = useState("");

    useEffect(() => {
        const vault = localStorage.getItem("portfolio_vault");
        if (vault) {
            setMode("login");
        } else {
            setMode("setup");
        }
    }, []);

    const handleSetup = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (pin.length < 4) {
            setError("PIN must be at least 4 digits");
            return;
        }
        if (pin !== confirmPin) {
            setError("PINs do not match");
            return;
        }

        // Validate at least one service
        if ((!t212Key || !t212Secret) && (!cryptoKey || !cryptoSecret)) {
            setError("Please enter API keys for at least one service");
            return;
        }

        try {
            const keys = {
                t212_key: t212Key,
                t212_secret: t212Secret,
                t212_type: t212Practice ? "practice" : "live",
                crypto_key: cryptoKey,
                crypto_secret: cryptoSecret
            };

            const encrypted = AES.encrypt(JSON.stringify(keys), pin).toString();
            localStorage.setItem("portfolio_vault", encrypted);

            // Also set session for immediate access
            if (t212Key) {
                sessionStorage.setItem("t212_key", t212Key);
                sessionStorage.setItem("t212_secret", t212Secret);
                sessionStorage.setItem("t212_type", t212Practice ? "practice" : "live");
            }
            if (cryptoKey) {
                sessionStorage.setItem("crypto_key", cryptoKey);
                sessionStorage.setItem("crypto_secret", cryptoSecret);
            }

            onComplete();
        } catch (err) {
            console.error(err);
            setError("Failed to encrypt data");
        }
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        try {
            const vault = localStorage.getItem("portfolio_vault");
            if (!vault) {
                setMode("setup");
                return;
            }

            const bytes = AES.decrypt(vault, pin);
            const decryptedData = JSON.parse(bytes.toString(encUtf8));

            if (decryptedData) {
                if (decryptedData.t212_key) {
                    sessionStorage.setItem("t212_key", decryptedData.t212_key);
                    sessionStorage.setItem("t212_secret", decryptedData.t212_secret);
                    sessionStorage.setItem("t212_type", decryptedData.t212_type || "live");
                }
                if (decryptedData.crypto_key) {
                    sessionStorage.setItem("crypto_key", decryptedData.crypto_key);
                    sessionStorage.setItem("crypto_secret", decryptedData.crypto_secret);
                }
                onComplete();
            } else {
                setError("Invalid PIN");
            }
        } catch (err) {
            // Decryption failure usually throws malformed UTF-8 error
            setError("Invalid PIN");
        }
    };

    const handleReset = () => {
        if (confirm("Are you sure? This will delete your saved API keys. You will need to enter them again.")) {
            localStorage.removeItem("portfolio_vault");
            setMode("setup");
            setPin("");
            setError(null);
        }
    };

    if (mode === "loading") return null;

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-black bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] p-6 text-white">
            <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-10 backdrop-blur-xl shadow-2xl">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                        {mode === "login" ? <Lock className="h-7 w-7 text-emerald-400" /> : <TrendingUp className="h-7 w-7 text-emerald-400" />}
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">
                        {mode === "login" ? "Unlock Portfolio" : "Setup Secure Vault"}
                    </h2>
                    <p className="mt-2 text-sm text-zinc-400">
                        {mode === "login"
                            ? "Enter your PIN to decrypt your API keys."
                            : "Securely encrypt and store your keys locally."}
                    </p>
                </div>

                {error && (
                    <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500 text-center">
                        {error}
                    </div>
                )}

                {mode === "login" ? (
                    <form onSubmit={handleLogin} className="mt-8 space-y-6">
                        <div>
                            <label htmlFor="pin" className="block text-sm font-medium leading-6 text-zinc-200">
                                Enter PIN
                            </label>
                            <input
                                id="pin"
                                type="password"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                className="mt-2 block w-full rounded-lg border-0 bg-white/5 p-3 text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-emerald-500 text-center text-2xl tracking-widest"
                                placeholder="••••"
                                autoFocus
                            />
                        </div>
                        <button
                            type="submit"
                            className="flex w-full justify-center rounded-lg bg-white px-3 py-3 text-sm font-semibold leading-6 text-black hover:bg-zinc-200 transition-all font-bold"
                        >
                            Unlock
                        </button>
                        <button
                            type="button"
                            onClick={handleReset}
                            className="flex w-full justify-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-500 hover:text-red-500 transition-colors"
                        >
                            <Trash2 className="h-4 w-4" /> Reset Vault (Clear Keys)
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleSetup} className="mt-8 space-y-6">
                        {/* API KEY INPUTS (Same as before, simplified structure) */}
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {/* T212 Section */}
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-emerald-400">Trading212</h3>
                                <input
                                    type="password"
                                    value={t212Key}
                                    onChange={(e) => setT212Key(e.target.value)}
                                    className="block w-full rounded-lg border-0 bg-white/5 p-2.5 text-white ring-1 ring-inset ring-white/10 text-sm focus:ring-emerald-500"
                                    placeholder="API Key"
                                />
                                <input
                                    type="password"
                                    value={t212Secret}
                                    onChange={(e) => setT212Secret(e.target.value)}
                                    className="block w-full rounded-lg border-0 bg-white/5 p-2.5 text-white ring-1 ring-inset ring-white/10 text-sm focus:ring-emerald-500"
                                    placeholder="API Secret"
                                />
                                <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                                    <input type="checkbox" checked={t212Practice} onChange={e => setT212Practice(e.target.checked)} className="rounded border-zinc-700 bg-zinc-800 text-emerald-500" />
                                    <span>Use Practice Account</span>
                                </label>
                            </div>

                            <div className="border-t border-zinc-800 pt-4 space-y-2">
                                <h3 className="text-sm font-semibold text-blue-400">Crypto.com</h3>
                                <input
                                    type="password"
                                    value={cryptoKey}
                                    onChange={(e) => setCryptoKey(e.target.value)}
                                    className="block w-full rounded-lg border-0 bg-white/5 p-2.5 text-white ring-1 ring-inset ring-white/10 text-sm focus:ring-blue-500"
                                    placeholder="API Key"
                                />
                                <input
                                    type="password"
                                    value={cryptoSecret}
                                    onChange={(e) => setCryptoSecret(e.target.value)}
                                    className="block w-full rounded-lg border-0 bg-white/5 p-2.5 text-white ring-1 ring-inset ring-white/10 text-sm focus:ring-blue-500"
                                    placeholder="API Secret"
                                />
                            </div>
                        </div>

                        <div className="border-t border-zinc-800 pt-4">
                            <label className="block text-sm font-medium leading-6 text-white mb-2">Create a PIN (for quick login)</label>
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="password"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value)}
                                    className="block w-full rounded-lg bg-white/5 p-2.5 text-center text-white ring-1 ring-inset ring-white/10 focus:ring-emerald-500"
                                    placeholder="PIN"
                                />
                                <input
                                    type="password"
                                    value={confirmPin}
                                    onChange={(e) => setConfirmPin(e.target.value)}
                                    className="block w-full rounded-lg bg-white/5 p-2.5 text-center text-white ring-1 ring-inset ring-white/10 focus:ring-emerald-500"
                                    placeholder="Confirm"
                                />
                            </div>
                        </div>

                        <div className="rounded-md bg-emerald-500/10 p-4 ring-1 ring-inset ring-emerald-500/20">
                            <div className="flex">
                                <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                                <div className="ml-3 text-xs text-emerald-400/90">
                                    Keys will be encrypted with this PIN and stored on this device.
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="flex w-full justify-center rounded-lg bg-white px-3 py-3 text-sm font-semibold leading-6 text-black hover:bg-zinc-200 transition-all"
                        >
                            Create Vault & Login
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
