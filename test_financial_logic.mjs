import {
    calculateInventoryValue,
    calculateTotalReceivables,
    calculateTotalPayables,
    calculateNetWorth
} from "./src/lib/financialUtils.js";

console.log("Starting Financial Utils Verification...");

// 1. Inventory
const products = [
    { title: 'P1', stock: 10, costPrice: 100, price: 150 }, // 1000
    { title: 'P2', stock: 5, costPrice: 0, price: 200 },    // 1000 (Fallback)
    { title: 'P3', stock: -2, costPrice: 100, price: 200 }  // 0 (Negative stock)
];
const inv = calculateInventoryValue(products);
console.assert(inv === 2000, `Inventory: Expected 2000, got ${inv}`);
console.log(inv === 2000 ? "✅ Inventory Check Passed" : "❌ Inventory Check Failed");

// 2. Receivables
const clients = [
    { totalDebt: 5000 },
    { totalDebt: -100 }, // Should be ignored if negative? Or is it a credit? 
    // Logic says: (debt > 0 ? debt : 0)
    { totalDebt: 2500 }
];
const rec = calculateTotalReceivables(clients);
console.assert(rec === 7500, `Receivables: Expected 7500, got ${rec}`);
console.log(rec === 7500 ? "✅ Receivables Check Passed" : "❌ Receivables Check Failed");

// 3. Payables
const suppliers = [
    { debt: 10000 },
    { debt: 2000 }
];
const pay = calculateTotalPayables(suppliers);
console.assert(pay === 12000, `Payables: Expected 12000, got ${pay}`);
console.log(pay === 12000 ? "✅ Payables Check Passed" : "❌ Payables Check Failed");

// 4. Net Worth
// Assets = Cash(1000) + Bank(2000) + Inv(2000) + Rec(7500) = 12500
// Liabilities = Pay(12000)
// NW = 500
const nw = calculateNetWorth({
    cash: 1000,
    bank: 2000,
    inventory: inv,
    receivables: rec,
    payables: pay
});
console.assert(nw === 500, `Net Worth: Expected 500, got ${nw}`);
console.log(nw === 500 ? "✅ Net Worth Check Passed" : "❌ Net Worth Check Failed");
