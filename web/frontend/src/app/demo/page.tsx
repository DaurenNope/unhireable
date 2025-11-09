"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, Zap, Target, Users, BarChart3, Rocket, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatbotContainer } from "@/components/assessment/ChatbotContainer";

export default function DemoPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [cursorVariant, setCursorVariant] = useState("default");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [glitchText, setGlitchText] = useState(false);

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
    
    return () => clearInterval(glitchInterval);
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

  if (showAssessment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="relative">
          {/* Back Button */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="fixed top-4 left-4 z-50 bg-cyan-400 text-black px-4 py-2 border-2 border-black font-mono text-sm hover:bg-white transition-colors"
            onClick={() => setShowAssessment(false)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            ← ESCAPE ASSESSMENT
          </motion.button>

          {/* Assessment Container */}
          <div className="pt-20 px-4">
            <ChatbotContainer
              userId="demo-user-123"
              onAssessmentComplete={(answers) => {
                console.log("Assessment completed:", answers);
                // Handle completion - could redirect to results or show success
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black overflow-x-hidden relative">
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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <div className="absolute top-0 -left-48 w-96 h-96 bg-black rounded-full blur-3xl opacity-20" />
        <div className="absolute top-1/2 -right-48 w-96 h-96 bg-cyan-400 rounded-full blur-3xl opacity-10" />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-purple-400 rounded-full blur-3xl opacity-10" />
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="fixed top-8 right-8 z-40 text-right"
      >
        <motion.div
          className="font-black tracking-tighter"
          whileHover={{ scale: 1.05 }}
          onMouseEnter={textEnter}
          onMouseLeave={textLeave}
        >
          <div className="text-2xl md:text-3xl lg:text-4xl">
            <span className="bg-black text-white px-1 md:px-2">UN</span>
            <span className="text-black">HIREABLE</span>
          </div>
          <div className="text-xs md:text-sm lg:text-base font-mono mt-1 text-gray-600 hidden sm:block">
            //neural career demo
          </div>
        </motion.div>
      </motion.div>

      {/* Main Content */}
      <main className="relative z-10 pt-24 lg:pt-16 px-8 md:px-16">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="text-center mb-16"
          >
            <motion.div
              className="text-6xl md:text-8xl lg:text-9xl font-black leading-none mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
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
                ALRIGHT LISTEN UP
              </motion.span>
              <motion.span 
                className="block bg-cyan-400 text-black px-4 inline-block mt-2"
                whileHover={{ scale: 1.05 }}
                onMouseEnter={textEnter}
                onMouseLeave={textLeave}
              >
                YOU'RE PROBABLY SICK
              </motion.span>
              <motion.span 
                className="block mt-2"
                animate={glitchText ? {
                  scale: [1, 1.1, 0.9, 1.1, 1],
                  rotate: [0, 1, -1, 1, 0]
                } : {}}
                transition={{ duration: 0.15 }}
              >
                OF ANOTHER AI CHAT
              </motion.span>
            </motion.div>

            <motion.p
              className="text-xl md:text-2xl font-mono max-w-4xl mx-auto mb-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              onMouseEnter={textEnter}
              onMouseLeave={textLeave}
            >
              I get it. Another "revolutionary AI" that's gonna change your life. 
              <br />
              <span className="text-cyan-400 font-black">But this one actually works.</span>
              <br />
              Let's do this already so you can get paid.
            </motion.p>
          </motion.div>

          {/* Stats Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.8 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16"
          >
            <motion.div
              className="bg-black text-white p-6 rotate-1 border-4 border-cyan-400"
              whileHover={{ rotate: 0, scale: 1.05 }}
              onMouseEnter={textEnter}
              onMouseLeave={textLeave}
            >
              <div className="text-2xl font-mono mb-3 flex items-center">
                <span className="mr-2">{"\u003c/\u003e"}</span>
                <span className="text-cyan-400">SUCCESS_RATE</span>
              </div>
              <div className="text-4xl font-black mb-2">89%</div>
              <div className="text-sm font-mono">ACTUALLY GETS HIRED</div>
            </motion.div>

            <motion.div
              className="bg-cyan-400 text-black p-6 -rotate-2 border-4 border-black"
              whileHover={{ rotate: 0, scale: 1.05 }}
              onMouseEnter={textEnter}
              onMouseLeave={textLeave}
            >
              <div className="text-2xl font-mono mb-3 flex items-center">
                <span className="mr-2">{"{...}"}</span>
                <span className="text-black">TIME_SUCK</span>
              </div>
              <div className="text-4xl font-black mb-2">21 DAYS</div>
              <div className="text-sm font-mono">NOT 4.5 MONTHS</div>
            </motion.div>

            <motion.div
              className="bg-purple-400 text-black p-6 rotate-1 border-4 border-black"
              whileHover={{ rotate: 0, scale: 1.05 }}
              onMouseEnter={textEnter}
              onMouseLeave={textLeave}
            >
              <div className="text-2xl font-mono mb-3 flex items-center">
                <span className="mr-2">{"[!]"}</span>
                <span className="text-black">COMPANIES</span>
              </div>
              <div className="text-4xl font-black mb-2">2,847</div>
              <div className="text-sm font-mono">READY FOR YOU</div>
            </motion.div>
          </motion.div>

          {/* The Chat Section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 2, duration: 0.8 }}
            className="max-w-4xl mx-auto"
          >
            {/* CTA Button */}
            <motion.div
              className="text-center mb-8"
              whileHover={{ scale: 1.02 }}
            >
              <motion.button
                className="relative overflow-hidden bg-black text-white px-16 py-8 text-3xl md:text-4xl font-black border-4 border-cyan-400 shadow-2xl group"
                onClick={() => setShowAssessment(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onMouseEnter={textEnter}
                onMouseLeave={textLeave}
              >
                {/* Background gradient overlay */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "100%" }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                />
                
                {/* Button text */}
                <span className="relative z-10 flex items-center justify-center space-x-4">
                  <Rocket className="w-8 h-8" />
                  <span>START THE DAMN THING</span>
                  <Zap className="w-8 h-8" />
                </span>
              </motion.button>
              
              <motion.p
                className="mt-6 text-lg font-mono text-gray-600"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.5 }}
              >
                {"<"} 10 minutes → 89% success → actually gets you hired {"/>"}
              </motion.p>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-8 mb-16"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 3 }}
            >
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-mono">✓ No Bullshit</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-mono">✓ Real Results</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-mono">✓ Actually Works</span>
              </div>
            </motion.div>
          </motion.div>

          {/* What You'll Get Section */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 3.5, duration: 0.8 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
          >
            {[
              {
                icon: <Target className="w-8 h-8" />,
                title: "SMART MATCHING",
                description: "AI that actually understands you, not just keywords",
                color: "cyan"
              },
              {
                icon: <Zap className="w-8 h-8" />,
                title: "INSTANT RESULTS",
                description: "No waiting 6 weeks for a rejection email",
                color: "purple"
              },
              {
                icon: <BarChart3 className="w-8 h-8" />,
                title: "REAL ANALYTICS",
                description: "Track your progress and actually improve",
                color: "green"
              },
              {
                icon: <Users className="w-8 h-8" />,
                title: "HUMAN CONNECTIONS",
                description: "Match with actual humans, not HR bots",
                color: "orange"
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                className={`bg-white border-4 ${
                  feature.color === 'cyan' ? 'border-cyan-400' :
                  feature.color === 'purple' ? 'border-purple-400' :
                  feature.color === 'green' ? 'border-green-400' :
                  'border-orange-400'
                } p-6`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 4 + index * 0.1 }}
                whileHover={{ 
                  scale: 1.05, 
                  y: -5,
                  boxShadow: feature.color === 'cyan' ? "0 10px 30px rgba(6, 182, 212, 0.6)" :
                             feature.color === 'purple' ? "0 10px 30px rgba(168, 85, 247, 0.6)" :
                             feature.color === 'green' ? "0 10px 30px rgba(34, 197, 94, 0.6)" :
                             "0 10px 30px rgba(251, 146, 60, 0.6)"
                }}
                onMouseEnter={textEnter}
                onMouseLeave={textLeave}
              >
                <div className={`w-16 h-16 ${
                  feature.color === 'cyan' ? 'bg-cyan-400' :
                  feature.color === 'purple' ? 'bg-purple-400' :
                  feature.color === 'green' ? 'bg-green-400' :
                  'bg-orange-400'
                } text-black rounded-full flex items-center justify-center mb-4`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-black mb-2">{feature.title}</h3>
                <p className="text-sm font-mono text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Final Push */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 5, duration: 0.8 }}
            className="text-center"
          >
            <motion.div
              className="bg-gradient-to-r from-black via-gray-900 to-black text-white p-8 border-4 border-cyan-400"
              whileHover={{ scale: 1.02 }}
            >
              <div className="text-3xl md:text-4xl font-black mb-4">
                <span className="bg-cyan-400 text-black px-4">ENOUGH TALKING</span>
              </div>
              <div className="text-xl font-mono mb-6">
                Time to actually get you hired
              </div>
              <motion.button
                className="bg-cyan-400 text-black px-8 py-4 text-xl font-black border-4 border-white"
                onClick={() => setShowAssessment(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onMouseEnter={textEnter}
                onMouseLeave={textLeave}
              >
                LET'S GO ALREADY
              </motion.button>
            </motion.div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
