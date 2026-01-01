import { NextResponse } from "next/server";

export async function GET() {
    try {
        const response = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR");

        if (!response.ok) {
            return NextResponse.json({ error: "Failed to fetch rates" }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error", details: String(error) }, { status: 500 });
    }
}
