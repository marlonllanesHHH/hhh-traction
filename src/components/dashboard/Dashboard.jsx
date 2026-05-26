import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';
import './Dashboard.css';

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    meetings: [],
    pendingTodos: [],
    activeRocks: [],
    openIssues: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [profile]);

  const fetchDashboardData = async () => {
    if (!profile) return;
    try {
      const [meetingsRes, todosRes, rocksRes, issuesRes] = await Promise.all([
        supabase.from('meetings').select('*').eq('is_active', true).order('created_at'),
        supabase.from('todos').select('*, owner:profiles(full_name)').eq('owner_id', profile.id).eq('completed', false).order('due_date'),
        supabase.from('rocks').select('*, owner:profiles(full_name)').eq('owner_id', profile.id).neq('status', 'complete').order('due_date'),
        supabase.from('issues').select('*, owner:profiles(full_name)').eq('owner_id', profile.id).eq('status', 'open').limit(5),
      ]);

      setStats({
        meetings: meetingsRes.data || [],
        pendingTodos: todosRes.data || [],
        activeRocks: rocksRes.data || [],
        openIssues: issuesRes.data || [],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const statusColor = (s) => {
    if (s === 'on_track') return 'green';
    if (s === 'at_risk') return 'yellow';
    return 'red';
  };

  if (loading) return (
    <div className="dashboard-loading">
      <div className="loading-spinner" />
    </div>
  );

  return (
    <div className="dashboard fade-in">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>{greeting()}, {profile?.full_name?.split(' ')[0] || 'there'}</h1>
          <p>Here's what's happening at Historic Hampton House today.</p>
        </div>
        <div className="dashboard-date">
          <span className="date-label">Today</span>
          <span className="date-value">{format(new Date(), 'EEEE, MMMM d')}</span>
        </div>
      </div>

      {/* Quick links */}
      <div className="quick-modules">
        {MODULES.map(m => (
          <Link key={m.path} to={m.path} className="module-card">
            <div className="module-icon" style={{ background: m.color }}>
              <m.Icon />
            </div>
            <div>
              <div className="module-name">{m.name}</div>
              <div className="module-desc">{m.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Grid */}
      <div className="dashboard-grid">
        {/* Meetings */}
        <div className="card dash-card">
          <div className="dash-card-header">
            <h3>Your Meetings</h3>
            <Link to="/meetings" className="see-all">View all →</Link>
          </div>
          {stats.meetings.length === 0 ? (
            <div className="empty-state">
              <p>No meetings yet</p>
            </div>
          ) : (
            <div className="meeting-list">
              {stats.meetings.slice(0, 3).map(m => (
                <Link key={m.id} to={`/meetings/${m.id}`} className="meeting-row">
                  <div className="meeting-icon-wrap">
                    <CalIcon />
                  </div>
                  <div>
                    <div className="meeting-row-name">{m.name}</div>
                    <div className="meeting-row-meta">{m.duration_minutes} min · {m.cadence}</div>
                  </div>
                  <span className="badge badge-gray meeting-type">{m.meeting_type?.toUpperCase()}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Pending To-Dos */}
        <div className="card dash-card">
          <div className="dash-card-header">
            <h3>Pending To-Dos</h3>
            <span className="count-badge">{stats.pendingTodos.length}</span>
          </div>
          {stats.pendingTodos.length === 0 ? (
            <div className="empty-state"><p>All caught up! 🎉</p></div>
          ) : (
            <div className="todo-list">
              {stats.pendingTodos.slice(0, 5).map(todo => {
                const overdue = todo.due_date && new Date(todo.due_date) < new Date();
                return (
                  <div key={todo.id} className="todo-row">
                    <div className="todo-check" />
                    <div className="todo-info">
                      <span className="todo-title">{todo.title}</span>
                      {todo.due_date && (
                        <span className={`todo-due ${overdue ? 'overdue' : ''}`}>
                          Due: {format(new Date(todo.due_date), 'M/d/yy')}
                          {overdue ? ' (Overdue)' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Rocks */}
        <div className="card dash-card">
          <div className="dash-card-header">
            <h3>Active Rocks</h3>
            <Link to="/meetings" className="see-all">View all →</Link>
          </div>
          {stats.activeRocks.length === 0 ? (
            <div className="empty-state"><p>No active rocks</p></div>
          ) : (
            <div className="rock-list">
              {stats.activeRocks.slice(0, 4).map(rock => (
                <div key={rock.id} className="rock-row">
                  <div className={`status-dot ${rock.status?.replace('_', '-')}`} style={{marginTop: 2}} />
                  <div className="rock-info">
                    <span className="rock-title">{rock.title}</span>
                    <span className="rock-due">Due: {format(new Date(rock.due_date), 'M/d/yy')}</span>
                  </div>
                  <span className={`badge badge-${statusColor(rock.status)}`}>
                    {rock.status?.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Open Issues */}
        <div className="card dash-card">
          <div className="dash-card-header">
            <h3>Your Unsolved Issues</h3>
            <span className="count-badge">{stats.openIssues.length}</span>
          </div>
          {stats.openIssues.length === 0 ? (
            <div className="empty-state"><p>No open issues</p></div>
          ) : (
            <div className="issue-list">
              {stats.openIssues.map(issue => (
                <div key={issue.id} className="issue-row">
                  <IssueIcon />
                  <span className="issue-title">{issue.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const MODULES = [
  { name: 'L10 Meetings', desc: 'Run structured meetings', path: '/meetings', color: 'var(--teal)', Icon: CalIcon },
  { name: 'Accountability', desc: 'Visual org structure', path: '/accountability', color: '#7c3aed', Icon: OrgIcon },
  { name: 'Vision / Traction', desc: 'Strategic planning', path: '/vision', color: 'var(--coral)', Icon: VisionIcon },
  { name: 'Performance Evals', desc: 'Team evaluations', path: '/evaluations', color: '#0891b2', Icon: EvalIcon },
];

function CalIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
}
function OrgIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
}
function VisionIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>;
}
function EvalIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
}
function IssueIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14,color:'var(--coral)',flexShrink:0}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
}
