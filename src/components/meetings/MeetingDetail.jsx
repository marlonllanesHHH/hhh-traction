import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import Scorecard from '../scorecard/Scorecard';
import RockReview from '../rocks/RockReview';
import IssuesList from '../issues/IssuesList';
import TodoList from '../todos/TodoList';
import './MeetingDetail.css';

const SECTIONS = [
  { id: 'segue', label: 'Segue', time: 5 },
  { id: 'scorecard', label: 'Scorecard', time: 5 },
  { id: 'rocks', label: 'Rock Review', time: 5 },
  { id: 'headlines', label: 'Headlines', time: 5 },
  { id: 'todos', label: 'To-Do List', time: 5 },
  { id: 'ids', label: 'IDS', time: 60 },
  { id: 'conclude', label: 'Conclude', time: 5 },
];

export default function MeetingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [meeting, setMeeting] = useState(null);
  const [session, setSession] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [activeSection, setActiveSection] = useState('segue');
  const [inSession, setInSession] = useState(false);
  const [loading, setLoading] = useState(true);
  const [icebreaker] = useState('Share one professional and one personal win from the past 7 days.');

  useEffect(() => { fetchMeeting(); }, [id]);

  const fetchMeeting = async () => {
    const [meetingRes, attendeesRes, profilesRes] = await Promise.all([
      supabase.from('meetings').select('*').eq('id', id).single(),
      supabase.from('meeting_attendees').select('*, profile:profiles(*)').eq('meeting_id', id),
      supabase.from('profiles').select('*').order('full_name'),
    ]);
    setMeeting(meetingRes.data);
    setAttendees(attendeesRes.data || []);
    setProfiles(profilesRes.data || []);
    setLoading(false);
  };

  const startMeeting = async () => {
    const { data } = await supabase.from('meeting_sessions').insert({
      meeting_id: id,
      session_date: new Date().toISOString().split('T')[0],
      started_at: new Date().toISOString(),
      status: 'in_session',
    }).select().single();
    setSession(data);
    setInSession(true);
  };

  const endMeeting = async () => {
    if (session) {
      await supabase.from('meeting_sessions').update({
        ended_at: new Date().toISOString(),
        status: 'completed',
      }).eq('id', session.id);
    }
    setInSession(false);
    setSession(null);
  };

  const toggleAttendance = async (userId) => {
    const current = attendance[userId] ?? false;
    setAttendance(prev => ({ ...prev, [userId]: !current }));
    if (session) {
      await supabase.from('session_attendance').upsert({
        session_id: session.id,
        user_id: userId,
        present: !current,
      });
    }
  };

  const addAttendee = async (userId) => {
    await supabase.from('meeting_attendees').insert({ meeting_id: id, user_id: userId });
    fetchMeeting();
  };

  if (loading) return <div className="loading-spinner" style={{margin:'60px auto'}} />;
  if (!meeting) return <div>Meeting not found</div>;

  const section = SECTIONS.find(s => s.id === activeSection);

  return (
    <div className="meeting-detail fade-in">
      {/* Header */}
      <div className="meeting-detail-header">
        <button className="btn btn-ghost back-btn" onClick={() => navigate('/meetings')}>
          ← Back
        </button>
        <div className="meeting-detail-title">
          <h1>{meeting.name}</h1>
          <p>{meeting.duration_minutes} minute meeting · Created {new Date(meeting.created_at).toLocaleDateString()}</p>
        </div>
        <div className="meeting-actions">
          {inSession ? (
            <button className="btn btn-danger" onClick={endMeeting}>
              <StopIcon /> End Meeting
            </button>
          ) : (
            <button className="btn btn-primary" onClick={startMeeting}>
              <PlayIcon /> Start Meeting
            </button>
          )}
          <span className={`session-badge ${inSession ? 'live' : ''}`}>
            <span className="session-dot" />
            {inSession ? 'In Session' : 'Not In Session'}
          </span>
        </div>
      </div>

      {/* Section tabs */}
      <div className="section-tabs">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            className={`section-tab ${activeSection === s.id ? 'active' : ''}`}
            onClick={() => setActiveSection(s.id)}
          >
            {s.label}
            <span className="section-time">{s.time} min</span>
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="section-content card">
        <div className="section-header">
          <h2>{section?.label}</h2>
          <span className="time-badge"><ClockIcon /> {section?.time} min</span>
        </div>

        {activeSection === 'segue' && (
          <SegueSection
            attendees={attendees}
            allProfiles={profiles}
            attendance={attendance}
            onToggleAttendance={toggleAttendance}
            onAddAttendee={addAttendee}
            icebreaker={icebreaker}
            meetingId={id}
          />
        )}
        {activeSection === 'scorecard' && <Scorecard meetingId={id} />}
        {activeSection === 'rocks' && <RockReview meetingId={id} />}
        {activeSection === 'headlines' && <Headlines sessionId={session?.id} profileId={profile?.id} />}
        {activeSection === 'todos' && <TodoList meetingId={id} sessionId={session?.id} />}
        {activeSection === 'ids' && <IssuesList meetingId={id} />}
        {activeSection === 'conclude' && (
          <ConcludeSection onEnd={endMeeting} inSession={inSession} sessionId={session?.id} />
        )}
      </div>
    </div>
  );
}

