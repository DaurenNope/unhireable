"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "react-router-dom";
import { Menu, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { navigation } from "./nav-config";
export function MobileNav() {
    const [open, setOpen] = useState(false);
    const [expandedItems, setExpandedItems] = useState({});
    const location = useLocation();
    const pathname = location.pathname;
    const sheetRef = useRef(null);
    // Close the sheet when route changes
    useEffect(() => {
        setOpen(false);
        setExpandedItems({});
    }, [pathname]);
    const toggleItem = (name) => {
        setExpandedItems(prev => ({
            ...prev,
            [name]: !prev[name]
        }));
    };
    const closeSheet = () => {
        setOpen(false);
        setExpandedItems({});
    };
    return (_jsxs(Sheet, { open: open, onOpenChange: setOpen, children: [_jsx(SheetTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "icon", className: "md:hidden", onClick: () => setOpen(true), children: [_jsx(Menu, { className: "h-5 w-5" }), _jsx("span", { className: "sr-only", children: "Toggle Menu" })] }) }), _jsx(SheetContent, { side: "left", className: "w-[300px] p-0", ref: sheetRef, children: _jsxs("div", { className: "flex h-full flex-col", children: [_jsxs("div", { className: "flex h-16 items-center border-b px-4", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Menu" }), _jsxs(Button, { variant: "ghost", size: "icon", className: "ml-auto", onClick: closeSheet, children: [_jsx(X, { className: "h-5 w-5" }), _jsx("span", { className: "sr-only", children: "Close menu" })] })] }), _jsx(ScrollArea, { className: "flex-1", children: _jsx("nav", { className: "space-y-0.5 p-2", children: navigation.map((item) => (_jsx("div", { className: "space-y-0.5", children: _jsx("div", { className: "relative", children: item.subItems ? (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => toggleItem(item.name), className: cn("flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors", (pathname === item.href ||
                                                        item.subItems?.some(si => pathname.startsWith(si.href)))
                                                        ? "bg-accent text-accent-foreground"
                                                        : "hover:bg-accent/50"), children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(item.icon, { className: "h-4 w-4 flex-shrink-0" }), _jsx("span", { children: item.name })] }), _jsx(ChevronRight, { className: cn("h-4 w-4 transition-transform", expandedItems[item.name] && "rotate-90") })] }), expandedItems[item.name] && (_jsx("div", { className: "ml-4 mt-0.5 space-y-0.5 border-l pl-2", children: item.subItems.map((subItem) => (_jsxs(Link, { to: subItem.href, className: cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors", pathname === subItem.href
                                                            ? "bg-accent text-accent-foreground"
                                                            : "hover:bg-accent/50"), onClick: closeSheet, children: [_jsx("span", { className: "h-4 w-4 flex-shrink-0" }), _jsx("span", { children: subItem.name })] }, subItem.name))) }))] })) : (_jsxs(Link, { to: item.href, className: cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors", pathname === item.href
                                                ? "bg-accent text-accent-foreground"
                                                : "hover:bg-accent/50"), onClick: closeSheet, children: [_jsx(item.icon, { className: "h-4 w-4 flex-shrink-0" }), _jsx("span", { children: item.name })] })) }) }, item.name))) }) })] }) })] }));
}
