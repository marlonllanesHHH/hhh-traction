import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import './Accountability.css';

export default function AccountabilityChart() {
  const { isAdmin } = useAuth();
  const [nodes, setNodes] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editNode, setEditNode] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [nodesRes, profilesRes] = await Promise.all([
      supabase.from('accountability_chart').select('*, user:profiles(full_name, email)').order('sort_order'),
      supabase.from('profiles').select('id, full_name, title'),
    ]);
    setNodes(nodesRes.data || []);
    setProfiles(profilesRes.data || []);
    setLoading(false);
  };

  const deleteNode = async (id) => {
    if (window.confirm('Delete this seat?')) {
      await supabase.from('accountability_chart').delete().eq('id', id);
      fetchData();
    }
  };

  // Build tree
  const buildTree = (nodes) => {
    const map = {};
    nodes.forEach(n => { map[n.id] = { ...n, children: [] }; });
    const roots = [];
    nodes.forEach(n => {
      if (n.parent_id && map[n.parent_id]) {
        map[n.parent_id].children.push(map[n.id]);
      } else {
        roots.push(map[n.id]);
      }
    });
    return roots;
  };

  const tree = buildTree(nodes);

  if (loading) return <div className="loading-spinner" style={{margin:'60px auto'}} />;

  return (
    <div className="accountability-page fade-in">
      <div className="page-header">
        <div>
          <h1>Accountability Chart</h1>
          <p>Visual org structure and reporting lines</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            + Add Seat
          </button>
        )}
      </div>

      {nodes.length === 0 ? (
        <div className="card empty-state">
          <OrgIcon />
          <h3>No seats yet</h3>
          <p>Build your accountability chart by adding seats</p>
          {isAdmin && (
            <button className="btn btn-primary" style={{marginTop:16}} onClick={() => setShowAdd(true)}>
              Add First Seat
            </button>
          )}
        </div>
      ) : (
        <div className="chart-container">
          <div className="chart-scroll">
            <div className="chart-tree">
              {tree.map(node => (
                <ChartNode
                  key={node.id}
                  node={node}
                  isAdmin={isAdmin}
                  onEdit={setEditNode}
                  onDelete={deleteNode}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {(showAdd || editNode) && (
        <SeatModal
          node={editNode}
          nodes={nodes}
          profiles={profiles}
          onClose={() => { setShowAdd(false); setEditNode(null); }}
          onSaved={() => { setShowAdd(false); setEditNode(null); fetchData(); }}
        />
      )}
    </div>
  );
}

function ChartNode({ node, isAdmin, onEdit, onDelete, depth = 0 }) {
  const initials = node.user?.full_name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() || '?';

  return (
    <div className="chart-node-wrap">
      <div className={`chart-node ${depth === 0 ? 'root' : ''}`}>
        <div className="node-card">
          <div className="node-seat">{node.seat_title}</div>
          {node.user && (
            <div className="node-person">
              <div className="node-avatar">{initials}</div>
              <span>{node.user.full_name}</span>
            </div>
          )}
          {node.responsibilities?.length > 0 && (
            <ul className="node-responsibilities">
              {node.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
          {isAdmin && (
            <div className="node-actions">
              <button className="node-btn" onClick={() => onEdit(node)} title="Edit">
                <EditIcon />
              </button>
              <button className="node-btn danger" onClick={() => onDelete(node.id)} title="Delete">
                <TrashIcon />
              </button>
            </div>
          )}
        </div>
        {node.children?.length > 0 && (
          <div className="node-connector" />
        )}
      </div>
      {node.children?.length > 0 && (
        <div className="node-children">
          <div className="children-line" />
          <div className="children-row">
            {node.children.map(child => (
              <ChartNode key={child.id} node={child} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} depth={depth + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SeatModal({ node, nodes, profiles, onClose, onSaved }) {
  const [form, setForm] = useState({
    seat_title: node?.seat_title || '',
    user_id: node?.user_id || '',
    parent_id: node?.parent_id || '',
    responsibilities: node?.responsibilities?.join('\n') || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!form.seat_title.trim()) return;
    setLoading(true);
    const data = {
      seat_title: form.seat_title,
      user_id: form.user_id || null,
      parent_id: form.parent_id || null,
      responsibilities: form.responsibilities.split('\n').filter(Boolean),
    };
    if (node) {
      await supabase.from('accountability_chart').update(data).eq('id', node.id);
    } else {
      await supabase.from('accountability_chart').insert(data);
    }
    setLoading(false);
    onSaved();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{node ? 'Edit Seat' : 'Add Seat'}</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Seat / Role Title *</label>
            <input className="form-input" value={form.seat_title} onChange={e => setForm({...form, seat_title: e.target.value})} placeholder="e.g., Executive Director, Marketing Lead..." />
          </div>
          <div className="form-group">
            <label className="form-label">Assigned To</label>
            <select className="form-select" value={form.user_id} onChange={e => setForm({...form, user_id: e.target.value})}>
              <option value="">Unassigned</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Reports To</label>
            <select className="form-select" value={form.parent_id} onChange={e => setForm({...form, parent_id: e.target.value})}>
              <option value="">Top Level (no parent)</option>
              {nodes.filter(n => n.id !== node?.id).map(n => (
                <option key={n.id} value={n.id}>{n.seat_title}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Responsibilities (one per line)</label>
            <textarea className="form-input" rows={5} value={form.responsibilities} onChange={e => setForm({...form, responsibilities: e.target.value})} placeholder="List key responsibilities..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : node ? 'Update Seat' : 'Add Seat'}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrgIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:40,height:40}}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>; }
function EditIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function TrashIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>; }
