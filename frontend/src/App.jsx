import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import './index.css'
import CampusMap3D from './components/CampusMap3D'
import ClassroomCard from './components/ClassroomCard'
import EnergyDashboard from './components/EnergyDashboard'
import EnergyHeatmap from './components/EnergyHeatmap'
import AlertTicker from './components/AlertTicker'
import AiForecastPanel from './components/AiForecastPanel'
import { playOverride, startAmbient, setMuteState } from './utils/audio'

const API = 'http://localhost:8000/api'

const TIMETABLES = {
  A101: [[8, 10], [11, 13], [14, 16]],
  A202: [[9, 11], [13, 15]],
  B101: [[8, 10], [10, 12], [14, 17]],
  B203: [[10, 12], [15, 17]],
  C101: [[9, 12], [14, 16]],
  C202: [[8, 10], [13, 16]],
  D101: [[9, 11], [11, 13], [15, 17]],
  D302: [[10, 12], [14, 16]],
}

function fmt(iso) {
  if (!iso) return '--:--'
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso) {
  if (!iso) return '---'
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// ─── Demand Response engine (client-side AI) ───
function computeDemandResponse(rooms) {
  const suggestions = []
  const blocks = {}
  rooms.forEach(r => {
    const b = r.id.charAt(0)
    if (!blocks[b]) blocks[b] = []
    blocks[b].push(r)
  })
  Object.entries(blocks).forEach(([block, bRooms]) => {
    const occupied = bRooms.filter(r => r.is_occupied && !r.override_active)
    if (occupied.length >= 2) {
      const totalStudents = occupied.reduce((s, r) => s + (r.student_count || 0), 0)
      const totalPower    = occupied.reduce((s, r) => s + (r.current_power_kw || 0), 0)
      if (totalStudents <= 40) {
        suggestions.push({
          block,
          rooms: occupied.map(r => r.id),
          students: totalStudents,
          savings_kw: +(totalPower / 2).toFixed(1),
        })
      }
    }
  })
  return suggestions
}

export default function App() {
  const [rooms,   setRooms]   = useState([])
  const [preds,   setPreds]   = useState([])
  const [energy,  setEnergy]  = useState([])
  const [stats,   setStats]   = useState(null)
  const [curTime, setCurTime] = useState('')
  const [simHour, setSimHour] = useState(9)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed,   setSpeed]   = useState(1)
  const [expanded, setExpanded] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const timerRef = useRef(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rRes, pRes, eRes, sRes] = await Promise.all([
        fetch(`${API}/rooms`),
        fetch(`${API}/predictions`),
        fetch(`${API}/energy-usage`),
        fetch(`${API}/stats`),
      ])
      const rD = await rRes.json()
      const pD = await pRes.json()
      const eD = await eRes.json()
      const sD = await sRes.json()
      setRooms(rD.rooms || [])
      setPreds(pD.predictions || [])
      setEnergy(eD.energy_usage || [])
      setStats(sD.stats || null)
      setCurTime(rD.current_time || '')
      if (rD.current_time) setSimHour(new Date(rD.current_time).getHours())
    } catch { }
  }, [])

  const step = useCallback(async () => {
    try {
      await fetch(`${API}/simulate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'step', speed }),
      })
      fetchAll()
    } catch { }
  }, [speed, fetchAll])

  const reset = useCallback(async () => {
    setIsPlaying(false)
    try {
      await fetch(`${API}/simulate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      })
      fetchAll()
    } catch { }
  }, [fetchAll])

  const override = useCallback(async (id, active, type='force_on') => {
    playOverride()
    try {
      await fetch(`${API}/override`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: id, active, override_by: 'Faculty', override_type: type }),
      })
      fetchAll()
    } catch { }
  }, [fetchAll])

  const setTime = useCallback(async (h) => {
    try {
      await fetch(`${API}/simulate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_time', hour: h }),
      })
      fetchAll()
    } catch { }
  }, [fetchAll])

  // Auto-play step interval
  useEffect(() => {
    if (isPlaying) {
      const ms = Math.max(700, 3000 / speed)
      timerRef.current = setInterval(step, ms)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [isPlaying, speed, step])

  // Initial fetch + polling every 3s
  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    const poller = setInterval(fetchAll, 3000)
    return () => clearInterval(poller)
  }, [fetchAll])

  // Ambient audio on first interaction
  useEffect(() => {
    const init = () => { startAmbient(); window.removeEventListener('click', init) }
    window.addEventListener('click', init)
    return () => window.removeEventListener('click', init)
  }, [])

  const toggleMute = useCallback(() => {
    const nm = !isMuted; setIsMuted(nm); setMuteState(nm)
  }, [isMuted])

  const exportCSV = useCallback(() => {
    const energyMap = Object.fromEntries(energy.map(e => [e.room, e]))
    const rows = [['Room ID', 'Status', 'Students', 'Power (kW)', 'Efficiency (%)', 'Override', 'Saved (kWh)']]
    rooms.forEach(r => {
      const e = energyMap[r.id] || {}
      rows.push([r.id, r.status, r.student_count, r.current_power_kw,
        e.efficiency_pct?.toFixed(1) ?? 0,
        r.override_active ? 'YES' : 'NO',
        e.energy_saved_kwh?.toFixed(2) ?? 0])
    })
    rows.push([], ['TOTALS', `Energy Saved: ${stats?.total_energy_saved_kwh?.toFixed(2)} kWh`,
      `CO2 Reduced: ${stats?.total_co2_reduced_kg?.toFixed(2)} kg`])
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `PowerSense_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
  }, [rooms, energy, stats])

  const predMap   = Object.fromEntries(preds.map(p => [p.room, p]))
  const energyMap = Object.fromEntries(energy.map(e => [e.room, e]))
  const activeRooms = rooms.filter(r => r.is_occupied || r.override_active).length
  const totalPower  = rooms.reduce((s, r) => s + (r.current_power_kw || 0), 0)
  const [demandSuggestions, setDemandSuggestions] = useState([])
  const lastSugUpdate = useRef(0)

  useEffect(() => {
    const fresh = computeDemandResponse(rooms)
    const now = Date.now()
    if (fresh.length > 0) {
      setDemandSuggestions(fresh)
      lastSugUpdate.current = now
    } else if (now - lastSugUpdate.current > 20000) {
      setDemandSuggestions([])
    }
  }, [rooms])

  return (
    <div className="app-shell">

      {/* ════════════════ HEADER ════════════════ */}
      <header className="app-header">
        {/* Brand */}
        <div className="hd-brand">
          <div className="hd-brand__icon">⚡</div>
          <div>
            <div className="hd-brand__name">PowerSense AI</div>
            <div className="hd-brand__sub">Campus Energy Digital Twin</div>
          </div>
        </div>

        {/* Time */}
        <div className="hd-time">
          <div className="hd-time__clock">{fmt(curTime)}</div>
          <div className="hd-time__date">{fmtDate(curTime)}</div>
        </div>

        {/* System status pills */}
        <div className="hd-status">
          <span className="hd-pill hd-pill--green">
            <span className="hd-pill__dot" />AI Core Online
          </span>
          <span className="hd-pill hd-pill--cyan">
            🔌 {activeRooms}/{rooms.length} Active
          </span>
          <span className="hd-pill hd-pill--yellow">
            ⚡ {totalPower.toFixed(1)} kW Load
          </span>
          {demandSuggestions.length > 0 && (
            <span className="hd-pill hd-pill--orange">
              🤖 {demandSuggestions.length} Optimization{demandSuggestions.length > 1 ? 's' : ''} Ready
            </span>
          )}
        </div>

        {/* Utility */}
        <div className="hd-util">
          <button className="hd-btn" onClick={toggleMute}>
            {isMuted ? '🔇' : '🔊'}
          </button>
          <button className="hd-btn hd-btn--green" onClick={exportCSV}>
            📥 Export
          </button>
        </div>
      </header>

      {/* ════════════════ LEFT PANEL — Controls ════════════════ */}
      <aside className="left-panel">

        {/* Simulation Controls */}
        <div className="lp-section glass-panel">
          <div className="lp-section__head">🎮 Simulation Controls</div>
          <div className="sim-controls">
            <button className={`sim-btn sim-btn--play ${isPlaying ? 'active' : ''}`}
              onClick={() => setIsPlaying(p => !p)}>
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <div className="sim-row">
              <button className="sim-btn" onClick={step} disabled={isPlaying}>⏭ Step</button>
              <button className="sim-btn" onClick={reset}>↺ Reset</button>
            </div>
            <div className="sim-speed">
              <span className="sim-label">Speed</span>
              <div className="speed-btns">
                {[1, 2, 4].map(s => (
                  <button key={s} className={`spd-btn ${speed === s ? 'active' : ''}`}
                    onClick={() => setSpeed(s)}>{s}×</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="lp-section glass-panel">
          <div className="lp-section__head">⏱ Timeline — {simHour}:00</div>
          <div className="timeline-wrap">
            <span className="tl-mark">7am</span>
            <input
              type="range" className="tl-slider"
              min="7" max="23" step="1" value={simHour}
              onChange={e => { const h = parseInt(e.target.value); setSimHour(h); setTime(h) }}
            />
            <span className="tl-mark">11pm</span>
          </div>
          <div className="tl-hours">
            {[8, 10, 12, 14, 16, 18, 20].map(h => (
              <span key={h}
                className={`tl-h ${simHour === h ? 'active' : ''}`}
                onClick={() => { setSimHour(h); setTime(h) }}>
                {h}
              </span>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="lp-stats">
          {[
            { icon: '🔋', label: 'Energy Saved',     val: `${stats?.total_energy_saved_kwh?.toFixed(1) ?? '0.0'} kWh`, cls: 's-g' },
            { icon: '💰', label: 'Cost Saved',        val: `₹${stats?.total_cost_saved?.toFixed(0) ?? '0'}`,          cls: 's-c' },
            { icon: '🌿', label: 'CO₂ Reduced',       val: `${stats?.total_co2_reduced_kg?.toFixed(1) ?? '0.0'} kg`,  cls: 's-p' },
            { icon: '🏫', label: 'Rooms Optimized',   val: `${stats?.rooms_optimized ?? 0}/8`,                         cls: 's-o' },
          ].map(({ icon, label, val, cls }) => (
            <div key={label} className={`lp-stat glass-panel ${cls}`}>
              <div className="lp-stat__icon">{icon}</div>
              <div className="lp-stat__body">
                <div className="lp-stat__label">{label}</div>
                <div className="lp-stat__val">{val}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Grid Capacity bar */}
        <div className="lp-section glass-panel">
          <div className="lp-section__head">⚡ Grid Capacity</div>
          <div className="grid-cap">
            <div className="gc-bar">
              <div className="gc-bar__fill" style={{ width: `${Math.min(100, (totalPower / 25) * 100).toFixed(0)}%` }} />
            </div>
            <div className="gc-labels">
              <span className="gc-label">{totalPower.toFixed(1)} kW used</span>
              <span className="gc-label">25 kW cap</span>
            </div>
          </div>
        </div>

      </aside>

      {/* ════════════════ CENTER — 3D Canvas ════════════════ */}
      <main className="canvas-area">
        <CampusMap3D
          rooms={rooms}
          preds={preds}
          stats={stats}
          onRoomClick={setExpanded}
          selectedRoom={expanded}
          simHour={simHour}
          demandSuggestions={demandSuggestions}
        />

        {/* Alert ticker floats inside canvas area */}
        <div className="canvas-ticker">
          <AlertTicker rooms={rooms} preds={preds} />
        </div>
      </main>

      {/* ════════════════ RIGHT PANEL — Campus Sectors ════════════════ */}
      <aside className="right-panel">
        <div className="rp-head glass-panel">
          <div className="rp-head__title">
            <span>🏫</span> Campus Sectors
          </div>
          <div className="rp-head__badges">
            <span className="rp-badge rp-badge--green">{activeRooms} Active</span>
            <button className="rp-toggle" onClick={() => setPanelOpen(o => !o)}>
              {panelOpen ? '▼' : '▶'}
            </button>
          </div>
        </div>

        {panelOpen && (
          <div className="room-list holographic-scroll">
            {rooms.map(room => (
              <ClassroomCard
                key={room.id}
                room={room}
                pred={predMap[room.id]}
                energy={energyMap[room.id]}
                timetable={TIMETABLES[room.id] || []}
                simHour={simHour}
                expanded={expanded === room.id}
                onToggle={() => setExpanded(expanded === room.id ? null : room.id)}
                onOverride={override}
              />
            ))}
          </div>
        )}
      </aside>

      {/* ════════════════ BOTTOM BAR ════════════════ */}
      <footer className="bottom-bar">

        {/* Live Energy consumption */}
        <div className="bb-section glass-panel">
          <div className="bb-head">📊 Live Energy Consumption</div>
          <div className="bb-body">
            <EnergyDashboard energyUsage={energy} />
          </div>
        </div>

        {/* AI Forecast */}
        <div className="bb-section glass-panel">
          <div className="bb-head">🤖 AI Power-Down Forecast</div>
          <div className="bb-body bb-body--forecast">
            {preds
              .filter(p => p.predicted_empty_minutes != null && p.status !== 'empty')
              .sort((a, b) => a.predicted_empty_minutes - b.predicted_empty_minutes)
              .slice(0, 3)
              .map(p => {
                const urgency = p.predicted_empty_minutes < 5 ? 'urgent' : p.predicted_empty_minutes < 15 ? 'warn' : 'normal'
                return (
                  <div key={p.room} className={`fc-item fc-item--${urgency}`}>
                    <span className="fc-item__room">{p.room}</span>
                    <span className="fc-item__info">⚠ ~{p.predicted_empty_minutes}m</span>
                    <div className="fc-item__bar">
                      <div className="fc-item__bar-fill" style={{ width: `${Math.round((p.prediction_probability ?? 0) * 100)}%` }} />
                    </div>
                    <span className="fc-item__prob">{Math.round((p.prediction_probability ?? 0) * 100)}%</span>
                  </div>
                )
              })}
            {preds.filter(p => p.predicted_empty_minutes != null).length === 0 && (
              <div className="fc-empty">✅ All rooms stable — no shutdowns predicted</div>
            )}
          </div>
        </div>

        {/* Demand Response Optimizer */}
        <div className="bb-section glass-panel">
          <div className="bb-head">🔁 Demand Response Optimizer</div>
          <div className="bb-body bb-body--demand">
            {demandSuggestions.length === 0 ? (
              <div className="dr-empty">✅ Grid optimized — no consolidations needed</div>
            ) : (
              demandSuggestions.map((s, i) => (
                <div key={i} className="dr-card">
                  <div className="dr-card__top">
                    <span className="dr-card__icon">🔀</span>
                    <span className="dr-card__title">Merge Block {s.block} Rooms</span>
                    <span className="dr-card__save">-{s.savings_kw} kW</span>
                  </div>
                  <div className="dr-card__info">
                    {s.rooms.join(' + ')} &nbsp;·&nbsp; {s.students} students → consolidate into 1 room
                  </div>
                  <div className="dr-card__co2">
                    Saves ≈ {(s.savings_kw * 0.82).toFixed(2)} kg CO₂/hr
                  </div>
                </div>
              ))
            )}
            {/* Total savings summary */}
            <div className="dr-summary">
              <span className="dr-summary__label">Total Saved Today</span>
              <span className="dr-summary__val">{stats?.total_energy_saved_kwh?.toFixed(1) ?? '0.0'} kWh</span>
              <span className="dr-summary__label" style={{ marginLeft: '12px' }}>CO₂</span>
              <span className="dr-summary__val">{stats?.total_co2_reduced_kg?.toFixed(2) ?? '0.00'} kg</span>
            </div>
          </div>
        </div>

      </footer>
    </div>
  )
}
