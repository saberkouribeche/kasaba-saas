"use client";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ThermalReceipt from "@/components/admin/ThermalReceipt";
import { useParams } from "next/navigation"; // Correct hook for App Router params

export default function OrderPrintPage() {
    const { id } = useParams();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        const fetchOrder = async () => {
            try {
                const docRef = doc(db, "order", id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setOrder({ id: docSnap.id, ...docSnap.data() });
                }
            } catch (error) {
                console.error("Error fetching order for print:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchOrder();
    }, [id]);

    useEffect(() => {
        if (order && !loading) {
            // Small delay to ensure render is complete before printing
            const timer = setTimeout(() => {
                window.print();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [order, loading]);

    if (loading) return <div className="p-10 text-center font-bold">جاري تحميل الفاتورة...</div>;
    if (!order) return <div className="p-10 text-center text-red-500 font-bold">لم يتم العثور على الطلب</div>;

    // Map order data to formData structure expected by ThermalReceipt
    const formData = {
        customerName: order.customer_name || "",
        customerPhone: order.customer_phone || "",
        deliveryArea: order.delivery_area || "",
        addressDetails: order.address || order.delivery_address_details || "",
        items: order.order_items ? [...order.order_items] : [],
        deliveryFee: Number(order.delivery_fee || order.delivery_price || 0),
        status: order.order_status || "pending",
        notes: order.order_notes || order.notes || ""
    };

    const subtotal = formData.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const total = subtotal + formData.deliveryFee;

    return (
        <div className="bg-white min-h-screen flex justify-center items-start pt-10">
            <ThermalReceipt
                order={order}
                formData={formData}
                subtotal={subtotal}
                total={total}
                isPrintPage={true}
            />
        </div>
    );
}
