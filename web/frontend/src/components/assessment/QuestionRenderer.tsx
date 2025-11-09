"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AssessmentQuestion, AssessmentAnswer } from "@/types/assessment";

interface QuestionRendererProps {
  question: AssessmentQuestion;
  onAnswer: (answer: AssessmentAnswer) => void;
}

export function QuestionRenderer({ question, onAnswer }: QuestionRendererProps) {
  const [answer, setAnswer] = useState<AssessmentAnswer>(
    question.type === "slider" ? question.default || 5 : 
    question.type === "multi_select" ? [] : 
    question.type === "skill_selector" ? {} : ""
  );

  const handleSubmit = () => {
    if (question.required && (!answer || (Array.isArray(answer) && answer.length === 0))) {
      return;
    }
    onAnswer(answer);
  };

  const renderQuestionInput = () => {
    switch (question.type) {
      case "multi_select":
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {question.options?.map((option, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                className={cn(
                  "flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200",
                  Array.isArray(answer) && answer.includes(option)
                    ? "bg-blue-50 border-blue-500 shadow-md"
                    : "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                )}
                onClick={() => {
                  const currentAnswer = Array.isArray(answer) ? answer : [];
                  if (currentAnswer.includes(option)) {
                    setAnswer(currentAnswer.filter(item => item !== option));
                  } else {
                    setAnswer([...currentAnswer, option]);
                  }
                }}
              >
                <Checkbox
                  id={`option-${index}`}
                  checked={Array.isArray(answer) && answer.includes(option)}
                  className="pointer-events-none"
                />
                <div className="flex-1">
                  <Label htmlFor={`option-${index}`} className="text-sm font-medium cursor-pointer">
                    {option}
                  </Label>
                </div>
                {Array.isArray(answer) && answer.includes(option) && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs"
                  >
                    ✓
                  </motion.div>
                )}
              </motion.div>
            ))}
          </motion.div>
        );

      case "single_choice":
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Select value={answer as string} onValueChange={setAnswer}>
              <SelectTrigger className="bg-white border-2 border-gray-300 hover:border-blue-500 transition-colors">
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {question.options?.map((option, index) => (
                  <SelectItem key={index} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>
        );

      case "skill_selector":
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {question.skills?.map((skill, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                className="space-y-2"
              >
                <Label htmlFor={`skill-${index}`} className="text-sm font-medium flex items-center space-x-2">
                  <span>{skill}</span>
                  {(answer as Record<string, string>)[skill] && (answer as Record<string, string>)[skill] !== "None" && (
                    <Badge variant="secondary" className="text-xs">
                      {(answer as Record<string, string>)[skill]}
                    </Badge>
                  )}
                </Label>
                <Select
                  value={(answer as Record<string, string>)[skill] || "None"}
                  onValueChange={(value) => {
                    setAnswer({
                      ...(answer as Record<string, string>),
                      [skill]: value
                    });
                  }}
                >
                  <SelectTrigger className="bg-white border-2 border-gray-300 hover:border-blue-500 transition-colors">
                    <SelectValue placeholder="Select proficiency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">Not Selected</SelectItem>
                    {question.proficiency_levels?.map((level, levelIndex) => (
                      <SelectItem key={levelIndex} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>
            ))}
          </motion.div>
        );

      case "text_input":
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Textarea
              value={answer as string}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={question.placeholder || "Enter your answer..."}
              className="min-h-[120px] border-2 border-gray-300 focus:border-blue-500 transition-colors resize-none"
              rows={4}
            />
            <div className="text-xs text-gray-500 mt-1">
              {(answer as string)?.length || 0} characters
            </div>
          </motion.div>
        );

      case "slider":
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 font-medium">{question.min || 1} hour</span>
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="bg-blue-500 text-white px-4 py-2 rounded-full font-bold text-lg"
              >
                {String(answer)}h/day
              </motion.div>
              <span className="text-sm text-gray-600 font-medium">{question.max || 10} hours</span>
            </div>
            <Slider
              value={[answer as number]}
              onValueChange={(value) => setAnswer(value[0])}
              min={question.min || 1}
              max={question.max || 10}
              step={1}
              className="w-full h-3"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Minimal</span>
              <span>Moderate</span>
              <span>Intensive</span>
            </div>
          </motion.div>
        );

      default:
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Input
              value={answer as string}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Enter your answer..."
              className="border-2 border-gray-300 focus:border-blue-500 transition-colors"
            />
          </motion.div>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {renderQuestionInput()}
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        <Button 
          onClick={handleSubmit}
          disabled={question.required && (!answer || (Array.isArray(answer) && answer.length === 0))}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {question.type === "slider" ? "Continue" : 
           question.type === "text_input" ? "Submit Answer" :
           question.type === "skill_selector" ? "Continue" :
           question.type === "single_choice" ? "Continue" : "Next"}
        </Button>
        
        {question.required && (!answer || (Array.isArray(answer) && answer.length === 0)) && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-red-500 text-center mt-2"
          >
            This question is required. Please provide an answer.
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );
}
