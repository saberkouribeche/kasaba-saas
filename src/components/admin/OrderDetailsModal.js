"use client";
import { useState, useEffect } from "react";
import { X, Save, Printer, MapPin, Phone, User, Package, Truck, Trash2, Plus, Search, Check, Edit2, Clock, Calendar, ArrowLeft, Wallet, Banknote, MessageCircle, Loader2 } from "lucide-react";
import PaymentModal from "./PaymentModal";
import { db } from "@/lib/firebase";
import { doc, updateDoc, collection, getDocs, orderBy, query } from "firebase/firestore";
import { notify } from "@/lib/notify";
import ThermalReceipt from "./ThermalReceipt";

export default function OrderDetailsModal({ isOpen, onClose, order, onOrderUpdated }) {
    // Mode
    const [isEditing, setIsEditing] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    // Order State
    const [formData, setFormData] = useState({
        customerName: "",
        customerPhone: "",
        deliveryArea: "",
        addressDetails: "",
        items: [],
        deliveryFee: 0,
        status: "",
        notes: ""
    });

    // Product Search State
    const [availableProducts, setAvailableProducts] = useState([]);
    const [productSearch, setProductSearch] = useState("");
    const [showProductSearch, setShowProductSearch] = useState(false);

    const [loading, setLoading] = useState(false);

    // Initialize Data
    useEffect(() => {
        if (order) {
            setFormData({
                customerName: order.customer_name || "",
                customerPhone: order.customer_phone || "",
                deliveryArea: order.delivery_area || "",
                addressDetails: order.address || order.delivery_address_details || "",
                deliveryTime: order.delivery_time_slot || "", // Init delivery time
                items: order.order_items ? [...order.order_items] : (order.items ? [...order.items] : []), // Clone to avoid mutation refs
                deliveryFee: Number(order.delivery_fee || order.delivery_price || 0),
                status: order.order_status || "pending",
                notes: order.order_notes || order.notes || ""
            });
            setIsEditing(false); // Reset to view mode on open
        }
    }, [order, isOpen]);

    // Fetch Products for "Add Item" functionality
    useEffect(() => {
        if (isEditing && availableProducts.length === 0) {
            const fetchProducts = async () => {
                const q = query(collection(db, "product"), orderBy("title"));
                const snapshot = await getDocs(q);
                setAvailableProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            };
            fetchProducts();
        }
    }, [isEditing]);

    if (!isOpen || !order) return null;

    // Calculations
    const calculateSubtotal = () => {
        return formData.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    };

    const subtotal = calculateSubtotal();
    const total = subtotal + formData.deliveryFee;

    // Handlers
    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;
        setFormData({ ...formData, items: newItems });
    };

    const handleDeleteItem = async (index) => {
        if (await notify.confirm("حذف المنتج؟", "هل أنت متأكد من حذف هذا المنتج من الطلب؟")) {
            const newItems = formData.items.filter((_, i) => i !== index);
            setFormData({ ...formData, items: newItems });
        }
    };

    const handleAddProduct = (product) => {
        const newItem = {
            id: product.id,
            title: product.title,
            price: Number(product.price),
            quantity: 1, // Default qty
            options: [] // Default options
        };
        // Add as NEW item (Separate Line) - Standard behavior for editing here
        setFormData({
            ...formData,
            items: [...formData.items, newItem]
        });
        setShowProductSearch(false);
        setProductSearch("");
        notify.success("تم إضافة المنتج");
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const orderRef = doc(db, "order", order.id);

            const updates = {
                customer_name: formData.customerName,
                customer_phone: formData.customerPhone,
                delivery_area: formData.deliveryArea,
                delivery_address_details: formData.addressDetails,
                delivery_time_slot: formData.deliveryTime, // Save delivery time
                order_items: formData.items,
                delivery_fee: Number(formData.deliveryFee),
                delivery_price: Number(formData.deliveryFee), // Keep both for legacy compat
                order_total: total,
                order_status: formData.status,
                order_notes: formData.notes
            };

            await updateDoc(orderRef, updates);
            notify.success("تم تحديث الطلب بنجاح");
            setIsEditing(false);
            if (onOrderUpdated) onOrderUpdated();
        } catch (error) {
            console.error("Update Error:", error);
            notify.error("فشل التحديث: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Filter Products
    const filteredProducts = availableProducts.filter(p =>
        p.title.toLowerCase().includes(productSearch.toLowerCase())
    ).slice(0, 5); // Limit limit to 5 suggestions

    // Status Helper
    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'processing': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'shipped': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'delivered': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'pending': return 'قيد الانتظار';
            case 'processing': return 'جاري التجهيز';
            case 'shipped': return 'خرج للتوصيل';
            case 'delivered': return 'تم التسليم';
            case 'cancelled': return 'ملغى';
            default: return status;
        }
    };

    // Quick Actions Handler
    const handleStatusUpdate = async (newStatus) => {
        if (!await notify.confirm("تحديث الحالة", "هل أنت متأكد من تغيير حالة الطلب؟")) return;

        setLoading(true);
        try {
            const orderRef = doc(db, "order", order.id);
            await updateDoc(orderRef, { order_status: newStatus });
            setFormData(prev => ({ ...prev, status: newStatus }));
            notify.success("تم تحديث الحالة بنجاح");
            if (onOrderUpdated) onOrderUpdated();
        } catch (error) {
            console.error("Status Update Error:", error);
            notify.error("حدث خطأ");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

                {/* Main Card */}
                <div className="relative z-10 w-full max-w-4xl bg-white rounded-[24px] shadow-2xl flex flex-col overflow-hidden max-h-[90vh] ring-1 ring-slate-900/5 font-cairo">

                    {/* 1. Header (Status Bar) */}
                    <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center z-20">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                {order.source === 'tx' ? "فاتورة يدوية" : `الطلب #${order.order_number || order.code || '---'}`}
                            </h2>
                            <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1">
                                <Clock size={12} />
                                {order.created_at?.toDate ? order.created_at.toDate().toLocaleString('ar-DZ') : '---'}
                            </p>
                        </div>
                        <div className={`px-4 py-1.5 rounded-full text-xs font-black border ${getStatusColor(formData.status)} uppercase tracking-wider`}>
                            {getStatusLabel(formData.status)}
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 custom-scrollbar">

                        {/* 2. Info Grid (3 Columns) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

                            {/* Card A: Customer */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                                        <User size={18} />
                                    </div>
                                    <span className="text-xs font-black text-slate-400 uppercase">الزبون</span>
                                </div>
                                <div className="space-y-1">
                                    {isEditing ? (
                                        <input
                                            value={formData.customerName}
                                            onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                                            className="w-full text-sm font-bold border-b border-slate-200 focus:border-blue-500 outline-none"
                                            placeholder="اسم الزبون"
                                        />
                                    ) : (
                                        <h3 className="font-bold text-slate-800 text-sm">{formData.customerName || "زبون زائر"}</h3>
                                    )}

                                    {isEditing ? (
                                        <input
                                            value={formData.customerPhone}
                                            onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                                            className="w-full text-xs text-slate-500 font-mono border-b border-slate-200 focus:border-blue-500 outline-none dir-ltr"
                                            placeholder="رقم الهاتف"
                                        />
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500 font-mono font-bold bg-slate-100 px-2 py-0.5 rounded">{formData.customerPhone || "---"}</span>
                                            {formData.customerPhone && (
                                                <a href={`https://wa.me/${formData.customerPhone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-green-500 hover:text-green-600">
                                                    <MessageCircle size={14} />
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Card B: Delivery */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="bg-orange-50 text-orange-600 p-2 rounded-lg">
                                        <Truck size={18} />
                                    </div>
                                    <span className="text-xs font-black text-slate-400 uppercase">التوصيل</span>
                                </div>
                                <div className="space-y-1">
                                    {isEditing ? (
                                        <input
                                            value={formData.deliveryArea}
                                            onChange={e => setFormData({ ...formData, deliveryArea: e.target.value })}
                                            className="w-full text-sm font-bold border-b border-slate-200 focus:border-orange-500 outline-none"
                                            placeholder="المنطقة"
                                        />
                                    ) : (
                                        <h3 className="font-bold text-slate-800 text-sm truncate">{formData.deliveryArea || "الاستلام من المحل"}</h3>
                                    )}

                                    {isEditing ? (
                                        <input
                                            value={formData.deliveryTime}
                                            onChange={e => setFormData({ ...formData, deliveryTime: e.target.value })}
                                            className="w-full text-xs text-slate-500 font-mono border-b border-slate-200 focus:border-orange-500 outline-none dir-ltr"
                                            placeholder="الوقت"
                                        />
                                    ) : (
                                        <div className="text-xs text-slate-500 font-bold flex items-center gap-1">
                                            <Clock size={10} />
                                            {formData.deliveryTime || "وقت غير محدد"}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Card C: Payment */}
                            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md text-white">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="bg-white/10 text-emerald-400 p-2 rounded-lg">
                                        <Banknote size={18} />
                                    </div>
                                    <span className="text-xs font-black text-slate-400 uppercase">الدفع</span>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center text-xs text-slate-400 font-bold">
                                        <span>التوصيل:</span>
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                value={formData.deliveryFee}
                                                onChange={e => setFormData({ ...formData, deliveryFee: Number(e.target.value) })}
                                                className="w-12 bg-white/10 border-none rounded text-white text-right p-0.5 text-xs"
                                            />
                                        ) : (
                                            <span>{Number(formData.deliveryFee).toLocaleString()}</span>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-white/10">
                                        <span className="text-xs font-bold text-white">الإجمالي:</span>
                                        <span className="text-xl font-black text-white tracking-tight">
                                            {total.toLocaleString()} <span className="text-[10px] text-slate-400">دج</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Product List */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <h3 className="font-black text-xs text-slate-500 uppercase flex items-center gap-2">
                                    <Package size={14} /> تفاصيل الطلب ({formData.items.length})
                                </h3>
                                {isEditing && (
                                    <button onClick={() => setShowProductSearch(!showProductSearch)} className="text-xs bg-slate-900 text-white px-3 py-1 rounded-lg font-bold flex items-center gap-1">
                                        <Plus size={12} /> إضافة
                                    </button>
                                )}
                            </div>

                            {/* Product Search (Edit Mode) */}
                            {isEditing && showProductSearch && (
                                <div className="p-3 bg-slate-100 border-b border-slate-200">
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="ابحث لإضافة منتج..."
                                        className="w-full p-2 rounded-lg border border-slate-300 text-sm font-bold"
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                    />
                                    {filteredProducts.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {filteredProducts.map(p => (
                                                <div key={p.id} onClick={() => handleAddProduct(p)} className="bg-white p-2 rounded-md shadow-sm text-xs font-bold flex justify-between cursor-pointer hover:bg-blue-50">
                                                    <span>{p.title}</span>
                                                    <span>{p.price} دج</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <table className="w-full text-sm text-right">
                                <thead className="bg-slate-50 text-xs text-slate-400 font-bold border-b border-slate-100">
                                    <tr>
                                        <th className="px-5 py-3">المنتج</th>
                                        <th className="px-5 py-3 text-center">الكمية</th>
                                        <th className="px-5 py-3 text-center">السعر</th>
                                        <th className="px-5 py-3 text-center">المجموع</th>
                                        {isEditing && <th className="px-5 py-3"></th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {formData.items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition">
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-3">
                                                    {/* Thumbnail if available, else placeholder icon */}
                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300">
                                                        {item.image ? <img src={item.image} className="w-full h-full object-cover rounded-lg" /> : <Package size={16} />}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800 text-sm">{item.title}</div>
                                                        {item.options && <div className="text-[10px] text-slate-400 font-bold">{Array.isArray(item.options) ? item.options.join(', ') : ''}</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                                        className="w-12 text-center border rounded p-1 text-sm font-bold"
                                                    />
                                                ) : (
                                                    <span className="font-black bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs">x{item.quantity}</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 text-center font-bold text-slate-600 text-xs">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={item.price}
                                                        onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                                                        className="w-16 text-center border rounded p-1 text-xs"
                                                    />
                                                ) : (
                                                    Number(item.price).toLocaleString()
                                                )}
                                            </td>
                                            <td className="px-5 py-3 text-center font-black text-slate-900">
                                                {(item.price * item.quantity).toLocaleString()}
                                            </td>
                                            {isEditing && (
                                                <td className="px-5 py-3 text-center">
                                                    <button onClick={() => handleDeleteItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Notes Section */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                            <h4 className="text-xs font-black text-slate-400 uppercase mb-2">ملاحظات</h4>
                            {isEditing ? (
                                <textarea
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full border rounded-xl p-2 text-sm font-bold text-slate-700 min-h-[60px]"
                                />
                            ) : (
                                <p className="text-sm font-bold text-slate-600 leading-relaxed">{formData.notes || "لا توجد ملاحظات."}</p>
                            )}
                        </div>

                    </div>

                    {/* 4. Action Footer (Sticky) */}
                    <div className="bg-white border-t border-slate-100 p-4 z-20 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                        {isEditing ? (
                            <>
                                <button onClick={() => { setIsEditing(false);  /* Reset optional */ }} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition">إلغاء التعديل</button>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsEditing(false)} className="px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50">تجاهل</button>
                                    <button onClick={handleSave} className="px-8 py-3 rounded-xl bg-slate-900 text-white font-bold shadow-lg hover:bg-black transition flex items-center gap-2">
                                        {loading && <Loader2 className="animate-spin" size={16} />}
                                        حفظ التغييرات
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => {
                                        const printUrl = `/admin/print/order/${order.id}`;
                                        const width = 800; const height = window.screen.height;
                                        const left = (window.screen.width - width) / 2; const top = 0;
                                        window.open(printUrl, 'print_popup', `width=${width},height=${height},left=${left},top=${top}`);
                                    }}
                                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-50 text-slate-600 font-black text-sm hover:bg-slate-100 transition border border-slate-200"
                                >
                                    <Printer size={18} /> طباعة
                                </button>

                                <div className="flex gap-3">
                                    {/* Context Aware Buttons */}
                                    {formData.status === 'pending' && (
                                        <>
                                            <button onClick={() => handleStatusUpdate('cancelled')} className="px-5 py-3 rounded-xl border-2 border-red-50 text-red-500 font-bold text-sm hover:bg-red-50 transition">
                                                رفض الطلب
                                            </button>
                                            <button onClick={() => handleStatusUpdate('processing')} className="px-6 py-3 rounded-xl bg-green-600 text-white font-bold text-sm shadow-lg hover:bg-green-700 transition flex items-center gap-2">
                                                <Check size={18} /> قبول وتجهيز
                                            </button>
                                        </>
                                    )}

                                    {(formData.status === 'processing' || formData.status === 'confirmed') && (
                                        <button onClick={() => handleStatusUpdate('shipped')} className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-lg hover:bg-blue-700 transition flex items-center gap-2">
                                            <Truck size={18} /> جاهز للتوصيل
                                        </button>
                                    )}

                                    {formData.status === 'shipped' && (
                                        <button onClick={() => handleStatusUpdate('delivered')} className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-lg hover:bg-emerald-700 transition flex items-center gap-2">
                                            <Check size={18} /> تم التسليم
                                        </button>
                                    )}

                                    {/* Standard Actions */}
                                    <button onClick={() => setIsEditing(true)} className="p-3 bg-slate-50 text-slate-400 hover:text-slate-800 rounded-xl transition">
                                        <Edit2 size={18} />
                                    </button>
                                    <button onClick={() => setIsPaymentModalOpen(true)} className="p-3 bg-emerald-50 text-emerald-500 hover:text-emerald-700 rounded-xl transition" title="تسديد">
                                        <Banknote size={18} />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Payment Modal */}
            {isPaymentModalOpen && (
                <PaymentModal
                    isOpen={isPaymentModalOpen}
                    onClose={() => setIsPaymentModalOpen(false)}
                    invoice={order}
                    client={{ id: order.userId || order.customer_id, name: formData.customerName }}
                    onSuccess={() => { setIsPaymentModalOpen(false); if (onOrderUpdated) onOrderUpdated(); }}
                />
            )}
        </>
    );
}
