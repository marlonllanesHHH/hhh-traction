import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';
import './Admin.css';

export default function AdminTeam() {
  const { profile: currentProfile, isAdmin } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [attendees, setAttendees] = useState({});
  const [loading, setLoading] = useState(true);
  const [editProfile, setEditProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('members');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [profilesRes, meetingsRes, attendeesRes] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('meetings').select('*').eq('is_active', true).order('name'),
      supabase.from('meeting_attendees').select('*, profile:profiles(id, full_name, title)'),
    ]);
    setProfiles(profilesRes.data || []);
    setMeetings(meetingsRes.data || []);

    // Group attendees by meeting
    const map = {};
    (attendeesRes.data || []).forEach(a => {
      if (!map[a.meeting_id]) map[a.meeting_id] = [];
      map[a.meeting_id].push(a);
    });
    setAttendees(map);
    setLoading(false);
  };

  const updateRole = async (userId, role) => {
    await supabase.from('profiles').update({ role }).eq('id', userId);
    fetchAll();
  };

  const addToMeeting = async (meetingId, userId) => {
    await supabase.from('meeting_attendees').insert({ meeting_id: meetingId, user_id: userId });
    fetchAll();
  };

  const removeFromMeeting = async (meetingId, userId) => {
    await supabase.from('meeting_attendees').delete()
      .eq('meeting_id', meetingId).eq('user_id', userId);
    fetchAll();
  };

  const toggleFacilitator = async (meetingId, userId, current) => {
    await supabase.from('meeting_attendees')
      .update({ is_facilitator: !current })
      .eq('meeting_id', meetingId).eq('user_id', userId);
    fetchAll();
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
          <p>Manage team members, roles, and meeting assignments</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')}>
          Team Members
        </button>
        <button className={`tab-btn ${activeTab === 'meetings' ? 'active' : ''}`} onClick={() => setActiveTab('meetings')}>
          Meeting Assignments
        </button>
      </div>

      {loading ? <div className="loading-spinner" style={{margin:'40px auto'}} /> : (
        <>
          {/* MEMBERS TAB */}
          {activeTab === 'members' && (
            <>
              <div className="card">
                <div className="admin-card-header">
                  <h3>Team Members</h3>
                  <span className="badge badge-teal">{profiles.length} members</span>
                </div>
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
              </div>

              <div className="card info-card" style={{marginTop: 20}}>
                <div className="info-icon">ℹ️</div>
                <div>
                  <strong>Google OAuth Restriction</strong>
                  <p>Only <code>@historichamptonhouse.org</code> email accounts can sign in. New users are automatically added as Members when they first log in.</p>
                </div>
              </div>
            </>
          )}

          {/* MEETING ASSIGNMENTS TAB */}
          {activeTab === 'meetings' && (
            <div className="meetings-assign-grid">
              {meetings.length === 0 ? (
                <div className="card empty-state">
                  <h3>No meetings yet</h3>
                  <p>Create a meeting first from the L10 Meetings page.</p>
                </div>
              ) : meetings.map(meeting => {
                const meetingAttendees = attendees[meeting.id] || [];
                const assignedIds = meetingAttendees.map(a => a.user_id);
                const unassigned = profiles.filter(p => !assignedIds.includes(p.id));

                return (
                  <div className="card meeting-assign-card" key={meeting.id}>
                    <div className="meeting-assign-header">
                      <div className="meeting-assign-icon">
                        <MeetingIcon />
                      </div>
                      <div>
                        <div className="meeting-assign-name">{meeting.name}</div>
                        <div className="meeting-assign-meta">{meeting.duration_minutes} min · {meetingAttendees.length} members</div>
                      </div>
                    </div>

                    {/* Assigned members */}
                    <div className="assign-section-label">Assigned</div>
                    {meetingAttendees.length === 0 ? (
                      <p className="assign-empty">No members assigned yet</p>
                    ) : (
                      <div className="assign-list">
                        {meetingAttendees.map(a => (
                          <div className="assign-row" key={a.user_id}>
                            <div className="assign-avatar">
                              {a.profile?.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() || '?'}
                            </div>
                            <div className="assign-info">
                              <span className="assign-name">{a.profile?.full_name || 'Unknown'}</span>
                              {a.profile?.title && <span className="assign-title">{a.profile.title}</span>}
                            </div>
                            <div className="assign-actions">
                              <button
                                className={`facilitator-btn ${a.is_facilitator ? 'active' : ''}`}
                                onClick={() => toggleFacilitator(meeting.id, a.user_id, a.is_facilitator)}
                                title={a.is_facilitator ? 'Remove facilitator' : 'Make facilitator'}
                              >
                                {a.is_facilitator ? '⭐ Facilitator' : 'Make Facilitator'}
                              </button>
                              <button
                                className="remove-btn"
                                onClick={() => removeFromMeeting(meeting.id, a.user_id)}
                                title="Remove from meeting"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add members */}
                    {unassigned.length > 0 && (
                      <>
                        <div className="assign-section-label" style={{marginTop:16}}>Add Member</div>
                        <select
                          className="form-select assign-select"
                          defaultValue=""
                          onChange={e => {
                            if (e.target.value) {
                              addToMeeting(meeting.id, e.target.value);
                              e.target.value = '';
                            }
                          }}
                        >
                          <option value="" disabled>Select member to add...</option>
                          {unassigned.map(p => (
                            <option key={p.id} value={p.id}>{p.full_name}{p.title ? ` — ${p.title}` : ''}</option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {editProfile && (
        <EditProfileModal
          profile={editProfile}
          onClose={() => setEditProfile(null)}
          onSaved={() => { setEditProfile(null); fetchAll(); }}
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

function LockIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:40,height:40}}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>; }
function MeetingIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
