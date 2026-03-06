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

// Positions in the SVG viewport (740 × 420)
const ROOMS_CFG = [
    { id: 'A101', label: 'A101', x: 55, y: 55, w: 95, h: 65, building: 'Block A', floor: 1 },
    { id: 'A202', label: 'A202', x: 55, y: 145, w: 95, h: 65, building: 'Block A', floor: 2 },
    { id: 'B101', label: 'B101', x: 210, y: 55, w: 95, h: 65, building: 'Block B', floor: 1 },
    { id: 'B203', label: 'B203', x: 210, y: 145, w: 95, h: 65, building: 'Block B', floor: 2 },
    { id: 'C101', label: 'C101', x: 365, y: 55, w: 95, h: 65, building: 'Block C', floor: 1 },
    { id: 'C202', label: 'C202', x: 365, y: 145, w: 95, h: 65, building: 'Block C', floor: 2 },
    { id: 'D101', label: 'D101', x: 520, y: 55, w: 95, h: 65, building: 'Block D', floor: 1 },
    { id: 'D302', label: 'D302', x: 520, y: 145, w: 95, h: 65, building: 'Block D', floor: 3 },
]

const HUB = { x: 295, y: 340 }

function statusColor(status) {
    if (status === 'occupied') return '#00d68f'
    if (status === 'predicted_empty_soon') return '#ffb300'
    return '#ff4757'
}

