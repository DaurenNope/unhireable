import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Briefcase, FileText, Settings, ListChecks, ChevronDown, } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
export const navigation = [
    {
        name: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
    },
    {
        name: 'Jobs',
        href: '/jobs',
        icon: Briefcase,
        subItems: [
            { name: 'All Jobs', href: '/jobs' },
            { name: 'Saved Jobs', href: '/jobs/saved' },
            { name: 'Archived', href: '/jobs/archived' },
        ]
    },
    {
        name: 'Applications',
        href: '/applications',
        icon: FileText,
        subItems: [
            { name: 'All Applications', href: '/applications' },
            { name: 'In Progress', href: '/applications/in-progress' },
            { name: 'Interviews', href: '/applications/interviews' },
            { name: 'Offers', href: '/applications/offers' },
        ]
    },
    {
        name: 'Checklist',
        href: '/checklist',
        icon: ListChecks,
    },
    {
        name: 'Settings',
        href: '/settings',
        icon: Settings,
    },
];
const NavItem = ({ item }) => {
    const location = useLocation();
    const [isHovered, setIsHovered] = useState(false);
    const [isClicked, setIsClicked] = useState(false);
    const menuRef = useRef(null);
    const Icon = item.icon;
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isActive = location.pathname === item.href ||
        (item.subItems?.some(subItem => location.pathname === subItem.href) ?? false);
    const isOpen = isClicked || (isHovered && !isClicked);
    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsClicked(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    // Close menu when navigating
    useEffect(() => {
        setIsClicked(false);
    }, [location.pathname]);
    const toggleMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsClicked(!isClicked);
    };
    if (!hasSubItems) {
        return (_jsxs(NavLink, { to: item.href, className: ({ isActive: active }) => cn('flex items-center px-3 py-2 text-sm font-medium rounded-md', active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground', 'transition-colors mb-1 w-full text-left'), children: [_jsx(Icon, { className: "h-5 w-5 mr-3" }), item.name] }));
    }
    return (_jsxs("div", { ref: menuRef, className: "relative mb-1", onMouseEnter: () => setIsHovered(true), onMouseLeave: () => setIsHovered(false), children: [_jsxs("div", { onClick: toggleMenu, className: cn('flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md cursor-pointer', (isActive || isOpen)
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground', 'transition-colors w-full'), children: [_jsxs("div", { className: "flex items-center", children: [_jsx(Icon, { className: "h-5 w-5 mr-3" }), _jsx("span", { children: item.name })] }), _jsx(ChevronDown, { className: cn('h-4 w-4 transition-transform', isOpen ? 'rotate-180' : '') })] }), isOpen && (_jsx("div", { className: "absolute left-0 mt-1 w-56 rounded-md shadow-lg bg-popover border z-50", style: { minWidth: '14rem' }, children: _jsx("div", { className: "py-1", children: item.subItems?.map((subItem) => (_jsx(NavLink, { to: subItem.href, className: ({ isActive: active }) => cn('block px-4 py-2 text-sm', 'transition-colors', active
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'), children: subItem.name }, subItem.href))) }) }))] }));
};
export function MainNav() {
    return (_jsx("nav", { className: "space-y-1 px-2 py-3", children: navigation.map((item) => (_jsx(NavItem, { item: item }, item.href))) }));
}
