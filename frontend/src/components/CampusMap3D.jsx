import React, { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Edges, Line, Html } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import gsap from 'gsap'
import { playHover, playSelect } from '../utils/audio'

// ─── Campus Layout ───
const ROOMS_CFG = [
    { id: 'A101', pos: [-6, 0, -4], name: 'Lecture Hall A1', block: 'A' },
    { id: 'B101', pos: [-2, 0, -4], name: 'Lab Block B1',    block: 'B' },
    { id: 'C101', pos: [ 2, 0, -4], name: 'Seminar Hall C1', block: 'C' },
    { id: 'D101', pos: [ 6, 0, -4], name: 'Computer Lab D1', block: 'D' },
    { id: 'A202', pos: [-6, 0,  2], name: 'Lecture Hall A2', block: 'A' },
    { id: 'B203', pos: [-2, 0,  2], name: 'Lab Block B2',    block: 'B' },
    { id: 'C202', pos: [ 2, 0,  2], name: 'Seminar Hall C2', block: 'C' },
    { id: 'D302', pos: [ 6, 0,  2], name: 'Computer Lab D3', block: 'D' },
]

const HUB_POS  = [10, 0, -1]   // ← RIGHT SIDE (not blocking center view)
const HUB_POS3 = new THREE.Vector3(...HUB_POS)

// ─── Power State Helper ───
function getPowerState(room) {
    if (!room) return { isPowered: false, isWarn: false, isOff: true, isOverride: false }
    const isOverride = !!room.override_active
    const isOccupied = !!room.is_occupied
    const isPowered  = isOccupied || isOverride          // KEY: override = powered
    const isWarn     = room.status === 'predicted_empty_soon' && !isOverride
    const isOff      = !isPowered && !isWarn
    return { isPowered, isWarn, isOff, isOverride }
}

function getPowerVisuals(state) {
    const { isPowered, isWarn, isOff } = state
    return {
        winColor:    isPowered ? '#c8e8ff' : isWarn ? '#ffd080' : '#040a12',
        winEmissive: isPowered ? '#1a66cc' : isWarn ? '#774400' : '#000000',
        winEmt:      isPowered ? 1.1       : isWarn ? 0.65      : 0.0,
        edgeColor:   isPowered ? '#00d68f' : isWarn ? '#ffb300' : '#0f2035',
        roofColor:   isPowered ? '#00ffaa' : isWarn ? '#ffb300' : '#0a1828',
        roofOpt:     isPowered ? 0.45      : isWarn ? 0.22      : 0.03,
        bodyColor:   isPowered ? '#0c1e30' : isWarn ? '#0c1924' : '#060d16',
        ledColor:    isPowered ? '#00ffaa' : isWarn ? '#ffb300' : '#0a1520',
    }
}

