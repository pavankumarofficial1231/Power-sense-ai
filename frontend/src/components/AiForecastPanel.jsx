import { useState, useEffect, useRef } from 'react'

/**
 * AI Forecast Panel — shows upcoming power-down predictions
 * with decrementing real-time seconds countdowns and probability bars.
 */
export default function AiForecastPanel({ preds = [], simHour = 12, speed = 1 }) {
    // Rooms predicted to go empty, sorted by soonest first
    const upcoming = preds
        .filter(p => p.predicted_empty_minutes != null && p.status !== 'empty')
        .sort((a, b) => a.predicted_empty_minutes - b.predicted_empty_minutes)

    // Local countdown state: { [roomId]: secondsLeft }
    const [countdowns, setCountdowns] = useState({})
    const prevPreds = useRef({})

    // Sync prediction minutes to local seconds when backend updates
    useEffect(() => {
        setCountdowns(prev => {
            const next = { ...prev }
            preds.forEach(p => {
                if (p.predicted_empty_minutes != null) {
                    // Only reset if the room prediction changed meaningfully (>2 min diff)
                    const prevSecs = prev[p.room]
                    const newSecs = p.predicted_empty_minutes * 60
                    if (prevSecs == null || Math.abs(prevSecs / 60 - p.predicted_empty_minutes) > 2) {
                        next[p.room] = newSecs
                    }
                }
            })
            return next
        })
        prevPreds.current = Object.fromEntries(preds.map(p => [p.room, p]))
    }, [preds])

    // Decrement every second — but subtract `speed` seconds to match sim pace
    useEffect(() => {
        const timer = setInterval(() => {
            setCountdowns(prev => {
                const next = {}
                Object.entries(prev).forEach(([room, secs]) => {
                    next[room] = Math.max(0, secs - speed)
                })
                return next
            })
        }, 1000)
        return () => clearInterval(timer)
    }, [speed])

    const fmt = (secs) => {
        if (secs <= 0) return '00:00'
        const m = Math.floor(secs / 60).toString().padStart(2, '0')
        const s = (secs % 60).toString().padStart(2, '0')
        return `${m}:${s}`
    }

    if (upcoming.length === 0) return null

    return (
        <div className="forecast-panel glass-panel">
            <div className="forecast-panel__head">
                <span className="forecast-panel__icon">🤖</span>
                <span className="forecast-panel__title">AI Forecast</span>
                <span className="forecast-panel__sub">Next Power Optimizations</span>
            </div>
            <div className="forecast-panel__list">
                {upcoming.slice(0, 4).map(pred => {
                    const secs = countdowns[pred.room] ?? (pred.predicted_empty_minutes * 60)
                    const urgency = secs < 300 ? 'urgent' : secs < 900 ? 'warn' : 'normal'
                    const prob = Math.round((pred.prediction_probability ?? 0.5) * 100)
                    return (
                        <div key={pred.room} className={`forecast-item forecast-item--${urgency}`}>
                            <div className="forecast-item__left">
                                <div className="forecast-item__room">{pred.room}</div>
                                <div className="forecast-item__label">
                                    {secs === 0 ? '⚡ Powering Down' : `⚠ Power down in`}
                                </div>
                            </div>
                            <div className="forecast-item__right">
                                <div className={`forecast-item__timer forecast-timer--${urgency}`}>
                                    {fmt(secs)}
                                </div>
                                <div className="forecast-item__prob-bar">
                                    <div
                                        className="forecast-item__prob-fill"
                                        style={{ width: `${prob}%` }}
                                    />
                                </div>
                                <div className="forecast-item__prob-label">{prob}% confidence</div>
                            </div>
                        </div>
                    )
                })}
            </div>
            {/* Mini timeline markers */}
            <div className="forecast-timeline">
                <div className="forecast-timeline__label">Timeline markers</div>
                <div className="forecast-timeline__bar">
                    {upcoming.slice(0, 4).map(pred => {
                        // Position across a 12-hour day window (7am–19pm = 720 min)
                        const totalMins = 720
                        const minuteOffset = (simHour - 7) * 60 + (pred.predicted_empty_minutes ?? 0)
                        const pct = Math.min(99, Math.max(1, (minuteOffset / totalMins) * 100))
                        return (
                            <div
                                key={pred.room}
                                className="forecast-marker"
                                style={{ left: `${pct}%` }}
                                title={`${pred.room} → power down in ${pred.predicted_empty_minutes} min`}
                            >
                                <div className="forecast-marker__tick" />
                                <div className="forecast-marker__label">{pred.room}</div>
                            </div>
                        )
                    })}
                    {/* Current time cursor */}
                    <div
                        className="forecast-now"
                        style={{ left: `${Math.min(99, ((simHour - 7) / 12) * 100)}%` }}
                    />
                </div>
                <div className="forecast-timeline__ends">
                    <span>7am</span><span>7pm</span>
                </div>
            </div>
        </div>
    )
}
