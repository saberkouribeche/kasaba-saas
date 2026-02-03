import { Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Package, Landmark, Coins, AlertCircle, Save } from "lucide-react";
import { formatPrice } from "@/lib/formatters";

export default function FinanceStats({
    stats,
    onOpenAction,
    onSaveSnapshot,
    snapshotLoading
}) {
    const {
        netWorth,
        inventoryValue,
        cashBalance,
        bankBalance,
        receivables,
        payables
    } = stats;

    return (
        <div className="space-y-6">
            {/* ROW 1: Net Worth Hero */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-2 text-slate-400 font-bold mb-2">
                            <Wallet className="text-emerald-400" size={20} />
                            <span>رأس المال الصافي (Net Worth)</span>
                        </div>
                        <div className="text-4xl md:text-5xl font-extrabold tracking-tight font-cairo dir-ltr">
                            {formatPrice(netWorth)}
                        </div>
                        <div className="flex gap-4 mt-4 text-sm font-bold">
                            <span className="text-emerald-400 flex items-center gap-1">
                                <ArrowUpRight size={16} /> أصول: {formatPrice((inventoryValue || 0) + (cashBalance || 0) + (bankBalance || 0) + (receivables || 0))}
                            </span>
                            <span className="text-red-400 flex items-center gap-1">
                                <ArrowDownRight size={16} /> خصوم: {formatPrice(payables || 0)}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={onSaveSnapshot}
                        disabled={snapshotLoading}
                        className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-6 py-3 rounded-xl font-bold transition flex items-center gap-2 backdrop-blur-md active:scale-95"
                    >
                        <Save size={18} />
                        {snapshotLoading ? "جاري الحفظ..." : "حفظ لقطة مالية"}
                    </button>
                </div>
            </div>

            {/* ROW 2: Liquidity & Assets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Inventory */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><Package size={24} /></div>
                    </div>
                    <p className="text-slate-400 font-bold text-sm">قيمة المخزون</p>
                    <h3 className="text-2xl font-black text-slate-800 mt-1">{formatPrice(inventoryValue)}</h3>
                </div>

                {/* Safe / Cash */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600"><Coins size={24} /></div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button onClick={() => onOpenAction('cash', 'credit')} className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-200" title="إيداع">+</button>
                            <button onClick={() => onOpenAction('cash', 'debit')} className="p-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200" title="سحب">-</button>
                        </div>
                    </div>
                    <p className="text-slate-400 font-bold text-sm">الخزنة (La Caisse)</p>
                    <h3 className="text-2xl font-black text-slate-800 mt-1">{formatPrice(cashBalance)}</h3>
                </div>

                {/* Bank */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600"><Landmark size={24} /></div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button onClick={() => onOpenAction('bank', 'credit')} className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-200" title="إيداع">+</button>
                            <button onClick={() => onOpenAction('bank', 'debit')} className="p-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200" title="سحب">-</button>
                        </div>
                    </div>
                    <p className="text-slate-400 font-bold text-sm">الحساب البنكي</p>
                    <h3 className="text-2xl font-black text-slate-800 mt-1">{formatPrice(bankBalance)}</h3>
                </div>
            </div>

            {/* ROW 3: Debts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Receivables */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <TrendingUp className="text-emerald-500" size={20} />
                        <h4 className="font-bold text-slate-700">ديون الزبائن (Receivables)</h4>
                    </div>
                    <p className="text-3xl font-black text-emerald-600 mb-2">{formatPrice(receivables)}</p>
                    <p className="text-xs font-bold text-slate-400">أموال لدى المطاعم والزبائن</p>
                </div>

                {/* Payables */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <TrendingDown className="text-red-500" size={20} />
                        <h4 className="font-bold text-slate-700">ديون الموردين (Payables)</h4>
                    </div>
                    <p className="text-3xl font-black text-red-600 mb-2">{formatPrice(payables)}</p>
                    <p className="text-xs font-bold text-slate-400">مستحقات واجبة الدفع للموردين</p>
                </div>
            </div>
        </div>
    );
}
