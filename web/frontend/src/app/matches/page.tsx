"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, Filter, TrendingUp, AlertCircle, ExternalLink, Zap, Target, Clock, DollarSign } from "lucide-react";

interface JobMatch {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  matchScore: number;
  skillGaps: string[];
  matchReasons: string[];
  postedDate: string;
  type: "remote" | "hybrid" | "onsite";
  difficulty: "beginner" | "intermediate" | "advanced";
}

const mockJobMatches: JobMatch[] = [
  {
    id: 1,
    title: "Senior Frontend Developer",
    company: "TechCorp",
    location: "San Francisco, CA / Remote",
    salary: "$120k - $180k",
    matchScore: 92,
    skillGaps: ["GraphQL", "AWS"],
    matchReasons: ["Strong React experience", "TypeScript proficiency", "5+ years experience"],
    postedDate: "2 days ago",
    type: "remote",
    difficulty: "advanced"
  },
  {
    id: 2,
    title: "Full Stack Engineer",
    company: "StartupXYZ",
    location: "New York, NY",
    salary: "$90k - $140k",
    matchScore: 78,
    skillGaps: ["Docker", "PostgreSQL"],
    matchReasons: ["Node.js experience", "React skills", "Startup experience"],
    postedDate: "1 week ago",
    type: "hybrid",
    difficulty: "intermediate"
  },
  {
    id: 3,
    title: "Junior Web Developer",
    company: "Digital Agency",
    location: "Austin, TX",
    salary: "$60k - $80k",
    matchScore: 85,
    skillGaps: ["WordPress", "SEO"],
    matchReasons: ["HTML/CSS expertise", "JavaScript skills", "Portfolio projects"],
    postedDate: "3 days ago",
    type: "onsite",
    difficulty: "beginner"
  },
  {
    id: 4,
    title: "React Developer",
    company: "FinTech Inc",
    location: "Miami, FL / Remote",
    salary: "$100k - $150k",
    matchScore: 88,
    skillGaps: ["Financial APIs", "Testing"],
    matchReasons: ["React mastery", "TypeScript knowledge", "Clean code practices"],
    postedDate: "1 day ago",
    type: "remote",
    difficulty: "intermediate"
  }
];

