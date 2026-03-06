import { useState } from 'react'

const SCHEDULE = {
    A101: [[8, 10], [11, 13], [14, 16]],
    A202: [[9, 11], [13, 15]],
    B101: [[8, 10], [10, 12], [14, 17]],
    B203: [[10, 12], [15, 17]],
    C101: [[9, 12], [14, 16]],
    C202: [[8, 10], [13, 16]],
    D101: [[9, 11], [11, 13], [15, 17]],
    D302: [[10, 12], [14, 16]],
}

export default function EnergyHeatmap({ energyUsage = [] }) {
    const getColors = (eff) => {
        if (eff > 65) return { bg: 'rgba(0,214,143,.18)', border: 'rgba(0,214,143,.3)', text: '#00d68f' }
        if (eff > 40) return { bg: 'rgba(0,191,165,.15)', border: 'rgba(0,191,165,.25)', text: '#00bfa5' }
        if (eff > 20) return { bg: 'rgba(255,179,0,.15)', border: 'rgba(255,179,0,.25)', text: '#ffb300' }
        return { bg: 'rgba(255,71,87,.12)', border: 'rgba(255,71,87,.2)', text: '#ff4757' }
    }

    const [view, setView] = useState('efficiency')

    return (
        <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: '.6rem', textTransform: 'uppercase' }}>
                <button onClick={() => setView('efficiency')} style={{ padding: '4px 8px', borderRadius: 4, cursor: 'pointer', border: view === 'efficiency' ? '1px solid var(--c-cyan)' : '1px solid var(--border)', background: view === 'efficiency' ? 'rgba(0,229,255,.1)' : 'transparent', color: view === 'efficiency' ? 'var(--c-cyan)' : 'var(--t3)' }}>Efficiency</button>
                <button onClick={() => setView('busy')} style={{ padding: '4px 8px', borderRadius: 4, cursor: 'pointer', border: view === 'busy' ? '1px solid var(--c-cyan)' : '1px solid var(--border)', background: view === 'busy' ? 'rgba(0,229,255,.1)' : 'transparent', color: view === 'busy' ? 'var(--c-cyan)' : 'var(--t3)' }}>Busy Time</button>
            </div>

            {view === 'efficiency' && (
                <div className="heatmap">
                    {energyUsage.map(room => {
                        const { bg, border, text } = getColors(room.efficiency_pct || 0)
                        return (
                            <div key={room.room} className="hm-cell"
                                style={{ background: bg, borderColor: border, color: text }}>
                                <div className="hm-cell__id">{room.room}</div>
                                <div className="hm-cell__val">{room.current_power_kw?.toFixed(1)} kW</div>
                                <div className="hm-cell__val">💾 {room.efficiency_pct?.toFixed(0)}%</div>
                                {room.override_active && (
                                    <div style={{ fontSize: '.55rem', color: '#ff7043', marginTop: '2px' }}>⚠ OVR</div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {view === 'busy' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {energyUsage.map(room => {
                        const sched = SCHEDULE[room.room] || []
                        const activeHours = []
                        sched.forEach(([s, e]) => { for (let h = s; h < e; h++) activeHours.push(h) })
                        return (
                            <div key={room.room} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div style={{ width: 32, fontSize: '.6rem', color: 'var(--c-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>{room.room}</div>
                                <div style={{ flex: 1, display: 'flex', gap: 2 }}>
                                    {Array.from({ length: 12 }).map((_, i) => {
                                        const h = i + 7 // 7am to 7pm (18:59)
                                        const isBusy = activeHours.includes(h)
                                        return <div key={h} style={{ flex: 1, height: 12, borderRadius: 2, background: isBusy ? 'var(--c-yellow)' : 'rgba(255,255,255,.05)', opacity: isBusy ? 1 : 0.4 }} title={`${h}:00`} />
                                    })}
                                </div>
                            </div>
                        )
                    })}
                    <div style={{ display: 'flex', alignSelf: 'flex-end', gap: 4, fontSize: '.5rem', color: 'var(--t3)', marginTop: 4, width: 'calc(100% - 36px)', justifyContent: 'space-between' }}>
                        <span>7am</span><span>12pm</span><span>6pm</span>
                    </div>
                </div>
            )}
        </div>
    )
}
