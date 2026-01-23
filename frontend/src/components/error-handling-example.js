import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Example component showing how to use the enhanced error handling
import { useState } from 'react';
import { ErrorDisplay, InlineErrorDisplay } from './error-display';
import { LoadingSpinner, LoadingButton } from './loading-states';
import { OfflineBanner } from './offline-banner';
import { useRetry } from '@/hooks/use-retry';
import { useOnline } from '@/hooks/use-online';
import { jobApi } from '@/api/client';
/**
 * Example component demonstrating enhanced error handling
 * This shows best practices for using the error handling utilities
 */
export function ErrorHandlingExample() {
    const [jobs, setJobs] = useState([]);
    const isOnline = useOnline();
    // Example: Using retry hook with API call
    const { execute, loading, error, retryCount } = useRetry(async () => {
        const result = await jobApi.list();
        setJobs(result);
        return result;
    }, {
        maxRetries: 3,
        onRetry: (attempt) => {
            console.log(`Retrying... Attempt ${attempt}`);
        },
        onSuccess: () => {
            console.log('Successfully loaded jobs');
        },
        onFailure: (err) => {
            console.error('Failed after all retries:', err);
        },
    });
    return (_jsxs("div", { className: "space-y-4", children: [_jsx(OfflineBanner, {}), error && (_jsx(ErrorDisplay, { error: error, onRetry: execute, showTechnicalDetails: false })), loading && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(LoadingSpinner, { size: "sm" }), _jsx("span", { className: "text-sm text-muted-foreground", children: retryCount > 0 ? `Retrying... (${retryCount}/3)` : 'Loading...' })] })), _jsx(LoadingButton, { loading: loading, onClick: execute, disabled: !isOnline, children: loading ? 'Loading...' : 'Load Jobs' }), jobs.length > 0 && (_jsx("div", { children: _jsxs("h3", { children: ["Jobs (", jobs.length, ")"] }) }))] }));
}
/**
 * Example: Inline error display for forms
 */
export function FormWithErrorHandling() {
    const [error, setError] = useState(null);
    const { execute, loading } = useRetry(async () => {
        // Form submission logic
        await jobApi.create({ /* job data */});
    }, { maxRetries: 2 });
    return (_jsxs("form", { onSubmit: (e) => {
            e.preventDefault();
            execute().catch(setError);
        }, children: [error && (_jsx(InlineErrorDisplay, { error: error, onRetry: execute })), _jsx(LoadingButton, { type: "submit", loading: loading, children: "Submit" })] }));
}
