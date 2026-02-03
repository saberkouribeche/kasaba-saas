import { useState } from "react";
import { Search, MoreVertical, Phone, Edit2, Trash2, ArrowUpDown, Filter, Eye, DollarSign, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { formatPrice } from "@/lib/formatters";
import Link from "next/link";

export default function SuppliersTable({ suppliers, onEdit, onDelete, onQuickTransaction, onRowClick }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: 'debt', direction: 'desc' });

    // Sort Handler
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Filter & Sort Logic
    const filteredData = [...suppliers].filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone?.includes(searchTerm)
    ).sort((a, b) => {
        if (sortConfig.key === 'debt') {
            return sortConfig.direction === 'asc' ? (Number(a.debt) - Number(b.debt)) : (Number(b.debt) - Number(a.debt));
        }
        if (sortConfig.key === 'name') {
            return sortConfig.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        }
        return 0;
    });

    return (
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden flex flex-col animate-fade-in delay-100">
            {/* Toolbar */}
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:max-w-md group">
                    <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition" size={20} />
                    <input
                        type="text"
                        placeholder="بحث عن مورد..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pr-14 pl-6 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none transition font-bold text-slate-700"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button
                        onClick={() => handleSort('debt')}
                        className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition border ${sortConfig.key === 'debt' ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-white border-transparent text-slate-500 hover:bg-slate-50'}`}
                    >
                        <ArrowUpDown size={16} /> ترتيب بالدين
                    </button>
                    {/* Add Filter/Export buttons here later */}
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto min-h-[400px]">
                <table className="w-full text-right">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                            <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition" onClick={() => handleSort('name')}>المورد</th>
                            <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-wider">التواصل</th>
                            <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition" onClick={() => handleSort('debt')}>المتبقي للدفع</th>
                            <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-wider w-24">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filteredData.map(supplier => {
                            const debt = Number(supplier.debt || 0);
                            return (
                                <tr key={supplier.id} onClick={() => onRowClick && onRowClick(supplier)} className="hover:bg-blue-50/30 transition-all group cursor-pointer">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-bold text-slate-500 text-lg shadow-inner border border-white">
                                                {supplier.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-base">{supplier.name}</h4>
                                                <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-md mt-1 inline-block">ID: #{supplier.id.slice(0, 4)}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        {supplier.phone ? (
                                            <div className="flex items-center gap-2">
                                                <a href={`tel:${supplier.phone}`} onClick={e => e.stopPropagation()} className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-500 hover:text-white transition shadow-sm" title="اتصال">
                                                    <Phone size={14} />
                                                </a>
                                                <span className="text-sm font-bold text-slate-500">{supplier.phone}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 text-sm font-bold px-2">-</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-5 w-1/3">
                                        <div className={`text-xl font-bold tracking-tight ${debt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                            {formatPrice(debt)}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex justify-end gap-2">
                                            {/* Quick Actions */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onQuickTransaction && onQuickTransaction(supplier); }}
                                                className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-200"
                                                title="تسجيل عملية سريعة"
                                            >
                                                <DollarSign size={18} />
                                            </button>

                                            <div className="h-6 w-[1px] bg-slate-200 my-auto mx-1"></div>

                                            <Link href={`/admin/suppliers/${supplier.id}`} onClick={e => e.stopPropagation()} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition">
                                                <Eye size={18} />
                                            </Link>
                                            <button onClick={(e) => { e.stopPropagation(); onEdit && onEdit(supplier); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition">
                                                <Edit2 size={18} />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); onDelete && onDelete(supplier.id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}

                        {filteredData.length === 0 && (
                            <tr>
                                <td colSpan="4" className="text-center py-20">
                                    <div className="flex flex-col items-center justify-center opacity-50">
                                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                            <Search size={32} className="text-slate-400" />
                                        </div>
                                        <p className="font-bold text-slate-500">لا توجد نتائج مطابقة</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View (md:hidden) */}
            <div className="md:hidden flex flex-col divide-y divide-slate-100">
                {filteredData.length === 0 ? (
                    <div className="text-center py-20 flex flex-col items-center justify-center opacity-50">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                            <Search size={40} />
                        </div>
                        <p className="font-bold text-slate-500">لا توجد نتائج مطابقة</p>
                    </div>
                ) : (
                    filteredData.map(supplier => {
                        const debt = Number(supplier.debt || 0);
                        return (
                            <div key={supplier.id} onClick={() => onRowClick && onRowClick(supplier)} className="p-4 bg-white active:bg-slate-50 transition border-b border-slate-50 last:border-0">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-bold text-slate-500 text-lg shadow-inner border border-white shrink-0">
                                            {supplier.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-base">{supplier.name}</h4>
                                            <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-md inline-block">ID: #{supplier.id.slice(0, 4)}</span>
                                        </div>
                                    </div>
                                    <div className={`text-lg font-black tracking-tight ${debt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        {formatPrice(debt)}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-4 gap-3">
                                    {supplier.phone && (
                                        <a href={`tel:${supplier.phone}`} onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-2 rounded-xl">
                                            <Phone size={14} /> {supplier.phone}
                                        </a>
                                    )}

                                    <div className="flex items-center gap-2 mr-auto">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onQuickTransaction && onQuickTransaction(supplier); }}
                                            className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition"
                                        >
                                            <DollarSign size={18} />
                                        </button>
                                        <Link href={`/admin/suppliers/${supplier.id}`} onClick={e => e.stopPropagation()} className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition">
                                            <Eye size={18} />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
