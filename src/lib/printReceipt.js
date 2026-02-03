export const printReceipt = (order) => {
    const popupWin = window.open('', '_blank', 'width=400,height=600');
    if (!popupWin) {
        alert("Please allow popups to print receipts");
        return;
    }

    const itemsHtml = order.order_items.map(item => `
        <div class="row" style="margin-bottom: 4px;">
            <span style="flex: 1;">${item.title}</span>
        </div>
        <div class="row" style="margin-bottom: 8px; font-size: 11px; color: #555;">
            <span>${item.quantity} x ${Number(item.price).toLocaleString()}</span>
            <span class="bold">${(item.quantity * item.price).toLocaleString()}</span>
        </div>
    `).join('');

    const date = order.created_at?.toDate
        ? order.created_at.toDate().toLocaleString('ar-DZ')
        : new Date().toLocaleString('ar-DZ');

    const html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <title>Receipt #${order.order_number}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
            body { 
                font-family: 'Cairo', sans-serif; 
                width: 76mm; 
                margin: 0 auto; 
                padding: 10px; 
                color: #000;
                font-size: 12px;
                line-height: 1.4;
            }
            .header { text-align: center; margin-bottom: 15px; }
            .logo { font-size: 20px; font-weight: 900; margin-bottom: 5px; }
            .subtitle { font-size: 10px; color: #555; }
            .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; align-items: center; }
            .bold { font-weight: 900; }
            .center { text-align: center; }
            .total-row { font-size: 16px; margin-top: 10px; }
            .footer { margin-top: 20px; text-align: center; font-size: 10px; }
            
            @media print {
                @page { margin: 0; size: 80mm auto; }
                body { padding: 0; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">KASABA</div>
            <div class="subtitle">خدمة التوصيل السريع</div>
            <div style="margin-top: 5px; font-weight: bold;">طلب #${order.order_number}</div>
            <div style="font-size: 10px;">${date}</div>
        </div>

        <div class="divider"></div>

        <div style="margin-bottom: 10px;">
            <div class="bold">العميل: ${order.customer_name}</div>
            <div>${order.customer_phone || '-'}</div>
            <div style="font-size: 11px;">${order.delivery_area || ''} - ${order.delivery_address_details || ''}</div>
        </div>

        <div class="divider"></div>

        <div class="row bold" style="margin-bottom: 5px;">
            <span>المنتج</span>
            <span>الإجمالي</span>
        </div>

        ${itemsHtml}

        <div class="divider"></div>

        <div class="row">
            <span>المجموع:</span>
            <span>${(Number(order.order_total) - Number(order.delivery_fee || 0)).toLocaleString()}</span>
        </div>
        <div class="row">
            <span>التوصيل:</span>
            <span>${Number(order.delivery_fee || 0).toLocaleString()}</span>
        </div>
        
        <div class="divider"></div>

        <div class="row total-row bold">
            <span>الإجمالي النهائي:</span>
            <span>${Number(order.order_total).toLocaleString()} دج</span>
        </div>

        <div class="footer">
            شكراً لثقتكم بنا!<br>
        </div>
        
        <script>
            window.onload = function() { window.print(); window.close(); }
        </script>
    </body>
    </html>
    `;

    popupWin.document.write(html);
    popupWin.document.close();
};
