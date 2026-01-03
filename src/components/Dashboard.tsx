"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Asset, PortfolioData } from "./types";
import { Loader2, LogOut, RefreshCw, TrendingUp, TrendingDown, PieChart as PieIcon, AlertTriangle, AlertCircle, X } from "lucide-react";
import { cn, cleanTicker } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import HistoryChart from "./HistoryChart";

interface DashboardProps {
    onLogout: () => void;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#6366f1"];

export default function Dashboard({ onLogout }: DashboardProps) {
    const [currency, setCurrency] = useState<"EUR" | "USD">("EUR");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isStale, setIsStale] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);
    const [data, setData] = useState<PortfolioData | null>(null);
    const [rates, setRates] = useState<{ EUR: number; USD: number } | null>(null);
    const [history, setHistory] = useState<{ date: string; value: number }[]>([]);

    const formatMoney = (value: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency,
        }).format(value);
    };

    const initialized = useRef(false);

    // Load history/cache on mount
    useEffect(() => {
        const savedHistory = localStorage.getItem("portfolio_history");
        if (savedHistory) {
            try {
                setHistory(JSON.parse(savedHistory));
            } catch (e) { console.error("History parse error", e); }
        }
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        setIsStale(false);
        try {
            const t212Key = sessionStorage.getItem("t212_key");
            const t212Secret = sessionStorage.getItem("t212_secret");
            const t212Type = sessionStorage.getItem("t212_type");
            const cryptoKey = sessionStorage.getItem("crypto_key");
            const cryptoSecret = sessionStorage.getItem("crypto_secret");

            // 2. Fetch All Data in Parallel
            const [ratesRes, metaRes, t212Res, cryptoRes, tickerRes] = await Promise.all([
                fetch("/api/rates"),
                t212Key && t212Secret ? fetch("/api/trading212/metadata", { headers: { Authorization: t212Key, "X-Trading212-Secret": t212Secret, "X-Account-Type": t212Type || "live" } }) : Promise.resolve(null),
                t212Key && t212Secret ? fetch("/api/trading212", { headers: { Authorization: t212Key, "X-Trading212-Secret": t212Secret, "X-Account-Type": t212Type || "live" } }) : Promise.resolve(null),
                cryptoKey && cryptoSecret ? fetch("/api/crypto", { headers: { Authorization: cryptoKey, "X-Api-Secret": cryptoSecret } }) : Promise.resolve(null),
                (cryptoKey || true) ? fetch("/api/crypto/tickers") : Promise.resolve(null)
            ]);

            // CHECK ERRORS
            // If T212 or Crypto was requested but failed (and not 404 which is handled inside proxy usually)
            if (t212Res && !t212Res.ok) throw new Error(`Trading212 Error: ${t212Res.statusText}`);
            if (cryptoRes && !cryptoRes.ok) throw new Error(`Crypto.com Error: ${cryptoRes.statusText}`);

            // --- A. Process FX Rates ---
            const ratesData = await ratesRes.json();
            let eurRate = ratesData.rates?.EUR || 0.95;

            const cryptoPriceMap = new Map<string, number>();
            if (tickerRes && tickerRes.ok) {
                const tickerData = await tickerRes.json();
                if (tickerData.result?.data) {
                    tickerData.result.data.forEach((t: any) => {
                        if (t.i.endsWith("_USD")) cryptoPriceMap.set(t.i.split("_")[0], parseFloat(t.a));
                        else if (t.i.endsWith("_USDT")) {
                            const symbol = t.i.split("_")[0];
                            if (!cryptoPriceMap.has(symbol)) cryptoPriceMap.set(symbol, parseFloat(t.a));
                        }

                        if (t.i === "EUR_USD") {
                            const rate = parseFloat(t.a);
                            if (rate > 0) eurRate = 1 / rate;
                        } else if (t.i === "EUR_USDT") {
                            const rate = parseFloat(t.a);
                            if (rate > 0) eurRate = 1 / rate;
                        } else if (t.i === "USD_EUR" || t.i === "USDT_EUR") {
                            const rate = parseFloat(t.a);
                            if (rate > 0) eurRate = rate;
                        }
                    });
                }
            }

            const currentRates = { USD: 1, EUR: eurRate };
            setRates(currentRates);

            let allAssets: Asset[] = [];

            // --- B. Process Trading212 ---
            // Map Metadata
            const currencyMap = new Map<string, string>();
            if (metaRes && metaRes.ok) {
                const metaData = await metaRes.json();
                if (Array.isArray(metaData)) {
                    metaData.forEach((item: any) => currencyMap.set(item.ticker, item.currencyCode));
                }
            }

            if (t212Res && t212Res.ok) {
                const t212Data = await t212Res.json();
                if (Array.isArray(t212Data)) {
                    const t212Assets: Asset[] = t212Data.map((pos: any) => {
                        const nativeCurrency = currencyMap.get(pos.ticker) || pos.currency || "USD";
                        let valInUsd = pos.currentPrice * pos.quantity;

                        if (nativeCurrency === "EUR") {
                            valInUsd = valInUsd * (1 / currentRates.EUR);
                        } else if (nativeCurrency === "GBP") {
                            const gbpUsd = cryptoPriceMap.get("GBP");
                            if (gbpUsd) {
                                valInUsd = valInUsd * gbpUsd;
                            } else {
                                valInUsd = valInUsd * 1.25;
                            }
                        }

                        return {
                            id: `t212-${pos.ticker}`,
                            symbol: cleanTicker(pos.ticker),
                            name: cleanTicker(pos.ticker),
                            quantity: pos.quantity,
                            price: pos.currentPrice,
                            value: pos.currentPrice * pos.quantity,
                            originalValue: pos.currentPrice * pos.quantity,
                            originalCurrency: nativeCurrency,
                            type: "stock",
                            valueUsd: valInUsd
                        };
                    });
                    allAssets = [...allAssets, ...t212Assets];
                }
            }

            // --- C. Process Crypto ---
            if (cryptoRes && cryptoRes.ok) {
                const balanceData = await cryptoRes.json();
                const balances = balanceData.result?.accounts || [];
                const cryptoAssets: Asset[] = balances
                    .filter((b: any) => parseFloat(b.available) > 0 || parseFloat(b.order) > 0)
                    .map((b: any) => {
                        const symbol = b.currency;
                        const qty = parseFloat(b.balance);
                        const price = cryptoPriceMap.get(symbol) || 0;
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

            const totalUsd = allAssets.reduce((sum, a) => sum + (a as any).valueUsd, 0);
            const equityUsd = allAssets.filter(a => a.type === "stock").reduce((sum, a) => sum + (a as any).valueUsd, 0);
            const cryptoUsd = allAssets.filter(a => a.type === "crypto").reduce((sum, a) => sum + (a as any).valueUsd, 0);

            const newData = {
                totalValue: totalUsd,
                assets: allAssets,
                equityValue: equityUsd,
                cryptoValue: cryptoUsd
            };

            setData(newData);
            setLastUpdated(Date.now());

            // --- SAVE TO CACHE & HISTORY ---
            localStorage.setItem("portfolio_cache", JSON.stringify({ data: newData, rates: currentRates, timestamp: Date.now() }));

            // Update History logic (One entry per day)
            const today = new Date().toISOString().split('T')[0];

            setHistory(prev => {
                const historyCopy = [...prev];
                const existingIndex = historyCopy.findIndex(h => h.date === today);
                if (existingIndex >= 0) {
                    historyCopy[existingIndex].value = totalUsd;
                } else {
                    historyCopy.push({ date: today, value: totalUsd });
                }
                localStorage.setItem("portfolio_history", JSON.stringify(historyCopy));
                return historyCopy;
            });


        } catch (err: any) {
            console.error(err);
            const errorMsg = err.message || "Unknown error occurred";
            setError(errorMsg);

            // FALLBACK TO CACHE
            const cached = localStorage.getItem("portfolio_cache");
            if (cached) {
                const parsed = JSON.parse(cached);
                setData(parsed.data);
                setRates(parsed.rates);
                setLastUpdated(parsed.timestamp);
                setIsStale(true);
            }
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

    // History in Selected Currency
    const historyData = useMemo(() => {
        if (!history || !rates) return [];
        const rate = currency === "EUR" ? rates.EUR : 1;
        return history.map(h => ({
            ...h,
            value: h.value * rate
        }));
    }, [history, currency, rates]);


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
                        {/* Stale Data Indicator */}
                        {isStale && lastUpdated && (
                            <div className="hidden sm:flex items-center gap-2 rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-500 ring-1 ring-yellow-500/20">
                                <AlertTriangle className="h-3 w-3" />
                                <span>Using cached data ({new Date(lastUpdated).toLocaleTimeString()})</span>
                            </div>
                        )}

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
                            <RefreshCw className={cn("h-5 w-5", loading ? "animate-spin" : "")} />
                        </button>
                        <button onClick={onLogout} className="p-2 text-zinc-400 hover:text-red-400 transition-colors">
                            <LogOut className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* ERROR BANNER */}
            {error && (
                <div className="sticky top-16 z-10 w-full bg-red-500/10 px-4 py-3 border-b border-red-500/20 backdrop-blur">
                    <div className="mx-auto flex max-w-7xl items-center justify-between">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="h-5 w-5 text-red-500" />
                            <p className="text-sm font-medium text-red-400">
                                {isStale ? "Connection Failed. Showing cached data." : "Failed to load portfolio."}
                                <span className="ml-2 opacity-75 border-l border-red-500/30 pl-2">{error}</span>
                            </p>
                        </div>
                        <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300"><X className="h-5 w-5" /></button>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">

                {/* Hero Stats */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="col-span-2 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-sm sm:col-span-2 lg:col-span-2">
                        <div className="flex items-start justify-between">
                            <div>
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

                            {/* HISTORY CHART */}
                            <div className="hidden md:block h-32 w-48 opacity-75">
                                <HistoryChart data={historyData} currency={currency} />
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
                                                    <div className={cn("relative flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden shrink-0", asset.type === "stock" ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500")}>
                                                        {asset.type === "stock" ? (
                                                            <img
                                                                src={`https://img.logo.dev/ticker/${asset.symbol}?token=pk_Zdv89aXoRyWNu8sMG7WBbw`}
                                                                alt={asset.symbol}
                                                                className="h-full w-full object-cover"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                                }}
                                                            />
                                                        ) : asset.type === "crypto" ? (
                                                            <img
                                                                src={`https://assets.coincap.io/assets/icons/${asset.symbol.toLowerCase()}@2x.png`}
                                                                alt={asset.symbol}
                                                                className="h-full w-full object-cover"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                                }}
                                                            />
                                                        ) : null}

                                                        {/* FALLBACK (Hidden by default, shown on error) */}
                                                        <span className="hidden absolute inset-0 flex items-center justify-center text-xs font-bold">
                                                            {asset.symbol.slice(0, 1)}
                                                        </span>
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
