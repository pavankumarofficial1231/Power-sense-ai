import React, { useRef, useMemo, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Edges, Line, Html, Text } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import gsap from 'gsap'
import { playHover, playSelect } from '../utils/audio'

// ── Sky / Stars / Sun / Moon ──
function SkyDome({simHour}){
  const meshRef=useRef(), sunRef=useRef(), moonRef=useRef(), halRef=useRef(), starRef=useRef()
  const isNight=simHour<7||simHour>=19
  const isDawn=(simHour>=5&&simHour<8)||(simHour>=17&&simHour<20)
  const factor=Math.max(0,Math.sin(((simHour-6)/24)*Math.PI*2))
  // Real sky colors
  const skyNight=new THREE.Color('#010510')
  const skyMidday=new THREE.Color('#1a75c8')   // proper day blue
  const skyDawn=new THREE.Color('#c45c20')     // sunrise orange
  const skyColor=isNight?skyNight:isDawn?skyDawn:skyMidday
  // Sun arc
  const sunAngle=(simHour-6)/12*Math.PI
  const sunX=Math.cos(sunAngle)*30, sunY=Math.max(0.5,Math.sin(sunAngle)*22)
  const moonAngle=((simHour+12)%24-6)/12*Math.PI
  const moonX=Math.cos(moonAngle)*28, moonY=Math.max(0.5,Math.sin(moonAngle)*18)
  const starPositions=useMemo(()=>{
    const pos=[]
    for(let i=0;i<320;i++){
      const t2=Math.random()*Math.PI*2, p=Math.random()*Math.PI*0.55
      const r=48+Math.random()*4
      pos.push(r*Math.sin(p)*Math.cos(t2),r*Math.cos(p)+4,r*Math.sin(p)*Math.sin(t2))
    }
    return new Float32Array(pos)
  },[])
  useFrame(s=>{
    const t=s.clock.elapsedTime
    // Smoothly lerp sky colour
    if(meshRef.current) meshRef.current.material.color.lerp(skyColor,0.03)
    // Twinkling stars
    if(starRef.current){
      starRef.current.material.opacity=isNight?0.6+Math.sin(t*2.1)*0.35:0
      starRef.current.material.needsUpdate=true
    }
    // Sun + halo
    if(sunRef.current) sunRef.current.material.opacity=isNight?0:0.98
    if(halRef.current) halRef.current.material.opacity=isNight?0:factor*0.22
    if(moonRef.current) moonRef.current.material.opacity=isNight?0.92:0
  })
  return(
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[55,28,20]}/>
        <meshBasicMaterial color={skyNight} side={THREE.BackSide}/>
      </mesh>
      {/* Stars */}
      <points ref={starRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={320} array={starPositions} itemSize={3}/>
        </bufferGeometry>
        <pointsMaterial size={0.2} color="#ffffff" transparent opacity={0} sizeAttenuation/>
      </points>
      {/* Sun */}
      <mesh ref={sunRef} position={[sunX,sunY,-26]}>
        <sphereGeometry args={[2.5,20,20]}/>
        <meshBasicMaterial color="#fff9e0" transparent opacity={0} toneMapped={false}/>
      </mesh>
      {/* Sun halo */}
      <mesh ref={halRef} position={[sunX,sunY,-27]}>
        <sphereGeometry args={[5.5,14,14]}/>
        <meshBasicMaterial color="#ffe88a" transparent opacity={0} toneMapped={false}/>
      </mesh>
      {!isNight&&<pointLight position={[sunX,sunY,-18]} intensity={factor*5} color="#fff4b0" distance={250}/>}
      {/* Moon */}
      <mesh ref={moonRef} position={[moonX,moonY,-26]}>
        <sphereGeometry args={[1.6,16,16]}/>
        <meshBasicMaterial color="#d8e4ee" transparent opacity={0} toneMapped={false}/>
      </mesh>
      {isNight&&<pointLight position={[moonX,moonY,-18]} intensity={0.5} color="#aaccee" distance={220}/>}
    </group>
  )
}

// ── Clouds (day only) ──
const CLOUD_PTS=[[0,0,0,0.9],[1.4,0.3,0,0.75],[-1.4,0.35,0,0.8],[0.7,0.6,0,0.7],[-0.7,0.5,0,0.68],[2.0,-0.1,0,0.62],[-2.1,0.1,0,0.65],[1.0,-0.05,0.8,0.58],[-1.0,0.2,-0.8,0.6]]
function Cloud({pos,scale=1,speed=0.012,offset=0,isNight}){
  const ref=useRef()
  useFrame(s=>{
    if(ref.current){
      ref.current.position.x=pos[0]+Math.sin(s.clock.elapsedTime*speed+offset)*14
      ref.current.position.y=pos[1]+Math.cos(s.clock.elapsedTime*speed*0.7+offset)*0.4
    }
  })
  return(
    <group ref={ref} position={pos}>
      {CLOUD_PTS.map(([cx,cy,cz,r],i)=>(
        <mesh key={i} position={[cx*scale,cy*scale,cz*scale]}>
          <sphereGeometry args={[r*scale,7,7]}/>
          <meshBasicMaterial color="#f5f8ff" transparent opacity={isNight?0:0.76} depthWrite={false}/>
        </mesh>
      ))}
    </group>
  )
}

const ROOMS_CFG = [
  { id:'A101', pos:[-14,0,-10], name:'Lecture Hall A1', block:'A' },
  { id:'B101', pos:[-5,0,-10],  name:'Lab Block B1',    block:'B' },
  { id:'C101', pos:[ 5,0,-10],  name:'Seminar Hall C1', block:'C' },
  { id:'D101', pos:[ 14,0,-10], name:'Computer Lab D1', block:'D' },
  { id:'A202', pos:[-14,0, 8],  name:'Lecture Hall A2', block:'A' },
  { id:'B203', pos:[-5,0,  8],  name:'Lab Block B2',    block:'B' },
  { id:'C202', pos:[ 5,0,  8],  name:'Seminar Hall C2', block:'C' },
  { id:'D302', pos:[ 14,0,  8], name:'Computer Lab D3', block:'D' },
]
const HUB_POS = [22,0,-1]

function getPowerState(room){
  if(!room) return {isPowered:false,isWarn:false,isOff:true,isOverride:false}
  const isOverride=!!room.override_active
  const isPowered=!!room.lights_on
  const isWarn=room.status==='predicted_empty_soon'&&!isOverride
  return {isPowered,isWarn,isOff:!isPowered&&!isWarn,isOverride}
}
function getPowerVisuals({isPowered,isWarn}){
  return {
    winColor:    isPowered?'#c8e8ff':isWarn?'#ffd080':'#040a12',
    winEmissive: isPowered?'#1a66cc':isWarn?'#774400':'#000000',
    winEmt:      isPowered?1.1:isWarn?0.65:0.0,
    edgeColor:   isPowered?'#ffcc33':isWarn?'#ffb300':'#0f2035',
    roofColor:   isPowered?'#ffff99':isWarn?'#ffb300':'#0a1828',
    roofOpt:     isPowered?0.45:isWarn?0.22:0.03,
    bodyColor:   isPowered?'#0c1e30':isWarn?'#0c1924':'#060d16',
  }
}

// ── Street Light ──
function StreetLight({pos,simHour}){
  const isNight=simHour<7||simHour>=18
  const bulbRef=useRef()
  useFrame(s=>{if(bulbRef.current) bulbRef.current.material.emissiveIntensity=isNight?0.7+Math.sin(s.clock.elapsedTime*0.5)*0.1:0})
  return(
    <group position={pos}>
      <mesh position={[0,1.5,0]}><cylinderGeometry args={[0.04,0.07,3,8]}/><meshStandardMaterial color="#1a2a3a" metalness={0.7}/></mesh>
      <mesh position={[0.45,3.05,0]} rotation={[0,0,-0.35]}><cylinderGeometry args={[0.025,0.025,0.9,6]}/><meshStandardMaterial color="#1a2a3a"/></mesh>
      <mesh ref={bulbRef} position={[0.7,3.1,0]}>
        <sphereGeometry args={[0.11,8,8]}/>
        <meshStandardMaterial color={isNight?'#fff8d0':'#1e2e3e'} emissive={isNight?'#ffe090':'#000'} emissiveIntensity={isNight?0.7:0} toneMapped={false}/>
      </mesh>
      {isNight&&<pointLight position={[0.7,3.1,0]} intensity={2.2} color="#ffe090" distance={7} decay={2}/>}
    </group>
  )
}

// ── Walking Student ──
function WalkingStudent({waypts,speed=0.5,color='#00d68f',phase=0}){
  const gRef=useRef(), t=useRef(phase)
  const pts=useMemo(()=>waypts.map(p=>new THREE.Vector3(...p)),[])
  useFrame((_,dt)=>{
    t.current=(t.current+dt*speed*0.06)%1
    const n=pts.length-1, i=Math.min(Math.floor(t.current*n),n-1), f=(t.current*n)%1
    if(gRef.current) {
        gRef.current.position.lerpVectors(pts[i],pts[Math.min(i+1,n)],f)
        gRef.current.lookAt(pts[Math.min(i+1,n)])
        // Add a slight bobbing while walking
        gRef.current.position.y = 0.05 + Math.abs(Math.sin(t.current * 40)) * 0.08
    }
  })
  return(
    <group ref={gRef}>
      {/* Body (Shirt/Jacket) */}
      <mesh position={[0,0.3,0]}><boxGeometry args={[0.2,0.3,0.12]}/><meshStandardMaterial color={color} roughness={0.8}/></mesh>
      {/* Legs */}
      <mesh position={[-0.06,0.12,0]}><boxGeometry args={[0.06,0.25,0.06]}/><meshStandardMaterial color="#2c3e50"/></mesh>
      <mesh position={[0.06,0.12,0]}><boxGeometry args={[0.06,0.25,0.06]}/><meshStandardMaterial color="#2c3e50"/></mesh>
      {/* Head */}
      <mesh position={[0,0.52,0]}><sphereGeometry args={[0.09,8,8]}/><meshStandardMaterial color="#d4a87a" roughness={0.9}/></mesh>
    </group>
  )
}

// ── Bench ──
function Bench({pos,ry=0}){
  return(
    <group position={pos} rotation={[0,ry,0]}>
      <mesh position={[0,0.36,0]}><boxGeometry args={[1.2,0.06,0.38]}/><meshStandardMaterial color="#0a1e30" roughness={0.9}/></mesh>
      <mesh position={[0,0.6,-0.16]} rotation={[0.2,0,0]}><boxGeometry args={[1.2,0.26,0.05]}/><meshStandardMaterial color="#0a1e30" roughness={0.9}/></mesh>
      {[-0.5,0.5].map((x,i)=><mesh key={i} position={[x,0.18,0]}><boxGeometry args={[0.05,0.35,0.36]}/><meshStandardMaterial color="#162a3a" metalness={0.5}/></mesh>)}
    </group>
  )
}

