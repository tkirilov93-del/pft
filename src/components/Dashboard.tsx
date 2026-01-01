"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Asset, PortfolioData } from "./types";
import { Loader2, LogOut, RefreshCw, TrendingUp, TrendingDown, PieChart as PieIcon, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface DashboardProps {
    onLogout: () => void;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#6366f1"];

export default function Dashboard({ onLogout }: DashboardProps) {
    const [currency, setCurrency] = useState<"EUR" | "USD">("EUR");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<PortfolioData | null>(null);
    const [rates, setRates] = useState<{ EUR: number; USD: number } | null>(null);

    const formatMoney = (value: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency,
        }).format(value);
    };

    const initialized = useRef(false);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch Rates
            const ratesRes = await fetch("/api/rates");
            const ratesData = await ratesRes.json();
            const currentRates = {
                USD: 1, // Base
                EUR: ratesData.rates?.EUR || 0.95, // Fallback
            };
            setRates(currentRates);

            const t212Key = sessionStorage.getItem("t212_key");
            const t212Secret = sessionStorage.getItem("t212_secret");
            const t212Type = sessionStorage.getItem("t212_type"); // 'practice' or 'live'
            const cryptoKey = sessionStorage.getItem("crypto_key");
            const cryptoSecret = sessionStorage.getItem("crypto_secret");

            let allAssets: Asset[] = [];
            let t212Val = 0;
            let cryptoVal = 0;

            // 2. Fetch Trading212
            if (t212Key && t212Secret) {
                const t212Res = await fetch("/api/trading212", {
                    headers: {
                        Authorization: t212Key,
                        "X-Trading212-Secret": t212Secret,
                        "X-Account-Type": t212Type || "live"
                    },
                });

                if (t212Res.ok) {
                    const t212Data = await t212Res.json();
                    // Assuming t212Data is an array of positions
                    if (Array.isArray(t212Data)) {
                        const t212Assets: Asset[] = t212Data.map((pos: any) => ({
                            id: `t212-${pos.ticker}`,
                            symbol: pos.ticker,
                            name: pos.ticker, // T212 might not give full name in positions endpoint
                            quantity: pos.quantity,
                            price: pos.currentPrice,
                            value: pos.currentPrice * pos.quantity, // In original currency (usually USD for US stocks)
                            originalValue: pos.currentPrice * pos.quantity,
                            originalCurrency: pos.currency || "USD", // Assumption
                            type: "stock",
                        }));
                        allAssets = [...allAssets, ...t212Assets];
                    } else {
                        console.error("Trading212 Unexpected Data:", t212Data);
                        setError("Trading212 connected, but returned unexpected data format. Check console.");
                    }
                } else {
                    const errText = await t212Res.text();
                    console.error("Trading212 Fetch Error:", t212Res.status, errText);
                    // Don't block Crypto if T212 fails, but show warning?
                    // For now, let's set a specific error message if it's the only thing failing
                    if (!cryptoKey) setError(`Trading212 Failed: ${t212Res.statusText}`);
                }
            }

            // 3. Fetch Crypto
            if (cryptoKey && cryptoSecret) {
                // Parallel fetch: Balances and Tickers
                const [balanceRes, tickerRes] = await Promise.all([
                    fetch("/api/crypto", { headers: { Authorization: cryptoKey, "X-Api-Secret": cryptoSecret } }),
                    fetch("/api/crypto/tickers")
                ]);

                if (balanceRes.ok && tickerRes.ok) {
                    const balanceData = await balanceRes.json();
                    const tickerData = await tickerRes.json();

                    // Map tickers for price lookup
                    // Crypto.com tickers: { result: { data: [ { i: "BTC_USD", k: 12345.5 ... } ] } }
                    const priceMap = new Map<string, number>();
                    if (tickerData.result?.data) {
                        tickerData.result.data.forEach((t: any) => {
                            // Prefer USD pairs
                            if (t.i.endsWith("_USD")) {
                                const symbol = t.i.split("_")[0];
                                priceMap.set(symbol, parseFloat(t.a)); // 'a' is usually last/buy price
                            } else if (t.i.endsWith("_USDT")) {
                                const symbol = t.i.split("_")[0];
                                if (!priceMap.has(symbol)) priceMap.set(symbol, parseFloat(t.a));
                            }
                        });
                    }

                    const balances = balanceData.result?.accounts || [];
                    const cryptoAssets: Asset[] = balances
                        .filter((b: any) => parseFloat(b.available) > 0 || parseFloat(b.order) > 0)
                        .map((b: any) => {
                            const symbol = b.currency;
                            const qty = parseFloat(b.balance); // Total (available + order)
                            const price = priceMap.get(symbol) || 0; // Default 0 if no price found (e.g. USD/USDT itself)
                            // If USD/USDT, price is 1
                            const finalPrice = (symbol === "USD" || symbol === "USDT") ? 1 : price;

                            return {
                                id: `crypto-${symbol}`,
                                symbol: symbol,
                                name: symbol,
                                quantity: qty,
                                price: finalPrice,
                                value: qty * finalPrice, // Value in USD
                                originalValue: qty * finalPrice,
                                originalCurrency: "USD",
                                type: "crypto"
                            };
                        });

                    allAssets = [...allAssets, ...cryptoAssets];
                }
            }

            // 4. Normalize to Display Currency
            // We do this in render or here? Here is better for total calc.
            // But we need to re-calc if currency changes. 
            // So better to store 'base' assets (normalized to USD usually) and convert on display.
            // For now, let's normalize everything to USD in the state, and convert to EUR if needed.
            // Note: T212 might return EUR stocks. We need to handle that.
            // Simplified: Assume we have USD based data or convert everything to USD first.

            const normalizedAssets = allAssets.map(asset => {
                let valueInUSD = asset.value;
                if (asset.originalCurrency === "EUR") {
                    valueInUSD = asset.value * (1 / currentRates.EUR);
                }
                // Add more currencies if needed
                return { ...asset, valueUsd: valueInUSD };
            });

            const totalUsd = normalizedAssets.reduce((sum, a) => sum + (a as any).valueUsd, 0);
            const equityUsd = normalizedAssets.filter(a => a.type === "stock").reduce((sum, a) => sum + (a as any).valueUsd, 0);
            const cryptoUsd = normalizedAssets.filter(a => a.type === "crypto").reduce((sum, a) => sum + (a as any).valueUsd, 0);

            setData({
                totalValue: totalUsd, // Store in USD
                assets: normalizedAssets,
                equityValue: equityUsd,
                cryptoValue: cryptoUsd
            });

        } catch (err) {
            console.error(err);
            setError("Failed to load portfolio data. Check your API keys and connection.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!initialized.current) {
            initialized.current = true;
            fetchData();
        }
    }, []);

    // Derived State for Display
    const displayData = useMemo(() => {
        if (!data || !rates) return null;
        const rate = currency === "EUR" ? rates.EUR : 1;

        return {
            totalValue: data.totalValue * rate,
            equityValue: data.equityValue * rate,
            cryptoValue: data.cryptoValue * rate,
            assets: data.assets.map(a => ({
                ...a,
                value: (a as any).valueUsd * rate // Update display value
            })).sort((a, b) => b.value - a.value)
        };
    }, [data, currency, rates]);

    const pieData = displayData ? [
        { name: "Stocks", value: displayData.equityValue },
        { name: "Crypto", value: displayData.cryptoValue }
    ] : [];

    if (loading && !data) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black text-emerald-500">
                <Loader2 className="h-10 w-10 animate-spin" />
                <span className="ml-3 text-lg font-medium">Loading Portfolio...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 pb-20 text-zinc-100">
            {/* Header */}
            <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-500">
                            <PieIcon className="h-5 w-5" />
                        </div>
                        <span className="text-lg font-bold tracking-tight">Portfolio</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900 p-1">
                            <button
                                onClick={() => setCurrency("EUR")}
                                className={cn("rounded-md px-3 py-1 text-sm font-medium transition-all", currency === "EUR" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}
                            >
                                EUR
                            </button>
                            <button
                                onClick={() => setCurrency("USD")}
                                className={cn("rounded-md px-3 py-1 text-sm font-medium transition-all", currency === "USD" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}
                            >
                                USD
                            </button>
                        </div>

                        <button onClick={fetchData} className="p-2 text-zinc-400 hover:text-white transition-colors">
                            <RefreshCw className="h-5 w-5" />
                        </button>
                        <button onClick={onLogout} className="p-2 text-zinc-400 hover:text-red-400 transition-colors">
                            <LogOut className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
                {error && (
                    <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-500">
                        {error}
                    </div>
                )}

                {/* Hero Stats */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="col-span-2 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-sm sm:col-span-2 lg:col-span-2">
                        <span className="text-sm font-medium text-zinc-400">Total Net Worth</span>
                        <h2 className="mt-2 text-5xl font-bold tracking-tight text-white space-x-1">
                            {displayData ? formatMoney(displayData.totalValue) : "---"}
                        </h2>
                        <div className="mt-6 flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                                <span className="text-sm text-zinc-400">Stocks: <span className="text-zinc-200">{displayData ? formatMoney(displayData.equityValue) : "-"}</span></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                                <span className="text-sm text-zinc-400">Crypto: <span className="text-zinc-200">{displayData ? formatMoney(displayData.cryptoValue) : "-"}</span></span>
                            </div>
                        </div>
                    </div>

                    {/* Pie Chart */}
                    <div className="flex items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
                        <div className="h-48 w-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 0 ? "#10b981" : "#3b82f6"} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", color: "#f4f4f5" }}
                                        formatter={(value: any) => formatMoney(Number(value))}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Assets Table */}
                <div className="mt-10">
                    <h3 className="mb-4 text-xl font-semibold text-white">Assets Allocation</h3>
                    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
                        <table className="min-w-full divide-y divide-zinc-800">
                            <thead className="bg-zinc-900">
                                <tr>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Asset</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Type</th>
                                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Quantity</th>
                                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Price</th>
                                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {displayData?.assets.map((asset) => (
                                    <tr key={asset.id} className="group hover:bg-zinc-800/50 transition-colors">
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <div className="flex items-center">
                                                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold", asset.type === "stock" ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500")}>
                                                    {asset.symbol.slice(0, 1)}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="font-medium text-white">{asset.symbol}</div>
                                                    {asset.name !== asset.symbol && <div className="text-xs text-zinc-500">{asset.name}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", asset.type === "stock" ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500")}>
                                                {asset.type === "stock" ? "Stock" : "Crypto"}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-right text-zinc-300">
                                            {asset.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-right text-zinc-300">
                                            {asset.price.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-right font-medium text-white">
                                            {formatMoney(asset.value)}
                                        </td>
                                    </tr>
                                ))}
                                {displayData?.assets.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-10 text-center text-zinc-500">
                                            No assets found. Connect your accounts to see your portfolio.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
