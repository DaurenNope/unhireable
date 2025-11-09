"use client";

import { ResumeBuilder } from "@/components/resume/ResumeBuilder";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Sparkles, Zap } from "lucide-react";

export default function ResumePage() {
  return (
    <div className="min-h-screen bg-white text-black">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="bg-black text-cyan-400 p-6 border-b-4 border-cyan-400"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.href = "/demo"}
              className="bg-cyan-400 text-black px-4 py-2 font-black border-2 border-black hover:bg-white transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              BACK TO DEMO
            </button>
            <div className="font-black text-xl flex items-center gap-2">
              <div className="w-8 h-8 bg-cyan-400 text-black rounded-full flex items-center justify-center font-black text-lg">
                📄
              </div>
              RESUME TORTURE CHAMBER
            </div>
          </div>
          <div className="font-mono text-sm">
            // Build something that doesn't suck
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-center mb-8"
        >
          <div className="text-4xl md:text-5xl font-black leading-none mb-4">
            <span className="bg-black text-white px-4">MAKE YOURSELF</span>
            <br />
            <span className="bg-cyan-400 text-black px-4 mt-2 inline-block">ACTUALLY HIREABLE</span>
          </div>
          <p className="text-lg font-mono text-gray-600 max-w-3xl mx-auto">
            Stop lying about your "strong attention to detail" and "passion for synergy." 
            Let's build a resume that gets you paid instead of rejected.
          </p>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          <div className="bg-black text-white p-6 rotate-1 border-4 border-cyan-400">
            <div className="text-xl font-black mb-3 flex items-center">
              <span className="mr-2">{"\u003c/\u003e"}</span>
              <span className="text-cyan-400">NO BULLSHIT</span>
            </div>
            <div className="text-3xl font-black mb-2">TEMPLATES</div>
            <div className="text-sm font-mono">Actually professional designs</div>
          </div>

          <div className="bg-cyan-400 text-black p-6 -rotate-2 border-4 border-black">
            <div className="text-xl font-black mb-3 flex items-center">
              <span className="mr-2">{"{...}"}</span>
              <span className="text-black">INSTANT</span>
            </div>
            <div className="text-3xl font-black mb-2">EXPORT</div>
            <div className="text-sm font-mono">PDF & DOCX like magic</div>
          </div>

          <div className="bg-purple-400 text-black p-6 rotate-1 border-4 border-black">
            <div className="text-xl font-black mb-3 flex items-center">
              <span className="mr-2">{"[!]"}</span>
              <span className="text-black">SYNC</span>
            </div>
            <div className="text-3xl font-black mb-2">DESKTOP</div>
            <div className="text-sm font-mono">Works with our app</div>
          </div>
        </motion.div>

        {/* Resume Builder */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="border-4 border-black bg-white"
        >
          <div className="bg-gradient-to-r from-cyan-400 to-purple-400 text-black p-4 border-b-4 border-black">
            <div className="flex items-center justify-between">
              <div className="font-black text-xl flex items-center gap-2">
                <Sparkles className="w-6 h-6" />
                RESUME BUILDER
              </div>
              <div className="flex items-center gap-2 font-mono text-sm">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span>AUTO-SAVING</span>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <ResumeBuilder />
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="flex justify-center mt-8"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => document.getElementById('generate-resume')?.click()}
              className="bg-black text-cyan-400 px-8 py-4 font-black text-lg border-4 border-cyan-400 hover:bg-cyan-400 hover:text-black transition-all transform hover:scale-105 flex items-center gap-3"
            >
              <Download className="w-5 h-5" />
              DOWNLOAD RESUME
            </button>
            <button
              onClick={() => window.location.href = "/demo"}
              className="bg-cyan-400 text-black px-8 py-4 font-black text-lg border-4 border-black hover:bg-white transition-all transform hover:scale-105 flex items-center gap-3"
            >
              <Zap className="w-5 h-5" />
              START OVER
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
