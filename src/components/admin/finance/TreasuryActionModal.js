import { useState } from "react";
import { X, Save, ArrowDown, ArrowUp } from "lucide-react";

export default function TreasuryActionModal({ isOpen, onClose, actionType, onSubmit, loading }) {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    if (!isOpen) return null;

    const isCredit = actionType?.operation === 'credit';
    const typeLabel = actionType?.type === 'cash' ? 'الخزنة' : 'البنك';
    const opLabel = isCredit ? 'إيداع في' : 'سحب من';

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({ amount, description });
    };

    return (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
                <div className={`p-6 text-white flex justify-between items-center ${isCredit ? 'bg-emerald-600' : 'bg-red-600'}`}>
                    <h3 className="font-black text-lg flex items-center gap-2">
                        {isCredit ? <ArrowDown size={20} /> : <ArrowUp size={20} />}
                        {opLabel} {typeLabel}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">المبلغ (دج)</label>
                        <input
                            type="number"
                            required
                            min="0"
                            autoFocus
                            className="w-full text-3xl font-black text-center p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-current text-slate-800"
                            placeholder="0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">السبب / الوصف</label>
                        <input
                            type="text"
                            required
                            className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-slate-200"
                            placeholder={isCredit ? "مثال: رأس مال إضافي" : "مثال: مصاريف نثرية"}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                    <button
                        disabled={loading}
                        className={`w-full py-3 rounded-xl font-bold text-white shadow-lg mt-2 ${isCredit ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'}`}
                    >
                        {loading ? 'جاري التنفيذ...' : 'تأكيد العملية'}
                    </button>
                </form>
            </div>
        </div>
    );
}