// ─── Campus Ground: roads, paths, parking, trees ───
function CampusGround() {
    return (
        <group>
            {/* Main ground */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -1]} receiveShadow>
                <planeGeometry args={[36, 24]} />
                <meshStandardMaterial color="#04090f" roughness={1} />
            </mesh>

            {/* Horizontal road (E-W) */}
            <mesh position={[0, 0.005, -1]}>
                <boxGeometry args={[34, 0.015, 1.6]} />
                <meshStandardMaterial color="#0b1928" roughness={0.95} />
            </mesh>
            {/* Vertical road (N-S) */}
            <mesh position={[0, 0.005, -1]}>
                <boxGeometry args={[1.6, 0.015, 22]} />
                <meshStandardMaterial color="#0b1928" roughness={0.95} />
            </mesh>

            {/* Road dashes (centre line horizontal) */}
            {Array.from({ length: 12 }).map((_, i) => (
                <mesh key={`rdH-${i}`} position={[-14 + i * 2.5, 0.012, -1]}>
                    <boxGeometry args={[1.0, 0.005, 0.07]} />
                    <meshBasicMaterial color="#1a3050" />
                </mesh>
            ))}

            {/* Building base pads */}
            {ROOMS_CFG.map(r => (
                <mesh key={`pad-${r.id}`} position={[r.pos[0], 0.01, r.pos[2]]}>
                    <boxGeometry args={[4.2, 0.02, 3.4]} />
                    <meshStandardMaterial color="#071422" roughness={0.95} />
                </mesh>
            ))}

            {/* Hub platform */}
            <mesh position={[HUB_POS[0], 0.02, HUB_POS[2]]}>
                <cylinderGeometry args={[2.2, 2.5, 0.06, 32]} />
                <meshStandardMaterial color="#091828" roughness={0.8} metalness={0.3} />
            </mesh>
            <mesh position={[HUB_POS[0], 0.06, HUB_POS[2]]}>
                <cylinderGeometry args={[1.8, 2.0, 0.04, 32]} />
                <meshStandardMaterial color="#0d2540" roughness={0.7} metalness={0.4} />
            </mesh>

            {/* Parking lot (bottom right) */}
            <mesh position={[10, 0.005, 6]}>
                <boxGeometry args={[6, 0.01, 4]} />
                <meshStandardMaterial color="#060d16" roughness={1} />
            </mesh>
            {Array.from({ length: 5 }).map((_, i) => (
                <mesh key={`pk-${i}`} position={[7.5 + i * 1.1, 0.013, 6]}>
                    <boxGeometry args={[0.06, 0.005, 3.5]} />
                    <meshBasicMaterial color="#0f2240" />
                </mesh>
            ))}

            {/* Trees */}
            {[
                [-10, 0, -7], [-10, 0, 5], [-3, 0, 8.5], [3, 0, 8.5],
                [-10, 0, -1], [14, 0, -7], [14, 0, 6],
            ].map((pos, i) => (
                <group key={`tree-${i}`} position={pos}>
                    <mesh position={[0, 0.35, 0]}>
                        <cylinderGeometry args={[0.1, 0.15, 0.7, 7]} />
                        <meshStandardMaterial color="#0a180e" roughness={0.9} />
                    </mesh>
                    <mesh position={[0, 0.9, 0]}>
                        <sphereGeometry args={[0.42, 8, 8]} />
                        <meshStandardMaterial color="#0b3a18" roughness={0.8} emissive="#003308" emissiveIntensity={0.3} />
                    </mesh>
                </group>
            ))}

            {/* Power cables on ground from hub toward buildings */}
            {ROOMS_CFG.map(r => {
                const bx = r.pos[0], bz = r.pos[2]
                const pts = [
                    new THREE.Vector3(HUB_POS[0], 0.04, HUB_POS[2]),
                    new THREE.Vector3((HUB_POS[0] + bx) / 2, 0.04, (HUB_POS[2] + bz) / 2),
                    new THREE.Vector3(bx, 0.04, bz),
                ]
                return (
                    <Line key={`cable-${r.id}`}
                        points={pts}
                        color="#0a1e35"
                        lineWidth={1}
                        opacity={0.6}
                        transparent
                    />
                )
            })}
        </group>
    )
}