// ── Tiny Car ──
function TinyCar({pos,color='#1a3a5a'}){
  return(
    <group position={pos}>
      <mesh position={[0,0.17,0]}><boxGeometry args={[0.9,0.2,0.45]}/><meshStandardMaterial color={color} metalness={0.6} roughness={0.4}/></mesh>
      <mesh position={[0,0.32,0]}><boxGeometry args={[0.58,0.14,0.42]}/><meshStandardMaterial color={color} metalness={0.5}/></mesh>
      {[[-0.37,0,-0.2],[-0.37,0,0.2],[0.37,0,-0.2],[0.37,0,0.2]].map((p,i)=>(
        <mesh key={i} position={p} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.07,0.07,0.07,8]}/><meshStandardMaterial color="#050a10"/></mesh>
      ))}
    </group>
  )
}

// ── Sensor Station (with red ring LEDs) ──
function SensorStation({pos,room,id}){
  const occ=room?Math.round((room.occupancy_pct||0)*100):0
  const temp=room?Math.round(22+(room.student_count||0)/5):22
  const humidity=room?Math.round(48+(room.occupancy_pct||0)*18):50
  const blinkRef=useRef()
  useFrame(s=>{
    if(blinkRef.current) blinkRef.current.material.emissiveIntensity=0.6+Math.sin(s.clock.elapsedTime*3)*0.4
  })
  // Ring of 6 red LEDs around base
  const redRing=Array.from({length:6}).map((_,i)=>{
    const a=(i/6)*Math.PI*2
    return [Math.cos(a)*0.38,0.12,Math.sin(a)*0.38]
  })
  return(
    <group position={pos}>
      {/* Base disc */}
      <mesh position={[0,0.04,0]}><cylinderGeometry args={[0.44,0.52,0.08,16]}/><meshStandardMaterial color="#0a1e30" metalness={0.6}/></mesh>
      {/* Body */}
      <mesh position={[0,0.38,0]}><boxGeometry args={[0.5,0.55,0.5]}/><meshStandardMaterial color="#0d2038" metalness={0.55} roughness={0.45}/></mesh>
      {/* Mast */}
      <mesh position={[0,0.75,0]}><cylinderGeometry args={[0.05,0.07,0.28,8]}/><meshStandardMaterial color="#162a3a" metalness={0.65}/></mesh>
      {/* Top sensor orb */}
      <mesh ref={blinkRef} position={[0,0.93,0]}>
        <sphereGeometry args={[0.1,10,10]}/>
        <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={0.8} toneMapped={false}/>
      </mesh>
      <pointLight position={[0,0.93,0]} intensity={0.7} color="#ff2020" distance={3.5} decay={2}/>
      {/* Red ring LEDs */}
      {redRing.map((p,i)=>(
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.04,6,6]}/>
          <meshBasicMaterial color="#ff1a1a" toneMapped={false}/>
        </mesh>
      ))}
      <Html position={[0,1.55,0]} center zIndexRange={[30,0]}>
        <div style={{background:'rgba(3,8,18,0.92)',border:'1px solid rgba(255,30,30,0.4)',padding:'5px 9px',borderRadius:7,fontSize:9,fontFamily:'JetBrains Mono,monospace',color:'#ccc',whiteSpace:'nowrap',pointerEvents:'none',boxShadow:'0 0 8px rgba(255,0,0,0.2)'}}>
          <div style={{color:'#ff4444',fontWeight:700,marginBottom:3}}>🔴 {id}</div>
          <div>Temp: <b style={{color:'#fff'}}>{temp}°C</b></div>
          <div>Occ: <b style={{color:occ>50?'#00d68f':'#ffb300'}}>{occ}%</b></div>
          <div>Hum: <b style={{color:'#88bbcc'}}>{humidity}%</b></div>
        </div>
      </Html>
    </group>
  )
}

// ── Battery Storage ──
function BatteryStorage({pos,energySaved=0}){
  const charge=Math.min(100,Math.round((energySaved/30)*100))
  const barColor=charge>60?'#00d68f':charge>30?'#ffb300':'#ff4757'
  return(
    <group position={pos}>
      {[0,0.5,1].map(x=>(
        <mesh key={x} position={[x*0.55-0.55,0.55,0]}><boxGeometry args={[0.45,1.1,0.7]}/><meshStandardMaterial color="#102038" metalness={0.5} roughness={0.4}/><Edges color="#0040a0" linewidth={0.8}/></mesh>
      ))}
      <mesh position={[0,0.02,0]}><boxGeometry args={[2,0.04,0.75]}/><meshStandardMaterial color="#0a1828"/></mesh>
      <Html position={[0,1.6,0]} center zIndexRange={[30,0]}>
        <div style={{background:'rgba(3,10,22,0.9)',border:'1px solid rgba(0,212,143,0.35)',padding:'5px 10px',borderRadius:7,fontSize:9,fontFamily:'JetBrains Mono,monospace',whiteSpace:'nowrap',pointerEvents:'none'}}>
          <div style={{color:'#00d68f',fontWeight:700,marginBottom:3}}>🔋 BATTERY BANK</div>
          <div style={{color:'#aac',marginBottom:3}}>Charge: <span style={{color:barColor}}>{charge}%</span></div>
          <div style={{width:80,height:5,background:'rgba(255,255,255,0.1)',borderRadius:3}}><div style={{width:`${charge}%`,height:'100%',background:barColor,borderRadius:3}}/></div>
        </div>
      </Html>
    </group>
  )
}

// ── Solar Array ──
function SolarArray({pos,simHour}){
  const gen=+(Math.max(0,Math.sin(((simHour-6)/12)*Math.PI))*3.8).toFixed(1)
  const isGen=gen>0.2
  return(
    <group position={pos}>
      {[[-0.7,0],[0,0],[0.7,0],[-0.35,0.6],[0.35,0.6]].map(([px,pz],i)=>(
        <mesh key={i} position={[px,0.5+Math.abs(pz)*0.1,pz]} rotation={[-0.45,0,0]}>
          <boxGeometry args={[0.55,0.02,0.38]}/>
          <meshStandardMaterial color={isGen?'#0a2040':'#061020'} emissive={isGen?'#001a40':'#000'} emissiveIntensity={isGen?0.4:0} metalness={0.4} roughness={0.3}/>
        </mesh>
      ))}
      <mesh position={[0,0.04,0]}><boxGeometry args={[2.2,0.08,1.2]}/><meshStandardMaterial color="#0a1828"/></mesh>
      {isGen&&<pointLight position={[0,1,0]} intensity={0.8} color="#4488ff" distance={4}/>}
      <Html position={[0,1.5,0]} center zIndexRange={[30,0]}>
        <div style={{background:'rgba(3,10,22,0.9)',border:'1px solid rgba(68,136,255,0.35)',padding:'5px 10px',borderRadius:7,fontSize:9,fontFamily:'JetBrains Mono,monospace',whiteSpace:'nowrap',pointerEvents:'none'}}>
          <div style={{color:'#4488ff',fontWeight:700}}>☀ SOLAR ARRAY</div>
          <div style={{color:isGen?'#00d68f':'#aac'}}>Gen: {gen} kW</div>
          <div style={{color:'#556'}}>Eff: {gen>2?'92':'45'}%</div>
        </div>
      </Html>
    </group>
  )
}

// ── Communication Dish (compact ground station) ──
function CommTower({pos}){
  const dishRef=useRef(), beaconRef=useRef()
  const redRefs=[useRef(),useRef(),useRef(),useRef(),useRef(),useRef()]
  useFrame(s=>{
    const t=s.clock.elapsedTime
    if(dishRef.current) dishRef.current.rotation.y=t*0.35
    redRefs.forEach((r,i)=>{ if(r.current) r.current.material.emissiveIntensity=Math.sin(t*3.5+i*1.05)>0?1.6:0.08 })
    if(beaconRef.current) beaconRef.current.material.emissiveIntensity=Math.sin(t*2.8)>0?2.2:0.08
  })
  const ringPts=Array.from({length:6}).map((_,i)=>{const a=(i/6)*Math.PI*2;return[Math.cos(a)*2.2,0.18,Math.sin(a)*2.2]})
  return(
    <group position={pos}>
      {/* Concrete octagonal base pad */}
      <mesh position={[0,0.1,0]}><cylinderGeometry args={[2.6,3.0,0.2,8]}/><meshStandardMaterial color="#b0bec5" roughness={0.85} metalness={0.1}/></mesh>
      {/* Raised inner platform */}
      <mesh position={[0,0.28,0]}><cylinderGeometry args={[1.6,1.8,0.16,16]}/><meshStandardMaterial color="#90a4ae" roughness={0.8}/></mesh>
      {/* Short pedestal column */}
      <mesh position={[0,1.05,0]}><cylinderGeometry args={[0.22,0.28,1.5,12]}/><meshStandardMaterial color="#78909c" metalness={0.5} roughness={0.4}/></mesh>
      {/* Azimuth mount ring */}
      <mesh position={[0,1.85,0]}><cylinderGeometry args={[0.38,0.38,0.18,12]}/><meshStandardMaterial color="#607d8b" metalness={0.6}/></mesh>
      {/* Elevation arm */}
      <mesh position={[0,2.05,0]} rotation={[0,0,0]}><boxGeometry args={[0.14,0.5,0.14]}/><meshStandardMaterial color="#546e7a" metalness={0.7}/></mesh>
      {/* DISH - rotating parabola */}
      <group ref={dishRef} position={[0,2.35,0]}>
        <mesh rotation={[0.7,0,0]}>
          <sphereGeometry args={[2.4,24,14,0,Math.PI*2,0,Math.PI*0.42]}/>
          <meshStandardMaterial color="#b0bec5" metalness={0.55} roughness={0.25} side={THREE.DoubleSide}/>
        </mesh>
        {/* Rim ring */}
        <mesh rotation={[0.7,0,0]}><torusGeometry args={[2.38,0.06,8,40]}/><meshStandardMaterial color="#607d8b" metalness={0.8}/></mesh>
        {/* Feed horn */}
        <mesh position={[0,1.1,0]}><cylinderGeometry args={[0.1,0.06,0.9,8]}/><meshStandardMaterial color="#4a6572" metalness={0.9}/></mesh>
        {/* Struts */}
        {[0,1,2,3].map(i=>{const a=(i/4)*Math.PI*2;return(
          <mesh key={i} position={[Math.cos(a)*0.9,0.55,Math.sin(a)*0.9]} rotation={[0,a,0.5]}>
            <cylinderGeometry args={[0.02,0.02,1.4,6]}/>
            <meshStandardMaterial color="#546e7a" metalness={0.7}/>
          </mesh>
        )})}
      </group>
      {/* Beacon on feed horn */}
      <mesh ref={beaconRef} position={[0,3.5,0]}><sphereGeometry args={[0.1,8,8]}/><meshStandardMaterial color="#ff2020" emissive="#ff0000" emissiveIntensity={2} toneMapped={false}/></mesh>
      <pointLight position={[0,3.4,0]} intensity={0.9} color="#ff2020" distance={7} decay={2}/>
      {/* Red ring LEDs at base perimeter */}
      {ringPts.map((p,i)=>(
        <group key={i}>
          <mesh position={[p[0],0.52,p[2]]}><cylinderGeometry args={[0.035,0.035,0.22,6]}/><meshStandardMaterial color="#455a64" metalness={0.6}/></mesh>
          <mesh ref={redRefs[i]} position={[p[0],0.65,p[2]]}><sphereGeometry args={[0.07,8,8]}/><meshStandardMaterial color="#ff1a1a" emissive="#ff0000" emissiveIntensity={1} toneMapped={false}/></mesh>
        </group>
      ))}
      <pointLight position={[0,2.2,0]} intensity={0.7} color="#88aacc" distance={7} decay={2}/>
      <Html position={[0,5.0,0]} center zIndexRange={[30,0]}>
        <div style={{background:'rgba(3,8,16,0.92)',border:'1.5px solid rgba(255,30,30,0.5)',padding:'5px 11px',borderRadius:7,fontSize:9,fontFamily:'JetBrains Mono,monospace',color:'#ff9999',whiteSpace:'nowrap',pointerEvents:'none',boxShadow:'0 0 10px rgba(255,0,0,0.2)'}}>
          <div style={{fontWeight:800,fontSize:10,marginBottom:2}}>📡 SATELLITE RX</div>
          <div>Signal: <b style={{color:'#00ff88'}}>STRONG</b></div>
          <div>Mode: <b style={{color:'#ff5555'}}>SCAN</b></div>
        </div>
      </Html>
    </group>
  )
}