export default function JobMatchesPage() {
  const [jobs, setJobs] = useState<JobMatch[]>(mockJobMatches);
  const [filteredJobs, setFilteredJobs] = useState<JobMatch[]>(mockJobMatches);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"match" | "salary" | "date">("match");
  const [selectedJob, setSelectedJob] = useState<JobMatch | null>(null);

  useEffect(() => {
    let filtered = jobs;

    // Filter by search
    if (searchTerm) {
      filtered = filtered.filter(job => 
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.company.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by difficulty
    if (selectedDifficulty !== "all") {
      filtered = filtered.filter(job => job.difficulty === selectedDifficulty);
    }

    // Filter by type
    if (selectedType !== "all") {
      filtered = filtered.filter(job => job.type === selectedType);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "match":
          return b.matchScore - a.matchScore;
        case "salary":
          return parseInt(b.salary.replace(/\D/g, "")) - parseInt(a.salary.replace(/\D/g, ""));
        case "date":
          return 0; // Would need actual date parsing
        default:
          return 0;
      }
    });

    setFilteredJobs(filtered);
  }, [jobs, searchTerm, selectedDifficulty, selectedType, sortBy]);

  const getMatchColor = (score: number) => {
    if (score >= 90) return "text-green-600 bg-green-100 border-green-600";
    if (score >= 75) return "text-cyan-600 bg-cyan-100 border-cyan-600";
    if (score >= 60) return "text-yellow-600 bg-yellow-100 border-yellow-600";
    return "text-red-600 bg-red-100 border-red-600";
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner": return "bg-green-400 text-black";
      case "intermediate": return "bg-yellow-400 text-black";
      case "advanced": return "bg-red-400 text-white";
      default: return "bg-gray-400 text-black";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "remote": return "🏠";
      case "hybrid": return "🏢";
      case "onsite": return "🏬";
      default: return "📍";
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

  const JobMatchCard = ({ job, index }: { job: JobMatch; index: number }) => (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
      className="bg-white border-4 border-black cursor-pointer hover:border-cyan-400 transition-all"
      onClick={() => setSelectedJob(job)}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="font-black text-xl mb-2">{job.title}</h3>
            <div className="flex items-center gap-3 text-sm font-mono">
              <span className="font-bold">{job.company}</span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-600">{job.location}</span>
              <span className="text-gray-500">•</span>
              <span>{getTypeIcon(job.type)} {job.type}</span>
            </div>
          </div>
          <div className="text-right">
            <div className={`px-3 py-1 font-black text-2xl border-2 ${getMatchColor(job.matchScore)}`}>
              {job.matchScore}%
            </div>
            <div className="text-xs font-mono mt-1">MATCH</div>
          </div>
        </div>

        {/* Salary and Difficulty */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="font-mono font-bold text-green-600">{job.salary}</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            <span className={`px-2 py-1 text-xs font-black ${getDifficultyColor(job.difficulty)}`}>
              {job.difficulty.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-mono text-gray-500">{job.postedDate}</span>
          </div>
        </div>

        {/* Match Reasons */}
        <div className="mb-4">
          <div className="font-black text-sm mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            WHY YOU MATCH:
          </div>
          <div className="flex flex-wrap gap-2">
            {job.matchReasons.map((reason, i) => (
              <span
                key={i}
                className="bg-green-100 text-green-800 px-2 py-1 text-xs font-mono border border-green-600"
              >
                ✓ {reason}
              </span>
            ))}
          </div>
        </div>

        {/* Skill Gaps */}
        {job.skillGaps.length > 0 && (
          <div className="mb-4">
            <div className="font-black text-sm mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              SKILL GAPS:
            </div>
            <div className="flex flex-wrap gap-2">
              {job.skillGaps.map((gap, i) => (
                <span
                  key={i}
                  className="bg-yellow-100 text-yellow-800 px-2 py-1 text-xs font-mono border border-yellow-600"
                >
                  + {gap}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <BrutalistButton
            onClick={(e: any) => {
              e.stopPropagation();
              setSelectedJob(job);
            }}
            variant="secondary"
            size="sm"
            icon={<ExternalLink className="w-3 h-3" />}
          >
            VIEW DETAILS
          </BrutalistButton>
          <BrutalistButton
            onClick={(e: any) => {
              e.stopPropagation();
              window.location.href = `/learning-paths?job=${job.id}`;
            }}
            variant="primary"
            size="sm"
            icon={<Zap className="w-3 h-3" />}
          >
            LEARNING PATH
          </BrutalistButton>
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
                💼
              </div>
              JOB MATCHES
            </div>
          </div>
          <div className="font-mono text-sm">
            Found {filteredJobs.length} jobs for you
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
            <div className="text-2xl font-black text-cyan-400">{filteredJobs.length}</div>
            <div className="text-sm font-mono">TOTAL MATCHES</div>
          </div>
          <div className="bg-cyan-400 text-black p-4 -rotate-2 border-4 border-black">
            <div className="text-2xl font-black">
              {filteredJobs.filter(j => j.matchScore >= 90).length}
            </div>
            <div className="text-sm font-mono">PERFECT MATCHES</div>
          </div>
          <div className="bg-purple-400 text-black p-4 rotate-1 border-4 border-black">
            <div className="text-2xl font-black">
              {Math.round(filteredJobs.reduce((acc, job) => acc + job.matchScore, 0) / filteredJobs.length)}%
            </div>
            <div className="text-sm font-mono">AVG MATCH SCORE</div>
          </div>
          <div className="bg-green-400 text-black p-4 -rotate-2 border-4 border-black">
            <div className="text-2xl font-black">$150k</div>
            <div className="text-sm font-mono">AVG SALARY</div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="bg-black text-cyan-400 p-4 border-4 border-cyan-400 mb-8"
        >
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-cyan-400" />
                <input
                  type="text"
                  placeholder="Search jobs or companies..."
                  value={searchTerm}
                  onChange={(e: any) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white text-black border-2 border-black font-mono focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>
            
            <select
              value={selectedDifficulty}
              onChange={(e: any) => setSelectedDifficulty(e.target.value)}
              className="px-4 py-3 bg-white text-black border-2 border-black font-mono focus:border-cyan-400 focus:outline-none"
            >
              <option value="all">ALL LEVELS</option>
              <option value="beginner">BEGINNER</option>
              <option value="intermediate">INTERMEDIATE</option>
              <option value="advanced">ADVANCED</option>
            </select>

            <select
              value={selectedType}
              onChange={(e: any) => setSelectedType(e.target.value)}
              className="px-4 py-3 bg-white text-black border-2 border-black font-mono focus:border-cyan-400 focus:outline-none"
            >
              <option value="all">ALL TYPES</option>
              <option value="remote">REMOTE</option>
              <option value="hybrid">HYBRID</option>
              <option value="onsite">ONSITE</option>
            </select>

            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="px-4 py-3 bg-white text-black border-2 border-black font-mono focus:border-cyan-400 focus:outline-none"
            >
              <option value="match">BEST MATCH</option>
              <option value="salary">HIGHEST PAY</option>
              <option value="date">NEWEST FIRST</option>
            </select>
          </div>
        </motion.div>

        {/* Job Matches */}
        <div className="space-y-6">
          <AnimatePresence>
            {filteredJobs.map((job, index) => (
              <JobMatchCard key={job.id} job={job} index={index} />
            ))}
          </AnimatePresence>

          {filteredJobs.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16 border-4 border-dashed border-gray-300"
            >
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="font-black text-2xl mb-2">NO JOBS FOUND</h3>
              <p className="font-mono text-gray-500 mb-4">
                Try adjusting your filters or search terms
              </p>
              <BrutalistButton
                onClick={() => {
                  setSearchTerm("");
                  setSelectedDifficulty("all");
                  setSelectedType("all");
                }}
                icon={<Filter className="w-4 h-4" />}
              >
                CLEAR FILTERS
              </BrutalistButton>
            </motion.div>
          )}
        </div>
      </main>

      {/* Job Details Modal */}
      <AnimatePresence>
        {selectedJob && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedJob(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-4 border-black max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e: any) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="font-black text-2xl mb-2">{selectedJob.title}</h2>
                    <div className="font-mono text-gray-600">{selectedJob.company}</div>
                  </div>
                  <button
                    onClick={() => setSelectedJob(null)}
                    className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-black text-cyan-400 p-4 border-2 border-cyan-400">
                    <div className="font-black text-lg mb-2">MATCH SCORE: {selectedJob.matchScore}%</div>
                    <div className="w-full bg-cyan-900 h-4 rounded-full overflow-hidden">
                      <div 
                        className="bg-cyan-400 h-full transition-all duration-1000"
                        style={{ width: `${selectedJob.matchScore}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-black text-lg mb-2">WHY YOU'RE A GREAT FIT:</h3>
                    <ul className="space-y-1">
                      {selectedJob.matchReasons.map((reason, i) => (
                        <li key={i} className="font-mono text-sm flex items-start gap-2">
                          <span className="text-green-600">✓</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {selectedJob.skillGaps.length > 0 && (
                    <div>
                      <h3 className="font-black text-lg mb-2">SKILLS TO DEVELOP:</h3>
                      <ul className="space-y-1">
                        {selectedJob.skillGaps.map((gap, i) => (
                          <li key={i} className="font-mono text-sm flex items-start gap-2">
                            <span className="text-yellow-600">+</span>
                            <span>{gap}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    <BrutalistButton
                      onClick={() => {
                        setSelectedJob(null);
                        window.location.href = `/learning-paths?job=${selectedJob.id}`;
                      }}
                      variant="primary"
                      icon={<Zap className="w-4 h-4" />}
                    >
                      CREATE LEARNING PATH
                    </BrutalistButton>
                    <BrutalistButton
                      onClick={() => setSelectedJob(null)}
                      variant="secondary"
                    >
                      CLOSE
                    </BrutalistButton>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
