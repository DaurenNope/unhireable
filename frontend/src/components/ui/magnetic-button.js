"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
export function MagneticButton({ children, className, onClick, disabled = false }) {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);
    const buttonRef = useRef(null);
    const handleMouseMove = (e) => {
        if (!buttonRef.current || disabled)
            return;
        const rect = buttonRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const deltaX = e.clientX - centerX;
        const deltaY = e.clientY - centerY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const maxDistance = 100;
        if (distance < maxDistance) {
            const strength = (maxDistance - distance) / maxDistance;
            setMousePosition({
                x: deltaX * strength * 0.3,
                y: deltaY * strength * 0.3
            });
        }
        else {
            setMousePosition({ x: 0, y: 0 });
        }
    };
    const handleMouseEnter = () => {
        setIsHovered(true);
    };
    const handleMouseLeave = () => {
        setIsHovered(false);
        setMousePosition({ x: 0, y: 0 });
    };
    useEffect(() => {
        const handleGlobalMouseMove = () => {
            if (!isHovered) {
                setMousePosition({ x: 0, y: 0 });
            }
        };
        document.addEventListener('mousemove', handleGlobalMouseMove);
        return () => document.removeEventListener('mousemove', handleGlobalMouseMove);
    }, [isHovered]);
    return (_jsxs(motion.button, { ref: buttonRef, className: cn("relative overflow-hidden transition-all duration-300", disabled && "opacity-50 cursor-not-allowed", className), style: {
            transform: `translate(${mousePosition.x}px, ${mousePosition.y}px)`,
        }, onMouseMove: handleMouseMove, onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave, onClick: onClick, whileHover: { scale: 1.05 }, whileTap: { scale: 0.95 }, children: [_jsx(motion.div, { className: "absolute inset-0 opacity-0 bg-gradient-to-r from-primary to-accent blur-lg", animate: {
                    opacity: isHovered ? 0.3 : 0,
                }, transition: { duration: 0.3 } }), _jsx("div", { className: "relative z-10", children: children }), isHovered && (_jsx(motion.div, { className: "absolute inset-0 bg-white/10", initial: { scale: 0, opacity: 0.5 }, animate: { scale: 1, opacity: 0 }, transition: { duration: 0.6 } }))] }));
}