// ── Flag Pole ──
function FlagPole({pos}){
  const flagGroupRef=useRef()
  useFrame(s=>{ 
    if(flagGroupRef.current) {
      flagGroupRef.current.rotation.y = Math.sin(s.clock.elapsedTime*1.8)*0.35 + 0.2;
      flagGroupRef.current.rotation.z = Math.sin(s.clock.elapsedTime*3.5)*0.08;
      // Add floating air bounce
      flagGroupRef.current.position.y = 6.4 + Math.sin(s.clock.elapsedTime*1.2)*0.15;
    }
  })
  return(
    <group position={pos}>
      <mesh position={[0,3.5,0]}><cylinderGeometry args={[0.04,0.06,7,8]}/><meshStandardMaterial color="#eceff1" metalness={0.8}/></mesh>
      <mesh position={[0,7.0,0]}><sphereGeometry args={[0.1,8,8]}/><meshBasicMaterial color="#ffd700" toneMapped={false}/></mesh>
      <group ref={flagGroupRef} position={[0,6.4,0]}>
        <mesh position={[0.6,0,0]}>
          <planeGeometry args={[1.2,0.7,4,4]}/>
          <meshBasicMaterial color="#ff9800" side={THREE.DoubleSide} toneMapped={false}/>
        </mesh>
      </group>
    </group>
  )
}

// ── Campus Tree (Generic with Waving) ──
function CampusTree({pos, scale=1, flowerColor}){
    const groupRef = useRef()
    useFrame(s => {
        if(groupRef.current) {
            groupRef.current.rotation.z = Math.sin(s.clock.elapsedTime * 0.5 + pos[0]) * 0.05
            groupRef.current.rotation.x = Math.cos(s.clock.elapsedTime * 0.4 + pos[2]) * 0.03
        }
    })
    return(
        <group position={pos} scale={scale} ref={groupRef}>
            {/* Trunk */}
            <mesh position={[0,0.6,0]}><cylinderGeometry args={[0.1,0.15,1.2,5]}/><meshStandardMaterial color="#4e342e" roughness={0.9}/></mesh>
            {/* Leaves */}
            <mesh position={[0,1.5,0]}><dodecahedronGeometry args={[0.7,1]}/><meshStandardMaterial color="#2e7d32" roughness={0.8}/></mesh>
            <mesh position={[-0.3,1.3,0.3]}><dodecahedronGeometry args={[0.5,1]}/><meshStandardMaterial color="#1b5e20" roughness={0.8}/></mesh>
            <mesh position={[0.4,1.8,-0.2]}><dodecahedronGeometry args={[0.6,1]}/><meshStandardMaterial color="#388e3c" roughness={0.8}/></mesh>
            {/* Flowers */}
            {flowerColor && (
                <group>
                    <mesh position={[0.2, 1.8, 0.4]}><sphereGeometry args={[0.08, 6, 6]}/><meshStandardMaterial color={flowerColor}/></mesh>
                    <mesh position={[-0.4, 1.6, 0.2]}><sphereGeometry args={[0.07, 6, 6]}/><meshStandardMaterial color={flowerColor}/></mesh>
                    <mesh position={[0.1, 2.1, -0.3]}><sphereGeometry args={[0.09, 6, 6]}/><meshStandardMaterial color={flowerColor}/></mesh>
                    <mesh position={[-0.2, 1.2, -0.4]}><sphereGeometry args={[0.08, 6, 6]}/><meshStandardMaterial color={flowerColor}/></mesh>
                    <mesh position={[0.5, 1.4, 0.1]}><sphereGeometry args={[0.07, 6, 6]}/><meshStandardMaterial color={flowerColor}/></mesh>
                </group>
            )}
        </group>
    )
}

// ── Cone Tree (Pine/Cypress) ──
function ConeTree({pos, scale=1}){
    const groupRef = useRef()
    useFrame(s => {
        if(groupRef.current) {
            groupRef.current.rotation.z = Math.sin(s.clock.elapsedTime * 0.8 + pos[0]) * 0.04
        }
    })
    return(
        <group position={pos} scale={scale} ref={groupRef}>
            <mesh position={[0,0.5,0]}><cylinderGeometry args={[0.08,0.12,1,5]}/><meshStandardMaterial color="#3e2723"/></mesh>
            <mesh position={[0,1.2,0]}><coneGeometry args={[0.6,1.4,8]}/><meshStandardMaterial color="#1b5e20" roughness={0.8}/></mesh>
            <mesh position={[0,2.0,0]}><coneGeometry args={[0.45,1.1,8]}/><meshStandardMaterial color="#2e7d32" roughness={0.8}/></mesh>
        </group>
    )
}

// ── Bushy Tree (Round/Thick) ──
function BushyTree({pos, scale=1}){
    const groupRef = useRef()
    useFrame(s => {
        if(groupRef.current) {
            groupRef.current.scale.y = scale + Math.sin(s.clock.elapsedTime * 0.6 + pos[0]) * 0.05
        }
    })
    return(
        <group position={pos} scale={scale} ref={groupRef}>
            <mesh position={[0,0.4,0]}><cylinderGeometry args={[0.15,0.22,0.8,6]}/><meshStandardMaterial color="#4e342e"/></mesh>
            <mesh position={[0,1.2,0]}><sphereGeometry args={[0.8,8,8]}/><meshStandardMaterial color="#2e7d32" roughness={0.9}/></mesh>
            <mesh position={[0.5,1.0,0.3]}><sphereGeometry args={[0.5,8,8]}/><meshStandardMaterial color="#1b5e20" roughness={0.9}/></mesh>
            <mesh position={[-0.4,1.4,-0.2]}><sphereGeometry args={[0.6,8,8]}/><meshStandardMaterial color="#388e3c" roughness={0.9}/></mesh>
        </group>
    )
}

// ── Campus Entrance Gate ──
function CampusGate({pos}){
  // Two main pillars + arch + name + gate bars + floodlights
  const PILLAR_W=0.7, PILLAR_H=5.2, SEP=5.5
  return(
    <group position={pos}>
      {/* Approach walkway */}
      <mesh position={[0,0.01,2]}><boxGeometry args={[8,0.02,4]}/><meshStandardMaterial color="#90a4ae" roughness={0.85}/></mesh>
      {/* Left pillar */}
      <mesh position={[-SEP/2,PILLAR_H/2,0]}>
        <boxGeometry args={[PILLAR_W,PILLAR_H,PILLAR_W]}/>
        <meshStandardMaterial color="#eceff1" roughness={0.7} metalness={0.05}/>
      </mesh>
      {/* Left pillar cap */}
      <mesh position={[-SEP/2,PILLAR_H+0.25,0]}><boxGeometry args={[0.9,0.5,0.9]}/><meshStandardMaterial color="#cfd8dc" roughness={0.65}/></mesh>
      {/* Right pillar */}
      <mesh position={[SEP/2,PILLAR_H/2,0]}>
        <boxGeometry args={[PILLAR_W,PILLAR_H,PILLAR_W]}/>
        <meshStandardMaterial color="#eceff1" roughness={0.7} metalness={0.05}/>
      </mesh>
      {/* Right pillar cap */}
      <mesh position={[SEP/2,PILLAR_H+0.25,0]}><boxGeometry args={[0.9,0.5,0.9]}/><meshStandardMaterial color="#cfd8dc" roughness={0.65}/></mesh>
      {/* Arch beam */}
      <mesh position={[0,PILLAR_H+0.05,0]}><boxGeometry args={[SEP+0.7,0.45,0.55]}/><meshStandardMaterial color="#b0bec5" roughness={0.65} metalness={0.15}/></mesh>
      {/* Upper arch curve (half-torus) */}
      <mesh position={[0,PILLAR_H+0.28,0]} rotation={[0,0,0]}><torusGeometry args={[(SEP+0.7)/2,0.14,8,30,Math.PI]}/><meshStandardMaterial color="#90a4ae" metalness={0.2}/></mesh>
      {/* Gate bars - left half */}
      {Array.from({length:5}).map((_,i)=>(
        <mesh key={`gl${i}`} position={[-0.5-i*0.9,PILLAR_H*0.38,0]}>
          <boxGeometry args={[0.07,PILLAR_H*0.75,0.07]}/>
          <meshStandardMaterial color="#1a237e" metalness={0.7} roughness={0.3}/>
        </mesh>
      ))}
      {/* Gate bars - right half */}
      {Array.from({length:5}).map((_,i)=>(
        <mesh key={`gr${i}`} position={[0.5+i*0.9,PILLAR_H*0.38,0]}>
          <boxGeometry args={[0.07,PILLAR_H*0.75,0.07]}/>
          <meshStandardMaterial color="#1a237e" metalness={0.7} roughness={0.3}/>
        </mesh>
      ))}
      {/* College name on arch */}
      <Html position={[0,PILLAR_H+0.85,0.3]} center zIndexRange={[60,0]}>
        <div style={{background:'rgba(25,40,80,0.95)',border:'2px solid rgba(255,215,0,0.7)',padding:'5px 18px',borderRadius:6,fontFamily:'Georgia,serif',fontSize:11,fontWeight:800,color:'#ffd700',whiteSpace:'nowrap',pointerEvents:'none',letterSpacing:'0.18em',textShadow:'0 0 10px rgba(255,215,0,0.5)',boxShadow:'0 0 16px rgba(255,215,0,0.2)'}}>
          🎓 POWERSENSE CAMPUS
        </div>
      </Html>
      {/* Side pillars (smaller) */}
      {[-SEP*1.05,-SEP*0.5,SEP*0.5,SEP*1.05].map((x,i)=>(
        <mesh key={`sp${i}`} position={[x,1.4,0]}><boxGeometry args={[0.35,2.8,0.35]}/><meshStandardMaterial color="#eceff1" roughness={0.7}/></mesh>
      ))}
      {/* Floodlights at base of main pillars */}
      <pointLight position={[-SEP/2,0.5,1.5]} intensity={1.5} color="#fff8e1" distance={8} decay={2}/>
      <pointLight position={[SEP/2,0.5,1.5]} intensity={1.5} color="#fff8e1" distance={8} decay={2}/>
      {/* Gate number plates */}
      <mesh position={[-SEP/2,2.2,0.36]}>
        <boxGeometry args={[0.55,0.35,0.04]}/>
        <meshStandardMaterial color="#0d47a1" metalness={0.3}/>
      </mesh>
      <mesh position={[SEP/2,2.2,0.36]}>
        <boxGeometry args={[0.55,0.35,0.04]}/>
        <meshStandardMaterial color="#0d47a1" metalness={0.3}/>
      </mesh>
    </group>
  )
}

