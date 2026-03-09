import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobApi, profileApi, schedulerApi } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Sparkles, Brain, Zap, CheckCircle2, Clock, RefreshCw, Search, Bot, TrendingUp, Target, Trophy, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
export function Discovery() {
    const queryClient = useQueryClient();
    const [isProcessing, setIsProcessing] = useState(false);
    // Fetch all jobs to categorize into the funnel
    const { data: jobs = [], isLoading } = useQuery({
        queryKey: ['jobs'],
        queryFn: () => jobApi.list(undefined, undefined, 1, 100),
    });
    useQuery({
        queryKey: ['profile'],
        queryFn: () => profileApi.get(),
    });
    const { data: automationConfig } = useQuery({
        queryKey: ['automation-config'],
        queryFn: () => schedulerApi.getStatus(),
    });
    const toggleAutoPilot = useMutation({
        mutationFn: async (enabled) => {
            if (enabled) {
                return schedulerApi.start();
            }
            else {
                return schedulerApi.stop();
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['automation-config'] });
        }
    });
    // Funnel categorization
    const scouted = useMemo(() => jobs.filter(j => j.status === 'scouted'), [jobs]);
    const qualified = useMemo(() => jobs.filter(j => j.status === 'prospect'), [jobs]);
    const qualifyMutation = useMutation({
        mutationFn: () => jobApi.qualify(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            setIsProcessing(false);
        },
        onError: (error) => {
            console.error('Qualification failed:', error);
            setIsProcessing(false);
        }
    });
    const handleDeepQualify = () => {
        setIsProcessing(true);
        qualifyMutation.mutate();
    };
    const stats = [
        { label: 'Scouted Leads', value: scouted.length, icon: Search, color: 'text-sky-500' },
        { label: 'AI Qualified', value: qualified.length, icon: Brain, color: 'text-purple-500' },
        { label: 'Golden Matches', value: qualified.filter(j => (j.match_score || 0) > 85).length, icon: Trophy, color: 'text-amber-500' },
    ];
    if (isLoading) {
        return (_jsx("div", { className: "flex items-center justify-center min-h-[60vh]", children: _jsxs("div", { className: "flex flex-col items-center gap-4", children: [_jsx(RefreshCw, { className: "h-8 w-8 animate-spin text-primary" }), _jsx("p", { className: "text-muted-foreground animate-pulse", children: "Syncing with the Brain..." })] }) }));
    }
    return (_jsxs("div", { className: "space-y-8 p-6 pb-12 animate-in fade-in duration-700", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-end justify-between gap-6", children: [_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "p-2 bg-primary/10 rounded-lg", children: _jsx(Brain, { className: "h-6 w-6 text-primary" }) }), _jsxs("h1", { className: "text-3xl font-black tracking-tight", children: ["DISCOVERY ", _jsx("span", { className: "text-primary", children: "BRAIN" })] })] }), _jsx("p", { className: "text-muted-foreground max-w-lg", children: "Autonomous job vetting powered by your Master Profile. The Brain scans raw LinkedIn data to find your next \"Golden Match\"." })] }), _jsxs("div", { className: "flex items-center gap-6", children: [_jsxs("div", { className: "flex items-center gap-3 bg-secondary/30 backdrop-blur-sm px-4 py-2 rounded-xl border border-primary/10", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsxs(Label, { htmlFor: "auto-pilot", className: "text-[10px] font-black tracking-widest uppercase opacity-70 flex items-center gap-1", children: [_jsx(Bot, { className: "h-3 w-3" }), "AUTO-PILOT"] }), _jsx("p", { className: "text-[10px] text-muted-foreground font-medium", children: "Closed-loop autonomy" })] }), _jsx(Switch, { id: "auto-pilot", checked: automationConfig?.enabled || false, onCheckedChange: (checked) => {
                                            toggleAutoPilot.mutate(checked);
                                        }, disabled: toggleAutoPilot.isPending })] }), _jsxs(Button, { size: "lg", className: cn("relative overflow-hidden group transition-all duration-300", isProcessing ? "opacity-90 pr-12" : "hover:px-8"), onClick: handleDeepQualify, disabled: isProcessing || scouted.length === 0, children: [_jsx("div", { className: "absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" }), _jsxs("div", { className: "relative flex items-center gap-2", children: [isProcessing ? (_jsx(RefreshCw, { className: "h-4 w-4 animate-spin" })) : (_jsx(Zap, { className: "h-4 w-4 fill-current" })), _jsx("span", { className: "font-bold", children: isProcessing ? 'SCANNING...' : 'DEEP QUALIFY' })] }), isProcessing && (_jsx("span", { className: "absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono opacity-60", children: "PROD" }))] })] })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: stats.map((stat) => (_jsx(Card, { className: "border-0 bg-secondary/30 backdrop-blur-sm", children: _jsx(CardContent, { className: "p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-muted-foreground mb-1", children: stat.label }), _jsx("h3", { className: "text-3xl font-black", children: stat.value })] }), _jsx("div", { className: cn("p-3 rounded-xl bg-background shadow-sm", stat.color), children: _jsx(stat.icon, { className: "h-6 w-6" }) })] }) }) }, stat.label))) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-8 h-full min-h-[500px]", children: [_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx("div", { className: "flex items-center justify-between px-2", children: _jsxs("div", { className: "flex items-center gap-2 font-bold text-sm tracking-widest uppercase opacity-60", children: [_jsx(Search, { className: "h-4 w-4" }), "Scouted", _jsx(Badge, { variant: "outline", className: "ml-2 font-mono", children: scouted.length })] }) }), _jsx("div", { className: "flex-1 rounded-2xl bg-muted/20 border-2 border-dashed border-muted p-3 space-y-3", children: scouted.length === 0 ? (_jsxs("div", { className: "h-40 flex flex-col items-center justify-center text-center p-6 space-y-2 opacity-40", children: [_jsx(Bot, { className: "h-10 w-10 mb-2" }), _jsx("p", { className: "text-xs font-medium", children: "Scouter extension is quiet." }), _jsx("p", { className: "text-[10px]", children: "Open LinkedIn to find new leads." })] })) : (scouted.map(job => (_jsxs(motion.div, { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, className: "p-4 bg-card rounded-xl border shadow-sm hover:shadow-md transition-shadow cursor-default group", children: [_jsxs("div", { className: "flex justify-between items-start mb-2", children: [_jsx(Badge, { variant: "secondary", className: "text-[10px] uppercase font-bold tracking-tighter", children: job.source }), _jsx(Clock, { className: "h-3 w-3 text-muted-foreground" })] }), _jsx("h4", { className: "font-bold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2", children: job.title }), _jsx("p", { className: "text-xs text-muted-foreground mt-1", children: job.company })] }, job.id)))) })] }), _jsxs("div", { className: "flex flex-col gap-4", children: [_jsx("div", { className: "flex items-center justify-between px-2", children: _jsxs("div", { className: "flex items-center gap-2 font-bold text-sm tracking-widest uppercase text-purple-500", children: [_jsx(Brain, { className: "h-4 w-4" }), "Qualified", _jsx(Badge, { variant: "outline", className: "ml-2 bg-purple-500/10 text-purple-500 border-purple-500/20 font-mono", children: qualified.length })] }) }), _jsx("div", { className: "flex-1 rounded-2xl bg-purple-500/5 border-2 border-purple-500/20 p-3 space-y-3", children: qualified.length === 0 ? (_jsxs("div", { className: "h-40 flex flex-col items-center justify-center text-center p-6 space-y-2 opacity-60", children: [_jsx(Zap, { className: "h-10 w-10 mb-2 text-purple-400 animate-pulse" }), _jsx("p", { className: "text-xs font-bold text-purple-600", children: "Brain is idling." }), _jsx("p", { className: "text-[10px] text-purple-500/70", children: "Click DEEP QUALIFY to find prosps." })] })) : (qualified.map(job => (_jsxs(motion.div, { layoutId: String(job.id), className: "p-4 bg-card rounded-xl border border-purple-500/20 shadow-purple-500/5 shadow-lg hover:border-purple-500/40 transition-all group", children: [_jsxs("div", { className: "flex justify-between items-center mb-2", children: [_jsx(Badge, { className: "text-[10px] bg-purple-500 hover:bg-purple-600", children: "PROSPECT" }), job.match_score && (_jsxs("div", { className: "flex items-center gap-1", children: [_jsxs("span", { className: "text-xs font-black text-purple-600", children: [Math.round(job.match_score), "%"] }), _jsx(ArrowUpRight, { className: "h-3 w-3 text-purple-600" })] }))] }), _jsx("h4", { className: "font-bold text-sm leading-tight", children: job.title }), _jsx("p", { className: "text-xs text-muted-foreground mt-1", children: job.company }), _jsxs("div", { className: "mt-4 flex gap-2", children: [_jsx(Button, { variant: "ghost", size: "sm", className: "h-7 text-[10px] font-bold py-0", asChild: true, children: _jsx(Link, { to: `/jobs/${job.id}`, children: "DETAILS" }) }), _jsx(Button, { size: "sm", className: "h-7 flex-1 text-[10px] font-black tracking-widest bg-emerald-500 hover:bg-emerald-600 transition-colors", children: "PROMOTE" })] })] }, job.id)))) })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { className: "border-0 bg-primary/5", children: [_jsx(CardHeader, { className: "pb-2", children: _jsxs(CardTitle, { className: "text-sm font-black flex items-center gap-2", children: [_jsx(TrendingUp, { className: "h-4 w-4" }), "FUNNEL EFFICIENCY"] }) }), _jsxs(CardContent, { className: "space-y-6", children: [_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex justify-between text-xs font-bold", children: [_jsx("span", { children: "Vetting Rate" }), _jsxs("span", { children: [jobs.length > 0 ? Math.round((qualified.length / jobs.length) * 100) : 0, "%"] })] }), _jsx(Progress, { value: jobs.length > 0 ? (qualified.length / jobs.length) * 100 : 0, className: "h-1.5" })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex justify-between text-xs font-bold", children: [_jsx("span", { children: "Golden Match Density" }), _jsxs("span", { children: [qualified.length > 0 ? Math.round((qualified.filter(j => (j.match_score || 0) > 85).length / qualified.length) * 100) : 0, "%"] })] }), _jsx(Progress, { value: qualified.length > 0 ? (qualified.filter(j => (j.match_score || 0) > 85).length / qualified.length) * 100 : 0, className: "h-1.5 bg-background" })] })] })] }), _jsxs(Card, { className: "border-0 bg-secondary/20", children: [_jsx(CardHeader, { className: "pb-2", children: _jsxs(CardTitle, { className: "text-sm font-black flex items-center gap-2", children: [_jsx(Target, { className: "h-4 w-4" }), "BRAIN TARGETS"] }) }), _jsxs(CardContent, { className: "space-y-3", children: [_jsxs("div", { className: "p-3 rounded-lg border bg-background/50 flex items-center gap-3", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center", children: _jsx(CheckCircle2, { className: "h-4 w-4 text-emerald-500" }) }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "text-[10px] font-bold text-muted-foreground", children: "REMOTE ONLY" }), _jsx("p", { className: "text-xs font-bold leading-none", children: "ACTIVE" })] })] }), _jsxs("div", { className: "p-3 rounded-lg border bg-background/50 flex items-center gap-3", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center", children: _jsx(Sparkles, { className: "h-4 w-4 text-primary" }) }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "text-[10px] font-bold text-muted-foreground", children: "MIN MATCH SCORE" }), _jsx("p", { className: "text-xs font-bold leading-none", children: "65% +" })] })] })] })] })] })] })] }));
}