// ─── Realistic Multi-Storey Building ───
function Building({ data, room, pred, onClick, isSelected }) {
    const groupRef  = useRef()
    const beaconRef = useRef()
    const [hovered, setHover] = useState(false)

    const ps = getPowerState(room)
    const vz = getPowerVisuals(ps)
    const { isPowered, isWarn, isOff, isOverride } = ps

    const W = 3.0, H = 4.2, D = 2.0
    const nFloors = 3
    const fH = H / nFloors   // ≈ 1.4 per floor

    const revealInterior = isSelected || hovered

    // Subtle float animation
    useFrame((state) => {
        if (!groupRef.current) return
        const t   = state.clock.elapsedTime
        const off = data.pos[0] * 0.18
        groupRef.current.position.y = hovered ? 0.22 : Math.sin(t * 0.9 + off) * 0.035

        // Beacon blink
        if (beaconRef.current) {
            const b = isPowered
                ? (Math.sin(t * 4) > 0 ? 1.0 : 0.1)
                : isWarn
                ? (Math.sin(t * 2.5) > 0 ? 0.7 : 0.1)
                : 0.06
            beaconRef.current.material.emissiveIntensity = b
        }
    })

    // Window rows per floor
    const frontWinX = [-0.9, -0.3, 0.3, 0.9]
    const sideWinZ  = [-0.5, 0.5]

    const labelColor  = isPowered ? '#00d68f' : isWarn ? '#ffb300' : '#2a4060'
    const statusTxt   = isPowered && isOverride ? 'OVERRIDE ON'
                      : isPowered              ? 'OCCUPIED'
                      : isWarn                 ? 'EMPTY SOON'
                      :                         'POWERED OFF'

    return (
        <group
            position={[data.pos[0], 0, data.pos[2]]}
            ref={groupRef}
            onClick={onClick}
            onPointerOver={() => { setHover(true); playHover() }}
            onPointerOut={() => setHover(false)}
        >
            {/* ── Podium / base slab ── */}
            <mesh position={[0, 0.08, 0]}>
                <boxGeometry args={[W + 0.4, 0.16, D + 0.4]} />
                <meshStandardMaterial color="#0a1928" roughness={0.9} metalness={0.1} />
            </mesh>

            {/* ── Main tower body ── */}
            <mesh position={[0, H / 2 + 0.16, 0]}>
                <boxGeometry args={[W, H, D]} />
                <meshStandardMaterial
                    color={revealInterior ? '#030810' : vz.bodyColor}
                    transparent
                    opacity={revealInterior ? 0.1 : 1}
                    roughness={0.88}
                    metalness={0.08}
                    depthWrite={!revealInterior}
                />
                <Edges
                    linewidth={isSelected ? 2.8 : hovered ? 2.2 : 1.2}
                    threshold={15}
                    color={vz.edgeColor}
                    opacity={isSelected ? 1 : hovered ? 0.9 : 0.55}
                    transparent
                />
            </mesh>

            {/* ── Horizontal concrete floor bands ── */}
            {Array.from({ length: nFloors + 1 }).map((_, f) => (
                <mesh key={`band-${f}`} position={[0, f * fH + 0.16, 0]}>
                    <boxGeometry args={[W + 0.1, 0.1, D + 0.1]} />
                    <meshStandardMaterial color="#091522" roughness={0.92} metalness={0.05} />
                </mesh>
            ))}

            {/* ── Window panels — front face ── */}
            {Array.from({ length: nFloors }).map((_, f) => frontWinX.map((wx, wi) => (
                <mesh key={`wf-${f}-${wi}`}
                    position={[wx, f * fH + fH * 0.55 + 0.16, D / 2 + 0.012]}>
                    <boxGeometry args={[0.36, fH * 0.52, 0.04]} />
                    <meshStandardMaterial
                        color={vz.winColor}
                        emissive={vz.winEmissive}
                        emissiveIntensity={vz.winEmt}
                        roughness={0.08}
                        metalness={0.4}
                    />
                </mesh>
            )))}

            {/* ── Window panels — back face ── */}
            {Array.from({ length: nFloors }).map((_, f) => frontWinX.map((wx, wi) => (
                <mesh key={`wb-${f}-${wi}`}
                    position={[wx, f * fH + fH * 0.55 + 0.16, -D / 2 - 0.012]}
                    rotation={[0, Math.PI, 0]}>
                    <boxGeometry args={[0.36, fH * 0.52, 0.04]} />
                    <meshStandardMaterial
                        color={vz.winColor}
                        emissive={vz.winEmissive}
                        emissiveIntensity={vz.winEmt}
                        roughness={0.08}
                        metalness={0.4}
                    />
                </mesh>
            )))}

            {/* ── Window panels — side faces ── */}
            {Array.from({ length: nFloors }).map((_, f) => sideWinZ.flatMap((wz, wi) => [
                <mesh key={`wl-${f}-${wi}`}
                    position={[-W / 2 - 0.012, f * fH + fH * 0.55 + 0.16, wz]}
                    rotation={[0, -Math.PI / 2, 0]}>
                    <boxGeometry args={[0.7, fH * 0.52, 0.04]} />
                    <meshStandardMaterial color={vz.winColor} emissive={vz.winEmissive} emissiveIntensity={vz.winEmt} roughness={0.08} metalness={0.4} />
                </mesh>,
                <mesh key={`wr-${f}-${wi}`}
                    position={[W / 2 + 0.012, f * fH + fH * 0.55 + 0.16, wz]}
                    rotation={[0, Math.PI / 2, 0]}>
                    <boxGeometry args={[0.7, fH * 0.52, 0.04]} />
                    <meshStandardMaterial color={vz.winColor} emissive={vz.winEmissive} emissiveIntensity={vz.winEmt} roughness={0.08} metalness={0.4} />
                </mesh>,
            ]))}

            {/* ── Entrance canopy ── */}
            <mesh position={[0, fH * 0.42 + 0.16, D / 2 + 0.35]}>
                <boxGeometry args={[1.4, 0.06, 0.7]} />
                <meshStandardMaterial color="#0a1e34" roughness={0.88} metalness={0.2} />
            </mesh>
            {/* Entrance door */}
            <mesh position={[0, fH * 0.28 + 0.16, D / 2 + 0.014]}>
                <boxGeometry args={[0.6, fH * 0.52, 0.03]} />
                <meshStandardMaterial
                    color={isPowered ? '#003860' : '#020812'}
                    emissive={isPowered ? '#001830' : '#000000'}
                    emissiveIntensity={isPowered ? 0.5 : 0}
                    roughness={0.1} metalness={0.5}
                />
            </mesh>
            {/* Entrance steps */}
            {[0.12, 0.06, 0].map((h, si) => (
                <mesh key={`step-${si}`} position={[0, h, D / 2 + 0.35 + si * 0.18]}>
                    <boxGeometry args={[1.0 - si * 0.1, 0.06, 0.18]} />
                    <meshStandardMaterial color="#0b1e32" roughness={0.9} />
                </mesh>
            ))}

            {/* ── Roof parapet ── */}
            <mesh position={[0, H + 0.16 + 0.06, 0]}>
                <boxGeometry args={[W + 0.16, 0.12, D + 0.16]} />
                <meshStandardMaterial color="#071320" roughness={0.95} />
            </mesh>

            {/* ── Roof LEDs (power state indicator strip) ── */}
            <mesh position={[0, H + 0.16 + 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[W - 0.2, D - 0.2]} />
                <meshBasicMaterial color={vz.roofColor} transparent opacity={vz.roofOpt} toneMapped={false} />
            </mesh>

            {/* ── HVAC boxes on roof ── */}
            {[[-0.6, 0.3], [0.6, -0.3]].map(([rx, rz], i) => (
                <group key={`hvac-${i}`} position={[rx, H + 0.16 + 0.22, rz]}>
                    <mesh>
                        <boxGeometry args={[0.55, 0.28, 0.4]} />
                        <meshStandardMaterial color="#0c1e30" roughness={0.85} metalness={0.3} />
                    </mesh>
                    <mesh position={[0, 0.15, 0]}>
                        <cylinderGeometry args={[0.1, 0.12, 0.1, 8]} />
                        <meshStandardMaterial color="#0a1826" roughness={0.8} />
                    </mesh>
                </group>
            ))}

            {/* ── Roof beacon ── */}
            <mesh ref={beaconRef} position={[0, H + 0.16 + 0.6, 0]}>
                <sphereGeometry args={[0.07, 8, 8]} />
                <meshStandardMaterial
                    color={isPowered ? '#00ffaa' : isWarn ? '#ffb300' : '#112233'}
                    emissive={isPowered ? '#00ffaa' : isWarn ? '#ffb300' : '#001122'}
                    emissiveIntensity={1}
                    toneMapped={false}
                />
            </mesh>

            {/* ── Interior (hover/click) ── */}
            {revealInterior && (
                <group position={[0, fH * 0.5 + 0.16, 0]}>
                    <ClassroomInterior isPowered={isPowered} color={vz.edgeColor} />
                </group>
            )}

            {/* Point light when powered */}
            {isPowered && (
                <pointLight
                    position={[0, H / 2 + 0.16, 0]}
                    intensity={1.2}
                    color={isOverride ? '#ff8844' : '#00d68f'}
                    distance={5}
                    decay={2}
                />
            )}

            {/* ── Floating HTML Label — always above building ── */}
            <Html
                position={[0, H + 0.16 + 1.65, 0]}
                center
                zIndexRange={[50, 0]}
                occlude={false}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                    userSelect: 'none', pointerEvents: 'none',
                }}>
                    <div style={{
                        background: `rgba(4,10,20,0.92)`,
                        border: `2px solid ${labelColor}`,
                        borderRadius: '7px', padding: '3px 11px',
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: '13px', fontWeight: '800',
                        color: '#fff', letterSpacing: '0.06em',
                        boxShadow: `0 0 12px ${labelColor}66`,
                    }}>{data.id}</div>

                    <div style={{
                        background: 'rgba(4,10,20,0.82)',
                        border: `1px solid ${labelColor}55`,
                        borderRadius: '5px', padding: '2px 9px',
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: '11px', fontWeight: '600',
                        color: isPowered ? '#00e5ff' : isWarn ? '#ffb300' : '#2a4060',
                    }}>⚡ {(room?.current_power_kw || 0).toFixed(1)} kW</div>

                    <div style={{
                        background: `${labelColor}22`,
                        border: `1px solid ${labelColor}55`,
                        borderRadius: '4px', padding: '1px 8px',
                        fontSize: '9px', fontWeight: '800',
                        color: labelColor, letterSpacing: '0.09em',
                    }}>{statusTxt}</div>

                    {isWarn && pred?.predicted_empty_minutes != null && (
                        <div style={{
                            background: 'rgba(255,179,0,0.14)',
                            border: '1px solid rgba(255,179,0,0.5)',
                            borderRadius: '4px', padding: '1px 7px',
                            fontSize: '9px', fontWeight: '700', color: '#ffb300',
                        }}>⚠ ~{pred.predicted_empty_minutes}m</div>
                    )}
                </div>
            </Html>

            {/* ── Detail popup (hover/select) ── */}
            {(hovered || isSelected) && room && (
                <Html position={[0, H + 0.16 + 3.1, 0]} center zIndexRange={[100, 0]}>
                    <div style={{
                        background: 'rgba(4,12,22,0.95)',
                        border: `1px solid ${labelColor}88`,
                        padding: '10px 14px', borderRadius: '9px',
                        fontFamily: "'Inter',sans-serif",
                        boxShadow: `0 6px 24px rgba(0,0,0,0.7), 0 0 20px ${labelColor}22`,
                        minWidth: '175px', pointerEvents: 'none',
                        backdropFilter: 'blur(12px)', lineHeight: '1.5',
                    }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: labelColor, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '5px', marginBottom: '7px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{data.id} · {data.name}</span>
                        </div>
                        {[
                            ['Students',     room.student_count ?? '—'],
                            ['Consumption',  `${(room.current_power_kw||0).toFixed(1)} kW`],
                            ['WiFi Devices', room.wifi_devices ?? '—'],
                            ['Lights',       room.lights_on  ? '💡 ON'  : '○ OFF'],
                            ['AC',           room.ac_on      ? '❄ ON'   : '○ OFF'],
                        ].map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '3px 0' }}>
                                <span style={{ color: '#6688aa' }}>{k}</span>
                                <span style={{ fontWeight: '700', color: '#ddeeff' }}>{v}</span>
                            </div>
                        ))}
                        {isOverride && (
                            <div style={{ marginTop: '6px', textAlign: 'center', background: 'rgba(255,112,67,0.14)', border: '1px solid rgba(255,112,67,0.4)', borderRadius: '5px', padding: '3px', fontSize: '10px', color: '#ff7043', fontWeight: '700' }}>
                                🔒 FACULTY OVERRIDE ACTIVE
                            </div>
                        )}
                        {pred?.predicted_empty_minutes != null && !isOverride && (
                            <div style={{ marginTop: '6px', textAlign: 'center', background: 'rgba(255,179,0,0.1)', border: '1px solid rgba(255,179,0,0.35)', borderRadius: '5px', padding: '3px', fontSize: '10px', color: '#ffb300' }}>
                                AI: Power-Down in ~{pred.predicted_empty_minutes}m ({Math.round((pred.prediction_probability ?? 0) * 100)}%)
                            </div>
                        )}
                    </div>
                </Html>
            )}
        </group>
    )
}

