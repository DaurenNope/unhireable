import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobApi, profileApi, schedulerApi } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    Sparkles,
    Brain,
    Zap,
    CheckCircle2,
    Clock,
    RefreshCw,
    Search,
    Bot,
    TrendingUp,
    Target,
    Trophy,
    ArrowUpRight
} from 'lucide-react';
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
        mutationFn: async (enabled: boolean) => {
            if (enabled) {
                return schedulerApi.start();
            } else {
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
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground animate-pulse">Syncing with the Brain...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-6 pb-12 animate-in fade-in duration-700">
            {/* Header & Stats Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Brain className="h-6 w-6 text-primary" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight">DISCOVERY <span className="text-primary">BRAIN</span></h1>
                    </div>
                    <p className="text-muted-foreground max-w-lg">
                        Autonomous job vetting powered by your Master Profile. The Brain scans raw LinkedIn data to find your next "Golden Match".
                    </p>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3 bg-secondary/30 backdrop-blur-sm px-4 py-2 rounded-xl border border-primary/10">
                        <div className="space-y-0.5">
                            <Label htmlFor="auto-pilot" className="text-[10px] font-black tracking-widest uppercase opacity-70 flex items-center gap-1">
                                <Bot className="h-3 w-3" />
                                AUTO-PILOT
                            </Label>
                            <p className="text-[10px] text-muted-foreground font-medium">Closed-loop autonomy</p>
                        </div>
                        <Switch
                            id="auto-pilot"
                            checked={automationConfig?.enabled || false}
                            onCheckedChange={(checked) => {
                                toggleAutoPilot.mutate(checked);
                            }}
                            disabled={toggleAutoPilot.isPending}
                        />
                    </div>

                    <Button
                        size="lg"
                        className={cn(
                            "relative overflow-hidden group transition-all duration-300",
                            isProcessing ? "opacity-90 pr-12" : "hover:px-8"
                        )}
                        onClick={handleDeepQualify}
                        disabled={isProcessing || scouted.length === 0}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative flex items-center gap-2">
                            {isProcessing ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                                <Zap className="h-4 w-4 fill-current" />
                            )}
                            <span className="font-bold">{isProcessing ? 'SCANNING...' : 'DEEP QUALIFY'}</span>
                        </div>
                        {isProcessing && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono opacity-60">
                                PROD
                            </span>
                        )}
                    </Button>
                </div>
            </div>

            {/* Hero Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat) => (
                    <Card key={stat.label} className="border-0 bg-secondary/30 backdrop-blur-sm">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-1">{stat.label}</p>
                                    <h3 className="text-3xl font-black">{stat.value}</h3>
                                </div>
                                <div className={cn("p-3 rounded-xl bg-background shadow-sm", stat.color)}>
                                    <stat.icon className="h-6 w-6" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* The Funnel (Kanban Style) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full min-h-[500px]">
                {/* Column 1: Scouted */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2 font-bold text-sm tracking-widest uppercase opacity-60">
                            <Search className="h-4 w-4" />
                            Scouted
                            <Badge variant="outline" className="ml-2 font-mono">{scouted.length}</Badge>
                        </div>
                    </div>
                    <div className="flex-1 rounded-2xl bg-muted/20 border-2 border-dashed border-muted p-3 space-y-3">
                        {scouted.length === 0 ? (
                            <div className="h-40 flex flex-col items-center justify-center text-center p-6 space-y-2 opacity-40">
                                <Bot className="h-10 w-10 mb-2" />
                                <p className="text-xs font-medium">Scouter extension is quiet.</p>
                                <p className="text-[10px]">Open LinkedIn to find new leads.</p>
                            </div>
                        ) : (
                            scouted.map(job => (
                                <motion.div
                                    key={job.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 bg-card rounded-xl border shadow-sm hover:shadow-md transition-shadow cursor-default group"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-tighter">
                                            {job.source}
                                        </Badge>
                                        <Clock className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                    <h4 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2">
                                        {job.title}
                                    </h4>
                                    <p className="text-xs text-muted-foreground mt-1">{job.company}</p>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>

                {/* Column 2: Qualified (Prospects) */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2 font-bold text-sm tracking-widest uppercase text-purple-500">
                            <Brain className="h-4 w-4" />
                            Qualified
                            <Badge variant="outline" className="ml-2 bg-purple-500/10 text-purple-500 border-purple-500/20 font-mono">
                                {qualified.length}
                            </Badge>
                        </div>
                    </div>
                    <div className="flex-1 rounded-2xl bg-purple-500/5 border-2 border-purple-500/20 p-3 space-y-3">
                        {qualified.length === 0 ? (
                            <div className="h-40 flex flex-col items-center justify-center text-center p-6 space-y-2 opacity-60">
                                <Zap className="h-10 w-10 mb-2 text-purple-400 animate-pulse" />
                                <p className="text-xs font-bold text-purple-600">Brain is idling.</p>
                                <p className="text-[10px] text-purple-500/70">Click DEEP QUALIFY to find prosps.</p>
                            </div>
                        ) : (
                            qualified.map(job => (
                                <motion.div
                                    key={job.id}
                                    layoutId={String(job.id)}
                                    className="p-4 bg-card rounded-xl border border-purple-500/20 shadow-purple-500/5 shadow-lg hover:border-purple-500/40 transition-all group"
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <Badge className="text-[10px] bg-purple-500 hover:bg-purple-600">
                                            PROSPECT
                                        </Badge>
                                        {job.match_score && (
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs font-black text-purple-600">{Math.round(job.match_score)}%</span>
                                                <ArrowUpRight className="h-3 w-3 text-purple-600" />
                                            </div>
                                        )}
                                    </div>
                                    <h4 className="font-bold text-sm leading-tight">{job.title}</h4>
                                    <p className="text-xs text-muted-foreground mt-1">{job.company}</p>

                                    <div className="mt-4 flex gap-2">
                                        <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold py-0" asChild>
                                            <Link to={`/jobs/${job.id}`}>DETAILS</Link>
                                        </Button>
                                        <Button size="sm" className="h-7 flex-1 text-[10px] font-black tracking-widest bg-emerald-500 hover:bg-emerald-600 transition-colors">
                                            PROMOTE
                                        </Button>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>

                {/* Column 3: Funnel Visualization */}
                <div className="space-y-6">
                    <Card className="border-0 bg-primary/5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-black flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                FUNNEL EFFICIENCY
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                    <span>Vetting Rate</span>
                                    <span>{jobs.length > 0 ? Math.round((qualified.length / jobs.length) * 100) : 0}%</span>
                                </div>
                                <Progress value={jobs.length > 0 ? (qualified.length / jobs.length) * 100 : 0} className="h-1.5" />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                    <span>Golden Match Density</span>
                                    <span>{qualified.length > 0 ? Math.round((qualified.filter(j => (j.match_score || 0) > 85).length / qualified.length) * 100) : 0}%</span>
                                </div>
                                <Progress value={qualified.length > 0 ? (qualified.filter(j => (j.match_score || 0) > 85).length / qualified.length) * 100 : 0} className="h-1.5 bg-background" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-0 bg-secondary/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-black flex items-center gap-2">
                                <Target className="h-4 w-4" />
                                BRAIN TARGETS
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="p-3 rounded-lg border bg-background/50 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold text-muted-foreground">REMOTE ONLY</p>
                                    <p className="text-xs font-bold leading-none">ACTIVE</p>
                                </div>
                            </div>
                            <div className="p-3 rounded-lg border bg-background/50 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold text-muted-foreground">MIN MATCH SCORE</p>
                                    <p className="text-xs font-bold leading-none">65% +</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
