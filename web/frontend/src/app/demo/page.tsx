"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChatbotContainer } from "@/components/assessment/ChatbotContainer";

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">JobEz Assessment Platform Demo</CardTitle>
            <p className="text-muted-foreground mt-2">
              Welcome to the career assessment platform
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="p-6 border rounded-lg">
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="text-lg font-semibold mb-2">Smart Assessment</h3>
                <p className="text-muted-foreground">8-question interactive chatbot to discover your career path</p>
              </div>
              <div className="p-6 border rounded-lg">
                <div className="text-4xl mb-4">💼</div>
                <h3 className="text-lg font-semibold mb-2">Job Matching</h3>
                <p className="text-muted-foreground">AI-powered job recommendations based on your skills</p>
              </div>
              <div className="p-6 border rounded-lg">
                <div className="text-4xl mb-4">📄</div>
                <h3 className="text-lg font-semibold mb-2">Resume Builder</h3>
                <p className="text-muted-foreground">Generate professional resumes automatically</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={() => alert('Assessment demo in chatbot below')}>
                Try Assessment Demo
              </Button>
              <Button onClick={() => window.location.href = "/resume"}>
                Build Resume
              </Button>
              <Button variant="outline" onClick={() => window.location.href = "/"}>
                Back to Home
              </Button>
            </div>
  +++++++ REPLACE
  +++++++ REPLACE
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assessment Preview</CardTitle>
            <p className="text-muted-foreground">
              See how the assessment chatbot works (demo mode)
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[600px]">
              <ChatbotContainer 
                userId="demo_user" 
                onAssessmentComplete={(answers) => {
                  console.log("Assessment completed:", answers);
                  alert("Assessment completed! Check console for answers.");
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
