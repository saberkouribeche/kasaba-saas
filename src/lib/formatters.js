/**
 * Global Currency Formatter
 * Standardizes display across the application.
 * 
 * Rules:
 * - No decimal places (Round to nearest integer)
 * - Uses "DZD" suffix
 * - Uses standard thousand separators
 * 
 * Example: 49516.8 -> "49,517 DZD"
 */
export const formatPrice = (amount) => {
    // Handle null/undefined/NaN safely
    if (amount === null || amount === undefined || isNaN(Number(amount))) {
        return '0 DZD';
    }

    const number = Number(amount);

    // Intl.NumberFormat handles rounding and thousand separators automatically
    const formattedNumber = new Intl.NumberFormat('en-US', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(number);

    return `${formattedNumber} DZD`;
};
