"use client";
import { X, FileText } from "lucide-react";
import { formatPrice } from "@/lib/formatters";

export default function TransactionDetailsModal({ isOpen, onClose, transaction }) {
    if (!isOpen || !transaction) return null;

    const dateObj = transaction.createdAt?.toDate ? transaction.createdAt.toDate() : new Date();

    // Data Extraction & Fallback Logic (Preserved)
    const groups = transaction.details?.groups || transaction.groups || [];
    const hasGroups = groups.length > 0;
    const hasItems = transaction.items && transaction.items.length > 0;

    let grossWeight, netWeight, tara, boxes, pricePerKg;

    if (hasGroups) {
        grossWeight = groups.reduce((sum, g) => sum + (Number(g.grossWeight) || 0), 0);
        netWeight = groups.reduce((sum, g) => sum + (Number(g.netWeight) || 0), 0);
        tara = groups.reduce((sum, g) => sum + (Number(g.tara) || 0), 0);
        boxes = groups.reduce((sum, g) => sum + (Number(g.boxes) || 0), 0);

        // Weighted Average Price or Fallback
        if (groups.length === 1) {
            pricePerKg = Number(groups[0].pricePerKg || 0);
        } else {
            const totalAmount = groups.reduce((sum, g) => sum + (Number(g.total) || 0), 0);
            pricePerKg = netWeight > 0 ? totalAmount / netWeight : 0;
        }
    } else {
        grossWeight = Number(transaction.grossWeight || 0);
        netWeight = Number(transaction.netWeight || 0);
        tara = Number(transaction.tara || 0);
        boxes = Number(transaction.boxes || 0);
        pricePerKg = Number(transaction.pricePerKg || 0);

        if (pricePerKg === 0 && netWeight > 0) {
            pricePerKg = Number(transaction.amount || 0) / netWeight;
        }
    }

    const bunches = transaction.batchWeights || [];
    // Flatten batches from groups if mainly viewing groups
    const batchList = hasGroups
        ? groups.flatMap(g => g.batches || [])
        : bunches;


    return (
        <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-[480px] overflow-hidden relative flex flex-col max-h-[90vh]">
                <button onClick={onClose} className="absolute top-6 left-6 text-slate-400 hover:text-slate-600 transition"><X size={28} /></button>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-8 pt-10 text-center">
                        {/* Header Icon */}
                        <div className="w-20 h-20 bg-red-50 rounded-[24px] flex items-center justify-center mx-auto mb-4 text-red-600">
                            <FileText size={32} strokeWidth={2.5} />
                        </div>

                        <h3 className="text-2xl font-bold text-slate-800 mb-2">تفاصيل الفاتورة</h3>
                        <p className="text-slate-400 font-bold text-sm tracking-wide">{dateObj.toLocaleDateString('en-GB')}</p>

                        {/* Total Amount Card */}
                        <div className="mt-8 bg-slate-50 rounded-[28px] p-6 flex items-center justify-between">
                            <span className="text-slate-400 font-bold text-lg">المبلغ</span>
                            <div className="text-red-600 font-bold text-4xl tracking-tight dir-ltr">
                                {formatPrice(transaction.amount)}
                            </div>
                        </div>

                        {/* Details Grid */}
                        <p className="text-right text-slate-400 font-bold text-sm mt-8 mb-4 px-2">التفاصيل</p>

                        {hasItems ? (
                            <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                                <div className="bg-slate-100 px-4 py-2 flex text-xs font-black text-slate-500 gap-2">
                                    <div className="flex-[3] text-right">المنتج</div>
                                    <div className="flex-1 text-center">الكمية</div>
                                    <div className="flex-1 text-center">التكلفة</div>
                                    <div className="flex-1 text-center">الإجمالي</div>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {transaction.items.map((item, idx) => (
                                        <div key={idx} className="px-4 py-3 flex text-xs font-bold text-slate-700 items-center gap-2 bg-white">
                                            <div className="flex-[3] text-right truncate">{item.productName}</div>
                                            <div className="flex-1 text-center">{item.qty}</div>
                                            <div className="flex-1 text-center">{formatPrice(item.cost)}</div>
                                            <div className="flex-1 text-center font-black">{formatPrice(item.total)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : hasGroups ? (
                            <div className="space-y-4">
                                {groups.map((group, idx) => (
                                    <div key={idx} className="border-2 border-slate-100 rounded-[24px] overflow-hidden bg-white">
                                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                                            <span className="text-xs font-bold text-slate-500">مجموعة #{idx + 1}</span>
                                            <span className="text-xs font-bold text-slate-400">
                                                {formatPrice(group.total || 0)}
                                            </span>
                                        </div>

                                        {/* Main Stats (Net & Gross) */}
                                        <div className="flex divide-x divide-x-reverse divide-slate-100 border-b border-slate-100">
                                            <div className="flex-1 p-3 text-center">
                                                <span className="block text-[10px] text-slate-400 font-bold mb-1">الصافي</span>
                                                <span className="block text-emerald-600 font-bold text-lg">{Number(group.netWeight).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px]">كغ</span></span>
                                            </div>
                                            <div className="flex-1 p-3 text-center">
                                                <span className="block text-[10px] text-slate-400 font-bold mb-1">القائم</span>
                                                <span className="block text-slate-700 font-bold text-lg">{Number(group.grossWeight).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px]">كغ</span></span>
                                            </div>
                                        </div>

                                        {/* Secondary Stats (Price, Tara, Boxes) */}
                                        <div className="flex divide-x divide-x-reverse divide-slate-100 bg-slate-50/50">
                                            <div className="flex-1 p-2 text-center">
                                                <span className="block text-[9px] text-slate-400 font-bold">سعر/كغ</span>
                                                <span className="block text-slate-700 font-bold">{formatPrice(group.pricePerKg)}</span>
                                            </div>
                                            <div className="flex-1 p-2 text-center">
                                                <span className="block text-[9px] text-slate-400 font-bold">تارة</span>
                                                <span className="block text-slate-700 font-bold">{Number((Number(group.boxCount || 0) * Number(group.boxTare || 0))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex-1 p-2 text-center">
                                                <span className="block text-[9px] text-slate-400 font-bold">صناديق</span>
                                                <span className="block text-slate-700 font-bold">{group.boxCount}</span>
                                            </div>
                                        </div>

                                        {/* Batches */}
                                        {group.batches?.length > 0 && (
                                            <div className="p-3 border-t border-slate-100">
                                                <div className="flex flex-wrap gap-1.5 justify-end">
                                                    {group.batches.map((b, i) => (
                                                        <span key={i} className="bg-slate-50 text-slate-600 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-slate-100 shadow-sm">
                                                            {Number(b).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="border-2 border-slate-100 rounded-[28px] overflow-hidden">
                                {/* Row 1: Net & Gross */}
                                <div className="flex divide-x divide-x-reverse divide-slate-100 border-b border-slate-100">
                                    <div className="flex-1 p-5 text-center">
                                        <span className="block text-slate-400 text-xs font-bold mb-1">الوزن القائم</span>
                                        <span className="block text-slate-800 font-bold text-2xl dir-ltr">{grossWeight.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm text-slate-400">كغ</span></span>
                                    </div>
                                    <div className="flex-1 p-5 text-center">
                                        <span className="block text-slate-400 text-xs font-bold mb-1">الوزن الصافي</span>
                                        <span className="block text-emerald-600 font-bold text-2xl dir-ltr">{netWeight.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm text-slate-400">كغ</span></span>
                                    </div>
                                </div>

                                {/* Row 2: Price, Tara, Boxes */}
                                <div className="flex divide-x divide-x-reverse divide-slate-100 border-b border-slate-100 bg-slate-50/50">
                                    <div className="flex-1 p-4 text-center">
                                        <span className="block text-slate-400 text-[10px] font-bold mb-1">الصناديق</span>
                                        <span className="block text-slate-800 font-bold text-lg">{boxes}</span>
                                    </div>
                                    <div className="flex-1 p-4 text-center">
                                        <span className="block text-slate-400 text-[10px] font-bold mb-1">التارة</span>
                                        <span className="block text-slate-800 font-bold text-lg">{tara.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex-1 p-4 text-center">
                                        <span className="block text-slate-400 text-[10px] font-bold mb-1">سعر الكيلو</span>
                                        <span className="block text-slate-800 font-bold text-lg">{formatPrice(Number(pricePerKg))}</span>
                                    </div>
                                </div>

                                {/* Row 3: Batches (Horizontal Scroll or Wrap) - Only if exists */}
                                {batchList.length > 0 && (
                                    <div className="p-4 bg-white">
                                        <span className="block text-slate-400 text-[10px] font-bold mb-3 text-right">الدفعات (الأوزان)</span>
                                        <div className="flex flex-wrap gap-2 justify-end">
                                            {batchList.map((w, idx) => (
                                                <span key={idx} className="bg-slate-50 text-slate-600 px-4 py-2 rounded-[20px] text-sm font-bold border border-slate-200 shadow-sm">
                                                    {Number(w).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* If empty */}
                                {(!batchList || batchList.length === 0) && (
                                    <div className="p-4 bg-white text-center">
                                        <span className="text-slate-300 font-bold text-xs">لا توجد تفاصيل دفعات</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
