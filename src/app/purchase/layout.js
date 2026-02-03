import "@/app/globals.css";

export const metadata = {
    title: "إدخال السلعة",
    description: "بوابة المشتريات للموظفين",
};

export default function PurchaseLayout({ children }) {
    return (
        <html lang="ar" dir="rtl">
            <body className="antialiased bg-slate-50">
                {children}
            </body>
        </html>
    );
}
