import {
  Sparkles,
  MessageSquare,
  Users,
  UserSquare2,
  Building2,
  Handshake,
  Activity,
  Kanban,
  ListChecks,
  CalendarDays,
  MessagesSquare,
  BarChart3,
  TrendingUp,
  UsersRound,
  LayoutDashboard,
  ShieldCheck,
  ScrollText,
  Settings,
  UploadCloud,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: typeof Sparkles;
  managerOnly?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'AI Workspace',
    items: [
      { label: 'Daily Briefing', to: '/', icon: Sparkles },
      { label: 'AI Assistant', to: '/assistant', icon: MessageSquare },
    ],
  },
  {
    title: 'CRM',
    items: [
      { label: 'Leads', to: '/leads', icon: Users },
      { label: 'Contacts', to: '/contacts', icon: UserSquare2 },
      { label: 'Companies', to: '/companies', icon: Building2 },
      { label: 'Deals', to: '/deals', icon: Handshake },
      { label: 'Activities', to: '/activities', icon: Activity },
    ],
  },
  {
    title: 'Sales',
    items: [
      { label: 'Pipeline', to: '/pipeline', icon: Kanban },
      { label: 'Tasks', to: '/tasks', icon: ListChecks },
      { label: 'Calendar', to: '/calendar', icon: CalendarDays },
      { label: 'Conversations', to: '/conversations', icon: MessagesSquare },
      { label: 'Import Data', to: '/import', icon: UploadCloud },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { label: 'Reports', to: '/reports', icon: BarChart3 },
      { label: 'Forecast', to: '/forecast', icon: TrendingUp },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Team', to: '/team', icon: UsersRound, managerOnly: true },
      { label: 'Manager Dashboard', to: '/manager-dashboard', icon: LayoutDashboard, managerOnly: true },
      { label: 'Approval Center', to: '/approvals', icon: ShieldCheck },
      { label: 'Audit Logs', to: '/audit-logs', icon: ScrollText, managerOnly: true },
    ],
  },
  {
    title: '',
    items: [{ label: 'Settings', to: '/settings', icon: Settings }],
  },
];
