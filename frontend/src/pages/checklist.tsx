import { useState, useEffect } from 'react';

interface Task {
  text: string;
  completed: boolean;
  children?: Task[];
}

export default function ChecklistPage() {
  const [checklist, setChecklist] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For now, load a static checklist since Tauri filesystem calls need to be in the Tauri context
    const tasks: Task[] = [
      { text: 'Set up project infrastructure', completed: true },
      { text: 'Create database models and CRUD operations', completed: true },
      { text: 'Build basic UI components', completed: true },
      { text: 'Implement application tracker backend', completed: true },
      { text: 'Add scraper dependencies (playwright, mockito)', completed: true },
      { text: 'Create test fixtures for scrapers', completed: true },
      { text: 'Fix hh.kz scraper implementation', completed: true },
      { text: 'Fix wellfound scraper implementation', completed: true },
      { text: 'Fix linkedin scraper implementation', completed: true },
      { text: 'Integrate scrapers with frontend', completed: true },
      { text: 'Add error handling and rate limiting', completed: true },
      { text: 'Add background job scheduling', completed: false },
    ];
    setChecklist(tasks);
    setLoading(false);
  }, []);

  const toggleTask = (index: number) => {
    setChecklist(prevChecklist => {
      const newChecklist = [...prevChecklist];
      const task = newChecklist[index];
      if (task) {
      newChecklist[index] = {
          ...task,
          completed: !task.completed
      };
      }
      return newChecklist;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Development Checklist</h1>
      <div className="space-y-4">
        {checklist.map((task, index) => (
          <div key={index} className="flex items-start">
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => toggleTask(index)}
              className="mt-1 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span
              className={`ml-3 ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}
            >
              {task.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
