import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { relativeTime, titleCase } from '../lib/format';
import { useApi, errorMessage } from '../lib/hooks';
import { useToast } from '../context/ToastContext';
import { Brand } from './Brand';
import { AdminMfaSetup } from './AdminMfaSetup';
import { Avatar, Badge, Icon, type IconName } from './ui';

type Role = 'professional' | 'employer' | 'admin';

type NavItem = {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  permissions?: string[];
};

type NavGroup = { label?: string; items: NavItem[] };

const NAV: Record<Role, NavGroup[]> = {
  professional: [
    {
      items: [
        { to: '/portal/professional', label: 'Overview', icon: 'grid', end: true },
        { to: '/portal/professional/assignments', label: 'Assignments', icon: 'briefcase' },
        { to: '/portal/professional/assessments', label: 'Assessments', icon: 'award' },
        { to: '/portal/professional/timesheets', label: 'Timesheets', icon: 'clock' }
      ]
    },
    {
      label: 'Career',
      items: [
        { to: '/portal/professional/interviews', label: 'Interviews', icon: 'video' },
        { to: '/portal/professional/finance', label: 'Financial centre', icon: 'wallet' },
        { to: '/portal/professional/career', label: 'Career record', icon: 'trending-up' },
        { to: '/portal/professional/reviews', label: 'Reviews', icon: 'star' }
      ]
    },
    {
      label: 'Account',
      items: [
        { to: '/portal/professional/profile', label: 'Profile & documents', icon: 'user' },
        { to: '/portal/professional/settings', label: 'Security settings', icon: 'settings' }
      ]
    }
  ],
  employer: [
    {
      items: [
        { to: '/portal/employer', label: 'Overview', icon: 'grid', end: true },
        { to: '/portal/employer/requirements', label: 'Requirements', icon: 'file-text' },
        { to: '/portal/employer/talent', label: 'Talent search', icon: 'search' },
        { to: '/portal/employer/shortlist', label: 'Shortlist', icon: 'users' },
        { to: '/portal/employer/interviews', label: 'Interviews', icon: 'video' }
      ]
    },
    {
      label: 'Engagements',
      items: [
        { to: '/portal/employer/assignments', label: 'Assignments', icon: 'briefcase' },
        { to: '/portal/employer/timesheets', label: 'Timesheets', icon: 'clock' },
        { to: '/portal/employer/finance', label: 'Financial centre', icon: 'wallet' },
        { to: '/portal/employer/reviews', label: 'Performance reviews', icon: 'star' }
      ]
    },
    {
      label: 'Account',
      items: [
        { to: '/portal/employer/profile', label: 'Company & documents', icon: 'building' },
        { to: '/portal/employer/settings', label: 'Security settings', icon: 'settings' }
      ]
    }
  ],
  admin: [
    {
      items: [
        { to: '/portal/admin', label: 'Overview', icon: 'grid', end: true, permissions: ['users.view'] },
        { to: '/portal/admin/verifications', label: 'Verifications', icon: 'shield-check', permissions: ['verification.review'] },
        { to: '/portal/admin/assessments', label: 'Assessment review', icon: 'award', permissions: ['verification.review'] },
        { to: '/portal/admin/disputes', label: 'Disputes & reviews', icon: 'scale', permissions: ['disputes.view', 'marketplace.moderate', 'disputes.finance'] }
      ]
    },
    {
      label: 'Finance',
      items: [
        { to: '/portal/admin/finance', label: 'Financial centre', icon: 'wallet', permissions: ['finance.view'] },
        { to: '/portal/admin/reports', label: 'Reports', icon: 'bar-chart', permissions: ['reports.view'] }
      ]
    },
    {
      label: 'Platform',
      items: [
        { to: '/portal/admin/users', label: 'Users', icon: 'users', permissions: ['users.view'] },
        { to: '/portal/admin/settings', label: 'Settings', icon: 'settings', permissions: ['users.view'] },
        { to: '/portal/admin/audit', label: 'Audit log', icon: 'list', permissions: ['users.view'] }
      ]
    }
  ]
};

const ROLE_LABEL: Record<Role, string> = {
  professional: 'Professional',
  employer: 'Employer',
  admin: 'Administrator'
};

const PROFILE_LINK: Record<Role, string> = {
  professional: '/portal/professional/profile',
  employer: '/portal/employer/profile',
  admin: '/portal/admin/settings'
};

