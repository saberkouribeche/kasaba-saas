import React from 'react';

/**
 * Thermal Receipt Component
 * Designed for 80mm standard POS printers.
 * Uses inline styles to ensure perfect printing without external CSS dependencies affecting it.
 */
export const ThermalReceipt = React.forwardRef(({ transaction, items = [] }, ref) => {
    // Fallback if no transaction data
    if (!transaction) return null;

    const receiptDate = transaction.formattedDate
        ? new Date(transaction.formattedDate).toLocaleString('ar-DZ')
        : new Date().toLocaleString('ar-DZ');

    return (
        <div ref={ref} style={{
            width: '80mm',
            padding: '10px',
            fontSize: '12px',
            fontFamily: 'monospace',
            backgroundColor: '#fff',
            color: '#000',
            direction: 'rtl'
        }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '10px', borderBottom: '1px dashed #000', paddingBottom: '10px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 5px 0' }}>قصابة البركة</h2>
                <p style={{ margin: '2px 0' }}>حي السلام، الجزائر العاصمة</p>
                <p style={{ margin: '2px 0' }}>هاتف: 0555-123-456</p>
            </div>

            {/* Meta */}
            <div style={{ marginBottom: '10px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>التاريخ:</span>
                    <span>{receiptDate}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>العميل:</span>
                    <span>{transaction.userName || 'زبون عام'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>رقم الوصل:</span>
                    <span>#{transaction.id ? transaction.id.slice(-6).toUpperCase() : '---'}</span>
                </div>
            </div>

            {/* Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid #000' }}>
                        <th style={{ textAlign: 'right', padding: '5px 0' }}>المنتج</th>
                        <th style={{ textAlign: 'center', padding: '5px 0' }}>ك</th>
                        <th style={{ textAlign: 'left', padding: '5px 0' }}>المجموع</th>
                    </tr>
                </thead>
                <tbody>
                    {/* If transaction has order_items, use them. Else if passed locally, use them. */}
                    {(transaction.order_items || items).map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px dashed #ddd' }}>
                            <td style={{ padding: '4px 0', verticalAlign: 'top' }}>
                                <div style={{ fontWeight: 'bold' }}>{item.name || item.title}</div>
                                <div style={{ fontSize: '10px', color: '#555' }}>{Number(item.price).toLocaleString()} دج</div>
                            </td>
                            <td style={{ textAlign: 'center', padding: '4px 0', verticalAlign: 'top' }}>
                                {item.quantity}
                            </td>
                            <td style={{ textAlign: 'left', padding: '4px 0', verticalAlign: 'top', fontWeight: 'bold' }}>
                                {(Number(item.price) * Number(item.quantity)).toLocaleString()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals */}
            <div style={{ borderTop: '2px solid #000', paddingTop: '5px', marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
                    <span>المجموع الكلي:</span>
                    <span>{Number(transaction.amount).toLocaleString()} دج</span>
                </div>
                {transaction.paidAmount > 0 && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>المدفوع:</span>
                            <span>{Number(transaction.paidAmount).toLocaleString()} دج</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>الباقي:</span>
                            <span>{Number(transaction.remainingAmount || 0).toLocaleString()} دج</span>
                        </div>
                    </>
                )}
            </div>

            {/* Footer */}
            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '10px', borderTop: '1px dashed #000', paddingTop: '10px' }}>
                <p>شكراً لزيارتكم!</p>
                <p>تطوير برمجيات قصابة</p>
            </div>
        </div>
    );
});

ThermalReceipt.displayName = 'ThermalReceipt';
