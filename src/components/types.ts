export interface Asset {
    id: string;
    symbol: string;
    name: string;
    quantity: number;
    price: number;
    value: number; // Converted to Display Currency
    originalValue: number; // In Original Currency
    originalCurrency: string;
    type: "stock" | "crypto";
}

export interface PortfolioData {
    totalValue: number;
    assets: Asset[];
    equityValue: number;
    cryptoValue: number;
}
