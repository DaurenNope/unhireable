import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { Eye, Zap, Rocket, CheckCircle, AlertTriangle, Info, } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, } from '@/components/ui/tooltip';
const modeIcons = {
    manual: Eye,
    semiauto: Zap,
    autopilot: Rocket,
};
const modeColors = {
    manual: 'bg-blue-500/10 border-blue-500/30 text-blue-600 hover:bg-blue-500/20',
    semiauto: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600 hover:bg-yellow-500/20',
    autopilot: 'bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20',
};
const modeActiveColors = {
    manual: 'bg-blue-500 border-blue-600 text-white',
    semiauto: 'bg-yellow-500 border-yellow-600 text-white',
    autopilot: 'bg-green-500 border-green-600 text-white',
};
export function ApplyModeSelector({ currentMode, onModeChange, compact = false }) {
    const queryClient = useQueryClient();
    // Fetch available modes
    const { data: modes } = useQuery({
        queryKey: ['apply-modes'],
        queryFn: () => invoke('get_apply_modes'),
    });
    // Fetch current mode
    const { data: activeMode } = useQuery({
        queryKey: ['current-apply-mode'],
        queryFn: () => invoke('get_current_apply_mode'),
        enabled: !currentMode, // Only fetch if not provided via props
    });
    // Set mode mutation
    const setModeMutation = useMutation({
        mutationFn: (mode) => invoke('set_apply_mode', { mode }),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['current-apply-mode'] });
            queryClient.invalidateQueries({ queryKey: ['autopilot-status'] });
            onModeChange?.(data);
        },
    });
    const selectedMode = currentMode?.id || activeMode?.id || 'manual';
    if (!modes)
        return null;
    if (compact) {
        return (_jsx("div", { className: "flex items-center gap-2", children: modes.map((mode) => {
                const Icon = modeIcons[mode.id] || Eye;
                const isActive = selectedMode === mode.id;
                return (_jsx(TooltipProvider, { children: _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs(Button, { variant: "outline", size: "sm", className: `transition-all ${isActive
                                        ? modeActiveColors[mode.id]
                                        : modeColors[mode.id]}`, onClick: () => setModeMutation.mutate(mode.id), disabled: setModeMutation.isPending, children: [_jsx(Icon, { className: "h-4 w-4 mr-1" }), mode.name] }) }), _jsxs(TooltipContent, { side: "bottom", className: "max-w-xs", children: [_jsx("p", { className: "font-medium", children: mode.name }), _jsx("p", { className: "text-sm text-muted-foreground", children: mode.description })] })] }) }, mode.id));
            }) }));
    }
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { className: "pb-3", children: [_jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Zap, { className: "h-5 w-5" }), "Application Mode"] }), _jsx(CardDescription, { children: "Choose how automated you want your job applications to be" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: modes.map((mode) => {
                            const Icon = modeIcons[mode.id] || Eye;
                            const isActive = selectedMode === mode.id;
                            return (_jsxs("button", { className: `relative p-4 rounded-lg border-2 text-left transition-all ${isActive
                                    ? modeActiveColors[mode.id]
                                    : `${modeColors[mode.id]} border-dashed`}`, onClick: () => setModeMutation.mutate(mode.id), disabled: setModeMutation.isPending, children: [isActive && (_jsx(CheckCircle, { className: "absolute top-2 right-2 h-5 w-5" })), _jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Icon, { className: "h-6 w-6" }), _jsx("span", { className: "text-lg font-semibold", children: mode.name })] }), _jsx("p", { className: `text-sm mb-3 ${isActive ? 'text-white/90' : 'text-muted-foreground'}`, children: mode.description }), _jsxs("div", { className: "space-y-1 text-xs", children: [_jsx("div", { className: "flex items-center gap-2", children: mode.is_headless ? (_jsx(Badge, { variant: "outline", className: isActive ? 'bg-white/10 border-white/20' : '', children: "Headless" })) : (_jsx(Badge, { variant: "outline", className: isActive ? 'bg-white/10 border-white/20' : '', children: "Visible Browser" })) }), _jsx("div", { className: `flex items-center gap-1 ${isActive ? 'text-white/80' : 'text-muted-foreground'}`, children: mode.auto_submit ? (_jsxs(_Fragment, { children: [_jsx(AlertTriangle, { className: "h-3 w-3" }), _jsx("span", { children: "Auto-submits" })] })) : mode.requires_confirmation ? (_jsxs(_Fragment, { children: [_jsx(Info, { className: "h-3 w-3" }), _jsx("span", { children: "Requires confirmation" })] })) : (_jsxs(_Fragment, { children: [_jsx(Eye, { className: "h-3 w-3" }), _jsx("span", { children: "You click submit" })] })) }), _jsxs("div", { className: `text-xs ${isActive ? 'text-white/70' : 'text-muted-foreground'}`, children: ["Min ATS: ", mode.min_reliability] })] })] }, mode.id));
                        }) }), _jsxs("div", { className: "mt-4 p-3 bg-muted/50 rounded-lg text-sm", children: [selectedMode === 'manual' && (_jsxs("div", { className: "flex items-start gap-2", children: [_jsx(Eye, { className: "h-4 w-4 mt-0.5 text-blue-500" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium", children: "Manual Review Mode" }), _jsx("p", { className: "text-muted-foreground", children: "Browser opens visible so you can watch. Form fills automatically, but you review everything and click Submit yourself. Works with any ATS." })] })] })), selectedMode === 'semiauto' && (_jsxs("div", { className: "flex items-start gap-2", children: [_jsx(Zap, { className: "h-4 w-4 mt-0.5 text-yellow-500" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium", children: "Semi-Automatic Mode" }), _jsx("p", { className: "text-muted-foreground", children: "Browser runs in background. Form fills automatically, then you get a notification to approve or reject before submission. Good balance of speed and control." })] })] })), selectedMode === 'autopilot' && (_jsxs("div", { className: "flex items-start gap-2", children: [_jsx(Rocket, { className: "h-4 w-4 mt-0.5 text-green-500" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium", children: "Full Autopilot Mode" }), _jsx("p", { className: "text-muted-foreground", children: "Completely automatic - form fills and submits without intervention. Only works with reliable ATS systems (Greenhouse, Lever, etc.) to ensure success." })] })] }))] })] })] }));
}
export default ApplyModeSelector;
