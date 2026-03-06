import { useMemo } from 'react'
import { playSelect } from '../utils/audio'

// Maps room id to class slot labels
const SLOT_LABELS = {
    A101: ['08-10', '11-13', '14-16'],
    A202: ['09-11', '13-15'],
    B101: ['08-10', '10-12', '14-17'],
    B203: ['10-12', '15-17'],
    C101: ['09-12', '14-16'],
    C202: ['08-10', '13-16'],
    D101: ['09-11', '11-13', '15-17'],
    D302: ['10-12', '14-16'],
}

// Which slots are active at simHour
function activeSlots(roomId, simHour, timetable) {
    return (SLOT_LABELS[roomId] || []).map((label, i) => {
        const range = timetable[i]
        if (!range) return { label, on: false }
        const [s, e] = range
        return { label, on: simHour >= s && simHour < e }
    })
}

// WiFi bar component
function WifiSignal({ devices, capacity }) {
    const pct = capacity > 0 ? devices / capacity : 0
    const levels = [.15, .35, .6, .85]
    return (
        <div className="wifi-bars" title={`${devices} devices`}>
            {levels.map((threshold, i) => (
                <div
                    key={i}
                    className={`wifi-bar ${pct >= threshold ? 'lit' : ''}`}
                    style={{ height: `${(i + 1) * 3 + 3}px` }}
                />
            ))}
        </div>
    )
}

function recClass(rec) {
    if (rec === 'turn_off_all') return 'off-all'
    if (rec === 'reduce_power') return 'reduce'
    if (rec === 'manual_override') return 'override'
    return 'keep'
}

function recLabel(rec) {
    if (rec === 'turn_off_all') return '🔴 Turn Off All'
    if (rec === 'reduce_power') return '🟡 Reduce Power'
    if (rec === 'manual_override') return '🟠 Manual Override'
    return '🟢 Keep Power On'
}

