import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { navigation, type NavItem } from './nav-config';

const NavigationItem = ({ item }: { item: NavItem }) => {
  const location = useLocation();
  const Icon = item.icon;
  const matchesRoute =
    location.pathname === item.href &&
    (item.search ? location.search === item.search : true) &&
    (item.hash ? location.hash === item.hash : true);
  const baseClass =
    'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 w-full';
  const iconClass = 'h-4 w-4 mr-3 flex-shrink-0';
  const textClass = 'text-sm font-medium leading-normal';

  const to = item.search || item.hash
    ? { pathname: item.href, search: item.search, hash: item.hash }
    : item.href;

  return (
    <NavLink
      to={to}
      end
      className={() =>
        cn(
          baseClass,
          matchesRoute
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-sm'
        )
      }
    >
      <Icon className={iconClass} />
      <span className={textClass}>{item.name}</span>
    </NavLink>
  );
};

export function MainNav() {
  return (
    <nav className="space-y-1">
      {navigation.map((item) => (
        <NavigationItem key={`${item.href}${item.search ?? ''}${item.hash ?? ''}`} item={item} />
      ))}
    </nav>
  );
}
