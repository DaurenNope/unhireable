"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
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
          <div className="space-y-3">
            {question.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Checkbox
                  id={`option-${index}`}
                  checked={Array.isArray(answer) && answer.includes(option)}
                  onCheckedChange={(checked) => {
                    const currentAnswer = Array.isArray(answer) ? answer : [];
                    if (checked) {
                      setAnswer([...currentAnswer, option]);
                    } else {
                      setAnswer(currentAnswer.filter(item => item !== option));
                    }
                  }}
                />
                <Label htmlFor={`option-${index}`} className="text-sm">
                  {option}
                </Label>
              </div>
            ))}
          </div>
        );

      case "single_choice":
        return (
          <Select value={answer as string} onValueChange={setAnswer}>
            <SelectTrigger>
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
        );

      case "skill_selector":
        return (
          <div className="space-y-4">
            {question.skills?.map((skill, index) => (
              <div key={index} className="space-y-2">
                <Label htmlFor={`skill-${index}`} className="text-sm font-medium">
                  {skill}
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
                  <SelectTrigger>
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
              </div>
            ))}
          </div>
        );

      case "text_input":
        return (
          <Textarea
            value={answer as string}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={question.placeholder || "Enter your answer..."}
            className="min-h-[100px]"
            rows={4}
          />
        );

      case "slider":
        return (
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{question.min || 1} hour</span>
              <span className="font-medium text-foreground">{String(answer)} hours per day</span>
  +++++++ REPLACE
              <span>{question.max || 10} hours</span>
            </div>
            <Slider
              value={[answer as number]}
              onValueChange={(value) => setAnswer(value[0])}
              min={question.min || 1}
              max={question.max || 10}
              step={1}
              className="w-full"
            />
          </div>
        );

      default:
        return (
          <Input
            value={answer as string}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Enter your answer..."
          />
        );
    }
  };

  return (
    <div className="space-y-4">
      {renderQuestionInput()}
      
      <Button 
        onClick={handleSubmit}
        disabled={question.required && (!answer || (Array.isArray(answer) && answer.length === 0))}
        className="w-full"
      >
        {question.type === "slider" ? "Continue" : 
         question.type === "text_input" ? "Submit" :
         question.type === "skill_selector" ? "Continue" :
         question.type === "single_choice" ? "Continue" : "Next"}
      </Button>
    </div>
  );
}
