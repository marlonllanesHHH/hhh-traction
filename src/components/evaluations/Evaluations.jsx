import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';
import './Evaluations.css';

export default function Evaluations() {
  const { profile, isAdmin } = useAuth();
  const [evaluations, setEvaluations] = useState([]);
  const [sharedEvals, setSharedEvals] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [coreValues, setCoreValues] = useState([]);
  const [customCriteria, setCustomCriteria] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [viewEval, setViewEval] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [profile]);

  const fetchData = async () => {
    if (!profile) return;
    const [evalsRes, sharedRes, profilesRes, cvRes, ccRes] = await Promise.all([
      supabase.from('evaluations').select('*, evaluatee:profiles!evaluatee_id(full_name), evaluator:profiles!evaluator_id(full_name)').eq('evaluator_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('evaluations').select('*, evaluatee:profiles!evaluatee_id(full_name), evaluator:profiles!evaluator_id(full_name)').eq('evaluatee_id', profile.id).eq('status', 'shared').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('core_values').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('custom_criteria').select('*').eq('is_active', true).order('sort_order'),
    ]);
    setEvaluations(evalsRes.data || []);
    setSharedEvals(sharedRes.data || []);
    setProfiles(profilesRes.data || []);
    setCoreValues(cvRes.data || []);
    setCustomCriteria(ccRes.data || []);
    setLoading(false);
  };

  if (loading) return <div className="loading-spinner" style={{margin:'60px auto'}} />;

  return (
    <div className="evaluations-page fade-in">
      <div className="page-header">
        <div>
          <h1>Performance Evaluations</h1>
          <p>Evaluate team with Core Values, GWC + custom fields</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + New Evaluation
          </button>
        )}
      </div>

      {/* My Evaluations (as evaluator) */}
      {isAdmin && (
        <section className="eval-section">
          <h2>Evaluations I've Created</h2>
          {evaluations.length === 0 ? (
            <div className="card empty-state">
              <EvalIcon />
              <h3>No evaluations yet</h3>
              <p>Create your first performance evaluation</p>
            </div>
          ) : (
            <div className="eval-grid">
              {evaluations.map(ev => (
                <div key={ev.id} className="eval-card card" onClick={() => setViewEval(ev)}>
                  <div className="eval-card-header">
                    <div className="eval-avatar">
                      {ev.evaluatee?.full_name?.charAt(0)}
                    </div>
                    <div>
                      <div className="eval-name">{ev.evaluatee?.full_name}</div>
                      <div className="eval-period">{ev.period}</div>
                    </div>
                    <span className={`badge badge-${ev.status === 'shared' ? 'green' : ev.status === 'submitted' ? 'teal' : 'gray'}`}>
                      {ev.status}
                    </span>
                  </div>
                  <p className="eval-date">Created {format(new Date(ev.created_at), 'M/d/yyyy')}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Shared with me */}
      <section className="eval-section">
        <h2>Evaluations Shared With Me</h2>
        <p style={{fontSize:'0.875rem',color:'var(--gray-500)',marginBottom:16}}>Performance evaluations that have been shared with you</p>
        {sharedEvals.length === 0 ? (
          <div className="card empty-state">
            <p>No evaluations have been shared with you yet.</p>
          </div>
        ) : (
          <div className="eval-grid">
            {sharedEvals.map(ev => (
              <div key={ev.id} className="eval-card card" onClick={() => setViewEval(ev)}>
                <div className="eval-card-header">
                  <div className="eval-avatar">{ev.evaluator?.full_name?.charAt(0)}</div>
                  <div>
                    <div className="eval-name">From: {ev.evaluator?.full_name}</div>
                    <div className="eval-period">{ev.period}</div>
                  </div>
                  <span className="badge badge-green">Shared</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showCreate && (
        <CreateEvalModal
          profiles={profiles}
          coreValues={coreValues}
          customCriteria={customCriteria}
          evaluatorId={profile?.id}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchData(); }}
        />
      )}

      {viewEval && (
        <ViewEvalModal
          evaluation={viewEval}
          coreValues={coreValues}
          customCriteria={customCriteria}
          onClose={() => setViewEval(null)}
          onUpdated={() => { setViewEval(null); fetchData(); }}
          isEvaluator={viewEval.evaluator_id === profile?.id}
        />
      )}
    </div>
  );
}

function CreateEvalModal({ profiles, coreValues, customCriteria, evaluatorId, onClose, onCreated }) {
  const [evaluateeId, setEvaluateeId] = useState('');
  const [period, setPeriod] = useState(`Q${Math.ceil((new Date().getMonth()+1)/3)} ${new Date().getFullYear()}`);
  const [scores, setScores] = useState({});
  const [gwc, setGwc] = useState({});
  const [overallNotes, setOverallNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const setScore = (criterionId, value) => setScores(prev => ({...prev, [criterionId]: value}));
  const setGwcField = (field, value) => setGwc(prev => ({...prev, [field]: value}));

  const handleSubmit = async (status = 'submitted') => {
    if (!evaluateeId || !period) return;
    setLoading(true);

    const { data: evalData } = await supabase.from('evaluations').insert({
      evaluatee_id: evaluateeId,
      evaluator_id: evaluatorId,
      period,
      status,
      overall_notes: overallNotes,
    }).select().single();

    if (evalData) {
      const scoreEntries = [
        ...coreValues.map(cv => ({
          evaluation_id: evalData.id,
          criterion_type: 'core_value',
          criterion_id: cv.id,
          criterion_name: cv.name,
          score: scores[cv.id] || null,
        })),
        {
          evaluation_id: evalData.id,
          criterion_type: 'gwc',
          criterion_name: 'GWC',
          gets_it: gwc.gets_it ?? null,
          wants_it: gwc.wants_it ?? null,
          capacity_to_do_it: gwc.capacity ?? null,
        },
        ...customCriteria.map(cc => ({
          evaluation_id: evalData.id,
          criterion_type: 'custom',
          criterion_id: cc.id,
          criterion_name: cc.name,
          score: scores[`custom_${cc.id}`] || null,
        })),
      ];
      await supabase.from('evaluation_scores').insert(scoreEntries);
    }

    setLoading(false);
    onCreated();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal eval-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>New Performance Evaluation</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="form-group">
              <label className="form-label">Team Member *</label>
              <select className="form-select" value={evaluateeId} onChange={e => setEvaluateeId(e.target.value)}>
                <option value="">Select team member...</option>
                {profiles.filter(p => p.id !== evaluatorId).map(p => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Period *</label>
              <input className="form-input" value={period} onChange={e => setPeriod(e.target.value)} placeholder="Q2 2026" />
            </div>
          </div>

          {/* Core Values */}
          <div className="eval-section-block">
            <h4>Core Values</h4>
            {coreValues.map(cv => (
              <div key={cv.id} className="eval-criterion">
                <div className="criterion-info">
                  <span className="criterion-name">{cv.name}</span>
                  {cv.description && <span className="criterion-desc">{cv.description}</span>}
                </div>
                <div className="score-btns">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} className={`score-btn ${scores[cv.id] === n ? 'selected' : ''}`} onClick={() => setScore(cv.id, n)}>{n}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* GWC */}
          <div className="eval-section-block">
            <h4>GWC Assessment</h4>
            <div className="gwc-grid">
              {[
                { key: 'gets_it', label: 'Gets It', desc: 'Understands the role intuitively' },
                { key: 'wants_it', label: 'Wants It', desc: 'Genuinely desires to do the work' },
                { key: 'capacity', label: 'Capacity to Do It', desc: 'Has the time, skills, and emotional capacity' },
              ].map(item => (
                <div key={item.key} className="gwc-item">
                  <div>
                    <div className="gwc-label">{item.label}</div>
                    <div className="gwc-desc">{item.desc}</div>
                  </div>
                  <div className="gwc-toggle">
                    <button className={`gwc-btn yes ${gwc[item.key] === true ? 'selected' : ''}`} onClick={() => setGwcField(item.key, true)}>✓</button>
                    <button className={`gwc-btn no ${gwc[item.key] === false ? 'selected' : ''}`} onClick={() => setGwcField(item.key, false)}>✗</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Criteria */}
          {customCriteria.length > 0 && (
            <div className="eval-section-block">
              <h4>Additional Criteria</h4>
              {customCriteria.map(cc => (
                <div key={cc.id} className="eval-criterion">
                  <span className="criterion-name">{cc.name}</span>
                  <div className="score-btns">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} className={`score-btn ${scores[`custom_${cc.id}`] === n ? 'selected' : ''}`} onClick={() => setScore(`custom_${cc.id}`, n)}>{n}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Overall Notes</label>
            <textarea className="form-input" rows={4} value={overallNotes} onChange={e => setOverallNotes(e.target.value)} placeholder="Overall performance notes, highlights, areas for improvement..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-secondary" onClick={() => handleSubmit('draft')} disabled={loading}>Save Draft</button>
          <button className="btn btn-primary" onClick={() => handleSubmit('shared')} disabled={loading}>
            {loading ? 'Saving...' : 'Submit & Share'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewEvalModal({ evaluation, coreValues, onClose }) {
  const [scores, setScores] = useState([]);
  useEffect(() => {
    supabase.from('evaluation_scores').select('*').eq('evaluation_id', evaluation.id)
      .then(({ data }) => setScores(data || []));
  }, [evaluation]);

  const getScore = (name) => scores.find(s => s.criterion_name === name);
  const gwcScore = scores.find(s => s.criterion_type === 'gwc');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal eval-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Performance Evaluation — {evaluation.period}</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="eval-section-block">
            <h4>Core Values</h4>
            {coreValues.map(cv => {
              const s = getScore(cv.name);
              return (
                <div key={cv.id} className="eval-criterion view-mode">
                  <span className="criterion-name">{cv.name}</span>
                  <div className="score-btns">
                    {[1,2,3,4,5].map(n => (
                      <div key={n} className={`score-btn ${s?.score === n ? 'selected' : 'readonly'}`}>{n}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {gwcScore && (
            <div className="eval-section-block">
              <h4>GWC</h4>
              <div className="gwc-view">
                <div className={`gwc-result ${gwcScore.gets_it ? 'yes' : 'no'}`}>Gets It: {gwcScore.gets_it ? '✓' : '✗'}</div>
                <div className={`gwc-result ${gwcScore.wants_it ? 'yes' : 'no'}`}>Wants It: {gwcScore.wants_it ? '✓' : '✗'}</div>
                <div className={`gwc-result ${gwcScore.capacity_to_do_it ? 'yes' : 'no'}`}>Capacity: {gwcScore.capacity_to_do_it ? '✓' : '✗'}</div>
              </div>
            </div>
          )}
          {evaluation.overall_notes && (
            <div className="form-group">
              <label className="form-label">Overall Notes</label>
              <p style={{fontSize:'0.875rem',color:'var(--gray-700)',lineHeight:1.6}}>{evaluation.overall_notes}</p>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function EvalIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:40,height:40}}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
