import { ArrowDownLeft, ArrowUpRight, Search } from "lucide-react";
import { formatPrice } from "@/lib/formatters";

export default function TreasuryLedger({ transactions }) {
    return (
        <div className="mt-8 overflow-hidden rounded-xl border border-gray-200 shadow-sm">
            <div className="overflow-x-auto">
                {/* Desktop Table */}
                <table className="hidden md:table min-w-full border-collapse">
                    <thead className="bg-slate-800 text-white sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 text-right font-cairo text-sm font-bold">النوع</th>
                            <th className="px-6 py-3 text-right font-cairo text-sm font-bold">المصدر</th>
                            <th className="px-6 py-3 text-right font-cairo text-sm font-bold">الوصف</th>
                            <th className="px-6 py-3 text-right font-cairo text-sm font-bold">التاريخ</th>
                            <th className="px-6 py-3 text-left font-cairo text-sm font-bold">المبلغ</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {transactions?.map((tx) => {
                            const isCredit = tx.operation === 'credit';
                            return (
                                <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="border border-gray-200 px-6 py-4">
                                        <span className={`inline-flex items-center gap-2 font-bold text-xs px-2.5 py-1 rounded-lg ${tx.type === 'cash' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                                            }`}>
                                            {tx.type === 'cash' ? 'خزنة' : 'بنك'}
                                        </span>
                                    </td>
                                    <td className="border border-gray-200 px-6 py-4 text-sm font-bold text-slate-600">
                                        {formatSource(tx.source)}
                                    </td>
                                    <td className="border border-gray-200 px-6 py-4 text-sm font-bold text-slate-800">
                                        {tx.description}
                                    </td>
                                    <td className="border border-gray-200 px-6 py-4 text-xs font-bold text-slate-400">
                                        {tx.formattedDate?.toLocaleString('ar-DZ')}
                                    </td>
                                    <td className="border border-gray-200 px-6 py-4 font-mono font-bold text-left dir-ltr">
                                        <span className={`flex items-center justify-end gap-1 ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {isCredit ? '+' : ''}{formatPrice(tx.amount)}
                                            {isCredit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                        {(!transactions || transactions.length === 0) && (
                            <tr>
                                <td colSpan="5" className="px-6 py-8 text-center text-slate-400 text-sm font-bold border border-gray-200">
                                    لا توجد معاملات مسجلة بعد.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Mobile Card View */}
                <div className="md:hidden flex flex-col divide-y divide-slate-100 bg-white">
                    {(!transactions || transactions.length === 0) ? (
                        <div className="p-8 text-center text-slate-400 text-sm font-bold">
                            لا توجد معاملات مسجلة بعد.
                        </div>
                    ) : (
                        transactions.map((tx) => {
                            const isCredit = tx.operation === 'credit';
                            return (
                                <div key={tx.id} className="p-4 flex flex-col gap-3">
                                    <div className="flex justify-between items-start">
                                        <span className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-md ${tx.type === 'cash' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`}>
                                            {tx.type === 'cash' ? 'خزنة' : 'بنك'}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-bold font-mono">
                                            {tx.formattedDate?.toLocaleString('ar-DZ')}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-black text-slate-800 text-sm mb-0.5">{tx.description}</p>
                                            <p className="text-xs text-slate-500 font-bold">{formatSource(tx.source)}</p>
                                        </div>
                                        <div className={`text-lg font-black tracking-tight flex items-center gap-1 ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {isCredit ? '+' : ''}{formatPrice(tx.amount)}
                                            {isCredit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

function formatSource(source) {
    const map = {
        'b2b_payment': 'دفع زبون',
        'manual_deposit': 'إيداع يدوي',
        'expense': 'مصاريف',
        'supplier_payment': 'دفع لمورد',
        'manual_withdraw': 'سحب يدوي'
    };
    return map[source] || source;
}
