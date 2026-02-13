import type { ElementType } from 'react'
import {
  LayoutDashboard,
  Briefcase,
  BookmarkCheck,
  Settings,
  Bot,
} from 'lucide-react'

export interface NavItem {
  name: string
  href: string
  icon: ElementType
  search?: string
  hash?: string
  subItems?: {
    name: string
    href: string
  }[]
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
  },
  {
    name: 'Applications',
    href: '/applications',
    icon: BookmarkCheck,
  },
  {
    name: 'Auto-Pilot',
    href: '/autopilot',
    icon: Bot,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]


