import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Save } from 'lucide-react';
import type { UserProfile, PersonalInfo, SkillsProfile, ExperienceEntry, EducationEntry } from '@/types/models';

interface UserProfileFormProps {
  profile: UserProfile | null;
  onSave: (profile: UserProfile) => void;
  isLoading?: boolean;
}

const defaultProfile: UserProfile = {
  personal_info: {
    name: '',
    email: '',
    phone: null,
    location: null,
    linkedin: null,
    github: null,
    portfolio: null,
  },
  summary: '',
  skills: {
    technical_skills: [],
    soft_skills: [],
    experience_years: {},
    proficiency_levels: {},
  },
  experience: [],
  education: [],
  projects: [],
};

export function UserProfileForm({ profile, onSave, isLoading }: UserProfileFormProps) {
  // Merge profile with defaults to ensure all nested properties exist
  const safeProfile = profile ? {
    ...defaultProfile,
    ...profile,
    personal_info: { ...defaultProfile.personal_info, ...profile.personal_info },
    skills: { ...defaultProfile.skills, ...profile.skills },
  } : defaultProfile;

  const [formData, setFormData] = useState<UserProfile>(safeProfile);
  const [newTechSkill, setNewTechSkill] = useState('');
  const [newSoftSkill, setNewSoftSkill] = useState('');
  const [newProject, setNewProject] = useState('');

  useEffect(() => {
    if (profile) {
      // Safely merge with defaults when profile changes
      setFormData({
        ...defaultProfile,
        ...profile,
        personal_info: { ...defaultProfile.personal_info, ...profile.personal_info },
        skills: { ...defaultProfile.skills, ...profile.skills },
      });
    }
  }, [profile]);

  const updatePersonalInfo = (field: keyof PersonalInfo, value: string | null) => {
    setFormData(prev => ({
      ...prev,
      personal_info: {
        ...prev.personal_info,
        [field]: value,
      },
    }));
  };

  const updateSkills = <K extends keyof SkillsProfile>(field: K, value: SkillsProfile[K]) => {
    setFormData((prev) => ({
      ...prev,
      skills: {
        ...prev.skills,
        [field]: value,
      },
    }))
  }

  const addTechSkill = () => {
    if (newTechSkill.trim() && !formData.skills.technical_skills.includes(newTechSkill.trim())) {
      updateSkills('technical_skills', [...formData.skills.technical_skills, newTechSkill.trim()]);
      setNewTechSkill('');
    }
  };

  const removeTechSkill = (skill: string) => {
    updateSkills('technical_skills', formData.skills.technical_skills.filter(s => s !== skill));
  };

  const addSoftSkill = () => {
    if (newSoftSkill.trim() && !formData.skills.soft_skills.includes(newSoftSkill.trim())) {
      updateSkills('soft_skills', [...formData.skills.soft_skills, newSoftSkill.trim()]);
      setNewSoftSkill('');
    }
  };

  const removeSoftSkill = (skill: string) => {
    updateSkills('soft_skills', formData.skills.soft_skills.filter(s => s !== skill));
  };

  const addExperience = () => {
    setFormData(prev => ({
      ...prev,
      experience: [
        ...prev.experience,
        {
          company: '',
          position: '',
          duration: '',
          description: [],
          technologies: [],
        },
      ],
    }));
  };

  const updateExperience = <K extends keyof ExperienceEntry>(
    index: number,
    field: K,
    value: ExperienceEntry[K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      experience: prev.experience.map((exp, i) =>
        i === index ? { ...exp, [field]: value } : exp
      ),
    }))
  }

  const removeExperience = (index: number) => {
    setFormData(prev => ({
      ...prev,
      experience: prev.experience.filter((_, i) => i !== index),
    }));
  };

  const addEducation = () => {
    setFormData(prev => ({
      ...prev,
      education: [
        ...prev.education,
        {
          institution: '',
          degree: '',
          year: '',
          details: null,
        },
      ],
    }));
  };

  const updateEducation = <K extends keyof EducationEntry>(
    index: number,
    field: K,
    value: EducationEntry[K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      education: prev.education.map((edu, i) =>
        i === index ? { ...edu, [field]: value } : edu
      ),
    }))
  }

  const removeEducation = (index: number) => {
    setFormData(prev => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index),
    }));
  };

  const addProject = () => {
    if (newProject.trim()) {
      setFormData(prev => ({
        ...prev,
        projects: [...prev.projects, newProject.trim()],
      }));
      setNewProject('');
    }
  };

  const removeProject = (index: number) => {
    setFormData(prev => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== index),
    }));
  };

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Your contact information and links</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.personal_info.name}
                onChange={(e) => updatePersonalInfo('name', e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.personal_info.email}
                onChange={(e) => updatePersonalInfo('email', e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.personal_info.phone || ''}
                onChange={(e) => updatePersonalInfo('phone', e.target.value || null)}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.personal_info.location || ''}
                onChange={(e) => updatePersonalInfo('location', e.target.value || null)}
                placeholder="City, Country"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin">LinkedIn</Label>
              <Input
                id="linkedin"
                value={formData.personal_info.linkedin || ''}
                onChange={(e) => updatePersonalInfo('linkedin', e.target.value || null)}
                placeholder="linkedin.com/in/username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="github">GitHub</Label>
              <Input
                id="github"
                value={formData.personal_info.github || ''}
                onChange={(e) => updatePersonalInfo('github', e.target.value || null)}
                placeholder="github.com/username"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Professional Summary</CardTitle>
          <CardDescription>Brief overview of your experience and skills</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.summary}
            onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
            placeholder="Experienced software developer with expertise in..."
            className="min-h-[100px]"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
          <CardDescription>Technical and soft skills</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Technical Skills</Label>
            <div className="flex gap-2">
              <Input
                value={newTechSkill}
                onChange={(e) => setNewTechSkill(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTechSkill())}
                placeholder="Add technical skill"
              />
              <Button type="button" onClick={addTechSkill} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.skills.technical_skills.map((skill) => (
                <div
                  key={skill}
                  className="flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-md text-sm"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => removeTechSkill(skill)}
                    className="hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Soft Skills</Label>
            <div className="flex gap-2">
              <Input
                value={newSoftSkill}
                onChange={(e) => setNewSoftSkill(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSoftSkill())}
                placeholder="Add soft skill"
              />
              <Button type="button" onClick={addSoftSkill} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.skills.soft_skills.map((skill) => (
                <div
                  key={skill}
                  className="flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-md text-sm"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => removeSoftSkill(skill)}
                    className="hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Experience</CardTitle>
              <CardDescription>Work experience and positions</CardDescription>
            </div>
            <Button type="button" onClick={addExperience} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Experience
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.experience.map((exp, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-start">
                <h4 className="font-medium">Experience #{index + 1}</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeExperience(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input
                    value={exp.company}
                    onChange={(e) => updateExperience(index, 'company', e.target.value)}
                    placeholder="Company Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Input
                    value={exp.position}
                    onChange={(e) => updateExperience(index, 'position', e.target.value)}
                    placeholder="Job Title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Input
                    value={exp.duration}
                    onChange={(e) => updateExperience(index, 'duration', e.target.value)}
                    placeholder="Jan 2020 - Present"
                  />
                </div>
              </div>
            </div>
          ))}
          {formData.experience.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No experience added yet. Click "Add Experience" to get started.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Education</CardTitle>
              <CardDescription>Educational background</CardDescription>
            </div>
            <Button type="button" onClick={addEducation} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Education
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.education.map((edu, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-start">
                <h4 className="font-medium">Education #{index + 1}</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEducation(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Institution</Label>
                  <Input
                    value={edu.institution}
                    onChange={(e) => updateEducation(index, 'institution', e.target.value)}
                    placeholder="University Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Degree</Label>
                  <Input
                    value={edu.degree}
                    onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                    placeholder="Bachelor of Science"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Input
                    value={edu.year}
                    onChange={(e) => updateEducation(index, 'year', e.target.value)}
                    placeholder="2020"
                  />
                </div>
              </div>
            </div>
          ))}
          {formData.education.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No education added yet. Click "Add Education" to get started.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>Notable projects and achievements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newProject}
              onChange={(e) => setNewProject(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addProject())}
              placeholder="Add project description"
            />
            <Button type="button" onClick={addProject}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {formData.projects.map((project, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 border rounded-md"
              >
                <span>{project}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeProject(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading} size="lg">
          <Save className="h-4 w-4 mr-2" />
          Save Profile
        </Button>
      </div>
    </div>
  );
}

