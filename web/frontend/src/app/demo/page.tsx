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

          {/* Integrated Chat Section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 2, duration: 0.8 }}
            className="max-w-6xl mx-auto mb-16"
          >
            {/* Section Title */}
            <motion.div
              className="text-center mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.5 }}
            >
              <div className="text-3xl md:text-4xl font-black mb-4">
                <span className="bg-black text-white px-4">TRY IT RIGHT HERE</span>
              </div>
              <div className="text-lg font-mono text-gray-600">
                No popup. No overlay. Just the real deal.
              </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              {/* Benefits - Left */}
              <motion.div
                className="space-y-6"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 2.8, duration: 0.8 }}
              >
                <motion.div
                  className="bg-black text-white p-6 border-4 border-cyan-400 -rotate-1"
                  whileHover={{ rotate: 0, scale: 1.05 }}
                  onMouseEnter={textEnter}
                  onMouseLeave={textLeave}
                >
                  <div className="text-xl font-black mb-2">THIS ISN'T YOUR</div>
                  <div className="text-xl font-black text-cyan-400">AVERAGE CHATBOT</div>
                  <div className="text-sm font-mono mt-2">
                    No templates. No keyword matching.<br/>
                    Just AI that actually gets you hired.
                  </div>
                </motion.div>

                <div className="space-y-4">
                  {[
                    "Actually understands your personality",
                    "Matches you with real companies", 
                    "Creates custom learning paths",
                    "Optimizes your resume automatically"
                  ].map((feature, index) => (
                    <motion.div
                      key={index}
                      className="bg-white border-2 border-black p-4 flex items-start space-x-3"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 3 + index * 0.1 }}
                      whileHover={{ scale: 1.02, x: 5 }}
                      onMouseEnter={textEnter}
                      onMouseLeave={textLeave}
                    >
                      <div className="w-6 h-6 bg-cyan-400 text-black rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">
                        ✓
                      </div>
                      <span className="text-sm font-mono">{feature}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Center: Actual Chat */}
              <motion.div
                className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl shadow-2xl border-4 border-black overflow-hidden"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 3, duration: 0.8 }}
                whileHover={{ scale: 1.02 }}
                onMouseEnter={textEnter}
                onMouseLeave={textLeave}
              >
                {!showAssessment ? (
                  <>
                    {/* Chat Header */}
                    <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 border-b-2 border-black">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-cyan-400 text-black rounded-full flex items-center justify-center font-black text-lg">
                            🤖
                          </div>
                          <div>
                            <div className="font-black text-sm">CAREER AI</div>
                            <div className="text-xs opacity-80">• Ready to help</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          <span className="text-xs font-mono">LIVE</span>
                        </div>
                      </div>
                    </div>

                    {/* Chat Messages Preview */}
                    <div className="p-4 h-96 overflow-y-auto space-y-3">
                      {/* Bot Message 1 */}
                      <motion.div
                        className="flex gap-3"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 3.5 }}
                      >
                        <div className="w-8 h-8 bg-cyan-400 text-black rounded-full flex items-center justify-center text-sm font-black flex-shrink-0">
                          🤖
                        </div>
                        <div className="bg-white border-2 border-black rounded-2xl px-4 py-3 max-w-[80%] relative">
                          <div className="absolute -left-2 top-3 w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-black border-b-8 border-b-transparent"></div>
                          <div className="text-sm font-black mb-1">👋 Hey! Let's find you a job that doesn't suck.</div>
                          <div className="text-xs font-mono opacity-70">First, what kind of work interests you?</div>
                        </div>
                      </motion.div>

                      {/* User Message 1 */}
                      <motion.div
                        className="flex gap-3 justify-end"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 4 }}
                      >
                        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-2 border-black rounded-2xl px-4 py-3 max-w-[80%] relative">
                          <div className="absolute -right-2 top-3 w-0 h-0 border-t-8 border-t-transparent border-l-8 border-l-blue-500 border-b-8 border-b-transparent"></div>
                          <div className="text-sm">Frontend Development, Full Stack, maybe some DevOps</div>
                        </div>
                        <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-sm font-black flex-shrink-0">
                          👤
                        </div>
                      </motion.div>

                      {/* Typing Indicator */}
                      <motion.div
                        className="flex gap-3"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 4.5, repeat: Infinity, repeatDelay: 2 }}
                      >
                        <div className="w-8 h-8 bg-cyan-400 text-black rounded-full flex items-center justify-center text-sm font-black flex-shrink-0">
                          🤖
                        </div>
                        <div className="bg-white border-2 border-black rounded-2xl px-4 py-3 relative">
                          <div className="absolute -left-2 top-3 w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-black border-b-8 border-b-transparent"></div>
                          <div className="flex space-x-1">
                            <motion.div
                              className="w-2 h-2 bg-black rounded-full"
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ repeat: Infinity, duration: 0.8 }}
                            />
                            <motion.div
                              className="w-2 h-2 bg-black rounded-full"
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }}
                            />
                            <motion.div
                              className="w-2 h-2 bg-black rounded-full"
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    </div>

                    {/* Chat Input Preview with CTA */}
                    <div className="p-4 border-t-2 border-black bg-white">
                      <motion.button
                        className="w-full bg-gradient-to-r from-cyan-400 to-purple-400 text-black px-6 py-4 text-lg font-black border-2 border-black shadow-2xl"
                        onClick={() => setShowAssessment(true)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onMouseEnter={textEnter}
                        onMouseLeave={textLeave}
                      >
                        <span className="flex items-center justify-center space-x-3">
                          <Zap className="w-5 h-5" />
                          <span>START CHATTING NOW</span>
                          <Rocket className="w-5 h-5" />
                        </span>
                      </motion.button>
                      <div className="text-center mt-3 text-xs font-mono text-gray-500">
                        Takes 10 minutes • No credit card required
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-[600px] relative">
                    {/* Back Button */}
                    <motion.button
                      className="absolute top-4 left-4 z-50 bg-cyan-400 text-black px-4 py-2 border-2 border-black font-mono text-sm hover:bg-white transition-colors"
                      onClick={() => setShowAssessment(false)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      ← BACK TO DEMO
                    </motion.button>
                    
                    <ChatbotContainer
                      userId="demo-user-123"
                      onAssessmentComplete={(answers) => {
                        console.log("Assessment completed:", answers);
                        // Handle completion - could show success message
                      }}
                    />
                  </div>
                )}
              </motion.div>

              {/* Trust Badges - Right */}
              <motion.div
                className="space-y-6"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 3.2, duration: 0.8 }}
              >
                <motion.div
                  className="bg-gradient-to-r from-cyan-400 to-purple-400 text-black p-6 border-4 border-black rotate-1"
                  whileHover={{ rotate: 0, scale: 1.05 }}
                  onMouseEnter={textEnter}
                  onMouseLeave={textLeave}
                >
                  <div className="text-2xl font-black mb-2">REAL RESULTS</div>
                  <div className="text-4xl font-black mb-2">89%</div>
                  <div className="text-sm font-mono">SUCCESS RATE</div>
                </motion.div>

                <div className="space-y-4">
                  <div className="flex flex-col space-y-3">
                    <motion.div
                      className="flex items-center space-x-3 bg-white border-2 border-black p-4"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 3.5 }}
                      whileHover={{ scale: 1.05 }}
                      onMouseEnter={textEnter}
                      onMouseLeave={textLeave}
                    >
                      <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-sm font-mono">• Gets you hired in 21 days</span>
                    </motion.div>

                    <motion.div
                      className="flex items-center space-x-3 bg-white border-2 border-black p-4"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 3.7 }}
                      whileHover={{ scale: 1.05 }}
                      onMouseEnter={textEnter}
                      onMouseLeave={textLeave}
                    >
                      <div className="w-4 h-4 bg-cyan-400 rounded-full animate-pulse"></div>
                      <span className="text-sm font-mono">• 2,847 companies hiring now</span>
                    </motion.div>

                    <motion.div
                      className="flex items-center space-x-3 bg-white border-2 border-black p-4"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 3.9 }}
                      whileHover={{ scale: 1.05 }}
                      onMouseEnter={textEnter}
                      onMouseLeave={textLeave}
                    >
                      <div className="w-4 h-4 bg-purple-400 rounded-full animate-pulse"></div>
                      <span className="text-sm font-mono">• No bullshit guarantee</span>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* The Chat Section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 2.2, duration: 0.8 }}
            className="max-w-4xl mx-auto"
          >
            {/* Trust Indicators */}
            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-8 mb-16"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 4.5 }}
            >
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-mono">✓ No More Rejections</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-mono">✓ Real Companies Only</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-mono">✓ Results In 21 Days</span>
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
