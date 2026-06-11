import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';
import './Meetings.css';

export default function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { fetchMeetings(); }, []);

  const fetchMeetings = async () => {
    const { data } = await supabase
      .from('meetings')
      .select('*, attendees:meeting_attendees(count)')
      .eq('is_active', true)
      .order('created_at');
    setMeetings(data || []);
    setLoading(false);
  };

  const deleteMeeting = async (id) => {
    await supabase.from('meetings').delete().eq('id', id);
    setConfirmDelete(null);
    fetchMeetings();
  };

  return (
    <div className="meetings-page fade-in">
      <div className="page-header">
        <div>
          <h1>L10 Meetings</h1>
          <p>Run structured Level-10 Meetings with live collaboration</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <PlusIcon /> New Meeting
        </button>
      </div>

      {loading ? (
        <div className="meetings-loading"><div className="loading-spinner" /></div>
      ) : meetings.length === 0 ? (
        <div className="card empty-state">
          <CalIcon />
          <h3>No meetings yet</h3>
          <p>Create your first L10 Meeting to get started</p>
          <button className="btn btn-primary" style={{marginTop:16}} onClick={() => setShowCreate(true)}>
            Create Meeting
          </button>
        </div>
      ) : (
        <div className="meetings-grid">
          {meetings.map(m => (
            <div key={m.id} className="meeting-card card">
              {/* Delete button top right — stops propagation so card click doesn't fire */}
              <button
                className="meeting-delete-btn"
                onClick={e => { e.stopPropagation(); setConfirmDelete(m); }}
                title="Delete meeting"
              >
                <TrashIcon />
              </button>

              {/* Card body navigates to meeting */}
              <div onClick={() => navigate(`/meetings/${m.id}`)}>
                <div className="meeting-card-header">
                  <div className="meeting-card-icon"><CalIcon /></div>
                  <span className={`badge badge-${m.status === 'in_session' ? 'green' : 'gray'}`}>
                    {m.status === 'in_session' ? '● Live' : 'Not In Session'}
                  </span>
                </div>
                <h3 className="meeting-card-name">{m.name}</h3>
                <p className="meeting-card-meta">
                  Created {format(new Date(m.created_at), 'M/d/yyyy')}
                </p>
                <div className="meeting-card-footer">
                  <span><PersonIcon /> {m.attendees?.[0]?.count || 0} attendees</span>
                  <span><TimeIcon /> {m.duration_minutes} min</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" style={{maxWidth:400}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Meeting</h3>
              <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{fontSize:'0.9375rem',color:'var(--gray-700)',lineHeight:1.6}}>
                Are you sure you want to delete <strong>{confirmDelete.name}</strong>? This will also delete all sessions, scorecard data, rocks, todos, and issues associated with this meeting.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => deleteMeeting(confirmDelete.id)}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateMeetingModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchMeetings(); }}
          createdBy={profile?.id}
        />
      )}
    </div>
  );
}

function CreateMeetingModal({ onClose, onCreated, createdBy }) {
  const [form, setForm] = useState({
    name: '',
    meeting_type: 'l10',
    duration_minutes: 90,
    cadence: 'weekly',
    description: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('meetings').insert({ ...form, created_by: createdBy });
    setLoading(false);
    if (!error) onCreated();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create New Meeting</h3>
          <button className="btn-ghost" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Meeting Name *</label>
            <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g., Leadership L10, Marketing Team..." />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={form.meeting_type} onChange={e => setForm({...form, meeting_type: e.target.value})}>
              <option value="l10">L10 Meeting</option>
              <option value="department">Department Meeting</option>
              <option value="leadership">Leadership Meeting</option>
            </select>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="form-group">
              <label className="form-label">Duration (minutes)</label>
              <input className="form-input" type="number" value={form.duration_minutes} onChange={e => setForm({...form, duration_minutes: parseInt(e.target.value)})} />
            </div>
            <div className="form-group">
              <label className="form-label">Cadence</label>
              <select className="form-select" value={form.cadence} onChange={e => setForm({...form, cadence: e.target.value})}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Optional description..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Meeting'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlusIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function CalIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
function PersonIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>; }
function TimeIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function CloseIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function TrashIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>; }
