"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { AssessmentQuestion } from "@/types/assessment";

interface MessageBubbleProps {
  message: {
    id: string;
    type: "user" | "bot";
    content: string | AssessmentQuestion;
    timestamp: Date;
  };
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.type === "user";
  const isQuestion = typeof message.content === "object" && "question" in message.content;
  
  // Check if this is an insight message
  const isInsight = typeof message.content === "string" && 
    (message.content.includes("💡") || message.content.includes("📊"));
  
  // Check if this is a trajectory analysis
  const isTrajectory = typeof message.content === "string" && 
    message.content.includes("CAREER TRAJECTORY ANALYSIS");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "flex gap-3 max-w-[85%] mb-4",
        isUser ? "ml-auto flex-row-reverse" : "mr-auto"
      )}
    >
      {/* Avatar */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-lg flex-shrink-0",
          isUser 
            ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white border-2 border-white" 
            : "bg-gradient-to-br from-cyan-400 to-blue-500 text-black border-2 border-black"
        )}
      >
        {isUser ? "👤" : "🤖"}
      </motion.div>
      
      {/* Message Content */}
      <motion.div
        initial={{ opacity: 0, x: isUser ? 20 : -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className={cn(
          "rounded-2xl px-4 py-3 max-w-full relative group",
          isUser
            ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg"
            : isInsight
            ? "bg-gradient-to-br from-yellow-100 to-amber-100 text-black border-2 border-yellow-400 shadow-lg"
            : isTrajectory
            ? "bg-gradient-to-br from-green-100 to-emerald-100 text-black border-2 border-green-500 shadow-lg"
            : "bg-white text-black border-2 border-black shadow-lg"
        )}
      >
        {/* Tail indicator */}
        <div className={cn(
          "absolute top-3 w-0 h-0",
          isUser 
            ? "-right-2 border-l-8 border-l-blue-500 border-t-8 border-t-transparent border-b-8 border-b-transparent"
            : "-left-2 border-r-8 border-r-black border-t-8 border-t-transparent border-b-8 border-b-transparent"
        )} />
        
        {isQuestion ? (
          <div className="space-y-3">
            <div className="flex items-start space-x-2">
              <span className="text-xs bg-black text-white px-2 py-1 rounded font-mono">Q{getQuestionNumber(message.content as AssessmentQuestion)}</span>
              <p className="font-semibold text-sm leading-relaxed">
                {(message.content as AssessmentQuestion).question}
              </p>
            </div>
            {(message.content as AssessmentQuestion).required && (
              <div className="flex items-center space-x-1">
                <span className="text-xs bg-red-500 text-white px-2 py-1 rounded animate-pulse">REQUIRED</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {message.content as string}
            </p>
          </div>
        )}
        
        {/* Timestamp */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 0.5, duration: 0.3 }}
          className="text-xs mt-2 font-mono"
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          })}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// Helper function to extract question number
function getQuestionNumber(question: AssessmentQuestion): string {
  const match = question.id.match(/question_(\d+)/);
  return match ? match[1] : "1";
}