// ── Microgrid Controller (hover-to-reveal + hub connection) ──
function MicrogridController({pos,rooms=[],stats,preds=[]}){
  const [hov,setHov]=useState(false)
  const totalLoad=rooms.reduce((s,r)=>s+(r.current_power_kw||0),0)
  const maxLoad=rooms.length*2.3  // theoretical max if all rooms full
  const active=rooms.filter(r=>r.is_occupied||r.override_active).length
  const overrideCount=rooms.filter(r=>r.override_active).length
  const warnCount=rooms.filter(r=>r.status==='predicted_empty_soon').length
  const emptyOn=rooms.filter(r=>!r.is_occupied&&!r.override_active&&(r.lights_on||r.ac_on)).length
  const costSaved=stats?.total_cost_saved?.toFixed(0)||'0'
  const co2=stats?.total_co2_reduced_kg?.toFixed(1)||'0'
  const energySaved=stats?.total_energy_saved_kwh?.toFixed(1)||'0'
  const gridPct=Math.round((totalLoad/maxLoad)*100)
  const gridColor=gridPct>85?'#ff4757':gridPct>60?'#ff8800':'#ffff00'
  const aiStatus=emptyOn>0?'WASTE DETECTED':warnCount>0?'OPTIMIZING':'OPTIMAL'
  const aiColor=emptyOn>0?'#ff4757':warnCount>0?'#ffb300':'#ffcc33'
  const coreRef=useRef(), ring1=useRef(), ring2=useRef(), pulse=useRef()
  // Bezier connection to Power Hub
  const connPts=useMemo(()=>{
    const s=new THREE.Vector3(...pos), e=new THREE.Vector3(...HUB_POS)
    const m=s.clone().lerp(e,0.5); m.y+=2.5
    return new THREE.QuadraticBezierCurve3(s,m,e).getPoints(42)
  },[])
  const connParticle=useRef(), connT=useRef(0)
  useFrame(s=>{
    const t=s.clock.elapsedTime
    if(coreRef.current) coreRef.current.rotation.y=t*2.2
    if(ring1.current) ring1.current.rotation.z=t*1.8
    if(ring2.current) ring2.current.rotation.x=t*1.2
    if(pulse.current){ const p=t%1.6;pulse.current.scale.setScalar(1+p*1.8);pulse.current.material.opacity=Math.max(0,0.4-p*0.25) }
    // Particle crawl along connection line
    connT.current=(connT.current+0.005)%1
    const idx=Math.min(Math.floor(connT.current*41),40)
    const p1=connPts[idx], p2=connPts[Math.min(idx+1,41)]
    if(connParticle.current&&p1&&p2) connParticle.current.position.lerpVectors(p1,p2,(connT.current*41)%1)
  })
  return(
    <group onPointerOver={e=>{e.stopPropagation();setHov(true)}} onPointerOut={()=>setHov(false)}>
      {/* Bezier arc connection to Power Hub */}
      <Line points={connPts} color={hov?'#ffcc00':'#443300'} lineWidth={hov?2.5:1.2} opacity={hov?0.9:0.4} transparent/>
      {/* Crawling particle */}
      <mesh ref={connParticle}>
        <sphereGeometry args={[0.13,8,8]}/>
        <meshBasicMaterial color={hov?'#ffff33':'#886600'} toneMapped={false}/>
      </mesh>
      <group position={pos}>
        {/* Base ring */}
        <mesh position={[0,0.08,0]}><cylinderGeometry args={[1.1,1.3,0.16,20]}/><meshStandardMaterial color={hov?'#1e3a55':'#152535'} metalness={0.6} roughness={0.4}/></mesh>
        {/* Control cabinet */}
        <mesh position={[0,0.62,0]}><boxGeometry args={[1.4,0.88,1.1]}/><meshStandardMaterial color={hov?'#243a58':'#1e3048'} metalness={0.65} roughness={0.45}/></mesh>
        {/* Side panels */}
        {[[-0.72,0.62,0],[0.72,0.62,0]].map((p,i)=>(
          <mesh key={i} position={p}><boxGeometry args={[0.06,0.82,1.05]}/><meshStandardMaterial color="#162030" roughness={0.8}/></mesh>
        ))}
        {/* LED status strip */}
        <mesh position={[0,1.07,0.56]}>
          <boxGeometry args={[1.3,0.06,0.04]}/>
          <meshBasicMaterial color={gridColor} toneMapped={false}/>
        </mesh>
        {/* Rotating core */}
        <mesh ref={coreRef} position={[0,1.62,0]}><octahedronGeometry args={[0.25,1]}/><meshBasicMaterial color="#ffff00" wireframe toneMapped={false}/></mesh>
        <mesh ref={ring1} position={[0,1.62,0]}><torusGeometry args={[0.4,0.016,8,42]}/><meshBasicMaterial color="#ffaa00" toneMapped={false}/></mesh>
        <mesh ref={ring2} position={[0,1.62,0]}><torusGeometry args={[0.32,0.012,8,36]}/><meshBasicMaterial color="#ffff33" toneMapped={false}/></mesh>
        {/* Pulse ring */}
        <mesh ref={pulse} position={[0,0.08,0]} rotation={[-Math.PI/2,0,0]}>
          <ringGeometry args={[0.7,0.95,32]}/>
          <meshBasicMaterial color="#ffb300" transparent side={THREE.DoubleSide} toneMapped={false}/>
        </mesh>
        <pointLight position={[0,1.7,0]} intensity={hov?3.5:2.0} color="#ffaa00" distance={6} decay={2}/>
        {/* Tiny always-visible badge */}
        <Html position={[0,2.3,0]} center zIndexRange={[40,0]}>
          <div style={{background:'rgba(2,8,20,0.82)',border:`1px solid ${gridColor}99`,borderRadius:5,padding:'2px 8px',fontFamily:'JetBrains Mono,monospace',fontSize:9,color:gridColor,whiteSpace:'nowrap',pointerEvents:'none'}}>⚡ {totalLoad.toFixed(1)} kW</div>
        </Html>
        {/* Hover-only full panel */}
        {hov&&<Html position={[0,3.8,0]} center zIndexRange={[55,0]}>
          <div style={{background:'rgba(2,8,20,0.97)',border:'1.5px solid rgba(255,179,0,0.5)',padding:'8px 14px',borderRadius:10,fontFamily:'JetBrains Mono,monospace',whiteSpace:'nowrap',pointerEvents:'none',boxShadow:'0 0 24px rgba(255,179,0,0.28)',minWidth:205}}>
            <div style={{color:'#ffaa00',fontWeight:800,fontSize:12,borderBottom:'1px solid rgba(255,179,0,0.2)',paddingBottom:4,marginBottom:6}}>⚡ MICROGRID AI</div>
            <div style={{marginBottom:5}}>
              <div style={{color:'#8aaabb',fontSize:9,marginBottom:2}}>GRID LOAD</div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <div style={{flex:1,height:6,background:'rgba(255,255,255,0.08)',borderRadius:3}}><div style={{width:`${gridPct}%`,height:'100%',background:gridColor,borderRadius:3}}/></div>
                <b style={{color:gridColor,fontSize:11}}>{totalLoad.toFixed(1)}kW</b>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'3px 10px',fontSize:10,marginBottom:4}}>
              <div style={{color:'#8aaabb'}}>Active <b style={{color:'#ffcc33'}}>{active}/8</b></div>
              <div style={{color:'#8aaabb'}}>Override <b style={{color:overrideCount?'#ff7043':'#4a6a8a'}}>{overrideCount}</b></div>
              <div style={{color:'#8aaabb'}}>⚠ Empty-ON <b style={{color:emptyOn?'#ff4757':'#4a6a8a'}}>{emptyOn}</b></div>
              <div style={{color:'#8aaabb'}}>Warn <b style={{color:warnCount?'#ffb300':'#4a6a8a'}}>{warnCount}</b></div>
            </div>
            <div style={{background:`${aiColor}18`,border:`1px solid ${aiColor}55`,borderRadius:5,padding:'2px 8px',textAlign:'center',fontSize:9,fontWeight:800,color:aiColor,marginBottom:5}}>🤖 AI: {aiStatus}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'2px 6px',fontSize:9,borderTop:'1px solid rgba(255,255,255,0.07)',paddingTop:4}}>
              <div style={{textAlign:'center'}}><div style={{color:'#4a6a8a'}}>Saved</div><b style={{color:'#ffcc33'}}>{energySaved}kWh</b></div>
              <div style={{textAlign:'center'}}><div style={{color:'#4a6a8a'}}>Cost</div><b style={{color:'#ffd700'}}>₹{costSaved}</b></div>
              <div style={{textAlign:'center'}}><div style={{color:'#4a6a8a'}}>CO₂</div><b style={{color:'#88cc88'}}>{co2}kg</b></div>
            </div>
          </div>
        </Html>}
      </group>
    </group>
  )
}

