/**
 * System Configuration
 * Centralized settings for the application.
 */

export const CONFIG = {
    // Inventory
    ALLOW_NEGATIVE_STOCK: false, // If false, transactions fail when stock < 0
    ENABLE_STOCK_TRACKING: true, // Master switch
    ENABLE_INVENTORY_MANAGEMENT: false, // Set to FALSE to hide/disable all stock logic

    // Treasury
    ENABLE_TREASURY_LOGGING: true, // If true, invoices update treasury when paid
};
