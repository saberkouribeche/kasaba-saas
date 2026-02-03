import React from 'react';

export default function ThermalTransactionReceipt({ transaction, entity, isPrintPage = false }) {
    if (!transaction || !entity) return null;

    // specific styles for the dedicated print page to ensure it's visible and centered
    const containerStyle = isPrintPage ? {
        display: 'block',
        width: '80mm',
        margin: '0 auto',
        backgroundColor: 'white',
        padding: '10px'
    } : {
        display: 'none'
    };

    const containerClass = isPrintPage
        ? "print:block text-black font-mono text-sm bg-white"
        : "hidden print:block thermal-print-only";

    const isSupplier = !!entity.role && entity.role === 'supplier'; // Or deduce from context
    // Actually, let's look at transaction structure. 
    // Supplier transactions have 'details.system' usually.
    // Restaurant transactions (general) usually just have amount/notes.

    const isInvoice = transaction.type === 'invoice' || transaction.type === 'manual_invoice';
    const isPayment = transaction.type === 'payment' || transaction.type === 'PAYMENT_RECEIVED';

    const getTitle = () => {
        if (isInvoice) return 'فاتورة / Bon';
        if (isPayment) return 'وصل دفع / Versment';
        return 'إيصال / Recu';
    };

    return (
        <>
            <div
                id="thermal-receipt"
                style={containerStyle}
                className={containerClass}
            >
                <style jsx global>{`
                /* Default: Hide completely on screen if NOT print page */
                ${!isPrintPage ? `
                .thermal-print-only {
                    display: none !important;
                }
                ` : ''}
                
                @media print {
                    /* Reset visibility for print */
                    body * { visibility: hidden; }
                    
                    /* Show ONLY the receipt */
                    #thermal-receipt, #thermal-receipt * { 
                        visibility: visible !important; 
                        display: block !important;
                    }
                    
                    #thermal-receipt {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 80mm !important; 
                        height: auto !important;
                        background: white !important;
                        z-index: 99999 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    /* Hide scrollbars just in case */
                    body { overflow: hidden; }
                }
            `}</style>

                {/* Header */}
                <div className="text-center mb-4 px-2 pt-2">
                    <h1 className="text-xl font-bold mb-1">متجر القصبة</h1>
                    <p className="text-xs">Kasaba Meat Shop</p>
                    <div className="border-b-2 border-dashed border-black my-2"></div>
                    <p className="text-lg font-bold">{getTitle()}</p>
                    <p className="text-xs mt-1">
                        {transaction.createdAt?.toDate
                            ? transaction.createdAt.toDate().toLocaleString('ar-DZ')
                            : (transaction.created_at?.toDate ? transaction.created_at.toDate().toLocaleString('ar-DZ') : new Date().toLocaleString('ar-DZ'))
                        }
                    </p>
                </div>

                {/* Entity Info */}
                <div className="px-2 mb-4 text-xs font-bold space-y-1 text-right" dir="rtl">
                    <p>السيد(ة): {entity.fullName || entity.name}</p>
                    {entity.phone && <p>الهاتف: {entity.phone}</p>}
                    {entity.location && <p>العنوان: {entity.location}</p>}
                </div>

                <div className="border-b-2 border-dashed border-black mb-2"></div>

                {/* Custom Content based on Transaction Type */}

                {/* 1. Supplier Invoice (Weights) */}
                {transaction.details && ['weight', 'weight_multi'].includes(transaction.details.system) && (
                    <div className="text-xs" dir="rtl">
                        {(transaction.details.system === 'weight_multi' ? transaction.details.groups : [transaction.details]).map((group, idx) => (
                            <div key={idx} className="mb-3 pb-2 border-b border-gray-300 last:border-0">
                                {transaction.details.system === 'weight_multi' && (
                                    <p className="font-bold underline mb-1">مجموعة #{idx + 1}</p>
                                )}
                                <div className="flex justify-between mb-1">
                                    <span>الوزن القائم:</span>
                                    <span>{Number(group.grossWeight).toLocaleString()} كغ</span>
                                </div>
                                <div className="flex justify-between mb-1">
                                    <span>التارة ({group.boxCount} صندوق):</span>
                                    <span>{group.boxTare} كغ</span>
                                </div>
                                <div className="flex justify-between mb-1 font-bold">
                                    <span>الوزن الصافي:</span>
                                    <span>{Number(group.netWeight).toLocaleString()} كغ</span>
                                </div>
                                <div className="flex justify-between mb-1">
                                    <span>سعر الكيلو:</span>
                                    <span>{Number(group.pricePerKg).toLocaleString()}</span>
                                </div>
                                {group.total && (
                                    <div className="flex justify-between mt-1 pt-1 border-t border-dotted border-gray-400 font-black">
                                        <span>المجموع:</span>
                                        <span>{Number(group.total).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* 2. Simple Items (if any) */}
                {/* Note: Standard manually added invoices might not have items array yet, but if they do: */}
                {transaction.items && transaction.items.length > 0 && (
                    <table className="w-full text-xs text-right mb-4" dir="rtl">
                        <thead>
                            <tr className="border-b border-black">
                                <th className="py-1">المنتج</th>
                                <th className="text-center">الكمية</th>
                                <th className="text-left py-1">السعر</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transaction.items.map((item, i) => (
                                <tr key={i} className="">
                                    <td className="py-1">{item.title || item.name}</td>
                                    <td className="text-center py-1">{item.quantity}</td>
                                    <td className="text-left py-1">{(item.price * item.quantity).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* 3. Notes Body */}
                {transaction.note && !['weight', 'weight_multi'].includes(transaction.details?.system) && (
                    <div className="px-2 mb-4 text-right text-xs" dir="rtl">
                        <p className="font-bold mb-1">البيان / التفاصيل:</p>
                        <p className="whitespace-pre-wrap">{transaction.note}</p>
                    </div>
                )}
                {transaction.notes && (
                    <div className="px-2 mb-4 text-right text-xs" dir="rtl">
                        <p className="font-bold mb-1">ملاحظات:</p>
                        <p className="whitespace-pre-wrap">{transaction.notes}</p>
                    </div>
                )}


                <div className="border-t-2 border-dashed border-black my-2"></div>

                {/* Totals Section */}
                <div className="space-y-1 text-xs font-bold px-2 text-right" dir="rtl">
                    <div className="flex justify-between text-lg mt-2 pt-2">
                        <span>المبلغ الإجمالي:</span>
                        <span>{Number(transaction.amount).toLocaleString()} دج</span>
                    </div>

                    {/* For Invoices: Show Payment/Remaining if exists */}
                    {(isInvoice && (transaction.paymentAmount > 0 || transaction.total_paid > 0)) && (
                        <>
                            <div className="flex justify-between mt-1">
                                <span>المدفوع:</span>
                                <span>{Math.max(transaction.paymentAmount || 0, transaction.total_paid || 0).toLocaleString()} دج</span>
                            </div>
                            <div className="flex justify-between mt-1 pt-1 border-t border-black">
                                <span>المتبقي:</span>
                                <span>{(transaction.amount - Math.max(transaction.paymentAmount || 0, transaction.total_paid || 0)).toLocaleString()} دج</span>
                            </div>
                        </>
                    )}
                </div>

                <div className="border-t-2 border-dashed border-black my-4"></div>
                <div className="text-center text-xs font-bold pb-8">
                    <p>صحتكم تهمنا</p>
                    <div className="mt-4 pt-4 border-t border-black w-1/2 mx-auto">
                        <p>التوقيع</p>
                    </div>
                </div>
            </div>
        </>
    );
}
