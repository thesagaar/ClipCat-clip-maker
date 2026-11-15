import { NavLink } from 'react-router-dom';
import { Film, FolderKanban, Home, Plus, Settings } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Fixed mobile bottom navigation bar for screens below 640px (sm:hidden).
 * Provides touch-friendly access to the five primary destinations with an
 * elevated, prominent deep-purple Create button and safe-area inset padding.
 */
export function MobileBottomNav() {
  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-ios-surface/95 backdrop-blur-md border-t border-ios-sep pb-safe shadow-[0_-8px_24px_rgba(0,0,0,0.28)]"
    >
      <div className="grid grid-cols-5 items-end h-16 px-1.5 pb-1.5">
        <NavLink
          to="/"
          end
          aria-label="Home"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 min-h-[48px] min-w-[44px] rounded-xl text-[11px] font-medium transition-all active:scale-95',
              isActive
                ? 'text-ios-blue font-semibold'
                : 'text-ios-secondary hover:text-ios-label'
            )
          }
        >
          <Home className="w-5 h-5" aria-hidden="true" />
          <span>Home</span>
        </NavLink>

        <NavLink
          to="/projects"
          end
          aria-label="Projects"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 min-h-[48px] min-w-[44px] rounded-xl text-[11px] font-medium transition-all active:scale-95',
              isActive
                ? 'text-ios-blue font-semibold'
                : 'text-ios-secondary hover:text-ios-label'
            )
          }
        >
          <FolderKanban className="w-5 h-5" aria-hidden="true" />
          <span>Projects</span>
        </NavLink>

        <NavLink
          to="/projects/new"
          aria-label="Create New Project"
          className="flex flex-col items-center justify-center gap-1 min-h-[56px] min-w-[48px] transition-transform active:scale-95"
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  'w-12 h-12 -mt-5 rounded-full flex items-center justify-center text-white shadow-lg border-[3px] border-ios-surface transition-all',
                  isActive
                    ? 'bg-[#6E6BFF] ring-2 ring-[#AF52DE]/60 shadow-[#5856D6]/40'
                    : 'bg-[#5856D6] hover:bg-[#6E6BFF] shadow-[#5856D6]/30'
                )}
              >
                <Plus className="w-6 h-6 stroke-[2.5]" aria-hidden="true" />
              </span>
              <span
                className={cn(
                  'text-[11px] font-bold leading-none',
                  isActive ? 'text-[#AF52DE]' : 'text-ios-label'
                )}
              >
                Create
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/clips"
          end
          aria-label="Clips"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 min-h-[48px] min-w-[44px] rounded-xl text-[11px] font-medium transition-all active:scale-95',
              isActive
                ? 'text-ios-blue font-semibold'
                : 'text-ios-secondary hover:text-ios-label'
            )
          }
        >
          <Film className="w-5 h-5" aria-hidden="true" />
          <span>Clips</span>
        </NavLink>

        <NavLink
          to="/settings"
          aria-label="Settings"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 min-h-[48px] min-w-[44px] rounded-xl text-[11px] font-medium transition-all active:scale-95',
              isActive
                ? 'text-ios-blue font-semibold'
                : 'text-ios-secondary hover:text-ios-label'
            )
          }
        >
          <Settings className="w-5 h-5" aria-hidden="true" />
          <span>Settings</span>
        </NavLink>
      </div>
    </nav>
  );
}
