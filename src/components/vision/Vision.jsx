// Vision/Traction Page
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import './Vision.css';

const SECTIONS = [
  { key: 'core_values', label: 'Core Values', icon: '💎', desc: 'What we believe in and how we behave' },
  { key: 'core_focus', label: 'Core Focus', icon: '🎯', desc: 'Our purpose/cause/passion and niche' },
  { key: '10year', label: '10-Year Target', icon: '🔭', desc: 'Where we\'re headed long-term' },
  { key: '3year', label: '3-Year Picture', icon: '📅', desc: 'What does success look like in 3 years' },
  { key: '1year', label: '1-Year Plan', icon: '📋', desc: 'This year\'s goals and priorities' },
  { key: 'quarterly', label: 'Quarterly Rocks', icon: '🪨', desc: 'This quarter\'s must-dos' },
];

export default function Vision() {
  const { isAdmin } = useAuth();
  const [sections, setSections] = useState({});
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data } = await supabase.from('vision_traction').select('*');
    const map = {};
    (data || []).forEach(d => { map[d.section] = d.content; });
    setSections(map);
    setLoading(false);
  };

  const saveSection = async (key, content) => {
    await supabase.from('vision_traction').upsert({ section: key, content }, { onConflict: 'section' });
    setSections(prev => ({...prev, [key]: content}));
    setEditing(null);
  };

  if (loading) return <div className="loading-spinner" style={{margin:'60px auto'}} />;

  return (
    <div className="vision-page fade-in">
      <div className="page-header">
        <div>
          <h1>Vision / Traction</h1>
          <p>Strategic planning and quarterly rocks for Historic Hampton House</p>
        </div>
      </div>

      <div className="vision-grid">
        {SECTIONS.map(s => (
          <div key={s.key} className={`vision-card card ${s.key === '10year' ? 'span-2' : ''}`}>
            <div className="vision-card-header">
              <span className="vision-icon">{s.icon}</span>
              <div>
                <h3>{s.label}</h3>
                <p className="vision-desc">{s.desc}</p>
              </div>
              {isAdmin && (
                <button className="btn btn-ghost icon-btn" onClick={() => setEditing(s.key)}>
                  <EditIcon />
                </button>
              )}
            </div>
            <div className="vision-content">
              {sections[s.key] ? (
                <VisionContent section={s.key} content={sections[s.key]} />
              ) : (
                <div className="vision-empty">
                  <p>Not defined yet</p>
                  {isAdmin && (
                    <button className="btn btn-secondary" style={{marginTop:8}} onClick={() => setEditing(s.key)}>
                      Add Content
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <EditVisionModal
          sectionKey={editing}
          sectionLabel={SECTIONS.find(s => s.key === editing)?.label}
          current={sections[editing]}
          onClose={() => setEditing(null)}
          onSave={saveSection}
        />
      )}
    </div>
  );
}

function VisionContent({ section, content }) {
  if (!content) return null;
  if (typeof content === 'string') return <p style={{fontSize:'0.9rem',color:'var(--gray-700)',lineHeight:1.6}}>{content}</p>;
  if (Array.isArray(content)) {
    return (
      <ul className="vision-list">
        {content.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    );
  }
  if (content.items) {
    return (
      <ul className="vision-list">
        {content.items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    );
  }
  if (content.text) return <p style={{fontSize:'0.9rem',color:'var(--gray-700)',lineHeight:1.6}}>{content.text}</p>;
  return <pre style={{fontSize:'0.875rem',color:'var(--gray-700)'}}>{JSON.stringify(content, null, 2)}</pre>;
}

function EditVisionModal({ sectionKey, sectionLabel, current, onClose, onSave }) {
  const [value, setValue] = useState(
    typeof current === 'string' ? current :
    Array.isArray(current) ? current.join('\n') :
    current?.items ? current.items.join('\n') :
    current?.text || ''
  );
  const [isArray, setIsArray] = useState(Array.isArray(current) || !!current?.items);

  const handleSave = () => {
    let content;
    if (isArray) {
      content = value.split('\n').filter(Boolean);
    } else {
      content = value;
    }
    onSave(sectionKey, content);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit: {sectionLabel}</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <label className="checkbox-wrap" style={{marginBottom:14}}>
            <input type="checkbox" checked={isArray} onChange={e => setIsArray(e.target.checked)} />
            <span style={{fontSize:'0.875rem',color:'var(--gray-700)'}}>Display as list (one item per line)</span>
          </label>
          <textarea
            className="form-input"
            rows={10}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={isArray ? "Enter each item on a new line..." : "Enter content..."}
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

function EditIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
