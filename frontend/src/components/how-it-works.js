import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Search, Sparkles, Briefcase, FileText, Mail, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
const workflowSteps = [
    {
        step: 1,
        title: 'Create Your Profile',
        description: 'Add your skills, experience, education, and career goals',
        icon: User,
        color: 'bg-blue-500/10 text-blue-500',
    },
    {
        step: 2,
        title: 'Find Jobs',
        description: 'Scrape jobs from hh.kz, Wellfound, LinkedIn, or add manually',
        icon: Search,
        color: 'bg-cyan-500/10 text-cyan-500',
    },
    {
        step: 3,
        title: 'Match with AI',
        description: 'Calculate match scores to find jobs that fit your profile',
        icon: Sparkles,
        color: 'bg-purple-500/10 text-purple-500',
    },
    {
        step: 4,
        title: 'Generate Documents',
        description: 'Create tailored resumes and cover letters for each job',
        icon: FileText,
        color: 'bg-green-500/10 text-green-500',
    },
    {
        step: 5,
        title: 'Track Applications',
        description: 'Manage applications, interviews, and responses in one place',
        icon: Briefcase,
        color: 'bg-amber-500/10 text-amber-500',
    },
    {
        step: 6,
        title: 'Get Notified',
        description: 'Receive email notifications for new job matches and updates',
        icon: Mail,
        color: 'bg-red-500/10 text-red-500',
    },
];
export function HowItWorks() {
    return (_jsxs(Card, { className: "border-2 border-border/40 bg-gradient-to-br from-card to-card/80", children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "rounded-full bg-primary/10 p-2", children: _jsx(Target, { className: "h-5 w-5 text-primary" }) }), _jsxs("div", { children: [_jsx(CardTitle, { className: "text-xl font-bold", children: "How Unhireable Works" }), _jsx(CardDescription, { children: "Your complete job search automation workflow" })] })] }) }), _jsx(CardContent, { children: _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: workflowSteps.map((item, index) => {
                        const Icon = item.icon;
                        return (_jsxs("div", { className: "relative p-4 rounded-lg border border-border/40 bg-background/50 hover:bg-background/80 transition-all", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: cn("rounded-lg p-2 flex-shrink-0", item.color), children: _jsx(Icon, { className: "h-5 w-5" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "flex items-center gap-2 mb-1", children: _jsxs("span", { className: "text-xs font-semibold text-muted-foreground", children: ["Step ", item.step] }) }), _jsx("h4", { className: "font-semibold text-sm mb-1", children: item.title }), _jsx("p", { className: "text-xs text-muted-foreground", children: item.description })] })] }), index < workflowSteps.length - 1 && (_jsx("div", { className: "absolute -right-2 top-1/2 transform -translate-y-1/2 hidden lg:block", children: _jsx("div", { className: "w-4 h-0.5 bg-border" }) }))] }, item.step));
                    }) }) })] }));
}
