"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { notify } from "@/lib/notify";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, orderBy, deleteDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { ArrowRight, Phone, Calendar, Banknote, FileText, Plus, AlertCircle, Image as ImageIcon, ExternalLink, Eye, X, Trash2, Edit2, Printer } from "lucide-react";
import Link from "next/link";
import SupplierInvoiceModal from "@/components/admin/SupplierInvoiceModal";
import SupplierPaymentModal from "@/components/admin/SupplierPaymentModal";
import AddToTransactionModal from "@/components/admin/AddToTransactionModal";
import EditTransactionModal from "@/components/admin/EditTransactionModal";

export default function SupplierDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const [supplier, setSupplier] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    // Image Preview & Details
    const [previewImage, setPreviewImage] = useState(null);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [selectedTransactionForAdd, setSelectedTransactionForAdd] = useState(null);
    const [selectedTransactionForEdit, setSelectedTransactionForEdit] = useState(null);

    useEffect(() => {
        if (!id) return;

        // 1. Listen to Supplier Details
        const unsubSupplier = onSnapshot(doc(db, "suppliers", id), (doc) => {
            if (doc.exists()) {
                setSupplier({ id: doc.id, ...doc.data() });
            } else {
                router.push("/admin/suppliers"); // Redirect if not found
            }
            setLoading(false);
        });

        // 2. Listen to Transactions History
        const qTransactions = query(collection(db, `suppliers/${id}/transactions`), orderBy("createdAt", "desc"));
        const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
            setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubSupplier();
            unsubTransactions();
        };
    }, [id, router]);

    const handleDeleteTransaction = async (transaction) => {
        if (!await notify.confirm("حذف العملية", "هل أنت متأكد من حذف هذه العملية؟ سيتم إلغاء تأثيرها على الدين.")) return;

        try {
            // Reverse Effect
            const supplierRef = doc(db, 'suppliers', supplier.id);
            let debtAdjustment = 0;

            if (transaction.type === 'invoice') {
                // Invoice increased debt by (amount - paymentAmount)
                // To reverse: decrease debt
                const netAmount = transaction.amount - (transaction.paymentAmount || 0);
                debtAdjustment = -netAmount;
            } else if (transaction.type === 'old_debt' || transaction.type === 'opening_balance') {
                // These increased debt explicitly
                // To reverse: decrease debt
                debtAdjustment = -transaction.amount;
            } else {
                // Payment decreased debt by amount
                // To reverse: increase debt
                debtAdjustment = transaction.amount;
            }

            await updateDoc(supplierRef, {
                debt: increment(debtAdjustment),
                lastTransactionDate: serverTimestamp()
            });

            await deleteDoc(doc(db, `suppliers/${supplier.id}/transactions`, transaction.id));
            notify.success("تم حذف العملية بنجاح");
        } catch (error) {
            console.error(error);
            notify.error("حدث خطأ أثناء الحذف");
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">جاري تحميل بيانات المورد...</div>;
    if (!supplier) return null;

    return (
        <div className="space-y-6 animate-fade-in relative pb-20">
            {/* Header / Nav */}
            <div className="flex items-center gap-4">
                <Link href="/admin/suppliers" className="p-2 bg-white rounded-xl shadow-sm hover:bg-gray-50 text-slate-600 transition">
                    <ArrowRight size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-black text-slate-800">{supplier.name}</h1>
                    <p className="text-sm text-slate-500 font-bold flex items-center gap-2 mt-1">
                        <Phone size={14} /> {supplier.phone || "لا يوجد هاتف"}
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-red-50 p-6 rounded-[24px] border border-red-100 flex items-center justify-between relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-red-800 font-bold text-sm mb-1">الدين المستحق (للمورد)</p>
                        <h2 className="text-4xl font-black text-red-600 dir-ltr">
                            {/* Calculate debt dynamically from transactions to ensure consistency */}
                            {transactions.reduce((acc, curr) => {
                                if (curr.type === 'invoice') return acc + (curr.amount - (curr.paymentAmount || 0));
                                if (curr.type === 'payment') return acc - curr.amount;
                                if (curr.type === 'old_debt' || curr.type === 'opening_balance') return acc + curr.amount;
                                return acc;
                            }, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </h2>
                    </div>
                    <div className="bg-white p-3 rounded-full text-red-500 shadow-sm z-10">
                        <AlertCircle size={32} />
                    </div>
                    <div className="absolute -bottom-6 -left-6 bg-red-200/50 w-32 h-32 rounded-full blur-3xl"></div>
                </div>

                <div className="bg-white p-6 rounded-[24px] border border-gray-100 flex items-center justify-between shadow-soft">
                    <div>
                        <p className="text-slate-400 font-bold text-sm mb-1">آخر حركة</p>
                        <h2 className="text-xl font-black text-slate-800">
                            {supplier.lastTransactionDate?.toDate().toLocaleDateString('ar-DZ') || "---"}
                        </h2>
                        <p className="text-xs text-slate-400 font-bold mt-1">
                            {supplier.lastTransactionDate?.toDate().toLocaleTimeString('ar-DZ') || ""}
                        </p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-full text-slate-500">
                        <Calendar size={24} />
                    </div>
                </div>
            </div>

            {/* Actions Bar */}
            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={() => setIsInvoiceModalOpen(true)}
                    className="bg-slate-900 text-white p-4 rounded-2xl font-black text-lg shadow-lg shadow-slate-900/20 active:scale-95 transition flex items-center justify-center gap-2 hover:bg-slate-800"
                >
                    <Plus size={20} /> تسجيل فاتورة (دين جديد)
                </button>
                <button
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="bg-emerald-500 text-white p-4 rounded-2xl font-black text-lg shadow-lg shadow-emerald-500/20 active:scale-95 transition flex items-center justify-center gap-2 hover:bg-emerald-600"
                >
                    <Banknote size={20} /> تسجيل دفعة (سداد)
                </button>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-[24px] border border-gray-100 shadow-soft overflow-hidden min-h-[400px]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <FileText size={20} className="text-blue-500" /> كشف حساب تفصيلي
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={() => window.print()} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 print:hidden">طباعة الكشف</button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-bold">
                                <th className="px-4 py-3 border-l border-slate-200 w-32">التاريخ</th>
                                <th className="px-4 py-3 border-l border-slate-200 w-24">الوقت</th>
                                <th className="px-4 py-3 border-l border-slate-200 bg-red-50 text-red-700 w-32">مشتريات (عليه)</th>
                                <th className="px-4 py-3 border-l border-slate-200 bg-emerald-50 text-emerald-700 w-32">مدفوعات (له)</th>
                                <th className="px-4 py-3 border-l border-slate-200 bg-slate-100 text-slate-800 w-32">الرصيد (الباقي)</th>
                                <th className="px-4 py-3 border-l border-slate-200">ملاحظات</th>
                                <th className="px-4 py-3 w-20">صورة</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-bold">
                            {transactions
                                .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)) // Ascending for Calculation
                                .reduce((acc, curr, index) => {
                                    // Calculate Running Balance
                                    const prevBalance = index === 0 ? 0 : acc[index - 1].runningBalance;

                                    // If Invoice: Debt increases by amount, but decreases by any 'paymentAmount' recorded on it.
                                    // If Payment: Debt decreases by amount.
                                    let change = 0;
                                    if (curr.type === 'invoice') {
                                        change = curr.amount - (curr.paymentAmount || 0);
                                    } else if (curr.type === 'payment') {
                                        change = -curr.amount;
                                    } else if (curr.type === 'old_debt' || curr.type === 'opening_balance') {
                                        change = curr.amount;
                                    }

                                    const newBalance = prevBalance + change;

                                    acc.push({ ...curr, runningBalance: newBalance });
                                    return acc;
                                }, [])
                                .map((item, index) => (
                                    <tr key={item.id} className={`border-b border-slate-100 hover:bg-yellow-50 transition ${item.type === 'invoice' ? 'bg-red-50/10' : 'bg-emerald-50/10'}`}>
                                        <td className="px-4 py-3 border-l border-slate-100 text-slate-600 tabular-nums">
                                            {item.createdAt?.toDate().toLocaleDateString('en-GB')}
                                        </td>
                                        <td className="px-4 py-3 border-l border-slate-100 text-slate-400 text-xs tabular-nums">
                                            {item.createdAt?.toDate().toLocaleTimeString('en-GB')}
                                        </td>
                                        <td className="px-4 py-3 border-l border-slate-100 text-red-600 tabular-nums bg-red-50/20">
                                            {item.type === 'invoice' ? item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}
                                        </td>
                                        <td className="px-4 py-3 border-l border-slate-100 text-emerald-600 tabular-nums bg-emerald-50/20">
                                            {item.type === 'payment'
                                                ? item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })
                                                : (item.paymentAmount ? item.paymentAmount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-')}
                                        </td>
                                        <td className="px-4 py-3 border-l border-slate-100 text-slate-800 tabular-nums font-black bg-slate-50">
                                            {item.runningBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="px-4 py-3 border-l border-slate-100 text-slate-600 truncate max-w-[200px]" title={item.note}>
                                            {item.note || '-'}
                                        </td>
                                        <td className="px-4 py-3 flex justify-center gap-2">
                                            <button
                                                onClick={() => setSelectedTransactionForAdd(item)}
                                                className={`p-1.5 border border-slate-200 rounded-lg shadow-sm transition ${item.type === 'invoice'
                                                    ? 'bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 text-emerald-600'
                                                    : 'bg-white hover:border-blue-400 text-slate-500 hover:text-blue-500'
                                                    }`}
                                                title={item.type === 'invoice' ? "سداد جزء من الفاتورة" : "إضافة مبلغ"}
                                            >
                                                {item.type === 'invoice' ? <Banknote size={16} /> : <Plus size={16} />}
                                            </button>
                                            <button
                                                onClick={() => setSelectedTransaction(item)}
                                                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:border-blue-400 text-slate-500 hover:text-blue-500 shadow-sm transition"
                                                title="عرض التفاصيل"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button
                                                onClick={() => setSelectedTransactionForEdit(item)}
                                                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:border-indigo-400 text-slate-500 hover:text-indigo-500 shadow-sm transition"
                                                title="تعديل"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTransaction(item)}
                                                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:border-red-400 text-slate-500 hover:text-red-500 shadow-sm transition"
                                                title="حذف"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            {item.imageUrl && (
                                                <button
                                                    onClick={() => setPreviewImage(item.imageUrl)}
                                                    className="p-1.5 bg-white border border-slate-200 rounded-lg hover:border-blue-400 text-blue-500 shadow-sm transition"
                                                    title="عرض الوصل"
                                                >
                                                    <ImageIcon size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}

                            {transactions.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="text-center py-20 text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <FileText size={32} className="opacity-20" />
                                            <p>لا توجد سجلات</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="bg-slate-100 border-t-2 border-slate-200 text-sm font-black">
                            <tr>
                                <td colSpan="2" className="px-4 py-3 text-center text-slate-600">الإجمالـــي</td>
                                <td className="px-4 py-3 text-red-700 ltr text-right">
                                    {transactions
                                        .filter(t => t.type === 'invoice')
                                        .reduce((sum, t) => sum + t.amount, 0)
                                        .toLocaleString(undefined, { maximumFractionDigits: 0 })
                                    }
                                </td>
                                <td className="px-4 py-3 text-emerald-700 ltr text-right">
                                    {transactions
                                        .reduce((sum, t) => {
                                            if (t.type === 'payment') return sum + t.amount;
                                            if (t.type === 'invoice') return sum + (t.paymentAmount || 0);
                                            return sum;
                                        }, 0)
                                        .toLocaleString(undefined, { maximumFractionDigits: 0 })
                                    }
                                </td>
                                <td className="px-4 py-3 text-slate-900 bg-slate-200 ltr text-right">
                                    {/* Calculated Total Balance consistent with table */}
                                    {transactions.reduce((acc, curr) => {
                                        if (curr.type === 'invoice') return acc + (curr.amount - (curr.paymentAmount || 0));
                                        if (curr.type === 'payment') return acc - curr.amount;
                                        if (curr.type === 'old_debt' || curr.type === 'opening_balance') return acc + curr.amount;
                                        return acc;
                                    }, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </td>
                                <td colSpan="2"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Modals */}
            <SupplierInvoiceModal
                isOpen={isInvoiceModalOpen}
                onClose={() => setIsInvoiceModalOpen(false)}
                supplier={supplier}
            />

            <SupplierPaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                supplier={supplier}
            />

            <AddToTransactionModal
                isOpen={!!selectedTransactionForAdd}
                onClose={() => setSelectedTransactionForAdd(null)}
                supplier={supplier}
                transaction={selectedTransactionForAdd}
            />

            <EditTransactionModal
                isOpen={!!selectedTransactionForEdit}
                onClose={() => setSelectedTransactionForEdit(null)}
                supplier={supplier}
                transaction={selectedTransactionForEdit}
            />

            {/* Transaction Details Modal */}
            {selectedTransaction && (
                <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setSelectedTransaction(null)}>
                    <div className="bg-white rounded-[32px] w-full max-w-lg p-8 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                        <div className="absolute top-6 right-6 flex gap-2">
                            <button
                                onClick={() => {
                                    const printUrl = `/admin/print/transaction/${selectedTransaction.id}?type=supplier&userId=${supplier.id}`;
                                    const width = 800;
                                    const height = window.screen.height;
                                    const left = (window.screen.width - width) / 2;
                                    const top = 0;
                                    window.open(printUrl, 'print_popup', `width=${width},height=${height},left=${left},top=${top}`);
                                }}
                                className="text-slate-400 hover:text-blue-600 p-2 rounded-full hover:bg-slate-50 transition"
                                title="طباعة إيصال"
                            >
                                <Printer size={24} />
                            </button>
                            <button
                                onClick={() => setSelectedTransaction(null)}
                                className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50 transition"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex flex-col items-center mb-6">
                            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-4 ${selectedTransaction.type === 'invoice' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                {selectedTransaction.type === 'invoice' ? <FileText size={40} /> : <Banknote size={40} />}
                            </div>
                            <h2 className="text-2xl font-black text-slate-800">
                                {selectedTransaction.type === 'invoice' ? 'تفاصيل الفاتورة' : 'تفاصيل الدفعة'}
                            </h2>
                            <p className="text-slate-500 font-bold mt-1">
                                {selectedTransaction.createdAt?.toDate().toLocaleDateString('ar-DZ')}
                            </p>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-slate-50 p-6 rounded-2xl flex justify-between items-center border border-slate-100">
                                <span className="text-slate-500 font-bold">المبلغ</span>
                                <span className={`text-3xl font-black ${selectedTransaction.type === 'invoice' ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {selectedTransaction.amount.toLocaleString()} <span className="text-sm text-slate-400">دج</span>
                                </span>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-400 mb-2">التفاصيل</label>
                                {['weight', 'weight_multi'].includes(selectedTransaction.details?.system) ? (
                                    <div className="space-y-4">
                                        {(selectedTransaction.details.system === 'weight_multi'
                                            ? selectedTransaction.details.groups
                                            : [selectedTransaction.details] // Treat legacy as single group
                                        ).map((group, idx) => (
                                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                                                {/* Group Header if Multi */}
                                                {selectedTransaction.details.system === 'weight_multi' && selectedTransaction.details.groups.length > 1 && (
                                                    <div className="bg-slate-200 px-4 py-2 text-xs font-bold text-slate-700 border-b border-slate-200 flex justify-between items-center">
                                                        <span>مجموعة #{idx + 1}</span>
                                                        <span className="text-emerald-700">الإجمالي: {Number(group.total || 0).toLocaleString()} دج</span>
                                                    </div>
                                                )}

                                                {/* Main Stats Grid */}
                                                <div className="grid grid-cols-2 divide-x divide-x-reverse divide-slate-200 border-b border-slate-200">
                                                    <div className="p-4 text-center">
                                                        <div className="text-xs font-bold text-slate-500 mb-1">الوزن القائم</div>
                                                        <div className="font-black text-xl text-slate-800">{Number(group.grossWeight).toLocaleString()} <span className="text-xs">كغ</span></div>
                                                    </div>
                                                    <div className="p-4 text-center">
                                                        <div className="text-xs font-bold text-slate-500 mb-1">الوزن الصافي</div>
                                                        <div className="font-black text-xl text-emerald-600">{Number(group.netWeight).toLocaleString()} <span className="text-xs">كغ</span></div>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-200 border-b border-slate-200 bg-slate-50/50">
                                                    <div className="p-3 text-center">
                                                        <div className="text-[10px] font-bold text-slate-400 mb-0.5">الصناديق</div>
                                                        <div className="font-bold text-slate-700">{group.boxCount}</div>
                                                    </div>
                                                    <div className="p-3 text-center">
                                                        <div className="text-[10px] font-bold text-slate-400 mb-0.5">التارة</div>
                                                        <div className="font-bold text-slate-700">{group.boxTare}</div>
                                                    </div>
                                                    <div className="p-3 text-center">
                                                        <div className="text-[10px] font-bold text-slate-400 mb-0.5">سعر الكيلو</div>
                                                        <div className="font-bold text-slate-700">{Number(group.pricePerKg).toLocaleString()}</div>
                                                    </div>
                                                </div>

                                                {/* Batches */}
                                                {group.batches && group.batches.length > 0 && (
                                                    <div className="p-4 bg-white">
                                                        <div className="text-xs font-bold text-slate-400 mb-2">الدفعات (الأوزان)</div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {group.batches.map((b, i) => (
                                                                <span key={i} className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-slate-600">
                                                                    {b}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-700 font-medium leading-relaxed min-h-[100px]">
                                        {selectedTransaction.note || "لا توجد ملاحظات"}
                                    </div>
                                )}
                            </div>

                            {selectedTransaction.imageUrl && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-400 mb-2">صورة المرفق</label>
                                    <div
                                        className="relative h-48 bg-slate-100 rounded-2xl overflow-hidden cursor-pointer border border-slate-200 hover:border-blue-500 transition group"
                                        onClick={() => {
                                            setPreviewImage(selectedTransaction.imageUrl);
                                            setSelectedTransaction(null); // Close details, open preview
                                        }}
                                    >
                                        <img
                                            src={selectedTransaction.imageUrl}
                                            alt="Attachment"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                            <p className="text-white font-bold flex items-center gap-2"><ExternalLink size={20} /> تكبير الصورة</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Image Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setPreviewImage(null)}>
                    <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
                        <button className="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full hover:bg-white/20">
                            <X size={24} />
                        </button>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewImage} alt="Receipt" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
                        <a href={previewImage} target="_blank" className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white text-black px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-gray-200 transition shadow-xl" onClick={(e) => e.stopPropagation()}>
                            <ExternalLink size={20} /> فتح الصورة الأصلية
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
