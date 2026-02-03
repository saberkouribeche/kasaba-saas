import { Wallet, TrendingUp, AlertCircle, Users, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatPrice } from "@/lib/formatters";

export default function SupplierStats({ suppliers }) {
    const totalDebt = suppliers.reduce((acc, curr) => acc + (Number(curr.debt) || 0), 0);
    const activeSuppliers = suppliers.length;

    // Mock data for trend (in a real app, calculate vs last month)
    const debtTrend = "+2.4%";
    const isDebtRising = true;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-fade-in">
            {/* Total Debt Card - Hero */}
            <div className="md:col-span-2 group bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-[32px] shadow-2xl shadow-slate-900/20 relative overflow-hidden text-white border border-slate-700/50">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 opacity-10 rounded-full translate-x-1/2 -translate-y-1/2 blur-3xl group-hover:opacity-20 transition duration-1000"></div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 h-full">
                    <div>
                        <div className="flex items-center gap-2 text-slate-400 font-bold mb-2 text-sm uppercase tracking-widest">
                            <Wallet size={18} className="text-blue-400" />
                            <span>إجمالي الديون المستحقة</span>
                        </div>
                        <div className="flex items-end gap-3">
                            <h2 className="text-5xl font-bold tracking-tight text-white mb-1">
                                {formatPrice(totalDebt)}
                            </h2>
                        </div>
                        <p className="text-slate-400 text-sm font-medium mt-2 flex items-center gap-2">
                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${isDebtRising ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                {isDebtRising ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                {debtTrend}
                            </span>
                            مقارنة بالشهر الماضي
                        </p>
                    </div>

                    <div className="hidden md:block">
                        <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md">
                            <AlertCircle size={40} className="text-red-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Suppliers Card */}
            <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 relative overflow-hidden group hover:border-blue-200 transition-colors">
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-50 rounded-full blur-3xl opacity-50 group-hover:scale-150 transition duration-700"></div>

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-slate-400 font-black text-xs uppercase tracking-wider">الشركاء</span>
                        <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                            <Users size={24} />
                        </div>
                    </div>

                    <div className="flex items-end gap-2">
                        <h3 className="text-4xl font-black text-slate-800">{activeSuppliers}</h3>
                        <span className="text-sm font-bold text-slate-400 mb-1.5">مورد نشط</span>
                    </div>

                    <div className="mt-4 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full w-[70%]"></div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-2 text-right">70% منهم لديهم معاملات هذا الشهر</p>
                </div>
            </div>
        </div>
    );
}
