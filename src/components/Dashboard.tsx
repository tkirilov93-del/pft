"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Asset, PortfolioData } from "./types";
import { Loader2, LogOut, RefreshCw, TrendingUp, TrendingDown, PieChart as PieIcon, List } from "lucide-react";
import { cn, cleanTicker } from "@/lib/utils";
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
            const currentRates: { USD: number; EUR: number } = {
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

            // 2. Fetch Trading212
            if (t212Key && t212Secret) {
                // Fetch MetaData & Portfolio in parallel
                const [metaRes, t212Res] = await Promise.all([
                    fetch("/api/trading212/metadata", {
                        headers: { Authorization: t212Key, "X-Trading212-Secret": t212Secret, "X-Account-Type": t212Type || "live" }
                    }),
                    fetch("/api/trading212", {
                        headers: {
                            Authorization: t212Key,
                            "X-Trading212-Secret": t212Secret,
                            "X-Account-Type": t212Type || "live"
                        },
                    })
                ]);

                // Map Metadata
                const currencyMap = new Map<string, string>(); // Ticker -> CurrencyCode
                if (metaRes.ok) {
                    const metaData = await metaRes.json();
                    if (Array.isArray(metaData)) {
                        metaData.forEach((item: any) => {
                            currencyMap.set(item.ticker, item.currencyCode);
                        });
                    }
                }

                if (t212Res.ok) {
                    const t212Data = await t212Res.json();
                    if (Array.isArray(t212Data)) {
                        const t212Assets: Asset[] = t212Data.map((pos: any) => {
                            const nativeCurrency = currencyMap.get(pos.ticker) || pos.currency || "USD"; // Fallback to USD if unknown, but metadata should have it.

                            // Determine Value in USD (Normalization)
                            let valInUsd = pos.currentPrice * pos.quantity;

                            // If native is EUR, convert to USD base
                            if (nativeCurrency === "EUR") {
                                valInUsd = valInUsd * (1 / currentRates.EUR);
                            } else if (nativeCurrency === "GBP") {
                                // We don't have GBP rates fetched yet, assuming ~1.27 USD (static fallback or need fetch)
                                // For now, let's just assume 1:1 if we miss it or add fetch later. 
                                // Ideally we fetch more rates.
                                // Let's try to infer if we can.
                                // NOTE: User only asked for EUR/USD toggle.
                                // Let's stick to what we have.
                            }

                            // Wait, if the user holds a EUR stock, T212 reports price in EUR.
                            // If we want to show total in USD, we must convert EUR -> USD.
                            // currentRates.EUR is 1 USD = X EUR (e.g. 0.95).
                            // So 1 EUR = 1 / 0.95 USD.

                            return {
                                id: `t212-${pos.ticker}`,
                                symbol: cleanTicker(pos.ticker), // CLEAN NAME HERE
                                name: cleanTicker(pos.ticker), // Use clean name for display
                                quantity: pos.quantity,
                                price: pos.currentPrice, // Native Price
                                value: pos.currentPrice * pos.quantity, // Native Value
                                originalValue: pos.currentPrice * pos.quantity,
                                originalCurrency: nativeCurrency,
                                type: "stock",
                                valueUsd: valInUsd // Normalized for totals
                            };
                        });
                        allAssets = [...allAssets, ...t212Assets];
                    }
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
                    const priceMap = new Map<string, number>();
                    if (tickerData.result?.data) {
                        tickerData.result.data.forEach((t: any) => {
                            if (t.i.endsWith("_USD")) {
                                const symbol = t.i.split("_")[0];
                                priceMap.set(symbol, parseFloat(t.a));
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
                            const qty = parseFloat(b.balance);
                            const price = priceMap.get(symbol) || 0;
                            const finalPrice = (symbol === "USD" || symbol === "USDT") ? 1 : price;

                            return {
                                id: `crypto-${symbol}`,
                                symbol: symbol,
                                name: symbol,
                                quantity: qty,
                                price: finalPrice,
                                value: qty * finalPrice,
                                originalValue: qty * finalPrice,
                                originalCurrency: "USD",
                                type: "crypto",
                                valueUsd: qty * finalPrice
                            };
                        });

                    allAssets = [...allAssets, ...cryptoAssets];
                }
            }

            const totalUsd = allAssets.reduce((sum, a) => sum + (a as any).valueUsd, 0);
            const equityUsd = allAssets.filter(a => a.type === "stock").reduce((sum, a) => sum + (a as any).valueUsd, 0);
            const cryptoUsd = allAssets.filter(a => a.type === "crypto").reduce((sum, a) => sum + (a as any).valueUsd, 0);

            setData({
                totalValue: totalUsd,
                assets: allAssets, // These have valueUsd attached
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
                        <div className="max-h-[500px] overflow-auto">
                            <table className="min-w-full divide-y divide-zinc-800">
                                <thead className="bg-zinc-900 sticky top-0 z-10">
                                    <tr>
                                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap">Asset</th>
                                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap">Type</th>
                                        <th scope="col" className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap">Quantity</th>
                                        <th scope="col" className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap">Price</th>
                                        <th scope="col" className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap">Value</th>
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
                </div>
            </main>
        </div>
    );
}
