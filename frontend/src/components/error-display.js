import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { getUserFriendlyError } from '../utils/errors';
export function ErrorDisplay({ error, onRetry, onDismiss }) {
    const friendlyError = getUserFriendlyError(error);
    return (_jsxs(Alert, { variant: "destructive", className: "relative", children: [_jsx(AlertCircle, { className: "h-4 w-4" }), _jsx(AlertTitle, { children: friendlyError.title }), _jsxs(AlertDescription, { children: [friendlyError.message, friendlyError.retryable && onRetry && (_jsxs(Button, { variant: "outline", size: "sm", onClick: onRetry, className: "mt-2", children: [_jsx(RefreshCw, { className: "mr-2 h-4 w-4" }), friendlyError.action || 'Retry'] }))] }), onDismiss && (_jsx("button", { onClick: onDismiss, className: "absolute right-2 top-2 text-muted-foreground hover:text-foreground", "aria-label": "Dismiss error", children: _jsx(X, { className: "h-4 w-4" }) }))] }));
}