// ─── Classroom Interior ───
function ClassroomInterior({ isPowered, color }) {
    return (
        <group>
            <mesh position={[0, -0.72, 0]}>
                <boxGeometry args={[2.9, 0.02, 1.9]} />
                <meshStandardMaterial color="#060d18" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0, -0.95]}>
                <boxGeometry args={[2.9, 1.42, 0.02]} />
                <meshStandardMaterial color="#09182a" roughness={0.9} />
            </mesh>
            {/* Whiteboard */}
            <mesh position={[0, 0.18, -0.94]}>
                <planeGeometry args={[1.6, 0.65]} />
                <meshBasicMaterial color={isPowered ? '#ffffff' : '#0e1e30'} />
            </mesh>
            {/* Desks */}
            {Array.from({ length: 8 }).map((_, i) => (
                <mesh key={i} position={[-0.8 + (i % 4) * 0.55, -0.5, Math.floor(i / 4) * 0.6]}>
                    <boxGeometry args={[0.38, 0.04, 0.22]} />
                    <meshStandardMaterial color="#1a2d40" />
                </mesh>
            ))}
            {/* Ceiling LEDs */}
            {Array.from({ length: 4 }).map((_, i) => (
                <mesh key={`cl-${i}`} position={[-0.7 + i * 0.48, 0.7, 0]}>
                    <boxGeometry args={[0.35, 0.02, 0.1]} />
                    <meshBasicMaterial color={isPowered ? '#e0fff4' : '#060d14'} toneMapped={false} />
                </mesh>
            ))}
        </group>
    )
}

