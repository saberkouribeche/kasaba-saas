"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, AlertCircle, Save } from "lucide-react";
import { formatPrice } from "@/lib/formatters"; // Assuming this exists or we can reuse logic

export default function InventoryBottomSheet({
    isOpen,
    onClose,
    product,
    onSave
}) {
    const [batches, setBatches] = useState([]);
    const [inputValue, setInputValue] = useState("");
    const inputRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);

    // Reset when opening a new product
    useEffect(() => {
        if (isOpen) {
            setBatches([]);
            setInputValue("");
            // Auto-focus logic
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [isOpen, product]);

    const handleAddBatch = () => {
        if (!inputValue) return;
        const val = parseFloat(inputValue);
        if (isNaN(val) || val <= 0) return;

        setBatches(prev => [val, ...prev]); // Add to top
        setInputValue("");

        // Haptic feedback
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(50);
        }

        // Keep focus
        inputRef.current?.focus();
    };

    const handleRemoveBatch = (index) => {
        setBatches(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveClick = async () => {
        setIsLoading(true);
        try {
            await onSave(currentTotal, calculateTotalValue());
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const currentTotal = batches.reduce((a, b) => a + b, 0);
    const calculateTotalValue = () => currentTotal * (product?.costPrice || 0);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                    />

                    {/* Sheet */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-3xl shadow-[0_-5px_30px_rgba(0,0,0,0.15)] flex flex-col max-h-[85vh] h-[60vh] overflow-hidden font-cairo"
                    >
                        {/* A. Header */}
                        <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-white shrink-0">
                            <img
                                src={product?.img || "https://placehold.co/100"}
                                className="w-14 h-14 rounded-xl object-cover border border-gray-100"
                                alt={product?.title}
                            />
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-800 text-lg truncate">{product?.title}</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-400">التكلفة: {product?.costPrice || 0} دج</span>
                                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                                        الحالي: {product?.stock || 0}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-400 font-bold mb-0.5">القيمة الحالية</p>
                                <p className="text-lg font-black text-emerald-600 dir-ltr">
                                    {formatPrice(calculateTotalValue())}
                                </p>
                            </div>
                        </div>

                        {/* B. Batch List (Scrollable) */}
                        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-2">
                            {batches.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                    <AlertCircle size={40} className="mb-2 opacity-50" />
                                    <p className="font-bold text-sm">أضف الكميات لحساب المخزون</p>
                                </div>
                            ) : (
                                batches.map((batch, idx) => (
                                    <motion.div
                                        key={`${idx}-${batch}`}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="bg-white p-3 rounded-xl border border-dashed border-slate-300 flex justify-between items-center"
                                    >
                                        <span className="font-black text-slate-700 text-lg">{batch} <span className="text-xs font-medium text-slate-400">كجم</span></span>
                                        <button
                                            onClick={() => handleRemoveBatch(idx)}
                                            className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-100"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </motion.div>
                                ))
                            )}
                        </div>

                        {/* C. Footer (Action Zone) */}
                        <div className="p-4 bg-white border-t border-gray-100 shrink-0 space-y-3 pb-safe">
                            <div className="flex gap-3">
                                <input
                                    ref={inputRef}
                                    type="number"
                                    inputMode="decimal"
                                    pattern="[0-9]*"
                                    placeholder="0.00"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddBatch()}
                                    className="flex-1 bg-slate-100 text-3xl font-black text-center h-16 rounded-2xl border-2 border-transparent focus:border-emerald-500 focus:bg-white outline-none transition-colors shadow-inner"
                                />
                                <button
                                    onClick={handleAddBatch}
                                    className="w-20 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform"
                                >
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                </button>
                            </div>

                            <button
                                onClick={handleSaveClick}
                                disabled={isLoading}
                                className="w-full bg-slate-900 text-white font-bold h-14 rounded-2xl text-lg shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
                            >
                                {isLoading ? (
                                    <span className="animate-pulse">جاري الحفظ...</span>
                                ) : (
                                    <>
                                        <Save size={20} />
                                        تأكيد الجرد ({currentTotal.toFixed(2)} كجم)
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
