import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';
import './TodoList.css';

export default function TodoList({ meetingId, sessionId }) {
  const { profile } = useAuth();
  const [todos, setTodos] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [activeTab, setActiveTab] = useState('open');
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [meetingId]);

  const fetchData = async () => {
    const [todosRes, profilesRes] = await Promise.all([
      supabase.from('todos').select('*, owner:profiles(full_name, id)').eq('meeting_id', meetingId).order('due_date'),
      supabase.from('profiles').select('id, full_name'),
    ]);
    setTodos(todosRes.data || []);
    setProfiles(profilesRes.data || []);
    setLoading(false);
  };

  const toggleComplete = async (todo) => {
    await supabase.from('todos').update({
      completed: !todo.completed,
      completed_at: !todo.completed ? new Date().toISOString() : null,
    }).eq('id', todo.id);
    fetchData();
  };

  const deleteTodo = async (id) => {
    await supabase.from('todos').delete().eq('id', id);
    fetchData();
  };

  const openTodos = todos.filter(t => !t.completed);
  const completedTodos = todos.filter(t => t.completed);

  // Group open todos by owner
  const byOwner = openTodos.reduce((acc, t) => {
    const key = t.owner?.id || 'unassigned';
    const name = t.owner?.full_name || 'Unassigned';
    if (!acc[key]) acc[key] = { name, todos: [] };
    acc[key].todos.push(t);
    return acc;
  }, {});

  if (loading) return <div className="loading-spinner" style={{margin:'40px auto'}} />;

  return (
    <div className="todo-list-component">
      <div className="todo-toolbar">
        <div className="issues-tabs">
          <button className={`tab-btn ${activeTab === 'open' ? 'active' : ''}`} onClick={() => setActiveTab('open')}>
            Open To-Dos ({openTodos.length})
          </button>
          <button className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>
            Completed ({completedTodos.length})
          </button>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add To-Do</button>
      </div>

      {activeTab === 'open' && (
        <div>
          {openTodos.length === 0 ? (
            <div className="empty-state">
              <CheckIcon />
              <h3>All caught up!</h3>
              <p>No open to-dos right now</p>
            </div>
          ) : (
            Object.values(byOwner).map(({ name, todos: ownerTodos }) => (
              <div key={name} className="todo-owner-group">
                <div className="todo-owner-header">
                  <PersonIcon />
                  <span>{name}</span>
                  <span className="todo-count">{ownerTodos.length}</span>
                </div>
                {ownerTodos.map(todo => {
                  const overdue = todo.due_date && new Date(todo.due_date) < new Date();
                  return (
                    <div key={todo.id} className="todo-item">
                      <button className="todo-checkbox" onClick={() => toggleComplete(todo)}>
                        <CheckboxIcon />
                      </button>
                      <div className="todo-item-content">
                        <span className="todo-item-title">{todo.title}</span>
                        {todo.due_date && (
                          <span className={`todo-item-due ${overdue ? 'overdue' : ''}`}>
                            <ClockIcon /> Due: {format(new Date(todo.due_date), 'M/d/yy')}
                            {overdue && ' (Overdue)'}
                          </span>
                        )}
                      </div>
                      <button className="btn-ghost icon-btn" onClick={() => deleteTodo(todo.id)}>
                        <TrashIcon />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'completed' && (
        <div>
          {completedTodos.length === 0 ? (
            <div className="empty-state"><h3>No completed to-dos</h3></div>
          ) : (
            completedTodos.map(todo => (
              <div key={todo.id} className="todo-item completed">
                <button className="todo-checkbox done" onClick={() => toggleComplete(todo)}>
                  <CheckedIcon />
                </button>
                <div className="todo-item-content">
                  <span className="todo-item-title strikethrough">{todo.title}</span>
                  <span className="todo-item-owner">{todo.owner?.full_name}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showAdd && (
        <AddTodoModal
          meetingId={meetingId}
          sessionId={sessionId}
          ownerId={profile?.id}
          profiles={profiles}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); fetchData(); }}
        />
      )}
    </div>
  );
}

function AddTodoModal({ meetingId, sessionId, ownerId, profiles, onClose, onAdded }) {
  const [form, setForm] = useState({ title: '', owner_id: ownerId, due_date: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setLoading(true);
    await supabase.from('todos').insert({
      ...form,
      meeting_id: meetingId,
      session_id: sessionId || null,
      due_date: form.due_date || null,
    });
    setLoading(false);
    onAdded();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add To-Do</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">To-Do *</label>
            <input className="form-input" value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="What needs to be done?" />
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
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Adding...' : 'Add To-Do'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:40,height:40}}><polyline points="20 6 9 17 4 12"/></svg>; }
function PersonIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function ClockIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function TrashIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>; }
function CheckboxIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>; }
function CheckedIcon() { return <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="3" fill="var(--teal)" stroke="var(--teal)" strokeWidth="2"/><polyline points="7 12 10 15 17 9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
