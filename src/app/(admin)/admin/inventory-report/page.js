"use client";
import { useState, useMemo, useEffect } from "react";
import { useAdminData } from "@/context/AdminDataContext";
import { formatPrice } from "@/lib/formatters";
import { Search, Printer, AlertTriangle, Package, CheckCircle2, Edit2 } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { notify } from "@/lib/notify";

export default function InventoryReportPage() {
    const { products, loading } = useAdminData();
    const [filterType, setFilterType] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");

    // Optimistic UI State
    const [optimisticProducts, setOptimisticProducts] = useState([]);

    // Sync with DB (Initial & Updates)
    useEffect(() => {
        if (products) setOptimisticProducts(products);
    }, [products]);

    // --- Actions ---
    const handleUpdateCost = async (id, newCost) => {
        const val = Number(newCost);

        // 1. Optimistic Update (Immediate UI Refresh)
        setOptimisticProducts(prev => prev.map(p =>
            p.id === id ? { ...p, costPrice: val } : p
        ));

        // 2. DB Update (Background)
        try {
            await updateDoc(doc(db, "product", id), { costPrice: val });
            // notify.success("تم تحديث التكلفة"); // Optional: Too noisy? Maybe just a subtle flash
        } catch (error) {
            console.error("Failed to update cost", error);
            notify.error("فشل تحديث السعر، يرجى المحاولة مرة أخرى");
            // Revert on failure (optional, but good practice usually involves a revert or full refresh)
        }
    };

    const handlePrint = () => window.print();

    // --- Calculations (Based on Optimistic Data) ---
    const stats = useMemo(() => {
        let totalValue = 0;
        let totalWeight = 0;
        let itemCount = 0;

        optimisticProducts.forEach(p => {
            const stock = p.stock || 0;
            const cost = p.costPrice || 0;
            totalValue += (stock * cost);
            totalWeight += stock;
            itemCount++;
        });

        return { totalValue, totalWeight, itemCount };
    }, [optimisticProducts]);

    // --- Filtering ---
    const filteredProducts = useMemo(() => {
        return optimisticProducts.filter(p => {
            const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase());
            let matchesType = true;
            if (filterType === 'store') matchesType = p.showInStore !== false;
            if (filterType === 'internal') matchesType = p.showInStore === false;
            return matchesSearch && matchesType;
        });
    }, [optimisticProducts, searchTerm, filterType]);

    if (loading) return <div className="p-8 text-center text-slate-400 font-bold">جاري تحميل تقرير المخزون...</div>;

    return (
        <div className="space-y-6 animate-fade-in font-cairo print:p-0 pb-24">

            {/* Header Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <div>
                    <h1 className="text-2xl font-black text-slate-800">تقرير قيمة المخزون</h1>
                    <p className="text-slate-500 font-bold text-sm">نظرة شاملة على الأصول المتداولة (رأس المال السلعي)</p>
                </div>
                <button
                    onClick={handlePrint}
                    className="bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-900 transition shadow-lg shadow-slate-900/10"
                >
                    <Printer size={18} /> طباعة التقرير
                </button>
            </div>

            {/* 1. Capital Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Value */}
                <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
                    <p className="text-slate-500 font-bold mb-1 text-sm">إجمالي قيمة المخزون</p>
                    <p className="text-4xl font-black text-emerald-600 tracking-tight dir-ltr font-mono">
                        {formatPrice(stats.totalValue)}
                    </p>
                    <div className="absolute right-4 top-4 bg-emerald-50 p-3 rounded-xl text-emerald-600 opacity-20 group-hover:opacity-100 transition">
                        <WalletIcon />
                    </div>
                    <p className="text-xs text-emerald-600/60 mt-2 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                        * يتم التحديث تلقائياً عند تعديل التكاليف
                    </p>
                </div>

                {/* Total Weight */}
                <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
                    <p className="text-slate-500 font-bold mb-1 text-sm">الوزن الإجمالي</p>
                    <p className="text-4xl font-black text-slate-800 tracking-tight dir-ltr">
                        {stats.totalWeight.toLocaleString()} <span className="text-lg text-slate-400">كجم</span>
                    </p>
                    <div className="absolute right-4 top-4 bg-blue-50 p-3 rounded-xl text-blue-600 opacity-20 group-hover:opacity-100 transition">
                        <ScaleIcon />
                    </div>
                </div>

                {/* Item Count */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-2 h-full bg-slate-500"></div>
                    <p className="text-slate-500 font-bold mb-1 text-sm">عدد الأصناف</p>
                    <p className="text-4xl font-black text-slate-800 tracking-tight dir-ltr">
                        {stats.itemCount}
                    </p>
                    <div className="absolute right-4 top-4 bg-slate-50 p-3 rounded-xl text-slate-600 opacity-20 group-hover:opacity-100 transition">
                        <Package size={28} />
                    </div>
                </div>
            </div>

            {/* 2. Filters & Search */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center sticky top-4 z-20 print:hidden">
                <div className="relative flex-1 w-full md:w-auto">
                    <Search className="absolute right-3 top-3 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="بحث باسم المنتج..."
                        className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-slate-200 font-bold text-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl">
                    {['all', 'store', 'internal'].map(type => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === type ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {type === 'all' && 'الكل'}
                            {type === 'store' && 'المتجر'}
                            {type === 'internal' && 'داخلي'}
                        </button>
                    ))}
                </div>
            </div>

            {/* 3. The Master Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Desktop Table */}
                <table className="hidden md:table w-full text-right">
                    <thead className="bg-slate-800 text-white text-xs uppercase font-bold">
                        <tr>
                            <th className="px-6 py-4">المنتج</th>
                            <th className="px-6 py-4">التصنيف</th>
                            <th className="px-6 py-4">الحالة (المتجر)</th>
                            <th className="px-6 py-4">التكلفة (Click to Edit)</th>
                            <th className="px-6 py-4">المخزون (Stock)</th>
                            <th className="px-6 py-4 text-left">القيمة الإجمالية</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredProducts.map(product => {
                            const totalVal = (product.stock || 0) * (product.costPrice || 0);
                            return (
                                <tr key={product.id} className="hover:bg-slate-50/80 transition group">
                                    <td className="px-6 py-3">
                                        <div className="flex items-center gap-3">
                                            <img src={product.img || "https://placehold.co/100"} className="w-10 h-10 rounded-lg object-cover border border-slate-100" />
                                            <span className="font-bold text-slate-800">{product.title}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-sm font-bold text-slate-500">{product.category}</td>
                                    <td className="px-6 py-3">
                                        {product.showInStore !== false ?
                                            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-bold border border-green-100"><CheckCircle2 size={12} /> متجر</span>
                                            : <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 px-2 py-1 rounded text-xs font-bold border border-slate-200">🔒 داخلي</span>
                                        }
                                    </td>
                                    <td className="px-6 py-3">
                                        <EditablePriceCell
                                            id={product.id}
                                            currentPrice={product.costPrice}
                                            onSave={handleUpdateCost}
                                        />
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-black text-lg ${product.stock <= 0 ? 'text-red-500' : 'text-slate-800'}`}>
                                                {product.stock}
                                            </span>
                                            <span className="text-xs text-slate-400 font-bold">كجم</span>
                                            {product.stock <= 5 && product.stock > 0 && <AlertTriangle size={14} className="text-yellow-500" />}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-left">
                                        <span className="font-black text-emerald-700 text-lg font-mono tracking-tight bg-emerald-50 px-2 py-1 rounded-lg">
                                            {formatPrice(totalVal)}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredProducts.length === 0 && (
                            <tr><td colSpan="6" className="py-12 text-center text-slate-400 font-bold">لا توجد منتجات مطابقة للبحث</td></tr>
                        )}
                    </tbody>
                </table>

                {/* Premium Mobile Card View */}
                <div className="md:hidden flex flex-col gap-4">
                    {filteredProducts.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 font-bold opacity-50">لا توجد منتجات</div>
                    ) : (
                        filteredProducts.map(product => {
                            const totalVal = (product.stock || 0) * (product.costPrice || 0);
                            return (
                                <div key={product.id} className="bg-white rounded-[32px] p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative overflow-hidden active:scale-[0.98] transition-all duration-200">

                                    {/* Header: Image & Status */}
                                    <div className="flex gap-4 mb-4">
                                        <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                                            <img src={product.img || "https://placehold.co/100"} className="w-full h-full object-cover" />
                                            {/* Status Badge */}
                                            <div className="absolute top-1 left-1">
                                                {product.showInStore !== false ?
                                                    <div className="bg-white/90 backdrop-blur rounded-full p-1 text-emerald-600 shadow-sm"><CheckCircle2 size={12} /></div>
                                                    : <div className="bg-slate-800/90 backdrop-blur rounded-full p-1 text-white shadow-sm"><AlertTriangle size={12} /></div>
                                                }
                                            </div>
                                        </div>

                                        <div className="flex-1 py-1">
                                            <h3 className="text-lg font-black text-slate-800 leading-tight mb-2 line-clamp-2">{product.title}</h3>
                                            <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold">{product.category}</span>
                                        </div>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        {/* Stock Card */}
                                        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 mb-1">المخزون</p>
                                            <div className="flex items-baseline gap-1">
                                                <span className={`text-2xl font-black ${product.stock <= 5 ? 'text-red-500' : 'text-slate-800'}`}>
                                                    {product.stock}
                                                </span>
                                                <span className="text-xs font-bold text-slate-400">كجم</span>
                                            </div>
                                        </div>

                                        {/* Cost Card (Editable) */}
                                        <div className="bg-blue-50/50 rounded-2xl p-3 border border-blue-100">
                                            <p className="text-[10px] font-bold text-blue-400 mb-1">سعر التكلفة (تعديل)</p>
                                            <EditablePriceCell
                                                id={product.id}
                                                currentPrice={product.costPrice}
                                                onSave={handleUpdateCost}
                                                large={true}
                                            />
                                        </div>
                                    </div>

                                    {/* Total Value Footer */}
                                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-400">القيمة الإجمالية</span>
                                        <span className="text-2xl font-black text-emerald-600 tracking-tight font-mono">{formatPrice(totalVal)}</span>
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

// --- Components ---

function EditablePriceCell({ id, currentPrice, onSave, large }) {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(currentPrice || 0);

    useEffect(() => {
        setValue(currentPrice || 0);
    }, [currentPrice]);

    const handleFinish = () => {
        setIsEditing(false);
        if (Number(value) !== Number(currentPrice)) {
            onSave(id, value);
        }
    };

    if (isEditing) {
        return (
            <input
                autoFocus
                type="number"
                onClick={(e) => e.stopPropagation()}
                className={large
                    ? "w-full h-12 bg-white rounded-xl text-center text-xl font-black text-blue-600 outline-none ring-2 ring-blue-500 shadow-xl"
                    : "w-24 p-1.5 border-2 border-blue-500 rounded-lg text-center font-bold text-slate-800 outline-none shadow-lg animate-in fade-in zoom-in-95"
                }
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={handleFinish}
                onKeyDown={(e) => e.key === 'Enter' && handleFinish()}
            />
        );
    }

    return (
        <div
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            className={`cursor-pointer group transition-all flex items-center gap-2 ${large
                ? "w-full justify-between hover:bg-white/50 rounded-lg"
                : "hover:bg-yellow-50 p-2 rounded-lg border border-transparent hover:border-yellow-200"}`
            }
            title="اضغط لتعديل سعر التكلفة"
        >
            <span className={large ? "text-2xl font-black text-blue-600 tracking-tight" : "font-bold text-slate-600 group-hover:text-slate-800 transition-colors"}>
                {formatPrice(value)}
            </span>
            <span className={`opacity-0 group-hover:opacity-100 text-slate-400 ${large ? "bg-white p-2 shadow-sm rounded-xl" : "bg-white p-1 rounded-full shadow-sm"}`}>
                <Edit2 size={large ? 14 : 10} />
            </span>
        </div>
    );
}

// Icons
function WalletIcon() {
    return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
}

function ScaleIcon() {
    return <svg width="24" height="24" viewBox="0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" /></svg>
}
