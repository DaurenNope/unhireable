import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
export function CopyField({ label, value, className, showLabel = true }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        catch (err) {
            console.error('Failed to copy:', err);
        }
    };
    if (!value)
        return null;
    return (_jsxs("div", { className: cn('flex items-center gap-2 group', className), children: [showLabel && (_jsxs("span", { className: "text-sm text-muted-foreground min-w-[80px]", children: [label, ":"] })), _jsxs("div", { className: "flex-1 flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2", children: [_jsx("span", { className: "text-sm font-medium truncate flex-1", children: value }), _jsx(Button, { variant: "ghost", size: "sm", className: cn('h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity', copied && 'opacity-100'), onClick: handleCopy, children: copied ? (_jsxs(_Fragment, { children: [_jsx(Check, { className: "h-3.5 w-3.5 text-green-500 mr-1" }), _jsx("span", { className: "text-xs text-green-500", children: "Copied!" })] })) : (_jsxs(_Fragment, { children: [_jsx(Copy, { className: "h-3.5 w-3.5 mr-1" }), _jsx("span", { className: "text-xs", children: "Copy" })] })) })] })] }));
}
