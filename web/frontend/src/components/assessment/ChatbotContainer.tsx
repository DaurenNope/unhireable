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
          question: "What kind of code bullshit are you into? Pick your poison.",
          required: true,
          options: [
            "Frontend (Making pixels dance)",
            "Backend (Database wizardry)", 
            "Full Stack (Gluten-free development)",
            "DevOps (Herding digital cats)",
            "Data Science (Excel on steroids)",
            "Mobile (Tiny screen nightmares)",
            "UI/UX (Making pretty rectangles)",
            "Product Management (Corporate babysitting)"
          ]
        },
        {
          id: "question_2",
          type: "single_choice",
          question: "How long have you been surviving in this industry?",
          required: true,
          options: [
            "Baby Dev (Just learned Git exists)",
            "Mid-tier Coder (Impostor syndrome expert)", 
            "Senior Dev (Forgets how to print('Hello World'))",
            "Lead (Meetings about meetings)"
          ]
        },
        {
          id: "question_3",
          type: "skill_selector",
          question: "Rate your bullshit tolerance... I mean, technical skills:",
          required: true,
          skills: ["JavaScript", "Python", "React", "Node.js", "TypeScript", "SQL"],
          proficiency_levels: ["WTF is this?", "I can Google it", "Actually useful", "Wizard level"]
        },
        {
          id: "question_4",
          type: "slider",
          question: "How many hours per day can you sacrifice to escape unemployment?",
          required: true,
          min: 1,
          max: 10,
          default: 5
        },
        {
          id: "question_5",
          type: "text_input",
          question: "What's your master plan for world domination... I mean, career goals?",
          required: false,
          placeholder: "Don't worry, we won't judge your absurd ambitions..."
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
          content: "🤖 ALRIGHT LISTEN UP. Let's find you a job that doesn't completely suck. No corporate bullshit, I promise.",
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
    
    try {
      // Use intelligent API endpoint
      const response = await fetch('/api/assessments/intelligent-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          question_id: questionId,
          answer: answer
        })
      });
      
      const result = await response.json();
      
      // Process intelligent response
      setTimeout(() => {
        const messagesToAdd: Array<{
          id: string;
          type: "user" | "bot";
          content: string | AssessmentQuestion;
          timestamp: Date;
        }> = [];
        
        // Add skill insights if available
        if (result.skill_insights && result.skill_insights.length > 0) {
          result.skill_insights.forEach((insight: string, index: number) => {
            setTimeout(() => {
              setMessages(prev => [...prev, {
                id: (Date.now() + index).toString(),
                type: "bot" as const,
                content: `💡 ${insight}`,
                timestamp: new Date()
              }]);
            }, index * 500);
          });
        }
        
        // Add trajectory analysis if available
        if (result.trajectory_analysis) {
          const analysis = result.trajectory_analysis;
          const trajectoryMessage = `📊 CAREER TRAJECTORY ANALYSIS: ${analysis.trajectory_score}/100\n\n${analysis.insights.join('\n\n')}`;
          
          setTimeout(() => {
            setMessages(prev => [...prev, {
              id: (Date.now() + 100).toString(),
              type: "bot" as const,
              content: trajectoryMessage,
              timestamp: new Date()
            }]);
          }, 1500);
        }
        
        // Handle follow-up questions
        if (result.followup_question) {
          setTimeout(() => {
            setMessages(prev => [...prev, {
              id: (Date.now() + 200).toString(),
              type: "bot" as const,
              content: result.followup_question,
              timestamp: new Date()
            }]);
            setIsTyping(false);
          }, 2000);
          return;
        }
        
        // Handle standard next question
        if (result.next_standard_question) {
          // Add contextual message based on question progression
          let contextMessage = "";
          const nextQuestion = result.next_standard_question;
          
          if (nextQuestion.id === "experience_level") {
            contextMessage = "Interesting choices! Now let's talk about your battle scars... I mean, experience.";
          } else if (nextQuestion.id === "technical_skills") {
            contextMessage = "Time for the moment of truth - show me your tech stack!";
          } else if (nextQuestion.id === "soft_skills") {
            contextMessage = "Tech skills are great, but can you talk to humans without starting a flame war?";
          } else if (nextQuestion.id === "time_availability") {
            contextMessage = "How much of your life are you willing to sacrifice for career glory?";
          } else if (nextQuestion.id === "learning_preferences") {
            contextMessage = "Everyone learns differently. What's your style?";
          } else if (nextQuestion.id === "career_goals") {
            contextMessage = "Tell me your master plan for world domination... or at least a promotion.";
          } else if (nextQuestion.id === "location_preferences") {
            contextMessage = "Final question - where do you want to sell your soul to capitalism?";
          }
          
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
            content: result.next_standard_question,
            timestamp: new Date()
          });
          
          setCurrentQuestionIndex(prev => prev + 1);
          setMessages(prev => [...prev, ...messagesToAdd]);
        }
        
        // Handle assessment completion
        if (result.assessment_complete) {
          setTimeout(async () => {
            await completeAssessment();
          }, 1000);
          return;
        }
        
        setIsTyping(false);
      }, 1500);
      
    } catch (error) {
      console.error('Failed to save intelligent answer:', error);
      // Fallback to original logic
      setTimeout(async () => {
        const nextIndex = currentQuestionIndex + 1;
        
        if (nextIndex >= questions.length) {
          await completeAssessment();
        } else {
          setCurrentQuestionIndex(nextIndex);
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            type: "bot" as const,
            content: questions[nextIndex],
            timestamp: new Date()
          }]);
        }
        
        setIsTyping(false);
      }, 1000);
    }
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
        content: "💀 WELL LOOK AT YOU. Assessment complete. I've survived your responses and now I'm supposed to find you a job that pays actual money. Let's do this before you lose all hope.",
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
    <div className="w-full max-w-4xl mx-auto h-[700px] flex flex-col shadow-2xl border-4 border-black bg-white">
      {/* Header */}
      <div className="bg-black text-cyan-400 p-4 border-b-4 border-cyan-400">
        <div className="flex items-center justify-between">
          <div className="font-black text-xl flex items-center gap-2">
            <div className="w-8 h-8 bg-cyan-400 text-black rounded-full flex items-center justify-center font-black text-lg">
              🤖
            </div>
            CAREER TORTURE CHAMBER
          </div>
          {!isComplete && currentQuestionIndex > 0 && (
            <button
              onClick={goToPreviousQuestion}
              className="bg-cyan-400 text-black px-4 py-2 font-black border-2 border-black hover:bg-white transition-colors"
            >
              ← BACK
            </button>
          )}
        </div>
        
        <div className="mt-3 bg-black/20 p-2 border-2 border-cyan-400">
          <div className="flex justify-between font-mono text-sm">
            <span>TORTURE SESSION {currentQuestionIndex + 1}/{questions.length}</span>
            <span>{Math.round(progress)}% DONE WITH THIS BULLSHIT</span>
          </div>
          <div className="w-full bg-black/40 h-2 mt-2 border border-cyan-400">
            <div 
              className="h-full bg-cyan-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Chat Messages */}
      <div className="flex-1 overflow-hidden flex flex-col p-0">
        <div className="flex-1 overflow-y-auto space-y-4 p-6 bg-gray-50">
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
            className="border-t-4 border-black bg-white p-6"
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
            className="border-t-4 border-black bg-white p-6"
          >
            <div className="text-center space-y-4">
              <div className="text-6xl">💀</div>
              <h3 className="text-3xl font-black text-black">SURVIVED THE TORTURE!</h3>
              <p className="font-mono text-gray-600 text-lg">
                Your career profile is ready. Let's find you a job that actually pays.
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => window.location.href = '/jobs'}
                  className="bg-cyan-400 text-black px-6 py-3 font-black border-2 border-black hover:bg-white transition-colors"
                >
                  SHOW ME THE MONEY
                </button>
                <button
                  onClick={restartAssessment}
                  className="bg-black text-cyan-400 px-6 py-3 font-black border-2 border-cyan-400 hover:bg-cyan-400 hover:text-black transition-colors"
                >
                  DO THIS AGAIN
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
