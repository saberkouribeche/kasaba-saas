import { useState, useEffect } from 'react';
import { X, Check, Delete } from 'lucide-react';
import { usePosStore } from '@/store/usePosStore';

export default function WeightModal() {
    const { isWeightModalOpen, tempProduct, closeWeightModal, addToCart } = usePosStore();
    const [weight, setWeight] = useState("");

    useEffect(() => {
        if (isWeightModalOpen) {
            setWeight("");
        }
    }, [isWeightModalOpen]);

    if (!isWeightModalOpen || !tempProduct) return null;

    const handleNumberClick = (num) => {
        if (weight.includes('.') && num === '.') return;
        setWeight(prev => prev + num);
    };

    const handleClear = () => {
        setWeight("");
    };

    const handleBackspace = () => {
        setWeight(prev => prev.slice(0, -1));
    };

    const handleConfirm = () => {
        if (!weight || parseFloat(weight) <= 0) return;
        addToCart(tempProduct, weight);
        closeWeightModal();
    };

    const calculatedPrice = tempProduct.price * (parseFloat(weight) || 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-slate-50 p-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 className="font-black text-xl text-slate-800">{tempProduct.title}</h3>
                        <p className="text-slate-500 font-medium text-sm">أدخل الوزن بالكيلوغرام</p>
                    </div>
                    <button onClick={closeWeightModal} className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-500 transition">
                        <X size={20} />
                    </button>
                </div>

                {/* Display */}
                <div className="p-6 pb-2">
                    <div className="bg-slate-900 rounded-2xl p-5 text-white flex justify-between items-end mb-4">
                        <div className="text-left">
                            <span className="block text-slate-400 text-xs font-bold mb-1">السعر الإجمالي</span>
                            <span className="font-black text-3xl text-emerald-400">{calculatedPrice.toLocaleString()} <span className="text-sm text-emerald-600">دج</span></span>
                        </div>
                        <div className="text-right">
                            <span className="block text-slate-400 text-xs font-bold mb-1">الوزن المدخل</span>
                            <div className="font-black text-4xl tracking-widest">{weight || "0.000"} <span className="text-lg text-slate-500">kg</span></div>
                        </div>
                    </div>
                </div>

                {/* Numpad */}
                <div className="px-6 pb-6 pt-2">
                    <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <button key={num} onClick={() => handleNumberClick(num.toString())} className="h-16 rounded-2xl bg-gray-50 border border-gray-100 text-2xl font-bold text-slate-700 hover:bg-white hover:shadow-md hover:border-gray-200 transition active:scale-95">
                                {num}
                            </button>
                        ))}
                        <button onClick={() => handleNumberClick('.')} className="h-16 rounded-2xl bg-gray-50 border border-gray-100 text-2xl font-bold text-slate-700 hover:bg-white hover:shadow-md hover:border-gray-200 transition active:scale-95">.</button>
                        <button onClick={() => handleNumberClick('0')} className="h-16 rounded-2xl bg-gray-50 border border-gray-100 text-2xl font-bold text-slate-700 hover:bg-white hover:shadow-md hover:border-gray-200 transition active:scale-95">0</button>
                        <button onClick={handleBackspace} className="h-16 rounded-2xl bg-red-50 border border-red-100 text-xl font-bold text-red-500 hover:bg-red-100 hover:shadow-md hover:border-red-200 transition active:scale-95 flex items-center justify-center">
                            <Delete size={24} />
                        </button>
                    </div>

                    <button onClick={handleConfirm} disabled={!weight} className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-bold text-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition flex items-center justify-center gap-2">
                        <Check size={24} /> تأكيد وإضافة
                    </button>
                </div>
            </div>
        </div>
    );
}
