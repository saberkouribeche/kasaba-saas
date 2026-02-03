"use client";
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs, writeBatch, increment, where } from "firebase/firestore";
import { Plus, RefreshCw, ExternalLink, X, Download } from "lucide-react";
import { notify } from "@/lib/notify";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useFirestorePagination } from "@/hooks/useFirestorePagination";
import { useCollectionStats } from "@/hooks/useCollectionStats";

// New Components
import SupplierStats from "@/components/admin/suppliers/SupplierStats";
import SuppliersTable from "@/components/admin/suppliers/SuppliersTable";
import SupplierStatementModal from "@/components/admin/suppliers/SupplierStatementModal";
import AddSupplierTransactionModal from "@/components/admin/suppliers/AddSupplierTransactionModal";

export default function SuppliersPage() {
    // --- State ---
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Quick Transaction State
    const [quickTxModal, setQuickTxModal] = useState({ open: false, supplier: null, type: 'payment' });
    const [quickTxData, setQuickTxData] = useState({ amount: '', note: '' });

    // Statement Modal State
    const [statementModal, setStatementModal] = useState({ open: false, supplier: null });
    const [smartInvoiceModal, setSmartInvoiceModal] = useState({ open: false, supplier: null });

    // Recalculate State
    const [recalculating, setRecalculating] = useState(false);
    const [formData, setFormData] = useState({ name: "", phone: "", debt: 0 }); // For Add Modal

    const router = useRouter();

    // Debounce
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

    // --- Hooks ---
    // 1. Pagination with Search
    // Assuming field is 'name' for suppliers based on previous viewing (Add Modal uses 'name')
    const { data: suppliers, loading, fetchNext, hasMore, refresh } = useFirestorePagination(
        'suppliers',
        20,
        [],
        debouncedSearch,
        'name'
    );

    // 2. Aggregated Stats
    const { totalSum: totalDebt, count: supplierCount } = useCollectionStats('suppliers', 'debt');

    // Stats Object (Mapping real values)
    // Note: SupplierStats component likely expects specific props.
    // If it takes 'suppliers' array, we might need to adjust it to take totals instead
    // OR we pass simulated stats object if it calculates internaly.
    // Let's assume for now we pass the loaded suppliers to it for charts, 
    // but we display the REAL totals here or pass them down.
    // Inspecting previous code: <SupplierStats suppliers={suppliers} />
    // We will keep passing suppliers but maybe override the total display if possible?
    // Actually, let's just use the real stats for the big cards if we render them here.
    const realStats = {
        totalDebt: totalDebt || 0,
        supplierCount: supplierCount || 0
    };

    // --- Actions ---

    // Add Supplier
    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            const initialDebt = Number(formData.debt);
            const supplierData = {
                ...formData,
                debt: initialDebt,
                createdAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, "suppliers"), supplierData);

            if (initialDebt !== 0) {
                await addDoc(collection(db, `suppliers/${docRef.id}/transactions`), {
                    type: 'opening_balance',
                    amount: initialDebt,
                    note: 'رصيد افتتاحي',
                    createdAt: serverTimestamp()
                });
            }

            notify.success("تم إضافة المورد بنجاح");
            setIsAddModalOpen(false);
            setFormData({ name: "", phone: "", debt: 0 });
            refresh(); // Reload list
        } catch (error) {
            notify.error("فشل إضافة المورد");
        }
    };

    // Delete
    const handleDelete = async (id) => {
        if (!await notify.confirm("حذف المورد", "هل أنت متأكد من حذف هذا المورد؟")) return;
        try {
            await deleteDoc(doc(db, "suppliers", id));
            notify.success("تم الحذف بنجاح");
            refresh();
        } catch (error) {
            notify.error("فشل الحذف");
        }
    };

    // Recalculate Logic
    const recalculateAllBalances = async () => {
        if (!await notify.confirm("تحديث الأرصدة", "سيتم إعادة احتساب ديون جميع الموردين الظاهرين حالياً.")) return;
        setRecalculating(true);
        try {
            // Note: Only updating loaded suppliers to avoid timeout loops on client
            // In a perfect world, this is a Cloud Function.
            const batch = writeBatch(db);
            let count = 0;
            for (const supplier of suppliers) {
                const txSnap = await getDocs(collection(db, `suppliers/${supplier.id}/transactions`));
                let realBalance = 0;
                txSnap.forEach(doc => {
                    const tx = doc.data();
                    const amount = Number(tx.amount) || 0;
                    if (tx.type === 'payment') {
                        realBalance -= amount;
                    } else if (tx.type === 'invoice') {
                        realBalance += (amount - (Number(tx.paymentAmount) || 0));
                    } else if (tx.type === 'old_debt' || tx.type === 'opening_balance') {
                        realBalance += amount;
                    }
                });
                const ref = doc(db, 'suppliers', supplier.id);
                batch.update(ref, { debt: realBalance });
                count++;
            }
            await batch.commit();
            notify.success(`تم تحديث أرصدة ${count} مورد`);
            refresh();
        } catch (error) {
            console.error(error);
            notify.error("حدث خطأ أثناء التحديث");
        } finally {
            setRecalculating(false);
        }
    };

    // Quick Transaction Logic
    const openQuickTx = (supplier) => {
        setQuickTxModal({ open: true, supplier, type: 'payment' });
        setQuickTxData({ amount: '', note: '' });
    };

    const handleQuickTxSubmit = async (e) => {
        e.preventDefault();
        if (!quickTxData.amount) return;

        const supplierId = quickTxModal.supplier.id;
        const amount = Number(quickTxData.amount);
        const isPayment = quickTxModal.type === 'payment';

        try {
            await addDoc(collection(db, `suppliers/${supplierId}/transactions`), {
                type: quickTxModal.type,
                amount: amount,
                note: quickTxData.note || (isPayment ? "تسديد سريع" : quickTxModal.type === 'old_debt' ? "دين سابق" : "فاتورة سريعة"),
                createdAt: serverTimestamp()
            });

            const debtAdjustment = isPayment ? -amount : amount;
            await updateDoc(doc(db, "suppliers", supplierId), {
                debt: increment(debtAdjustment),
                lastTransactionDate: serverTimestamp()
            });

            notify.success("تم تسجيل العملية بنجاح");
            setQuickTxModal({ open: false, supplier: null, type: 'payment' });
            refresh(); // Update list to show new balance

        } catch (error) {
            console.error(error);
            notify.error("فشل تسجيل العملية");
        }
    };

    const handleRowClick = (supplier) => {
        // Use Modal instead of route push for now as per previous state
        setStatementModal({ open: true, supplier });
    };

    const handleExport = () => {
        const headers = ["ID", "Name", "Phone", "Debt", "Created At"];
        const rows = suppliers.map(s => [
            s.id,
            s.name,
            s.phone || "",
            s.debt || 0,
            s.createdAt ? new Date(s.createdAt.seconds * 1000).toLocaleDateString() : ""
        ]);
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", "suppliers_report.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        notify.success("تم تنزيل التقرير (بيانات الصفحة الحالية)");
    };

    return (
        <div className="space-y-8 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">إدارة الموردين</h1>
                    <p className="text-slate-500 font-bold mt-1">نظرة شاملة على مستحقاتك المالية والشركاء.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    <button onClick={recalculateAllBalances} disabled={recalculating} className={`flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition shadow-sm text-sm ${recalculating ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <RefreshCw size={16} className={recalculating ? 'animate-spin' : ''} />
                        <span>{recalculating ? 'جاري التحديث...' : 'تحديث الأرصدة'}</span>
                    </button>
                    <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition shadow-sm text-sm">
                        <Download size={16} />
                        <span>تصدير تقرير</span>
                    </button>
                    <Link href="/purchase" className="flex items-center gap-2 px-5 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition shadow-lg shadow-slate-900/10">
                        <ExternalLink size={18} />
                        <span>بوابة الموردين</span>
                    </Link>
                    <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 active:scale-95">
                        <Plus size={20} />
                        <span>مورد جديد</span>
                    </button>
                </div>
            </div>

            {/* Dashboard Stats (Real Aggregation) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900 text-white p-6 rounded-[24px] shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <h2 className="text-slate-400 font-bold text-sm mb-1">إجمالي ديون الموردين</h2>
                        <p className="text-4xl font-black tracking-tight">{realStats.totalDebt.toLocaleString()} <span className="text-lg opacity-50">دج</span></p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-center">
                    <h2 className="text-slate-500 font-bold text-sm mb-1">عدد الموردين</h2>
                    <p className="text-4xl font-black text-slate-800 tracking-tight">{realStats.supplierCount}</p>
                </div>
            </div>

            {/* Pagination Search Bar */}
            <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                        {loading ? <RefreshCw className="animate-spin text-slate-400" size={18} /> : <div className="text-slate-400 font-bold text-xs">بحث</div>}
                    </div>
                    <input
                        type="text"
                        placeholder="بحث عن مورد بالاسم..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pr-14 pl-4 py-3 outline-none font-bold text-slate-700 placeholder:text-slate-300 bg-transparent"
                    />
                </div>
            </div>


            {/* Table */}
            {loading && suppliers.length === 0 ? (
                <div className="text-center py-20 animate-pulse text-slate-400 font-bold">جاري تحميل البيانات...</div>
            ) : suppliers.length === 0 ? (
                <div className="text-center py-20 text-slate-400 font-bold">لا توجد نتائج.</div>
            ) : (
                <SuppliersTable
                    suppliers={suppliers}
                    onDelete={handleDelete}
                    onEdit={(s) => {
                        const newName = prompt("تعديل الاسم:", s.name);
                        if (newName) updateDoc(doc(db, "suppliers", s.id), { name: newName });
                    }}
                    onQuickTransaction={openQuickTx}
                    onRowClick={handleRowClick}
                />
            )}

            {/* Load More */}
            {hasMore && (
                <div className="flex justify-center mt-6">
                    <button onClick={fetchNext} disabled={loading} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition disabled:opacity-50">
                        {loading ? "جاري التحميل..." : "عرض المزيد"}
                    </button>
                </div>
            )}

            {/* Modals */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-[32px] w-full max-w-lg p-8 shadow-2xl relative">
                        <button onClick={() => setIsAddModalOpen(false)} className="absolute top-6 left-6 text-slate-400 hover:bg-slate-100 p-2 rounded-full"><X size={24} /></button>
                        <h3 className="text-2xl font-black text-slate-800 mb-6">إضافة مورد جديد</h3>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-600 mb-2">اسم المورد / الشركة</label>
                                <input required className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:bg-white focus:border-blue-500 outline-none font-bold" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-600 mb-2">رقم الهاتف</label>
                                <input className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:bg-white focus:border-blue-500 outline-none font-bold font-mono" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-600 mb-2">الدين السابق</label>
                                <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:bg-white focus:border-blue-500 outline-none font-bold font-mono" value={formData.debt} onChange={e => setFormData({ ...formData, debt: e.target.value })} />
                            </div>
                            <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg mt-4 hover:bg-blue-700 shadow-xl shadow-blue-500/20">حفظ البيانات</button>
                        </form>
                    </div>
                </div>
            )}

            {quickTxModal.open && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-[32px] w-full max-w-md p-6 shadow-2xl relative">
                        <button onClick={() => setQuickTxModal({ ...quickTxModal, open: false })} className="absolute top-6 left-6 text-slate-400 hover:bg-slate-100 p-2 rounded-full"><X size={24} /></button>
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 font-black text-2xl border-4 border-white shadow-lg">{quickTxModal.supplier?.name.charAt(0)}</div>
                            <h3 className="text-xl font-black text-slate-800">{quickTxModal.supplier?.name}</h3>
                            <p className="text-sm text-slate-500 font-bold mt-1">الدين الحالي: {Number(quickTxModal.supplier?.debt).toLocaleString()} دج</p>
                        </div>
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6">
                            <button onClick={() => setQuickTxModal({ ...quickTxModal, type: 'payment' })} className={`flex-1 py-3 rounded-xl font-black text-xs sm:text-sm transition-all ${quickTxModal.type === 'payment' ? 'bg-green-500 text-white shadow-md' : 'text-slate-500 hover:bg-white/50'}`}>تسديد (خصم)</button>
                            <button onClick={() => { setQuickTxModal({ ...quickTxModal, open: false }); setSmartInvoiceModal({ open: true, supplier: quickTxModal.supplier }); }} className="flex-1 py-3 rounded-xl font-black text-xs sm:text-sm transition-all text-slate-500 hover:bg-slate-200">فاتورة ⚡</button>
                            <button onClick={() => setQuickTxModal({ ...quickTxModal, type: 'old_debt' })} className={`flex-1 py-3 rounded-xl font-black text-xs sm:text-sm transition-all ${quickTxModal.type === 'old_debt' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-500 hover:bg-white/50'}`}>دين سابق</button>
                        </div>
                        <form onSubmit={handleQuickTxSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">المبلغ (دج)</label>
                                <input type="number" autoFocus required placeholder="0" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:bg-white focus:border-current outline-none font-black text-3xl text-center text-slate-800 font-mono" value={quickTxData.amount} onChange={e => setQuickTxData({ ...quickTxData, amount: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">ملاحظة</label>
                                <input className="w-full p-3 bg-slate-50 rounded-xl border border-transparent focus:bg-white focus:border-slate-300 outline-none font-bold text-sm" placeholder="اختياري" value={quickTxData.note} onChange={e => setQuickTxData({ ...quickTxData, note: e.target.value })} />
                            </div>
                            <button className={`w-full py-4 rounded-2xl font-black text-lg text-white shadow-xl mt-2 active:scale-95 transition ${quickTxModal.type === 'payment' ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}>{quickTxModal.type === 'payment' ? 'تأكيد الخصم' : 'تأكيد الإضافة'}</button>
                        </form>
                    </div>
                </div>
            )}

            <SupplierStatementModal isOpen={statementModal.open} onClose={() => setStatementModal({ ...statementModal, open: false })} supplier={statementModal.supplier} />
            <AddSupplierTransactionModal isOpen={smartInvoiceModal.open} onClose={() => setSmartInvoiceModal({ ...smartInvoiceModal, open: false })} supplier={smartInvoiceModal.supplier} onSuccess={() => notify.success("تم إضافة الفاتورة")} />

        </div>
    );
}
