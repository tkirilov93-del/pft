# Investment Portfolio Tracker

A secure, private, and modern web application for tracking your stock and crypto investments in real-time. Built with Next.js 15.

## 🚀 Features

-   **Real-Time Tracking**: view your total net worth, updated live.
-   **Privacy First**: Your API keys are encrypted with AES and stored **locally** on your device. Nothing is sent to our servers.
-   **Multi-Asset Support**: Track Stocks (via Trading212) and Crypto (via Crypto.com) in one place.
-   **Currency Toggle**: Instantly switch your dashboard view between **USD** and **EUR**.
-   **Historical Data**: Automatically tracks and visualizes your portfolio value over time.
-   **Smart Caching**: Minimizes API usage with intelligent caching and stale data fallback.

## 🛠️ Tech Stack

-   **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
-   **Charts**: [Recharts](https://recharts.org/)
-   **Icons**: [Lucide React](https://lucide.dev/)
-   **Encryption**: [CryptoJS](https://github.com/brix/crypto-js)

## 🔌 API Services

This application integrates with several services to provide data:

| Service | Purpose | Notes |
| :--- | :--- | :--- |
| **Trading212** | Stock Portfolio Data | Requires API Key (Read-only recommended) |
| **Crypto.com** | Crypto Portfolio Data | Requires API Key & Secret |
| **Frankfurter** | FX Rates (EUR/USD) | Open Source API, no key required |
| **Logo.dev** | Stock Ticker Logos | Uses public key |
| **Coincap.io** | Crypto Icon Assets | For displaying crypto logos |

## 🔒 Security & Privacy

This application is designed with a "Local Vault" architecture:

1.  **Client-Side Encryption**: Your API keys are encrypted using a PIN you create.
2.  **Local Storage**: The encrypted vault is stored in your browser's `localStorage`.
3.  **No Backend Storage**: We do not have a database. Your keys never leave your device unencrypted.
4.  **Proxied Requests**: API requests are proxied through the Next.js API routes solely to avoid CORS issues and securely append headers.

## 📦 Getting Started

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/portfolio-tracker.git
    cd portfolio-tracker
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    # or
    pnpm install
    ```

3.  **Run the development server**:
    ```bash
    npm run dev
    ```

4.  **Open the App**:
    Navigate to [http://localhost:3000](http://localhost:3000).

5.  **Setup Keys**:
    -   You will be prompted to create a PIN.
    -   Enter your **Trading212** API Key.
    -   Enter your **Crypto.com** Exchange API Key & Secret.
    -   (Optional) The **Logo.dev** key is pre-configured.

## ⚠️ Disclaimer

This is a personal project. Use at your own risk. Always use **Read-Only** API keys where possible to ensure the security of your funds.
