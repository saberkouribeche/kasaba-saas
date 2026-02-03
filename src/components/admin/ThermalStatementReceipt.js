import React from 'react';

export default function ThermalStatementReceipt({ client, transactions, currentDebt, isPrintPage = false }) {
    if (!transactions || transactions.length === 0) return null;

    // Filter only invoices to show products, payments just show amount usually?
    // User asked for "Invoice group printing", likely only Invoices will be selected.
    // If a payment is selected, we just show it as a line item.

    return (
        <div
            id="thermal-receipt"
            className={`${isPrintPage ? 'print:block' : 'hidden'} bg-white text-black font-mono text-sm`}
            style={{
                width: '80mm',
                margin: '0 auto',
                padding: '0',
                fontWeight: 'bold' // Base bold
            }}
        >
            <style jsx global>{`
                @media print {
                    @page { margin: 0; size: 80mm auto; }
                    body { margin: 0; padding: 0; }
                    #thermal-receipt { 
                        width: 100% !important;
                        position: absolute; left: 0; top: 0;
                        padding: 0 2mm !important; /* Tiny padding for safe zone */
                    }
                    .hide-on-print { display: none !important; }
                }
            `}</style>

            {/* Header */}
            <div className="text-center mb-2 border-b-2 border-black pb-1 pt-1">
                <h1 className="text-xl font-black mb-1">قصابة المسجد</h1>
                <h2 className="text-lg font-black">{client.fullName || client.name}</h2>
                <p className="text-xs font-bold mt-1">
                    {new Date().toLocaleString('ar-DZ', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
            </div>

            {/* Transactions Loop */}
            <div className="flex flex-col gap-0">
                {transactions.map((tx, idx) => (
                    <div key={tx.id} className="border-b border-black border-dashed py-1">
                        {/* Transaction Header: Date/Time */}
                        <div className="flex justify-between items-center text-xs mb-1">
                            <span>{tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                            <span className="font-black">
                                {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleDateString('ar-DZ') : ''}
                            </span>
                        </div>

                        {/* Products */}
                        {tx.items && tx.items.length > 0 ? (
                            <table className="w-full text-right text-xs" dir="rtl">
                                <tbody>
                                    {tx.items.map((item, i) => (
                                        <tr key={i}>
                                            <td className="align-top font-bold" style={{ width: '60%' }}>
                                                {item.quantity} x {item.title || item.name}
                                            </td>
                                            <td className="align-top text-left font-black" style={{ width: '40%' }}>
                                                {(item.price * item.quantity).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="text-right text-xs dir-rtl">
                                {tx.type === 'payment' ? 'دفعة / Payment' : 'فاتورة يدوية'}
                            </div>
                        )}

                        {/* Transaction Total */}
                        <div className="flex justify-between items-center mt-1 text-sm font-black bg-gray-100/50 px-1 rounded-sm">
                            <div className="text-xs">المجموع:</div>
                            <div>{Number(tx.amount).toLocaleString()}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer: Grand Total Debt */}
            <div className="mt-2 pt-2 border-t-2 border-black border-double text-center">
                <p className="text-xs font-bold mb-1">المبلغ المتبقي (الرصيد الكلي)</p>
                <h1 className="text-3xl font-black">{Number(currentDebt).toLocaleString()} <span className="text-sm">دج</span></h1>
            </div>

            <div className="text-center text-[10px] mt-2 mb-4 font-bold">
                *** شكراً لزيارتكم ***
            </div>
        </div>
    );
}
