"use client";
import { useCart } from "@/context/CartContext";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { usePathname } from "next/navigation";

export default function FloatingCartSummary() {
    const { cart, cartTotal, setIsDrawerOpen, isDrawerOpen } = useCart();
    const pathname = usePathname();

    // Only show on Home Page
    if (pathname !== "/") return null;

    // Hide if drawer is already open (avoid overlap)
    if (isDrawerOpen) return null;

    if (cart.length === 0) return null;

    return (
        <div className="fixed bottom-[20px] left-[20px] right-[20px] z-[9999] animate-slide-up">
            <div
                onClick={() => setIsDrawerOpen(true)}
                className="bg-red-600 text-white p-4 rounded-[15px] shadow-2xl flex items-center justify-between cursor-pointer active:scale-95 transition-transform"
            >
                {/* Left Side: Total Price */}
                <div className="flex flex-col">
                    <span className="text-xs font-medium text-red-100 opacity-90">المجموع الكلي</span>
                    <span className="font-black text-xl">{cartTotal.toLocaleString()} دج</span>
                </div>

                {/* Right Side: Checkout Button */}
                <div className="flex items-center gap-3 bg-red-700/30 px-4 py-2 rounded-xl">
                    <span className="font-bold text-sm">إتمام الطلب</span>
                    <ArrowRight size={18} />
                </div>
            </div>
        </div>
    );
}
