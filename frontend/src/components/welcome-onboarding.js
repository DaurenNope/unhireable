import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, ArrowRight, User, Briefcase, FileText, Sparkles, Rocket, Settings, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HowItWorks } from './how-it-works';
const steps = [
    {
        id: 'profile',
        title: 'Create Your Profile',
        description: 'Add your skills, experience, and career goals to enable job matching and resume generation',
        icon: User,
        action: {
            label: 'Go to Settings → Profile',
            href: '/settings?tab=profile',
        },
    },
    {
        id: 'scrape',
        title: 'Find Jobs',
        description: 'Scrape jobs from multiple sources (hh.kz, Wellfound, LinkedIn) or add them manually',
        icon: Search,
        action: {
            label: 'Scrape Jobs',
            href: '/jobs',
        },
    },
    {
        id: 'match',
        title: 'Calculate Match Scores',
        description: 'Let AI analyze which jobs match your profile based on skills and experience',
        icon: Sparkles,
        action: {
            label: 'Calculate Matches',
            href: '/jobs',
        },
    },
    {
        id: 'apply',
        title: 'Create Applications',
        description: 'Track your applications and manage the entire hiring process in one place',
        icon: Briefcase,
        action: {
            label: 'Create Application',
            href: '/applications',
        },
    },
    {
        id: 'documents',
        title: 'Generate Documents',
        description: 'Create tailored resumes and cover letters for each job application',
        icon: FileText,
        action: {
            label: 'Generate Resume',
            href: '/jobs',
        },
    },
];
export function WelcomeOnboarding() {
    const [currentStep, setCurrentStep] = useState(0);
    const [dismissed, setDismissed] = useState(() => {
        // Check if user has dismissed before (stored in localStorage)
        return localStorage.getItem('unhireable-onboarding-dismissed') === 'true';
    });
    const handleDismiss = () => {
        setDismissed(true);
        localStorage.setItem('unhireable-onboarding-dismissed', 'true');
    };
    if (dismissed) {
        return null;
    }
    const currentStepData = steps[currentStep];
    if (!currentStepData) {
        return null;
    }
    return (_jsxs(Card, { className: "border-2 border-primary/20 bg-gradient-to-br from-card to-card/80 shadow-lg", children: [_jsx(CardHeader, { className: "pb-4", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "rounded-full bg-primary/10 p-3", children: _jsx(Rocket, { className: "h-6 w-6 text-primary" }) }), _jsxs("div", { children: [_jsx(CardTitle, { className: "text-2xl font-bold", children: "Welcome to Unhireable!" }), _jsx(CardDescription, { className: "text-base mt-1", children: "Your Neural Career System - Let's get you started" })] })] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: handleDismiss, className: "text-muted-foreground hover:text-foreground", children: "Skip" })] }) }), _jsxs(CardContent, { className: "space-y-6", children: [_jsx("div", { className: "flex items-center justify-between", children: steps.map((step, index) => {
                            const Icon = step.icon;
                            const isActive = index === currentStep;
                            const isCompleted = index < currentStep;
                            return (_jsxs("div", { className: "flex items-center flex-1", children: [_jsxs("div", { className: "flex flex-col items-center flex-1", children: [_jsx("div", { className: cn("rounded-full p-2 transition-all", isActive && "bg-primary text-primary-foreground scale-110", isCompleted && "bg-primary/20 text-primary", !isActive && !isCompleted && "bg-muted text-muted-foreground"), children: isCompleted ? (_jsx(CheckCircle2, { className: "h-4 w-4" })) : (_jsx(Icon, { className: "h-4 w-4" })) }), _jsx("span", { className: cn("text-xs mt-2 text-center max-w-[80px]", isActive && "font-semibold text-foreground", !isActive && "text-muted-foreground"), children: step.title.split(' ')[0] })] }), index < steps.length - 1 && (_jsx("div", { className: cn("h-0.5 flex-1 mx-2 -mt-6", isCompleted ? "bg-primary" : "bg-muted") }))] }, step.id));
                        }) }), _jsxs("div", { className: "bg-muted/30 rounded-lg p-6 space-y-4", children: [_jsxs("div", { className: "flex items-start gap-4", children: [_jsx("div", { className: "rounded-lg bg-primary/10 p-3", children: _jsx(currentStepData.icon, { className: "h-6 w-6 text-primary" }) }), _jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "text-lg font-semibold mb-2", children: currentStepData.title }), _jsx("p", { className: "text-muted-foreground", children: currentStepData.description })] })] }), _jsxs("div", { className: "flex gap-2 pt-2", children: [_jsx(Button, { asChild: true, className: "flex-1", children: _jsxs(Link, { to: currentStepData.action.href, children: [currentStepData.action.label, _jsx(ArrowRight, { className: "ml-2 h-4 w-4" })] }) }), currentStep < steps.length - 1 && (_jsx(Button, { variant: "outline", onClick: () => setCurrentStep(currentStep + 1), children: "Next" }))] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2 pt-2 border-t", children: [_jsx(Button, { variant: "ghost", size: "sm", asChild: true, children: _jsxs(Link, { to: "/settings", children: [_jsx(Settings, { className: "mr-2 h-4 w-4" }), "Settings"] }) }), _jsx(Button, { variant: "ghost", size: "sm", asChild: true, children: _jsxs(Link, { to: "/jobs", children: [_jsx(Briefcase, { className: "mr-2 h-4 w-4" }), "Jobs"] }) })] })] }), _jsx("div", { className: "mt-6", children: _jsx(HowItWorks, {}) })] }));
}
