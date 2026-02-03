"use client";
import { Loader2 } from "lucide-react";

export default function SplashScreen() {
    return (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="relative w-32 h-32 mb-8 animate-pulse">
                <div className="absolute inset-0 bg-red-100 rounded-full animate-ping opacity-20"></div>
                <div className="relative bg-white p-6 rounded-full shadow-xl shadow-red-100 border border-red-50 flex items-center justify-center h-full w-full">
                    <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
            </div>
            <Loader2 className="animate-spin text-slate-400 mb-4" size={32} />
            <p className="text-slate-400 font-bold tracking-widest text-sm animate-pulse">JARI TAHMIL...</p>
        </div>
    );
}
