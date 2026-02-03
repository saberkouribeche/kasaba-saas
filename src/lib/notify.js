import toast from 'react-hot-toast';
import Swal from 'sweetalert2';

export const notify = {
    success: (msg) => toast.success(msg, { duration: 3000, position: 'top-center', style: { borderRadius: '16px', fontWeight: 'bold' } }),
    error: (msg) => toast.error(msg, { duration: 4000, position: 'top-center', style: { borderRadius: '16px', fontWeight: 'bold' } }),
    loading: (msg) => toast.loading(msg, { position: 'top-center', style: { borderRadius: '16px', fontWeight: 'bold' } }),
    dismiss: (id) => toast.dismiss(id),

    // Custom styled confirmation
    confirm: async (title, text, confirmButtonText = 'نعم، تنفيد', cancelButtonText = 'إلغاء') => {
        const result = await Swal.fire({
            title,
            text,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#10B981', // green-500
            cancelButtonColor: '#d33',
            confirmButtonText,
            cancelButtonText,
            width: 400,
            padding: '2em',
            customClass: {
                popup: 'rounded-3xl',
                confirmButton: 'rounded-xl px-6 py-2 font-bold',
                cancelButton: 'rounded-xl px-6 py-2 font-bold',
                title: 'font-black text-xl mb-2',
                htmlContainer: 'text-gray-500'
            }
        });
        return result.isConfirmed;
    },

    // Custom styled prompt
    prompt: async (title, placeholder = '', confirmButtonText = 'حفظ') => {
        const result = await Swal.fire({
            title,
            input: 'text',
            inputPlaceholder: placeholder,
            showCancelButton: true,
            confirmButtonText,
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#10B981',
            cancelButtonColor: '#d33',
            customClass: {
                popup: 'rounded-3xl',
                confirmButton: 'rounded-xl px-6 py-2 font-bold',
                cancelButton: 'rounded-xl px-6 py-2 font-bold',
                title: 'font-black text-xl mb-4',
                input: 'rounded-xl border border-gray-300 p-2 text-right'
            }
        });
        return result.value;
    }
};
