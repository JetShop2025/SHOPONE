/**
 * Part/SKU Helper Functions
 * Utilities for working with parts and SKU lookups
 */

/**
 * Find a part in inventory by SKU
 * @param sku - Part SKU code
 * @param inventory - Inventory array
 * @returns Part object or undefined
 */
export const findPartBySku = (sku: string, inventory: any[]): any => {
  if (!sku || !inventory || inventory.length === 0) return undefined;
  
  const cleanSku = String(sku || '').trim().toUpperCase();
  return inventory.find((item: any) =>
    String(item.sku || '').trim().toUpperCase() === cleanSku
  );
};

/**
 * Get part description from inventory or order part
 * @param orderPart - Part from work order
 * @param inventory - Inventory array
 * @returns Part description string
 */
export const getPartDescription = (orderPart: any, inventory: any[]): string => {
  if (!orderPart) return 'N/A';
  
  // Try custom name first
  if (orderPart.part) return orderPart.part;
  if (orderPart.part_name) return orderPart.part_name;
  if (orderPart.description) return orderPart.description;
  
  // Check inventory
  const inventoryPart = findPartBySku(orderPart.sku, inventory);
  return inventoryPart?.part || inventoryPart?.description || 'N/A';
};

/**
 * Get unit of measure (UM) for a part
 * @param orderPart - Part from work order
 * @param inventoryPart - Inventory part object
 * @returns Unit of measure string
 */
export const getPartUM = (orderPart: any, inventoryPart?: any): string => {
  // Saved UM has priority
  if (orderPart?.um) return orderPart.um;
  if (inventoryPart?.um) return inventoryPart.um;
  if (inventoryPart?.uom) return inventoryPart.uom;
  if (inventoryPart?.unit) return inventoryPart.unit;
  return 'EA';
};

/**
 * Validate SKU format
 * @param sku - SKU to validate
 * @returns True if SKU is valid
 */
export const isValidSku = (sku: string): boolean => {
  return typeof sku === 'string' && sku.trim().length > 0;
};

/**
 * Calculate total cost for a part
 * @param quantity - Quantity used
 * @param unitCost - Cost per unit
 * @returns Total cost
 */
export const calculatePartTotal = (quantity: number, unitCost: number): number => {
  const qty = Number(quantity) || 0;
  const cost = Number(unitCost) || 0;
  return qty * cost;
};

/**
 * Normalize part data from different sources
 * @param part - Part object
 * @param inventory - Inventory array for lookups
 * @returns Normalized part object
 */
export const normalizePart = (part: any, inventory: any[] = []): any => {
  const inventoryPart = findPartBySku(part.sku, inventory);
  
  return {
    sku: String(part.sku || '').trim(),
    part: getPartDescription(part, inventory),
    um: getPartUM(part, inventoryPart),
    qty: Number(part.qty_used ?? part.qty) || 0,
    cost: Number(String(part.cost || 0).replace(/[^0-9.]/g, '')) || 0,
    invoiceLink: part.invoiceLink || part.invoice_link || null
  };
};
