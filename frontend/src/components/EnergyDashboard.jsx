import React from 'react'

export default function EnergyDashboard({ energyUsage = [] }) {
    const maxOverall = Math.max(...energyUsage.map(d => d.max_power_kw || 1), 2.5)
    const segments = 12

    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', minHeight: 0, gap: '8px', padding: '4px 0', width: '100%' }}>
            {energyUsage.map(room => {
                const pct = Math.min(((room.current_power_kw || 0) / maxOverall), 1)
                const eff = room.efficiency_pct || 0
                // Neon colors: Green/Cyan for good, Amber for medium, Red for bad
                const color = eff > 55 ? '#00e5ff' : eff > 25 ? '#ffb300' : '#ff4757'

                const litCount = Math.ceil(pct * segments)

                return (
                    <div key={room.room} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>

                        {/* Power Value Label */}
                        <div style={{ textAlign: 'center', fontSize: '9px', color: color, marginBottom: '6px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 'bold', textShadow: `0 0 5px ${color}` }}>
                            {room.current_power_kw?.toFixed(1)}
                        </div>

                        {/* LED Equalizer Track */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', gap: '3px' }}>
                            {Array.from({ length: segments }).map((_, i) => {
                                const isLit = i < litCount
                                return (
                                    <div key={i} style={{
                                        flex: 1,
                                        width: '100%',
                                        backgroundColor: isLit ? color : 'rgba(255, 255, 255, 0.04)',
                                        borderRadius: '2px',
                                        boxShadow: isLit ? `0 0 6px ${color}` : 'none',
                                        opacity: isLit ? 1 : 0.6,
                                        transition: 'all 0.5s ease-out'
                                    }} />
                                )
                            })}
                        </div>

                        {/* Room Label */}
                        <div style={{ textAlign: 'center', fontSize: '9px', color: 'var(--t3)', marginTop: '8px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>
                            {room.room}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
