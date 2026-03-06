/**
 * PowerSense AI — Web Audio Sound Engine
 * Generates synthetic sci-fi sounds using the Web Audio API.
 * No external audio files needed.
 */

let ctx = null

function getCtx() {
    if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)()
    }
    // Resume if suspended (browser auto-suspend policy)
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
}

let isMuted = false

export function setMuteState(muted) {
    isMuted = muted
    if (ambientNode) {
        const c = getCtx()
        ambientNode.gain.gain.linearRampToValueAtTime(muted ? 0 : 0.015, c.currentTime + 0.5)
    }
}

/** Subtle high-tech hover blip */
export function playHover() {
    if (isMuted) return
    try {
        const c = getCtx()
        const osc = c.createOscillator()
        const gain = c.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(1800, c.currentTime)
        osc.frequency.exponentialRampToValueAtTime(2400, c.currentTime + 0.06)
        gain.gain.setValueAtTime(0.06, c.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1)
        osc.connect(gain).connect(c.destination)
        osc.start(c.currentTime)
        osc.stop(c.currentTime + 0.1)
    } catch (e) { /* silent */ }
}

/** Room click / selection — deeper confirmation tone */
export function playSelect() {
    if (isMuted) return
    try {
        const c = getCtx()
        const osc = c.createOscillator()
        const osc2 = c.createOscillator()
        const gain = c.createGain()
        osc.type = 'triangle'
        osc2.type = 'sine'
        osc.frequency.setValueAtTime(400, c.currentTime)
        osc.frequency.exponentialRampToValueAtTime(800, c.currentTime + 0.12)
        osc2.frequency.setValueAtTime(600, c.currentTime)
        osc2.frequency.exponentialRampToValueAtTime(1200, c.currentTime + 0.12)
        gain.gain.setValueAtTime(0.08, c.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2)
        osc.connect(gain)
        osc2.connect(gain)
        gain.connect(c.destination)
        osc.start(c.currentTime)
        osc2.start(c.currentTime)
        osc.stop(c.currentTime + 0.2)
        osc2.stop(c.currentTime + 0.2)
    } catch (e) { /* silent */ }
}

/** Power-down whoosh — descending noise sweep */
export function playPowerDown() {
    if (isMuted) return
    try {
        const c = getCtx()
        const osc = c.createOscillator()
        const gain = c.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(600, c.currentTime)
        osc.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.5)
        gain.gain.setValueAtTime(0.05, c.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5)
        osc.connect(gain).connect(c.destination)
        osc.start(c.currentTime)
        osc.stop(c.currentTime + 0.5)
    } catch (e) { /* silent */ }
}

/** Power-up ascending chime */
export function playPowerUp() {
    if (isMuted) return
    try {
        const c = getCtx()
        const osc = c.createOscillator()
        const gain = c.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(300, c.currentTime)
        osc.frequency.exponentialRampToValueAtTime(900, c.currentTime + 0.25)
        gain.gain.setValueAtTime(0.06, c.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.35)
        osc.connect(gain).connect(c.destination)
        osc.start(c.currentTime)
        osc.stop(c.currentTime + 0.35)
    } catch (e) { /* silent */ }
}

/** Override toggle — two-tone alarm bleep */
export function playOverride() {
    if (isMuted) return
    try {
        const c = getCtx()
        const osc = c.createOscillator()
        const gain = c.createGain()
        osc.type = 'square'
        osc.frequency.setValueAtTime(520, c.currentTime)
        osc.frequency.setValueAtTime(680, c.currentTime + 0.08)
        osc.frequency.setValueAtTime(520, c.currentTime + 0.16)
        gain.gain.setValueAtTime(0.04, c.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25)
        osc.connect(gain).connect(c.destination)
        osc.start(c.currentTime)
        osc.stop(c.currentTime + 0.25)
    } catch (e) { /* silent */ }
}

/** Ambient hub hum — very quiet continuous drone */
let ambientNode = null
export function startAmbient() {
    if (ambientNode) return
    try {
        const c = getCtx()
        const osc = c.createOscillator()
        const gain = c.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(60, c.currentTime)
        gain.gain.setValueAtTime(isMuted ? 0 : 0.015, c.currentTime)
        osc.connect(gain).connect(c.destination)
        osc.start()
        ambientNode = { osc, gain }
    } catch (e) { /* silent */ }
}
