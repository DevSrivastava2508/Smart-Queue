import React, { useState, useEffect, useCallback, useRef } from 'react';

// Mock Initial Queue Data matching your project's schema
const INITIAL_QUEUE = [
  { id: 'SQ-1042', name: 'Rajesh K. Sharma', age: 52, gender: 'Male', symptoms: 'Chronic knee pain, swelling', phone: '+9198765XXXXX', status: 'ACTIVE', holdCount: 0 },
  { id: 'SQ-1043', name: 'Sunita Devi', age: 43, gender: 'Female', symptoms: 'Severe lower back stiffness', phone: '+9199112XXXXX', status: 'WAITING', holdCount: 0 },
  { id: 'SQ-1044', name: 'Amit Saxena', age: 29, gender: 'Male', symptoms: 'Follow-up on ankle fracture plaster', phone: '+9195601XXXXX', status: 'WAITING', holdCount: 0 },
  { id: 'SQ-1045', name: 'Meena Verma', age: 61, gender: 'Female', symptoms: 'Acute gout flare-up in right toe', phone: '+9198100XXXXX', status: 'WAITING', holdCount: 0 }
];

export default function DoctorQueueDashboard() {
  const [queue, setQueue] = useState(INITIAL_QUEUE);
  const [activePatient, setActivePatient] = useState(INITIAL_QUEUE[0]);
  const [onHoldList, setOnHoldList] = useState([]);
  const [missedList, setMissedList] = useState([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [backendSynced, setBackendSynced] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [smsAlert, setSmsAlert] = useState(null);
  const [portalNotice, setPortalNotice] = useState(null);
  const [sidebarTab, setSidebarTab] = useState('upcoming'); // 'upcoming' | 'onhold' | 'missed'

  const activePatientRef = useRef(activePatient);
  activePatientRef.current = activePatient;

  // Broadcast sync event to main portal tabs
  const broadcastChange = (action, state) => {
    try {
      if (typeof window !== 'undefined') {
        if ('BroadcastChannel' in window) {
          const ch = new BroadcastChannel('smartqueue_live_sync');
          ch.postMessage({ type: 'QUEUE_UPDATED', action, state, timestamp: Date.now() });
          ch.close();
        }
        localStorage.setItem('smartqueue_sync_event', JSON.stringify({ action, timestamp: Date.now() }));
      }
    } catch (e) {}
  };

  // Helper to map backend state to component state
  const syncFromBackendState = useCallback((state) => {
    if (!state) return;
    let mappedActive = null;
    if (state.activeToken) {
      mappedActive = {
        id: state.activeToken.tokenId,
        name: state.activeToken.patientName,
        age: state.activeToken.age,
        gender: state.activeToken.gender,
        symptoms: state.activeToken.problem || 'General OPD Consultation',
        phone: state.activeToken.phone,
        status: 'ACTIVE',
        holdCount: state.activeToken.holdCount || 0
      };
    }

    const mappedWaiting = (state.waitingQueue || []).map((p) => ({
      id: p.tokenId,
      name: p.patientName,
      age: p.age,
      gender: p.gender,
      symptoms: p.problem || 'General OPD Consultation',
      phone: p.phone,
      status: p.status || 'WAITING',
      holdCount: p.holdCount || 0,
      estimatedWaitMins: p.estimatedWaitMins || 0,
      estimatedTime: p.estimatedTime || ''
    }));

    const fullQueue = mappedActive ? [mappedActive, ...mappedWaiting] : mappedWaiting;
    setQueue(fullQueue);

    if (mappedActive?.id !== activePatientRef.current?.id) {
      setActivePatient(mappedActive);
      setElapsedTime(0);
    } else {
      setActivePatient(mappedActive);
    }

    // Map on-hold buffer list
    setOnHoldList((state.onHoldList || []).map(p => ({
      id: p.tokenId,
      name: p.patientName,
      age: p.age,
      gender: p.gender,
      phone: p.phone,
      holdReason: p.holdReason || 'Stepped out for tests/water',
      holdCount: p.holdCount || 1,
      heldAt: p.heldAt || 'Recent'
    })));

    // Map missed/absent list
    setMissedList((state.missedList || []).map(p => ({
      id: p.tokenId,
      name: p.patientName,
      age: p.age,
      gender: p.gender,
      phone: p.phone,
      markedAbsentAt: p.markedAbsentAt || 'Recent'
    })));

    // Emergency Delay State
    setDelayMinutes(state.delayMinutes || 0);
    setEmergencyReason(state.emergencyReason || '');

    setBackendSynced(true);
    setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }, []);

  // Fetch live state from backend API
  const fetchLiveState = useCallback(async () => {
    try {
      const res = await fetch('/api/queue/state');
      if (res.ok) {
        const data = await res.json();
        syncFromBackendState(data);
      }
    } catch (err) {
      console.log('[DoctorQueueDashboard] Local mode:', err.message);
    }
  }, [syncFromBackendState]);

  // Initial load, BroadcastChannel listener, and heartbeat polling with main portal
  useEffect(() => {
    fetchLiveState();

    let channel;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('smartqueue_live_sync');
        channel.onmessage = (event) => {
          if (event.data?.type === 'PATIENT_BOOKED') {
            const p = event.data.patient;
            setPortalNotice(`🎉 New Patient Booked via Portal: ${p?.patientName || 'Patient'} (${p?.tokenId || ''}) added to waiting queue!`);
            fetchLiveState();
          } else if (event.data?.type === 'QUEUE_SYNC' && event.data.state) {
            syncFromBackendState(event.data.state);
          }
        };
      }
    } catch (e) {}

    const handleStorage = (e) => {
      if (e.key === 'smartqueue_sync_event' || e.key === 'smartqueue_patient_booked') {
        fetchLiveState();
      }
    };
    window.addEventListener('storage', handleStorage);

    const interval = setInterval(() => {
      fetchLiveState();
    }, 3000);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, [fetchLiveState, syncFromBackendState]);

  // Timer logic for tracking active consultation duration
  useEffect(() => {
    let timer;
    if (activePatient) {
      timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activePatient]);

  // Auto-dismiss SMS and portal notices
  useEffect(() => {
    if (smsAlert) {
      const timeout = setTimeout(() => setSmsAlert(null), 8000);
      return () => clearTimeout(timeout);
    }
  }, [smsAlert]);

  useEffect(() => {
    if (portalNotice) {
      const timeout = setTimeout(() => setPortalNotice(null), 7000);
      return () => clearTimeout(timeout);
    }
  }, [portalNotice]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Action 1: Call Next Patient in Line
  const handleCallNext = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/queue/next-token', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          syncFromBackendState(data.state);
          broadcastChange('CALL_NEXT', data.state);
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {}

    // Fallback simulation
    setTimeout(() => {
      const remaining = queue.filter(p => p.id !== activePatient?.id);
      if (remaining.length > 0) {
        const nextInLine = { ...remaining[0], status: 'ACTIVE' };
        setQueue([nextInLine, ...remaining.slice(1)]);
        setActivePatient(nextInLine);
        setElapsedTime(0);
      } else {
        setActivePatient(null);
        setQueue([]);
      }
      setIsLoading(false);
    }, 300);
  };

  // Action 2: Put Current Patient on Hold (Move 2 spots back)
  const handlePutOnHold = async () => {
    if (!activePatient) return;
    setIsLoading(true);

    const current = { ...activePatient, holdCount: activePatient.holdCount + 1 };
    const remainingWaiting = queue.filter(p => p.id !== current.id);

    if (current.holdCount >= 2) {
      alert(`${current.id} has been skipped twice. Pushing to Absentee Roster.`);
      await handleMarkAbsent();
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/queue/hold-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Patient stepped out for X-Ray / Lab tests / Water' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          syncFromBackendState(data.state);
          if (data.simulatedSMS) {
            setSmsAlert(data.simulatedSMS);
          }
          broadcastChange('HOLD_TOKEN', data.state);
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {}

    // Fallback simulation
    setTimeout(() => {
      current.status = 'WAITING';
      const insertIndex = Math.min(2, remainingWaiting.length);
      const newQueue = [...remainingWaiting];
      newQueue.splice(insertIndex, 0, current);

      setOnHoldList(prev => [...prev.filter(p => p.id !== current.id), { ...current, holdReason: 'Stepped out for tests/water', heldAt: 'Just now' }]);

      if (newQueue.length > 0) {
        newQueue[0].status = 'ACTIVE';
        setActivePatient(newQueue[0]);
      } else {
        setActivePatient(null);
      }

      setQueue(newQueue);
      setElapsedTime(0);
      setSmsAlert({
        to: current.phone,
        message: `SmartQueue Alert: Token ${current.id} was paused and shifted 2 slots back (~12m buffer). Please return to Chamber #104 immediately.`
      });
      setIsLoading(false);
    }, 300);
  };

  // Action 3: Mark Patient Completely Absent
  const handleMarkAbsent = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/queue/mark-absent', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          syncFromBackendState(data.state);
          broadcastChange('MARK_ABSENT', data.state);
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {}

    // Fallback simulation
    setTimeout(() => {
      const remaining = queue.filter(p => p.id !== activePatient?.id);
      if (activePatient) {
        setMissedList(prev => [activePatient, ...prev.filter(p => p.id !== activePatient.id)]);
      }
      if (remaining.length > 0) {
        const nextActive = { ...remaining[0], status: 'ACTIVE' };
        setQueue([nextActive, ...remaining.slice(1)]);
        setActivePatient(nextActive);
        setElapsedTime(0);
      } else {
        setQueue([]);
        setActivePatient(null);
      }
      setIsLoading(false);
    }, 300);
  };

  // Feature 1: Emergency Ward Delay Toggle (+15m delay override)
  const handleToggleDelay = async () => {
    setIsLoading(true);
    const newDelay = delayMinutes > 0 ? 0 : 15;
    const reason = newDelay > 0 ? "Doctor attending emergency trauma case in ward" : "";

    try {
      const res = await fetch('/api/queue/delay-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delayMinutes: newDelay, reason, active: newDelay > 0 })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          syncFromBackendState(data.state);
          broadcastChange('DELAY_OVERRIDE', data.state);
          setIsLoading(false);
          return;
        }
      }
    } catch (e) {}

    setDelayMinutes(newDelay);
    setEmergencyReason(reason);
    setIsLoading(false);
  };

  // Feature 2: Recall / Re-admit Patient from Hold or Missed list
  const handleRecallPatient = async (tokenId) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/queue/recall-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          syncFromBackendState(data.state);
          broadcastChange('RECALL_PATIENT', data.state);
          setIsLoading(false);
          return;
        }
      }
    } catch (e) {}

    // Fallback: move from on-hold to top of queue
    const held = onHoldList.find(p => p.id === tokenId);
    if (held) {
      setOnHoldList(prev => prev.filter(p => p.id !== tokenId));
      setQueue(prev => [held, ...prev]);
    }
    setIsLoading(false);
  };

  // Feature 3: Reset Demo Queue
  const handleResetQueue = async () => {
    if (!window.confirm("Reset queue to initial demo state?")) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/queue/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          syncFromBackendState(data.state);
          broadcastChange('RESET_QUEUE', data.state);
          setIsLoading(false);
          return;
        }
      }
    } catch (e) {}

    setQueue(INITIAL_QUEUE);
    setActivePatient(INITIAL_QUEUE[0]);
    setOnHoldList([]);
    setMissedList([]);
    setDelayMinutes(0);
    setElapsedTime(0);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 font-sans text-slate-800">
      
      {/* Portal Live Notice Toast */}
      {portalNotice && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl border border-emerald-500/50 flex items-center justify-between gap-3 animate-bounce">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🔔</span>
            <p className="text-xs font-semibold text-emerald-300">{portalNotice}</p>
          </div>
          <button onClick={() => setPortalNotice(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* Simulated SMS Toast notification */}
      {smsAlert && (
        <div className="fixed top-5 right-5 z-50 max-w-md w-full bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 animate-bounce">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📱</span>
              <div>
                <p className="text-xs font-bold text-amber-400">Automated SMS Dispatched</p>
                <p className="text-[11px] text-slate-300">To: {smsAlert.to}</p>
              </div>
            </div>
            <button onClick={() => setSmsAlert(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
          </div>
          <p className="text-xs text-slate-200 mt-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-mono">
            "{smsAlert.message}"
          </p>
        </div>
      )}

      {/* Top Header Panel */}
      <div className="mx-auto max-w-6xl mb-4 flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🩺</span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">SmartQueue Dedicated Doctor Workstation</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">MMG District Hospital • General Medicine &amp; Ortho Wing (Chamber #104)</p>
        </div>
        
        {/* Navigation & Connection Badges */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800 border border-emerald-300 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Live Connected</span>
            {lastSyncTime && <span className="text-[10px] text-emerald-600 font-normal">({lastSyncTime})</span>}
          </span>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 transition-colors shadow-xs"
            title="Return to Main SmartQueue Patient Booking Portal"
          >
            <span>🏠</span>
            <span>Patient Portal</span>
          </a>
          <button
            onClick={handleResetQueue}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
            title="Reset Queue Demo State"
          >
            <span>🔄</span>
            <span>Reset Demo</span>
          </button>
        </div>
      </div>

      {/* Feature 1: Emergency Ward Delay Alert Banner */}
      {delayMinutes > 0 && (
        <div className="mx-auto max-w-6xl mb-5 p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <h4 className="font-bold text-sm text-rose-800">
                Emergency Ward Delay Active (+{delayMinutes} Minutes)
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                {emergencyReason || "Doctor attending emergency trauma case in ward. Staggered arrival notifications sent to patients."}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleDelay}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap shrink-0"
          >
            ✅ Resolve Delay
          </button>
        </div>
      )}

      {/* Main Grid: Consultation Chamber + Multi-Tab Waiting Roster */}
      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Active Patient In Chamber */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <span>🚪</span> Now Consulting Inside Chamber #104
              </h2>
              <span className="text-xs bg-blue-700 font-mono tracking-wider px-2.5 py-1 rounded-md border border-blue-500 font-bold">
                ELAPSED: {formatTime(elapsedTime)}
              </span>
            </div>

            {activePatient ? (
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase tracking-wider font-mono">
                      {activePatient.id}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 mt-2">{activePatient.name}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {activePatient.gender} • {activePatient.age} Years Old • {activePatient.phone}
                    </p>
                  </div>
                  {activePatient.holdCount > 0 && (
                    <span className="text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded-md px-2.5 py-1">
                      ⚠️ Skipped: {activePatient.holdCount}/2 times
                    </span>
                  )}
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-6">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Symptom Triage Profile</h4>
                  <p className="text-sm text-slate-700 mt-1 font-medium">{activePatient.symptoms}</p>
                </div>

                {/* Primary Action Triggers */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={handleCallNext}
                    disabled={isLoading || queue.length <= 1}
                    className="flex justify-center items-center font-semibold text-sm bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white disabled:text-slate-400 py-3 px-4 rounded-xl shadow-sm transition-all active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed"
                  >
                    Next Patient →
                  </button>
                  <button
                    onClick={handlePutOnHold}
                    disabled={isLoading}
                    className="flex justify-center items-center font-semibold text-sm bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 text-white py-3 px-4 rounded-xl shadow-sm transition-all active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed"
                    title="Shifts token 2 spots back in waiting line (~12m buffer) & sends automated SMS"
                  >
                    ⏳ Put on Hold (+2 slots)
                  </button>
                  <button
                    onClick={handleMarkAbsent}
                    disabled={isLoading}
                    className="flex justify-center items-center font-semibold text-sm bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 py-3 px-4 rounded-xl transition-all active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed"
                    title="Marks patient absent and pushes to missed roster"
                  >
                    ✕ Mark Absent
                  </button>
                </div>

                {/* Secondary Feature Row: Ward Delay Toggle */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Chamber Emergency Protocol:</span>
                  <button
                    onClick={handleToggleDelay}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                      delayMinutes > 0
                        ? 'bg-rose-100 border-rose-300 text-rose-800 hover:bg-rose-200'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>🚨</span>
                    <span>{delayMinutes > 0 ? 'Resolve Ward Delay' : 'Trigger Ward Delay (+15m)'}</span>
                  </button>
                </div>

              </div>
            ) : (
              <div className="p-12 text-center">
                <span className="text-3xl block mb-2">🎉</span>
                <p className="text-slate-600 font-bold">No patients currently left in the active room roster queue.</p>
                <p className="text-xs text-slate-400 mt-1">All OPD slots completed or cleared.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Multi-Tab Live Roster (Upcoming, Buffer Hold, Absentee) */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
          
          {/* Roster Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setSidebarTab('upcoming')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center ${
                sidebarTab === 'upcoming' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Upcoming ({Math.max(0, queue.length - 1)})
            </button>
            <button
              onClick={() => setSidebarTab('onhold')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center ${
                sidebarTab === 'onhold' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              On Hold ({onHoldList.length})
            </button>
            <button
              onClick={() => setSidebarTab('missed')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center ${
                sidebarTab === 'missed' ? 'bg-white text-rose-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Missed ({missedList.length})
            </button>
          </div>

          {/* TAB 1: UPCOMING QUEUE */}
          {sidebarTab === 'upcoming' && (
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {queue.slice(1).map((patient, index) => (
                <div 
                  key={patient.id} 
                  className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl transition-all hover:border-slate-300"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-slate-500">{patient.id}</span>
                      <h4 className="text-sm font-semibold text-slate-800 truncate">{patient.name}</h4>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Est. wait: ~{(index + 1) * 6 + delayMinutes} mins
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded-lg shrink-0">
                    #{index + 1}
                  </span>
                </div>
              ))}
              {queue.length <= 1 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No upcoming patients in line behind this slot.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ON-HOLD BUFFER LIST (Feature 2) */}
          {sidebarTab === 'onhold' && (
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {onHoldList.map((patient) => (
                <div 
                  key={patient.id} 
                  className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-amber-800">{patient.id}</span>
                      <span className="font-semibold text-slate-900">{patient.name}</span>
                    </div>
                    <span className="bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
                      Hold {patient.holdCount}/2
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    📍 {patient.holdReason}
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-amber-200/60">
                    <span className="text-[10px] text-slate-400 font-mono">{patient.phone}</span>
                    <button
                      onClick={() => handleRecallPatient(patient.id)}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                    >
                      ↩ Recall Next
                    </button>
                  </div>
                </div>
              ))}
              {onHoldList.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No patients currently on buffer hold.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MISSED / ABSENTEE ROSTER (Feature 2) */}
          {sidebarTab === 'missed' && (
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {missedList.map((patient) => (
                <div 
                  key={patient.id} 
                  className="p-3 bg-rose-50/60 border border-rose-200 rounded-xl text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-rose-800">{patient.id}</span>
                      <span className="font-semibold text-slate-900">{patient.name}</span>
                    </div>
                    <span className="bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
                      Missed / Absent
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-rose-200/60">
                    <span className="text-[10px] text-slate-400">{patient.phone}</span>
                    <button
                      onClick={() => handleRecallPatient(patient.id)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                    >
                      🔄 Re-admit
                    </button>
                  </div>
                </div>
              ))}
              {missedList.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No patients recorded in absentee roster.
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
