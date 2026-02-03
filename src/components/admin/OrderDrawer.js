"use client";
import { useState, useEffect } from 'react';
import { X, Save, Trash2, Plus, Minus, Printer, Truck, DollarSign } from 'lucide-react';
import { updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { notify } from '@/lib/notify';
import { ThermalReceipt } from '@/components/print/ThermalReceipt';
import { useReactToPrint } from 'react-to-print';
import { useRef } from 'react';
import { useOrderEditor } from '@/hooks/useOrderEditor';

export default function OrderDrawer({ isOpen, onClose, order, onUpdate }) {
    const [formData, setFormData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Print Logic
    const printRef = useRef();
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Receipt-${order?.order_number || 'new'}`
    });

    useEffect(() => {
        if (order) {
            setFormData(JSON.parse(JSON.stringify(order))); // Deep copy
        } else {
            setFormData(null);
        }
    }, [order]);

    if (!isOpen || !formData) return null;

    const handleUpdateItem = (index, field, value) => {
        const newItems = [...formData.order_items];
        newItems[index][field] = value;

        // Recalculate item total if price/qty changes
        if (field === 'quantity' || field === 'price') {
            const qty = Number(newItems[index].quantity || 0);
            const price = Number(newItems[index].price || 0);
            newItems[index].total_price = qty * price;
        }

        setFormData({ ...formData, order_items: newItems });
    };

    const handleRemoveItem = (index) => {
        const newItems = formData.order_items.filter((_, i) => i !== index);
        setFormData({ ...formData, order_items: newItems });
    };

    const handleStatusChange = (e) => {
        setFormData({ ...formData, order_status: e.target.value });
    };

    // Derived Totals
    const subtotal = formData.order_items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
    const deliveryFee = Number(formData.delivery_fee || 0);
    const discount = Number(formData.discount || 0);
    const total = subtotal + deliveryFee - discount;

    const { saveChanges, saving: isSavingHook } = useOrderEditor();

    const handleSave = async () => {
        setLoading(true);
        try {
            // Prepare new data
            const newOrderData = {
                ...formData,
                order_total: total,
                // Ensure number types
                delivery_fee: Number(formData.delivery_fee || 0),
                discount: Number(formData.discount || 0),
            };

            // Call Atomic Hook ('order' collection)
            await saveChanges(order.id, order, newOrderData, 'order');

            notify.success("تم تحديث الطلب بنجاح");
            onUpdate();
            onClose();
        } catch (error) {
            console.error(error);
            notify.error(error.message || "فشل حفظ التعديلات");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (await notify.confirm("هل أنت متأكد من حذف هذا الطلب؟")) {
            try {
                await deleteDoc(doc(db, 'order', order.id));
                notify.success("تم حذف الطلب");
                onUpdate();
                onClose();
            } catch (error) {
                notify.error("فشل الحذف");
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm animate-in fade-in">
            {/* Drawer Container */}
            <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-black text-slate-800">طلب #{formData.order_number}</h2>
                            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                                {new Date(formData.created_at?.seconds * 1000).toLocaleDateString('ar-DZ')}
                            </span>
                        </div>
                        <p className="text-sm font-bold text-slate-500 mt-1">{formData.customer_name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                        <X size={24} />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Status Card */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">حالة الطلب</label>
                        <div className="relative">
                            <select
                                value={formData.order_status}
                                onChange={handleStatusChange}
                                className={`w-full p-3 rounded-xl font-bold appearance-none outline-none border-2 transition
                                    ${formData.order_status === 'pending' ? 'bg-amber-50 border-amber-200 text-amber-700' : ''}
                                    ${formData.order_status === 'processing' ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}
                                    ${formData.order_status === 'shipped' ? 'bg-purple-50 border-purple-200 text-purple-700' : ''}
                                    ${formData.order_status === 'delivered' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : ''}
                                    ${formData.order_status === 'cancelled' ? 'bg-rose-50 border-rose-200 text-rose-700' : ''}
                                `}
                            >
                                <option value="pending">⏳ قيد الانتظار</option>
                                <option value="processing">⚙️ جاري التجهيز</option>
                                <option value="shipped">🚚 تم الشحن (في الطريق)</option>
                                <option value="delivered">✅ تم التوصيل</option>
                                <option value="cancelled">❌ ملغي</option>
                            </select>
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div className="flex gap-4 items-start bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                            <Truck size={20} />
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-bold text-slate-800">معلومات التوصيل</div>
                            <div className="text-xs text-slate-500 mt-1 font-medium">{formData.delivery_address || 'استلام من المحل'}</div>
                            <div className="text-xs text-slate-500 mt-1 font-bold ltr">{formData.customer_phone}</div>
                            {formData.notes && (
                                <div className="mt-2 bg-yellow-50 text-yellow-700 p-2 rounded-lg text-xs font-bold">
                                    ملاحظة: {formData.notes}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Items List */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-slate-800">المنتجات ({formData.order_items.length})</h3>
                        </div>
                        <div className="space-y-3">
                            {formData.order_items.map((item, idx) => (
                                <div key={idx} className="flex gap-3 items-center bg-white border border-slate-100 p-3 rounded-xl shadow-sm group">
                                    <div className="flex-1">
                                        <div className="text-sm font-bold text-slate-800">{item.title}</div>
                                        <div className="text-xs text-slate-400">{item.price} دج</div>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1">
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                                            className="w-10 text-center bg-transparent font-bold text-sm outline-none"
                                        />
                                        <span className="text-[10px] text-slate-400 font-bold">كجم</span>
                                    </div>
                                    <div className="font-bold text-slate-800 text-sm">
                                        {(item.quantity * item.price).toLocaleString()}
                                    </div>
                                    <button onClick={() => handleRemoveItem(idx)} className="text-slate-300 hover:text-red-500 p-1">
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Financials */}
                    <div className="space-y-2 border-t border-dashed border-slate-200 pt-4">
                        <div className="flex justify-between text-sm text-slate-500 font-bold">
                            <span>المجموع الفرعي</span>
                            <span>{subtotal.toLocaleString()} دج</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-500 font-bold">
                            <span>التوصيل</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={formData.delivery_fee || 0}
                                    onChange={(e) => setFormData({ ...formData, delivery_fee: Number(e.target.value) })}
                                    className="w-16 text-right bg-slate-50 rounded px-1 outline-none focus:bg-slate-100"
                                />
                                <span>دج</span>
                            </div>
                        </div>
                        <div className="flex justify-between text-lg font-black text-slate-800 pt-2 border-t border-slate-100 mt-2">
                            <span>الإجمالي</span>
                            <span>{total.toLocaleString()} دج</span>
                        </div>
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3 flex-shrink-0">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition disabled:opacity-50"
                    >
                        {loading ? 'جاري الحفظ...' : <><Save size={18} /> حفظ التغييرات</>}
                    </button>
                    <button
                        onClick={() => handlePrint()}
                        className="bg-white text-slate-600 border border-slate-200 px-4 rounded-xl hover:bg-slate-50 transition"
                        title="طباعة"
                    >
                        <Printer size={20} />
                    </button>
                    <button
                        onClick={handleDelete}
                        className="bg-red-50 text-red-600 px-4 rounded-xl hover:bg-red-100 transition"
                        title="حذف الطلب"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>

            {/* Hidden Receipt for Printing */}
            <div style={{ display: 'none' }}>
                <ThermalReceipt ref={printRef} transaction={order} items={formData.order_items} />
            </div>
        </div>
    );
}
