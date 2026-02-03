import { useState, useEffect } from 'react';
import { notify } from '@/lib/notify';

export function useNativeScale() {
    const [isNative, setIsNative] = useState(false);
    const [ports, setPorts] = useState([]);
    const [connectedPort, setConnectedPort] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.kasabaNative) {
            setIsNative(true);

            // Listen for errors
            window.kasabaNative.onScaleError((error) => {
                notify.error(`خطأ في الميزان: ${error}`);
                setConnectedPort(null);
            });
        }
    }, []);

    const listPorts = async () => {
        if (!isNative) return;
        setLoading(true);
        const result = await window.kasabaNative.listPorts();
        if (result.success) {
            console.log("Ports:", result.ports);
            setPorts(result.ports);
        } else {
            notify.error("فشل في جلب المنافذ");
        }
        setLoading(false);
    };

    const [status, setStatus] = useState("disconnected");

    const connectToScale = async (path) => {
        if (!isNative) return;
        setLoading(true);
        setStatus("connecting");
        const result = await window.kasabaNative.connectToScale(path);

        if (result.success) {
            notify.success(`تم الاتصال بالميزان: ${path}`);
            setConnectedPort(path);
            setStatus("connected");
        } else {
            notify.error(`فشل الاتصال: ${result.error}`);
            setStatus("error");
        }
        setLoading(false);
    };

    const testConnection = async () => {
        if (!connectedPort) {
            notify.error("غير متصل بأي ميزان");
            return;
        }
        const result = await window.kasabaNative.testConnection();
        if (result.success) {
            notify.success("✅ تم إرسال بيانات الاختبار بنجاح");
        } else {
            notify.error("❌ فشل الاختبار");
        }
    };

    const syncProducts = async (products) => {
        if (!connectedPort) {
            notify.error("يرجى الاتصال بالميزان أولاً");
            return;
        }

        let successCount = 0;
        let failCount = 0;

        setLoading(true);
        notify.loading("جاري مزامنة المنتجات للميزان...");

        for (const p of products) {
            // Must have barcode/PLU
            if (!p.barcode) continue;

            // Format Logic: PLU,Name,Price,UnitCode
            // 1. PLU/Barcode
            const plu = p.barcode;

            // 2. Name: Truncate to 15 chars, remove commas to break CSV
            const cleanTitle = (p.title || "Unknown").replace(/,/g, " ").substring(0, 15);

            // 3. Price: Integer
            const price = Math.round(Number(p.price) || 0);

            // 4. UnitCode: 4 for Weight (kg), 1 for Unit (pcs)
            // Logic: !isLandingPage => Sold by Weight => 4
            const unitCode = !p.isLandingPage ? 4 : 1;

            // Header line + Content? No, just raw CSV lines as requested.
            // Terminator: \r\n
            const line = `${plu},${cleanTitle},${price},${unitCode}\r\n`;

            const res = await window.kasabaNative.sendToScale(line);
            if (res.success) successCount++;
            else failCount++;
        }

        notify.dismiss();
        if (successCount > 0) notify.success(`✅ تمت مزامنة ${successCount} منتج`);
        if (failCount > 0) notify.error(`⚠️ فشل إرسال ${failCount} منتج`);
        setLoading(false);
    };

    return {
        isSupported: isNative,
        isConnected: !!connectedPort,
        ports,
        connectedPort,
        status,
        loading,
        refreshPorts: listPorts,
        connect: connectToScale,
        syncProducts,
        testConnection
    };
}
