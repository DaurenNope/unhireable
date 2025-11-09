"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, useSpring, useInView, AnimatePresence } from "framer-motion";
import { ArrowRight, Brain, Sparkles, Zap, Target, Users, BarChart3, Shield, Globe, Cpu, Network, Rocket, TrendingUp, AlertTriangle, CheckCircle2, Menu, X, Play, TrendingUp as TrendUp } from "lucide-react";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [cursorVariant, setCursorVariant] = useState("default");
  const [glitchText, setGlitchText] = useState(false);
  const [matrixRain, setMatrixRain] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const backgroundY = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const rotateX = useTransform(scrollYProgress, [0, 1], [-10, 10]);
  const rotateY = useTransform(scrollYProgress, [0, 1], [-10, 10]);
  
  useEffect(() => {
    setIsLoaded(true);
    
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const glitchInterval = setInterval(() => {
      setGlitchText(true);
      setTimeout(() => setGlitchText(false), 200);
    }, 5000);
    
    const matrixInterval = setInterval(() => {
      setMatrixRain(true);
      setTimeout(() => setMatrixRain(false), 3000);
    }, 15000);
    
    return () => {
      clearInterval(glitchInterval);
      clearInterval(matrixInterval);
    };
  }, []);

  const textEnter = () => setCursorVariant("text");
  const textLeave = () => setCursorVariant("default");

  const variants = {
    default: { 
      x: mousePosition.x - 16, 
      y: mousePosition.y - 16,
      backgroundColor: "#06b6d4",
      mixBlendMode: "difference",
      scale: 1
    },
    text: { 
      x: mousePosition.x - 16, 
      y: mousePosition.y - 16,
      backgroundColor: "#a855f7",
      mixBlendMode: "difference",
      scale: 1.5
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-white text-black overflow-x-hidden relative">
      {/* Matrix Rain Effect */}
      <AnimatePresence>
        {matrixRain && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 pointer-events-none"
          >
            {Array.from({ length: 50 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-green-400 font-mono text-xs"
                initial={{ y: -100, x: Math.random() * window.innerWidth }}
                animate={{ y: window.innerHeight + 100 }}
                transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
                style={{ left: `${Math.random() * 100}%` }}
              >
                {String.fromCharCode(0x30A0 + Math.random() * 96)}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Cursor */}
      <motion.div
        className="fixed w-8 h-8 rounded-full pointer-events-none z-50 hidden md:block"
        variants={variants}
        animate={cursorVariant}
        transition={{ type: "spring", stiffness: 500, damping: 28 }}
      />

      {/* Animated Background */}
      <motion.div 
        className="fixed inset-0 z-0"
        style={{ y: backgroundY }}
      >
        <div className="absolute top-0 -left-48 w-96 h-96 bg-black rounded-full blur-3xl opacity-20" />
        <div className="absolute top-1/2 -right-48 w-96 h-96 bg-cyan-400 rounded-full blur-3xl opacity-10" />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-purple-400 rounded-full blur-3xl opacity-10" />
      </motion.div>

      {/* Mobile Menu Button */}
      <motion.button
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }}
        className="fixed top-4 left-4 z-50 md:hidden bg-black text-white p-3 border-2 border-black"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </motion.button>

      {/* Desktop Navigation - Hidden on Mobile */}
      <motion.nav 
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }}
        className="fixed top-8 left-8 z-40 hidden md:block"
      >
        <div className="flex items-center space-x-4">
          {/* Navigation Links */}
          <div className="flex items-center space-x-2">
            {[
              { name: "App", href: "/app", icon: "⚡" },
              { name: "Pricing", href: "/pricing", icon: "$" },
              { name: "About", href: "/about", icon: "ℹ" }
            ].map((item, index) => (
              <motion.a
                key={item.name}
                href={item.href}
                className="text-sm font-mono bg-black text-white px-3 py-1 inline-flex items-center space-x-2 border-2 border-black hover:bg-white hover:text-black transition-colors"
                whileHover={{ scale: 1.05, y: -2 }}
                onMouseEnter={textEnter}
                onMouseLeave={textLeave}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.name}</span>
              </motion.a>
            ))}
          </div>
          
          {/* Social Media Links */}
          <div className="flex items-center space-x-2 ml-4">
            {[
              { 
                name: "𝕏", 
                href: "https://twitter.com/unhireable",
                label: "Twitter"
              },
              { 
                name: "in", 
                href: "https://linkedin.com/company/unhireable",
                label: "LinkedIn"
              },
              { 
                name: "📷", 
                href: "https://instagram.com/unhireable",
                label: "Instagram"
              }
            ].map((item, index) => (
              <motion.a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-cyan-400 text-black border-2 border-black flex items-center justify-center text-lg font-black hover:bg-black hover:text-cyan-400 transition-all duration-300 group"
                whileHover={{ scale: 1.1, rotate: 360 }}
                onMouseEnter={textEnter}
                onMouseLeave={textLeave}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9 + index * 0.1 }}
                title={item.label}
              >
                <span className="group-hover:scale-110 transition-transform duration-300 text-sm">
                  {item.name}
                </span>
              </motion.a>
            ))}
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu - Full Screen Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "-100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "-100%" }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed inset-0 z-40 bg-black text-white md:hidden"
          >
            <div className="flex flex-col h-full p-8">
              {/* Close Button */}
              <motion.button
                className="self-end mb-8 text-white"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="w-8 h-8" />
              </motion.button>

              {/* Navigation Items */}
              <div className="flex-1 flex flex-col justify-center space-y-8">
                {/* Main Navigation */}
                <div className="space-y-6">
                  <h3 className="text-2xl font-black text-cyan-400 mb-4">NAVIGATION</h3>
                  {[
                    { name: "App", href: "/app", icon: "⚡", desc: "Launch neural assessment" },
                    { name: "Pricing", href: "/pricing", icon: "$", desc: "View pricing plans" },
                    { name: "About", href: "/about", icon: "ℹ", desc: "Learn more about us" }
                  ].map((item, index) => (
                    <motion.a
                      key={item.name}
                      href={item.href}
                      className="block group"
                      whileHover={{ x: 10 }}
                      onClick={() => setIsMobileMenuOpen(false)}
                      initial={{ opacity: 0, x: -50 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * index }}
                    >
                      <div className="flex items-center space-x-4">
                        <span className="text-3xl">{item.icon}</span>
                        <div>
                          <div className="text-xl font-black">{item.name}</div>
                          <div className="text-sm font-mono opacity-70">{item.desc}</div>
                        </div>
                      </div>
                    </motion.a>
                  ))}
                </div>

                {/* Social Media */}
                <div className="space-y-6 pt-8 border-t border-gray-800">
                  <h3 className="text-2xl font-black text-cyan-400 mb-4">CONNECT</h3>
                  <div className="flex space-x-4">
                    {[
                      { 
                        name: "𝕏", 
                        href: "https://twitter.com/unhireable",
                        label: "Twitter"
                      },
                      { 
                        name: "in", 
                        href: "https://linkedin.com/company/unhireable",
                        label: "LinkedIn"
                      },
                      { 
                        name: "📷", 
                        href: "https://instagram.com/unhireable",
                        label: "Instagram"
                      }
                    ].map((item, index) => (
                      <motion.a
                        key={item.label}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-16 h-16 bg-cyan-400 text-black border-2 border-cyan-400 flex items-center justify-center text-2xl font-black hover:bg-white hover:text-cyan-400 transition-all duration-300"
                        whileHover={{ scale: 1.1, rotate: 360 }}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + index * 0.1 }}
                        title={item.label}
                      >
                        {item.name}
                      </motion.a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Section */}
              <div className="text-center py-8 border-t border-gray-800">
                <div className="text-2xl font-black mb-2">
                  <span className="bg-cyan-400 text-black px-2">UN</span>
                  <span>HIREABLE</span>
                </div>
                <div className="text-sm font-mono opacity-70">Neural Career System</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right Side - Mobile Optimized */}
      <motion.div
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }}
        className="fixed top-4 right-4 z-40 text-right md:top-8 md:right-8"
      >
        <motion.div
          className="font-black tracking-tighter"
          whileHover={{ scale: 1.05 }}
          onMouseEnter={textEnter}
          onMouseLeave={textLeave}
        >
          <div className="text-xl md:text-2xl lg:text-3xl lg:text-4xl">
            <span className="bg-black text-white px-1 md:px-2">UN</span>
            <span className="text-black">HIREABLE</span>
          </div>
          <div className="text-xs md:text-sm lg:text-base lg:text-lg font-mono mt-1 text-gray-600 hidden sm:block">
            //neural career system
          </div>
        </motion.div>
      </motion.div>

      {/* Main Content - Asymmetric Layout */}
      <main className="relative z-10 pt-24 lg:pt-16">
        {/* Section 1: Hero - Asymmetric */}
        <section className="min-h-screen flex items-center justify-start px-8 md:px-16">
          <div className="max-w-7xl w-full">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Column - Massive Text */}
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 1, delay: 0.8 }}
                className="lg:col-span-8"
              >
                <div className="space-y-8">
                  <motion.div
                    className="text-6xl md:text-8xl lg:text-9xl font-black leading-none relative"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                  >
                    <motion.span 
                      className="block"
                      animate={glitchText ? {
                        x: [0, -2, 2, -2, 0],
                        skewX: [0, -5, 5, -5, 0],
                        color: ["#000", "#ff0080", "#00ff00", "#0000ff", "#000"]
                      } : {}}
                      transition={{ duration: 0.2 }}
                    >
                      THE SYSTEM
                    </motion.span>
                    <motion.span 
                      className="block bg-black text-white px-4 inline-block"
                      whileHover={{ scale: 1.05 }}
                      onMouseEnter={textEnter}
                      onMouseLeave={textLeave}
                      animate={glitchText ? {
                        textShadow: ["0 0 #ff0080", "2px 2px #00ff00", "-2px -2px #0000ff", "0 0 #000"],
                        x: [0, -1, 1, -1, 0]
                      } : {}}
                      transition={{ duration: 0.1 }}
                    >
                      THINKS YOU'RE
                    </motion.span>
                    <motion.span 
                      className="block"
                      animate={glitchText ? {
                        scale: [1, 1.1, 0.9, 1.1, 1],
                        rotate: [0, 1, -1, 1, 0]
                      } : {}}
                      transition={{ duration: 0.15 }}
                    >
                      DATA.
                    </motion.span>
                  </motion.div>
                  
                  <motion.div
                    className="text-6xl md:text-8xl lg:text-9xl font-black leading-none text-cyan-400"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                  >
                    <span className="block">WE KNOW</span>
                    <motion.span 
                      className="block bg-cyan-400 text-white px-4 inline-block"
                      whileHover={{ scale: 1.05 }}
                      onMouseEnter={textEnter}
                      onMouseLeave={textLeave}
                    >
                      YOU'RE HUMAN.
                    </motion.span>
                  </motion.div>

                  <motion.p
                    className="text-lg md:text-xl font-mono max-w-2xl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2 }}
                    onMouseEnter={textEnter}
                    onMouseLeave={textLeave}
                  >
                    {"\u003e"} Get matched with perfect jobs in 21 days
                    <br />
                    {"\u003e"} AI-powered career assessment + personalized learning
                    <br />
                    {"\u003e"} 89% success rate vs 12% industry average
                  </motion.p>
                </div>
              </motion.div>

              {/* Right Column - Enhanced System Visualization */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, delay: 1.2 }}
                className="lg:col-span-4 space-y-6"
              >
                {/* Success Rate Card */}
                <motion.div
                  className="bg-black text-white p-6 rotate-3 border-4 border-cyan-400"
                  whileHover={{ rotate: 0, scale: 1.05 }}
                  onMouseEnter={textEnter}
                  onMouseLeave={textLeave}
                >
                  <div className="text-2xl font-mono mb-3 flex items-center">
                    <span className="mr-2">{"\u003c/\u003e"}</span>
                    <span className="text-cyan-400">NEURAL_SUCCESS</span>
                  </div>
                  <div className="text-3xl font-black mb-2">89%</div>
                  <div className="text-sm font-mono">SUCCESS RATE</div>
                  <div className="text-xs opacity-70 mt-2 font-mono">vs 12% industry avg</div>
                </motion.div>

                {/* Time Efficiency Card */}
                <motion.div
                  className="bg-cyan-400 text-black p-6 -rotate-2 border-4 border-black"
                  whileHover={{ rotate: 0, scale: 1.05 }}
                  onMouseEnter={textEnter}
                  onMouseLeave={textLeave}
                >
                  <div className="text-2xl font-mono mb-3 flex items-center">
                    <span className="mr-2">{"{...}"}</span>
                    <span className="text-black">TIME_OPTIMIZED</span>
                  </div>
                  <div className="text-3xl font-black mb-2">21 DAYS</div>
                  <div className="text-sm font-mono">AVERAGE HIRE TIME</div>
                  <div className="text-xs opacity-70 mt-2 font-mono">vs 4.5 months traditional</div>
                </motion.div>

                {/* Live System Status */}
                <motion.div
                  className="bg-purple-400 text-black p-6 rotate-1 border-4 border-black"
                  whileHover={{ rotate: 0, scale: 1.05 }}
                  onMouseEnter={textEnter}
                  onMouseLeave={textLeave}
                >
                  <div className="text-lg font-mono mb-3 flex items-center">
                    <span className="mr-2">{"[LIVE]"}</span>
                    <span className="text-black">SYSTEM_STATUS</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-mono">NEURAL NET</span>
                      <span className="text-xs bg-black text-white px-2 py-1">ACTIVE</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-mono">MATCHING</span>
                      <span className="text-xs bg-black text-white px-2 py-1">RUNNING</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-mono">LEARNING</span>
                      <span className="text-xs bg-black text-white px-2 py-1">EVOLVING</span>
                    </div>
                  </div>
                </motion.div>

                {/* Processing Animation */}
                <motion.div
                  className="bg-black text-white p-6 -rotate-1 border-4 border-cyan-400"
                  whileHover={{ rotate: 0, scale: 1.05 }}
                  onMouseEnter={textEnter}
                  onMouseLeave={textLeave}
                >
                  <div className="text-lg font-mono mb-3 flex items-center">
                    <span className="mr-2">{"<>"}</span>
                    <span className="text-cyan-400">PROCESSING</span>
                  </div>
                  <div className="space-y-1">
                    {[
                      "Analyzing personality patterns...",
                      "Matching to 2,847 companies...",
                      "Generating learning paths...",
                      "Optimizing resume for ATS..."
                    ].map((line, index) => (
                      <motion.div
                        key={index}
                        className="text-xs font-mono"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.2, repeat: Infinity, repeatDelay: 4 }}
                      >
                        {line}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            </div>

            {/* CTA - Enhanced Clear Button */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.5 }}
              className="mt-24 ml-0 lg:ml-32"
            >
              {/* Main CTA Button */}
              <motion.div
                className="relative group"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onMouseEnter={textEnter}
                onMouseLeave={textLeave}
              >
                {/* Pulsing background effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-400 rounded-lg"
                  animate={{
                    scale: [1, 1.05, 1],
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
                
                {/* Main button */}
                <motion.button
                  className="relative overflow-hidden bg-black text-white px-16 py-8 text-3xl md:text-4xl font-black border-4 border-white shadow-2xl"
                  onClick={() => window.location.href = "/demo"}
                >
                  {/* Background gradient overlay */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "100%" }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                  />
                  
                  {/* Button text with outline effect */}
                  <span className="relative z-10 flex items-center justify-center space-x-4">
                    <Rocket className="w-8 h-8" />
                    <span>START NEURAL ASSESSMENT</span>
                    <Zap className="w-8 h-8" />
                  </span>
                  
                  {/* Arrow indicator */}
                  <motion.span
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-white opacity-0 group-hover:opacity-100 transition-all duration-300"
                    initial={{ x: -10 }}
                    whileHover={{ x: 0 }}
                  >
                    <ArrowRight className="w-8 h-8" />
                  </motion.span>
                </motion.button>
              </motion.div>
              
              {/* Subtitle/Description */}
              <motion.p
                className="mt-6 text-lg md:text-xl font-mono text-gray-600 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 3 }}
              >
                {"<"} 10-minute assessment → 89% success rate → Dream job in 21 days {"/>"}
              </motion.p>
              
              {/* Additional trust indicators */}
              <motion.div
                className="mt-8 flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 3.5 }}
              >
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm font-mono">✓ Free Assessment</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
                  <span className="text-sm font-mono">✓ Instant Results</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
                  <span className="text-sm font-mono">✓ No Commitment</span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Section 2: What We Do - Clear Value Proposition */}
        <section className="min-h-screen flex items-center px-8 md:px-16 bg-black text-white">
          <div className="max-w-7xl w-full">
            <motion.div
              className="text-6xl md:text-8xl font-black leading-none mb-16"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="block">WHAT WE</span>
              <span className="block bg-cyan-400 text-black px-4 inline-block">ACTUALLY DO</span>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              {/* Left: The Process Flow */}
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="space-y-8"
              >
                <div className="space-y-6">
                  {/* ASSESS Step */}
                  <motion.div
                    className="bg-white text-black p-6 border-4 border-black"
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    whileHover={{ 
                      scale: 1.05, 
                      rotate: 2,
                      boxShadow: "0 0 30px rgba(0, 0, 0, 0.3)"
                    }}
                    onMouseEnter={textEnter}
                    onMouseLeave={textLeave}
                  >
                    <div className="flex items-center space-x-4 mb-4">
                      <Brain className="w-10 h-10 text-black" />
                      <div>
                        <h3 className="text-2xl font-black">ASSESS</h3>
                        <p className="text-xs font-mono opacity-70">STEP 01</p>
                      </div>
                    </div>
                    <p className="font-mono text-sm mb-3">10-minute neural personality scan</p>
                    <div className="bg-black text-white p-2">
                      <p className="text-xs font-mono">AI analyzes: skills + personality + potential</p>
                    </div>
                  </motion.div>

                  {/* MATCH Step */}
                  <motion.div
                    className="bg-cyan-400 text-black p-6 border-4 border-black rotate-2"
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 }}
                    whileHover={{ 
                      scale: 1.05, 
                      rotate: 0,
                      boxShadow: "0 0 30px rgba(6, 182, 212, 0.6)"
                    }}
                    onMouseEnter={textEnter}
                    onMouseLeave={textLeave}
                  >
                    <div className="flex items-center space-x-4 mb-4">
                      <Target className="w-10 h-10 text-black" />
                      <div>
                        <h3 className="text-2xl font-black">MATCH</h3>
                        <p className="text-xs font-mono opacity-70">STEP 02</p>
                      </div>
                    </div>
                    <p className="font-mono text-sm mb-3">Neural synthesis with 2,847 companies</p>
                    <div className="bg-black text-white p-2">
                      <p className="text-xs font-mono">89% success rate vs 12% industry avg</p>
                    </div>
                  </motion.div>

                  {/* HIRE Step */}
                  <motion.div
                    className="bg-purple-400 text-black p-6 border-4 border-black -rotate-2"
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.6 }}
                    whileHover={{ 
                      scale: 1.05, 
                      rotate: 0,
                      boxShadow: "0 0 30px rgba(168, 85, 247, 0.6)"
                    }}
                    onMouseEnter={textEnter}
                    onMouseLeave={textLeave}
                  >
                    <div className="flex items-center space-x-4 mb-4">
                      <Rocket className="w-10 h-10 text-black" />
                      <div>
                        <h3 className="text-2xl font-black">HIRE</h3>
                        <p className="text-xs font-mono opacity-70">STEP 03</p>
                      </div>
                    </div>
                    <p className="font-mono text-sm mb-3">Land dream job in 21 days flat</p>
                    <div className="bg-black text-white p-2">
                      <p className="text-xs font-mono">4.8x faster than traditional process</p>
                    </div>
                  </motion.div>
                </div>
              </motion.div>

              {/* Right: The Reality Check */}
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="space-y-8"
              >
                {/* Traditional vs Modern */}
                <motion.div
                  className="bg-black text-white p-8 border-4 border-red-500"
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  whileHover={{ 
                    scale: 1.02,
                    borderColor: "#ff0000"
                  }}
                  onMouseEnter={textEnter}
                  onMouseLeave={textLeave}
                >
                  <h3 className="text-xl font-black mb-6 text-red-500">TRADITIONAL HIRING</h3>
                  <div className="space-y-3 font-mono text-sm">
                    <div className="flex justify-between">
                      <span>Resume scanning</span>
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="flex justify-between">
                      <span>Keyword matching</span>
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="flex justify-between">
                      <span>ATS filters</span>
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="flex justify-between">
                      <span>Human review</span>
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="mt-4 pt-4 border-t border-red-500">
                      <div className="flex justify-between">
                        <span className="font-black">SUCCESS RATE</span>
                        <span className="text-red-400 font-black">12%</span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Neural Success */}
                <motion.div
                  className="bg-white text-black p-8 border-4 border-cyan-400"
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 }}
                  whileHover={{ 
                    scale: 1.02,
                    boxShadow: "0 0 30px rgba(6, 182, 212, 0.6)"
                  }}
                  onMouseEnter={textEnter}
                  onMouseLeave={textLeave}
                >
                  <h3 className="text-xl font-black mb-6 text-cyan-400">NEURAL SYNTHESIS</h3>
                  <div className="space-y-3 font-mono text-sm">
                    <div className="flex justify-between">
                      <span>Personality analysis</span>
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="flex justify-between">
                      <span>Cultural matching</span>
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="flex justify-between">
                      <span>Skill gap analysis</span>
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="flex justify-between">
                      <span>AI optimization</span>
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="mt-4 pt-4 border-t border-cyan-400">
                      <div className="flex justify-between">
                        <span className="font-black">SUCCESS RATE</span>
                        <span className="text-cyan-400 font-black">89%</span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* The Bottom Line */}
                <motion.div
                  className="bg-black text-white p-6 border-4 border-cyan-400"
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.7 }}
                  whileHover={{ 
                    scale: 1.05,
                    rotate: 1
                  }}
                  onMouseEnter={textEnter}
                  onMouseLeave={textLeave}
                >
                  <div className="text-center">
                    <div className="text-2xl font-black mb-2">THE BOTTOM LINE</div>
                    <div className="text-lg font-mono text-cyan-400">
                      21 DAYS ← 4.5 MONTHS
                    </div>
                    <div className="text-sm font-mono opacity-70 mt-2">
                      Stop being data. Start being human.
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Section 3: Problem/Solution - Simplified */}
        <section className="min-h-screen flex items-center px-8 md:px-16 bg-white text-black">
          <div className="max-w-7xl w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              {/* Problem Section */}
              <motion.div
                initial={{ opacity: 0, x: -100 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 1 }}
                className="space-y-8"
              >
                <div className="space-y-4">
                  <motion.h2
                    className="text-5xl md:text-7xl font-black leading-none"
                    whileHover={{ scale: 1.02 }}
                    onMouseEnter={textEnter}
                    onMouseLeave={textLeave}
                  >
                    <span className="bg-red-500 text-white px-4">PROBLEM:</span>
                  </motion.h2>
                  
                  <div className="space-y-3 font-mono text-lg">
                    {[
                      "function traditionalHiring() {",
                      "  scanForKeywords(resume);",
                      "  applyBooleanLogic(skills);",
                      "  loseInATS(tracking);",
                      "  rejectCandidate(89%);",
                      "}"
                    ].map((line, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 }}
                        className={index === 0 || index === 5 ? "ml-4" : "ml-8"}
                      >
                        {line}
                      </motion.div>
                    ))}
                  </div>

                  {/* Normie Explanation - Enhanced Design */}
                  <motion.div
                    className="mt-8 relative"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.8 }}
                  >
                    <div className="absolute inset-0 bg-red-500 transform rotate-1"></div>
                    <div className="relative bg-black text-white p-6 border-4 border-red-500 transform -rotate-1">
                      <div className="flex items-start space-x-4">
                        <motion.div
                          className="bg-red-500 text-black p-2 flex-shrink-0"
                          whileHover={{ rotate: 15, scale: 1.1 }}
                        >
                          <AlertTriangle className="w-6 h-6" />
                        </motion.div>
                        <div>
                          <motion.h4 
                            className="font-black text-lg mb-2 text-red-400"
                            whileHover={{ scale: 1.05 }}
                          >
                            // IN PLAIN ENGLISH:
                          </motion.h4>
                          <p className="text-sm text-red-300 leading-relaxed font-mono">
                            {"<"} Traditional hiring treats you like a keyword search.<br/>
                            {"  "} Companies use ATS systems that scan resumes<br/>
                            {"  "} Filter out 89% of qualified candidates<br/>
                            {"  "} You compete against algorithms, not humans<br/>
                            {"/>"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>

              {/* Solution Section */}
              <motion.div
                initial={{ opacity: 0, x: 100 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.3 }}
                className="space-y-8"
              >
                <div className="space-y-4">
                  <motion.h2
                    className="text-5xl md:text-7xl font-black leading-none"
                    whileHover={{ scale: 1.02 }}
                    onMouseEnter={textEnter}
                    onMouseLeave={textLeave}
                  >
                    <span className="bg-cyan-400 text-black px-4">SOLUTION:</span>
                  </motion.h2>
                  
                  <div className="space-y-3 font-mono text-lg">
                    {[
                      "function neuralSynthesis() {",
                      "  analyzePersonality(candidate);",
                      "  understandCulturalFit(company);",
                      "  identifySkillGaps(currentSkills, targetRole);",
                      "  generatePersonalizedPath(user);",
                      "  successRate(89%);",
                      "}"
                    ].map((line, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 + 0.5 }}
                        className={index === 0 || index === 6 ? "ml-4 text-cyan-400" : "ml-8"}
                      >
                        {line}
                      </motion.div>
                    ))}
                  </div>

                  {/* Normie Explanation - Enhanced Design */}
                  <motion.div
                    className="mt-8 relative"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.8 }}
                  >
                    <div className="absolute inset-0 bg-green-500 transform rotate-1"></div>
                    <div className="relative bg-black text-white p-6 border-4 border-green-400 transform -rotate-1">
                      <div className="flex items-start space-x-4">
                        <motion.div
                          className="bg-green-400 text-black p-2 flex-shrink-0"
                          whileHover={{ rotate: -15, scale: 1.1 }}
                        >
                          <CheckCircle2 className="w-6 h-6" />
                        </motion.div>
                        <div>
                          <motion.h4 
                            className="font-black text-lg mb-2 text-green-400"
                            whileHover={{ scale: 1.05 }}
                          >
                            // IN PLAIN ENGLISH:
                          </motion.h4>
                          <p className="text-sm text-green-300 leading-relaxed font-mono">
                            {"<"} Our AI understands you as a complete person<br/>
                            {"  "} Your personality + workplace values + skills<br/>
                            {"  "} We match you with companies where you'll thrive<br/>
                            {"  "} Create personalized learning paths for success<br/>
                            {"  "} 89% success rate because we match humans, not resumes<br/>
                            {"/>"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Section 3: System Visualization */}
        <section className="min-h-screen flex items-center px-8 md:px-16 py-24 bg-black text-white">
          <div className="max-w-7xl w-full">
            <motion.div
              className="text-6xl md:text-8xl font-black leading-none mb-16"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="block">SYSTEM</span>
              <span className="block bg-cyan-400 text-black px-4 inline-block">VISUALIZATION</span>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              {/* Left: System Flow */}
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="space-y-6"
              >
                <div className="bg-gray-900 border-2 border-cyan-400 p-6">
                  <h3 className="text-xl font-black mb-4 text-cyan-400">NEURAL FLOW</h3>
                  <div className="space-y-3">
                    {[
                      { step: "INPUT", desc: "Personality + Skills + Goals", status: "ACTIVE" },
                      { step: "ANALYSIS", desc: "AI pattern recognition", status: "RUNNING" },
                      { step: "MATCHING", desc: "2,847 companies scanned", status: "COMPLETE" },
                      { step: "OPTIMIZATION", desc: "Resume + Learning paths", status: "RUNNING" },
                      { step: "OUTPUT", desc: "Perfect career match", status: "READY" }
                    ].map((item, index) => (
                      <motion.div
                        key={index}
                        className="flex items-center justify-between bg-black p-3 border border-cyan-400"
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 }}
                        onMouseEnter={textEnter}
                        onMouseLeave={textLeave}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-cyan-400 font-mono">{item.step}</span>
                          <span className="text-sm font-mono">{item.desc}</span>
                        </div>
                        <span className={`text-xs px-2 py-1 font-mono ${
                          item.status === 'ACTIVE' ? 'bg-green-500 text-black' :
                          item.status === 'RUNNING' ? 'bg-yellow-400 text-black' :
                          item.status === 'COMPLETE' ? 'bg-cyan-400 text-black' :
                          'bg-purple-400 text-black'
                        }`}>
                          {item.status}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Right: Real-time Processing */}
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="space-y-6"
              >
                <div className="bg-gray-900 border-2 border-purple-400 p-6">
                  <h3 className="text-xl font-black mb-4 text-purple-400">REAL-TIME PROCESSING</h3>
                  <div className="space-y-4">
                    <div className="bg-black p-4 border border-purple-400">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-mono text-purple-400">CANDIDATES PROCESSED</span>
                        <span className="text-xs bg-purple-400 text-black px-2 py-1 font-mono">LIVE</span>
                      </div>
                      <div className="text-3xl font-black">1,247</div>
                      <div className="text-xs font-mono opacity-70">+23 in last hour</div>
                    </div>

                    <div className="bg-black p-4 border border-purple-400">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-mono text-purple-400">MATCHES GENERATED</span>
                        <span className="text-xs bg-purple-400 text-black px-2 py-1 font-mono">LIVE</span>
                      </div>
                      <div className="text-3xl font-black">8,923</div>
                      <div className="text-xs font-mono opacity-70">89.3% success rate</div>
                    </div>

                    <div className="bg-black p-4 border border-purple-400">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-mono text-purple-400">LEARNING PATHS</span>
                        <span className="text-xs bg-purple-400 text-black px-2 py-1 font-mono">ACTIVE</span>
                      </div>
                      <div className="text-3xl font-black">342</div>
                      <div className="text-xs font-mono opacity-70">In progress now</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Section 4: Advanced System Representation */}
        <section className="min-h-screen flex items-center px-8 md:px-16 py-24 bg-white">
          <div className="max-w-7xl w-full">
            <motion.div
              className="text-6xl md:text-8xl font-black leading-none mb-16"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="block">AI SYSTEM</span>
              <span className="block bg-black text-white px-4 inline-block">IN ACTION</span>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Neural Network Visualization */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="bg-black text-white p-8 border-4 border-cyan-400"
                onMouseEnter={textEnter}
                onMouseLeave={textLeave}
              >
                <h3 className="text-xl font-black mb-6 text-cyan-400">NEURAL NETWORK</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono">LAYERS ACTIVE</span>
                    <span className="text-lg font-black">247</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono">NODES PROCESSING</span>
                    <span className="text-lg font-black">8,923</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono">ACCURACY</span>
                    <span className="text-lg font-black text-cyan-400">94.7%</span>
                  </div>
                  <div className="mt-6 p-3 bg-gray-900 border border-cyan-400">
                    <div className="text-xs font-mono text-cyan-400 mb-2">REAL-TIME ACTIVITY</div>
                    <div className="space-y-1">
                      {["Pattern matching...", "Learning adaptation...", "Cultural analysis..."].map((activity, i) => (
                        <motion.div
                          key={i}
                          className="text-xs font-mono opacity-70"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0.7, 1, 0.7] }}
                          transition={{ delay: i * 0.3, repeat: Infinity, duration: 2 }}
                        >
                          {activity}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Candidate Journey */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="bg-cyan-400 text-black p-8 border-4 border-black"
                onMouseEnter={textEnter}
                onMouseLeave={textLeave}
              >
                <h3 className="text-xl font-black mb-6">CANDIDATE JOURNEY</h3>
                <div className="space-y-4">
                  {[
                    { step: "1", title: "ASSESSMENT", status: "COMPLETE", desc: "Personality + Skills" },
                    { step: "2", title: "ANALYSIS", status: "COMPLETE", desc: "AI Pattern Match" },
                    { step: "3", title: "MATCHING", status: "ACTIVE", desc: "2,847 Companies" },
                    { step: "4", title: "OPTIMIZATION", status: "RUNNING", desc: "Resume + Learning" }
                  ].map((item, index) => (
                    <motion.div
                      key={index}
                      className="bg-black text-white p-3 border-2"
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.1 * index }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono bg-cyan-400 text-black px-2 py-1">{item.step}</span>
                          <span className="text-sm font-black">{item.title}</span>
                        </div>
                        <span className={`text-xs px-2 py-1 font-mono ${
                          item.status === 'COMPLETE' ? 'bg-green-400 text-black' :
                          item.status === 'ACTIVE' ? 'bg-yellow-400 text-black' :
                          'bg-gray-400 text-black'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <div className="text-xs font-mono opacity-70">{item.desc}</div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Live Results */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="bg-purple-400 text-black p-8 border-4 border-black"
                onMouseEnter={textEnter}
                onMouseLeave={textLeave}
              >
                <h3 className="text-xl font-black mb-6">LIVE RESULTS</h3>
                <div className="space-y-4">
                  <div className="bg-black text-white p-4 border-2">
                    <div className="text-3xl font-black mb-2">89%</div>
                    <div className="text-sm font-mono">SUCCESS RATE</div>
                    <div className="text-xs font-mono opacity-70">vs 12% industry</div>
                  </div>
                  <div className="bg-black text-white p-4 border-2">
                    <div className="text-3xl font-black mb-2">21 Days</div>
                    <div className="text-sm font-mono">HIRE TIME</div>
                    <div className="text-xs font-mono opacity-70">vs 4.5 months</div>
                  </div>
                  <div className="bg-black text-white p-4 border-2">
                    <div className="text-3xl font-black mb-2">4.8x</div>
                    <div className="text-sm font-mono">FASTER PLACEMENT</div>
                    <div className="text-xs font-mono opacity-70">Industry average</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Section 5: How Our AI Works - Clear Linear Process */}
        <section className="min-h-screen flex items-center px-4 sm:px-8 md:px-16 py-12 md:py-24 bg-black text-white">
          <div className="max-w-7xl w-full">
            <motion.div
              className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black leading-none mb-8 md:mb-16"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="block">HOW OUR AI</span>
              <span className="block bg-cyan-400 text-black px-4 inline-block">REALLY WORKS</span>
            </motion.div>

            {/* Linear Process Flow */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
              {/* Step 1 & 2 */}
              <div className="space-y-8">
                <motion.div
                  className="bg-white text-black p-8 border-4 border-cyan-400"
                  initial={{ opacity: 0, x: -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  whileHover={{ 
                    scale: 1.02,
                    borderColor: "#06b6d4"
                  }}
                  onMouseEnter={textEnter}
                  onMouseLeave={textLeave}
                >
                  <div className="flex items-start space-x-4">
                    <div className="text-4xl font-black text-cyan-400">01</div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-black mb-3">WE ANALYZE YOU</h3>
                      <p className="font-mono text-sm mb-4">10-minute personality & skills assessment</p>
                      <div className="bg-black text-white p-3 font-mono text-xs">
                        → Personality patterns<br/>
                        → Technical skills<br/>
                        → Career goals<br/>
                        → Learning preferences
                      </div>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className="bg-cyan-400 text-black p-8 border-4 border-black"
                  initial={{ opacity: 0, x: -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 }}
                  whileHover={{ 
                    scale: 1.02,
                    rotate: 1
                  }}
                  onMouseEnter={textEnter}
                  onMouseLeave={textLeave}
                >
                  <div className="flex items-start space-x-4">
                    <div className="text-4xl font-black">02</div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-black mb-3">WE SCAN COMPANIES</h3>
                      <p className="font-mono text-sm mb-4">AI analyzes 2,847 companies in real-time</p>
                      <div className="bg-black text-white p-3 font-mono text-xs">
                        → Company culture<br/>
                        → Technical requirements<br/>
                        → Growth opportunities<br/>
                        → Team dynamics
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Step 3 & 4 */}
              <div className="space-y-8">
                <motion.div
                  className="bg-purple-400 text-black p-8 border-4 border-black"
                  initial={{ opacity: 0, x: 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6 }}
                  whileHover={{ 
                    scale: 1.02,
                    rotate: -1
                  }}
                  onMouseEnter={textEnter}
                  onMouseLeave={textLeave}
                >
                  <div className="flex items-start space-x-4">
                    <div className="text-4xl font-black">03</div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-black mb-3">WE FIND MATCHES</h3>
                      <p className="font-mono text-sm mb-4">Neural algorithm finds perfect fits</p>
                      <div className="bg-black text-white p-3 font-mono text-xs">
                        → Skill compatibility<br/>
                        → Cultural alignment<br/>
                        → Growth potential<br/>
                        → Success probability
                      </div>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className="bg-white text-black p-8 border-4 border-purple-400"
                  initial={{ opacity: 0, x: 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.8 }}
                  whileHover={{ 
                    scale: 1.02,
                    borderColor: "#a855f7"
                  }}
                  onMouseEnter={textEnter}
                  onMouseLeave={textLeave}
                >
                  <div className="flex items-start space-x-4">
                    <div className="text-4xl font-black text-purple-400">04</div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-black mb-3">WE GET YOU HIRED</h3>
                      <p className="font-mono text-sm mb-4">Auto-apply & optimize your success</p>
                      <div className="bg-black text-white p-3 font-mono text-xs">
                        → Resume optimization<br/>
                        → Auto-applications<br/>
                        → Learning paths<br/>
                        → Interview prep
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* The Result */}
            <motion.div
              className="bg-gradient-to-r from-cyan-400 to-purple-400 text-black p-8 border-4 border-black text-center"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 1 }}
              whileHover={{ 
                scale: 1.02,
                rotate: 1
              }}
              onMouseEnter={textEnter}
              onMouseLeave={textLeave}
            >
              <div className="text-3xl md:text-4xl font-black mb-4">THE RESULT</div>
              <div className="text-xl md:text-2xl font-mono mb-4">89% SUCCESS RATE</div>
              <div className="text-lg font-mono">Get hired in 21 days vs 4.5 months traditional</div>
            </motion.div>
          </div>
        </section>

        {/* Final CTA - Full Width Brutalist */}
        <section className="min-h-screen flex items-center justify-center px-8 md:px-16 bg-gradient-to-b from-black to-white">
          <motion.div
            className="text-center max-w-4xl"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
          >
            <motion.h2
              className="text-5xl md:text-7xl lg:text-8xl font-black leading-none mb-8"
              whileHover={{ scale: 1.02 }}
              onMouseEnter={textEnter}
              onMouseLeave={textLeave}
            >
              <span className="block">STOP BEING</span>
              <span className="block bg-cyan-400 text-black px-4 inline-block">UNHIREABLE</span>
              <span className="block">START BEING</span>
              <span className="block bg-purple-400 text-white px-4 inline-block">UNSTOPPABLE</span>
            </motion.h2>

            <motion.p
              className="text-xl font-mono mb-12"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              {"\u003e"} Join the revolution. 10 minutes. Lifetime impact.
            </motion.p>

            <motion.button
              className="group relative overflow-hidden bg-black text-white px-16 py-8 text-3xl font-black border-4 border-black"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onMouseEnter={textEnter}
              onMouseLeave={textLeave}
              onClick={() => window.location.href = "/demo"}
            >
              <span className="relative z-10">BEGIN YOUR JOURNEY</span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-400"
                initial={{ x: "-100%" }}
                whileHover={{ x: 0 }}
                transition={{ duration: 0.3 }}
              />
            </motion.button>
          </motion.div>
        </section>
      </main>

      {/* Minimal Footer */}
      <footer className="relative py-8 px-8 md:px-16 bg-black text-white border-t-4 border-black">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <motion.div
            className="text-2xl font-black tracking-tighter"
            whileHover={{ scale: 1.05 }}
            onMouseEnter={textEnter}
            onMouseLeave={textLeave}
          >
            <span className="bg-white text-black px-2">UN</span>
            <span className="text-white">HIREABLE</span>
          </motion.div>
          
          <motion.div
            className="font-mono text-sm"
            whileHover={{ scale: 1.05 }}
            onMouseEnter={textEnter}
            onMouseLeave={textLeave}
          >
            © 2024 // NEURAL CAREER SYNTHESIS
          </motion.div>
        </div>
      </footer>
    </div>
  );
}
