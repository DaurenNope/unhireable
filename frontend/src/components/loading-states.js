import { jsx as _jsx } from "react/jsx-runtime";
import { Loader2 } from 'lucide-react';
export function LoadingSpinner({ size = 'default' }) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        default: 'h-6 w-6',
        lg: 'h-8 w-8',
    };
    return (_jsx(Loader2, { className: `${sizeClasses[size]} animate-spin` }));
}
export function LoadingOverlay() {
    return (_jsx("div", { className: "fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center", children: _jsx(LoadingSpinner, { size: "lg" }) }));
}
