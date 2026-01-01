import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const apiKey = request.headers.get("Authorization");
    const apiSecret = request.headers.get("X-Trading212-Secret");

    if (!apiKey || !apiSecret) {
        return NextResponse.json({ error: "Missing API Key or Secret" }, { status: 401 });
    }

    // Determine Endpoint (Live vs Practice)
    const isPractice = request.headers.get("X-Account-Type") === "practice";
    const baseUrl = isPractice ? "https://demo.trading212.com" : "https://live.trading212.com";

    console.log(`[T212 Proxy] Attempting connection to: ${baseUrl}`);
    console.log(`[T212 Proxy] Key Present: ${!!apiKey}, Secret Present: ${!!apiSecret}, Mode: ${isPractice ? 'Practice' : 'Live'}`);

    // Construct Basic Auth Header
    const authString = `${apiKey}:${apiSecret}`;
    const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`;

    try {
        // Fetch Open Positions (User script uses /portfolio which returns all items)
        const response = await fetch(`${baseUrl}/api/v0/equity/portfolio`, {
            headers: {
                "Authorization": authHeader,
            },
        });

        if (!response.ok) {
            // Handle 404 (Empty Portfolio) specifically
            if (response.status === 404) {
                console.log("[T212 Proxy] 404 returned, treating as empty portfolio.");
                return NextResponse.json([]);
            }

            const errorText = await response.text();
            return NextResponse.json({ error: `Trading212 Error: ${response.statusText}`, details: errorText }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error", details: String(error) }, { status: 500 });
    }
}
