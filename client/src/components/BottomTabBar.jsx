import { SignalIcon, BoltIcon, HomeIcon, ClipboardDocumentListIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';

const tabs = [
  { id: 'dashboard', label: 'Dashboard', Icon: SignalIcon },
  { id: 'storm-map', label: 'Map', Icon: BoltIcon },
  { id: 'pipeline', label: 'Pipeline', Icon: HomeIcon },
  { id: 'tasks', label: 'Tasks', Icon: ClipboardDocumentListIcon },
  { id: 'settings', label: 'Settings', Icon: Cog6ToothIcon },
];

const ACTIVE_COLOR = '#00e5ff';
const INACTIVE_COLOR = 'var(--text-muted, oklch(0.55 0.01 260))';

export default function BottomTabBar({ activeView, onNavigate }) {
  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      alignItems: 'center',
      justifyContent: 'space-evenly',
      background: 'rgba(13, 19, 33, 0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: '16px 16px 0 0',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
      padding: '10px 16px',
      paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
    }} className="bottom-tab-bar">
      {tabs.map((tab) => {
        const active = activeView === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-current={active ? 'page' : undefined}
          >
            <tab.Icon
              width={40}
              height={40}
              style={{
                transition: 'opacity 0.2s, filter 0.2s',
                opacity: active ? 1 : 0.35,
                color: active ? ACTIVE_COLOR : INACTIVE_COLOR,
              }}
            />
            <span style={{
              fontSize: 9,
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              lineHeight: 1,
              color: active ? ACTIVE_COLOR : INACTIVE_COLOR,
            }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
