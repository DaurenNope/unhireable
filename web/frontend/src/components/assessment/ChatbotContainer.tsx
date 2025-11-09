"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MessageBubble } from "./MessageBubble";
import { QuestionRenderer } from "./QuestionRenderer";
import { TypingIndicator } from "./TypingIndicator";
import { AssessmentQuestion, AssessmentAnswer } from "@/types/assessment";
import { ArrowLeft, RotateCcw, Sparkles } from "lucide-react";

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
  const [isComplete, setIsComplete] = useState(false);

  // Load assessment questions on mount
  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      setIsLoading(true);
      
      // Mock questions for now - in real app, this would come from API
      const mockQuestions: AssessmentQuestion[] = [
        {
          id: "question_1",
          type: "multi_select",
          question: "What career areas interest you the most?",
          required: true,
          options: [
            "Frontend Development",
            "Backend Development", 
            "Full Stack Development",
            "DevOps",
            "Data Science",
            "Mobile Development",
            "UI/UX Design",
            "Product Management"
          ]
        },
        {
          id: "question_2",
          type: "single_choice",
          question: "What's your current experience level?",
          required: true,
          options: [
            "Entry Level (0-2 years)",
            "Mid Level (2-5 years)", 
            "Senior Level (5+ years)",
            "Lead/Manager"
          ]
        },
        {
          id: "question_3",
          type: "skill_selector",
          question: "Rate your technical skills",
          required: true,
          skills: ["JavaScript", "Python", "React", "Node.js", "TypeScript", "SQL"],
          proficiency_levels: ["Beginner", "Intermediate", "Advanced", "Expert"]
        },
        {
          id: "question_4",
          type: "slider",
          question: "How many hours per day can you dedicate to learning?",
          required: true,
          min: 1,
          max: 10,
          default: 5
        },
        {
          id: "question_5",
          type: "text_input",
          question: "What are your career goals for the next 2 years?",
          required: false,
          placeholder: "Describe your career aspirations..."
        }
      ];
      
      setQuestions(mockQuestions);
      
      // Start assessment
      await startAssessment();
      
      // Show first question
      setIsTyping(true);
      setTimeout(() => {
        setMessages([{
          id: "1",
          type: "bot",
          content: "👋 Welcome to your career assessment! I'm here to help you discover the perfect career path based on your skills and goals.",
          timestamp: new Date()
        }, {
          id: "2", 
          type: "bot",
          content: mockQuestions[0],
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
      // Mock API call
      console.log('Starting assessment for user:', userId);
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
    
    // Save answer to backend (mock)
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
        
        // Add context message between questions
        let contextMessage = "";
        if (nextIndex === 1) {
          contextMessage = "Great! Let's assess your experience level.";
        } else if (nextIndex === 2) {
          contextMessage = "Now let's evaluate your technical skills.";
        } else if (nextIndex === 3) {
          contextMessage = "Perfect! Let's talk about your learning capacity.";
        } else if (nextIndex === 4) {
          contextMessage = "Finally, let's discuss your career aspirations.";
        }
        
        const messagesToAdd: Array<{
          id: string;
          type: "user" | "bot";
          content: string | AssessmentQuestion;
          timestamp: Date;
        }> = [];
        if (contextMessage) {
          messagesToAdd.push({
            id: Date.now().toString(),
            type: "bot" as const,
            content: contextMessage,
            timestamp: new Date()
          });
        }
        
        messagesToAdd.push({
          id: (Date.now() + 1).toString(),
          type: "bot" as const,
          content: questions[nextIndex],
          timestamp: new Date()
        });
        
        setMessages(prev => [...prev, ...messagesToAdd]);
      }
      
      setIsTyping(false);
    }, 1000);
  };

  const saveAnswer = async (questionId: string, answer: AssessmentAnswer) => {
    try {
      // Mock API call
      console.log('Saving answer:', questionId, answer);
    } catch (error) {
      console.error('Failed to save answer:', error);
    }
  };

  const completeAssessment = async () => {
    try {
      // Mock API call
      console.log('Completing assessment with answers:', answers);
      
      // Show completion message
      const completionMessage = {
        id: Date.now().toString(),
        type: "bot" as const,
        content: "🎉 Congratulations! Your assessment is complete. I've analyzed your responses and I'm ready to help you with job matching, resume generation, and personalized learning paths.",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, completionMessage]);
      setIsComplete(true);
      onAssessmentComplete(answers);
    } catch (error) {
      console.error('Failed to complete assessment:', error);
    }
  };

  const formatAnswerDisplay = (answer: AssessmentAnswer, question: AssessmentQuestion): string => {
    switch (question.type) {
      case "multi_select":
        return Array.isArray(answer) ? `Selected: ${answer.join(", ")}` : String(answer);
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
          return skills.length > 0 ? `Skills: ${skills.join(", ")}` : "No skills selected";
        }
        return String(answer);
      default:
        return String(answer);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      // Remove the last bot question and user answer
      setMessages(prev => prev.slice(0, -2));
    }
  };

  const restartAssessment = () => {
    setMessages([]);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setIsComplete(false);
    loadQuestions();
  };

  const progress = ((currentQuestionIndex) / questions.length) * 100;

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto h-[600px] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto h-[700px] flex flex-col shadow-2xl border-0 bg-gradient-to-br from-gray-50 to-gray-100">
      <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6" />
            Career Assessment
          </CardTitle>
          {!isComplete && currentQuestionIndex > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPreviousQuestion}
              className="text-white hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
          )}
        </div>
        
        <div className="space-y-2">
          <Progress value={progress} className="w-full bg-white/20" />
          <div className="flex justify-between text-sm">
            <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
        <div className="flex-1 overflow-y-auto space-y-4 p-6">
          <AnimatePresence>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </AnimatePresence>
          
          <AnimatePresence>
            {isTyping && <TypingIndicator />}
          </AnimatePresence>
        </div>
        
        {!isComplete && currentQuestionIndex < questions.length && !isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="border-t bg-white p-6"
          >
            <QuestionRenderer
              question={questions[currentQuestionIndex]}
              onAnswer={(answer: AssessmentAnswer) => handleAnswer(questions[currentQuestionIndex].id, answer)}
            />
          </motion.div>
        )}
        
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="border-t bg-white p-6"
          >
            <div className="text-center space-y-4">
              <div className="text-6xl">🎯</div>
              <h3 className="text-2xl font-bold text-gray-800">Assessment Complete!</h3>
              <p className="text-gray-600">
                Your career profile is now ready. Let's find your perfect job match!
              </p>
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={() => window.location.href = '/jobs'}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  View Job Matches
                </Button>
                <Button
                  variant="outline"
                  onClick={restartAssessment}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retake Assessment
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
