/**
 * Client and Trailer Configuration
 * Single source of truth for all client options and their corresponding trailers
 * Used across: WorkOrdersTable, FinishedWorkOrdersSearch, ReceiveInventory, WorkOrderForm
 */

export const BILL_TO_CO_OPTIONS = [
  "JETSHO",
  "PRIGRE",
  "GABGRE",
  "GALGRE",
  "RAN100",
  "JCGLOG",
  "JGTBAK",
  "VIDBAK",
  "JETGRE",
  "ALLSAN",
  "AGMGRE",
  "TAYRET",
  "TRUSAL",
  "BRAGON",
  "FRESAL",
  "SEBSOL",
  "LFLCOR",
  "GARGRE",
  "MCCGRE",
  "LAZGRE",
  "MEJADE",
  "CHUSAL"
];

/**
 * Get all trailer options for a given client
 * @param billToCo - Client code (e.g., "GALGRE", "JETGRE")
 * @returns Array of trailer identifiers
 */
export function getTrailerOptions(billToCo: string): string[] {
  if (billToCo === "GALGRE") {
    const especiales = [
      "1-100 TRK",
      "1-103 TRK",
      "1-101 TRK",
      "1-102 TRK",
      "1-105 TRK",
      "1-106 TRK",
      "1-107 TRK",
      "1-111 TRK"
    ];
    const normales = Array.from({length: 54}, (_, i) => `1-${100+i}`);
    return [...especiales, ...normales];
  }
  if (billToCo === "JETGRE") {
    const especiales = ["2-01 TRK"];
    const normales = Array.from({length: 16}, (_, i) => `2-${(i+1).toString().padStart(3, '0')}`);
    return [...especiales, ...normales];
  }
  if (billToCo === "PRIGRE") return Array.from({length: 24}, (_, i) => `3-${(300+i).toString()}`);
  if (billToCo === "RAN100") return Array.from({length: 20}, (_, i) => `4-${(400+i).toString()}`);
  if (billToCo === "GABGRE") return Array.from({length: 30}, (_, i) => `5-${(500+i).toString()}`);
  return [];
}

/**
 * Get trailer options with a pending indicator (🔔) for trailers with pending parts
 * @param billToCo - Client code
 * @param trailersWithPending - Array of trailer codes that have pending parts
 * @returns Array of trailer options with indicators
 */
export function getTrailerOptionsWithPendingIndicator(
  billToCo: string,
  trailersWithPending: string[]
): string[] {
  const baseOptions = getTrailerOptions(billToCo);
  return baseOptions.map(trailer => {
    const hasPending = trailersWithPending.includes(trailer);
    return hasPending ? `${trailer} 🔔` : trailer;
  });
}
