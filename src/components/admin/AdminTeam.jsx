import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';
import './Admin.css';

export default function AdminTeam() {
  const { profile: currentProfile, isAdmin } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editProfile, setEditProfile] = useState(null);

  useEffect(() => { fetchProfiles(); }, []);

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    setProfiles(data || []);
    setLoading(false);
  };

  const updateRole = async (userId, role) => {
    await supabase.from('profiles').update({ role }).eq('id', userId);
    fetchProfiles();
  };

  if (!isAdmin) return (
    <div className="card empty-state" style={{marginTop: 40}}>
      <LockIcon />
      <h3>Admin Access Required</h3>
      <p>You don't have permission to view this page.</p>
    </div>
  );

  return (
    <div className="admin-page fade-in">
      <div className="page-header">
        <div>
          <h1>Team Management</h1>
          <p>Manage team members and permissions</p>
        </div>
      </div>

      <div className="card">
        <div className="admin-card-header">
          <h3>Team Members</h3>
          <span className="badge badge-teal">{profiles.length} members</span>
        </div>

        {loading ? (
          <div className="loading-spinner" style={{margin:'40px auto'}} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div className="member-cell">
                        <div className="member-avatar">
                          {p.full_name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="member-name">{p.full_name || 'Unknown'}</div>
                          {p.title && <div className="member-title">{p.title}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{color:'var(--gray-500)',fontSize:'0.875rem'}}>{p.email}</td>
                    <td>
                      <select
                        className={`role-select ${p.role}`}
                        value={p.role || 'member'}
                        onChange={e => updateRole(p.id, e.target.value)}
                        disabled={p.id === currentProfile?.id}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td style={{color:'var(--gray-500)',fontSize:'0.875rem'}}>{p.department || '—'}</td>
                    <td style={{color:'var(--gray-400)',fontSize:'0.8125rem'}}>
                      {p.created_at ? format(new Date(p.created_at), 'M/d/yyyy') : '—'}
                    </td>
                    <td>
                      <button className="btn btn-ghost" style={{padding:'6px 10px',fontSize:'0.8125rem'}} onClick={() => setEditProfile(p)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card info-card" style={{marginTop: 20}}>
        <div className="info-icon">ℹ️</div>
        <div>
          <strong>Google OAuth Restriction</strong>
          <p>Only <code>@historichamptonhouse.org</code> email accounts can sign in. New users are automatically added as Members when they first log in.</p>
        </div>
      </div>

      {editProfile && (
        <EditProfileModal
          profile={editProfile}
          onClose={() => setEditProfile(null)}
          onSaved={() => { setEditProfile(null); fetchProfiles(); }}
        />
      )}
    </div>
  );
}

function EditProfileModal({ profile, onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: profile.full_name || '',
    title: profile.title || '',
    department: profile.department || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await supabase.from('profiles').update(form).eq('id', profile.id);
    setLoading(false);
    onSaved();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Profile</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Job Title</label>
            <input className="form-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g., Executive Director..." />
          </div>
          <div className="form-group">
            <label className="form-label">Department</label>
            <input className="form-input" value={form.department} onChange={e => setForm({...form, department: e.target.value})} placeholder="e.g., Marketing, Operations..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LockIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:40,height:40}}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>; }
