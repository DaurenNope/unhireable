import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Save } from 'lucide-react';
const defaultProfile = {
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
export function UserProfileForm({ profile, onSave, isLoading }) {
    const [formData, setFormData] = useState(profile || defaultProfile);
    const [newTechSkill, setNewTechSkill] = useState('');
    const [newSoftSkill, setNewSoftSkill] = useState('');
    const [newProject, setNewProject] = useState('');
    useEffect(() => {
        if (profile) {
            setFormData(profile);
        }
    }, [profile]);
    const updatePersonalInfo = (field, value) => {
        setFormData(prev => ({
            ...prev,
            personal_info: {
                ...prev.personal_info,
                [field]: value,
            },
        }));
    };
    const updateSkills = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            skills: {
                ...prev.skills,
                [field]: value,
            },
        }));
    };
    const addTechSkill = () => {
        if (newTechSkill.trim() && !formData.skills.technical_skills.includes(newTechSkill.trim())) {
            updateSkills('technical_skills', [...formData.skills.technical_skills, newTechSkill.trim()]);
            setNewTechSkill('');
        }
    };
    const removeTechSkill = (skill) => {
        updateSkills('technical_skills', formData.skills.technical_skills.filter(s => s !== skill));
    };
    const addSoftSkill = () => {
        if (newSoftSkill.trim() && !formData.skills.soft_skills.includes(newSoftSkill.trim())) {
            updateSkills('soft_skills', [...formData.skills.soft_skills, newSoftSkill.trim()]);
            setNewSoftSkill('');
        }
    };
    const removeSoftSkill = (skill) => {
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
    const updateExperience = (index, field, value) => {
        setFormData((prev) => ({
            ...prev,
            experience: prev.experience.map((exp, i) => i === index ? { ...exp, [field]: value } : exp),
        }));
    };
    const removeExperience = (index) => {
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
    const updateEducation = (index, field, value) => {
        setFormData((prev) => ({
            ...prev,
            education: prev.education.map((edu, i) => i === index ? { ...edu, [field]: value } : edu),
        }));
    };
    const removeEducation = (index) => {
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
    const removeProject = (index) => {
        setFormData(prev => ({
            ...prev,
            projects: prev.projects.filter((_, i) => i !== index),
        }));
    };
    const handleSave = () => {
        onSave(formData);
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Personal Information" }), _jsx(CardDescription, { children: "Your contact information and links" })] }), _jsx(CardContent, { className: "space-y-4", children: _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "name", children: "Full Name *" }), _jsx(Input, { id: "name", value: formData.personal_info.name, onChange: (e) => updatePersonalInfo('name', e.target.value), placeholder: "John Doe" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "email", children: "Email *" }), _jsx(Input, { id: "email", type: "email", value: formData.personal_info.email, onChange: (e) => updatePersonalInfo('email', e.target.value), placeholder: "john@example.com" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "phone", children: "Phone" }), _jsx(Input, { id: "phone", value: formData.personal_info.phone || '', onChange: (e) => updatePersonalInfo('phone', e.target.value || null), placeholder: "+1 (555) 123-4567" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "location", children: "Location" }), _jsx(Input, { id: "location", value: formData.personal_info.location || '', onChange: (e) => updatePersonalInfo('location', e.target.value || null), placeholder: "City, Country" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "linkedin", children: "LinkedIn" }), _jsx(Input, { id: "linkedin", value: formData.personal_info.linkedin || '', onChange: (e) => updatePersonalInfo('linkedin', e.target.value || null), placeholder: "linkedin.com/in/username" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "github", children: "GitHub" }), _jsx(Input, { id: "github", value: formData.personal_info.github || '', onChange: (e) => updatePersonalInfo('github', e.target.value || null), placeholder: "github.com/username" })] })] }) })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Professional Summary" }), _jsx(CardDescription, { children: "Brief overview of your experience and skills" })] }), _jsx(CardContent, { children: _jsx(Textarea, { value: formData.summary, onChange: (e) => setFormData(prev => ({ ...prev, summary: e.target.value })), placeholder: "Experienced software developer with expertise in...", className: "min-h-[100px]" }) })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Skills" }), _jsx(CardDescription, { children: "Technical and soft skills" })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Technical Skills" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { value: newTechSkill, onChange: (e) => setNewTechSkill(e.target.value), onKeyPress: (e) => e.key === 'Enter' && (e.preventDefault(), addTechSkill()), placeholder: "Add technical skill" }), _jsx(Button, { type: "button", onClick: addTechSkill, size: "icon", children: _jsx(Plus, { className: "h-4 w-4" }) })] }), _jsx("div", { className: "flex flex-wrap gap-2", children: formData.skills.technical_skills.map((skill) => (_jsxs("div", { className: "flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-md text-sm", children: [_jsx("span", { children: skill }), _jsx("button", { type: "button", onClick: () => removeTechSkill(skill), className: "hover:text-destructive", children: _jsx(Trash2, { className: "h-3 w-3" }) })] }, skill))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Soft Skills" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { value: newSoftSkill, onChange: (e) => setNewSoftSkill(e.target.value), onKeyPress: (e) => e.key === 'Enter' && (e.preventDefault(), addSoftSkill()), placeholder: "Add soft skill" }), _jsx(Button, { type: "button", onClick: addSoftSkill, size: "icon", children: _jsx(Plus, { className: "h-4 w-4" }) })] }), _jsx("div", { className: "flex flex-wrap gap-2", children: formData.skills.soft_skills.map((skill) => (_jsxs("div", { className: "flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-md text-sm", children: [_jsx("span", { children: skill }), _jsx("button", { type: "button", onClick: () => removeSoftSkill(skill), className: "hover:text-destructive", children: _jsx(Trash2, { className: "h-3 w-3" }) })] }, skill))) })] })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx(CardTitle, { children: "Experience" }), _jsx(CardDescription, { children: "Work experience and positions" })] }), _jsxs(Button, { type: "button", onClick: addExperience, size: "sm", children: [_jsx(Plus, { className: "h-4 w-4 mr-2" }), "Add Experience"] })] }) }), _jsxs(CardContent, { className: "space-y-4", children: [formData.experience.map((exp, index) => (_jsxs("div", { className: "border rounded-lg p-4 space-y-3", children: [_jsxs("div", { className: "flex justify-between items-start", children: [_jsxs("h4", { className: "font-medium", children: ["Experience #", index + 1] }), _jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => removeExperience(index), children: _jsx(Trash2, { className: "h-4 w-4" }) })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Company" }), _jsx(Input, { value: exp.company, onChange: (e) => updateExperience(index, 'company', e.target.value), placeholder: "Company Name" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Position" }), _jsx(Input, { value: exp.position, onChange: (e) => updateExperience(index, 'position', e.target.value), placeholder: "Job Title" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Duration" }), _jsx(Input, { value: exp.duration, onChange: (e) => updateExperience(index, 'duration', e.target.value), placeholder: "Jan 2020 - Present" })] })] })] }, index))), formData.experience.length === 0 && (_jsx("p", { className: "text-sm text-muted-foreground text-center py-4", children: "No experience added yet. Click \"Add Experience\" to get started." }))] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx(CardTitle, { children: "Education" }), _jsx(CardDescription, { children: "Educational background" })] }), _jsxs(Button, { type: "button", onClick: addEducation, size: "sm", children: [_jsx(Plus, { className: "h-4 w-4 mr-2" }), "Add Education"] })] }) }), _jsxs(CardContent, { className: "space-y-4", children: [formData.education.map((edu, index) => (_jsxs("div", { className: "border rounded-lg p-4 space-y-3", children: [_jsxs("div", { className: "flex justify-between items-start", children: [_jsxs("h4", { className: "font-medium", children: ["Education #", index + 1] }), _jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => removeEducation(index), children: _jsx(Trash2, { className: "h-4 w-4" }) })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Institution" }), _jsx(Input, { value: edu.institution, onChange: (e) => updateEducation(index, 'institution', e.target.value), placeholder: "University Name" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Degree" }), _jsx(Input, { value: edu.degree, onChange: (e) => updateEducation(index, 'degree', e.target.value), placeholder: "Bachelor of Science" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Year" }), _jsx(Input, { value: edu.year, onChange: (e) => updateEducation(index, 'year', e.target.value), placeholder: "2020" })] })] })] }, index))), formData.education.length === 0 && (_jsx("p", { className: "text-sm text-muted-foreground text-center py-4", children: "No education added yet. Click \"Add Education\" to get started." }))] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Projects" }), _jsx(CardDescription, { children: "Notable projects and achievements" })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { value: newProject, onChange: (e) => setNewProject(e.target.value), onKeyPress: (e) => e.key === 'Enter' && (e.preventDefault(), addProject()), placeholder: "Add project description" }), _jsxs(Button, { type: "button", onClick: addProject, children: [_jsx(Plus, { className: "h-4 w-4 mr-2" }), "Add"] })] }), _jsx("div", { className: "space-y-2", children: formData.projects.map((project, index) => (_jsxs("div", { className: "flex items-center justify-between p-2 border rounded-md", children: [_jsx("span", { children: project }), _jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => removeProject(index), children: _jsx(Trash2, { className: "h-4 w-4" }) })] }, index))) })] })] }), _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { onClick: handleSave, disabled: isLoading, size: "lg", children: [_jsx(Save, { className: "h-4 w-4 mr-2" }), "Save Profile"] }) })] }));
}