export default function ClassroomCard({
    room, pred, energy, timetable, simHour,
    expanded, onToggle, onOverride
}) {
    if (!room) return null

    const status = room.status || 'empty'
    const cls = status === 'occupied' ? 'occ' : status === 'predicted_empty_soon' ? 'warn' : 'emp'

    const slots = useMemo(() => activeSlots(room.id, simHour, timetable), [room.id, simHour, timetable])
    const hasActiveSlot = slots.some(s => s.on)

    const maxStudents = 6
    const visibleCount = room.is_occupied
        ? Math.max(1, Math.round((room.student_count / room.capacity) * maxStudents))
        : 0

    const wifiDevices = pred?.wifi_devices ?? 0
    const predNow = pred ? Math.round(pred.predicted_occupancy * 100) : 0
    const pred30 = pred ? Math.round(pred.predicted_occupancy_30min * 100) : 0
    const rec = pred?.recommendation || 'keep_power_on'

    const powerPct = energy
        ? Math.round((energy.current_power_kw / energy.max_power_kw) * 100)
        : 0

    return (
        <div className={`rc ${cls} ${expanded ? 'expanded' : ''}`}>

            {/* Summary row */}
            <div className="rc__summary" onClick={() => { playSelect(); onToggle() }}>
                <span className="rc__led" />
                <span className="rc__id">{room.id}</span>
                <span className="rc__name">{room.name}</span>

                {/* inline quick stats */}
                <span className="rc__inline-kw">⚡{room.current_power_kw?.toFixed(1)}kW</span>
                {hasActiveSlot && (
                    <span style={{ fontSize: '.6rem', color: 'var(--c-cyan)' }} title="Class in session">📅</span>
                )}

                <span className="rc__badge">
                    {cls === 'occ' ? '● Active' : cls === 'warn' ? '⚠ Emptying' : '○ Empty'}
                </span>
                <span className="rc__chevron">{expanded ? '▲' : '▼'}</span>
            </div>

            {/* EXPANDED DETAIL */}
            {expanded && (
                <div className="rc__detail">

                    {/* Room info */}
                    <div style={{ fontSize: '.7rem', color: 'var(--t3)' }}>
                        🏢 {room.building} · Floor {room.floor} · Capacity {room.capacity}
                    </div>

                    {/* Timetable */}
                    <div className="timetable-row">
                        <span className="tt-label">📅 Schedule</span>
                        {slots.length > 0 ? slots.map(({ label, on }) => (
                            <span key={label} className={`tt-slot ${on ? 'active' : ''}`}>
                                {label}
                            </span>
                        )) : <span style={{ fontSize: '.65rem', color: 'var(--t3)' }}>No classes</span>}
                    </div>

                    {/* Student icons */}
                    <div className="students-row">
                        {Array.from({ length: maxStudents }, (_, i) => (
                            <span key={i} className={`s-icon ${i < visibleCount ? 'on' : 'off'}`}
                                style={{ transitionDelay: `${i * 80}ms` }}>
                                👤
                            </span>
                        ))}
                        <span className="s-count">{room.student_count}/{room.capacity} students</span>
                    </div>

                    {/* WiFi detail */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <WifiSignal devices={wifiDevices} capacity={room.capacity} />
                        <span style={{ fontSize: '.72rem', color: 'var(--t2)' }}>
                            <b style={{ color: 'var(--c-cyan)' }}>{wifiDevices}</b> devices connected
                            &nbsp;({Math.round((wifiDevices / room.capacity) * 100)}% capacity)
                        </span>
                    </div>

                    {/* Devices */}
                    <div className="devices-row">
                        <span className={`dev-tag ${room.lights_on ? 'on' : 'off'}`}>💡 Lights {room.lights_on ? 'ON' : 'OFF'}</span>
                        <span className={`dev-tag ${room.ac_on ? 'on' : 'off'}`}>❄️ AC {room.ac_on ? 'ON' : 'OFF'}</span>
                        <span className={`dev-tag ${room.fans_on ? 'on' : 'off'}`}>🌀 Fans {room.fans_on ? 'ON' : 'OFF'}</span>
                    </div>

                    {/* Prediction metrics */}
                    <div className="metrics-row">
                        <div className="metric-box">
                            <div className="metric-box__label">Occupancy Now</div>
                            <div className={`metric-box__val ${predNow > 60 ? 'green' : predNow > 30 ? 'yellow' : 'red'}`}>{predNow}%</div>
                        </div>
                        <div className="metric-box">
                            <div className="metric-box__label">In 30 min</div>
                            <div className={`metric-box__val ${pred30 > 60 ? 'green' : pred30 > 30 ? 'yellow' : 'red'}`}>{pred30}%</div>
                        </div>
                        <div className="metric-box">
                            <div className="metric-box__label">Power Draw</div>
                            <div className="metric-box__val cyan">{room.current_power_kw?.toFixed(2)} kW</div>
                        </div>
                        <div className="metric-box">
                            <div className="metric-box__label">Saved</div>
                            <div className="metric-box__val green">{energy?.energy_saved_kwh?.toFixed(2) ?? '0'} kWh</div>
                        </div>
                    </div>

                    {/* AI recommendation */}
                    <div className={`ai-rec ${recClass(rec)}`}>
                        🤖 AI Recommendation: <b>{recLabel(rec)}</b>
                    </div>

                    {/* Override */}
                    <button
                        className={`override-btn ${room.override_active ? 'active' : ''}`}
                        onClick={e => { e.stopPropagation(); onOverride(room.id, !room.override_active) }}
                    >
                        {room.override_active ? '🔓 Remove Faculty Override' : '🔒 Faculty Override (Force On)'}
                    </button>
                    {room.override_active && (
                        <div style={{ textAlign: 'center', fontSize: '.62rem', color: 'var(--c-orange)' }}>
                            Manual override active — all devices forced ON
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