function SegueSection({ attendees, allProfiles, attendance, onToggleAttendance, onAddAttendee, icebreaker, meetingId }) {
  const [showAddAttendee, setShowAddAttendee] = useState(false);

  return (
    <div className="segue-section">
      <div className="attendance-section">
        <h4>Attendance</h4>
        <div className="attendance-list">
          {attendees.map(a => (
            <label key={a.user_id} className="attendance-item">
              <input
                type="checkbox"
                checked={attendance[a.user_id] ?? false}
                onChange={() => onToggleAttendance(a.user_id)}
              />
              <span>{a.profile?.full_name}</span>
            </label>
          ))}
        </div>
        {showAddAttendee && (
          <div className="add-attendee-row">
            <select
              className="form-select"
              onChange={e => { if (e.target.value) { onAddAttendee(e.target.value); setShowAddAttendee(false); }}}
              defaultValue=""
            >
              <option value="" disabled>Select team member...</option>
              {allProfiles
                .filter(p => !attendees.find(a => a.user_id === p.id))
                .map(p => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
            </select>
          </div>
        )}
        <button className="btn btn-secondary" style={{marginTop:12}} onClick={() => setShowAddAttendee(!showAddAttendee)}>
          + Add Attendee
        </button>
      </div>

      <div className="icebreaker-card">
        <div className="icebreaker-label">Icebreaker Question</div>
        <div className="icebreaker-text">{icebreaker}</div>
      </div>
    </div>
  );
}

function Headlines({ sessionId, profileId }) {
  const [headlines, setHeadlines] = useState([]);
  const [newHeadline, setNewHeadline] = useState('');
  const [type, setType] = useState('people');

  useEffect(() => {
    if (sessionId) fetchHeadlines();
  }, [sessionId]);

  const fetchHeadlines = async () => {
    const { data } = await supabase
      .from('headlines')
      .select('*, owner:profiles(full_name)')
      .eq('session_id', sessionId);
    setHeadlines(data || []);
  };

  const addHeadline = async () => {
    if (!newHeadline.trim() || !sessionId) return;
    await supabase.from('headlines').insert({
      session_id: sessionId,
      owner_id: profileId,
      content: newHeadline,
      type,
    });
    setNewHeadline('');
    fetchHeadlines();
  };

  return (
    <div className="headlines-section">
      <div className="headlines-tabs">
        <button className={`hl-tab ${type === 'people' ? 'active' : ''}`} onClick={() => setType('people')}>People</button>
        <button className={`hl-tab ${type === 'business' ? 'active' : ''}`} onClick={() => setType('business')}>Business</button>
      </div>
      <div className="add-headline-row">
        <input
          className="form-input"
          value={newHeadline}
          onChange={e => setNewHeadline(e.target.value)}
          placeholder="Share a headline..."
          onKeyDown={e => e.key === 'Enter' && addHeadline()}
        />
        <button className="btn btn-primary" onClick={addHeadline}>Add</button>
      </div>
      {!sessionId && <p style={{color:'var(--gray-400)',fontSize:'0.875rem',textAlign:'center',padding:'20px 0'}}>Start the meeting to add headlines</p>}
      <div className="headlines-list">
        {headlines.filter(h => h.type === type).map(h => (
          <div key={h.id} className="headline-item">
            <span className={`headline-type-dot ${h.type}`} />
            <div>
              <div className="headline-text">{h.content}</div>
              <div className="headline-owner">{h.owner?.full_name}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConcludeSection({ onEnd, inSession, sessionId }) {
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');

  const saveAndEnd = async () => {
    if (sessionId && rating > 0) {
      await supabase.from('meeting_sessions').update({ rating, notes }).eq('id', sessionId);
    }
    onEnd();
  };

  return (
    <div className="conclude-section">
      <h4>Rate this meeting</h4>
      <div className="rating-row">
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <button
            key={n}
            className={`rating-btn ${rating >= n ? 'selected' : ''}`}
            onClick={() => setRating(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="form-group" style={{marginTop:20}}>
        <label className="form-label">Meeting Notes (optional)</label>
        <textarea
          className="form-input"
          rows={4}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Capture any final notes..."
        />
      </div>
      {inSession && (
        <button className="btn btn-danger" onClick={saveAndEnd} style={{marginTop:8}}>
          End Meeting & Save
        </button>
      )}
    </div>
  );
}

function PlayIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"/></svg>; }
function StopIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>; }
function ClockIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
