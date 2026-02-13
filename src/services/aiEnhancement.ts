import { log } from '../utils/logger.js';

export interface AIEnhancementOptions {
  provider: 'openai' | 'claude' | 'local';
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIGeneratedContent {
  content: string;
  confidence: number;
  reasoning: string;
  tokensUsed?: number;
}

export interface JobMatchInsight {
  score: number;
  reasoning: string;
  keyMatches: string[];
  gaps: string[];
  recommendation: 'apply' | 'consider' | 'skip';
}

export interface EmailPersonalization {
  subject: string;
  body: string;
  personalizationNotes: string[];
  tone: 'formal' | 'casual' | 'enthusiastic' | 'professional';
}

/**
 * AI Enhancement Service for content generation and decision making
 */
export class AIEnhancementService {
  private options: AIEnhancementOptions;
  private apiKey: string;

  constructor(options: AIEnhancementOptions) {
    this.options = options;
    this.apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '';
    
    if (!this.apiKey && options.provider !== 'local') {
      throw new Error(`API key required for ${options.provider} provider`);
    }
  }

  /**
   * Generate personalized cover letter
   */
  async generateCoverLetter(
    jobDescription: string,
    userProfile: any,
    companyInfo?: string
  ): Promise<AIGeneratedContent> {
    const prompt = this.buildCoverLetterPrompt(jobDescription, userProfile, companyInfo);
    
    try {
      const result = await this.generateContent(prompt, {
        temperature: 0.7,
        maxTokens: 800,
      });

      log.info('✅ Generated personalized cover letter');
      return result;
    } catch (error) {
      log.error('❌ Failed to generate cover letter:', error);
      throw error;
    }
  }

  /**
   * Analyze job match and provide insights
   */
  async analyzeJobMatch(
    jobDescription: string,
    userProfile: any,
    jobRequirements?: string[]
  ): Promise<JobMatchInsight> {
    const prompt = this.buildJobMatchPrompt(jobDescription, userProfile, jobRequirements);
    
    try {
      const result = await this.generateContent(prompt, {
        temperature: 0.3,
        maxTokens: 500,
      });

      // Parse the structured response
      const insight = this.parseJobMatchResponse(result.content);
      
      log.info(`✅ Analyzed job match: ${insight.score}% (${insight.recommendation})`);
      return insight;
    } catch (error) {
      log.error('❌ Failed to analyze job match:', error);
      throw error;
    }
  }

  /**
   * Generate personalized email content
   */
  async personalizeEmail(
    templateType: 'thank_you' | 'follow_up' | 'inquiry',
    context: any,
    tone: 'formal' | 'casual' | 'enthusiastic' | 'professional' = 'professional'
  ): Promise<EmailPersonalization> {
    const prompt = this.buildEmailPrompt(templateType, context, tone);
    
    try {
      const result = await this.generateContent(prompt, {
        temperature: 0.6,
        maxTokens: 600,
      });

      const email = this.parseEmailResponse(result.content, tone);
      
      log.info(`✅ Generated personalized ${templateType} email`);
      return email;
    } catch (error) {
      log.error('❌ Failed to personalize email:', error);
      throw error;
    }
  }

  /**
   * Optimize resume for specific job
   */
  async optimizeResume(
    resume: string,
    jobDescription: string,
    targetKeywords?: string[]
  ): Promise<AIGeneratedContent> {
    const prompt = this.buildResumeOptimizationPrompt(resume, jobDescription, targetKeywords);
    
    try {
      const result = await this.generateContent(prompt, {
        temperature: 0.4,
        maxTokens: 1000,
      });

      log.info('✅ Optimized resume for job description');
      return result;
    } catch (error) {
      log.error('❌ Failed to optimize resume:', error);
      throw error;
    }
  }

  /**
   * Generate interview preparation questions
   */
  async generateInterviewQuestions(
    jobDescription: string,
    companyInfo?: string,
    interviewType: 'technical' | 'behavioral' | 'mixed' = 'mixed'
  ): Promise<AIGeneratedContent> {
    const prompt = this.buildInterviewQuestionsPrompt(jobDescription, companyInfo, interviewType);
    
    try {
      const result = await this.generateContent(prompt, {
        temperature: 0.5,
        maxTokens: 800,
      });

      log.info(`✅ Generated ${interviewType} interview questions`);
      return result;
    } catch (error) {
      log.error('❌ Failed to generate interview questions:', error);
      throw error;
    }
  }

