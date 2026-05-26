import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { format, startOfWeek, subWeeks } from 'date-fns';
import './Scorecard.css';

const WEEKS = 8; // Show 8 weeks of data

export default function Scorecard({ meetingId }) {
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState([]);
  const [entries, setEntries] = useState({});
  const [weekStarts, setWeekStarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddMetric, setShowAddMetric] = useState(false);
  const [editEntry, setEditEntry] = useState(null); // {metricId, weekStart}

  useEffect(() => {
    const weeks = [];
    for (let i = 0; i < WEEKS; i++) {
      weeks.push(format(startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    }
    setWeekStarts(weeks);
    fetchData();
  }, [meetingId]);

  const fetchData = async () => {
    const [metricsRes, entriesRes] = await Promise.all([
      supabase.from('scorecard_metrics').select('*, owner:profiles(full_name)').eq('meeting_id', meetingId).eq('is_active', true).order('sort_order'),
      supabase.from('scorecard_entries').select('*').in('metric_id', 
        (await supabase.from('scorecard_metrics').select('id').eq('meeting_id', meetingId)).data?.map(m => m.id) || []
      ),
    ]);

    const entriesMap = {};
    (entriesRes.data || []).forEach(e => {
      if (!entriesMap[e.metric_id]) entriesMap[e.metric_id] = {};
      entriesMap[e.metric_id][e.week_start] = e;
    });

    setMetrics(metricsRes.data || []);
    setEntries(entriesMap);
    setLoading(false);
  };

  const isOnTarget = (metric, value) => {
    if (value === null || value === undefined) return null;
    const goal = parseFloat(metric.goal);
    const v = parseFloat(value);
    if (metric.goal_operator === '>=') return v >= goal;
    if (metric.goal_operator === '<=') return v <= goal;
    return v === goal;
  };

  const upsertEntry = async (metricId, weekStart, value) => {
    await supabase.from('scorecard_entries').upsert({
      metric_id: metricId,
      week_start: weekStart,
      value: parseFloat(value),
      entered_by: profile?.id,
    }, { onConflict: 'metric_id,week_start' });
    fetchData();
    setEditEntry(null);
  };

  if (loading) return <div className="loading-spinner" style={{margin:'40px auto'}} />;

  return (
    <div className="scorecard">
      <div className="scorecard-toolbar">
        <button className="btn btn-primary" onClick={() => setShowAddMetric(true)}>
          + Add Metric
        </button>
      </div>

      {metrics.length === 0 ? (
        <div className="empty-state">
          <MetricIcon />
          <h3>No metrics yet</h3>
          <p>Add your first scorecard metric to start tracking</p>
        </div>
      ) : (
        <div className="scorecard-table-wrap">
          <table className="scorecard-table">
            <thead>
              <tr>
                <th className="metric-col">Metric</th>
                <th>Owner</th>
                <th>Goal</th>
                {weekStarts.map((w, i) => (
                  <th key={w} className={`week-col ${i === 0 ? 'current-week' : ''}`}>
                    {format(new Date(w + 'T00:00:00'), 'M/d')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map(m => (
                <tr key={m.id}>
                  <td className="metric-name-cell">
                    <span className="metric-name">{m.title}</span>
                  </td>
                  <td className="owner-cell">{m.owner?.full_name || '—'}</td>
                  <td className="goal-cell">
                    <span className="goal-badge">
                      {m.goal_operator} {m.goal}
                    </span>
                  </td>
                  {weekStarts.map((w, i) => {
                    const entry = entries[m.id]?.[w];
                    const onTarget = entry ? isOnTarget(m, entry.value) : null;
                    const isEditing = editEntry?.metricId === m.id && editEntry?.weekStart === w;

                    return (
                      <td
                        key={w}
                        className={`value-cell ${i === 0 ? 'current-week' : ''} ${
                          onTarget === true ? 'on-target' : onTarget === false ? 'off-target' : ''
                        }`}
                        onClick={() => setEditEntry({ metricId: m.id, weekStart: w })}
                      >
                        {isEditing ? (
                          <input
                            type="number"
                            className="entry-input"
                            defaultValue={entry?.value ?? ''}
                            autoFocus
                            onBlur={e => upsertEntry(m.id, w, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') upsertEntry(m.id, w, e.target.value);
                              if (e.key === 'Escape') setEditEntry(null);
                            }}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <span className="entry-value">
                            {entry?.value !== null && entry?.value !== undefined
                              ? m.unit === '%' ? `${entry.value}%` : entry.value
                              : '—'
                            }
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddMetric && (
        <AddMetricModal
          meetingId={meetingId}
          profileId={profile?.id}
          onClose={() => setShowAddMetric(false)}
          onAdded={() => { setShowAddMetric(false); fetchData(); }}
        />
      )}
    </div>
  );
}

function AddMetricModal({ meetingId, profileId, onClose, onAdded }) {
  const [form, setForm] = useState({ title: '', owner_id: profileId, goal: '', goal_operator: '>=', unit: 'number' });
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').then(({ data }) => setProfiles(data || []));
  }, []);

  const handleSubmit = async () => {
    if (!form.title || !form.goal) return;
    setLoading(true);
    const { error } = await supabase.from('scorecard_metrics').insert({ ...form, meeting_id: meetingId });
    setLoading(false);
    if (!error) onAdded();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Metric</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Metric Name *</label>
            <input className="form-input" value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="e.g., New Donors, Event Attendance..." />
          </div>
          <div className="form-group">
            <label className="form-label">Owner</label>
            <select className="form-select" value={form.owner_id} onChange={e => setForm({...form,owner_id:e.target.value})}>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
            <div className="form-group">
              <label className="form-label">Goal Operator</label>
              <select className="form-select" value={form.goal_operator} onChange={e => setForm({...form,goal_operator:e.target.value})}>
                <option value=">=">≥ (at least)</option>
                <option value="<=">≤ (at most)</option>
                <option value="=">=  (exactly)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Goal Value *</label>
              <input className="form-input" type="number" value={form.goal} onChange={e => setForm({...form,goal:e.target.value})} placeholder="100" />
            </div>
            <div className="form-group">
              <label className="form-label">Unit</label>
              <select className="form-select" value={form.unit} onChange={e => setForm({...form,unit:e.target.value})}>
                <option value="number">Number</option>
                <option value="%">Percentage</option>
                <option value="$">Dollar</option>
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Adding...' : 'Add Metric'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:40,height:40}}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>; }
