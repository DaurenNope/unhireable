import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router-dom";
export function NotFound() {
    const navigate = useNavigate();
    return (_jsxs("div", { className: "flex flex-col items-center justify-center min-h-[60vh] text-center p-4", children: [_jsx("h1", { className: "text-6xl font-bold text-muted-foreground", children: "404" }), _jsx("h2", { className: "mt-4 text-2xl font-semibold", children: "Page Not Found" }), _jsx("p", { className: "mt-2 text-muted-foreground", children: "The page you're looking for doesn't exist or has been moved." }), _jsx(Button, { onClick: () => navigate(-1), className: "mt-6", children: "Go Back" })] }));
}
