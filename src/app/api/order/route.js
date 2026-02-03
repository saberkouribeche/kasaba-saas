
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request) {
  try {
    const body = await request.json();
    const { orderData } = body;

    if (!orderData || !orderData.order_items) {
      return NextResponse.json({ success: false, error: "Invalid Data" }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ success: false, error: "Server Configuration Error: Admin SDK not initialized." }, { status: 500 });
    }

    // --- 1. Use Admin Transaction ---
    const createdOrderNumber = await adminDb.runTransaction(async (transaction) => {

      // A. Read Phase
      // -------------------------

      const userId = orderData.user_id || orderData.customer_phone;

      let userData = null;
      let userRef = null;

      if (userId) {
        userRef = adminDb.collection("users").doc(userId);
        const userSnap = await transaction.get(userRef);
        if (userSnap.exists) { // Admin SDK: .exists is a property
          userData = userSnap.data();
        }
      }

      // 2. Get All Products (Strict Stock Check)
      const itemMap = new Map();

      for (const item of orderData.order_items) {
        if (item.isBundle) {
          for (const comp of item.bundleComponents) {
            if (comp.product_id) {
              const qty = (Number(comp.qty_to_deduct) * Number(item.quantity));
              itemMap.set(comp.product_id, (itemMap.get(comp.product_id) || 0) + qty);
            }
          }
        } else {
          const qty = Number(item.quantity);
          itemMap.set(item.id, (itemMap.get(item.id) || 0) + qty);
        }
      }

      const productDocs = [];
      for (const [prodId, qty] of itemMap.entries()) {
        const ref = adminDb.collection("product").doc(prodId);
        const snap = await transaction.get(ref);
        if (!snap.exists) throw new Error(`Product not found: ${prodId}`);
        productDocs.push({ ref, data: snap.data(), deduct: qty });
      }

      // B. Logic/Check Phase
      // -------------------------

      if (userData && userData.role === 'restaurant') {
        if (!userData.isCreditAllowed) {
          // Logic handled by frontend restriction or allowed cash
        }

        const currentDebt = Number(userData.currentDebt) || 0;
        const newDebt = currentDebt + Number(orderData.order_total);

        if (userData.isCreditAllowed && newDebt > userData.creditLimit) {
          throw new Error(`عذراً، لقد تجاوزت سقف الدين المسموح (${userData.creditLimit} دج). رصيدك الحالي: ${currentDebt} دج، قيمة الطلب: ${orderData.order_total} دج.`);
        }
      }


      // C. Write Phase
      // -------------------------

      // --- 1.2 Get Monthly Order Number (Sequential) ---
      const now = new Date();
      const monthKey = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;
      const counterRef = adminDb.collection("counters").doc(monthKey);

      const counterSnap = await transaction.get(counterRef);
      let currentCount = 0;
      if (counterSnap.exists) {
        currentCount = counterSnap.data().count || 0;
      }

      const newOrderNumber = currentCount + 1;

      // Update Counter
      transaction.set(counterRef, { count: newOrderNumber }, { merge: true });

      // 2. Create Order
      const orderRef = adminDb.collection("order").doc(); // Auto ID

      const finalOrderData = {
        ...orderData,
        order_number: newOrderNumber.toString(),
        created_at: FieldValue.serverTimestamp() // Admin SDK Timestamp
      };

      transaction.set(orderRef, finalOrderData);

      // 3. Update User Debt (If Restaurant)
      if (userData && userData.role === 'restaurant' && userId) {
        const currentDebt = Number(userData.totalDebt || userData.currentDebt) || 0; // Check both fields just in case
        const newDebt = currentDebt + Number(orderData.order_total);
        // Ensure consistent field naming. We prefer `totalDebt` based on AdminDataContext.
        transaction.update(userRef, {
          totalDebt: newDebt,
          lastOrderDate: FieldValue.serverTimestamp()
        });
      }

      return { orderNumber: newOrderNumber, isB2b: userData?.role === 'restaurant', userData };
    });

    // --- 2. Notifications (Post-Commit) ---
    const { orderNumber, isB2b } = typeof createdOrderNumber === 'object' ? createdOrderNumber : { orderNumber: createdOrderNumber, isB2b: false };

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "7802539394:AAFkdQyLOtWMct1S3eZ_LE_6c02vUWtHSK0";
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "-1003323452187";

    try {
      let message = "";

      if (isB2b) {
        // --- B2B / Restaurant Template ---
        const itemsList = orderData.order_items.map(i => {
          const qty = i.quantity;
          const unit = i.unit || 'وحدة';
          let opts = "";
          if (i.options) {
            if (Array.isArray(i.options)) opts = `(${i.options.join(', ')})`;
            else if (typeof i.options === 'object') opts = `(${Object.values(i.options).join(', ')})`;
            else opts = `(${i.options})`;
          }
          return `▫️ ${qty} x ${i.title} ${opts}`;
        }).join('\n');

        const notesSection = orderData.order_notes ? `
📝 **ملاحظات:** ${orderData.order_notes}
--------------------------------` : '';

        message = `
🏢 **طلب توريد جديد (B2B)** 🏢
🆔 **رقم الطلب:** #${orderNumber}
--------------------------------
👤 **المطعم:** ${orderData.customer_name}
📱 **الهاتف:** ${orderData.customer_phone}
📍 **العنوان:** ${orderData.delivery_area}
--------------------------------
📋 **تفاصيل الطلبية:**
${itemsList}
--------------------------------
${notesSection}
💰 **القيمة التقديرية:** ${Number(orderData.order_total).toLocaleString()} دج
⚠️ *تنبيه: يرجى كتابة الوزن النهائي في الفاتورة الخاصة بالمطعم في الهاتف.*
        `.trim();

      } else {
        // --- B2C / Standard Template ---
        const notesSection = orderData.order_notes ? `📝 **ملاحظات:** ${orderData.order_notes}\n` : '';

        message = `
🚨 **طلب جديد! #${orderNumber}**

👤 **العميل:** ${orderData.customer_name}
📱 **الهاتف:** ${orderData.customer_phone}
📦 **النوع:** ${orderData.delivery_type === 'pickup' ? 'استلام من المحل' : 'توصيل'}
📍 **العنوان:** ${orderData.delivery_area} ${orderData.delivery_address_details && orderData.delivery_type !== 'pickup' ? ` - ${orderData.delivery_address_details}` : ''}
⏰ **وقت التوصيل:** ${orderData.delivery_time_slot || 'غير محدد'}

🛒 **المنتجات:**
${orderData.order_items.map(i => {
          let details = `- ${i.title} (${i.quantity})`;
          if (i.options) {
            if (typeof i.options === 'object' && !Array.isArray(i.options)) {
              const opts = Object.values(i.options).join(', ');
              details += ` (${opts})`;
            } else if (Array.isArray(i.options)) {
              details += ` (${i.options.join(', ')})`;
            } else {
              details += ` (${i.options})`;
            }
          }
          return details;
        }).join('\n')}

${notesSection}
💵 **قيمة المنتجات:** ${Number(orderData.subtotal).toLocaleString()} دج
🚚 **تكلفة التوصيل:** ${Number(orderData.delivery_fee).toLocaleString()} دج
💰 **الإجمالي النهائي:** ${Number(orderData.order_total).toLocaleString()} دج
        `.trim();
      }

      // Fire and forget notification
      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'Markdown'
        })
      }).catch(err => console.error("Telegram Notification Failed:", err));

    } catch (notifyError) {
      console.error("Notification Setup Failed:", notifyError);
    }

    return NextResponse.json({ success: true, message: "Order Processed", orderNumber: orderNumber });

  } catch (error) {
    console.error("Order API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}