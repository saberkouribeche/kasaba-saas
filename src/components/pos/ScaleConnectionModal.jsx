import { useState } from 'react';
import { Usb, RefreshCw, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useNativeScale } from '@/hooks/useNativeScale';

export default function ScaleConnectionModal({ products = [] }) {
    const { isSupported, isConnected, ports, refreshPorts, connect, status, connectedPort, syncProducts, loading } = useNativeScale();
    const [isOpen, setIsOpen] = useState(false);

    console.log("ScaleModal Debug:", { isSupported, isConnected, win: typeof window !== 'undefined' ? window.kasabaNative : 'undefined' });

    if (!isSupported) return null;

    return (
        <>
            {/* Trigger Button */}
            <button
                onClick={() => {
                    setIsOpen(true);
                    refreshPorts();
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all
                    ${isConnected
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100'
                        : 'bg-white text-slate-500 border border-slate-200 hover:border-blue-300 hover:text-blue-500 shadow-sm'
                    }`}
                title={isConnected ? `متصل: ${connectedPort}` : "ربط الميزان"}
            >
                <Usb size={18} />
                <span className="hidden md:inline">{isConnected ? "تحديث" : "ربط الميزان"}</span>
                {isConnected && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
            </button>

            {/* Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                                <Usb size={24} />
                            </div>
                            <div>
                                <h3 className="font-black text-lg text-slate-800">إعدادات الميزان</h3>
                                <p className="text-xs text-slate-400 font-bold">Rongta / Serial Scale</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-xs font-bold text-slate-500">المنافذ المتاحة</span>
                                <button onClick={refreshPorts} className="text-blue-500 hover:text-blue-600 p-1">
                                    <RefreshCw size={14} />
                                </button>
                            </div>

                            <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
                                {ports.length === 0 ? (
                                    <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50">
                                        <p className="text-slate-400 text-sm font-bold">لا توجد منافذ متاحة</p>
                                    </div>
                                ) : (
                                    ports.map((port) => (
                                        <button
                                            key={port.path}
                                            onClick={() => connect(port.path)}
                                            disabled={status === 'connecting' || connectedPort === port.path}
                                            className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all font-bold text-sm
                                                ${connectedPort === port.path
                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                                    : 'border-slate-100 bg-white hover:border-blue-200 hover:bg-blue-50 text-slate-700'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="text-left">
                                                    <div className="text-base">{port.path}</div>
                                                    {port.manufacturer && <div className="text-[10px] text-slate-400 font-normal">{port.manufacturer}</div>}
                                                </div>
                                            </div>
                                            {connectedPort === port.path && <CheckCircle size={18} className="text-emerald-500" />}
                                            {status === 'connecting' && connectedPort !== port.path && <RefreshCw size={18} className="animate-spin text-blue-400" />}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {status === 'error' && (
                            <div className="mt-4 bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                                <AlertCircle size={16} />
                                فشل الاتصال بالميزان
                            </div>
                        )}

                        {isConnected && (
                            <div className="mt-4 bg-emerald-50 text-emerald-600 p-3 rounded-xl text-xs font-bold space-y-2">
                                <div className="flex items-center gap-2">
                                    <CheckCircle size={16} />
                                    تم الاتصال بنجاح
                                </div>
                                <div className="pt-2 border-t border-emerald-100">
                                    <button
                                        onClick={() => syncProducts(products)}
                                        disabled={loading || products.length === 0}
                                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                                        {loading ? "جاري الإرسال..." : "مزامنة المنتجات للميزان"}
                                    </button>
                                    <p className="text-[10px] text-emerald-400 mt-1 text-center font-normal">
                                        سيتم إرسال {products.filter(p => p.barcode).length} منتج
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