// ─── Transformer Hub (right side) ───
function PowerHub({ hasPredictions, rooms = [] }) {
    const coreRef  = useRef()
    const ring1Ref = useRef()
    const ring2Ref = useRef()
    const waveRef  = useRef()

    const activePower  = rooms.reduce((s, r) => s + (r.current_power_kw || 0), 0)
    const activeRooms  = rooms.filter(r => r.is_occupied || r.override_active).length

    useFrame((state) => {
        const t = state.clock.elapsedTime
        if (coreRef.current)  coreRef.current.rotation.y = t * 1.0
        if (ring1Ref.current) ring1Ref.current.rotation.z = t * 1.4
        if (ring2Ref.current) ring2Ref.current.rotation.x = t * 0.9
        if (waveRef.current && hasPredictions) {
            const cycle = t % 2.0
            waveRef.current.scale.setScalar(1 + cycle * 2.8)
            waveRef.current.material.opacity = Math.max(0, 0.42 - cycle * 0.21)
        }
    })

    return (
        <group position={HUB_POS}>
            {/* Base pedestal */}
            <mesh position={[0, 0.12, 0]}>
                <cylinderGeometry args={[1.5, 1.7, 0.24, 32]} />
                <meshStandardMaterial color="#152535" roughness={0.7} metalness={0.5} />
            </mesh>

            {/* Main transformer body */}
            <mesh position={[0, 0.85, 0]}>
                <boxGeometry args={[1.6, 1.1, 1.2]} />
                <meshStandardMaterial color="#1e3048" roughness={0.65} metalness={0.7} />
            </mesh>

            {/* Cooling fins */}
            {Array.from({ length: 6 }).map((_, i) => (
                <group key={`fin-${i}`}>
                    <mesh position={[-0.87, 0.85, -0.38 + i * 0.15]}>
                        <boxGeometry args={[0.16, 0.88, 0.04]} />
                        <meshStandardMaterial color="#162030" roughness={0.8} />
                    </mesh>
                    <mesh position={[0.87, 0.85, -0.38 + i * 0.15]}>
                        <boxGeometry args={[0.16, 0.88, 0.04]} />
                        <meshStandardMaterial color="#162030" roughness={0.8} />
                    </mesh>
                </group>
            ))}

            {/* Insulators */}
            {[[-0.4, 1.5, -0.28], [0, 1.5, -0.28], [0.4, 1.5, -0.28],
              [-0.4, 1.5,  0.28], [0, 1.5,  0.28], [0.4, 1.5,  0.28]].map((pos, i) => (
                <group key={`ins-${i}`} position={pos}>
                    <mesh>
                        <cylinderGeometry args={[0.06, 0.09, 0.26, 10]} />
                        <meshStandardMaterial color="#7a92a8" roughness={0.25} />
                    </mesh>
                    <mesh position={[0, 0.16, 0]}>
                        <sphereGeometry args={[0.085, 12, 12]} />
                        <meshStandardMaterial color="#b0c8d8" />
                    </mesh>
                    {activeRooms > 0 && (
                        <mesh position={[0, 0.25, 0]}>
                            <sphereGeometry args={[0.03, 8, 8]} />
                            <meshBasicMaterial color="#00e5ff" toneMapped={false} />
                        </mesh>
                    )}
                </group>
            ))}

            {/* Control panel front */}
            <mesh position={[0, 0.75, 0.62]}>
                <boxGeometry args={[0.9, 0.65, 0.08]} />
                <meshStandardMaterial color="#223344" roughness={0.5} metalness={0.5} />
            </mesh>
            <mesh position={[0.2, 0.9, 0.67]}>
                <planeGeometry args={[0.35, 0.15]} />
                <meshBasicMaterial color={activeRooms > 0 ? '#00e5ff' : '#001122'} toneMapped={false} />
            </mesh>
            {/* Status LEDs */}
            {[-0.25, -0.15, -0.05].map((x, i) => (
                <mesh key={`led-${i}`} position={[x, 0.9, 0.67]}>
                    <sphereGeometry args={[0.025, 8, 8]} />
                    <meshBasicMaterial color={i === 0 ? '#00ffaa' : i === 1 && hasPredictions ? '#ffb300' : '#001133'} toneMapped={false} />
                </mesh>
            ))}

            {/* Spinning core */}
            <mesh ref={coreRef} position={[0, 2.1, 0]}>
                <icosahedronGeometry args={[0.32, 1]} />
                <meshBasicMaterial color="#00ffaa" toneMapped={false} wireframe />
            </mesh>

            {/* Orbit rings */}
            <mesh ref={ring1Ref} position={[0, 2.1, 0]}>
                <torusGeometry args={[0.54, 0.018, 8, 48]} />
                <meshBasicMaterial color="#00e5ff" toneMapped={false} />
            </mesh>
            <mesh ref={ring2Ref} position={[0, 2.1, 0]}>
                <torusGeometry args={[0.42, 0.013, 8, 40]} />
                <meshBasicMaterial color="#00ffaa" toneMapped={false} />
            </mesh>

            {/* Prediction pulse ring */}
            {hasPredictions && (
                <mesh ref={waveRef} position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.9, 1.15, 40]} />
                    <meshBasicMaterial color="#ffb300" transparent side={THREE.DoubleSide} toneMapped={false} />
                </mesh>
            )}

            {/* Hub glow light */}
            <pointLight position={[0, 2.2, 0]} intensity={3.5} color="#00ffaa" distance={8} decay={2} />

            {/* Hub HTML label */}
            <Html position={[0, 3.2, 0]} center zIndexRange={[40, 0]}>
                <div style={{
                    background: 'rgba(3,10,20,0.88)',
                    border: '1.5px solid rgba(0,229,255,0.5)',
                    borderRadius: '8px', padding: '6px 14px',
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: '11px', fontWeight: '700',
                    color: '#00e5ff', letterSpacing: '0.04em',
                    whiteSpace: 'nowrap', pointerEvents: 'none',
                    boxShadow: '0 0 12px rgba(0,229,255,0.3)',
                }}>
                    ⚡ TRANSFORMER HUB<br />
                    <span style={{ color: '#00ffaa', fontSize: '13px' }}>
                        {activePower.toFixed(1)} kW
                    </span>
                    <span style={{ color: '#4a6a8a', fontSize: '9px', marginLeft: '6px' }}>
                        {activeRooms}/{rooms.length} ACTIVE
                    </span>
                </div>
            </Html>
        </group>
    )
}

