import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
export class ErrorBoundary extends Component {
    constructor() {
        super(...arguments);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
        this.handleReset = () => {
            this.setState({
                hasError: false,
                error: null,
                errorInfo: null,
            });
            window.location.reload();
        };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error, errorInfo: null };
    }
    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error,
            errorInfo,
        });
    }
    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (_jsx("div", { className: "flex min-h-screen items-center justify-center p-4", children: _jsxs(Alert, { variant: "destructive", className: "max-w-2xl", children: [_jsx(AlertCircle, { className: "h-5 w-5" }), _jsx(AlertTitle, { className: "text-lg font-semibold", children: "Something went wrong" }), _jsxs(AlertDescription, { className: "mt-2", children: [_jsx("p", { className: "mb-4", children: "An unexpected error occurred. Please try refreshing the page or contact support if the issue persists." }), this.state.error && (_jsxs("details", { className: "mt-4", children: [_jsx("summary", { className: "cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground", children: "Error Details" }), _jsxs("pre", { className: "mt-2 overflow-auto rounded-md bg-muted p-4 text-xs", children: [this.state.error.toString(), this.state.errorInfo?.componentStack] })] })), _jsx("div", { className: "mt-4", children: _jsxs(Button, { onClick: this.handleReset, variant: "outline", className: "gap-2", children: [_jsx(RefreshCw, { className: "h-4 w-4" }), "Reload Page"] }) })] })] }) }));
        }
        return this.props.children;
    }
}