// ── Campus Fence (Solid Perimeter Wall) ──
function CampusFence() {
  const W=70, D=46, H=3.5, T=0.6
  const wallCol = "#e7e5e4", trimCol = "#d6d3d1", accentCol = "#a8a29e"
  return (
    <group position={[0,0,-1]}>
      {/* North Wall */}
      <mesh position={[0,H/2,-D/2]}><boxGeometry args={[W,H,T]}/><meshStandardMaterial color={wallCol} roughness={0.9}/></mesh>
      {/* West Wall */}
      <mesh position={[-W/2,H/2,0]}><boxGeometry args={[T,H,D]}/><meshStandardMaterial color={wallCol} roughness={0.9}/></mesh>
      {/* East Wall */}
      <mesh position={[W/2,H/2,0]}><boxGeometry args={[T,H,D]}/><meshStandardMaterial color={wallCol} roughness={0.9}/></mesh>
      
      {/* South Wall (with opening for main gate) */}
      <mesh position={[-19.5,H/2,D/2]}><boxGeometry args={[31,H,T]}/><meshStandardMaterial color={wallCol} roughness={0.9}/></mesh>
      <mesh position={[19.5,H/2,D/2]}><boxGeometry args={[31,H,T]}/><meshStandardMaterial color={wallCol} roughness={0.9}/></mesh>
      
      {/* Wall caps / trim (Normal concrete color) */}
      <mesh position={[0,H+0.1,-D/2]}><boxGeometry args={[W+0.4,0.2,T+0.2]}/><meshStandardMaterial color={trimCol} roughness={0.8}/></mesh>
      <mesh position={[-W/2,H+0.1,0]}><boxGeometry args={[T+0.2,0.2,D+0.4]}/><meshStandardMaterial color={trimCol} roughness={0.8}/></mesh>
      <mesh position={[W/2,H+0.1,0]}><boxGeometry args={[T+0.2,0.2,D+0.4]}/><meshStandardMaterial color={trimCol} roughness={0.8}/></mesh>
      <mesh position={[-19.5,H+0.1,D/2]}><boxGeometry args={[31+0.2,0.2,T+0.2]}/><meshStandardMaterial color={trimCol} roughness={0.8}/></mesh>
      <mesh position={[19.5,H+0.1,D/2]}><boxGeometry args={[31+0.2,0.2,T+0.2]}/><meshStandardMaterial color={trimCol} roughness={0.8}/></mesh>

      {/* Wall Horizontal Decorative Stripes */}
      <mesh position={[0,H*0.42,-D/2]}><boxGeometry args={[W+0.1, 0.15, T+0.05]}/><meshStandardMaterial color={accentCol}/></mesh>
      <mesh position={[-W/2,H*0.42,0]}><boxGeometry args={[T+0.05, 0.15, D+0.1]}/><meshStandardMaterial color={accentCol}/></mesh>
      <mesh position={[W/2,H*0.42,0]}><boxGeometry args={[T+0.05, 0.15, D+0.1]}/><meshStandardMaterial color={accentCol}/></mesh>
      <mesh position={[-19.5,H*0.42,D/2]}><boxGeometry args={[31+0.1, 0.15, T+0.05]}/><meshStandardMaterial color={accentCol}/></mesh>
      <mesh position={[19.5,H*0.42,D/2]}><boxGeometry args={[31+0.1, 0.15, T+0.05]}/><meshStandardMaterial color={accentCol}/></mesh>

      {/* Decorative Wall Pillars */}
      {Array.from({length: 15}).map((_,i)=>(
         <mesh key={`pn1${i}`} position={[-34+i*4.8, H/2, -D/2+0.05]}><boxGeometry args={[0.6, H+0.4, T+0.25]}/><meshStandardMaterial color={accentCol}/></mesh>
      ))}
      {[[-W/2+0.05, 0], [W/2-0.05, 0]].map(([px],s)=>(
          Array.from({length: 9}).map((_,i)=>(
            <mesh key={`pns${s}${i}`} position={[px, H/2, -22+i*5]}><boxGeometry args={[T+0.25, H+0.4, 0.6]}/><meshStandardMaterial color={accentCol}/></mesh>
          ))
      ))}

      {/* Wall Labels */}
      {/* Left side label */}
      <Text
        position={[-12, H/2 + 0.3, D/2 + T/2 + 0.02]}
        fontSize={1.4}
        color="#1c2533"
        font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
        anchorX="center"
        anchorY="middle"
      >
        Gitxtribe
      </Text>
      {/* Right side label */}
      <Text
        position={[12, H/2 + 0.3, D/2 + T/2 + 0.02]}
        fontSize={1.4}
        color="#1c2533"
        font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
        anchorX="center"
        anchorY="middle"
      >
        Geniusphere
      </Text>

      {/* Decorative Iron Fencing Bars on top of walls */}
      {/* North Wall Bars */}
      {Array.from({length: 35}).map((_,i)=>(
         <mesh key={`fn${i}`} position={[-34.5+i*2, H+0.8, -D/2]}><cylinderGeometry args={[0.02, 0.02, 1.2, 6]}/><meshStandardMaterial color="#263238" metalness={0.7}/></mesh>
      ))}
      <mesh position={[0, H+1.4, -D/2]}><boxGeometry args={[70, 0.04, 0.04]}/><meshStandardMaterial color="#263238" metalness={0.8}/></mesh>
      
      {/* South Wall Bars (Left) */}
      {Array.from({length: 15}).map((_,i)=>(
         <mesh key={`fsl${i}`} position={[-34.5+i*2, H+0.8, D/2]}><cylinderGeometry args={[0.02, 0.02, 1.2, 6]}/><meshStandardMaterial color="#263238" metalness={0.7}/></mesh>
      ))}
      {/* South Wall Bars (Right) */}
      {Array.from({length: 15}).map((_,i)=>(
         <mesh key={`fsr${i}`} position={[6+i*2, H+0.8, D/2]}><cylinderGeometry args={[0.02, 0.02, 1.2, 6]}/><meshStandardMaterial color="#263238" metalness={0.7}/></mesh>
      ))}
      
      {/* East/West Wall Bars */}
      {Array.from({length: 22}).map((_,i)=>(
        <React.Fragment key={`fewv${i}`}>
           <mesh position={[-W/2, H+0.8, -D/2+1+i*2]}><cylinderGeometry args={[0.02, 0.02, 1.2, 6]}/><meshStandardMaterial color="#263238" metalness={0.7}/></mesh>
           <mesh position={[W/2, H+0.8, -D/2+1+i*2]}><cylinderGeometry args={[0.02, 0.02, 1.2, 6]}/><meshStandardMaterial color="#263238" metalness={0.7}/></mesh>
        </React.Fragment>
      ))}

    </group>
  )
}

// ── Campus Ground ──
function CampusGround({simHour}){
  const isNight=simHour<7||simHour>=18
  const groundCol = "#1a472a" // Lush grass green
  const roadCol = "#1f1f1f"   // Cleaner deep asphalt
  const dashCol = "#facc15"   // Golden road markings
  
  return(
    <group>
      {/* Main Floor / Land */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.02,-1]} receiveShadow>
        <planeGeometry args={[70,46]}/>
        <meshStandardMaterial color={groundCol} roughness={0.8} metalness={0.1}/>
      </mesh>
      
      {/* E-W road */}
      <mesh position={[0,0.005,-1]}><boxGeometry args={[66,0.015,2.4]}/><meshStandardMaterial color={roadCol} roughness={0.9}/></mesh>
      {/* N-S road */}
      <mesh position={[0,0.005,-1]}><boxGeometry args={[2.4,0.015,44]}/><meshStandardMaterial color={roadCol} roughness={0.9}/></mesh>
      
      {/* Road dashes */}
      {Array.from({length:26}).map((_,i)=>(
        <mesh key={`d${i}`} position={[-30+i*2.5,0.012,-1]}><boxGeometry args={[1,0.005,0.1]}/><meshBasicMaterial color={dashCol}/></mesh>
      ))}
      {/* N-S dashes */}
      {Array.from({length:18}).map((_,i)=>(
        <mesh key={`dv${i}`} position={[0,0.012,-21+i*2.5]}><boxGeometry args={[0.1,0.005,1]}/><meshBasicMaterial color={dashCol}/></mesh>
      ))}
      {/* Building pads */}
      {ROOMS_CFG.map(r=>(
        <mesh key={`p${r.id}`} position={[r.pos[0],0.01,r.pos[2]]}><boxGeometry args={[4.4,0.02,3.6]}/><meshStandardMaterial color="#334155" roughness={0.8}/></mesh>
      ))}
      {/* Hub platform */}
      <mesh position={[HUB_POS[0],0.02,HUB_POS[2]]}><cylinderGeometry args={[2.4,2.8,0.06,32]}/><meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.5}/></mesh>
      {/* Parking lot */}
      <mesh position={[20,0.005,16]}><boxGeometry args={[10,0.01,6]}/><meshStandardMaterial color="#111827" roughness={0.9}/></mesh>
      {Array.from({length:8}).map((_,i)=>(
        <mesh key={`pk${i}`} position={[16+i*1.1,0.013,16]}><boxGeometry args={[0.08,0.005,5.8]}/><meshBasicMaterial color="#4b5563"/></mesh>
      ))}
      {/* PARKING LABEL */}
      <mesh position={[15,0.015,20]}><boxGeometry args={[3,0.01,1]}/><meshBasicMaterial color="#0a1e38"/></mesh>
      {/* Bike rack */}
      {[-0.4,0,0.4].map((x,i)=>(
        <group key={`b${i}`} position={[20,0,21]}>
          <mesh position={[x,0.25,0]}><boxGeometry args={[0.06,0.5,0.06]}/><meshStandardMaterial color="#1a3050" metalness={0.7}/></mesh>
          <mesh position={[x,0.45,0]} rotation={[0,0,Math.PI/6]}><cylinderGeometry args={[0.05,0.05,0.35,8]}/><meshStandardMaterial color="#102038" metalness={0.7}/></mesh>
        </group>
      ))}
      {/* Trees */}
      {[[-26,0,-16],[-26,0,14],[-8,0,20],[8,0,20],[26,0,-16],[26,0,16],[0,0,-20],[0,0,20]].map((p,i)=>(
        <group key={`t${i}`} position={p}>
          <mesh position={[0,0.4,0]}><cylinderGeometry args={[0.1,0.15,0.8,7]}/><meshStandardMaterial color="#0a1a0e" roughness={0.9}/></mesh>
          <mesh position={[0,1.0,0]}><sphereGeometry args={[0.45,8,8]}/><meshStandardMaterial color="#0b3a18" roughness={0.8} emissive="#003308" emissiveIntensity={0.3}/></mesh>
        </group>
      ))}
      {/* Power cables */}
      {ROOMS_CFG.map(r=>{
        const pts=[new THREE.Vector3(...HUB_POS),new THREE.Vector3((HUB_POS[0]+r.pos[0])/2,0.04,(HUB_POS[2]+r.pos[2])/2),new THREE.Vector3(r.pos[0],0.04,r.pos[2])]
        return <Line key={`c${r.id}`} points={pts} color="#0a1e35" lineWidth={0.8} opacity={0.5} transparent/>
      })}
    </group>
  )
}

