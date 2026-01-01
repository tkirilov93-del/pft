import { NextRequest, NextResponse } from "next/server";
import CryptoJS from "crypto-js";

export async function GET(request: NextRequest) {
    const apiKey = request.headers.get("Authorization");
    const apiSecret = request.headers.get("X-Api-Secret");

    if (!apiKey || !apiSecret) {
        return NextResponse.json({ error: "Missing API Key or Secret" }, { status: 401 });
    }

    try {
        // Crypto.com Exchange API v2
        const method = "private/get-account-summary";
        const id = Date.now();
        const nonce = Date.now().toString();
        const params = {}; // No params for account summary? Check docs. Usually optional currency.
        // If we want all, we pass empty.

        // Signature Generation
        // SigPayload: method + id + apiKey + paramsString + nonce
        // paramsString is sorted keys. Empty params -> ""
        const paramsString = "";

        const sigPayload = method + id + apiKey + paramsString + nonce;
        const sig = CryptoJS.HmacSHA256(sigPayload, apiSecret).toString(CryptoJS.enc.Hex);

        const body = {
            id: id,
            method: method,
            api_key: apiKey,
            params: params,
            sig: sig,
            nonce: nonce
        };

        const response = await fetch("https://api.crypto.com/v2/private/get-account-summary", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({ error: `Crypto.com Error: ${response.statusText}`, details: errorText }, { status: response.status });
        }

        const data = await response.json();

        // Check for API-level errors (custom code)
        if (data.code !== 0) {
            return NextResponse.json({ error: `Crypto.com API Error: ${data.message || 'Unknown code'}`, code: data.code }, { status: 400 });
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error", details: String(error) }, { status: 500 });
    }
}
