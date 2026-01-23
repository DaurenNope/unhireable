import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { WifiOff } from 'lucide-react';
export function OfflineBanner() {
    return (_jsxs(Alert, { variant: "default", className: "border-yellow-500 bg-yellow-50 dark:bg-yellow-950", children: [_jsx(WifiOff, { className: "h-4 w-4" }), _jsx(AlertTitle, { children: "You're offline" }), _jsx(AlertDescription, { children: "Some features may not be available. Please check your internet connection." })] }));
}
