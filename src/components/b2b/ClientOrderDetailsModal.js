"use client";
import { X, Printer, MapPin, Phone, User, Package, Truck, FileText, Eye } from "lucide-react";

export default function ClientOrderDetailsModal({ isOpen, onClose, order }) {
    if (!isOpen || !order) return null;

    // Calculate totals
    const shippingCost = Number(order.delivery_price || 0);
    const subtotal = order.order_items ? order.order_items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0) : (order.amount || 0);
    const total = subtotal + shippingCost;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 backdrop-blur-sm p-4 print:p-0 print:bg-white print:absolute print:inset-0 h-[100dvh] w-screen overflow-hidden">
            <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90dvh] relative animate-fade-up print:shadow-none print:max-w-none print:max-h-none print:h-auto print:rounded-none">

                {/* Header */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 print:hidden">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-xl font-black">
                                    {order.order_number ? `طلب #${order.order_number}` : (order.notes || 'تفاصيل المعاملة')}
                                </h2>
                                {order.order_status && (
                                    <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${order.order_status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                                            order.order_status === 'processing' ? 'bg-blue-500/20 text-blue-300' :
                                                order.order_status === 'shipped' ? 'bg-purple-500/20 text-purple-300' :
                                                    order.order_status === 'delivered' ? 'bg-green-500/20 text-green-300' :
                                                        'bg-red-500/20 text-red-300'
                                        }`}>
                                        {order.order_status === 'pending' && 'في الانتظار'}
                                        {order.order_status === 'processing' && 'قيد التجهيز'}
                                        {order.order_status === 'shipped' && 'تم الشحن'}
                                        {order.order_status === 'delivered' && 'تم التوصيل'}
                                        {order.order_status === 'cancelled' && 'ملغي'}
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-white/70">
                                {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('ar-DZ') :
                                    (order.created_at?.toDate ? order.created_at.toDate().toLocaleString('ar-DZ') : '')}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handlePrint} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition backdrop-blur-sm" title="طباعة">
                                <Printer size={18} />
                            </button>
                            <button onClick={onClose} className="p-2 bg-white/10 hover:bg-red-500/20 rounded-lg transition backdrop-blur-sm" title="إغلاق">
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-4 md:p-6 space-y-6 flex-1">

                    {/* === INVOICE IMAGE VIEW === */}
                    {order.imageUrl ? (
                        <div className="space-y-6">
                            {/* Amount Card */}
                            <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl flex flex-col items-center justify-center gap-2">
                                <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">المبلغ الإجمالي</span>
                                <div className="text-4xl font-black tracking-tight flex items-baseline gap-2 text-slate-900">
                                    {(order.amount || order.order_total).toLocaleString()}
                                    <span className="text-sm font-bold text-slate-400">دج</span>
                                </div>
                                <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-500">
                                    {order.notes || "وصل دفع / فاتورة يدوية"}
                                </div>
                            </div>

                            {/* Image */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100 relative group">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={order.imageUrl}
                                    alt="Invoice"
                                    className="w-full h-auto object-contain max-h-[60vh]"
                                />
                                <a
                                    href={order.imageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-600/90 hover:bg-blue-600 text-white px-5 py-2.5 rounded-full font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 backdrop-blur-sm text-sm"
                                >
                                    <Eye size={16} /> عرض الحجم الكامل
                                </a>
                            </div>
                        </div>
                    ) : (
                        /* === STANDARD ORDER VIEW === */
                        <>
                            {/* Customer Info (Simplified for Client View) */}
                            <div className="flex flex-wrap gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-2 text-slate-600">
                                    <User size={16} />
                                    <span className="font-bold">{order.customer_name || 'زبون'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-600">
                                    <Phone size={16} />
                                    <span className="font-mono dir-ltr">{order.customer_phone}</span>
                                </div>
                                {order.delivery_area && (
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <MapPin size={16} />
                                        <span>{order.delivery_area}</span>
                                    </div>
                                )}
                            </div>

                            {/* Products Table */}
                            {order.order_items && order.order_items.length > 0 && (
                                <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-right">
                                        <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                                            <tr>
                                                <th className="px-4 py-3">المنتج</th>
                                                <th className="px-4 py-3 text-center">الكمية</th>
                                                <th className="px-4 py-3 text-center">السعر</th>
                                                <th className="px-4 py-3 text-center">الإجمالي</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {order.order_items.map((item, index) => (
                                                <tr key={index} className="bg-white">
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-gray-800 text-sm">{item.title}</div>
                                                        {(item.options || item.selected_options) && (
                                                            <div className="mt-1 flex flex-wrap gap-1">
                                                                {/* Option rendering logic same as Admin */}
                                                                {(() => {
                                                                    const opts = item.options || item.selected_options;
                                                                    const optArray = Array.isArray(opts) ? opts : (typeof opts === 'object' ? Object.values(opts) : [opts]);
                                                                    return optArray.map((opt, i) => (
                                                                        <span key={i} className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100 font-bold text-[10px]">
                                                                            {opt}
                                                                        </span>
                                                                    ));
                                                                })()}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-bold text-gray-600 text-sm">x{item.quantity}</td>
                                                    <td className="px-4 py-3 text-center font-bold text-gray-600 text-sm">{Number(item.price).toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-center font-black text-gray-800 text-sm">{Number(item.price * item.quantity).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Summary */}
                            <div className="flex justify-end gap-6 pt-2">
                                <div className="w-full md:w-64 space-y-3">
                                    <div className="flex justify-between items-center text-gray-600 px-2 text-sm">
                                        <span className="font-bold">المجموع الفرعي:</span>
                                        <span className="font-mono font-bold">{subtotal.toLocaleString()} دج</span>
                                    </div>
                                    <div className="flex justify-between items-center text-gray-600 px-2 text-sm">
                                        <span className="font-bold flex items-center gap-2"><Truck size={14} /> التوصيل:</span>
                                        <span className="font-mono font-bold">{shippingCost > 0 ? shippingCost.toLocaleString() : 'مجاني'}</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-xl shadow-lg">
                                        <span className="font-bold">الإجمالي:</span>
                                        <span className="font-black text-xl dir-ltr">{total.toLocaleString()} DZD</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
