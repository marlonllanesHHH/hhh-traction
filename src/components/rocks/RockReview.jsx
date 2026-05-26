import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';
import './RockReview.css';

const STATUS_OPTIONS = [
  { value: 'on_track', label: 'On Track', color: 'green' },
  { value: 'at_risk', label: 'At Risk', color: 'yellow' },
  { value: 'off_track', label: 'Off Track', color: 'red' },
  { value: 'complete', label: 'Complete', color: 'teal' },
];

export default function RockReview({ meetingId }) {
  const { profile } = useAuth();
  const [rocks, setRocks] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editRock, setEditRock] = useState(null);
  const [milestones, setMilestones] = useState({});

  useEffect(() => { fetchData(); }, [meetingId]);

  const fetchData = async () => {
    const [rocksRes, profilesRes, milestonesRes] = await Promise.all([
      supabase.from('rocks').select('*, owner:profiles(full_name,id)').eq('meeting_id', meetingId).order('created_at'),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('rock_milestones').select('*').order('sort_order'),
    ]);

    const milestonesMap = {};
    (milestonesRes.data || []).forEach(m => {
      if (!milestonesMap[m.rock_id]) milestonesMap[m.rock_id] = [];
      milestonesMap[m.rock_id].push(m);
    });

    setRocks(rocksRes.data || []);
    setProfiles(profilesRes.data || []);
    setMilestones(milestonesMap);
    setLoading(false);
  };

  const updateStatus = async (rockId, status) => {
    await supabase.from('rocks').update({ status }).eq('id', rockId);
    fetchData();
  };

  const toggleMilestone = async (milestone) => {
    await supabase.from('rock_milestones').update({
      completed: !milestone.completed,
      completed_at: !milestone.completed ? new Date().toISOString() : null,
    }).eq('id', milestone.id);
    fetchData();
  };

  // Group by owner
  const byOwner = rocks.reduce((acc, r) => {
    const key = r.owner?.id || 'unassigned';
    const name = r.owner?.full_name || 'Unassigned';
    if (!acc[key]) acc[key] = { name, rocks: [] };
    acc[key].rocks.push(r);
    return acc;
  }, {});

  if (loading) return <div className="loading-spinner" style={{margin:'40px auto'}} />;

  return (
    <div className="rock-review">
      <div className="rock-toolbar">
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Rock</button>
      </div>

      {rocks.length === 0 ? (
        <div className="empty-state">
          <RockIcon />
          <h3>No rocks this quarter</h3>
          <p>Add your first quarterly rock to get started</p>
        </div>
      ) : (
        Object.values(byOwner).map(({ name, rocks: ownerRocks }) => (
          <div key={name} className="rock-owner-group">
            <div className="rock-owner-header">
              <PersonIcon />
              <span>{name}</span>
              <span className="rock-count">{ownerRocks.length}</span>
            </div>
            <div className="rock-list-items">
              {ownerRocks.map(rock => {
                const rockMilestones = milestones[rock.id] || [];
                const completed = rockMilestones.filter(m => m.completed).length;
                return (
                  <div key={rock.id} className="rock-item card">
                    <div className="rock-item-header">
                      <div className="rock-item-title">
                        <span className="rock-item-name">{rock.title}</span>
                        {rock.description && <p className="rock-item-desc">{rock.description}</p>}
                        {rock.due_date && (
                          <span className="rock-item-due">Due: {format(new Date(rock.due_date), 'M/d/yy')}</span>
                        )}
                        {rockMilestones.length > 0 && (
                          <div className="milestone-progress">
                            <div className="milestone-dots">
                              {rockMilestones.map(m => (
                                <button
                                  key={m.id}
                                  className={`milestone-dot ${m.completed ? 'done' : ''}`}
                                  onClick={() => toggleMilestone(m)}
                                  title={m.title}
                                />
                              ))}
                            </div>
                            <span className="milestone-count">{completed}/{rockMilestones.length}</span>
                          </div>
                        )}
                      </div>
                      <div className="rock-item-actions">
                        <select
                          className={`status-select status-${rock.status}`}
                          value={rock.status}
                          onChange={e => updateStatus(rock.id, e.target.value)}
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                        <button className="btn-ghost icon-btn" onClick={() => setEditRock(rock)}>
                          <EditIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {(showAdd || editRock) && (
        <RockModal
          rock={editRock}
          meetingId={meetingId}
          profiles={profiles}
          currentUserId={profile?.id}
          onClose={() => { setShowAdd(false); setEditRock(null); }}
          onSaved={() => { setShowAdd(false); setEditRock(null); fetchData(); }}
        />
      )}
    </div>
  );
}

function RockModal({ rock, meetingId, profiles, currentUserId, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: rock?.title || '',
    description: rock?.description || '',
    owner_id: rock?.owner?.id || currentUserId,
    due_date: rock?.due_date || '',
    is_company_rock: rock?.is_company_rock || false,
  });
  const [milestones, setMilestones] = useState([]);
  const [newMilestone, setNewMilestone] = useState({ title: '', due_date: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (rock?.id) {
      supabase.from('rock_milestones').select('*').eq('rock_id', rock.id).order('sort_order')
        .then(({ data }) => setMilestones(data || []));
    }
  }, [rock]);

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setLoading(true);
    if (rock) {
      await supabase.from('rocks').update(form).eq('id', rock.id);
    } else {
      await supabase.from('rocks').insert({ ...form, meeting_id: meetingId });
    }
    setLoading(false);
    onSaved();
  };

  const addMilestone = async () => {
    if (!newMilestone.title || !rock?.id) return;
    await supabase.from('rock_milestones').insert({
      rock_id: rock.id,
      title: newMilestone.title,
      due_date: newMilestone.due_date || null,
      sort_order: milestones.length,
    });
    setNewMilestone({ title: '', due_date: '' });
    const { data } = await supabase.from('rock_milestones').select('*').eq('rock_id', rock.id).order('sort_order');
    setMilestones(data || []);
  };

  const handleDelete = async () => {
    if (window.confirm('Delete this rock?')) {
      await supabase.from('rocks').delete().eq('id', rock.id);
      onSaved();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{rock ? 'Edit Rock' : 'Add Rock'}</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Rock Title *</label>
            <input className="form-input" value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="What must be done this quarter?" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" rows={3} value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="Describe this rock..." />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="form-group">
              <label className="form-label">Owner</label>
              <select className="form-select" value={form.owner_id} onChange={e => setForm({...form,owner_id:e.target.value})}>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input className="form-input" type="date" value={form.due_date} onChange={e => setForm({...form,due_date:e.target.value})} />
            </div>
          </div>
          <label className="checkbox-wrap" style={{marginBottom:16}}>
            <input type="checkbox" checked={form.is_company_rock} onChange={e => setForm({...form,is_company_rock:e.target.checked})} />
            <span style={{fontSize:'0.875rem',color:'var(--gray-700)'}}>Company Rock</span>
          </label>

          {rock && (
            <div>
              <label className="form-label">Milestones</label>
              {milestones.length === 0 && <p style={{fontSize:'0.8125rem',color:'var(--gray-400)',marginBottom:8}}>No milestones yet</p>}
              {milestones.map(m => (
                <div key={m.id} className="milestone-row">
                  <span>{m.title}</span>
                  {m.due_date && <span style={{fontSize:'0.75rem',color:'var(--gray-400)'}}>{format(new Date(m.due_date), 'M/d/yy')}</span>}
                </div>
              ))}
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <input className="form-input" style={{flex:1}} value={newMilestone.title} onChange={e => setNewMilestone({...newMilestone,title:e.target.value})} placeholder="Add milestone..." />
                <input className="form-input" style={{width:130}} type="date" value={newMilestone.due_date} onChange={e => setNewMilestone({...newMilestone,due_date:e.target.value})} />
                <button className="btn btn-secondary" onClick={addMilestone}>+</button>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {rock && <button className="btn btn-danger" style={{marginRight:'auto'}} onClick={handleDelete}>Delete</button>}
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : rock ? 'Update Rock' : 'Add Rock'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RockIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:40,height:40}}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>; }
function PersonIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function EditIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
