"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Clock, Play, CheckCircle, Lock, ExternalLink, BookOpen, Target, Zap, Calendar, BarChart3 } from "lucide-react";

interface LearningResource {
  id: number;
  title: string;
  provider: string;
  type: "course" | "tutorial" | "bootcamp" | "certification" | "book";
  duration: number; // in hours
  cost: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  rating: number;
  url: string;
  completed: boolean;
  progress: number;
}

interface LearningPath {
  id: number;
  targetJob: string;
  targetCompany: string;
  skillGaps: string[];
  resources: LearningResource[];
  totalHours: number;
  estimatedWeeks: number;
  hoursPerDay: number;
  status: "not_started" | "in_progress" | "completed";
  progress: number;
  startDate?: string;
  completionDate?: string;
}

const mockLearningPaths: LearningPath[] = [
  {
    id: 1,
    targetJob: "Senior Frontend Developer",
    targetCompany: "TechCorp",
    skillGaps: ["GraphQL", "AWS"],
    resources: [
      {
        id: 1,
        title: "GraphQL - The Complete Guide",
        provider: "Udemy",
        type: "course",
        duration: 20,
        cost: 89.99,
        difficulty: "intermediate",
        rating: 4.8,
        url: "#",
        completed: false,
        progress: 0
      },
      {
        id: 2,
        title: "AWS for Frontend Developers",
        provider: "Coursera",
        type: "course",
        duration: 15,
        cost: 79.99,
        difficulty: "intermediate",
        rating: 4.6,
        url: "#",
        completed: false,
        progress: 0
      }
    ],
    totalHours: 35,
    estimatedWeeks: 1,
    hoursPerDay: 5,
    status: "not_started",
    progress: 0
  },
  {
    id: 2,
    targetJob: "Full Stack Engineer",
    targetCompany: "StartupXYZ",
    skillGaps: ["Docker", "PostgreSQL"],
    resources: [
      {
        id: 3,
        title: "Docker Mastery",
        provider: "freeCodeCamp",
        type: "tutorial",
        duration: 10,
        cost: 0,
        difficulty: "beginner",
        rating: 4.7,
        url: "#",
        completed: true,
        progress: 100
      },
      {
        id: 4,
        title: "PostgreSQL Deep Dive",
        provider: "Pluralsight",
        type: "course",
        duration: 25,
        cost: 99.99,
        difficulty: "intermediate",
        rating: 4.5,
        url: "#",
        completed: false,
        progress: 30
      }
    ],
    totalHours: 35,
    estimatedWeeks: 1,
    hoursPerDay: 5,
    status: "in_progress",
    progress: 50,
    startDate: "2024-01-15"
  }
];