export default function CampusMap({ rooms, preds, simHour }) {
    const roomMap = Object.fromEntries(rooms.map(r => [r.id, r]))
    const predMap = Object.fromEntries(preds.map(p => [p.room, p]))

    return (
        <svg viewBox="0 0 740 420" className="campus-svg">
            <defs>
                {/* Glow filters */}
                {[
                    ['fg', '#00d68f'], ['fy', '#ffb300'], ['fr', '#ff4757'], ['fc', '#00e5ff'],
                ].map(([id, col]) => (
                    <filter key={id} id={id} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="b" />
                        <feFlood floodColor={col} floodOpacity=".6" result="c" />
                        <feComposite in="c" in2="b" operator="in" result="g" />
                        <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                ))}

                {/* Subtle grid pattern */}
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,.025)" strokeWidth=".5" />
                </pattern>
            </defs>

            {/* Background */}
            <rect width="740" height="420" fill="url(#grid)" rx="16" />

            {/* Building group labels */}
            {['Block A', 'Block B', 'Block C', 'Block D'].map((b, i) => (
                <text key={b} x={102 + i * 155} y={35}
                    fill="#4a5578" fontSize="10" textAnchor="middle"
                    fontWeight="700" fontFamily="Inter" letterSpacing="2">
                    {b.toUpperCase()}
                </text>
            ))}

            {/* Power wires hub → each room */}
            {ROOMS_CFG.map(cfg => {
                const room = roomMap[cfg.id]
                const status = room?.status || 'empty'
                const isOcc = status === 'occupied'
                const isWarn = status === 'predicted_empty_soon'
                const mx = cfg.x + cfg.w / 2
                const my = cfg.y + cfg.h

                const wireClass = isOcc ? 'wire-active' : isWarn ? 'wire-warn' : 'wire-dead'

                return (
                    <path key={`w-${cfg.id}`}
                        className={wireClass}
                        d={`M ${HUB.x} ${HUB.y}
                C ${HUB.x} ${my + 30} ${mx} ${my + 30} ${mx} ${my}`}
                    />
                )
            })}

            {/* Room blocks */}
            {ROOMS_CFG.map(cfg => {
                const room = roomMap[cfg.id]
                const pred = predMap[cfg.id]
                const status = room?.status || 'empty'
                const col = statusColor(status)
                const isOcc = status === 'occupied'
                const isWarn = status === 'predicted_empty_soon'

                const filterMap = { occupied: 'fg', predicted_empty_soon: 'fy', empty: 'fr' }
                const f = filterMap[status]

                // Timetable: is a class scheduled now?
                const tt = TIMETABLES[cfg.id] || []
                const classNow = tt.some(([s, e]) => simHour >= s && simHour < e)

                // Student icons count
                const cap = room?.capacity || 30
                const count = isOcc ? Math.max(1, Math.round((room.student_count / cap) * 4)) : 0
                const icons = ['👤', '👤', '👤', '👤']

                // WiFi pct
                const wifiPct = pred ? pred.wifi_devices / cap : 0

                return (
                    <g key={cfg.id} style={{ cursor: 'pointer' }}>
                        {/* Shadow */}
                        <rect x={cfg.x + 3} y={cfg.y + 3} width={cfg.w} height={cfg.h} rx={8}
                            fill="rgba(0,0,0,.4)" />

                        {/* Building body */}
                        <rect x={cfg.x} y={cfg.y} width={cfg.w} height={cfg.h} rx={8}
                            fill={`${col}12`} stroke={col} strokeWidth={isOcc || isWarn ? 1.8 : 1}
                            filter={`url(#${f})`}
                            style={{ transition: 'all .6s ease', opacity: isOcc ? 1 : isWarn ? .85 : .55 }}
                        />

                        {/* Inner glow when occupied */}
                        {isOcc && (
                            <rect x={cfg.x + 6} y={cfg.y + 6} width={cfg.w - 12} height={cfg.h - 12} rx={5}
                                fill={col} opacity=".07">
                                <animate attributeName="opacity" values=".04;.1;.04" dur="3s" repeatCount="indefinite" />
                            </rect>
                        )}

                        {/* Room ID */}
                        <text x={cfg.x + cfg.w / 2} y={cfg.y + 22}
                            fill={col} fontSize="12" textAnchor="middle"
                            fontWeight="700" fontFamily="JetBrains Mono, monospace">
                            {cfg.id}
                        </text>

                        {/* Schedule icon */}
                        {classNow && (
                            <text x={cfg.x + cfg.w - 10} y={cfg.y + 14}
                                fontSize="9" textAnchor="middle">📅</text>
                        )}

                        {/* Status dot (top-right) */}
                        <circle cx={cfg.x + cfg.w - 10} cy={cfg.y + 10} r={4} fill={col}>
                            {isOcc && (
                                <animate attributeName="opacity" values="1;.3;1" dur="2s" repeatCount="indefinite" />
                            )}
                        </circle>

                        {/* Student icons */}
                        <text x={cfg.x + cfg.w / 2} y={cfg.y + 40}
                            fontSize="9" textAnchor="middle"
                            opacity={isOcc ? 1 : .15}
                            style={{ transition: 'opacity .7s ease' }}>
                            {icons.slice(0, count).join('')}{icons.slice(count).map(() => '').join('')}
                        </text>

                        {/* WiFi bars (tiny) */}
                        {[0, .3, .6, .9].map((t, i) => (
                            <rect key={i}
                                x={cfg.x + 8 + i * 5} y={cfg.y + cfg.h - 8 - (i + 1) * 3}
                                width={4} height={(i + 1) * 3}
                                rx={1}
                                fill={wifiPct >= t ? col : '#2a3055'}
                                opacity={wifiPct >= t ? .9 : .3}
                                style={{ transition: 'fill .5s,opacity .5s' }}
                            />
                        ))}

                        {/* Power label */}
                        <text x={cfg.x + cfg.w / 2} y={cfg.y + cfg.h - 4}
                            fill={isOcc ? '#00e5ff' : '#4a5578'} fontSize="8"
                            textAnchor="middle" fontFamily="JetBrains Mono, monospace">
                            ⚡{room?.current_power_kw?.toFixed(1) || '0.0'}
                        </text>
                    </g>
                )
            })}

            {/* Central power hub */}
            <g>
                <rect x={HUB.x - 52} y={HUB.y - 22} width={104} height={44} rx={10}
                    fill="rgba(0,229,255,.07)" stroke="#00e5ff" strokeWidth="1.5"
                    filter="url(#fc)" />
                <text x={HUB.x} y={HUB.y - 4}
                    fill="#00e5ff" fontSize="10" textAnchor="middle"
                    fontWeight="700" fontFamily="JetBrains Mono, monospace">
                    ⚡ MAIN GRID
                </text>
                <text x={HUB.x} y={HUB.y + 12}
                    fill="#4a5578" fontSize="8" textAnchor="middle"
                    fontFamily="Inter">Power Substation</text>
            </g>

            {/* Legend footer */}
            <text x={370} y={412}
                fill="#2a3055" fontSize="9" textAnchor="middle"
                fontFamily="Inter" letterSpacing="3" fontWeight="600">
                POWERSENSE AI — CAMPUS ENERGY GRID
            </text>
        </svg>
    )
}