// ── Zone Label ──
function ZoneLabel({pos,label,sub}){
  return(
    <Html position={pos} center zIndexRange={[20,0]}>
      <div style={{background:'rgba(0,229,255,0.07)',border:'1px solid rgba(0,229,255,0.2)',borderRadius:6,padding:'3px 10px',fontSize:9,fontFamily:'JetBrains Mono,monospace',color:'rgba(0,229,255,0.7)',whiteSpace:'nowrap',pointerEvents:'none',letterSpacing:'0.1em'}}>
        {label}{sub&&<span style={{color:'rgba(0,229,255,0.4)',marginLeft:5}}>{sub}</span>}
      </div>
    </Html>
  )
}

// ── Building ──
function Building({data,room,pred,onClick,isSelected}){
  const groupRef=useRef(), beaconRef=useRef(), [hovered,setHover]=useState(false)
  const ps=getPowerState(room), vz=getPowerVisuals(ps)
  const {isPowered,isWarn,isOverride}=ps
  const W=3.0,H=4.2,D=2.0,nF=3,fH=H/nF
  const fwx=[-0.9,-0.3,0.3,0.9], swz=[-0.5,0.5]
  const labelColor=isPowered?'#ffcc33':isWarn?'#ffb300':isOverride?'#ff4757':'#2a4060'
  const statusTxt=isOverride?(isPowered?'OVERRIDE ON':'OVERRIDE OFF'):isPowered?'OCCUPIED':isWarn?'EMPTY SOON':'POWERED OFF'
  useFrame(s=>{
    if(!groupRef.current) return
    groupRef.current.position.y=hovered?0.22:Math.sin(s.clock.elapsedTime*0.9+data.pos[0]*0.18)*0.035
    if(beaconRef.current) beaconRef.current.material.emissiveIntensity=isPowered?(Math.sin(s.clock.elapsedTime*4)>0?1:0.1):isWarn?(Math.sin(s.clock.elapsedTime*2.5)>0?0.7:0.1):isOverride?(Math.sin(s.clock.elapsedTime*2)>0?0.9:0.1):0.06
  })
  const revealInterior=isSelected||hovered
  return(
    <group position={[data.pos[0],0,data.pos[2]]} ref={groupRef} onClick={onClick} onPointerOver={()=>{setHover(true);playHover()}} onPointerOut={()=>setHover(false)}>
      <mesh position={[0,0.08,0]}><boxGeometry args={[W+0.4,0.16,D+0.4]}/><meshStandardMaterial color="#0a1928" roughness={0.9} metalness={0.1}/></mesh>
      <mesh position={[0,H/2+0.16,0]}>
        <boxGeometry args={[W,H,D]}/>
        <meshStandardMaterial color={revealInterior?'#030810':vz.bodyColor} transparent opacity={revealInterior?0.1:1} roughness={0.88} metalness={0.08} depthWrite={!revealInterior}/>
        <Edges linewidth={isSelected?2.8:hovered?2.2:1.2} color={vz.edgeColor} opacity={isSelected?1:0.55} transparent/>
      </mesh>
      {Array.from({length:nF+1}).map((_,f)=><mesh key={f} position={[0,f*fH+0.16,0]}><boxGeometry args={[W+0.1,0.1,D+0.1]}/><meshStandardMaterial color="#091522" roughness={0.92}/></mesh>)}
      {Array.from({length:nF}).map((_,f)=>[...fwx.map((wx,wi)=>(
        <mesh key={`ff${f}${wi}`} position={[wx,f*fH+fH*0.55+0.16,D/2+0.012]}><boxGeometry args={[0.36,fH*0.52,0.04]}/><meshStandardMaterial color={vz.winColor} emissive={vz.winEmissive} emissiveIntensity={vz.winEmt} roughness={0.08} metalness={0.4}/></mesh>
      )),...fwx.map((wx,wi)=>(
        <mesh key={`fb${f}${wi}`} position={[wx,f*fH+fH*0.55+0.16,-D/2-0.012]} rotation={[0,Math.PI,0]}><boxGeometry args={[0.36,fH*0.52,0.04]}/><meshStandardMaterial color={vz.winColor} emissive={vz.winEmissive} emissiveIntensity={vz.winEmt} roughness={0.08} metalness={0.4}/></mesh>
      )),...swz.flatMap((wz,wi)=>[
        <mesh key={`fl${f}${wi}`} position={[-W/2-0.012,f*fH+fH*0.55+0.16,wz]} rotation={[0,-Math.PI/2,0]}><boxGeometry args={[0.7,fH*0.52,0.04]}/><meshStandardMaterial color={vz.winColor} emissive={vz.winEmissive} emissiveIntensity={vz.winEmt} roughness={0.08} metalness={0.4}/></mesh>,
        <mesh key={`fr${f}${wi}`} position={[W/2+0.012,f*fH+fH*0.55+0.16,wz]} rotation={[0,Math.PI/2,0]}><boxGeometry args={[0.7,fH*0.52,0.04]}/><meshStandardMaterial color={vz.winColor} emissive={vz.winEmissive} emissiveIntensity={vz.winEmt} roughness={0.08} metalness={0.4}/></mesh>,
      ])])}
      <mesh position={[0,fH*0.42+0.16,D/2+0.35]}><boxGeometry args={[1.4,0.06,0.7]}/><meshStandardMaterial color="#0a1e34" roughness={0.88} metalness={0.2}/></mesh>
      <mesh position={[0,H+0.16+0.06,0]}><boxGeometry args={[W+0.16,0.12,D+0.16]}/><meshStandardMaterial color="#071320" roughness={0.95}/></mesh>
      <mesh position={[0,H+0.16+0.14,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[W-0.2,D-0.2]}/><meshBasicMaterial color={vz.roofColor} transparent opacity={vz.roofOpt} toneMapped={false}/></mesh>
      {[[-0.6,0.3],[0.6,-0.3]].map(([rx,rz],i)=>(
        <group key={`hv${i}`} position={[rx,H+0.16+0.22,rz]}>
          <mesh><boxGeometry args={[0.55,0.28,0.4]}/><meshStandardMaterial color="#0c1e30" roughness={0.85} metalness={0.3}/></mesh>
          <mesh position={[0,0.15,0]}><cylinderGeometry args={[0.1,0.12,0.1,8]}/><meshStandardMaterial color="#0a1826" roughness={0.8}/></mesh>
        </group>
      ))}
      <mesh ref={beaconRef} position={[0,H+0.16+0.6,0]}><sphereGeometry args={[0.07,8,8]}/><meshStandardMaterial color={isPowered?'#00ffaa':isWarn?'#ffb300':isOverride?'#ff4757':'#112233'} emissive={isPowered?'#00ffaa':isWarn?'#ffb300':isOverride?'#ff2233':'#001122'} emissiveIntensity={1} toneMapped={false}/></mesh>
      {revealInterior&&<group position={[0,fH*0.5+0.16,0]}>
        <mesh position={[0,-0.72,0]}><boxGeometry args={[2.9,0.02,1.9]}/><meshStandardMaterial color="#060d18" roughness={0.9}/></mesh>
        <mesh position={[0,0,-0.95]}><boxGeometry args={[2.9,1.42,0.02]}/><meshStandardMaterial color="#09182a" roughness={0.9}/></mesh>
        <mesh position={[0,0.18,-0.94]}><planeGeometry args={[1.6,0.65]}/><meshBasicMaterial color={isPowered?'#ffffff':'#0e1e30'}/></mesh>
        {Array.from({length:8}).map((_,i)=><mesh key={i} position={[-0.8+(i%4)*0.55,-0.5,Math.floor(i/4)*0.6]}><boxGeometry args={[0.38,0.04,0.22]}/><meshStandardMaterial color="#1a2d40"/></mesh>)}
      </group>}
      {isPowered&&<pointLight position={[0,H/2+0.16,0]} intensity={1.2} color={isOverride?'#ff8844':'#ffaa00'} distance={5} decay={2}/>}
      <Html position={[0,H+0.16+1.65,0]} center zIndexRange={[50,0]} occlude={false} style={{userSelect:'none',pointerEvents:'none'}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,userSelect:'none',pointerEvents:'none'}}>
          <div style={{background:'rgba(4,10,20,0.92)',border:`2px solid ${labelColor}`,borderRadius:7,padding:'3px 11px',fontFamily:'JetBrains Mono,monospace',fontSize:13,fontWeight:800,color:'#fff',boxShadow:`0 0 12px ${labelColor}66`}}>{data.id}</div>
          <div style={{background:'rgba(4,10,20,0.82)',border:`1px solid ${labelColor}55`,borderRadius:5,padding:'2px 9px',fontFamily:'JetBrains Mono,monospace',fontSize:11,fontWeight:600,color:isPowered?'#ffaa00':isWarn?'#ffb300':'#2a4060'}}>⚡ {(room?.current_power_kw||0).toFixed(1)} kW</div>
          <div style={{background:`${labelColor}22`,border:`1px solid ${labelColor}55`,borderRadius:4,padding:'1px 8px',fontSize:9,fontWeight:800,color:labelColor,letterSpacing:'0.09em'}}>{statusTxt}</div>
          {isWarn&&pred?.predicted_empty_minutes!=null&&<div style={{background:'rgba(255,179,0,0.14)',border:'1px solid rgba(255,179,0,0.5)',borderRadius:4,padding:'1px 7px',fontSize:9,fontWeight:700,color:'#ffb300'}}>⚠ ~{pred.predicted_empty_minutes}m</div>}
        </div>
      </Html>
      {(hovered||isSelected)&&room&&(
        <Html position={[0,H+0.16+3.1,0]} center zIndexRange={[100,0]}>
          <div style={{background:'rgba(4,12,22,0.95)',border:`1px solid ${labelColor}88`,padding:'10px 14px',borderRadius:9,fontFamily:'Inter,sans-serif',boxShadow:`0 6px 24px rgba(0,0,0,0.7)`,minWidth:175,pointerEvents:'none',backdropFilter:'blur(12px)',lineHeight:1.5}}>
            <div style={{fontSize:11,fontWeight:700,color:labelColor,borderBottom:'1px solid rgba(255,255,255,0.08)',paddingBottom:5,marginBottom:7}}>{data.id} · {data.name}</div>
            {[['Students',room.student_count??'—'],['Power',`${(room.current_power_kw||0).toFixed(1)} kW`],['Lights',room.lights_on?'💡 ON':'○ OFF'],['AC',room.ac_on?'❄ ON':'○ OFF']].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:11,margin:'3px 0'}}><span style={{color:'#6688aa'}}>{k}</span><span style={{fontWeight:700,color:'#ddeeff'}}>{v}</span></div>
            ))}
            {isOverride&&<div style={{marginTop:6,textAlign:'center',background:'rgba(255,112,67,0.14)',border:'1px solid rgba(255,112,67,0.4)',borderRadius:5,padding:3,fontSize:10,color:'#ff7043',fontWeight:700}}>🔒 FACULTY OVERRIDE ACTIVE</div>}
          </div>
        </Html>
      )}
    </group>
  )
}

