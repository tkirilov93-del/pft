"use client";

import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface HistoryEntry {
    date: string;
    value: number;
}

interface HistoryChartProps {
    data: HistoryEntry[];
    currency: "EUR" | "USD";
}

export default function HistoryChart({ data, currency }: HistoryChartProps) {
    const formattedData = useMemo(() => {
        if (!data || data.length === 0) return [];
        return data.map(d => ({
            ...d,
            formattedDate: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [data]);

    if (formattedData.length < 2) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                Tracking history... check back tomorrow!
            </div>
        );
    }

    const isPositive = formattedData[formattedData.length - 1].value >= formattedData[0].value;

    return (
        <div className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedData}>
                    <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "#18181b",
                            borderColor: "#27272a",
                            color: "#f4f4f5",
                            borderRadius: "8px",
                            fontSize: "12px",
                        }}
                        itemStyle={{ color: "#fff" }}
                        formatter={(value: any) => [
                            new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value)),
                            "Value"
                        ]}
                        labelFormatter={(label) => label}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={isPositive ? "#10b981" : "#ef4444"}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorValue)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