  /**
   * Salary negotiation advice
   */
  async getSalaryAdvice(
    jobTitle: string,
    experienceLevel: string,
    location: string,
    companySize?: string
  ): Promise<AIGeneratedContent> {
    const prompt = this.buildSalaryAdvicePrompt(jobTitle, experienceLevel, location, companySize);
    
    try {
      const result = await this.generateContent(prompt, {
        temperature: 0.3,
        maxTokens: 600,
      });

      log.info('✅ Generated salary negotiation advice');
      return result;
    } catch (error) {
      log.error('❌ Failed to generate salary advice:', error);
      throw error;
    }
  }

  /**
   * Core content generation method
   */
  private async generateContent(
    prompt: string,
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<AIGeneratedContent> {
    try {
      let response: any;
      
      switch (this.options.provider) {
        case 'openai':
          response = await this.callOpenAI(prompt, options);
          break;
        case 'claude':
          response = await this.callClaude(prompt, options);
          break;
        case 'local':
          response = await this.callLocalModel(prompt, options);
          break;
        default:
          throw new Error(`Unsupported provider: ${this.options.provider}`);
      }

      return {
        content: response.content,
        confidence: response.confidence || 0.8,
        reasoning: response.reasoning || 'Generated using AI model',
        tokensUsed: response.tokensUsed,
      };
    } catch (error) {
      log.error('AI content generation failed:', error);
      throw error;
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string, options: any): Promise<any> {
    // Mock implementation for demonstration
    const mockResponses = [
      {
        content: 'This is a mock AI response based on the provided context.',
        confidence: 0.85,
        reasoning: 'Generated using GPT-4 with context-aware analysis',
        tokensUsed: 150,
      },
    ];

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return mockResponses[Math.floor(Math.random() * mockResponses.length)];
  }

  /**
   * Call Claude API
   */
  private async callClaude(prompt: string, options: any): Promise<any> {
    // Mock implementation for demonstration
    const mockResponses = [
      {
        content: 'This is a mock Claude response with thoughtful analysis.',
        confidence: 0.88,
        reasoning: 'Generated using Claude with detailed reasoning',
        tokensUsed: 180,
      },
    ];

    await new Promise(resolve => setTimeout(resolve, 1200));
    return mockResponses[Math.floor(Math.random() * mockResponses.length)];
  }

  /**
   * Call local model
   */
  private async callLocalModel(prompt: string, options: any): Promise<any> {
    // Mock implementation for demonstration
    const mockResponses = [
      {
        content: 'This is a mock local model response.',
        confidence: 0.75,
        reasoning: 'Generated using local model',
        tokensUsed: 120,
      },
    ];

    await new Promise(resolve => setTimeout(resolve, 800));
    return mockResponses[Math.floor(Math.random() * mockResponses.length)];
  }

  /**
   * Build cover letter prompt
   */
  private buildCoverLetterPrompt(jobDescription: string, userProfile: any, companyInfo?: string): string {
    return `
You are an expert career counselor and resume writer. Generate a compelling, personalized cover letter based on the following information:

JOB DESCRIPTION:
${jobDescription}

${companyInfo ? `COMPANY INFORMATION:\n${companyInfo}\n` : ''}

CANDIDATE PROFILE:
${JSON.stringify(userProfile, null, 2)}

Requirements:
- Write a professional, engaging cover letter
- Highlight 3-4 key qualifications that match the job
- Show genuine interest in the company
- Use a confident but humble tone
- Keep it under 400 words
- Include specific examples from the candidate's experience
- Avoid generic clichés

Format the response as a complete cover letter ready to send.
    `.trim();
  }

  /**
   * Build job match analysis prompt
   */
  private buildJobMatchPrompt(jobDescription: string, userProfile: any, jobRequirements?: string[]): string {
    return `
You are an expert job application analyst. Analyze how well this candidate matches the job requirements and provide actionable insights.

JOB DESCRIPTION:
${jobDescription}

${jobRequirements ? `EXPLICIT REQUIREMENTS:\n${jobRequirements.join('\n')}\n` : ''}

CANDIDATE PROFILE:
${JSON.stringify(userProfile, null, 2)}

Provide a structured analysis in the following JSON format:
{
  "score": 0-100,
  "reasoning": "Brief explanation of the score",
  "keyMatches": ["match1", "match2", "match3"],
  "gaps": ["gap1", "gap2", "gap3"],
  "recommendation": "apply" | "consider" | "skip"
}

Be honest but constructive in your assessment.
    `.trim();
  }

  /**
   * Build email personalization prompt
   */
  private buildEmailPrompt(templateType: string, context: any, tone: string): string {
    return `
You are a professional communication expert. Generate a personalized email based on the following context:

EMAIL TYPE: ${templateType}
TONE: ${tone}

CONTEXT:
${JSON.stringify(context, null, 2)}

Requirements:
- Write in a ${tone} tone
- Be concise and impactful
- Personalize with specific details from the context
- Include a clear call to action or next step
- Keep it under 300 words
- Make it sound authentic, not generated

Format the response as JSON:
{
  "subject": "Email subject line",
  "body": "Complete email body",
  "personalizationNotes": ["note1", "note2", "note3"],
  "tone": "${tone}"
}
    `.trim();
  }

  /**
   * Build resume optimization prompt
   */
  private buildResumeOptimizationPrompt(resume: string, jobDescription: string, targetKeywords?: string[]): string {
    return `
You are an expert resume optimizer. Improve this resume to better match the job description while maintaining authenticity.

CURRENT RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription}

${targetKeywords ? `TARGET KEYWORDS:\n${targetKeywords.join(', ')}\n` : ''}

Requirements:
- Optimize for ATS (applicant tracking systems)
- Incorporate relevant keywords naturally
- Improve impact statements with metrics
- Enhance formatting for readability
- Maintain factual accuracy
- Keep similar length (1-2 pages)

Provide the optimized resume content with improvement notes.
    `.trim();
  }

  /**
   * Build interview questions prompt
   */
  private buildInterviewQuestionsPrompt(jobDescription: string, companyInfo?: string, interviewType: string = 'mixed'): string {
    return `
You are an expert interview coach. Generate relevant interview questions based on the job details.

JOB DESCRIPTION:
${jobDescription}

${companyInfo ? `COMPANY INFORMATION:\n${companyInfo}\n` : ''}

INTERVIEW TYPE: ${interviewType}

Requirements:
- Generate 8-10 questions
- Mix of technical and behavioral questions based on type
- Include sample ideal answers
- Focus on questions likely to be asked for this role
- Include company-specific questions if company info is provided

Format the response as:
Question 1: [Question]
Ideal Answer: [Brief guidance]

Question 2: [Question]
Ideal Answer: [Brief guidance]

etc.
    `.trim();
  }

  /**
   * Build salary advice prompt
   */
  private buildSalaryAdvicePrompt(jobTitle: string, experienceLevel: string, location: string, companySize?: string): string {
    return `
You are an expert salary negotiation coach. Provide strategic advice for this job negotiation.

JOB DETAILS:
- Title: ${jobTitle}
- Experience Level: ${experienceLevel}
- Location: ${location}
- Company Size: ${companySize || 'Unknown'}

Requirements:
- Research current market rates for this role
- Provide a salary range recommendation
- Include negotiation strategies
- Address timing and approach
- Consider total compensation (base, bonus, equity)
- Provide talking points for justification

Provide actionable, specific advice.
    `.trim();
  }

  /**
   * Parse job match response
   */
  private parseJobMatchResponse(content: string): JobMatchInsight {
    try {
      // Try to parse as JSON first
      if (content.includes('{') && content.includes('}')) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
      
      // Fallback parsing for non-JSON responses
      return {
        score: 75,
        reasoning: content.substring(0, 200) + '...',
        keyMatches: ['Good experience match', 'Relevant skills'],
        gaps: ['Specific experience gap'],
        recommendation: 'consider',
      };
    } catch (error) {
      log.error('Failed to parse job match response:', error);
      return {
        score: 50,
        reasoning: 'Unable to parse AI response',
        keyMatches: [],
        gaps: [],
        recommendation: 'skip',
      };
    }
  }

  /**
   * Parse email response
   */
  private parseEmailResponse(content: string, tone: string): EmailPersonalization {
    try {
      // Try to parse as JSON first
      if (content.includes('{') && content.includes('}')) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            subject: parsed.subject || 'Subject',
            body: parsed.body || content,
            personalizationNotes: parsed.personalizationNotes || [],
            tone: parsed.tone || tone,
          };
        }
      }
      
      // Fallback parsing
      const lines = content.split('\n');
      const subject = lines.find(line => line.toLowerCase().includes('subject')) || 'Subject';
      const body = content.replace(subject, '').trim();
      
      return {
        subject: subject.replace(/subject:/i, '').trim(),
        body,
        personalizationNotes: ['Generated from AI response'],
        tone,
      };
    } catch (error) {
      log.error('Failed to parse email response:', error);
      return {
        subject: 'Generated Email',
        body: content,
        personalizationNotes: ['Error parsing response'],
        tone,
      };
    }
  }
}

// Export singleton instance with default configuration
export const aiEnhancementService = new AIEnhancementService({
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 1000,
});