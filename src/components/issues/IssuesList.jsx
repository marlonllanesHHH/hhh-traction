import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import './IssuesList.css';

export default function IssuesList({ meetingId }) {
  const { profile } = useAuth();
  const [issues, setIssues] = useState([]);
  const [activeTab, setActiveTab] = useState('open');
  const [profiles, setProfiles] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [meetingId]);

  const fetchData = async () => {
    const [issuesRes, profilesRes] = await Promise.all([
      supabase.from('issues').select('*, owner:profiles(full_name)').eq('meeting_id', meetingId).order('nominated', { ascending: false }).order('created_at'),
      supabase.from('profiles').select('id, full_name'),
    ]);
    setIssues(issuesRes.data || []);
    setProfiles(profilesRes.data || []);
    setLoading(false);
  };

  const updateIssue = async (id, updates) => {
    await supabase.from('issues').update(updates).eq('id', id);
    fetchData();
  };

  const deleteIssue = async (id) => {
    await supabase.from('issues').delete().eq('id', id);
    fetchData();
  };

  const toggleNominate = async (issue) => {
    const nominated = !issue.nominated;
    await supabase.from('issues').update({ nominated }).eq('id', issue.id);
    fetchData();
  };

  const filtered = issues.filter(i => {
    if (activeTab === 'open') return ['open','solving'].includes(i.status);
    if (activeTab === 'solved') return i.status === 'solved';
    if (activeTab === 'long_term') return i.status === 'long_term';
    return true;
  });

  const openCount = issues.filter(i => ['open','solving'].includes(i.status)).length;
  const solvedCount = issues.filter(i => i.status === 'solved').length;
  const ltCount = issues.filter(i => i.status === 'long_term').length;
  const nominated = filtered.filter(i => i.nominated);
  const notNominated = filtered.filter(i => !i.nominated);

  if (loading) return <div className="loading-spinner" style={{margin:'40px auto'}} />;

  return (
    <div className="issues-list">
      <div className="issues-toolbar">
        <div className="issues-tabs">
          <button className={`tab-btn ${activeTab === 'open' ? 'active' : ''}`} onClick={() => setActiveTab('open')}>
            Open ({openCount})
          </button>
          <button className={`tab-btn ${activeTab === 'solved' ? 'active' : ''}`} onClick={() => setActiveTab('solved')}>
            Solved ({solvedCount})
          </button>
          <button className={`tab-btn ${activeTab === 'long_term' ? 'active' : ''}`} onClick={() => setActiveTab('long_term')}>
            Long-Term ({ltCount})
          </button>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Issue</button>
      </div>

      {nominated.length > 0 && (
        <div className="issues-group">
          <div className="issues-group-header">
            <PinIcon />
            <span>Nominated</span>
            <span className="issue-count">{nominated.length}</span>
          </div>
          {nominated.map((issue, i) => (
            <IssueRow key={issue.id} issue={issue} index={i+1} onUpdate={updateIssue} onDelete={deleteIssue} onNominate={toggleNominate} profiles={profiles} />
          ))}
        </div>
      )}

      {notNominated.length > 0 && (
        <div className="issues-group">
          {notNominated.map(issue => (
            <IssueRow key={issue.id} issue={issue} onUpdate={updateIssue} onDelete={deleteIssue} onNominate={toggleNominate} profiles={profiles} />
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="empty-state">
          <CheckIcon />
          <h3>No {activeTab} issues</h3>
        </div>
      )}

      {showAdd && (
        <AddIssueModal
          meetingId={meetingId}
          ownerId={profile?.id}
          profiles={profiles}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); fetchData(); }}
        />
      )}
    </div>
  );
}

function IssueRow({ issue, index, onUpdate, onDelete, onNominate, profiles }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`issue-card ${issue.nominated ? 'nominated' : ''}`}>
      <div className="issue-card-header">
        {index && <span className="issue-number">{index}</span>}
        <div className="issue-content">
          <div className="issue-title-row">
            <span className="issue-card-title">{issue.title}</span>
            <span className="issue-owner">{issue.owner?.full_name}</span>
          </div>
          {issue.description && (
            <p className="issue-card-desc">{issue.description}</p>
          )}
        </div>
        <div className="issue-card-actions">
          <button
            className={`nominate-btn ${issue.nominated ? 'nominated' : ''}`}
            onClick={() => onNominate(issue)}
            title="Nominate for IDS"
          >
            <PinIcon />
          </button>
          <select
            className="issue-status-select"
            value={issue.status}
            onChange={e => onUpdate(issue.id, { status: e.target.value })}
          >
            <option value="open">Open</option>
            <option value="solving">Solving</option>
            <option value="solved">Solved</option>
            <option value="long_term">Long-Term</option>
          </select>
          <button className="btn-ghost icon-btn" onClick={() => onDelete(issue.id)}>
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function AddIssueModal({ meetingId, ownerId, profiles, onClose, onAdded }) {
  const [form, setForm] = useState({ title: '', description: '', owner_id: ownerId, status: 'open' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setLoading(true);
    await supabase.from('issues').insert({ ...form, meeting_id: meetingId });
    setLoading(false);
    onAdded();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Issue</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Issue Title *</label>
            <input className="form-input" value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="What's the issue?" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" rows={3} value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="Describe the issue..." />
          </div>
          <div className="form-group">
            <label className="form-label">Owner</label>
            <select className="form-select" value={form.owner_id} onChange={e => setForm({...form,owner_id:e.target.value})}>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Adding...' : 'Add Issue'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PinIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>; }
function TrashIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>; }
function CheckIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:40,height:40}}><polyline points="20 6 9 17 4 12"/></svg>; }
