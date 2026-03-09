import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { navigation } from './nav-config';
const NavigationItem = ({ item }) => {
    const location = useLocation();
    const Icon = item.icon;
    const matchesRoute = location.pathname === item.href &&
        (item.search ? location.search === item.search : true) &&
        (item.hash ? location.hash === item.hash : true);
    const baseClass = 'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 w-full';
    const iconClass = 'h-4 w-4 mr-3 flex-shrink-0';
    const textClass = 'text-sm font-medium leading-normal';
    const to = item.search || item.hash
        ? { pathname: item.href, search: item.search, hash: item.hash }
        : item.href;
    return (_jsxs(NavLink, { to: to, end: true, className: () => cn(baseClass, matchesRoute
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-sm'), children: [_jsx(Icon, { className: iconClass }), _jsx("span", { className: textClass, children: item.name })] }));
};
export function MainNav() {
    return (_jsx("nav", { className: "space-y-1", children: navigation.map((item) => (_jsx(NavigationItem, { item: item }, `${item.href}${item.search ?? ''}${item.hash ?? ''}`))) }));
}
