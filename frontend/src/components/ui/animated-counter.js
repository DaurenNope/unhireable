"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import { useInView } from "framer-motion";
export function AnimatedCounter({ value, duration = 2, className = "" }) {
    const [displayValue, setDisplayValue] = useState("0");
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-100px" });
    useEffect(() => {
        if (!isInView)
            return;
        const numericValue = parseFloat(value.replace(/[^0-9.]/g, ""));
        const suffix = value.replace(/[0-9.]/g, "");
        const startTime = Date.now();
        const endTime = startTime + duration * 1000;
        const animate = () => {
            const now = Date.now();
            const progress = Math.min((now - startTime) / duration / 1000, 1);
            // Easing function
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentValue = numericValue * easeOutQuart;
            setDisplayValue(currentValue.toFixed(1) + suffix);
            if (now < endTime) {
                requestAnimationFrame(animate);
            }
            else {
                setDisplayValue(value);
            }
        };
        requestAnimationFrame(animate);
    }, [isInView, value, duration]);
    return _jsx("span", { ref: ref, className: className, children: displayValue });
}