// ─── Energy Stream (Hub → Building) ───
function EnergyStream({ room, buildingPos }) {
    const ps = getPowerState(room)
    const { isPowered, isWarn, isOff } = ps

    const points = useMemo(() => {
        const start = new THREE.Vector3(...HUB_POS)
        const end   = new THREE.Vector3(buildingPos[0], 0.5, buildingPos[2])
        const mid   = start.clone().lerp(end, 0.5)
        mid.y += 1.5
        const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
        return curve.getPoints(50)
    }, [buildingPos])

    const particleRef = useRef()
    const isActive    = isPowered || isWarn
    const speed       = isWarn ? 0.3 : isPowered ? 0.9 : 0

    useFrame((state) => {
        if (!particleRef.current || !isActive) return
        const t   = (state.clock.elapsedTime * speed) % 1
        const idx = Math.floor(t * 49)
        const p1  = points[idx], p2 = points[idx + 1]
        if (p1 && p2) particleRef.current.position.lerpVectors(p1, p2, (t * 49) % 1)
    })

    const lineColor   = isPowered ? '#00d68f' : isWarn ? '#ffb300' : '#04152a'
    const lineWidth   = isPowered ? 1.8 : isWarn ? 1.2 : 0.5
    const lineOpacity = isPowered ? 0.65 : isWarn ? 0.4 : 0.08

    return (
        <group>
            <Line
                points={points}
                color={lineColor}
                lineWidth={lineWidth}
                opacity={lineOpacity}
                transparent
            />
            {isActive && (
                <mesh ref={particleRef}>
                    <sphereGeometry args={[isWarn ? 0.06 : 0.1, 8, 8]} />
                    <meshBasicMaterial
                        color={isWarn ? [1.8, 0.9, 0] : [0.1, 3.5, 2.0]}
                        toneMapped={false}
                    />
                </mesh>
            )}
        </group>
    )
}

