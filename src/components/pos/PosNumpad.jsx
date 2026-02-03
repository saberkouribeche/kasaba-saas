import { Delete } from 'lucide-react';

export default function PosNumpad({ onInput, onDelete, onClear, className = "" }) {
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0];

    return (
        <div className={`grid grid-cols-3 gap-2 ${className}`}>
            {keys.map(k => (
                <button
                    key={k}
                    onClick={() => onInput(k)}
                    className="h-14 rounded-2xl bg-white border border-gray-100 font-black text-xl text-slate-700 shadow-sm hover:shadow-md hover:bg-gray-50 active:scale-95 transition-all duration-200"
                >
                    {k}
                </button>
            ))}
            <button
                onClick={onDelete}
                className="h-14 rounded-2xl bg-red-50 border border-red-100 font-bold text-red-500 shadow-sm hover:bg-red-100 active:scale-95 transition-all duration-200 flex items-center justify-center"
            >
                <Delete size={20} />
            </button>
        </div>
    );
}
