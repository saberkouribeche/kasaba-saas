import { formatPrice } from "@/lib/formatters";

export default function TransactionStatusBadge({ totalAmount = 0, paidAmount = 0 }) {
    const remaining = totalAmount - paidAmount;

    // Tolerance for tiny decimals
    if (remaining <= 0.5) {
        return (
            <span className="text-emerald-600 font-bold">
                {formatPrice(0)}
            </span>
        );
    }

    if (paidAmount > 0) {
        return (
            <div className="flex flex-col items-start">
                <span className="text-amber-600 font-bold">{formatPrice(remaining)}</span>
                <span className="text-[10px] text-gray-400">متبقي (من {formatPrice(totalAmount)})</span>
            </div>
        );
    }

    return <span className="text-red-600 font-bold">{formatPrice(totalAmount)}</span>;
}
