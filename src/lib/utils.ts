import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cleanTicker(ticker: string): string {
  if (ticker.includes("_US_EQ")) {
    return ticker.split("_")[0];
  }
  // If it contains a generic underscore (and not US_EQ matched above)
  // Remove the suffix (last char) from the left part.
  // Logic: "ASMLa_EQ" -> split("_") -> "ASMLa","EQ". "ASMLa" -> remove last -> "ASML"
  // Wait, the user said: "if the string contains only one _ then it should show the string to the left of the _ minus the last symbol"
  if (ticker.includes("_")) {
    const parts = ticker.split("_");
    if (parts.length >= 1) {
      const leftSide = parts[0];
      if (leftSide.length > 0) {
        return leftSide.slice(0, -1);
      }
    }
  }
  return ticker;
}
