"use client";
import { useState, useEffect, useMemo } from "react";
import { useAdminData } from "@/context/AdminDataContext";
import {
    calculateInventoryValue,
    calculateTotalReceivables,
    calculateTotalPayables,
    calculateNetWorth
} from "@/lib/financialUtils";
import {
    addTreasuryTransaction,
    subscribeToTreasury,
    subscribeToTreasuryBalance,
    saveFinancialSnapshot
} from "@/services/treasuryService";
import { getOpenShift } from "@/services/shiftService";
import { notify } from "@/lib/notify";
import { Loader2 } from "lucide-react";

import FinanceStats from "@/components/admin/finance/FinanceStats";
import TreasuryLedger from "@/components/admin/finance/TreasuryLedger";
import TreasuryActionModal from "@/components/admin/finance/TreasuryActionModal";
import ShiftControl from "@/components/admin/finance/ShiftControl";

export default function FinancePage() {
    const { products, suppliers, clients, loading: dataLoading } = useAdminData();

    // Treasury State
    const [transactions, setTransactions] = useState([]);
    const [balances, setBalances] = useState({ cash: 0, bank: 0 });
    const [treasuryLoading, setTreasuryLoading] = useState(true);

    // Modal State
    const [actionModal, setActionModal] = useState({ open: false, type: 'cash', operation: 'credit' });
    const [actionLoading, setActionLoading] = useState(false);
    const [snapshotLoading, setSnapshotLoading] = useState(false);

    // 1. Subscribe to Treasury Data
    useEffect(() => {
        const unsubTx = subscribeToTreasury((txs) => {
            setTransactions(txs);
            setTreasuryLoading(false);
        });

        const unsubBal = subscribeToTreasuryBalance((bal) => {
            setBalances(bal);
        });

        return () => {
            unsubTx();
            unsubBal();
        };
    }, []);

    // 2. Calculate Aggregates
    const stats = useMemo(() => {
        if (dataLoading) return {};

        const inventoryValue = calculateInventoryValue(products);
        const receivables = calculateTotalReceivables(clients);
        const payables = calculateTotalPayables(suppliers);

        const netWorth = calculateNetWorth({
            cash: balances.cash,
            bank: balances.bank,
            inventory: inventoryValue,
            receivables,
            payables
        });

        return {
            netWorth,
            inventoryValue,
            cashBalance: balances.cash,
            bankBalance: balances.bank,
            receivables,
            payables
        };
    }, [products, suppliers, clients, balances, dataLoading]);

    // 3. Handlers
    const handleActionOpen = (type, operation) => {
        setActionModal({ open: true, type, operation });
    };

    const handleActionSubmit = async ({ amount, description }) => {
        setActionLoading(true);
        try {
            // Check for open shift to link transaction
            let activeShiftId = null;
            try {
                const shift = await getOpenShift();
                if (shift) activeShiftId = shift.id;
            } catch (e) {
                console.warn("Could not fetch active shift", e);
            }

            await addTreasuryTransaction({
                type: actionModal.type,
                operation: actionModal.operation,
                amount,
                source: actionModal.operation === 'credit' ? 'manual_deposit' : 'manual_withdraw',
                description: description || (actionModal.operation === 'credit' ? 'إيداع يدوي' : 'سحب يدوي'),
                shiftId: activeShiftId
            });
            notify.success("تم تنفيذ العملية بنجاح");
            setActionModal({ ...actionModal, open: false });
        } catch (error) {
            console.error(error);
            notify.error("حدث خطأ أثناء العملية");
        } finally {
            setActionLoading(false);
        }
    };

    const handleSaveSnapshot = async () => {
        setSnapshotLoading(true);
        try {
            await saveFinancialSnapshot(stats);
            notify.success("تم حفظ اللقطة المالية بنجاح");
        } catch (error) {
            console.error(error);
            notify.error("فشل حفظ اللقطة");
        } finally {
            setSnapshotLoading(false);
        }
    };

    if (dataLoading || treasuryLoading) {
        return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" size={40} /></div>;
    }

    return (
        <div className="space-y-8 animate-fade-in pb-24 font-cairo">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">برج المراقبة المالي (Control Tower)</h1>
                <p className="text-slate-500 font-bold">نظرة شاملة ودقيقة على الوضع المالي للمؤسسة في الوقت الفعلي.</p>
            </div>

            <ShiftControl />

            <FinanceStats
                stats={stats}
                onOpenAction={handleActionOpen}
                onSaveSnapshot={handleSaveSnapshot}
                snapshotLoading={snapshotLoading}
            />

            <TreasuryLedger transactions={transactions} />

            <TreasuryActionModal
                isOpen={actionModal.open}
                onClose={() => setActionModal({ ...actionModal, open: false })}
                actionType={actionModal}
                onSubmit={handleActionSubmit}
                loading={actionLoading}
            />
        </div>
    );
}
