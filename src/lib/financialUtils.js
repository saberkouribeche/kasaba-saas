/**
 * Financial Utility Functions
 * Centralizes aggregation logic for the Financial Control Tower.
 */

/**
 * Calculate Total Inventory Value
 * Sum of (costPrice * stock) for all products.
 * Falls back to sales price if costPrice is missing/zero.
 * @param {Array} products 
 * @returns {number}
 */
export const calculateInventoryValue = (products) => {
    if (!products || !Array.isArray(products)) return 0;

    return products.reduce((total, product) => {
        const stock = Number(product.stock) || 0;
        if (stock <= 0) return total; // Ignore negative/zero stock for value

        const cost = Number(product.costPrice) || 0;
        const price = Number(product.price) || 0;

        // Use cost price if available, otherwise fallback to sales price (or 0)
        // Ideally should warn if cost is missing, but for now fallback is safer for UI
        const unitValue = cost > 0 ? cost : price;

        return total + (unitValue * stock);
    }, 0);
};

/**
 * Calculate Total Receivables (Money owed TO the business)
 * Sum of totalDebt from all clients (restaurants).
 * @param {Array} clients 
 * @returns {number}
 */
export const calculateTotalReceivables = (clients) => {
    if (!clients || !Array.isArray(clients)) return 0;

    return clients.reduce((total, client) => {
        // Positive debt usually means they owe us money
        const debt = Number(client.totalDebt) || 0;
        return total + (debt > 0 ? debt : 0);
    }, 0);
};

/**
 * Calculate Total Payables (Money the business OWES)
 * Sum of debt from all suppliers.
 * @param {Array} suppliers 
 * @returns {number}
 */
export const calculateTotalPayables = (suppliers) => {
    if (!suppliers || !Array.isArray(suppliers)) return 0;

    return suppliers.reduce((total, supplier) => {
        const debt = Number(supplier.debt) || 0;
        // Verify sign convention: usually positive debt in supplier doc means we owe them
        return total + debt;
    }, 0);
};

/**
 * Calculate Net Worth
 * (Cash + Bank + Inventory + Receivables) - Payables
 */
export const calculateNetWorth = ({ cash, bank, inventory, receivables, payables }) => {
    const assets = (Number(cash) || 0) + (Number(bank) || 0) + (Number(inventory) || 0) + (Number(receivables) || 0);
    const liabilities = (Number(payables) || 0);
    return assets - liabilities;
};