function canSee(item: NavItem, permissions: string[]) {
  if (!item.permissions?.length) return true;
  return permissions.includes('*') || item.permissions.some((permission) => permissions.includes(permission));
}

function NotificationBell() {
  const { user, refresh } = useAuth();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const { data, reload } = useApi<{ notifications: any[] }>(
    open && user?.role === 'professional' ? '/professional/notifications' : null
  );

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (user?.role !== 'professional') return null;

  const notifications = data?.notifications || [];
  const unread = notifications.filter((item) => !item.read_at).length;

  const markRead = async (id: string) => {
    try {
      await api(`/professional/notifications/${id}/read`, { method: 'POST' });
      reload();
      await refresh();
    } catch (error) {
      notify(errorMessage(error), 'error');
    }
  };

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button type="button" className="btn btn-secondary btn-icon topbar-bell" onClick={() => setOpen((value) => !value)} aria-label="Notifications">
        <Icon name="bell" />
        {unread > 0 ? <span className="badge">{unread > 9 ? '9+' : unread}</span> : null}
      </button>
      {open ? (
        <div className="notif-panel">
          <div className="notif-head">
            <strong>Notifications</strong>
            <span className="tiny muted">{unread} unread</span>
          </div>
          <div className="notif-list">
            {notifications.length ? (
              notifications.slice(0, 8).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`notif-item ${item.read_at ? '' : 'unread'}`}
                  onClick={() => !item.read_at && markRead(item.id)}
                >
                  <span className="notif-dot" />
                  <span className="grow">
                    <span className="notif-title">{item.title}</span>
                    <span className="notif-body">{item.body}</span>
                    <span className="notif-time">{relativeTime(item.created_at)}</span>
                  </span>
                </button>
              ))
            ) : (
              <div className="notif-empty">You are all caught up.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PortalLayout({ role }: { role: Role }) {
  const { user, adminPermissions, mfaEnrollmentRequired, logout } = useAuth();
  const { notify } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const groups = useMemo(
    () =>
      (NAV[role] || [])
        .map((group) => ({ ...group, items: group.items.filter((item) => canSee(item, adminPermissions)) }))
        .filter((group) => group.items.length > 0),
    [role, adminPermissions]
  );

  const title = useMemo(() => {
    const items = groups.flatMap((group) => group.items);
    const match = [...items]
      .sort((a, b) => b.to.length - a.to.length)
      .find((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)));
    return match?.label || ROLE_LABEL[role];
  }, [groups, location.pathname, role]);

  if (role === 'admin' && mfaEnrollmentRequired) {
    return <AdminMfaSetup />;
  }

  const handleLogout = async () => {
    await logout();
    notify('Signed out.', 'info');
    navigate('/login');
  };

  const roleLabel = role === 'admin' && user?.adminRole ? titleCase(user.adminRole) : ROLE_LABEL[role];

  return (
    <div className="portal">
      <div className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`portal-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="side-brand">
          <Brand to={`/portal/${role}`} inverse tagline={false} />
          <button type="button" className="side-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <Icon name="x" />
          </button>
        </div>
        <div className="side-role">
          <span className="side-role-pill">{roleLabel}</span>
        </div>
        <nav className="side-nav" aria-label="Portal">
          {groups.map((group, index) => (
            <div key={group.label || index}>
              {group.label ? <div className="side-group">{group.label}</div> : null}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <Link to={PROFILE_LINK[role]} className="side-user">
            <Avatar name={user?.name} size="sm" className="avatar-navy" />
            <span className="grow">
              <span className="side-user-name">{user?.name}</span>
              <span className="side-user-role">{roleLabel}</span>
            </span>
          </Link>
          <button type="button" className="side-logout" onClick={handleLogout}>
            <Icon name="logout" className="icon-sm" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="portal-main">
        <div className="demo-banner">
          <Icon name="info" className="icon-sm" />
          <span>Demonstration environment — payments, identity verification and payouts are simulated. No live money moves.</span>
        </div>
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Icon name="menu" />
            </button>
            <span className="topbar-title">{title}</span>
            {user?.isDemo ? <Badge tone="brand">Demo account</Badge> : null}
          </div>
          <div className="topbar-actions">
            <NotificationBell />
            <Link to={PROFILE_LINK[role]} className="btn btn-secondary btn-sm">
              <Avatar name={user?.name} size="sm" />
              <span className="hide-sm">{user?.name?.split(' ')[0]}</span>
            </Link>
          </div>
        </header>
        <main className="portal-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