// ─── Demand Response Visual Links ───
function DemandResponseLinks({ suggestions }) {
    return (
        <>
            {suggestions.map((s, i) => {
                if (s.rooms.length < 2) return null
                const cfg1 = ROOMS_CFG.find(r => r.id === s.rooms[0])
                const cfg2 = ROOMS_CFG.find(r => r.id === s.rooms[1])
                if (!cfg1 || !cfg2) return null
                const pts = [
                    new THREE.Vector3(cfg1.pos[0], 5.5, cfg1.pos[2]),
                    new THREE.Vector3(
                        (cfg1.pos[0] + cfg2.pos[0]) / 2,
                        6.5,
                        (cfg1.pos[2] + cfg2.pos[2]) / 2
                    ),
                    new THREE.Vector3(cfg2.pos[0], 5.5, cfg2.pos[2]),
                ]
                return (
                    <Line key={i}
                        points={pts}
                        color="#00e5ff"
                        lineWidth={1.4}
                        opacity={0.5}
                        transparent
                        dashed
                        dashScale={4}
                        dashSize={0.6}
                        gapSize={0.3}
                    />
                )
            })}
        </>
    )
}

// ─── Camera Fly-To ───
function CameraController({ selectedRoom }) {
    const { camera } = useThree()
    const prev     = useRef(null)
    const controls = useThree(s => s.controls)

    useEffect(() => {
        if (!selectedRoom || selectedRoom === prev.current || !controls) return
        prev.current = selectedRoom
        const cfg = ROOMS_CFG.find(r => r.id === selectedRoom)
        if (!cfg) return
        playSelect()
        gsap.to(camera.position, {
            x: cfg.pos[0] + 4, y: cfg.pos[1] + 6, z: cfg.pos[2] + 8,
            duration: 1.2, ease: 'power2.inOut',
        })
        gsap.to(controls.target, {
            x: cfg.pos[0], y: cfg.pos[1] + 1.5, z: cfg.pos[2],
            duration: 1.2, ease: 'power2.inOut',
            onUpdate: () => controls.update(),
        })
    }, [selectedRoom, camera, controls])

    return null
}

