"use client";

import { cn } from "@/lib/utils";
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

  return (
    <div
      className={cn(
        "flex gap-3 max-w-[80%] animate-in slide-in-from-bottom-2 duration-200",
        isUser ? "ml-auto" : "mr-auto"
      )}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
          🤖
        </div>
      )}
      
      <div
        className={cn(
          "rounded-2xl px-4 py-3 max-w-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isQuestion ? (
          <div className="space-y-2">
            <p className="font-medium">
              {(message.content as AssessmentQuestion).question}
            </p>
            {(message.content as AssessmentQuestion).required && (
              <p className="text-sm opacity-75">* Required</p>
            )}
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">
            {message.content as string}
          </p>
        )}
        
        <div className="text-xs opacity-50 mt-1">
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          })}
        </div>
      </div>
      
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-sm font-semibold">
          👤
        </div>
      )}
    </div>
  );
}
