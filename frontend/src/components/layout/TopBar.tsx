import { MagicWandIcon } from '@radix-ui/react-icons'
import { NavLink } from 'react-router-dom'
import { useChatStore } from '../../store/chatStore'

export default function TopBar() {
  const drawerOpened = useChatStore((state) => state.drawerOpened)
  const toggleDrawer = useChatStore((state) => state.toggleDrawer)

  return (
    <header className="fixed left-0 right-0 top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur">
      <div className="flex w-full items-center gap-4 px-6 py-4 text-white">
        <button
          type="button"
          onClick={toggleDrawer}
          aria-pressed={drawerOpened}
          aria-label="Toggle chat drawer"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)] hover:bg-white/10"
        >
          <span className="sr-only">Open chat</span>
          <MagicWandIcon className="h-6 w-6 text-indigo-200" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">Georisk AI APAC</h1>
          <p className="text-sm text-slate-300">
            Regional risk overview with 3D context.
          </p>
        </div>
        <nav className="flex items-center gap-2">
          <NavLink
            to="/risk"
            className={({ isActive }) =>
              `rounded-full border px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                  : 'border-white/15 bg-white/5 text-white hover:bg-white/10'
              }`
            }
          >
            Risk
          </NavLink>
          <NavLink
            to="/price"
            className={({ isActive }) =>
              `rounded-full border px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? 'border-amber-300/70 bg-amber-400/20 text-amber-100'
                  : 'border-white/15 bg-white/5 text-white hover:bg-white/10'
              }`
            }
          >
            Price
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
