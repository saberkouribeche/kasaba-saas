"use client";
import { useState, useEffect } from "react";
import { Clock, DollarSign, X, CheckCircle, TrendingUp, Calendar } from "lucide-react";
import { startShift, getOpenShift, closeShift } from "@/services/shiftService";
import { addTreasuryTransaction } from "@/services/treasuryService";
import { notify } from "@/lib/notify";
import { EXPENSE_CATEGORIES } from "@/constants/expenseCategories";
import { ChevronDown } from "lucide-react";

export default function ShiftControl() {
    const [currentShift, setCurrentShift] = useState(null);
    const [loading, setLoading] = useState(true);
    const [openModal, setOpenModal] = useState(false);
    const [closeModal, setCloseModal] = useState(false);
    const [expenseModal, setExpenseModal] = useState(false);
    const [openingAmount, setOpeningAmount] = useState("");
    const [closingAmount, setClosingAmount] = useState("");

    // Expense State
    const [expenseAmount, setExpenseAmount] = useState("");
    const [expenseNote, setExpenseNote] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("");
    const [selectedSubCategory, setSelectedSubCategory] = useState("");

    const [submitting, setSubmitting] = useState(false);

    // ... (rest of code)

    const handleExpense = async () => {
        if (!expenseAmount || isNaN(expenseAmount) || Number(expenseAmount) <= 0) {
            notify.error("الرجاء إدخال مبلغ صحيح");
            return;
        }
        if (!selectedCategory || !selectedSubCategory) {
            notify.error("الرجاء اختيار التصنيف");
            return;
        }

        setSubmitting(true);
        try {
            // Find labels for better description
            const cat = EXPENSE_CATEGORIES.find(c => c.id === selectedCategory);
            const sub = cat?.subCategories.find(s => s.id === selectedSubCategory);
            const finalNote = `[${cat?.label?.split(' ')[0]} - ${sub?.label?.split(' ')[0]}] ${expenseNote}`;

            await addTreasuryTransaction({
                type: 'cash',
                operation: 'debit',
                amount: Number(expenseAmount),
                source: 'expense',
                destination: 'drawer',
                shiftId: currentShift.id,
                description: finalNote,
                category: selectedCategory,
                subCategory: selectedSubCategory
            });
            notify.success("تم تسجيل المصروف بنجاح");

            // Reset
            setExpenseModal(false);
            setExpenseAmount("");
            setExpenseNote("");
            setSelectedCategory("");
            setSelectedSubCategory("");
        } catch (error) {
            console.error(error);
            notify.error("فشل تسجيل المصروف");
        } finally {
            setSubmitting(false);
        }
    };

    // ... (rest of code components)

    {/* Expense Modal */ }
    {
        expenseModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
                    <button
                        onClick={() => setExpenseModal(false)}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50 transition"
                    >
                        <X size={24} />
                    </button>
                    <h2 className="text-xl font-black text-slate-800 mb-4 text-center">تسجيل مصروف جديد</h2>

                    <div className="space-y-4">
                        {/* Amount */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">المبلغ (دج)</label>
                            <input
                                type="number"
                                value={expenseAmount}
                                onChange={(e) => setExpenseAmount(e.target.value)}
                                className="w-full text-2xl font-black text-center bg-red-50 border-2 border-red-100 rounded-xl py-3 outline-none focus:border-red-500 transition"
                                placeholder="0"
                                autoFocus
                            />
                        </div>

                        {/* Category Selection */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">القسم الرئيسي</label>
                                <div className="relative">
                                    <select
                                        value={selectedCategory}
                                        onChange={(e) => {
                                            setSelectedCategory(e.target.value);
                                            setSelectedSubCategory(""); // Reset sub when main changes
                                        }}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none appearance-none focus:border-slate-400"
                                    >
                                        <option value="">اختر...</option>
                                        {EXPENSE_CATEGORIES.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">القسم الفرعي</label>
                                <div className="relative">
                                    <select
                                        value={selectedSubCategory}
                                        onChange={(e) => setSelectedSubCategory(e.target.value)}
                                        disabled={!selectedCategory}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none appearance-none focus:border-slate-400 disabled:opacity-50"
                                    >
                                        <option value="">اختر...</option>
                                        {selectedCategory && EXPENSE_CATEGORIES.find(c => c.id === selectedCategory)?.subCategories.map(sub => (
                                            <option key={sub.id} value={sub.id}>{sub.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">ملاحظة (اختياري)</label>
                            <input
                                type="text"
                                value={expenseNote}
                                onChange={(e) => setExpenseNote(e.target.value)}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-slate-400"
                                placeholder="تفاصيل إضافية..."
                            />
                        </div>

                        <button
                            onClick={handleExpense}
                            disabled={submitting}
                            className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-red-200 active:scale-95 transition mt-2"
                        >
                            {submitting ? "جاري التسجيل..." : "تأكيد المصروف"}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const handleOpenShift = async () => {
        if (!openingAmount || isNaN(openingAmount) || Number(openingAmount) < 0) {
            notify.error("الرجاء إدخال مبلغ صحيح");
            return;
        }

        setSubmitting(true);
        try {
            await startShift(Number(openingAmount), "admin"); // TODO: Get actual user ID
            notify.success("تم فتح الوردية بنجاح");
            setOpenModal(false);
            setOpeningAmount("");
            await loadShift();
        } catch (error) {
            console.error(error);
            notify.error(error.message || "حدث خطأ أثناء فتح الوردية");
        } finally {
            setSubmitting(false);
        }
    };

    const handleCloseShift = async () => {
        if (!closingAmount || isNaN(closingAmount) || Number(closingAmount) < 0) {
            notify.error("الرجاء إدخال المبلغ النهائي");
            return;
        }

        if (!await notify.confirm("إغلاق الوردية", "هل أنت متأكد من إغلاق الوردية؟ لا يمكن التراجع عن ذلك.")) {
            return;
        }

        setSubmitting(true);
        try {
            const result = await closeShift(currentShift.id, Number(closingAmount), "admin");
            notify.success(`تم إغلاق الوردية. صافي المبيعات: ${result.netDailySales.toLocaleString()} دج`);
            setCloseModal(false);
            setClosingAmount("");
            await loadShift();
        } catch (error) {
            console.error(error);
            notify.error(error.message || "حدث خطأ أثناء إغلاق الوردية");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 animate-pulse">
                <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
                <div className="h-16 bg-slate-100 rounded"></div>
            </div>
        );
    }

    return (
        <>
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 shadow-xl border border-slate-700 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                </div>

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                                <Clock className="text-white" size={24} />
                            </div>
                            <div>
                                <h3 className="text-white font-black text-xl">إدارة الوردية</h3>
                                <p className="text-slate-400 text-xs font-bold mt-0.5">Shift Management</p>
                            </div>
                        </div>

                        {currentShift ? (
                            <div className="bg-emerald-500/20 text-emerald-300 px-4 py-2 rounded-xl text-xs font-bold border border-emerald-500/30 backdrop-blur-sm flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                                الوردية مفتوحة
                            </div>
                        ) : (
                            <div className="bg-red-500/20 text-red-300 px-4 py-2 rounded-xl text-xs font-bold border border-red-500/30 backdrop-blur-sm">
                                الوردية مغلقة
                            </div>
                        )}
                    </div>

                    {currentShift ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                                    <p className="text-slate-400 text-xs font-bold mb-1">مبلغ الافتتاح</p>
                                    <p className="text-white font-black text-2xl">{currentShift.openingAmount?.toLocaleString()} <span className="text-sm text-slate-500 font-medium">دج</span></p>
                                </div>
                                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                                    <p className="text-slate-400 text-xs font-bold mb-1">وقت الافتتاح</p>
                                    <p className="text-white font-bold text-sm">{currentShift.openedAt?.toDate?.()?.toLocaleTimeString('ar-DZ') || 'N/A'}</p>
                                </div>
                            </div>

                            <button
                                onClick={() => setCloseModal(true)}
                                className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                إغلاق الوردية <CheckCircle size={20} />
                            </button>

                            <button
                                onClick={() => setExpenseModal(true)}
                                className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-2xl font-bold border border-slate-700 flex items-center justify-center gap-2"
                            >
                                <DollarSign size={18} className="text-red-400" /> تسجيل مصروف (من الصندوق)
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setOpenModal(true)}
                            className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            فتح وردية جديدة <TrendingUp size={20} />
                        </button>
                    )}
                </div>
            </div>

            {/* Expense Modal */}
            {expenseModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
                        <button
                            onClick={() => setExpenseModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50 transition"
                        >
                            <X size={24} />
                        </button>
                        <h2 className="text-xl font-black text-slate-800 mb-4 text-center">تسجيل مصروف جديد</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">المبلغ (دج)</label>
                                <input
                                    type="number"
                                    value={expenseAmount}
                                    onChange={(e) => setExpenseAmount(e.target.value)}
                                    className="w-full text-2xl font-black text-center bg-red-50 border-2 border-red-100 rounded-xl py-3 outline-none"
                                    placeholder="0"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">السبب / الوصف</label>
                                <input
                                    type="text"
                                    value={expenseNote}
                                    onChange={(e) => setExpenseNote(e.target.value)}
                                    className="w-full p-3 bg-slate-50 rounded-xl font-bold outline-none"
                                    placeholder="مثال: شراء أكياس، غداء..."
                                />
                            </div>
                            <button
                                onClick={handleExpense}
                                disabled={submitting}
                                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-red-200"
                            >
                                {submitting ? "جاري التسجيل..." : "تأكيد المصروف"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Open Shift Modal */}
            {openModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
                        <button
                            onClick={() => setOpenModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50 transition"
                        >
                            <X size={24} />
                        </button>

                        <div className="text-center mb-6">
                            <div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Clock className="text-emerald-600" size={32} />
                            </div>
                            <h2 className="text-2xl font-black text-slate-800">فتح وردية جديدة</h2>
                            <p className="text-sm text-slate-500 font-bold mt-1">أدخل المبلغ الموجود في الصندوق</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">مبلغ الافتتاح (دج)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={openingAmount}
                                        onChange={(e) => setOpeningAmount(e.target.value)}
                                        className="w-full text-2xl font-black text-center bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition"
                                        placeholder="0"
                                        autoFocus
                                    />
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                </div>
                            </div>

                            <button
                                onClick={handleOpenShift}
                                disabled={submitting}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-black text-lg shadow-lg shadow-emerald-200 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? "جاري الفتح..." : "تأكيد"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Close Shift Modal */}
            {closeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
                        <button
                            onClick={() => setCloseModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50 transition"
                        >
                            <X size={24} />
                        </button>

                        <div className="text-center mb-6">
                            <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="text-orange-600" size={32} />
                            </div>
                            <h2 className="text-2xl font-black text-slate-800">إغلاق الوردية</h2>
                            <p className="text-sm text-slate-500 font-bold mt-1">أدخل المبلغ النهائي في الصندوق</p>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500 font-bold">مبلغ الافتتاح</span>
                                    <span className="text-slate-800 font-black">{currentShift?.openingAmount?.toLocaleString()} دج</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">المبلغ النهائي (العد الفعلي)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={closingAmount}
                                        onChange={(e) => setClosingAmount(e.target.value)}
                                        className="w-full text-2xl font-black text-center bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 focus:ring-4 focus:ring-orange-100 focus:border-orange-500 outline-none transition"
                                        placeholder="0"
                                        autoFocus
                                    />
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                </div>
                            </div>

                            <button
                                onClick={handleCloseShift}
                                disabled={submitting}
                                className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-xl font-black text-lg shadow-lg shadow-orange-200 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? "جاري الإغلاق..." : "إغلاق وحساب صافي المبيعات"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
