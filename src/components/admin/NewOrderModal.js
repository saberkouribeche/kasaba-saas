"use client";
import { AlertTriangle, Bell, CheckCircle } from "lucide-react";

export default function NewOrderModal({ orders, onAcknowledge }) {
    if (!orders || orders.length === 0) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border-2 border-red-500 animate-in zoom-in-95 duration-300">

                {/* Header - Alarm Animation */}
                <div className="bg-red-600 p-6 text-white text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-red-500 opacity-20 animate-pulse"></div>
                    <Bell className="w-16 h-16 mx-auto mb-4 animate-bounce" />
                    <h2 className="text-3xl font-black">طلب جديد!</h2>
                    <p className="font-bold opacity-90 mt-1">يوجد {orders.length} طلبات جديدة بانتظارك</p>
                </div>

                {/* Order List */}
                <div className="p-6 max-h-60 overflow-y-auto space-y-3 bg-red-50/50">
                    {orders.map(order => (
                        <div key={order.id} className="bg-white p-4 rounded-xl border border-red-100 shadow-sm flex justify-between items-center">
                            <div>
                                <p className="font-bold text-slate-800 text-lg">{order.customer_name}</p>
                                <p className="text-xs text-slate-500 font-bold">#{order.order_number}</p>
                            </div>
                            <span className="bg-slate-900 text-white px-3 py-1 rounded-lg font-bold">
                                {order.order_total?.toLocaleString()} دج
                            </span>
                        </div>
                    ))}
                </div>

                {/* Footer - Action */}
                <div className="p-6 bg-white border-t border-gray-100">
                    <button
                        onClick={onAcknowledge}
                        className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-xl hover:bg-slate-800 transition shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2"
                    >
                        <CheckCircle size={24} />
                        استلام وإيقاف التنبيه
                    </button>
                </div>

            </div>
        </div>
    );
}