export default function LearningPathsPage() {
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>(mockLearningPaths);
  const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null);
  const [activeTab, setActiveTab] = useState<'paths' | 'resources'>('paths');

  const getResourceIcon = (type: string) => {
    switch (type) {
      case "course": return "📚";
      case "tutorial": return "🎥";
      case "bootcamp": return "🚀";
      case "certification": return "🏆";
      case "book": return "📖";
      default: return "📄";
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner": return "bg-green-400 text-black";
      case "intermediate": return "bg-yellow-400 text-black";
      case "advanced": return "bg-red-400 text-white";
      default: return "bg-gray-400 text-black";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500 text-white";
      case "in_progress": return "bg-cyan-500 text-white";
      case "not_started": return "bg-gray-400 text-white";
      default: return "bg-gray-400 text-white";
    }
  };

  const BrutalistButton = ({ onClick, children, variant = "primary", icon, size = "md" }: any) => {
    const sizeClasses: Record<string, string> = {
      sm: "px-3 py-2 text-sm",
      md: "px-4 py-3 text-base",
      lg: "px-6 py-4 text-lg"
    };

    return (
      <button
        onClick={onClick}
        className={`font-black border-2 transition-all transform hover:scale-105 ${sizeClasses[size]} ${
          variant === "primary" 
            ? "bg-cyan-400 text-black border-black hover:bg-white" 
            : variant === "secondary"
            ? "bg-black text-cyan-400 border-cyan-400 hover:bg-cyan-400 hover:text-black"
            : "bg-purple-400 text-black border-black hover:bg-white"
        } flex items-center gap-2`}
      >
        {icon && <span className="w-4 h-4">{icon}</span>}
        {children}
      </button>
    );
  };

  const LearningPathCard = ({ path, index }: { path: LearningPath; index: number }) => (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
      className="bg-white border-4 border-black cursor-pointer hover:border-cyan-400 transition-all"
      onClick={() => setSelectedPath(path)}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="font-black text-xl mb-2">{path.targetJob}</h3>
            <div className="font-mono text-sm text-gray-600 mb-2">{path.targetCompany}</div>
            <div className={`inline-block px-3 py-1 text-xs font-black ${getStatusColor(path.status)}`}>
              {path.status.replace('_', ' ').toUpperCase()}
            </div>
          </div>
          <div className="text-right">
            <div className="font-black text-2xl text-cyan-400">{path.progress}%</div>
            <div className="text-xs font-mono">COMPLETE</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="w-full bg-gray-200 h-4 rounded-full overflow-hidden border-2 border-black">
            <div 
              className={`h-full transition-all duration-1000 ${
                path.status === 'completed' ? 'bg-green-400' : 
                path.status === 'in_progress' ? 'bg-cyan-400' : 'bg-gray-400'
              }`}
              style={{ width: `${path.progress}%` }}
            ></div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <Clock className="w-4 h-4 mx-auto mb-1 text-gray-600" />
            <div className="font-black text-lg">{path.totalHours}h</div>
            <div className="text-xs font-mono">TOTAL HOURS</div>
          </div>
          <div className="text-center">
            <Calendar className="w-4 h-4 mx-auto mb-1 text-gray-600" />
            <div className="font-black text-lg">{path.estimatedWeeks}w</div>
            <div className="text-xs font-mono">ESTIMATED</div>
          </div>
          <div className="text-center">
            <Target className="w-4 h-4 mx-auto mb-1 text-gray-600" />
            <div className="font-black text-lg">{path.resources.length}</div>
            <div className="text-xs font-mono">RESOURCES</div>
          </div>
          <div className="text-center">
            <BarChart3 className="w-4 h-4 mx-auto mb-1 text-gray-600" />
            <div className="font-black text-lg">{path.hoursPerDay}h</div>
            <div className="text-xs font-mono">PER DAY</div>
          </div>
        </div>

        {/* Skill Gaps */}
        <div className="mb-4">
          <div className="font-black text-sm mb-2 flex items-center gap-2">
            <Target className="w-4 h-4" />
            SKILL GAPS TO CLOSE:
          </div>
          <div className="flex flex-wrap gap-2">
            {path.skillGaps.map((gap, i) => (
              <span
                key={i}
                className="bg-yellow-100 text-yellow-800 px-2 py-1 text-xs font-mono border border-yellow-600"
              >
                {gap}
              </span>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <BrutalistButton
            onClick={(e: any) => {
              e.stopPropagation();
              setSelectedPath(path);
            }}
            variant="secondary"
            size="sm"
            icon={<ExternalLink className="w-3 h-3" />}
          >
            VIEW PATH
          </BrutalistButton>
          {path.status === "not_started" && (
            <BrutalistButton
              onClick={(e: any) => {
                e.stopPropagation();
                // Start learning path
                const updatedPaths = learningPaths.map(p => 
                  p.id === path.id 
                    ? { ...p, status: "in_progress" as const, startDate: new Date().toISOString() }
                    : p
                );
                setLearningPaths(updatedPaths);
              }}
              variant="primary"
              size="sm"
              icon={<Play className="w-3 h-3" />}
            >
              START LEARNING
            </BrutalistButton>
          )}
          {path.status === "in_progress" && (
            <BrutalistButton
              onClick={(e: any) => {
                e.stopPropagation();
                setSelectedPath(path);
              }}
              variant="primary"
              size="sm"
              icon={<BookOpen className="w-3 h-3" />}
            >
              CONTINUE
            </BrutalistButton>
          )}
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="bg-black text-cyan-400 p-6 border-b-4 border-cyan-400"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.href = "/demo"}
              className="bg-cyan-400 text-black px-4 py-2 font-black border-2 border-black hover:bg-white transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              BACK TO DEMO
            </button>
            <div className="font-black text-xl flex items-center gap-2">
              <div className="w-8 h-8 bg-cyan-400 text-black rounded-full flex items-center justify-center font-black text-lg">
                📚
              </div>
              LEARNING PATHS
            </div>
          </div>
          <div className="font-mono text-sm">
            {learningPaths.length} paths created
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-6">
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-black text-white p-4 rotate-1 border-4 border-cyan-400">
            <div className="text-2xl font-black text-cyan-400">{learningPaths.length}</div>
            <div className="text-sm font-mono">ACTIVE PATHS</div>
          </div>
          <div className="bg-cyan-400 text-black p-4 -rotate-2 border-4 border-black">
            <div className="text-2xl font-black">
              {learningPaths.filter(p => p.status === 'in_progress').length}
            </div>
            <div className="text-sm font-mono">IN PROGRESS</div>
          </div>
          <div className="bg-purple-400 text-black p-4 rotate-1 border-4 border-black">
            <div className="text-2xl font-black">
              {learningPaths.filter(p => p.status === 'completed').length}
            </div>
            <div className="text-sm font-mono">COMPLETED</div>
          </div>
          <div className="bg-green-400 text-black p-4 -rotate-2 border-4 border-black">
            <div className="text-2xl font-black">
              {Math.round(learningPaths.reduce((acc, path) => acc + path.progress, 0) / learningPaths.length)}%
            </div>
            <div className="text-sm font-mono">AVG PROGRESS</div>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="bg-black text-cyan-400 p-1 border-4 border-cyan-400 mb-8"
        >
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('paths')}
              className={`px-6 py-3 font-black text-sm transition-all ${
                activeTab === 'paths'
                  ? 'bg-cyan-400 text-black'
                  : 'hover:bg-white text-cyan-400'
              }`}
            >
              LEARNING PATHS
            </button>
            <button
              onClick={() => setActiveTab('resources')}
              className={`px-6 py-3 font-black text-sm transition-all ${
                activeTab === 'resources'
                  ? 'bg-cyan-400 text-black'
                  : 'hover:bg-white text-cyan-400'
              }`}
            >
              RESOURCE LIBRARY
            </button>
          </div>
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'paths' && (
            <motion.div
              key="paths"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {learningPaths.map((path, index) => (
                <LearningPathCard key={path.id} path={path} index={index} />
              ))}

              {learningPaths.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-16 border-4 border-dashed border-gray-300"
                >
                  <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="font-black text-2xl mb-2">NO LEARNING PATHS YET</h3>
                  <p className="font-mono text-gray-500 mb-4">
                    Complete your assessment to get personalized learning paths
                  </p>
                  <BrutalistButton
                    onClick={() => window.location.href = "/demo"}
                    icon={<Zap className="w-4 h-4" />}
                  >
                    START ASSESSMENT
                  </BrutalistButton>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'resources' && (
            <motion.div
              key="resources"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="text-center py-16 border-4 border-dashed border-gray-300">
                <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="font-black text-2xl mb-2">RESOURCE LIBRARY</h3>
                <p className="font-mono text-gray-500">
                  Browse all available learning resources
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Learning Path Details Modal */}
      <AnimatePresence>
        {selectedPath && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedPath(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-4 border-black max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e: any) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="font-black text-2xl mb-2">{selectedPath.targetJob}</h2>
                    <div className="font-mono text-gray-600">{selectedPath.targetCompany}</div>
                  </div>
                  <button
                    onClick={() => setSelectedPath(null)}
                    className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>

                <div className="mb-6">
                  <div className="bg-black text-cyan-400 p-4 border-2 border-cyan-400 mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-black text-lg">PROGRESS: {selectedPath.progress}%</div>
                      <div className={`px-3 py-1 text-xs font-black ${getStatusColor(selectedPath.status)}`}>
                        {selectedPath.status.replace('_', ' ').toUpperCase()}
                      </div>
                    </div>
                    <div className="w-full bg-cyan-900 h-4 rounded-full overflow-hidden">
                      <div 
                        className="bg-cyan-400 h-full transition-all duration-1000"
                        style={{ width: `${selectedPath.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-100 p-3 border-2 border-black">
                      <div className="font-black text-lg">{selectedPath.totalHours}h</div>
                      <div className="text-xs font-mono">TOTAL HOURS</div>
                    </div>
                    <div className="bg-gray-100 p-3 border-2 border-black">
                      <div className="font-black text-lg">{selectedPath.estimatedWeeks}w</div>
                      <div className="text-xs font-mono">ESTIMATED</div>
                    </div>
                    <div className="bg-gray-100 p-3 border-2 border-black">
                      <div className="font-black text-lg">{selectedPath.resources.length}</div>
                      <div className="text-xs font-mono">RESOURCES</div>
                    </div>
                    <div className="bg-gray-100 p-3 border-2 border-black">
                      <div className="font-black text-lg">{selectedPath.hoursPerDay}h</div>
                      <div className="text-xs font-mono">PER DAY</div>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="font-black text-lg mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    LEARNING RESOURCES
                  </h3>
                  <div className="space-y-3">
                    {selectedPath.resources.map((resource, index) => (
                      <motion.div
                        key={resource.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className="bg-white border-2 border-gray-300 p-4"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{getResourceIcon(resource.type)}</span>
                              <h4 className="font-black text-base">{resource.title}</h4>
                            </div>
                            <div className="font-mono text-sm text-gray-600">{resource.provider}</div>
                          </div>
                          <div className="text-right">
                            {resource.completed ? (
                              <CheckCircle className="w-6 h-6 text-green-500" />
                            ) : (
                              <Lock className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-4 text-sm font-mono">
                            <span className={`px-2 py-1 text-xs font-black ${getDifficultyColor(resource.difficulty)}`}>
                              {resource.difficulty.toUpperCase()}
                            </span>
                            <span>{resource.duration}h</span>
                            <span>${resource.cost}</span>
                            <span className="text-yellow-600">⭐ {resource.rating}</span>
                          </div>
                        </div>

                        {!resource.completed && (
                          <div className="mb-2">
                            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-cyan-400 h-full transition-all duration-1000"
                                style={{ width: `${resource.progress}%` }}
                              ></div>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <BrutalistButton
                            onClick={() => window.open(resource.url, '_blank')}
                            variant="secondary"
                            size="sm"
                            icon={<ExternalLink className="w-3 h-3" />}
                          >
                            OPEN RESOURCE
                          </BrutalistButton>
                          {resource.completed && (
                            <BrutalistButton
                              variant="primary"
                              size="sm"
                              icon={<CheckCircle className="w-3 h-3" />}
                            >
                              COMPLETED
                            </BrutalistButton>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <BrutalistButton
                    onClick={() => setSelectedPath(null)}
                    variant="secondary"
                  >
                    CLOSE
                  </BrutalistButton>
                  {selectedPath.status === "not_started" && (
                    <BrutalistButton
                      onClick={() => {
                        const updatedPaths = learningPaths.map(p => 
                          p.id === selectedPath.id 
                            ? { ...p, status: "in_progress" as const, startDate: new Date().toISOString() }
                            : p
                        );
                        setLearningPaths(updatedPaths);
                        setSelectedPath({ ...selectedPath, status: "in_progress" as const });
                      }}
                      variant="primary"
                      icon={<Play className="w-4 h-4" />}
                    >
                      START LEARNING PATH
                    </BrutalistButton>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
