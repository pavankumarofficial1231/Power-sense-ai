import { useState, useEffect, useRef } from 'react'

/**
 * Live holographic alert ticker — shows scrolling notifications
 * whenever the AI optimizes a room or a status change occurs.
 */
export default function AlertTicker({ rooms = [], preds = [] }) {
    const [alerts, setAlerts] = useState([])
    const prevRef = useRef({})
    const idCounter = useRef(0)

    useEffect(() => {
        if (!rooms.length) return

        const now = Date.now()
        const prev = prevRef.current
        const newAlerts = []

        rooms.forEach(room => {
            const old = prev[room.id]
            if (!old) return // first render, skip

            // Room just powered down (was occupied, now empty)
            if (old.is_occupied && !room.is_occupied) {
                newAlerts.push({
                    id: ++idCounter.current,
                    time: now,
                    type: 'power-down',
                    icon: '🔴',
                    msg: `${room.id} powered down — AI saving ${room.current_power_kw?.toFixed(1) || '0'}kW`,
                })
            }

            // Room just activated (was empty, now occupied)
            if (!old.is_occupied && room.is_occupied) {
                newAlerts.push({
                    id: ++idCounter.current,
                    time: now,
                    type: 'power-up',
                    icon: '🟢',
                    msg: `${room.id} activated — ${room.student_count} students detected`,
                })
            }

            // Override toggled on
            if (!old.override_active && room.override_active) {
                newAlerts.push({
                    id: ++idCounter.current,
                    time: now,
                    type: 'override',
                    icon: '🟠',
                    msg: `${room.id} faculty override engaged — force ON`,
                })
            }

            // Override toggled off
            if (old.override_active && !room.override_active) {
                newAlerts.push({
                    id: ++idCounter.current,
                    time: now,
                    type: 'override-off',
                    icon: '🔓',
                    msg: `${room.id} override released — AI control restored`,
                })
            }
        })

        // Save current state for next comparison
        prevRef.current = Object.fromEntries(rooms.map(r => [r.id, { ...r }]))

        if (newAlerts.length) {
            setAlerts(prev => [...newAlerts, ...prev].slice(0, 3)) // keep max 3
        }
    }, [rooms])

    // Auto-expire old alerts after 4s
    useEffect(() => {
        const timer = setInterval(() => {
            const cutoff = Date.now() - 4000
            setAlerts(prev => prev.filter(a => a.time > cutoff))
        }, 1000)
        return () => clearInterval(timer)
    }, [])

    if (!alerts.length) return null

    return (
        <div className="ticker-container">
            {alerts.map((alert, i) => (
                <div
                    key={alert.id}
                    className={`ticker-item ticker-${alert.type}`}
                    style={{ animationDelay: `${i * 60}ms` }}
                >
                    <span className="ticker-icon">{alert.icon}</span>
                    <span className="ticker-msg">{alert.msg}</span>
                    <span className="ticker-time">
                        {new Date(alert.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                </div>
            ))}
        </div>
    )
}
