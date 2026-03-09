import { LayoutDashboard, Briefcase, BookmarkCheck, Settings, Bot, Sparkles, } from 'lucide-react';
export const navigation = [
    {
        name: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
    },
    {
        name: 'Discovery',
        href: '/discovery',
        icon: Sparkles,
    },
    {
        name: 'Jobs',
        href: '/jobs',
        icon: Briefcase,
    },
    {
        name: 'Applications',
        href: '/applications',
        icon: BookmarkCheck,
    },
    {
        name: 'Auto-Pilot',
        href: '/autopilot',
        icon: Bot,
    },
    {
        name: 'Settings',
        href: '/settings',
        icon: Settings,
    },
];
