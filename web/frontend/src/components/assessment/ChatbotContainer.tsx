"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MessageBubble } from "./MessageBubble";
import { QuestionRenderer } from "./QuestionRenderer";
import { TypingIndicator } from "./TypingIndicator";
import { AssessmentQuestion, AssessmentAnswer } from "@/types/assessment";

interface ChatbotContainerProps {
  userId: string;
  onAssessmentComplete: (answers: Record<string, any>) => void;
}

export function ChatbotContainer({ userId, onAssessmentComplete }: ChatbotContainerProps) {
  const [messages, setMessages] = useState<Array<{
    id: string;
    type: "user" | "bot";
    content: string | AssessmentQuestion;
    timestamp: Date;
  }>>([]);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, AssessmentAnswer>>({});
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load assessment questions on mount
  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/assessments/questions');
      const data = await response.json();
      setQuestions(data.questions);
      
      // Start assessment
      await startAssessment();
      
      // Show first question
      setIsTyping(true);
      setTimeout(() => {
        setMessages([{
          id: "1",
          type: "bot",
          content: data.questions[0],
          timestamp: new Date()
        }]);
        setIsTyping(false);
      }, 1500);
    } catch (error) {
      console.error('Failed to load questions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startAssessment = async () => {
    try {
      const response = await fetch('/api/assessments/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to start assessment:', error);
    }
  };

  const handleAnswer = async (questionId: string, answer: AssessmentAnswer) => {
    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      type: "user" as const,
      content: formatAnswerDisplay(answer, questions[currentQuestionIndex]),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    
    // Show typing indicator
    setIsTyping(true);
    
    // Save answer to backend
    await saveAnswer(questionId, answer);
    
    // Move to next question or complete
    setTimeout(async () => {
      const nextIndex = currentQuestionIndex + 1;
      
      if (nextIndex >= questions.length) {
        // Complete assessment
        await completeAssessment();
      } else {
        // Show next question
        setCurrentQuestionIndex(nextIndex);
        const botMessage = {
          id: Date.now().toString(),
          type: "bot" as const,
          content: questions[nextIndex],
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);
      }
      
      setIsTyping(false);
    }, 1000);
  };

  const saveAnswer = async (questionId: string, answer: AssessmentAnswer) => {
    try {
      await fetch('/api/assessments/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          question_id: questionId,
          answer
        })
      });
    } catch (error) {
      console.error('Failed to save answer:', error);
    }
  };

  const completeAssessment = async () => {
    try {
      const response = await fetch('/api/assessments/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          all_answers: answers
        })
      });
      
      const data = await response.json();
      
      // Show completion message
      const completionMessage = {
        id: Date.now().toString(),
        type: "bot" as const,
        content: "🎉 Congratulations! Your assessment is complete. I've analyzed your responses and I'm ready to help you with job matching, resume generation, and personalized learning paths.",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, completionMessage]);
      onAssessmentComplete(answers);
    } catch (error) {
      console.error('Failed to complete assessment:', error);
    }
  };

  const formatAnswerDisplay = (answer: AssessmentAnswer, question: AssessmentQuestion): string => {
    switch (question.type) {
      case "multi_select":
        return Array.isArray(answer) ? answer.join(", ") : String(answer);
      case "single_choice":
        return String(answer);
      case "text_input":
        return String(answer);
      case "slider":
        return `${answer} hours per day`;
      case "skill_selector":
        if (typeof answer === 'object' && answer !== null) {
          const skills = Object.entries(answer)
            .filter(([_, proficiency]) => proficiency !== 'None')
            .map(([skill, proficiency]) => `${skill} (${proficiency})`);
          return skills.join(", ");
        }
        return String(answer);
      default:
        return String(answer);
    }
  };

  const progress = ((currentQuestionIndex) / questions.length) * 100;

  if (isLoading) {
    return (
      <Card className="w-full max-w-2xl mx-auto h-[600px] flex items-center justify-center">
        <CardContent>Loading assessment...</CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle className="text-center">Career Assessment</CardTitle>
        <Progress value={progress} className="w-full" />
        <p className="text-sm text-muted-foreground text-center">
          Question {currentQuestionIndex + 1} of {questions.length}
        </p>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-4 p-4">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          
          {isTyping && <TypingIndicator />}
        </div>
        
        {currentQuestionIndex < questions.length && !isTyping && (
          <div className="border-t p-4">
            <QuestionRenderer
              question={questions[currentQuestionIndex]}
              onAnswer={(answer) => handleAnswer(questions[currentQuestionIndex].id, answer)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
