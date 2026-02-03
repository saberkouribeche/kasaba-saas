export default function ThermalReceipt({ order, formData, subtotal, total, isPrintPage = false }) {
    if (!order || !formData) return null;

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

    return (
        <>
            {/* FORCE HIDDEN ON SCREEN with !important inline styles and off-screen positioning */}
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
                <div className="text-center mb-4 px-2 pt-2">
                    <h1 className="text-xl font-bold mb-1">متجر القصبة</h1>
                    <p className="text-xs">Kasaba Meat Shop</p>
                    <div className="border-b-2 border-dashed border-black my-2"></div>
                    <p className="text-lg font-bold">طلب رقم #{order.order_number}</p>
                    <p className="text-xs mt-1">{new Date().toLocaleString('ar-DZ')}</p>
                </div>

                <div className="px-2 mb-4 text-xs font-bold space-y-1 text-right" dir="rtl">
                    <p>العميل: {formData.customerName}</p>
                    <p>الهاتف: {formData.customerPhone}</p>
                    <p>العنوان: {formData.deliveryArea} - {formData.addressDetails}</p>
                </div>

                <div className="border-b-2 border-dashed border-black mb-2"></div>

                <table className="w-full text-xs text-right mb-4" dir="rtl">
                    <thead>
                        <tr className="border-b border-black">
                            <th className="py-1">المنتج</th>
                            <th className="text-center">الكمية</th>
                            <th className="text-left py-1">السعر</th>
                        </tr>
                    </thead>
                    <tbody>
                        {formData.items.map((item, i) => (
                            <tr key={i} className="">
                                <td className="py-2 align-top">
                                    <div className="font-bold">{item.title}</div>
                                    {item.options && (
                                        <div className="text-[10px] font-normal">
                                            ({Array.isArray(item.options)
                                                ? item.options.join(', ')
                                                : typeof item.options === 'object'
                                                    ? Object.values(item.options).join(', ')
                                                    : item.options
                                            })
                                        </div>
                                    )}
                                </td>
                                <td className="text-center align-top pt-2 font-bold">{item.quantity}</td>
                                <td className="text-left align-top pt-2 font-bold">{(item.price * item.quantity).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="border-t-2 border-dashed border-black my-2"></div>

                <div className="space-y-1 text-xs font-bold px-2 text-right" dir="rtl">
                    <div className="flex justify-between">
                        <span>المجموع:</span>
                        <span>{subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>التوصيل:</span>
                        <span>{formData.deliveryFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-lg mt-2 pt-2 border-t border-black">
                        <span>الإجمالي:</span>
                        <span>{total.toLocaleString()} دج</span>
                    </div>
                </div>

                <div className="border-t-2 border-dashed border-black my-4"></div>
                <div className="text-center text-xs font-bold pb-8">
                    <p>شكراً لطلبكم من القصبة!</p>
                    <p className="mt-1">صحتكم تهمنا</p>
                </div>
            </div>
        </>
    );
}
