import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from './button';
import { cn } from '@/lib/utils';
export function EmptyState({ icon: Icon, title, description, action, secondaryAction, className, children, }) {
    return (_jsxs("div", { className: cn('flex flex-col items-center justify-center py-12 px-4 text-center', className), children: [Icon && (_jsx("div", { className: "mb-4 rounded-full bg-muted p-4", children: _jsx(Icon, { className: "h-8 w-8 text-muted-foreground" }) })), _jsx("h3", { className: "text-lg font-semibold text-foreground mb-2", children: title }), _jsx("p", { className: "text-sm text-muted-foreground max-w-md mb-6", children: description }), children, (action || secondaryAction) && (_jsxs("div", { className: "flex flex-col sm:flex-row gap-3 mt-4", children: [action && (_jsxs(Button, { onClick: action.onClick, className: "gap-2", children: [action.icon && _jsx(action.icon, { className: "h-4 w-4" }), action.label] })), secondaryAction && (_jsx(Button, { variant: "outline", onClick: secondaryAction.onClick, children: secondaryAction.label }))] }))] }));
}