// ─── Day/Night Lighting ───
function EnvironmentController({ simHour }) {
    const { scene } = useThree()
    const factor    = Math.max(0, Math.sin(((simHour - 6) / 24) * Math.PI * 2))
    const targetBg  = useMemo(() => new THREE.Color().lerpColors(
        new THREE.Color('#010204'),
        new THREE.Color('#04112a'),
        factor
    ), [factor])
    useFrame(() => {
        if (!scene.background) scene.background = new THREE.Color()
        scene.background.lerp(targetBg, 0.05)
    })
    return (
        <>
            <ambientLight intensity={0.45 + factor * 0.9} color="#1a3366" />
            <directionalLight position={[12, 14, 6]} intensity={0.2 + factor * 1.8} color="#88ccff" castShadow />
            <spotLight position={[0, 18, 0]} angle={0.9} penumbra={1} intensity={2.5} color="#00c87a" />
        </>
    )
}

// ─── Main Export ───
export default function CampusMap3D({ rooms, preds, stats, onRoomClick, selectedRoom, simHour = 12, demandSuggestions = [] }) {
    const roomMap = Object.fromEntries(rooms.map(r => [r.id, r]))
    const predMap = Object.fromEntries(preds.map(p => [p.room, p]))
    const hasPredictions = preds.some(p => p.predicted_empty_minutes != null)

    return (
        <Canvas
            camera={{ position: [0, 12, 18], fov: 50 }}
            gl={{ antialias: true }}
            shadows
        >
            <EnvironmentController simHour={simHour} />

            <Grid
                args={[44, 26]}
                cellSize={1} cellThickness={0.5} cellColor="#001a33"
                sectionSize={4} sectionThickness={1.0} sectionColor="#004070"
                fadeDistance={38} fadeStrength={2.5}
                position={[0, 0, -1]}
            />

            <CampusGround />

            <PowerHub hasPredictions={hasPredictions} rooms={rooms} />

            {ROOMS_CFG.map(cfg => {
                const room = roomMap[cfg.id]
                const pred = predMap[cfg.id]
                return (
                    <React.Fragment key={cfg.id}>
                        <Building
                            data={cfg}
                            room={room}
                            pred={pred}
                            isSelected={selectedRoom === cfg.id}
                            onClick={(e) => { e.stopPropagation(); onRoomClick?.(cfg.id) }}
                        />
                        <EnergyStream buildingPos={cfg.pos} room={room} />
                    </React.Fragment>
                )
            })}

            <DemandResponseLinks suggestions={demandSuggestions} />

            <EffectComposer disableNormalPass>
                <Bloom luminanceThreshold={0.45} mipmapBlur luminanceSmoothing={0.85} intensity={1.2} />
            </EffectComposer>

            <CameraController selectedRoom={selectedRoom} />

            <OrbitControls
                makeDefault
                minPolarAngle={0.08}
                maxPolarAngle={Math.PI / 2.05}
                maxDistance={24}
                minDistance={4}
                target={[2, 1.5, -1]}
            />
        </Canvas>
    )
}
