"use client";

import { ResumeBuilder } from "@/components/resume/ResumeBuilder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ResumePage() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Resume Builder</CardTitle>
            <p className="text-muted-foreground mt-2">
              Create your professional resume with our easy-to-use builder
            </p>
          </CardHeader>
          <CardContent className="text-center">
            <div className="w-16 h-16 mx-auto bg-primary rounded-full flex items-center justify-center text-primary-foreground text-2xl mb-4">
              📄
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Fill in your information below and generate a downloadable resume
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => window.location.href = "/demo"}>
                Back to Demo
              </Button>
              <Button onClick={() => window.location.href = "/"}>
                Home
              </Button>
            </div>
          </CardContent>
        </Card>

        <ResumeBuilder />
      </div>
    </div>
  );
}
