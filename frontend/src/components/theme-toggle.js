import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger, } from "./ui/dropdown-menu";
export function ThemeToggle() {
    const { theme = 'system', setTheme } = useTheme();
    return (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "icon", className: "relative", children: [_jsx(Sun, { className: "h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" }), _jsx(Moon, { className: "absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" }), _jsx("span", { className: "sr-only", children: "Toggle theme" })] }) }), _jsxs(DropdownMenuContent, { className: "w-40", align: "end", children: [_jsx(DropdownMenuLabel, { children: "Theme" }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuRadioGroup, { value: theme, onValueChange: (value) => setTheme(value), children: [_jsxs(DropdownMenuRadioItem, { value: "light", className: "cursor-pointer", children: [_jsx(Sun, { className: "mr-2 h-4 w-4" }), _jsx("span", { children: "Light" })] }), _jsxs(DropdownMenuRadioItem, { value: "dark", className: "cursor-pointer", children: [_jsx(Moon, { className: "mr-2 h-4 w-4" }), _jsx("span", { children: "Dark" })] }), _jsxs(DropdownMenuRadioItem, { value: "system", className: "cursor-pointer", children: [_jsx(Monitor, { className: "mr-2 h-4 w-4" }), _jsx("span", { children: "System" })] })] })] })] }));
}
