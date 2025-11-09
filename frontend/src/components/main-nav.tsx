import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard,
  Briefcase,
  FileText,
  Settings,
  ListChecks,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';

export interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  subItems?: Array<{ name: string; href: string }>;
}

export const navigation: NavItem[] = [
  { 
    name: 'Dashboard', 
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  { 
    name: 'Jobs', 
    href: '/jobs',
    icon: Briefcase,
    subItems: [
      { name: 'All Jobs', href: '/jobs' },
      { name: 'Saved Jobs', href: '/jobs/saved' },
      { name: 'Archived', href: '/jobs/archived' },
    ]
  },
  { 
    name: 'Applications', 
    href: '/applications',
    icon: FileText,
    subItems: [
      { name: 'All Applications', href: '/applications' },
      { name: 'In Progress', href: '/applications/in-progress' },
      { name: 'Interviews', href: '/applications/interviews' },
      { name: 'Offers', href: '/applications/offers' },
    ]
  },
  { 
    name: 'Checklist', 
    href: '/checklist',
    icon: ListChecks,
  },
  { 
    name: 'Settings', 
    href: '/settings',
    icon: Settings,
  },
];

const NavItem = ({ item }: { item: NavItem }) => {
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const Icon = item.icon;
  const hasSubItems = item.subItems && item.subItems.length > 0;
  const isActive = location.pathname === item.href || 
    (item.subItems?.some(subItem => location.pathname === subItem.href) ?? false);
  const isOpen = isClicked || (isHovered && !isClicked);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsClicked(false);
      }
    }
    
    document.addEventListener('mousemove', handleClickOutside);
    return () => document.removeEventListener('mousemove', handleClickOutside);
  }, []);

  // Close menu when navigating
  useEffect(() => {
    setIsClicked(false);
  }, [location.pathname]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsClicked(!isClicked);
  };

  // Unhireable design: Bold, edgy styling with cyan/purple accents
  const baseClass = 'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-150 w-full border-2';
  const iconClass = 'h-4 w-4 mr-3 flex-shrink-0';
  const textClass = 'text-sm font-medium leading-normal';
  
  if (!hasSubItems) {
    return (
      <NavLink
        to={item.href}
        className={({ isActive: active }) =>
          cn(
            baseClass,
            active 
              ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white' 
              : 'bg-white text-black border-black hover:bg-cyan-400 hover:text-black dark:bg-black dark:text-white dark:border-white dark:hover:bg-purple-500 dark:hover:text-white'
          )
        }
      >
        <Icon className={iconClass} />
        <span className={textClass}>{item.name}</span>
      </NavLink>
    );
  }

  return (
    <div 
      ref={menuRef}
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={toggleMenu}
        className={cn(
          baseClass,
          'justify-between text-left',
          (isActive || isOpen) 
            ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white' 
            : 'bg-white text-black border-black hover:bg-cyan-400 hover:text-black dark:bg-black dark:text-white dark:border-white dark:hover:bg-purple-500 dark:hover:text-white'
        )}
      >
        <div className="flex items-center min-w-0 flex-1">
          <Icon className={iconClass} />
          <span className={textClass}>{item.name}</span>
        </div>
        <ChevronDown 
          className={cn(
            'h-3.5 w-3.5 transition-transform duration-150 flex-shrink-0 ml-2',
            isOpen ? 'rotate-180' : ''
          )} 
        />
      </button>
      
      {isOpen && (
        <div 
          className="absolute left-0 top-full mt-1 w-full rounded-md shadow-lg bg-white border-2 border-black z-50 ml-3 dark:bg-black dark:border-white"
        >
          <div className="py-1">
            {item.subItems?.map((subItem) => (
              <NavLink
                key={subItem.href}
                to={subItem.href}
                className={({ isActive: active }) =>
                  cn(
                    'block px-3 py-2 text-sm font-medium transition-colors border-b-2 border-transparent hover:border-cyan-400 dark:hover:border-purple-500',
                    active 
                      ? 'bg-cyan-400 text-black dark:bg-purple-500 dark:text-white' 
                      : 'text-black hover:bg-cyan-400/20 dark:text-white dark:hover:bg-purple-500/20'
                  )
                }
              >
                {subItem.name}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export function MainNav() {
  return (
    <nav className="space-y-2">
      {navigation.map((item) => (
        <NavItem key={item.href} item={item} />
      ))}
    </nav>
  );
}