// ── Power Hub ──
function PowerHub({hasPredictions,rooms=[]}){
  const coreRef=useRef(), ring1Ref=useRef(), ring2Ref=useRef(), waveRef=useRef()
  const activePower=rooms.reduce((s,r)=>s+(r.current_power_kw||0),0)
  const activeRooms=rooms.filter(r=>r.is_occupied||r.override_active).length
  useFrame(s=>{
    const t=s.clock.elapsedTime
    if(coreRef.current) coreRef.current.rotation.y=t*1.0
    if(ring1Ref.current) ring1Ref.current.rotation.z=t*1.4
    if(ring2Ref.current) ring2Ref.current.rotation.x=t*0.9
    if(waveRef.current&&hasPredictions){const c=t%2;waveRef.current.scale.setScalar(1+c*2.8);waveRef.current.material.opacity=Math.max(0,0.42-c*0.21)}
  })
  return(
    <group position={HUB_POS}>
      <mesh position={[0,0.12,0]}><cylinderGeometry args={[1.5,1.7,0.24,32]}/><meshStandardMaterial color="#152535" roughness={0.7} metalness={0.5}/></mesh>
      <mesh position={[0,0.85,0]}><boxGeometry args={[1.6,1.1,1.2]}/><meshStandardMaterial color="#1e3048" roughness={0.65} metalness={0.7}/></mesh>
      {Array.from({length:6}).map((_,i)=>(
        <group key={i}>
          <mesh position={[-0.87,0.85,-0.38+i*0.15]}><boxGeometry args={[0.16,0.88,0.04]}/><meshStandardMaterial color="#162030" roughness={0.8}/></mesh>
          <mesh position={[0.87,0.85,-0.38+i*0.15]}><boxGeometry args={[0.16,0.88,0.04]}/><meshStandardMaterial color="#162030" roughness={0.8}/></mesh>
        </group>
      ))}
      <mesh ref={coreRef} position={[0,2.1,0]}><icosahedronGeometry args={[0.32,1]}/><meshBasicMaterial color="#ffff00" wireframe toneMapped={false}/></mesh>
      <mesh ref={ring1Ref} position={[0,2.1,0]}><torusGeometry args={[0.54,0.018,8,48]}/><meshBasicMaterial color="#ffaa00" toneMapped={false}/></mesh>
      <mesh ref={ring2Ref} position={[0,2.1,0]}><torusGeometry args={[0.42,0.013,8,40]}/><meshBasicMaterial color="#ffff33" toneMapped={false}/></mesh>
      {hasPredictions&&<mesh ref={waveRef} position={[0,0.12,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.9,1.15,40]}/><meshBasicMaterial color="#ffb300" transparent side={THREE.DoubleSide} toneMapped={false}/></mesh>}
      <pointLight position={[0,2.2,0]} intensity={3.5} color="#ffff00" distance={8} decay={2}/>
      <Html position={[0,3.2,0]} center zIndexRange={[40,0]}>
        <div style={{background:'rgba(3,10,20,0.88)',border:'1.5px solid rgba(255,179,0,0.5)',borderRadius:8,padding:'6px 14px',fontFamily:'JetBrains Mono,monospace',fontSize:11,fontWeight:700,color:'#ffaa00',whiteSpace:'nowrap',pointerEvents:'none',boxShadow:'0 0 12px rgba(255,179,0,0.3)'}}>
          ⚡ TRANSFORMER HUB<br/><span style={{color:'#ffcc33',fontSize:13}}>{activePower.toFixed(1)} kW</span><span style={{color:'#4a6a8a',fontSize:9,marginLeft:6}}>{activeRooms}/{rooms.length} ACTIVE</span>
        </div>
      </Html>
    </group>
  )
}

// ── Power Utility Pylon (More Structure) ──
function PowerPole({pos}){
    return(
        <group position={pos}>
            <mesh position={[0,0.85,0]}><cylinderGeometry args={[0.06,0.09,1.7,6]}/><meshStandardMaterial color="#2d3748" metalness={0.6}/></mesh>
            <mesh position={[0,1.55,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.04,0.04,1.1,6]}/><meshStandardMaterial color="#2d3748" metalness={0.6}/></mesh>
            <mesh position={[-0.45,1.55,0]}><sphereGeometry args={[0.08,8,8]}/><meshStandardMaterial color="#4a5568" metalness={0.8}/></mesh>
            <mesh position={[0.45,1.55,0]}><sphereGeometry args={[0.08,8,8]}/><meshStandardMaterial color="#4a5568" metalness={0.8}/></mesh>
        </group>
    )
}

// ── Power Junction Box (Structural Detail) ──
function PowerJunction({pos, active=false}){
    return(
        <group position={pos}>
            <mesh position={[0,0.22,0]}><boxGeometry args={[0.45,0.48,0.45]}/><meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.2}/></mesh>
            <mesh position={[0,0.46,0]}><cylinderGeometry args={[0.2,0.22,0.1,16]}/><meshStandardMaterial color="#111827" metalness={0.9}/></mesh>
            <mesh position={[0,0.52,0]}><sphereGeometry args={[0.1,8,8]}/><meshBasicMaterial color={active?'#ffff00':'#04152a'} toneMapped={false}/></mesh>
            {active && <pointLight position={[0,0.52,0]} intensity={0.6} color="#ffdd00" distance={4}/>}
        </group>
    )
}

// ── Energy Stream (Structured with L-Bends) ──
function EnergyStream({room, start, end, label, isBackbone=false}){
  const ps=getPowerState(room)
  const {isPowered,isWarn}=ps
  const isActive = isBackbone || isPowered || isWarn
  const color = isPowered?'#ffff00':isWarn?'#ffb300':isBackbone?'#ffaa00':'#04152a'
  const elev = 1.55 // Elevate to pylon height

  // Structured L-path
  const points = useMemo(() => {
    const p1 = new THREE.Vector3(start[0], elev, start[2])
    const p2 = new THREE.Vector3(end[0], elev, start[2]) // Corner
    const p3 = new THREE.Vector3(end[0], elev, end[2])
    const curve = new THREE.CatmullRomCurve3([p1, p2, p3], false, 'catmullrom', 0.1)
    return curve.getPoints(30)
  }, [start, end])

  const pRef=useRef()
  const speed = isBackbone ? 0.6 : isWarn?0.3:isPowered?0.8:0

  useFrame(s=>{
    if(!pRef.current||!isActive||speed===0) return
    const t=(s.clock.elapsedTime*speed)%1, idx=Math.floor(t*29), pA=points[idx], pB=points[idx+1]
    if(pA&&pB) pRef.current.position.lerpVectors(pA,pB,(t*29)%1)
  })

  return(
    <group>
      <Line points={points} color={color} lineWidth={isBackbone?2.2:1.4} opacity={isActive?0.7:0.12} transparent/>
      {isActive && (
          <mesh ref={pRef}>
              <sphereGeometry args={[isBackbone?0.12:0.08, 8, 8]}/>
              <meshBasicMaterial color={color} toneMapped={false}/>
          </mesh>
      )}
    </group>
  )
}

// ── Smart Grid Mesh (The Interconnected Structure) ──
function SmartGridMesh({rooms}){
    const roomMap = Object.fromEntries(rooms.map(r=>[r.id, r]))
    
    // Simplified Inter-building connections (Cleared from Road)
    const connections = [
        // Peripheral Feeders from Hub to North/South Rows (Avoiding the road overlap)
        { s:[22,0,-1], e:[22,0,-10], backbone:true }, // North Feeder
        { s:[22,0,-1], e:[22,0,8], backbone:true },   // South Feeder
        
        // North Row Distribution (z=-10) - Horizontal links
        { s:[22,0,-10], e:[14,0,-10], backbone:true }, 
        { s:[14,0,-10], e:[5,0,-10], rid:'D101' },
        { s:[5,0,-10], e:[-5,0,-10], rid:'C101' },
        { s:[-5,0,-10], e:[-14,0,-10], rid:'B101' },

        // South Row Distribution (z=8) - Horizontal links
        { s:[22,0,8], e:[14,0,8], backbone:true },
        { s:[14,0,8], e:[5,0,8], rid:'D302' },
        { s:[5,0,8], e:[-5,0,8], rid:'C202' },
        { s:[-5,0,8], e:[-14,0,8], rid:'B203' },
    ]

    return (
        <group>
            {connections.map((c, i) => (
                <EnergyStream 
                    key={i} 
                    start={c.s} 
                    end={c.e} 
                    room={c.rid ? roomMap[c.rid] : null} 
                    isBackbone={c.backbone}
                />
            ))}
            {/* Junction Boxes and Poles - Relocated to avoid road */}
            {[-14, -5, 5, 14, 22].map(x => (
                <group key={x}>
                    {/* Only place nodes on the building/hub alignment rows */}
                    <PowerJunction pos={[x, 0, -10]} active={true}/>
                    <PowerJunction pos={[x, 0, 8]} active={true}/>
                    
                    <PowerPole pos={[x, 0, -10]}/>
                    <PowerPole pos={[x, 0, 8]}/>
                </group>
            ))}
            {/* Main Hub Node */}
            <PowerJunction pos={[22, 0, -1]} active={true}/>
            <PowerPole pos={[22, 0, -1]}/>
        </group>
    )
}

// ── Demand Response Links ──
function DRLinks({suggestions}){
  return<>{suggestions.map((s,i)=>{
    if(s.rooms.length<2) return null
    const c1=ROOMS_CFG.find(r=>r.id===s.rooms[0]),c2=ROOMS_CFG.find(r=>r.id===s.rooms[1])
    if(!c1||!c2) return null
    const pts=[new THREE.Vector3(c1.pos[0],5.5,c1.pos[2]),new THREE.Vector3((c1.pos[0]+c2.pos[0])/2,6.5,(c1.pos[2]+c2.pos[2])/2),new THREE.Vector3(c2.pos[0],5.5,c2.pos[2])]
    return <Line key={i} points={pts} color="#00e5ff" lineWidth={1.4} opacity={0.5} transparent dashed dashScale={4} dashSize={0.6} gapSize={0.3}/>
  })}</>
}

