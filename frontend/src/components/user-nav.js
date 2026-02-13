import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/api/client";
import { useToast } from "./ui/use-toast";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger, } from "./ui/dropdown-menu";
import { User, LogOut, Settings, User as UserIcon } from "lucide-react";
export function UserNav() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const authStatus = queryClient.getQueryData(['auth-status']);
    const logoutMutation = useMutation({
        mutationFn: () => authApi.logout(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['auth-status'] });
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : null;
            toast({
                title: 'Failed to log out',
                description: message ?? 'Please try again',
                variant: 'destructive',
            });
        },
    });
    const handleLogout = () => {
        logoutMutation.mutate();
    };
    return (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", className: "relative h-8 w-8 rounded-full", children: _jsx(User, { className: "h-4 w-4" }) }) }), _jsxs(DropdownMenuContent, { className: "w-56", align: "end", children: [_jsx(DropdownMenuLabel, { className: "font-normal", children: _jsxs("div", { className: "flex flex-col space-y-1", children: [_jsx("p", { className: "text-sm font-medium leading-none", children: authStatus?.email || 'Account' }), _jsx("p", { className: "text-xs leading-none text-muted-foreground", children: authStatus?.authenticated ? 'Signed in' : 'Signed out' })] }) }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuGroup, { children: [_jsxs(DropdownMenuItem, { children: [_jsx(UserIcon, { className: "mr-2 h-4 w-4" }), _jsx("span", { children: "Profile" }), _jsx(DropdownMenuShortcut, { children: "\u21E7\u2318P" })] }), _jsxs(DropdownMenuItem, { children: [_jsx(Settings, { className: "mr-2 h-4 w-4" }), _jsx("span", { children: "Settings" }), _jsx(DropdownMenuShortcut, { children: "\u2318S" })] })] }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onSelect: handleLogout, children: [_jsx(LogOut, { className: "mr-2 h-4 w-4" }), _jsx("span", { children: logoutMutation.isPending ? 'Logging out...' : 'Log out' }), _jsx(DropdownMenuShortcut, { children: "\u21E7\u2318Q" })] })] })] }));
}
