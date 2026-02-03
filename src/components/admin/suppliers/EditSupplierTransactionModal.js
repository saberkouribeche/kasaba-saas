"use client";
import { useState, useEffect } from "react";
import { X, Save, Calendar, FileText, DollarSign, Wallet, Scale, Box, Calculator, Plus, Trash2 } from "lucide-react";
import { doc, updateDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
// ... imports

export default function EditSupplierTransactionModal({ isOpen, onClose, transaction, supplierId, onSuccess }) {
    const [loading, setLoading] = useState(false);

    // Header Data
    const [formData, setFormData] = useState({
        type: 'invoice',
        amount: "",
        paymentAmount: "",
        note: "",
    });

    // Groups Data (for Multi-Item Invoices)
    const [groups, setGroups] = useState([]);

    // Initialize Data
    useEffect(() => {
        if (!isOpen) return;

        if (transaction) {
            // Edit Mode
            setFormData({
                type: transaction.type || "invoice",
                amount: transaction.amount || 0,
                paymentAmount: transaction.paymentAmount || 0,
                note: transaction.note || "",
            });

            // Initialize Groups
            if (transaction.details?.groups?.length > 0) {
                setGroups(transaction.details.groups.map((g, i) => ({
                    id: Date.now() + i,
                    grossWeight: g.grossWeight || "",
                    tara: g.tara || "",
                    boxes: g.boxes || "",
                    netWeight: g.netWeight || "",
                    pricePerKg: g.pricePerKg || "",
                    batchWeightsStr: g.batches ? g.batches.join(", ") : "",
                    total: g.total || 0
                })));
            } else {
                const hasLegacyData = transaction.grossWeight || transaction.netWeight;
                if (hasLegacyData) {
                    setGroups([{
                        id: Date.now(),
                        grossWeight: transaction.grossWeight || "",
                        tara: transaction.tara || "",
                        boxes: transaction.boxes || "",
                        netWeight: transaction.netWeight || "",
                        pricePerKg: transaction.pricePerKg || "",
                        batchWeightsStr: transaction.batchWeights ? transaction.batchWeights.join(", ") : "",
                        total: transaction.amount || 0
                    }]);
                } else {
                    setGroups([{
                        id: Date.now(),
                        grossWeight: "", tara: "", boxes: "", netWeight: "", pricePerKg: "", batchWeightsStr: "", total: 0
                    }]);
                }
            }
        } else {
            // Create Mode (Defaults)
            setFormData({
                type: 'invoice',
                amount: "",
                paymentAmount: "",
                note: "",
            });
            setGroups([{
                id: Date.now(),
                grossWeight: "",
                tara: "",
                boxes: "",
                netWeight: "",
                pricePerKg: "",
                batchWeightsStr: "",
                total: 0
            }]);
        }
    }, [isOpen, transaction]);

    // ... useEffect for Auto-Calculate ... (No change)
    // ... Group Helper Functions ... (No change)

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Prepare Detail Groups
            const processedGroups = groups.map(g => ({
                grossWeight: Number(g.grossWeight) || 0,
                tara: Number(g.tara) || 0,
                boxes: Number(g.boxes) || 0,
                netWeight: Number(g.netWeight) || 0,
                pricePerKg: Number(g.pricePerKg) || 0,
                batches: g.batchWeightsStr ? g.batchWeightsStr.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n !== 0) : [],
                total: Number(g.total) || 0
            }));

            const totalGross = processedGroups.reduce((acc, g) => acc + g.grossWeight, 0);
            const totalNet = processedGroups.reduce((acc, g) => acc + g.netWeight, 0);

            const data = {
                amount: Number(formData.amount),
                note: formData.note,
                grossWeight: totalGross,
                netWeight: totalNet,
                pricePerKg: 0,
                tara: 0,
                boxes: processedGroups.reduce((acc, g) => acc + g.boxes, 0),
                details: {
                    system: 'weight_multi',
                    groups: processedGroups
                }
            };

            if (formData.type === 'invoice') {
                data.paymentAmount = Number(formData.paymentAmount);
            }

            if (transaction && transaction.id) {
                // Update
                await updateDoc(doc(db, `suppliers/${supplierId}/transactions`, transaction.id), {
                    ...data,
                    lastEditedAt: serverTimestamp()
                });
                notify.success("تم تحديث العملية بنجاح");
            } else {
                // Create
                await addDoc(collection(db, `suppliers/${supplierId}/transactions`), {
                    ...data,
                    type: formData.type, // 'invoice'
                    createdAt: serverTimestamp()
                });
                notify.success("تم إضافة العملية بنجاح");
            }

            onSuccess && onSuccess();
            onClose();
        } catch (error) {
            console.error("Save Error:", error);
            notify.error("فشل الحفظ");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null; // Removed !transaction check

    const isPayment = formData.type === 'payment';

    return (
        <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
                    <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                        <Edit2Icon className="w-6 h-6 text-blue-600" /> {transaction ? 'تعديل عملية' : 'إضافة عملية جديدة'}
                        <span className="text-sm font-normal text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-lg">{isPayment ? 'دفعة' : 'فاتورة'}</span>
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-500"><X size={24} /></button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">

                    {/* Groups Section (Invoice Only) */}
                    {!isPayment && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="flex items-center gap-2 font-bold text-slate-500 text-sm"><Calculator size={16} /> مجموعات الوزن (الأصناف)</h4>
                                <button type="button" onClick={addGroup} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg font-bold hover:bg-blue-100 transition">
                                    + إضافة مجموعة
                                </button>
                            </div>

                            <div className="space-y-3">
                                {groups.map((group, index) => (
                                    <div key={group.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-200 relative group-card">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded-md">مجموعة #{index + 1}</span>
                                            {groups.length > 1 && (
                                                <button type="button" onClick={() => removeGroup(group.id)} className="text-red-400 hover:text-red-600 transition"><Trash2 size={16} /></button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 mb-1">القائم (Gross)</label>
                                                <input
                                                    type="number"
                                                    value={group.grossWeight}
                                                    onChange={e => updateGroup(group.id, 'grossWeight', e.target.value)}
                                                    className="w-full p-2 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-center text-sm"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 mb-1">تارة/صندوق</label>
                                                <input
                                                    type="number"
                                                    value={group.tara}
                                                    onChange={e => updateGroup(group.id, 'tara', e.target.value)}
                                                    className="w-full p-2 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-center text-sm"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 mb-1">عدد الصناديق</label>
                                                <input
                                                    type="number"
                                                    value={group.boxes}
                                                    onChange={e => updateGroup(group.id, 'boxes', e.target.value)}
                                                    className="w-full p-2 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-center text-sm"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-emerald-600 mb-1">سعر الكيلو</label>
                                                <input
                                                    type="number"
                                                    value={group.pricePerKg}
                                                    onChange={e => updateGroup(group.id, 'pricePerKg', e.target.value)}
                                                    className="w-full p-2 rounded-xl border border-emerald-200 bg-emerald-50 focus:border-emerald-500 outline-none font-bold text-center text-sm text-emerald-700"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex gap-3 items-center bg-white p-2 rounded-xl border border-slate-100">
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-bold text-slate-400 mb-1">الصافي (Net)</label>
                                                <input
                                                    type="number"
                                                    value={group.netWeight}
                                                    onChange={e => updateGroup(group.id, 'netWeight', e.target.value)}
                                                    className="w-full p-1 border-b border-dashed border-slate-300 focus:border-blue-500 outline-none font-bold text-center text-lg text-slate-800 bg-transparent"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div className="w-px h-8 bg-slate-200"></div>
                                            <div className="flex-1 text-center">
                                                <span className="block text-[10px] font-bold text-slate-400">الإجمالي</span>
                                                <span className="block font-bold text-lg text-slate-800">{formatPrice(group.total)}</span>
                                            </div>
                                        </div>

                                        <div className="mt-3">
                                            <input
                                                type="text"
                                                value={group.batchWeightsStr}
                                                onChange={e => updateGroup(group.id, 'batchWeightsStr', e.target.value)}
                                                className="w-full p-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none text-xs text-slate-500"
                                                placeholder="الأوزان التفصيلية (مثال: 20.5, 15.2...)"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}


                    {/* Total Amount (Main) */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">المبلغ الإجمالي النهائي (دج)</label>
                        <div className="relative">
                            <input
                                type="number"
                                required
                                value={formData.amount}
                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                className={`w-full pl-4 pr-10 py-4 rounded-xl border-2 outline-none font-bold text-2xl transition-colors ${isPayment ? 'border-green-100 focus:border-green-500 bg-green-50/30 text-green-700' : 'border-slate-200 focus:border-blue-500 bg-slate-50 text-slate-800'
                                    }`}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                <DollarSign size={20} />
                            </div>
                        </div>
                    </div>

                    {/* Partial Payment */}
                    {!isPayment && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">المدفوع منه (دفعة جزئية)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={formData.paymentAmount}
                                    onChange={e => setFormData({ ...formData, paymentAmount: e.target.value })}
                                    className="w-full pl-4 pr-10 py-3 rounded-xl border-2 border-slate-100 focus:border-blue-500 bg-slate-50 outline-none font-bold text-lg transition-colors"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                    <Wallet size={18} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Note */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">ملاحظات</label>
                        <div className="relative">
                            <textarea
                                rows={2}
                                value={formData.note}
                                onChange={e => setFormData({ ...formData, note: e.target.value })}
                                className="w-full pl-4 pr-10 py-3 rounded-xl border-2 border-slate-100 focus:border-blue-500 bg-slate-50 outline-none font-bold text-sm transition-colors resize-none"
                            />
                            <div className="absolute right-3 top-3 text-slate-400 pointer-events-none">
                                <FileText size={18} />
                            </div>
                        </div>
                    </div>
                </form>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition"
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2"
                    >
                        {loading ? 'جاري الحفظ...' : <><Save size={18} /> حفظ التعديلات</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Edit2Icon(props) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
    )
}
