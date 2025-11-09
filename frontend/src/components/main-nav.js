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
    // Unhireable design: Bold styling with cyan/purple accents that works with theme
    const baseClass = 'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 w-full';
    const iconClass = 'h-4 w-4 mr-3 flex-shrink-0';
    const textClass = 'text-sm font-medium leading-normal';
    if (!hasSubItems) {
        return (_jsxs(NavLink, { to: item.href, className: ({ isActive: active }) => cn(baseClass, active
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-sm'), children: [_jsx(Icon, { className: iconClass }), _jsx("span", { className: textClass, children: item.name })] }));
    }
    return (_jsxs("div", { ref: menuRef, className: "relative", onMouseEnter: () => setIsHovered(true), onMouseLeave: () => setIsHovered(false), children: [_jsxs("button", { type: "button", onClick: toggleMenu, className: cn(baseClass, 'justify-between text-left', (isActive || isOpen)
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-sm'), children: [_jsxs("div", { className: "flex items-center min-w-0 flex-1", children: [_jsx(Icon, { className: iconClass }), _jsx("span", { className: textClass, children: item.name })] }), _jsx(ChevronDown, { className: cn('h-3.5 w-3.5 transition-transform duration-150 flex-shrink-0 ml-2', isOpen ? 'rotate-180' : '') })] }), isOpen && (_jsx("div", { className: "absolute left-0 top-full mt-1 w-full rounded-md shadow-lg bg-popover border border-border z-50 ml-3", children: _jsx("div", { className: "py-1", children: item.subItems?.map((subItem) => (_jsx(NavLink, { to: subItem.href, className: ({ isActive: active }) => cn('block px-3 py-2 text-sm font-medium transition-colors', active
                            ? 'bg-primary text-primary-foreground'
                            : 'text-popover-foreground hover:bg-accent hover:text-accent-foreground'), children: subItem.name }, subItem.href))) }) }))] }));
};
export function MainNav() {
    return (_jsx("nav", { className: "space-y-1", children: navigation.map((item) => (_jsx(NavItem, { item: item }, item.href))) }));
}