// ── Camera Controller ──
function CameraController({selectedRoom}){
  const {camera}=useThree(),prev=useRef(null),controls=useThree(s=>s.controls)
  React.useEffect(()=>{
    if(!selectedRoom||selectedRoom===prev.current||!controls) return
    prev.current=selectedRoom;playSelect()
    const cfg=ROOMS_CFG.find(r=>r.id===selectedRoom);if(!cfg) return
    gsap.to(camera.position,{x:cfg.pos[0]+5,y:cfg.pos[1]+8,z:cfg.pos[2]+11,duration:1.2,ease:'power2.inOut'})
    gsap.to(controls.target,{x:cfg.pos[0],y:cfg.pos[1]+1.5,z:cfg.pos[2],duration:1.2,ease:'power2.inOut',onUpdate:()=>controls.update()})
  },[selectedRoom,camera,controls])
  return null
}

// ── Environment / Lighting ──
function EnvCtrl({simHour}){
  const factor=Math.max(0,Math.sin(((simHour-6)/24)*Math.PI*2))
  const isNight=simHour<7||simHour>=19
  return<>
    <ambientLight intensity={isNight?0.12:0.45+factor*0.7} color={isNight?'#0a1a3a':'#1a3366'}/>
    <directionalLight position={[15,16,8]} intensity={isNight?0:0.15+factor*2.0} color="#fff4cc" castShadow/>
    <pointLight position={[-20,18,-10]} intensity={isNight?0.08:0} color="#aaccff" distance={80}/>
  </>
}

// ── Walking student paths ──
const STUDENT_PATHS = [
  { pts: [[-14, 0.3, -12], [-9.5, 0.3, -12], [-5, 0.3, -12], [-9.5, 0.3, -12]], color: '#00d68f', speed: 0.45, phase: 0 },
  { pts: [[5, 0.3, -12], [9.5, 0.3, -12], [14, 0.3, -12], [9.5, 0.3, -12]], color: '#00e5ff', speed: 0.4, phase: 0.3 },
  { pts: [[-5, 0.3, 10], [0, 0.3, 10], [5, 0.3, 10], [0, 0.3, 10]], color: '#ffb300', speed: 0.38, phase: 0.6 },
  { pts: [[0, 0.3, -12], [0, 0.3, -4], [0, 0.3, 10], [0, 0.3, -4]], color: '#c084fc', speed: 0.35, phase: 0.15 },
  { pts: [[-14, 0.3, 10], [-9.5, 0.3, 4], [-9.5, 0.3, -4], [-9.5, 0.3, 4]], color: '#f97316', speed: 0.42, phase: 0.8 },
  // Additional student paths
  { pts: [[-22, 0.3, 15], [-28, 0.3, 15], [-28, 0.3, 5], [-22, 0.3, 5]], color: '#f44336', speed: 0.48, phase: 1.2 },
  { pts: [[22, 0.3, -15], [28, 0.3, -15], [28, 0.3, -5], [22, 0.3, -5]], color: '#9c27b0', speed: 0.39, phase: 0.5 },
  { pts: [[-18, 0.3, -18], [-10, 0.3, -18], [-10, 0.3, -22]], color: '#3f51b5', speed: 0.44, phase: 2.1 },
  { pts: [[18, 0.3, 18], [10, 0.3, 18], [10, 0.3, 22]], color: '#009688', speed: 0.41, phase: 0.9 },
  { pts: [[-32, 0.3, 0], [-25, 0.3, 0], [-25, 0.3, -8]], color: '#8bc34a', speed: 0.43, phase: 1.5 },
]

// ── STREET LIGHT POSITIONS (fills all empty campus roads) ──
const STREET_LIGHTS=[
  // E-W main road — south side
  [-28,0,2.5],[-22,0,2.5],[-16,0,2.5],[-10,0,2.5],[-4,0,2.5],[2,0,2.5],[8,0,2.5],[14,0,2.5],[20,0,2.5],
  // E-W main road — north side
  [-28,0,-4.5],[-22,0,-4.5],[-16,0,-4.5],[-10,0,-4.5],[2,0,-4.5],[8,0,-4.5],[14,0,-4.5],[20,0,-4.5],
  // N-S road — east side
  [2.8,0,-17],[2.8,0,-13],[2.8,0,-8],[2.8,0,5],[2.8,0,11],[2.8,0,16],
  // Parking area
  [14,0,18],[18,0,18],[22,0,18],
  // Corner fills
  [-26,0,-17],[26,0,-17],[-26,0,14],[26,0,14],
]

// ── MAIN EXPORT ──
export default function CampusMap3D({rooms=[],preds=[],stats,onRoomClick,selectedRoom,simHour=12,demandSuggestions=[]}){
  const roomMap=Object.fromEntries(rooms.map(r=>[r.id,r]))
  const predMap=Object.fromEntries(preds.map(p=>[p.room,p]))
  const hasPredictions=preds.some(p=>p.predicted_empty_minutes!=null)
  const energySaved=stats?.total_energy_saved_kwh||0

  return(
    <Canvas camera={{position:[0,18,32],fov:50}} gl={{antialias:true}} shadows>
      <EnvCtrl simHour={simHour}/>
      <SkyDome simHour={simHour}/>

      {/* Day clouds drifting across sky */}
      {[{p:[-22,16,-20],s:2.8,sp:0.010,o:0},{p:[5,18,-24],s:3.2,sp:0.008,o:2.1},{p:[18,15,-18],s:2.2,sp:0.013,o:4.3},{p:[-8,17,-22],s:2.5,sp:0.009,o:1.5},{p:[28,14,-16],s:1.9,sp:0.015,o:3.0}].map((c,i)=>(
        <Cloud key={i} pos={c.p} scale={c.s} speed={c.sp} offset={c.o} isNight={simHour<7||simHour>=19}/>
      ))}

      <Grid args={[70,46]} cellSize={1} cellThickness={0.4} cellColor="#001a33" sectionSize={5} sectionThickness={0.9} sectionColor="#004070" fadeDistance={50} fadeStrength={2.5} position={[0,0,-1]}/>

      <CampusGround simHour={simHour}/>
      <CampusFence/>

      {/* Street lights */}
      {STREET_LIGHTS.map((p,i)=><StreetLight key={`sl${i}`} pos={p} simHour={simHour}/>)}

      {/* Benches */}
      <Bench pos={[-9.5,0,-1]} ry={0}/>
      <Bench pos={[9.5,0,-1]} ry={0}/>
      <Bench pos={[0,0,-6]} ry={Math.PI/2}/>
      <Bench pos={[0,0,4]} ry={Math.PI/2}/>

      {/* Walking students */}
      {STUDENT_PATHS.map((p,i)=><WalkingStudent key={`ws${i}`} waypts={p.pts} speed={p.speed} color={p.color} phase={p.phase}/>)}

      {/* Infrastructure */}
      <CommTower pos={[0,0,-18]}/>
      <MicrogridController pos={[0,0,-1]} rooms={rooms} stats={stats} preds={preds}/>

      {/* Campus entrance gate (south — viewer side) + flag poles */}
      <CampusGate pos={[0,0,21.8]}/>
      <FlagPole pos={[-9,0,21]}/>
      <FlagPole pos={[9,0,21]}/>

      {/* Trees decorating the campus */}
      {/* Trees decorating the campus - moved away from roads (z=-1, x=0) */}
      <CampusTree pos={[-14,0,18]} scale={1.2}/>
      <CampusTree pos={[14,0,18]} scale={1.2} flowerColor="#ff80ab"/>
      <ConeTree pos={[-28,0,-18]} scale={1.5}/>
      <BushyTree pos={[-22,0,-18]} scale={1.3}/>
      <ConeTree pos={[28,0,-18]} scale={1.5}/>
      <CampusTree pos={[22,0,-18]} scale={1.4} flowerColor="#ff80ab"/>
      <BushyTree pos={[-20,0,4]} scale={1.1}/>
      <CampusTree pos={[20,0,4]} scale={1.1}/>
      <ConeTree pos={[-32,0,12]} scale={1.3}/>
      <BushyTree pos={[32,0,10]} scale={1.4}/>
      <CampusTree pos={[-33,0,-8]} scale={1.2} flowerColor="#ffffff"/>
      <ConeTree pos={[30,0,6]} scale={1.1}/>
      <BushyTree pos={[6,0,12]} scale={1.2}/>
      <ConeTree pos={[-12,0,-14]} scale={1.4}/>
      <CampusTree pos={[12,0,-14]} scale={1.3} flowerColor="#ffffff"/>


      {/* Tiny cars in parking */}
      <TinyCar pos={[17,0,14.3]} color="#1a3a5a"/>
      <TinyCar pos={[18.4,0,14.3]} color="#2a1040"/>
      <TinyCar pos={[19.8,0,14.3]} color="#0a2a1a"/>
      <TinyCar pos={[21.2,0,14.3]} color="#2a200a"/>

      {/* Zone labels between row and road */}
      <ZoneLabel pos={[-14,0.5,-1]} label="BLOCK A" sub="2 Rooms"/>
      <ZoneLabel pos={[-5,0.5,-1]}  label="BLOCK B" sub="2 Rooms"/>
      <ZoneLabel pos={[5,0.5,-1]}   label="BLOCK C" sub="2 Rooms"/>
      <ZoneLabel pos={[14,0.5,-1]}  label="BLOCK D" sub="2 Rooms"/>

      <PowerHub hasPredictions={hasPredictions} rooms={rooms}/>

      <SmartGridMesh rooms={rooms}/>

      {ROOMS_CFG.map(cfg=>(
        <React.Fragment key={cfg.id}>
          <Building data={cfg} room={roomMap[cfg.id]} pred={predMap[cfg.id]} isSelected={selectedRoom===cfg.id} onClick={e=>{e.stopPropagation();onRoomClick?.(cfg.id)}}/>
        </React.Fragment>
      ))}

      <DRLinks suggestions={demandSuggestions}/>

      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={0.45} mipmapBlur luminanceSmoothing={0.85} intensity={1.2}/>
      </EffectComposer>

      <CameraController selectedRoom={selectedRoom}/>
      <OrbitControls makeDefault minPolarAngle={0.08} maxPolarAngle={Math.PI/2.05} maxDistance={35} minDistance={4} target={[3,1.5,-1]}/>
    </Canvas>
  )
}
