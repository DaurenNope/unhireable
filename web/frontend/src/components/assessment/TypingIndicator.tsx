"use client";

import { motion } from "framer-motion";

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex gap-3 items-center"
    >
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-black border-2 border-black flex items-center justify-center text-lg font-bold shadow-lg flex-shrink-0">
        🤖
      </div>
      
      <div className="bg-white border-2 border-black rounded-2xl px-4 py-3 shadow-lg relative">
        {/* Tail indicator */}
        <div className="-left-2 top-3 absolute w-0 h-0 border-r-8 border-r-black border-t-8 border-t-transparent border-b-8 border-b-transparent" />
        
        <div className="flex items-center space-x-1">
          <motion.div
            className="w-2 h-2 bg-gray-400 rounded-full"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0 }}
          />
          <motion.div
            className="w-2 h-2 bg-gray-400 rounded-full"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
          />
          <motion.div
            className="w-2 h-2 bg-gray-400 rounded-full"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
          />
        </div>
      </div>
    </motion.div>
  );
}
