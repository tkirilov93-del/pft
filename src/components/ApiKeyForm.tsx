"use client";

import { useState } from "react";
import { Lock, ShieldCheck, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApiKeyFormProps {
    onComplete: () => void;
}

export default function ApiKeyForm({ onComplete }: ApiKeyFormProps) {
    const [t212Key, setT212Key] = useState("");
    const [t212Secret, setT212Secret] = useState("");
    const [t212Practice, setT212Practice] = useState(false);
    const [cryptoKey, setCryptoKey] = useState("");
    const [cryptoSecret, setCryptoSecret] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (t212Key) {
            sessionStorage.setItem("t212_key", t212Key);
            sessionStorage.setItem("t212_secret", t212Secret);
            sessionStorage.setItem("t212_type", t212Practice ? "practice" : "live");
        }
        if (cryptoKey) sessionStorage.setItem("crypto_key", cryptoKey);
        if (cryptoSecret) sessionStorage.setItem("crypto_secret", cryptoSecret);
        onComplete();
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-black bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] p-6 text-white">
            <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-10 backdrop-blur-xl shadow-2xl">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                        <TrendingUp className="h-7 w-7 text-emerald-400" />
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Portfolio Tracker</h2>
                    <p className="mt-2 text-sm text-zinc-400">
                        Securely connect your exchange accounts.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="t212" className="block text-sm font-medium leading-6 text-zinc-200">
                                Trading212 API Key
                            </label>
                            <div className="relative mt-2">
                                <input
                                    id="t212"
                                    name="t212"
                                    type="password"
                                    value={t212Key}
                                    onChange={(e) => setT212Key(e.target.value)}
                                    className="block w-full rounded-lg border-0 bg-white/5 p-3 text-white ring-1 ring-inset ring-white/10 placeholder:text-zinc-500 focus:ring-2 focus:ring-inset focus:ring-emerald-500 sm:text-sm sm:leading-6"
                                    placeholder="Items or Portfolio Key"
                                />
                            </div>

                            <div className="pt-4">
                                <label htmlFor="t212Secret" className="block text-sm font-medium leading-6 text-zinc-200">
                                    Trading212 API Secret
                                </label>
                                <div className="relative mt-2">
                                    <input
                                        id="t212Secret"
                                        name="t212Secret"
                                        type="password"
                                        value={t212Secret}
                                        onChange={(e) => setT212Secret(e.target.value)}
                                        className="block w-full rounded-lg border-0 bg-white/5 p-3 text-white ring-1 ring-inset ring-white/10 placeholder:text-zinc-500 focus:ring-2 focus:ring-inset focus:ring-emerald-500 sm:text-sm sm:leading-6"
                                        placeholder="Your API Secret"
                                    />
                                </div>
                            </div>

                            <div className="relative flex gap-x-3 pt-3">
                                <div className="flex h-6 items-center">
                                    <input
                                        id="t212_practice"
                                        name="t212_practice"
                                        type="checkbox"
                                        checked={t212Practice}
                                        onChange={(e) => setT212Practice(e.target.checked)}
                                        className="h-4 w-4 rounded border-white/10 bg-white/5 text-emerald-600 focus:ring-emerald-600 focus:ring-offset-gray-900"
                                    />
                                </div>
                                <div className="text-sm leading-6">
                                    <label htmlFor="t212_practice" className="font-medium text-white">
                                        Use Practice Account
                                    </label>
                                    <p className="text-zinc-400">Enable if using a Demo account key.</p>
                                </div>
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="w-full border-t border-zinc-800" />
                            </div>
                            <div className="relative flex justify-center">
                                <span className="bg-zinc-900 px-2 text-xs uppercase text-zinc-500">And / Or</span>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="cryptoKey" className="block text-sm font-medium leading-6 text-zinc-200">
                                Crypto.com API Key
                            </label>
                            <div className="relative mt-2">
                                <input
                                    id="cryptoKey"
                                    name="cryptoKey"
                                    type="password"
                                    value={cryptoKey}
                                    onChange={(e) => setCryptoKey(e.target.value)}
                                    className="block w-full rounded-lg border-0 bg-white/5 p-3 text-white ring-1 ring-inset ring-white/10 placeholder:text-zinc-500 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
                                    placeholder="Public Key"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="cryptoSecret" className="block text-sm font-medium leading-6 text-zinc-200">
                                Crypto.com API Secret
                            </label>
                            <div className="relative mt-2">
                                <input
                                    id="cryptoSecret"
                                    name="cryptoSecret"
                                    type="password"
                                    value={cryptoSecret}
                                    onChange={(e) => setCryptoSecret(e.target.value)}
                                    className="block w-full rounded-lg border-0 bg-white/5 p-3 text-white ring-1 ring-inset ring-white/10 placeholder:text-zinc-500 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
                                    placeholder="Private Secret"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-md bg-emerald-500/10 p-4 ring-1 ring-inset ring-emerald-500/20">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-emerald-400">Security Note</h3>
                                <div className="mt-2 text-sm text-emerald-400/80">
                                    <p>
                                        Keys are stored in <strong>Session Storage</strong> only. They are never saved to a database and are cleared when you close the tab.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={(!t212Key || !t212Secret) && (!cryptoKey || !cryptoSecret)}
                        className="flex w-full justify-center rounded-lg bg-white px-3 py-3 text-sm font-semibold leading-6 text-black shadow-sm hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Access Portfolio
                    </button>
                </form>
            </div>
        </div>
    );
}
