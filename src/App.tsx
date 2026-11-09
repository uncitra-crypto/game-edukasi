import { useState, useEffect, useRef, memo, type ReactNode, type CSSProperties, type PointerEvent as PtrEv } from 'react'

/* =====================================================================
   SUARA – efek & musik dibuat langsung lewat Web Audio API
   (tanpa file audio → tidak menambah ukuran aplikasi, tidak ada izin hak cipta)
   ===================================================================== */
type Bunyi =
  | 'klik' | 'loncat' | 'mendarat' | 'langkah' | 'koin' | 'bentuk' | 'injak' | 'kena' | 'terkunci'
  | 'gerbangBuka' | 'masuk' | 'mulai' | 'benar' | 'salah' | 'menang' | 'kalah' | 'boing'
type Lagu = 'tenang' | 'seru'
type OpsiNada = { tipe?: OscillatorType; vol?: number; ke?: number; atk?: number }
type OpsiDerau = { vol?: number; f?: number; q?: number; tipe?: BiquadFilterType }

const AKOR = [48, 45, 41, 43] // C – Am – F – G
const LAGU: Record<Lagu, { bpm: number; tipe: OscillatorType; vol: number; ekor: number; mel: number[][]; bas: number[] }> = {
  tenang: {
    bpm: 92, tipe: 'triangle', vol: 0.11, ekor: 1.7, bas: [0, 4],
    mel: [[72, 0, 76, 0, 79, 76, 0, 0], [69, 0, 72, 0, 76, 72, 0, 0], [65, 0, 69, 0, 72, 69, 0, 0], [67, 0, 71, 0, 74, 71, 67, 0]],
  },
  seru: {
    bpm: 136, tipe: 'square', vol: 0.045, ekor: 0.85, bas: [0, 2, 4, 6],
    mel: [[72, 76, 79, 76, 84, 79, 76, 79], [69, 72, 76, 72, 81, 76, 72, 76], [65, 69, 72, 69, 77, 72, 69, 72], [67, 71, 74, 71, 79, 74, 71, 74]],
  },
}
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

const suara = (() => {
  let ctx: AudioContext | null = null
  let sfx: GainNode, mus: GainNode, master: GainNode
  let derau: AudioBuffer
  let mati = false
  try { mati = localStorage.getItem('suara-mati') === '1' } catch { /* penyimpanan tidak tersedia */ }

  /* AudioContext baru boleh dibuat/diaktifkan setelah sentuhan pertama pemain */
  const buka = (): AudioContext | null => {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
      master = ctx.createGain(); master.gain.value = mati ? 0 : 1; master.connect(ctx.destination)
      sfx = ctx.createGain(); sfx.gain.value = 0.7; sfx.connect(master)
      mus = ctx.createGain(); mus.gain.value = 0.5; mus.connect(master)
      derau = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate)
      const d = derau.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  }

  const nada = (f: number, t: number, dur: number, o: OpsiNada = {}, tujuan?: GainNode) => {
    if (!ctx) return
    const { tipe = 'sine', vol = 0.2, ke, atk = 0.008 } = o
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = tipe
    osc.frequency.setValueAtTime(f, t)
    if (ke) osc.frequency.exponentialRampToValueAtTime(ke, t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(atk, dur * 0.5))
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g); g.connect(tujuan ?? sfx)
    osc.start(t); osc.stop(t + dur + 0.03)
  }

  const desir = (t: number, dur: number, o: OpsiDerau = {}) => {
    if (!ctx) return
    const { vol = 0.2, f = 800, q = 0.7, tipe = 'lowpass' } = o
    const s = ctx.createBufferSource()
    const fl = ctx.createBiquadFilter()
    const g = ctx.createGain()
    s.buffer = derau
    fl.type = tipe; fl.frequency.value = f; fl.Q.value = q
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    s.connect(fl); fl.connect(g); g.connect(sfx)
    s.start(t); s.stop(t + Math.min(dur, 0.45) + 0.03)
  }

  const urut = (notes: number[], t: number, jarak: number, dur: number, o: OpsiNada) =>
    notes.forEach((f, i) => nada(f, t + i * jarak, dur, o))

  const efek: Record<Bunyi, (t: number) => void> = {
    klik: (t) => nada(620, t, 0.07, { tipe: 'triangle', vol: 0.22, ke: 900 }),
    loncat: (t) => { nada(300, t, 0.18, { vol: 0.28, ke: 720 }); nada(450, t, 0.12, { tipe: 'triangle', vol: 0.07, ke: 950 }) },
    mendarat: (t) => { desir(t, 0.07, { vol: 0.25, f: 500 }); nada(140, t, 0.09, { vol: 0.28, ke: 70 }) },
    langkah: (t) => desir(t, 0.035, { vol: 0.06, f: 1400, q: 1.2, tipe: 'bandpass' }),
    koin: (t) => { nada(988, t, 0.09, { tipe: 'square', vol: 0.09 }); nada(1319, t + 0.07, 0.28, { tipe: 'square', vol: 0.09 }) },
    bentuk: (t) => { urut([523, 659, 784, 1047], t, 0.07, 0.22, { tipe: 'triangle', vol: 0.22 }); nada(2093, t + 0.28, 0.35, { vol: 0.06 }) },
    injak: (t) => { nada(520, t, 0.2, { vol: 0.33, ke: 110 }); desir(t, 0.1, { vol: 0.28, f: 900 }); nada(200, t + 0.08, 0.15, { tipe: 'triangle', vol: 0.14, ke: 420 }) },
    kena: (t) => { nada(380, t, 0.35, { tipe: 'sawtooth', vol: 0.16, ke: 90 }); desir(t, 0.18, { vol: 0.28, f: 700 }) },
    terkunci: (t) => { nada(190, t, 0.1, { tipe: 'square', vol: 0.1 }); nada(150, t + 0.11, 0.16, { tipe: 'square', vol: 0.1 }) },
    gerbangBuka: (t) => {
      urut([392, 523, 659, 784, 1047], t, 0.08, 0.3, { tipe: 'triangle', vol: 0.2 })
      nada(1568, t + 0.4, 0.5, { vol: 0.07 }); desir(t, 0.3, { vol: 0.07, f: 3000, tipe: 'highpass' })
    },
    masuk: (t) => { nada(260, t, 0.55, { vol: 0.26, ke: 1300 }); nada(520, t + 0.05, 0.5, { tipe: 'triangle', vol: 0.12, ke: 2000 }) },
    mulai: (t) => urut([392, 523, 784], t, 0.1, 0.2, { tipe: 'triangle', vol: 0.2 }),
    benar: (t) => { urut([784, 1047, 1319], t, 0.1, 0.18, { tipe: 'triangle', vol: 0.24 }); urut([523, 659, 784], t + 0.3, 0, 0.5, { tipe: 'sine', vol: 0.1 }) },
    salah: (t) => { nada(311, t, 0.22, { tipe: 'sawtooth', vol: 0.12, ke: 290 }); nada(233, t + 0.22, 0.4, { tipe: 'sawtooth', vol: 0.12, ke: 190 }) },
    menang: (t) => {
      urut([523, 523, 523, 659, 784], t, 0.12, 0.16, { tipe: 'triangle', vol: 0.22 })
      nada(1047, t + 0.62, 0.7, { tipe: 'triangle', vol: 0.24 }); nada(784, t + 0.62, 0.7, { tipe: 'sine', vol: 0.12 }); nada(659, t + 0.62, 0.7, { tipe: 'sine', vol: 0.1 })
    },
    kalah: (t) => urut([392, 349, 311, 262], t, 0.2, 0.34, { tipe: 'triangle', vol: 0.2 }),
    boing: (t) => { nada(200, t, 0.14, { vol: 0.3, ke: 560 }); nada(560, t + 0.14, 0.26, { vol: 0.26, ke: 240 }) },
  }

  /* ---------- musik latar: penjadwal "lookahead" ---------- */
  let lagu: Lagu | null = null
  let timer = 0
  let step = 0
  let next = 0
  const jadwal = () => {
    if (!ctx || !lagu || mati || ctx.state !== 'running') return
    const L = LAGU[lagu]
    const dur = 60 / L.bpm / 2
    if (next < ctx.currentTime) next = ctx.currentTime + 0.05
    while (next < ctx.currentTime + 0.3) {
      const bar = Math.floor(step / 8) % 4
      const s = step % 8
      const m = L.mel[bar][s]
      if (m) nada(hz(m), next, dur * L.ekor, { tipe: L.tipe, vol: L.vol }, mus)
      if (L.bas.includes(s)) nada(hz(AKOR[bar]), next, dur * 1.8, { vol: L.vol * 1.5 }, mus)
      next += dur
      step++
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return
      if (document.hidden) void ctx.suspend()
      else void ctx.resume()
    })
  }

  return {
    buka,
    nyala: () => !mati,
    atur: (nyala: boolean) => {
      mati = !nyala
      try { localStorage.setItem('suara-mati', mati ? '1' : '0') } catch { /* abaikan */ }
      if (ctx) master.gain.setTargetAtTime(mati ? 0 : 1, ctx.currentTime, 0.02)
    },
    main: (b: Bunyi, tunda = 0) => {
      if (mati) return
      const c = buka()
      if (c) efek[b](c.currentTime + 0.005 + tunda)
    },
    /* bintang ke-i di layar hasil: nada naik tangga pentatonik */
    bintang: (i: number, tunda = 0) => {
      if (mati) return
      const c = buka()
      if (!c) return
      const t = c.currentTime + 0.005 + tunda
      const f = [523, 587, 659, 784, 880][i % 5]
      nada(f, t, 0.32, { tipe: 'triangle', vol: 0.24 }); nada(f * 2, t, 0.2, { vol: 0.07 }); desir(t, 0.06, { vol: 0.08, f: 4000, tipe: 'highpass' })
    },
    musik: (l: Lagu | null) => {
      if (l === lagu) return
      lagu = l
      step = 0
      next = 0
      window.clearInterval(timer)
      timer = 0
      if (l) timer = window.setInterval(jadwal, 80)
    },
  }
})()
 
/* =====================================================================
   PETUALANGAN BANGUN DATAR – layar beranda (versi HD)
   - Semua gambar berupa SVG vektor → tajam di layar berapa pun (retina/4K)
   - Semua ukuran memakai cqw → proporsional di semua perangkat
   - Rasio layar 9:16 persis seperti desain
   ===================================================================== */
 
const gaya = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap');
 
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
html, body, #root { height: 100%; }
body {
  background: radial-gradient(circle at 50% 30%, #3b4a6b, #151c2e);
  font-family: 'Fredoka', system-ui, sans-serif;
  display: block; place-items: initial;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: geometricPrecision;
}
 
.layar {
  position: relative;
  width: min(100vw, calc(100dvh * 400 / 711));
  aspect-ratio: 400 / 711;
  margin: 0 auto;
  overflow: hidden;
  container-type: inline-size;
  color: #17306b;
  user-select: none;
  background: #5db4ee;
}
.layar button { font-family: inherit; border: 0; cursor: pointer; }
.layar > * { position: absolute; }
.layar svg { display: block; shape-rendering: geometricPrecision; }
.latar { inset: 0; width: 100%; height: 100%; }
 
/* ---------- bar atas ---------- */
.bar-atas { display: contents; }
/* PENTING: anak <header> bukan anak langsung .layar, jadi harus diberi position sendiri.
   Tanpa ini profil, bintang, berlian, dan pengaturan tertimpa latar SVG (tidak terlihat). */
.profil, .mata-uang, .pengaturan { position: absolute; z-index: 5; }
.panel-gelap {
  background: linear-gradient(#1b4a94, #0f3170);
  box-shadow: 0 0.5cqw 0 #081f4a, inset 0 0.25cqw 0 rgba(255,255,255,.18), 0 1.2cqw 2cqw rgba(8,30,70,.3);
  border: 0.375cqw solid #0b2a60;
}
.profil {
  left: 4cqw; top: 4.25cqw; width: 36.75cqw; height: 12.5cqw;
  display: flex; align-items: center; gap: 2cqw; padding: 0 2.5cqw 0 1.25cqw;
  border-radius: 4.5cqw; color: #fff;
}
.avatar { width: 10.25cqw; height: 10.25cqw; border-radius: 50%; border: 0.7cqw solid #fff; flex: none; box-shadow: 0 0.4cqw 0.8cqw rgba(0,0,0,.3); }
.profil-info { flex: 1; line-height: 1.05; }
.profil-info small { display: block; font-size: 2.25cqw; font-weight: 500; color: #8fd8e8; }
.profil-info strong { display: block; font-size: 3.5cqw; font-weight: 700; letter-spacing: .1cqw; }
.xp { height: 1.9cqw; margin: 0.6cqw 0 0.5cqw; background: #08224f; border-radius: 1.5cqw; overflow: hidden; box-shadow: inset 0 0.25cqw 0.4cqw rgba(0,0,0,.45); }
.xp span { display: block; height: 100%; background: linear-gradient(#a6f27a, #54c93a); border-radius: 1.5cqw; }
 
.mata-uang {
  top: 5.25cqw; height: 6cqw; left: 73cqw; width: 17.5cqw;
  display: flex; align-items: center; gap: 1cqw; padding: 0 0.6cqw 0 1cqw;
  border-radius: 3.2cqw; color: #fff;
}
.mata-uang.bintang { left: 51.5cqw; width: 20.5cqw; }
.mata-uang b { flex: 1; font-size: 3.2cqw; font-weight: 600; text-align: center; }
.koin { width: 5.25cqw; height: 5.25cqw; flex: none; filter: drop-shadow(0 0.25cqw 0.25cqw rgba(0,0,0,.3)); }
.tambah {
  position: relative; width: 4.5cqw; height: 4.5cqw; border-radius: 50%; padding: 0; flex: none;
  background: radial-gradient(circle at 35% 30%, #b6f58f, #4ec234);
  border: 0.3cqw solid #e9ffe0 !important;
  box-shadow: 0 0.3cqw 0 #2f8a24;
}
.tambah::before, .tambah::after {
  content: ''; position: absolute; left: 50%; top: 50%; background: #fff; border-radius: 1cqw;
  transform: translate(-50%, -50%); box-shadow: 0 0.15cqw 0 rgba(30,100,20,.5);
}
.tambah::before { width: 2.4cqw; height: 0.6cqw; }
.tambah::after { width: 0.6cqw; height: 2.4cqw; }
.pengaturan {
  left: 91.25cqw; top: 4.75cqw; width: 7cqw; height: 7cqw; padding: 1.1cqw; border-radius: 50%;
}
.pengaturan svg { width: 100%; height: 100%; }
 
/* ---------- misi ---------- */
.misi {
  left: 60.5cqw; top: 15.5cqw; width: 35.25cqw; height: 14cqw;
  display: flex; align-items: center; gap: 1.5cqw; padding: 0 1.5cqw 0 2cqw;
  background: linear-gradient(#ffffff, #eef5fc); border-radius: 3.5cqw; text-align: left;
  color: #17306b;
  box-shadow: 0 0.5cqw 0 rgba(120,160,205,.55), 0 1.5cqw 3cqw rgba(20,60,120,.18);
}
.misi-ikon { width: 5.5cqw; flex: none; }
.misi-teks { flex: 1; line-height: 1.15; }
.misi-teks b { display: block; font-size: 2.6cqw; font-weight: 600; }
.misi-teks span { display: block; font-size: 2.05cqw; font-weight: 400; color: #4a5f86; margin-top: 0.3cqw; }
.misi-progres { display: flex; align-items: center; gap: 1.25cqw; margin-top: 1.1cqw; }
.misi-progres .bar { flex: 1; height: 1.7cqw; background: #d4e2f3; border-radius: 1.5cqw; overflow: hidden; }
.misi-progres i { display: block; height: 100%; background: linear-gradient(#a6f27a, #54c93a); border-radius: 1.5cqw; }
.misi-progres em { font-style: normal; font-size: 2cqw; color: #4a5f86; }
.panah { width: 2.5cqw; height: 3.5cqw; flex: none; }
 
/* ---------- logo ---------- */
.logo { left: 0; top: 28cqw; width: 100cqw; }
.logo svg { width: 100%; height: auto; overflow: visible; }
.logo text { font-family: 'Fredoka', system-ui, sans-serif; font-weight: 700; }
 
/* ---------- tombol ---------- */
.aksi { left: 22.25cqw; top: 81.3cqw; width: 55.75cqw; height: 15cqw; }
.tombol {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center; gap: 3.5cqw;
  background: linear-gradient(#ffe36e 0%, #ffc72a 55%, #ffb21a 100%);
  border: 0.75cqw solid #f29a12 !important;
  border-radius: 7.5cqw;
  box-shadow: 0 1.1cqw 0 #c27006, inset 0 0.5cqw 0 rgba(255,255,255,.55), 0 2.5cqw 3cqw rgba(0,0,0,.2);
  color: #14306e; font-size: 5.1cqw; font-weight: 700;
  transition: transform .12s, box-shadow .12s;
}
.tombol:active { transform: translateY(0.9cqw); box-shadow: 0 0.2cqw 0 #c27006, inset 0 0.5cqw 0 rgba(255,255,255,.55); }
.tombol:focus-visible { outline: 0.75cqw solid #fff; outline-offset: 0.75cqw; }
.tombol-ikon { width: 7cqw; height: 7cqw; filter: drop-shadow(0 0.3cqw 0 rgba(150,90,0,.35)); }
 
/* ---------- adegan ---------- */
.papan { left: 1cqw; top: 105.5cqw; width: 26cqw; height: 28cqw; }
.maskot { left: 22cqw; top: 105cqw; width: 44cqw; height: 52cqw; filter: drop-shadow(0 1.5cqw 1cqw rgba(30,60,20,.3)); }
.musuh { left: 63cqw; top: 114cqw; width: 36cqw; height: 17cqw; filter: drop-shadow(0 1cqw 0.8cqw rgba(20,60,30,.3)); }
.papan, .maskot, .musuh { overflow: visible; }
 
/* ---------- animasi maskot (halus, "napas" santai) ---------- */
.maskot { transform-origin: 50% 96%; animation: maskot-napas 3.4s ease-in-out infinite; will-change: transform; }
@keyframes maskot-napas {
  0%, 100% { transform: translateY(0) scale(1, 1) rotate(0deg); }
  50%      { transform: translateY(-1.1cqw) scale(0.985, 1.02) rotate(-0.8deg); }
}
/* kedip: seluruh mata menutup sebentar */
.mata-kedip { transform-box: fill-box; transform-origin: center; animation: maskot-kedip 4.6s infinite; }
@keyframes maskot-kedip {
  0%, 92%, 100% { transform: scaleY(1); }
  95.5%         { transform: scaleY(0.08); }
}
/* pupil melirik kiri-kanan */
.pupil { animation: maskot-lirik 7s ease-in-out infinite; }
@keyframes maskot-lirik {
  0%, 18%, 100% { transform: translate(0, 0); }
  28%, 48%      { transform: translate(-2.2px, 0.6px); }
  60%, 82%      { transform: translate(2.2px, -0.4px); }
}
/* tangan kanan melambai pelan (bertumpu di bahu) */
.tangan-kanan { transform-origin: 146px 112px; animation: maskot-lambai 2.6s ease-in-out infinite; }
@keyframes maskot-lambai {
  0%, 100% { transform: rotate(0deg); }
  50%      { transform: rotate(-9deg); }
}
/* tangan kiri bergoyang tipis, ransel ikut mengayun */
.tangan-kiri { transform-origin: 40px 150px; animation: maskot-ayun 3.4s ease-in-out infinite; }
@keyframes maskot-ayun {
  0%, 100% { transform: rotate(0deg); }
  50%      { transform: rotate(4deg); }
}
.maskot { cursor: pointer; }
.maskot.maskot-tap { animation: maskot-loncat .55s cubic-bezier(.3,.7,.4,1) 1; }
@keyframes maskot-loncat {
  0%   { transform: translateY(0) scale(1.08, .9); }
  35%  { transform: translateY(-5cqw) scale(.95, 1.08) rotate(-3deg); }
  65%  { transform: translateY(0) scale(1.06, .92); }
  100% { transform: translateY(0) scale(1, 1); }
}
.ransel-ayun { transform-origin: 30px 130px; animation: maskot-ransel 3.4s ease-in-out infinite; animation-delay: .25s; }
@keyframes maskot-ransel {
  0%, 100% { transform: rotate(0deg); }
  50%      { transform: rotate(2.5deg); }
}
 
/* ---------- navigasi bawah ---------- */
.navigasi {
  left: 4.75cqw; top: 158.6cqw; width: 90.5cqw; height: 23cqw;
  display: flex; justify-content: space-around; align-items: flex-start;
  padding: 2.5cqw 1.5cqw 0;
  background: linear-gradient(#f9fbfe, #eaf1f9);
  border-radius: 7cqw 7cqw 0 0;
  box-shadow: 0 -0.6cqw 3cqw rgba(0,0,0,.14), inset 0 0.3cqw 0 #fff;
}
.navigasi button {
  width: 16.5cqw; height: 12.5cqw; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5cqw;
  background: transparent; color: #3b5ea0; border-radius: 4cqw; padding: 0;
  font-size: 2.6cqw; font-weight: 500;
}
.navigasi button svg { width: 7cqw; height: 7cqw; }
.navigasi button.aktif { background: #cfe3fa; color: #1b5cc2; font-weight: 600; }
.navigasi button:focus-visible { outline: 0.5cqw solid #1d5fc4; }
 
@media (prefers-reduced-motion: reduce) {
  .tombol { transition: none; }
  .maskot, .maskot.maskot-tap, .mata-kedip, .pupil, .tangan-kanan, .tangan-kiri, .ransel-ayun { animation: none; }
}
`
 
/* ===== TOMBOL ===== */
type TombolProps = { children?: ReactNode; onClick?: () => void }
 
function Tombol({ children = 'Mulai Petualangan', onClick }: TombolProps) {
  return (
    <button className="tombol" onClick={onClick}>
      <svg className="tombol-ikon" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M11 5 L42 24 L11 43 Z" fill="#fff" stroke="#14306e" strokeWidth="4.5" strokeLinejoin="round" />
      </svg>
      <span>{children}</span>
    </button>
  )
}
 
/* ===== LOGO (judul memakai teks SVG → tajam di segala ukuran) ===== */
function Logo() {
  return (
    <div className="logo">
      <svg viewBox="0 0 400 212" role="img" aria-label="Petualangan Bangun Datar">
        <defs>
          <linearGradient id="kuningJudul" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff07a" />
            <stop offset=".5" stopColor="#ffc928" />
            <stop offset="1" stopColor="#ff9f0f" />
          </linearGradient>
          <linearGradient id="kuningBentuk" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffe45a" />
            <stop offset="1" stopColor="#f5a80d" />
          </linearGradient>
          <linearGradient id="biruBentuk" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4cb4ff" />
            <stop offset="1" stopColor="#1769d6" />
          </linearGradient>
          <radialGradient id="merahBentuk" cx=".35" cy=".3" r=".8">
            <stop offset="0" stopColor="#ff7d86" />
            <stop offset="1" stopColor="#d4243c" />
          </radialGradient>
          <linearGradient id="hijauBentuk" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#74d45a" />
            <stop offset="1" stopColor="#2c8f3a" />
          </linearGradient>
          <path id="lengkung" d="M100 197 Q205 171 305 194" />
        </defs>
 
        {/* bendera */}
        <rect x="200.5" y="4" width="3" height="32" rx="1.5" fill="#8a5a2b" />
        <path d="M203 5 L229 12 L203 20Z" fill="#e8353f" stroke="#a31d27" strokeWidth="1.5" strokeLinejoin="round" />
 
        {/* bentuk-bentuk di belakang judul */}
        <path d="M174 84 L202 30 L246 84Z" fill="url(#hijauBentuk)" stroke="#1f6a2c" strokeWidth="3" strokeLinejoin="round" />
        <path d="M202 30 L246 84 L214 84Z" fill="#1f6a2c" opacity=".25" />
        <circle cx="214" cy="72" r="33" fill="url(#merahBentuk)" />
        <ellipse cx="202" cy="56" rx="11" ry="6" fill="#fff" opacity=".35" transform="rotate(-25 202 56)" />
        <g transform="rotate(8 275 62)">
          <rect x="246" y="38" width="58" height="48" rx="7" fill="url(#biruBentuk)" stroke="#0f3f93" strokeWidth="3.5" />
          <rect x="250" y="42" width="50" height="8" rx="4" fill="#fff" opacity=".35" />
        </g>
        <path d="M118 90 L148 40 L178 90Z" fill="url(#kuningBentuk)" stroke="#f0a30c" strokeWidth="8" strokeLinejoin="round" />
        <path d="M148 46 L124 86" stroke="#fff6b0" strokeWidth="4" strokeLinecap="round" opacity=".8" />
 
        {/* daun */}
        <g fill="#3fae4a" stroke="#1f6a2c" strokeWidth="2" strokeLinejoin="round">
          <path d="M96 86 Q88 70 104 66 Q118 72 108 90Z" />
          <path d="M84 104 Q72 90 86 82 Q104 92 94 110Z" />
          <path d="M300 78 Q318 70 322 84 Q314 98 298 92Z" />
          <path d="M318 98 Q336 94 340 108 Q330 122 314 114Z" />
          <path d="M92 118 Q104 112 112 124 Q102 134 92 128Z" />
        </g>
 
        {/* "Petualangan" */}
        <g transform="rotate(2.5 200 100)">
          <text x="200" y="124" textAnchor="middle" fontSize="42" textLength="236" lengthAdjust="spacingAndGlyphs"
            fill="#071a45" stroke="#071a45" strokeWidth="13" strokeLinejoin="round" transform="translate(0 4)">Petualangan</text>
          <text x="200" y="124" textAnchor="middle" fontSize="42" textLength="236" lengthAdjust="spacingAndGlyphs"
            fill="#fff" stroke="#14306e" strokeWidth="9" strokeLinejoin="round" paintOrder="stroke fill">Petualangan</text>
        </g>
 
        {/* "Bangun Datar" */}
        <g transform="rotate(2.5 200 150)">
          <text x="200" y="170" textAnchor="middle" fontSize="54" textLength="290" lengthAdjust="spacingAndGlyphs"
            fill="#071a45" stroke="#071a45" strokeWidth="14" strokeLinejoin="round" transform="translate(0 5)">Bangun Datar</text>
          <text x="200" y="170" textAnchor="middle" fontSize="54" textLength="290" lengthAdjust="spacingAndGlyphs"
            fill="url(#kuningJudul)" stroke="#14306e" strokeWidth="10" strokeLinejoin="round" paintOrder="stroke fill">Bangun Datar</text>
        </g>
 
        {/* pita slogan */}
        <path d="M91 186 Q205 160 314 182 L306 204 Q205 186 100 206Z" fill="#0d2a66" transform="translate(0 3)" />
        <path d="M91 186 Q205 160 314 182 L306 204 Q205 186 100 206Z" fill="#1b4aa8" stroke="#0f2a63" strokeWidth="2" strokeLinejoin="round" />
        <text fontSize="13.5" fontWeight="600" fill="#fff" style={{ fontWeight: 600 }}>
          <textPath href="#lengkung" startOffset="50%" textAnchor="middle">Jelajahi Dunia, Temukan Bentuknya!</textPath>
        </text>
      </svg>
    </div>
  )
}
 
/* ===== LATAR PEMANDANGAN ===== */
function Latar() {
  return (
    <svg className="latar" viewBox="0 0 400 711" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="langit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f86e6" />
          <stop offset=".5" stopColor="#74bff2" />
          <stop offset="1" stopColor="#d6f0ff" />
        </linearGradient>
        <linearGradient id="rumput" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8be04f" />
          <stop offset="1" stopColor="#3b9a35" />
        </linearGradient>
        <linearGradient id="tebing" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a97a8" />
          <stop offset="1" stopColor="#b7c0c9" />
        </linearGradient>
        <linearGradient id="sungai" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#58c8f4" />
          <stop offset="1" stopColor="#1f93d8" />
        </linearGradient>
        <linearGradient id="jalan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0cb86" />
          <stop offset="1" stopColor="#d9a559" />
        </linearGradient>
        <g id="awan">
          <circle cx="0" cy="0" r="30" /><circle cx="34" cy="-14" r="34" /><circle cx="72" cy="2" r="28" /><rect x="-30" y="0" width="130" height="30" rx="15" />
        </g>
        <g id="pohon">
          <rect x="-2.5" y="0" width="5" height="22" rx="2" fill="#6b4a2b" />
          <circle cx="0" cy="-6" r="16" fill="#2f8f34" /><circle cx="-6" cy="-12" r="11" fill="#4cb040" /><circle cx="8" cy="-4" r="10" fill="#3fa23a" />
        </g>
      </defs>
 
      <rect width="400" height="711" fill="url(#langit)" />
 
      {/* awan (bayangan + isi) */}
      <g fill="#cfe6f8" opacity=".9">
        <use href="#awan" transform="translate(-14 128) scale(1.35)" />
        <use href="#awan" transform="translate(318 168) scale(.8)" />
      </g>
      <g fill="#fff">
        <use href="#awan" transform="translate(-14 122) scale(1.35)" />
        <use href="#awan" transform="translate(40 66) scale(.75)" />
        <use href="#awan" transform="translate(318 162) scale(.8)" />
        <use href="#awan" transform="translate(30 268) scale(.9)" opacity=".85" />
        <use href="#awan" transform="translate(290 250) scale(.7)" opacity=".85" />
        <use href="#awan" transform="translate(150 392) scale(.7)" opacity=".7" />
      </g>
 
      {/* gunung jauh */}
      <path d="M0 380 L48 298 L92 362 L132 328 L176 404 L196 436 V480 H0Z" fill="#86afd0" />
      <path d="M48 298 L66 326 L50 340 L34 330Z" fill="#b8d3e8" />
      <path d="M190 446 L248 372 L284 408 L322 352 L364 408 L400 380 V480 H190Z" fill="#9cc3de" />
      <path d="M322 352 L338 376 L324 386 L308 376Z" fill="#c4dcec" />
      <path d="M0 440 Q100 410 200 440 T400 430 V480 H0Z" fill="#b9dcc4" opacity=".6" />
 
      {/* tebing kiri */}
      <path d="M0 280 H46 Q62 282 64 300 V396 H0Z" fill="url(#tebing)" />
      <path d="M0 280 H50 Q64 284 64 298 V310 H0Z" fill="#6cc84a" />
      <path d="M12 320 H34 M40 350 H58 M6 372 H26" stroke="#707d8d" strokeWidth="2" strokeLinecap="round" />
      <use href="#pohon" transform="translate(30 262)" />
 
      {/* bukit tengah */}
      <path d="M0 440 Q70 402 140 430 T262 440 T400 430 V711 H0Z" fill="url(#rumput)" />
      <path d="M0 474 Q90 444 170 472 T330 472 T400 462 V711 H0Z" fill="#6cc447" opacity=".75" />
      <use href="#pohon" transform="translate(106 396)" />
      <use href="#pohon" transform="translate(196 414) scale(.7)" />
      <use href="#pohon" transform="translate(30 384) scale(.8)" />
      <use href="#pohon" transform="translate(140 424) scale(.55)" />
 
      {/* tebing kanan bertingkat + kastil */}
      <path d="M300 440 H400 V565 H318Z" fill="url(#tebing)" />
      <path d="M292 438 H400 V453 H298Z" fill="#74d04c" />
      <path d="M312 470 H400 V485 H318Z" fill="#74d04c" />
      <path d="M326 500 H400 V515 H332Z" fill="#82d956" />
      <path d="M318 526 H400 V540 H324Z" fill="#74d04c" />
      <path d="M330 424 H400 V440 H324Z" fill="#74d04c" />
      <g>
        <rect x="334" y="352" width="58" height="76" fill="#c1b69f" />
        <rect x="334" y="352" width="58" height="8" fill="#a89c85" />
        <path d="M368 352 H392 V428 H368Z" fill="#000" opacity=".08" />
        <path d="M329 353 L363 316 L397 353Z" fill="#f4b836" stroke="#d9951a" strokeWidth="2" strokeLinejoin="round" />
        <rect x="361" y="292" width="2.5" height="28" fill="#7a5632" />
        <path d="M363 293 L382 300 L363 307Z" fill="#e63e3e" />
        <rect x="349" y="372" width="9" height="13" rx="1" fill="#6a6154" />
        <rect x="372" y="394" width="9" height="13" rx="1" fill="#6a6154" />
        <path d="M351 428 V410 Q362 396 373 410 V428Z" fill="#5a5145" />
        <circle cx="400" cy="372" r="13" fill="#e8465a" />
      </g>
 
      {/* sungai */}
      <path d="M228 490 Q264 498 252 532 Q246 562 284 594 L338 604 Q268 562 282 526 Q294 492 254 482Z" fill="url(#sungai)" />
      <path d="M240 520 q20 4 30 -6 M262 566 q14 6 26 -2" stroke="#c9f0ff" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M246 506 H292 V521 H252Z" fill="#938878" /><path d="M246 506 H292 V510 H246Z" fill="#b3a898" />
      <path d="M262 536 H324 V554 H268Z" fill="#a49887" /><path d="M262 536 H324 V540 H262Z" fill="#c4b9a8" />
      <path d="M250 540 H262 V548 H252Z" fill="#7fc9ee" />
 
      {/* jalan setapak */}
      <path d="M112 711 Q154 622 102 572 Q72 546 20 530 L0 520 V711Z" fill="url(#jalan)" />
      <path d="M132 711 Q178 620 116 566 Q72 540 22 524 L18 536 Q76 556 102 582 Q152 626 110 711Z" fill="#c9954a" opacity=".55" />
      <path d="M120 711 Q240 640 380 640 V711Z" fill="url(#jalan)" />
      <g fill="#f8dca0" opacity=".7"><circle cx="120" cy="650" r="2.5" /><circle cx="150" cy="680" r="2" /><circle cx="250" cy="680" r="2.5" /></g>
 
      {/* semak & rumput depan */}
      <g fill="#2f8f34">
        <path d="M0 596 Q44 586 84 640 Q42 652 0 704Z" />
        <path d="M400 578 Q350 598 330 662 Q372 650 400 702Z" />
      </g>
      <g fill="#3fae40">
        <path d="M0 650 Q52 618 122 690 L122 711 H0Z" />
        <path d="M400 640 Q340 650 300 711 H400Z" />
      </g>
      <g fill="#6cd24c">
        <path d="M0 620 Q20 606 44 636 Q22 632 0 650Z" />
        <path d="M400 604 Q380 606 362 640 Q384 630 400 640Z" />
      </g>
      <g fill="#245f2a" opacity=".5">
        <path d="M0 690 Q60 660 132 711 H0Z" /><path d="M400 690 Q340 670 290 711 H400Z" />
      </g>
      <g stroke="#2a7a2f" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M130 690 l-4 -12 M136 692 l2 -12 M142 692 l8 -10" />
        <path d="M278 690 l-4 -12 M284 692 l2 -12 M290 692 l8 -10" />
      </g>
      {/* bunga */}
      <g><circle cx="372" cy="568" r="7" fill="#ffd34d" /><circle cx="372" cy="568" r="2.8" fill="#f08a24" />
        <circle cx="14" cy="588" r="5" fill="#f4b9d4" /><circle cx="14" cy="588" r="2" fill="#f7e27a" /></g>
    </svg>
  )
}
 
/* ===== PAPAN PETUNJUK ===== */
function Papan() {
  return (
    <svg viewBox="0 0 104 112" className="papan" aria-label="Papan petunjuk Kenali Bangun Datar">
      <defs>
        <linearGradient id="kayu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d49a58" /><stop offset="1" stopColor="#a8733a" />
        </linearGradient>
        <linearGradient id="tiang" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7a4d22" /><stop offset="1" stopColor="#a06a32" />
        </linearGradient>
      </defs>
      <rect x="14" y="48" width="10" height="62" rx="2" fill="url(#tiang)" />
      <rect x="78" y="52" width="9" height="56" rx="2" fill="url(#tiang)" />
      <g transform="rotate(-3 52 32)">
        <path d="M2 6 H96 L103 32 L96 58 H2Z" fill="#7a4d22" transform="translate(0 4)" />
        <path d="M2 6 H96 L103 32 L96 58 H2Z" fill="url(#kayu)" stroke="#8a5a2b" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M6 20 H92 M6 44 H90" stroke="#b9833f" strokeWidth="1.2" opacity=".7" />
        <circle cx="10" cy="12" r="1.8" fill="#6b4220" /><circle cx="10" cy="52" r="1.8" fill="#6b4220" />
        <text x="48" y="27" textAnchor="middle" fontSize="12.5" fontWeight="500" fill="#fff8e8" style={{ fontFamily: 'Fredoka, sans-serif' }}>Kenali</text>
        <text x="46" y="45" textAnchor="middle" fontSize="12.5" fontWeight="500" fill="#fff8e8" style={{ fontFamily: 'Fredoka, sans-serif' }}>Bangun Datar</text>
        <path d="M88 28 L94 34 L88 40" stroke="#fff8e8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </svg>
  )
}
 
/* ===== MASKOT SEGITIGA (beranimasi) ===== */
function Maskot() {
  const [tap, setTap] = useState(false)
  const ketuk = () => {
    suara.main('boing')
    setTap(false)
    requestAnimationFrame(() => setTap(true)) // lepas-pasang kelas agar animasi bisa diulang
  }
  return (
    <svg viewBox="0 0 176 208" className={'maskot' + (tap ? ' maskot-tap' : '')} onPointerDown={ketuk}
      onAnimationEnd={(e) => { if (e.animationName === 'maskot-loncat') setTap(false) }} aria-label="Maskot segitiga berpetualang">
      <defs>
        <linearGradient id="badan" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe55c" /><stop offset="1" stopColor="#f7b80f" />
        </linearGradient>
        <linearGradient id="ransel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f72dc" /><stop offset="1" stopColor="#1646a0" />
        </linearGradient>
      </defs>
      {/* ransel */}
      <g className="ransel-ayun"><g transform="rotate(-12 30 100)">
        <rect x="6" y="64" width="48" height="70" rx="15" fill="url(#ransel)" stroke="#12378a" strokeWidth="2.5" />
        <rect x="12" y="98" width="30" height="24" rx="7" fill="#2d6ad6" stroke="#12378a" strokeWidth="2" />
        <rect x="14" y="70" width="26" height="6" rx="3" fill="#6aa4f5" opacity=".6" />
        <circle cx="26" cy="90" r="4.5" fill="#f4c542" stroke="#b88a10" strokeWidth="1.5" />
      </g></g>
      {/* kaki */}
      <path d="M68 150 Q64 166 56 176" stroke="#3b3537" strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M108 150 Q122 162 130 170" stroke="#3b3537" strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M36 176 q4 -12 24 -8 q8 4 6 16 h-30z" fill="#8a5630" stroke="#5a3519" strokeWidth="2" strokeLinejoin="round" />
      <path d="M116 166 q16 -8 30 4 q4 12 -2 18 h-30z" fill="#8a5630" stroke="#5a3519" strokeWidth="2" strokeLinejoin="round" />
      <path d="M38 184 h26 M120 186 h26" stroke="#5a3519" strokeWidth="3" strokeLinecap="round" />
      {/* badan */}
      <path d="M86 10 L18 158 L158 158 Z" fill="url(#badan)" stroke="url(#badan)" strokeWidth="16" strokeLinejoin="round" />
      <path d="M86 10 L18 158 L78 158 Z" fill="#e8a400" opacity=".35" />
      <path d="M86 18 L34 134" stroke="#fff6b5" strokeWidth="6" strokeLinecap="round" opacity=".75" />
      {/* tali ransel */}
      <path d="M32 106 Q60 98 68 132" stroke="#1f56b8" strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M32 106 Q60 98 68 132" stroke="#12378a" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity=".6" />
      {/* wajah */}
      <g className="mata-kedip">
        <ellipse cx="90" cy="100" rx="14" ry="18" fill="#fff" stroke="#2a2a2a" strokeWidth="2" />
        <ellipse cx="126" cy="100" rx="14" ry="18" fill="#fff" stroke="#2a2a2a" strokeWidth="2" />
        <g className="pupil">
          <ellipse cx="93" cy="104" rx="9" ry="12" fill="#1b1b1b" />
          <ellipse cx="123" cy="104" rx="9" ry="12" fill="#1b1b1b" />
          <circle cx="95.5" cy="98" r="3.6" fill="#fff" /><circle cx="125.5" cy="98" r="3.6" fill="#fff" />
          <circle cx="91" cy="108" r="1.6" fill="#fff" /><circle cx="121" cy="108" r="1.6" fill="#fff" />
        </g>
      </g>
      <circle cx="72" cy="124" r="8" fill="#ff8f5a" opacity=".55" />
      <circle cx="142" cy="124" r="8" fill="#ff8f5a" opacity=".55" />
      <path d="M98 122 Q108 148 124 122 Z" fill="#e7323a" stroke="#7a1a1a" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M103 134 Q110 130 118 134 Q111 142 103 134Z" fill="#ff8a8f" />
      {/* tangan kiri (depan ransel) & kanan (mengepal) */}
      <g className="tangan-kiri">
        <path d="M40 150 Q30 150 30 142" stroke="#f0b90d" strokeWidth="10" strokeLinecap="round" fill="none" />
        <circle cx="34" cy="148" r="12" fill="#ffd428" stroke="#d99a00" strokeWidth="2.2" />
      </g>
      <g className="tangan-kanan">
        <path d="M146 112 Q160 100 162 90" stroke="#f0b90d" strokeWidth="10" strokeLinecap="round" fill="none" />
        <circle cx="164" cy="86" r="12" fill="#ffd428" stroke="#d99a00" strokeWidth="2.2" />
        <path d="M158 84 h12 M160 90 h10" stroke="#d99a00" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  )
}
 
/* ===== MUSUH BANGUN DATAR ===== */
function MataMarah({ cx, cy, s = 1 }: { cx: number; cy: number; s?: number }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      <ellipse cx="-9" cy="0" rx="5.5" ry="6.5" fill="#fff" />
      <ellipse cx="9" cy="0" rx="5.5" ry="6.5" fill="#fff" />
      <circle cx="-8" cy="1.5" r="3.4" fill="#222" />
      <circle cx="8" cy="1.5" r="3.4" fill="#222" />
      <path d="M-17 -9 L-3 -2" stroke="#222" strokeWidth="3" strokeLinecap="round" />
      <path d="M17 -9 L3 -2" stroke="#222" strokeWidth="3" strokeLinecap="round" />
    </g>
  )
}
 
function Musuh() {
  return (
    <svg viewBox="0 0 150 56" className="musuh" aria-label="Tiga musuh bangun datar">
      <defs>
        <radialGradient id="bolaMerah" cx=".35" cy=".3" r=".85">
          <stop offset="0" stopColor="#ff7a86" /><stop offset="1" stopColor="#d02640" />
        </radialGradient>
        <linearGradient id="kubusBiru" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#47b2ff" /><stop offset="1" stopColor="#1c78de" />
        </linearGradient>
        <linearGradient id="limasUngu" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9b78f0" /><stop offset="1" stopColor="#6038c8" />
        </linearGradient>
      </defs>
      <circle cx="27" cy="29" r="26" fill="url(#bolaMerah)" />
      <ellipse cx="17" cy="15" rx="9" ry="5" fill="#fff" opacity=".4" transform="rotate(-25 17 15)" />
      <MataMarah cx={27} cy={30} />
 
      <rect x="55" y="8" width="48" height="45" rx="6" fill="#1560c4" />
      <rect x="55" y="5" width="48" height="44" rx="6" fill="url(#kubusBiru)" />
      <path d="M61 5 H97 Q103 5 103 11 V13 H55 V11 Q55 5 61 5Z" fill="#7cc8ff" opacity=".8" />
      <MataMarah cx={79} cy={30} />
 
      <path d="M127 7 L104 50 H150 Z" fill="url(#limasUngu)" stroke="#6a44d4" strokeWidth="6" strokeLinejoin="round" />
      <path d="M127 12 L112 44" stroke="#c4aeff" strokeWidth="3" strokeLinecap="round" opacity=".6" />
      <MataMarah cx={127} cy={36} s={0.9} />
    </svg>
  )
}
 
/* ===== DATA MENU ===== */
const menu: { id: string; label: string; ikon: ReactNode }[] = [
  { id: 'beranda', label: 'Beranda', ikon: <path d="M3.5 11.5 L12 4 L20.5 11.5 V20 H14.5 V14.5 H9.5 V20 H3.5Z" /> },
  { id: 'peta', label: 'Peta', ikon: <path d="M3 6 L9 4 L15 6 L21 4 V18 L15 20 L9 18 L3 20Z M9 4 V18 M15 6 V20" /> },
  { id: 'prestasi', label: 'Prestasi', ikon: <path d="M8 4 H16 V10 A4 4 0 0 1 8 10Z M8 6 H4 Q4 11 8 11 M16 6 H20 Q20 11 16 11 M12 14 V18 M8 20 H16" /> },
  { id: 'materi', label: 'Materi', ikon: <path d="M12 6 Q8 4 3 5 V19 Q8 18 12 20 Q16 18 21 19 V5 Q16 4 12 6Z M12 6 V20" /> },
  { id: 'profil', label: 'Profil', ikon: <path d="M12 12 A4 4 0 1 0 12 4 A4 4 0 0 0 12 12Z M4 21 Q4 15 12 15 Q20 15 20 21Z" /> },
]
 
 
/* ===== PETA + ALUR LEVEL (Peta Petualangan, Pulau Bentuk, Detail Level, Eksplorasi, Soal, Hasil) ===== */
type Ke = (layar: string) => void
const a = (l: number, t: number, w?: number, h?: number) => ({ left: l + 'cqw', top: t + 'cqw', width: w && w + 'cqw', height: h && h + 'cqw' })
const m = (l: number, t: number, w?: number, h?: number) => a(l * 0.2024, t * 0.2024, w && w * 0.2024, h && h * 0.2024) // koordinat gambar peta (494px)
 
const gayaPeta = `
.pg { inset: 0; width: 100%; height: 100%;
  background: radial-gradient(ellipse at 15% 22%, #fffc 0 7%, #fff0 8%), radial-gradient(ellipse at 88% 48%, #fffc 0 8%, #fff0 9%), radial-gradient(ellipse at 10% 70%, #fffc 0 7%, #fff0 8%), linear-gradient(#5db4ee, #a9dcf8 55%, #e4f4ff); }
.kay { display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; font-weight: 700; text-shadow: 0 .4cqw 0 #6b4220;
  background: linear-gradient(#e0a460, #b97a3a); border: .6cqw solid #8a5a2b; border-radius: 2.5cqw; box-shadow: 0 .9cqw 0 #6b4220; }
.bir { display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 600; background: linear-gradient(#2f6fd6, #1b4aa8); border: .5cqw solid #0f2a63; border-radius: 2cqw; box-shadow: 0 .6cqw 0 #0b2a60; }
.kartu { background: linear-gradient(#fff, #f1f7fd); border-radius: 4cqw; box-shadow: 0 .9cqw 0 #b8d0ec, 0 2cqw 3cqw rgba(20,60,120,.2); color: #17306b; }
.bt { border-radius: 50% !important; background: radial-gradient(circle at 35% 30%, #5ab4ff, #1769d6); border: .6cqw solid #fff !important; box-shadow: 0 .6cqw 0 #0d3f94; color: #fff; display: flex; align-items: center; justify-content: center; padding: 0; }
.bt svg { width: 55%; height: 55%; }
.pil { display: flex; align-items: center; justify-content: center; gap: 1.2cqw; color: #fff; font-weight: 600; font-size: 3.4cqw; border-radius: 3.5cqw; }
.pil svg { width: 4.6cqw; height: 4.6cqw; }
.nd { border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 3.4cqw; line-height: 1; padding: 0;
  border: .6cqw solid #e8f1fb !important; background: radial-gradient(circle at 35% 30%, #aab5c6, #6d7a90); box-shadow: 0 .6cqw 0 #4d596d; }
.nd.b { background: radial-gradient(circle at 35% 30%, #58b0ff, #1569d8); box-shadow: 0 .6cqw 0 #0d3f94; font-size: 5cqw; }
.nd svg { width: 2.6cqw; margin-bottom: .3cqw; }
.pu i, .pu b { position: absolute; display: block; }
.pu b { inset: 22% 4% 0 4%; background: linear-gradient(#9a6b3f, #5f3b20); clip-path: polygon(0 0, 100% 0, 90% 50%, 62% 100%, 46% 82%, 14% 52%); }
.pu i { inset: 0 0 38% 0; border-radius: 50%; background: radial-gradient(ellipse at 50% 30%, #9be35c, #4aa83a); box-shadow: inset 0 -1cqw 0 #3b8f32; }
.profil-mini { left: 3cqw; top: 3.2cqw; width: 29cqw; height: 9.6cqw; gap: 1.4cqw; padding: 0 1.6cqw 0 .9cqw; border-radius: 3.6cqw; }
.profil-mini .avatar { width: 7.6cqw; height: 7.6cqw; border-width: .5cqw; }
.profil-mini .profil-info small { font-size: 1.8cqw; }
.profil-mini .profil-info strong { font-size: 2.8cqw; }
.profil-mini .xp { height: 1.4cqw; margin: .4cqw 0 .3cqw; }
.nl { position: absolute; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 3.7cqw; line-height: 1;
  border: .75cqw solid #c3cfdf; background: radial-gradient(circle at 38% 28%, #5b7396, #2b405f 55%, #1b2c47); box-shadow: 0 .8cqw 0 #14233b, 0 1.6cqw 1.8cqw rgba(15,40,90,.35); text-shadow: 0 .3cqw 0 rgba(0,0,0,.35); pointer-events: none; }
.nl svg { width: 2.4cqw; margin-bottom: .3cqw; }
.misi-mini { left: 74.5cqw; top: 14.2cqw; width: 23.5cqw; height: 10.6cqw; gap: 1cqw; padding: 0 1cqw 0 1.3cqw; border-radius: 2.6cqw; }
.misi-mini .misi-ikon { width: 3.6cqw; }
.misi-mini .misi-teks b { font-size: 1.85cqw; }
.misi-mini .misi-teks span { font-size: 1.4cqw; margin-top: .1cqw; line-height: 1.1; }
.misi-mini .misi-progres { margin-top: .6cqw; gap: .8cqw; }
.misi-mini .misi-progres .bar { height: 1.1cqw; }
.misi-mini .misi-progres em { font-size: 1.4cqw; }
.misi-mini .panah { width: 1.6cqw; height: 2.4cqw; }
.opsi { display: flex; align-items: center; gap: 3cqw; padding: 0 4cqw; border-radius: 3cqw; font-weight: 600; font-size: 4cqw; text-align: left; color: #17306b; border: .5cqw solid transparent !important; box-shadow: 0 .6cqw 0 rgba(0,0,0,.12); }
.opsi svg { width: 6cqw; height: 6cqw; flex: none; }
.chip { display: flex; align-items: center; justify-content: center; gap: 1.5cqw; background: #fff; border-radius: 3cqw; font-size: 3.2cqw; font-weight: 500; box-shadow: 0 .5cqw 0 #b8d0ec; color: #17306b; }
.chip svg { width: 4.5cqw; height: 4.5cqw; }
.tbl-hijau { background: linear-gradient(#7ee35a, #3bb03a) !important; border-color: #258a2a !important; box-shadow: 0 1cqw 0 #1c6e20 !important; color: #fff !important; }
.tbl-putih { background: #fff !important; border-color: #cfe0f4 !important; box-shadow: 0 .8cqw 0 #b8d0ec !important; font-size: 4cqw !important; }
`
 
/* ----- ikon kecil ----- */
const Seg = ({ c = '#ffc72a' }) => <svg viewBox="0 0 40 40"><path d="M20 5 L36 34 H4Z" fill={c} stroke="#d98a00" strokeWidth="3" strokeLinejoin="round" /></svg>
const Per = ({ c = '#2f8cf0' }) => <svg viewBox="0 0 40 40"><rect x="5" y="5" width="30" height="30" rx="4" fill={c} stroke="#1450a8" strokeWidth="3" /></svg>
const Lin = ({ c = '#ff5a78' }) => <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill={c} stroke="#b82040" strokeWidth="3" /></svg>
const Pjg = ({ c = '#5fd05a' }) => <svg viewBox="0 0 40 40"><rect x="3" y="9" width="34" height="22" rx="4" fill={c} stroke="#2a8a2e" strokeWidth="3" /></svg>
const Bin = ({ on = true, s = 7 }) => (
  <svg viewBox="0 0 24 24" style={{ width: s + 'cqw', height: s + 'cqw' }}>
    <path d="M12 1.8 L15.2 8.6 L22.4 9.4 L17 14.4 L18.6 21.7 L12 18 L5.4 21.7 L7 14.4 L1.6 9.4 L8.8 8.6Z" fill={on ? '#ffc928' : '#aab6c6'} stroke={on ? '#d98a00' : '#7d8ba0'} strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
)
const Koin = () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ffc928" stroke="#d98a00" strokeWidth="2" /><circle cx="12" cy="12" r="5.5" fill="none" stroke="#f0a30c" strokeWidth="1.6" /></svg>
const Gm = () => <svg viewBox="0 0 12 14"><rect x="1" y="6" width="10" height="8" rx="2" fill="#dfe6ef" /><path d="M3.5 6 V4 A2.5 2.5 0 0 1 8.5 4 V6" fill="none" stroke="#dfe6ef" strokeWidth="1.6" /></svg>
const Panah = ({ r = 0 }) => <svg viewBox="0 0 24 24" style={{ transform: `rotate(${r}deg)` }}><path d="M14 5 L7 12 L14 19" stroke="#fff" strokeWidth="3.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
const Mas = ({ st }: { st: object }) => (
  <svg viewBox="0 0 100 110" className="abs" style={{ position: 'absolute', filter: 'drop-shadow(0 1.2cqw .8cqw rgba(30,60,20,.3))', ...st }}>
    <rect x="2" y="48" width="26" height="40" rx="9" fill="#2f72dc" stroke="#12378a" strokeWidth="2" />
    <path d="M50 8 L10 92 H90Z" fill="#ffd428" stroke="#ffd428" strokeWidth="12" strokeLinejoin="round" />
    <path d="M50 8 L10 92 H40Z" fill="#e8a400" opacity=".3" />
    <ellipse cx="42" cy="58" rx="8" ry="10" fill="#fff" stroke="#222" strokeWidth="1.5" /><ellipse cx="64" cy="58" rx="8" ry="10" fill="#fff" stroke="#222" strokeWidth="1.5" />
    <circle cx="44" cy="61" r="5" fill="#1b1b1b" /><circle cx="66" cy="61" r="5" fill="#1b1b1b" />
    <path d="M47 74 Q54 90 62 74Z" fill="#e7323a" stroke="#7a1a1a" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
)
const Pill = ({ st, children }: { st: object; children: ReactNode }) => <div className="pil panel-gelap" style={{ position: 'absolute', ...st }}>{children}</div>
 
/* =====================================================================
   DATA PERMAINAN – 3 LEVEL, 15 SOAL (sesuai rancangan PPTX)
   Aturan:
   - Level dimulai dengan menjelajah: kumpulkan 3 bentuk target → gerbang soal terbuka
   - 5 soal per level. Benar = bintang +1, Salah = nyawa −1
   - Bintang 0–1 → wajib mengulang soal; bintang 2–5 → lanjut ke level berikutnya
   ===================================================================== */

type IkonKey = 'seg' | 'per' | 'lin' | 'pjg' | 'sisi3' | 'sisi4' | 'sudut' | 'jam' | 'atap' | 'ubin' | 'pintu' | 'roda'
type TemaKey = 'pulau' | 'lembah' | 'hutan'

type Opsi = { t: string; ik?: IkonKey }
type Soal = {
  q: string
  gambar: IkonKey | 'tanya'
  mode: 'gambar' | 'teks'
  opsi: Opsi[]
  benar: number
  petunjuk: string
}

type Titik = { x: number; y: number }
type Pijakan = { x: number; y: number; w: number }
type Rintangan = { jenis: 'bola' | 'kubus' | 'limas'; x0: number; x1: number; y: number; v: number }
type Duri = { x: number; y: number; w: number }
type TargetDef = { ik: IkonKey; nama: string; x: number; y: number }
type DuniaDef = {
  pijakan: Pijakan[]
  target: TargetDef[]
  koin: Titik[]
  musuh: Rintangan[]
  duri: Duri[]
  gerbang: Titik
  mulai: number
}
type Level = {
  id: number
  nama: string
  jenis: string
  capaian: string
  misi: string
  tema: TemaKey
  dunia: DuniaDef
  soal: Soal[]
}

/* ---------- konstanta permainan (satuan: cqw = 1% lebar layar) ---------- */
const NYAWA = 4 // 4 nyawa: nyawa habis tepat ketika bintang 2 sudah mustahil diraih
const BINTANG_LOLOS = 2
const TANAH = 146
const PW = 7.2 // lebar kotak tabrak pemain
const PH = 9 // tinggi kotak tabrak pemain
const ES = 8 // ukuran musuh
const GH = 17 // tinggi gerbang
const GRAVITASI = 235
const LONCAT = 112
const LAJU = 36

const baris = (x: number, y: number, n: number, jarak = 5): Titik[] =>
  Array.from({ length: n }, (_, i) => ({ x: x + i * jarak, y }))
const busur = (x: number, y: number, n: number, jarak = 5, tinggi = 4): Titik[] =>
  Array.from({ length: n }, (_, i) => ({ x: x + i * jarak, y: y - Math.sin((i / (n - 1)) * Math.PI) * tinggi }))

const LEVEL: Level[] = [
  /* ------------------------------ LEVEL 1 ------------------------------ */
  {
    id: 1,
    nama: 'Gerbang Pulau Bentuk',
    jenis: 'Pengenalan',
    capaian: 'Siswa mampu mengenali segitiga, persegi, dan lingkaran dari tampilannya.',
    misi: 'Temukan 1 segitiga, 1 persegi, dan 1 lingkaran yang tersebar di pulau.',
    tema: 'pulau',
    dunia: {
      pijakan: [
        { x: 2, y: 129, w: 30 },
        { x: 40, y: 112, w: 26 },
        { x: 70, y: 95, w: 28 },
        { x: 34, y: 78, w: 28 },
        { x: 4, y: 61, w: 26 },
        { x: 30, y: 44, w: 32 },
        { x: 74, y: 61, w: 22 },
      ],
      target: [
        { ik: 'seg', nama: 'Segitiga', x: 16, y: 53 },
        { ik: 'per', nama: 'Persegi', x: 53, y: 104 },
        { ik: 'lin', nama: 'Lingkaran', x: 48, y: 70 },
      ],
      koin: [
        ...baris(8, 140, 5, 6),
        ...baris(8, 123, 4, 5),
        { x: 45, y: 106 },
        { x: 61, y: 106 },
        ...baris(76, 80, 4, 5),
        ...baris(77, 54, 4, 5),
        { x: 34, y: 38 },
        { x: 40, y: 38 },
        { x: 59, y: 38 },
      ],
      musuh: [
        { jenis: 'bola', x0: 40, x1: 72, y: TANAH, v: 11 },
        { jenis: 'kubus', x0: 72, x1: 88, y: 95, v: 9 },
      ],
      duri: [],
      gerbang: { x: 50, y: 44 },
      mulai: 8,
    },
    soal: [
      {
        q: 'Manakah gambar yang berbentuk segitiga?',
        gambar: 'tanya',
        mode: 'gambar',
        opsi: [
          { t: 'Persegi', ik: 'per' },
          { t: 'Segitiga', ik: 'seg' },
          { t: 'Lingkaran', ik: 'lin' },
          { t: 'Persegi panjang', ik: 'pjg' },
        ],
        benar: 1,
        petunjuk: 'Segitiga punya 3 sisi lurus dan 3 sudut, mirip puncak gunung.',
      },
      {
        q: 'Bangun datar manakah yang berbentuk bulat?',
        gambar: 'tanya',
        mode: 'teks',
        opsi: [
          { t: 'Segitiga', ik: 'seg' },
          { t: 'Persegi', ik: 'per' },
          { t: 'Lingkaran', ik: 'lin' },
        ],
        benar: 2,
        petunjuk: 'Bulat tidak punya sudut. Sisinya melengkung mulus, seperti koin.',
      },
      {
        q: 'Pilih gambar yang merupakan persegi.',
        gambar: 'tanya',
        mode: 'gambar',
        opsi: [
          { t: 'Lingkaran', ik: 'lin' },
          { t: 'Persegi panjang', ik: 'pjg' },
          { t: 'Persegi', ik: 'per' },
          { t: 'Segitiga', ik: 'seg' },
        ],
        benar: 2,
        petunjuk: 'Persegi punya 4 sisi sama panjang. Persegi panjang tidak semua sisinya sama.',
      },
      {
        q: 'Bentuk apa yang memiliki tiga sisi?',
        gambar: 'tanya',
        mode: 'teks',
        opsi: [{ t: 'Lingkaran' }, { t: 'Persegi' }, { t: 'Segitiga' }, { t: 'Persegi panjang' }],
        benar: 2,
        petunjuk: 'Hitung sisi lurusnya. Ada tiga? Itu segitiga. "Tri" artinya tiga.',
      },
      {
        q: 'Bangun datar apa yang memiliki empat sisi sama panjang?',
        gambar: 'tanya',
        mode: 'teks',
        opsi: [{ t: 'Persegi panjang' }, { t: 'Persegi' }, { t: 'Segitiga' }, { t: 'Lingkaran' }],
        benar: 1,
        petunjuk: 'Empat sisi sama panjang adalah ciri persegi, seperti ubin kotak.',
      },
    ],
  },

  /* ------------------------------ LEVEL 2 ------------------------------ */
  {
    id: 2,
    nama: 'Lembah Bentuk',
    jenis: 'Pemahaman',
    capaian: 'Siswa mampu menyebutkan jumlah sisi dan titik sudut pada bangun datar sederhana.',
    misi: 'Kumpulkan bentuk dengan ciri berbeda: sisi, sudut, dan bentuk tanpa sudut.',
    tema: 'lembah',
    dunia: {
      pijakan: [
        { x: 64, y: 129, w: 32 },
        { x: 26, y: 112, w: 32 },
        { x: 2, y: 95, w: 22 },
        { x: 30, y: 78, w: 26 },
        { x: 62, y: 61, w: 30 },
        { x: 28, y: 44, w: 26 },
        { x: 66, y: 44, w: 28 },
      ],
      target: [
        { ik: 'sisi3', nama: '3 sisi', x: 13, y: 87 },
        { ik: 'sisi4', nama: '4 sisi', x: 80, y: 53 },
        { ik: 'sudut', nama: 'Titik sudut', x: 41, y: 36 },
      ],
      koin: [
        ...baris(6, 140, 4, 6),
        ...busur(30, 134, 5, 3, 5),
        ...baris(70, 123, 4, 6),
        ...busur(32, 100, 5, 5, 5),
        ...baris(34, 66, 4, 6),
        { x: 70, y: 38 },
        { x: 90, y: 38 },
        { x: 8, y: 80 },
        { x: 18, y: 80 },
      ],
      musuh: [
        { jenis: 'limas', x0: 50, x1: 66, y: TANAH, v: 12 },
        { jenis: 'kubus', x0: 28, x1: 50, y: 112, v: 10 },
        { jenis: 'bola', x0: 32, x1: 46, y: 78, v: 11 },
        { jenis: 'limas', x0: 64, x1: 76, y: 61, v: 9 },
      ],
      duri: [{ x: 32, y: TANAH, w: 12 }],
      gerbang: { x: 80, y: 44 },
      mulai: 6,
    },
    soal: [
      {
        q: 'Berapa jumlah sisi pada segitiga?',
        gambar: 'seg',
        mode: 'teks',
        opsi: [{ t: '2 sisi' }, { t: '3 sisi' }, { t: '4 sisi' }],
        benar: 1,
        petunjuk: 'Hitung sisi lurus pada segitiga satu per satu. Jumlahnya 3.',
      },
      {
        q: 'Berapa jumlah titik sudut pada persegi?',
        gambar: 'per',
        mode: 'teks',
        opsi: [{ t: '3 titik sudut' }, { t: '4 titik sudut' }, { t: '5 titik sudut' }],
        benar: 1,
        petunjuk: 'Titik sudut adalah ujung pertemuan dua sisi. Persegi punya 4 ujung.',
      },
      {
        q: 'Berapa jumlah titik sudut pada lingkaran?',
        gambar: 'lin',
        mode: 'teks',
        opsi: [{ t: 'Tidak ada (0)' }, { t: '1 titik sudut' }, { t: '4 titik sudut' }],
        benar: 0,
        petunjuk: 'Lingkaran melengkung mulus, jadi tidak punya titik sudut.',
      },
      {
        q: 'Bangun datar apa yang memiliki empat sisi?',
        gambar: 'tanya',
        mode: 'teks',
        opsi: [
          { t: 'Segitiga', ik: 'seg' },
          { t: 'Persegi', ik: 'per' },
          { t: 'Lingkaran', ik: 'lin' },
        ],
        benar: 1,
        petunjuk: 'Segitiga punya 3 sisi, persegi punya 4, lingkaran tidak punya sisi lurus.',
      },
      {
        q: 'Bangun datar apa yang tidak memiliki titik sudut?',
        gambar: 'tanya',
        mode: 'teks',
        opsi: [
          { t: 'Segitiga', ik: 'seg' },
          { t: 'Persegi', ik: 'per' },
          { t: 'Lingkaran', ik: 'lin' },
        ],
        benar: 2,
        petunjuk: 'Cari bentuk yang tepinya melengkung tanpa ujung runcing: lingkaran.',
      },
    ],
  },

  /* ------------------------------ LEVEL 3 ------------------------------ */
  {
    id: 3,
    nama: 'Hutan Bentuk',
    jenis: 'Penerapan',
    capaian: 'Siswa mampu mengidentifikasi bangun datar pada benda-benda sehari-hari.',
    misi: 'Cari objek di hutan: jam, atap rumah, dan ubin dengan bentuk yang sesuai.',
    tema: 'hutan',
    dunia: {
      pijakan: [
        { x: 2, y: 129, w: 28 },
        { x: 36, y: 112, w: 26 },
        { x: 68, y: 95, w: 30 },
        { x: 34, y: 78, w: 28 },
        { x: 2, y: 61, w: 28 },
        { x: 36, y: 44, w: 26 },
        { x: 70, y: 61, w: 28 },
        { x: 68, y: 44, w: 28 },
      ],
      target: [
        { ik: 'jam', nama: 'Jam', x: 83, y: 87 },
        { ik: 'atap', nama: 'Atap rumah', x: 18, y: 53 },
        { ik: 'ubin', nama: 'Ubin', x: 49, y: 36 },
      ],
      koin: [
        ...baris(6, 140, 4, 6),
        ...busur(44, 134, 5, 5, 5),
        ...baris(8, 123, 3, 6),
        ...baris(40, 106, 3, 6),
        ...baris(38, 72, 3, 6),
        ...baris(76, 55, 3, 6),
        { x: 74, y: 38 },
        { x: 90, y: 38 },
        { x: 24, y: 55 },
        { x: 80, y: 89 },
      ],
      musuh: [
        { jenis: 'limas', x0: 42, x1: 78, y: TANAH, v: 14 },
        { jenis: 'bola', x0: 38, x1: 54, y: 112, v: 11 },
        { jenis: 'kubus', x0: 70, x1: 90, y: 95, v: 11 },
        { jenis: 'limas', x0: 36, x1: 54, y: 78, v: 12 },
        { jenis: 'bola', x0: 72, x1: 90, y: 61, v: 13 },
      ],
      duri: [
        { x: 46, y: TANAH, w: 12 },
        { x: 4, y: 61, w: 8 },
      ],
      gerbang: { x: 82, y: 44 },
      mulai: 6,
    },
    soal: [
      {
        q: 'Jam dinding berbentuk bulat menyerupai bangun datar apa?',
        gambar: 'jam',
        mode: 'teks',
        opsi: [
          { t: 'Segitiga', ik: 'seg' },
          { t: 'Lingkaran', ik: 'lin' },
          { t: 'Persegi', ik: 'per' },
        ],
        benar: 1,
        petunjuk: 'Jam dinding itu bulat dan tidak punya sudut. Sama seperti lingkaran.',
      },
      {
        q: 'Atap rumah pada gambar menyerupai bentuk apa?',
        gambar: 'atap',
        mode: 'teks',
        opsi: [
          { t: 'Lingkaran', ik: 'lin' },
          { t: 'Persegi', ik: 'per' },
          { t: 'Segitiga', ik: 'seg' },
        ],
        benar: 2,
        petunjuk: 'Atap pada gambar punya 3 sisi dan 3 sudut: segitiga.',
      },
      {
        q: 'Ubin dengan empat sisi sama panjang menyerupai apa?',
        gambar: 'ubin',
        mode: 'teks',
        opsi: [
          { t: 'Persegi panjang', ik: 'pjg' },
          { t: 'Persegi', ik: 'per' },
          { t: 'Lingkaran', ik: 'lin' },
        ],
        benar: 1,
        petunjuk: 'Ubin yang keempat sisinya sama panjang berbentuk persegi.',
      },
      {
        q: 'Pintu berbentuk persegi panjang memiliki berapa sisi?',
        gambar: 'pintu',
        mode: 'teks',
        opsi: [{ t: '3 sisi' }, { t: '4 sisi' }, { t: '5 sisi' }],
        benar: 1,
        petunjuk: 'Pintu persegi panjang punya 4 sisi: 2 sisi panjang dan 2 sisi pendek.',
      },
      {
        q: 'Roda sepeda jika dilihat dari samping berbentuk apa?',
        gambar: 'roda',
        mode: 'teks',
        opsi: [
          { t: 'Lingkaran', ik: 'lin' },
          { t: 'Segitiga', ik: 'seg' },
          { t: 'Persegi', ik: 'per' },
        ],
        benar: 0,
        petunjuk: 'Dari samping, roda sepeda bulat sempurna, yaitu lingkaran.',
      },
    ],
  },
]

/* ---------- keadaan & fisika ---------- */
type Kunci = { kiri: boolean; kanan: boolean; buf: number }
type Efek = { id: number; x: number; y: number; t: number; w: 'bintang' | 'koin' | 'duar' }
type Keadaan = {
  x: number
  y: number
  vx: number
  vy: number
  darat: boolean
  hadap: 1 | -1
  coyote: number
  stun: number
  kebal: number
  waktu: number
  pl: Pijakan[]
  musuh: { x: number; arah: 1 | -1; mati: boolean }[]
  target: boolean[]
  koin: boolean[]
  jumlahKoin: number
  pesan: string
  pesanT: number
  efek: Efek[]
  idEfek: number
  buka: boolean
  selesai: boolean
  masuk: number
  bunyi: Bunyi[]
  lt: number
}

function buatKeadaan(d: DuniaDef): Keadaan {
  return {
    x: d.mulai,
    y: TANAH - PH,
    vx: 0,
    vy: 0,
    darat: true,
    hadap: 1,
    coyote: 0,
    stun: 0,
    kebal: 0,
    waktu: 0,
    pl: [...d.pijakan, { x: -5, y: TANAH, w: 110 }],
    musuh: d.musuh.map((m) => ({ x: m.x0 + (m.x1 - m.x0) * 0.4, arah: 1, mati: false })),
    target: d.target.map(() => false),
    koin: d.koin.map(() => false),
    jumlahKoin: 0,
    pesan: 'Kumpulkan semua bentuk, lalu masuk gerbang soal!',
    pesanT: 3.2,
    efek: [],
    idEfek: 1,
    buka: false,
    selesai: false,
    masuk: 0,
    bunyi: [],
    lt: 0,
  }
}

/* gerak murni: jalan, loncat, mendarat di pijakan satu arah */
function gerak(S: Keadaan, dt: number, K: Kunci, pl: Pijakan[]) {
  if (S.stun > 0) S.stun -= dt
  if (S.kebal > 0) S.kebal -= dt
  const arah = (K.kanan ? 1 : 0) - (K.kiri ? 1 : 0)
  if (S.stun > 0) S.vx -= S.vx * Math.min(1, 7 * dt)
  else {
    S.vx = arah * LAJU
    if (arah !== 0) S.hadap = arah > 0 ? 1 : -1
  }
  if (K.buf > 0) K.buf -= dt
  S.coyote = S.darat ? 0.09 : S.coyote - dt
  if (K.buf > 0 && S.coyote > 0 && S.stun <= 0) {
    S.vy = -LONCAT
    S.bunyi.push('loncat')
    S.darat = false
    S.coyote = 0
    K.buf = 0
  }
  S.vy = Math.min(S.vy + GRAVITASI * dt, 190)
  const dasarLama = S.y + PH
  S.x = Math.max(0, Math.min(100 - PW, S.x + S.vx * dt))
  S.y += S.vy * dt
  const daratTadi = S.darat
  S.darat = false
  if (S.vy >= 0) {
    for (const p of pl) {
      if (S.x + PW > p.x + 0.5 && S.x < p.x + p.w - 0.5 && dasarLama <= p.y + 1 && S.y + PH >= p.y) {
        S.y = p.y - PH
        if (!daratTadi && S.vy > 45) S.bunyi.push('mendarat')
        S.vy = 0
        S.darat = true
        break
      }
    }
  }
}

const tabrak = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) =>
  ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by

function buatEfek(S: Keadaan, x: number, y: number, w: Efek['w']) {
  S.efek.push({ id: S.idEfek++, x, y, t: 0.8, w })
}
function bicara(S: Keadaan, teks: string, dur = 1.8) {
  S.pesan = teks
  S.pesanT = dur
}
function kena(S: Keadaan, dorong: 1 | -1, teks: string) {
  S.stun = 0.4
  S.kebal = 1.6
  S.vy = -72
  S.vx = dorong * 38
  S.hadap = dorong > 0 ? -1 : 1
  S.bunyi.push('kena')
  bicara(S, teks, 1.4)
}

/* satu langkah permainan: gerak + musuh + duri + koleksi + gerbang */
function langkah(S: Keadaan, dt: number, K: Kunci, d: DuniaDef) {
  S.waktu += dt
  if (S.pesanT > 0) S.pesanT -= dt
  S.efek = S.efek.filter((e) => (e.t -= dt) > 0)
  if (S.selesai) {
    S.masuk -= dt
    return
  }
  gerak(S, dt, K, S.pl)
  if (S.darat && S.stun <= 0 && Math.abs(S.vx) > 1) {
    S.lt -= dt
    if (S.lt <= 0) { S.lt = 0.27; S.bunyi.push('langkah') }
  } else S.lt = 0

  const px = S.x + 0.9
  const py = S.y + 0.8
  const pw = PW - 1.8
  const ph = PH - 0.8

  d.musuh.forEach((m, i) => {
    const e = S.musuh[i]
    if (e.mati) return
    e.x += e.arah * m.v * dt
    if (e.x <= m.x0) {
      e.x = m.x0
      e.arah = 1
    } else if (e.x >= m.x1) {
      e.x = m.x1
      e.arah = -1
    }
    const ey = m.y - ES
    if (tabrak(px, py, pw, ph, e.x + 0.9, ey + 1, ES - 1.8, ES - 1)) {
      if (S.vy > 25 && S.y + PH < ey + ES * 0.62) {
        e.mati = true
        S.vy = -88
        S.jumlahKoin += 3
        buatEfek(S, e.x + ES / 2, ey + ES / 2, 'duar')
        S.bunyi.push('injak')
        bicara(S, 'Musuh terinjak! +3 koin', 1.4)
      } else if (S.kebal <= 0) {
        kena(S, e.x + ES / 2 < S.x + PW / 2 ? 1 : -1, 'Aduh! Loncati musuhnya, atau injak dari atas.')
      }
    }
  })

  for (const r of d.duri) {
    if (S.kebal <= 0 && tabrak(px, py, pw, ph, r.x + 0.6, r.y - 3.4, r.w - 1.2, 3.4)) {
      kena(S, S.hadap === 1 ? -1 : 1, 'Duri tajam! Loncati ya.')
    }
  }

  const cx = S.x + PW / 2
  const cy = S.y + PH / 2
  d.target.forEach((t, i) => {
    if (S.target[i] || Math.hypot(cx - t.x, cy - t.y) > 6.5) return
    S.target[i] = true
    buatEfek(S, t.x, t.y, 'bintang')
    const n = S.target.filter(Boolean).length
    if (n === d.target.length) {
      S.buka = true
      S.bunyi.push('gerbangBuka')
      bicara(S, 'Semua bentuk terkumpul! Gerbang soal terbuka!', 2.8)
    } else {
      S.bunyi.push('bentuk')
      bicara(S, t.nama + ' ditemukan! (' + n + '/' + d.target.length + ')', 1.8)
    }
  })
  d.koin.forEach((c, i) => {
    if (S.koin[i] || Math.hypot(cx - c.x, cy - c.y) > 5) return
    S.koin[i] = true
    S.jumlahKoin += 1
    buatEfek(S, c.x, c.y, 'koin')
    S.bunyi.push('koin')
  })

  const g = d.gerbang
  if (tabrak(px, py, pw, ph, g.x - 4.5, g.y - GH + 3, 9, GH - 3)) {
    if (S.buka) {
      S.selesai = true
      S.masuk = 0.8
      buatEfek(S, g.x, g.y - 8, 'bintang')
      S.bunyi.push('masuk')
    } else if (S.pesanT < 0.3) {
      const sisa = d.target.length - S.target.filter(Boolean).length
      S.bunyi.push('terkunci')
      bicara(S, 'Gerbang terkunci! Kumpulkan ' + sisa + ' bentuk lagi.', 1.6)
    }
  }
}

/* =====================================================================
   GAME: STATE, CSS, IKON, PEMANDANGAN, JELAJAH (platformer), KUIS, HASIL
   ===================================================================== */

type Hasil = { level: number; bintang: number; nyawa: number; benar: number; koin: number; lolos: boolean }
type Kemajuan = { bintang: number[]; koin: number; main: boolean[] } // main[i] = level i+1 sudah pernah diselesaikan
type Konteks = {
  lv: Level
  kemajuan: Kemajuan
  hasil: Hasil | null
  koinJelajah: number
  terbuka: (n: number) => boolean
  mulaiLevel: (n: number) => void
  mulaiJelajah: () => void
  selesaiJelajah: (koin: number) => void
  selesaiKuis: (h: Hasil) => void
  ulangKuis: () => void
}

const gayaGame = `
.dunia { position: absolute; inset: 0; width: 100%; height: 100%; overflow: hidden; }
.dunia > * { position: absolute; }
.latar-game { position: absolute; inset: 0; width: 100%; height: 100%; }
.kabut { inset: 0; background: linear-gradient(rgba(255,255,255,.16), rgba(255,255,255,.04)); pointer-events: none; }

/* ---------- tanah & pijakan ---------- */
.tanah { left: 0; width: 100%; top: ${TANAH}cqw; bottom: 0; }
.tn-pulau { background: linear-gradient(#86ea5e 0 2.8cqw, #3fb43a 2.8cqw 3.6cqw, #9a6b3f 3.6cqw, #5f3b20); }
.tn-lembah { background: linear-gradient(#f3c987 0 2.8cqw, #cf9550 2.8cqw 3.6cqw, #b8693c 3.6cqw, #7d3f22); }
.tn-hutan { background: linear-gradient(#63cc78 0 2.8cqw, #2d8f4a 2.8cqw 3.6cqw, #6e4b2b, #3f2a17); }
.pl { height: 6.6cqw; pointer-events: none; }
.pl::before { content: ''; position: absolute; left: 2%; right: 2%; top: 1.6cqw; bottom: 0; background: var(--body);
  clip-path: polygon(0 0, 100% 0, 91% 52%, 74% 100%, 57% 60%, 40% 92%, 22% 56%, 9% 80%); }
.pl::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 2.8cqw; border-radius: 1.4cqw; background: var(--cap);
  box-shadow: inset 0 -.7cqw 0 var(--capd), 0 .5cqw 0 rgba(0,0,0,.14); }
.pl-pulau { --cap: #7ee35a; --capd: #3da834; --body: #8d5f36; }
.pl-lembah { --cap: #f3c987; --capd: #c98a45; --body: #b4663a; }
.pl-hutan { --cap: #63cc78; --capd: #2b8a48; --body: #6b4a2b; }
.duri { position: absolute; filter: drop-shadow(0 .3cqw 0 rgba(0,0,0,.25)); }

/* ---------- isi dunia ---------- */
.tg { width: 8cqw; height: 8cqw; }
.tg-in { width: 100%; height: 100%; animation: melayang 1.6s ease-in-out infinite; filter: drop-shadow(0 0 1.3cqw rgba(255,255,255,.95)) drop-shadow(0 .4cqw 0 rgba(0,0,0,.2)); }
.tg-in svg { width: 100%; height: 100%; }
.tg-lab { position: absolute; left: 50%; top: -3.6cqw; transform: translateX(-50%); white-space: nowrap; font-size: 2.5cqw; font-weight: 700; color: #fff;
  background: rgba(15,49,112,.82); padding: .3cqw 1.4cqw; border-radius: 1.4cqw; }
.kn { width: 4cqw; height: 4cqw; }
.kn svg { width: 100%; height: 100%; animation: putar 1.2s linear infinite; }
.mu { width: ${ES}cqw; height: ${ES}cqw; }
.mu-in { width: 100%; height: 100%; transform-origin: 50% 100%; animation: goyang .55s ease-in-out infinite alternate; }
.mu-in svg { width: 100%; height: 100%; filter: drop-shadow(0 .5cqw 0 rgba(0,0,0,.22)); }
.gb-chip { display: flex; align-items: center; gap: .8cqw; background: rgba(15,49,112,.9); color: #fff; font-weight: 700; font-size: 2.8cqw; padding: .6cqw 1.8cqw; border-radius: 2cqw; }
.gb-chip svg { width: 2.6cqw; }
.gb-panah { width: 5cqw; height: 5cqw; animation: lompat .7s ease-in-out infinite; }
.toast { left: 8cqw; width: 84cqw; top: 27.5cqw; text-align: center; background: rgba(15,49,112,.92); color: #fff; font-weight: 600; font-size: 3.2cqw;
  padding: 1.6cqw 3cqw; border-radius: 3cqw; box-shadow: 0 .6cqw 0 rgba(0,0,0,.2); pointer-events: none; z-index: 9; }

/* ---------- ledakan konfeti bentuk ---------- */
.ledak { width: 0; height: 0; pointer-events: none; z-index: 12; }
.ledak i { position: absolute; left: -1.2cqw; top: -1.2cqw; width: 2.4cqw; height: 2.4cqw; animation: ledak .8s ease-out forwards; }
.ledak i.p0 { clip-path: polygon(50% 0, 100% 100%, 0 100%); }
.ledak i.p1 { border-radius: 50%; }

/* ---------- HUD jelajah ---------- */
.slot { position: relative; display: flex; align-items: center; gap: 1cqw; flex: 1; min-width: 0; font-size: 2.6cqw; font-weight: 600; line-height: 1.1; opacity: .5; filter: grayscale(1); transition: opacity .25s, filter .25s; }
.slot.ok { opacity: 1; filter: none; }
.slot-ik { width: 6.4cqw; height: 6.4cqw; flex: none; position: relative; }
.slot-ik svg { width: 100%; height: 100%; }
.slot-cek { position: absolute; right: -1.2cqw; bottom: -.8cqw; width: 3.4cqw; height: 3.4cqw; }
.slot-n { font-size: 3.6cqw; padding-left: 1cqw; }
.kontrol { touch-action: none; -webkit-touch-callout: none; }
.petunjuk-kontrol { color: #fff; font-size: 2.6cqw; font-weight: 500; text-align: center; line-height: 1.25; text-shadow: 0 .3cqw 0 rgba(0,0,0,.4); pointer-events: none; }
.tirai { inset: 0; background: rgba(8,24,60,.62); z-index: 20; }

/* ---------- kuis ---------- */
.prog { background: #0f3170; border-radius: 2cqw; overflow: hidden; box-shadow: inset 0 .3cqw .5cqw rgba(0,0,0,.4); }
.prog i { display: block; height: 100%; background: linear-gradient(#ffd75a, #ff9f0f); border-radius: 2cqw; transition: width .4s; }
.prog-n { font-weight: 700; font-size: 3.4cqw; color: #fff; text-shadow: 0 .3cqw 0 #0b2a60; }
.ilus { flex: 1; min-height: 0; }
.ilus svg { width: 100%; height: 100%; }
.ilus-bentuk { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 3cqw; background: linear-gradient(#cfeaff, #eef8ff); border: .6cqw solid #d6e6f8; }
.ilus-bentuk svg { height: 88%; width: auto; aspect-ratio: 1; filter: drop-shadow(0 .8cqw 0 rgba(20,60,120,.18)); }
.opsi:disabled { cursor: default; }
.opsi:active:not(:disabled), .ubin-g:active:not(:disabled) { transform: translateY(.6cqw); }
.opsi.benar, .ubin-g.benar { background: linear-gradient(#7ee35a, #3bb03a) !important; border-color: #258a2a !important; color: #fff !important; box-shadow: 0 .9cqw 0 #1c6e20 !important; }
.opsi.salah, .ubin-g.salah { background: linear-gradient(#ff8f8f, #e04848) !important; border-color: #a82a2a !important; color: #fff !important; box-shadow: 0 .9cqw 0 #8c2020 !important; animation: goyang-salah .45s; }
.opsi.pudar, .ubin-g.pudar { opacity: .5; }
.ubin-g { display: flex; align-items: center; justify-content: center; background: #fff; border: .7cqw solid #cfe0f4 !important; border-radius: 4cqw; box-shadow: 0 .9cqw 0 #b8d0ec; padding: 0; }
.ubin-ik { width: 52%; height: 78%; display: flex; }
.ubin-ik svg { width: 100%; height: 100%; }
.ubin-tanda { position: absolute; right: 1.6cqw; top: 1.6cqw; width: 6cqw; height: 6cqw; }
.ubin-tanda svg { width: 100%; height: 100%; }
.masuk { animation: geser-masuk .35s ease-out backwards; }
.pop { display: inline-flex; animation: bintang-pop .6s ease-out; }
.hilang { display: inline-flex; animation: hati-pecah .6s ease-out; }
.sheet { z-index: 10; border-radius: 6cqw 6cqw 0 0; box-shadow: 0 -1cqw 3cqw rgba(8,30,70,.3); animation: naik .3s ease-out; }
.sheet b.jdl { font-size: 4.5cqw; display: block; line-height: 1.15; }
.sheet p { font-size: 3cqw; line-height: 1.3; margin-top: .8cqw; color: #2c466f; }

/* ---------- hasil ---------- */
.bintang-hasil { display: inline-flex; animation: bintang-pop .7s ease-out backwards; }
.konfeti { top: -6cqw; width: 2.6cqw; height: 2.6cqw; animation: jatuh 3.4s ease-in forwards; pointer-events: none; z-index: 1; }

@keyframes melayang { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1.4cqw); } }
@keyframes putar { 0%, 100% { transform: scaleX(1); } 50% { transform: scaleX(.15); } }
@keyframes goyang { from { transform: rotate(-5deg) scale(1.03, .96); } to { transform: rotate(5deg) scale(.97, 1.04); } }
@keyframes lompat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(1.6cqw); } }
@keyframes ledak { 0% { transform: translate(0, 0) scale(.4) rotate(0); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) scale(1) rotate(260deg); opacity: 0; } }
@keyframes goyang-salah { 20% { transform: translateX(-1.6cqw); } 40% { transform: translateX(1.6cqw); } 60% { transform: translateX(-1cqw); } 80% { transform: translateX(1cqw); } }
@keyframes geser-masuk { from { opacity: 0; transform: translateX(6cqw); } to { opacity: 1; transform: none; } }
@keyframes bintang-pop { 0% { transform: scale(.2) rotate(-35deg); } 60% { transform: scale(1.4) rotate(10deg); } 100% { transform: scale(1) rotate(0); } }
@keyframes hati-pecah { 0% { transform: scale(1); } 30% { transform: scale(1.5) rotate(-12deg); } 60% { transform: scale(.8) rotate(8deg); } 100% { transform: scale(1); } }
@keyframes naik { from { transform: translateY(100%); } to { transform: none; } }
@keyframes jatuh { from { transform: translateY(0) rotate(0); } to { transform: translateY(190cqw) rotate(540deg); } }
@keyframes kelip { 0%, 100% { opacity: .15; } 50% { opacity: .95; } }
.kunang { animation: kelip 2.4s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .tg-in, .kn svg, .mu-in, .gb-panah, .kunang, .masuk, .sheet, .konfeti { animation: none; }
  .ledak i { animation-duration: .01s; }
}
`

/* ----- util ----- */
const acak = <T,>(arr: T[]): T[] => {
  const h = [...arr]
  for (let i = h.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[h[i], h[j]] = [h[j], h[i]]
  }
  return h
}
const WARNA_OPSI = ['#ffe9a0', '#cfe6ff', '#d6f5c8', '#ffd0dc']
const WARNA_KONFETI = ['#ffc72a', '#2f8cf0', '#ff5a78', '#5fd05a', '#a97bff']
const jumlahBintang = (k: Kemajuan) => k.bintang.reduce((s, b) => s + b, 0)

/* ----- ikon kecil ----- */
const Hati = ({ on = true, s = 5.5 }: { on?: boolean; s?: number }) => (
  <svg viewBox="0 0 24 24" style={{ width: s + 'cqw', height: s + 'cqw' }}>
    <path d="M12 21.2 C5 15.4 2 12 2 8.4 A5 5 0 0 1 12 6.2 A5 5 0 0 1 22 8.4 C22 12 19 15.4 12 21.2Z" fill={on ? '#ff4d6d' : '#aab6c6'} stroke={on ? '#b8203f' : '#7d8ba0'} strokeWidth="1.6" strokeLinejoin="round" />
    {on && <ellipse cx="7.6" cy="8.6" rx="2" ry="1.3" fill="#fff" opacity=".6" transform="rotate(-30 7.6 8.6)" />}
  </svg>
)
const Centang = ({ c = '#2a8a2e' }: { c?: string }) => (
  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#fff" /><path d="M6.5 12.5 L10.5 16.5 L17.5 8" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const Silang = () => (
  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#fff" /><path d="M7.5 7.5 L16.5 16.5 M16.5 7.5 L7.5 16.5" stroke="#d03030" strokeWidth="3" strokeLinecap="round" /></svg>
)
const TombolJeda = ({ onClick }: { onClick: () => void }) => (
  <button className="bt" style={{ position: 'absolute', ...a(4, 4, 9, 9), zIndex: 8 }} onClick={onClick} aria-label="Jeda">
    <svg viewBox="0 0 24 24"><path d="M8 5 V19 M16 5 V19" stroke="#fff" strokeWidth="4.4" strokeLinecap="round" /></svg>
  </button>
)

/* ----- ikon bentuk (dipakai untuk target, opsi jawaban, slot misi) ----- */
function Ikon({ k }: { k: IkonKey }) {
  switch (k) {
    case 'seg': return <Seg />
    case 'per': return <Per />
    case 'lin': return <Lin />
    case 'pjg': return <Pjg />
    case 'sisi3':
      return (
        <svg viewBox="0 0 40 40"><path d="M20 4 L37 35 H3Z" fill="#ffc72a" stroke="#d98a00" strokeWidth="3" strokeLinejoin="round" /><text x="20" y="30" textAnchor="middle" fontSize="15" fontWeight="700" fill="#7a4a00">3</text></svg>
      )
    case 'sisi4':
      return (
        <svg viewBox="0 0 40 40"><rect x="5" y="5" width="30" height="30" rx="4" fill="#2f8cf0" stroke="#1450a8" strokeWidth="3" /><text x="20" y="27.5" textAnchor="middle" fontSize="17" fontWeight="700" fill="#fff">4</text></svg>
      )
    case 'sudut':
      return (
        <svg viewBox="0 0 40 40">
          <path d="M7 14 L26 5 L35 24 L14 35Z" fill="#cdbbff" stroke="#6a44d4" strokeWidth="2.6" strokeLinejoin="round" />
          {[[7, 14], [26, 5], [35, 24], [14, 35]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="3.6" fill="#ff4d6d" stroke="#fff" strokeWidth="1.5" />)}
        </svg>
      )
    case 'jam':
      return (
        <svg viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="16" fill="#fff" stroke="#3b5ea0" strokeWidth="3.2" />
          <path d="M20 8 V10.5 M20 29.5 V32 M8 20 H10.5 M29.5 20 H32" stroke="#3b5ea0" strokeWidth="2" strokeLinecap="round" />
          <path d="M20 20 V12 M20 20 L26 23" stroke="#17306b" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="20" cy="20" r="1.8" fill="#e03a52" />
        </svg>
      )
    case 'atap':
      return (
        <svg viewBox="0 0 40 40">
          <rect x="8" y="20" width="24" height="16" fill="#fff4de" stroke="#b89a60" strokeWidth="2" />
          <path d="M3 22 L20 5 L37 22Z" fill="#d4402c" stroke="#8a2418" strokeWidth="2.6" strokeLinejoin="round" />
          <rect x="17" y="26" width="7" height="10" fill="#a8733a" />
        </svg>
      )
    case 'ubin':
      return (
        <svg viewBox="0 0 40 40">
          <rect x="4" y="4" width="15" height="15" rx="1.5" fill="#f4d9a8" stroke="#b9893c" strokeWidth="2" />
          <rect x="21" y="4" width="15" height="15" rx="1.5" fill="#9ed0ff" stroke="#3b7dd1" strokeWidth="2" />
          <rect x="4" y="21" width="15" height="15" rx="1.5" fill="#9ed0ff" stroke="#3b7dd1" strokeWidth="2" />
          <rect x="21" y="21" width="15" height="15" rx="1.5" fill="#f4d9a8" stroke="#b9893c" strokeWidth="2" />
        </svg>
      )
    case 'pintu':
      return (
        <svg viewBox="0 0 40 40">
          <rect x="9" y="3" width="22" height="34" rx="2" fill="#b9793a" stroke="#6b4220" strokeWidth="2.6" />
          <rect x="13" y="8" width="14" height="10" rx="1.5" fill="#d89a58" /><rect x="13" y="22" width="14" height="11" rx="1.5" fill="#d89a58" />
          <circle cx="27" cy="21" r="1.8" fill="#ffd54a" />
        </svg>
      )
    case 'roda':
      return (
        <svg viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="16" fill="none" stroke="#2b3a55" strokeWidth="4" />
          <path d="M20 5 V35 M5 20 H35 M9.5 9.5 L30.5 30.5 M30.5 9.5 L9.5 30.5" stroke="#8fa0bd" strokeWidth="1.4" />
          <circle cx="20" cy="20" r="3" fill="#2b3a55" />
        </svg>
      )
  }
}

/* ----- ilustrasi besar di kartu soal ----- */
function Ilustrasi({ k }: { k: IkonKey | 'tanya' }) {
  const kotak = { borderRadius: '3cqw' }
  if (k === 'seg' || k === 'per' || k === 'lin' || k === 'pjg') return <div className="ilus-bentuk"><Ikon k={k} /></div>
  if (k === 'jam') {
    return (
      <svg viewBox="0 0 120 80" style={kotak}>
        <rect width="120" height="80" fill="#f6e6c8" /><rect y="66" width="120" height="14" fill="#c99a62" />
        <circle cx="60" cy="36" r="29" fill="#fff" stroke="#8a5a2b" strokeWidth="5" />
        {Array.from({ length: 12 }, (_, i) => <line key={i} x1="60" y1="11" x2="60" y2={i % 3 === 0 ? 17 : 14} stroke="#3b5ea0" strokeWidth={i % 3 === 0 ? 2.6 : 1.6} strokeLinecap="round" transform={`rotate(${i * 30} 60 36)`} />)}
        <path d="M60 36 V20 M60 36 L72 42" stroke="#17306b" strokeWidth="3.4" strokeLinecap="round" /><circle cx="60" cy="36" r="2.8" fill="#e03a52" />
      </svg>
    )
  }
  if (k === 'atap') {
    return (
      <svg viewBox="0 0 120 80" style={{ ...kotak, background: 'linear-gradient(#8fd0ff,#d8f0ff)' }}>
        <rect y="68" width="120" height="12" fill="#7ad25a" />
        <path d="M18 40 L60 8 L102 40Z" fill="#d4402c" stroke="#8a2418" strokeWidth="3" strokeLinejoin="round" />
        <rect x="26" y="40" width="68" height="30" fill="#fff4de" stroke="#b89a60" strokeWidth="2" />
        <rect x="34" y="48" width="14" height="14" fill="#8fd0ff" stroke="#8a5a2b" strokeWidth="2" /><rect x="56" y="48" width="14" height="22" fill="#a8733a" /><rect x="76" y="48" width="12" height="14" fill="#8fd0ff" stroke="#8a5a2b" strokeWidth="2" />
      </svg>
    )
  }
  if (k === 'ubin') {
    return (
      <svg viewBox="0 0 120 80" style={kotak}>
        <rect width="120" height="80" fill="#e9e2d2" />
        {Array.from({ length: 18 }, (_, i) => {
          const c = i % 6, r = Math.floor(i / 6)
          return <rect key={i} x={6 + c * 18} y={6 + r * 24} width="17" height="17" rx="1.5" fill={(c + r) % 2 ? '#9ed0ff' : '#f4d9a8'} stroke={(c + r) % 2 ? '#3b7dd1' : '#b9893c'} strokeWidth="1.6" />
        })}
        <rect x="42" y="30" width="17" height="17" rx="1.5" fill="none" stroke="#ff5a78" strokeWidth="2.4" strokeDasharray="3 2" />
      </svg>
    )
  }
  if (k === 'pintu') {
    return (
      <svg viewBox="0 0 120 80" style={kotak}>
        <rect width="120" height="80" fill="#f6e6c8" /><rect y="70" width="120" height="10" fill="#c99a62" />
        <rect x="38" y="6" width="44" height="64" rx="3" fill="#b9793a" stroke="#6b4220" strokeWidth="4" />
        <rect x="45" y="13" width="30" height="21" rx="2" fill="#d89a58" /><rect x="45" y="41" width="30" height="23" rx="2" fill="#d89a58" />
        <circle cx="74" cy="38" r="3" fill="#ffd54a" stroke="#b88a10" strokeWidth="1" />
      </svg>
    )
  }
  if (k === 'roda') {
    return (
      <svg viewBox="0 0 120 80" style={{ ...kotak, background: 'linear-gradient(#cfeaff,#eef8ff)' }}>
        <rect y="70" width="120" height="10" fill="#9bd57a" />
        <path d="M60 41 L78 14 M60 41 L90 41" stroke="#e03a52" strokeWidth="4" strokeLinecap="round" />
        <circle cx="60" cy="41" r="28" fill="none" stroke="#2b3a55" strokeWidth="5.5" />
        {Array.from({ length: 12 }, (_, i) => <line key={i} x1="60" y1="41" x2="60" y2="15" stroke="#8fa0bd" strokeWidth="1.4" transform={`rotate(${i * 30} 60 41)`} />)}
        <circle cx="60" cy="41" r="4" fill="#2b3a55" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 120 80" style={{ ...kotak, background: 'linear-gradient(#cfeaff,#eef8ff)' }}>
      <path d="M18 56 L34 24 L50 56Z" fill="none" stroke="#7da2d6" strokeWidth="3" strokeDasharray="4 3" strokeLinejoin="round" />
      <rect x="70" y="26" width="30" height="30" rx="4" fill="none" stroke="#7da2d6" strokeWidth="3" strokeDasharray="4 3" />
      <circle cx="60" cy="40" r="15" fill="#ffc72a" stroke="#d98a00" strokeWidth="3" />
      <text x="60" y="48" textAnchor="middle" fontSize="22" fontWeight="700" fill="#7a4a00">?</text>
    </svg>
  )
}

/* ----- musuh bangun datar (mengikuti gaya Musuh di beranda) ----- */
function Penjaga({ jenis }: { jenis: Rintangan['jenis'] }) {
  return (
    <svg viewBox="0 0 56 56">
      {jenis === 'bola' && (<>
        <circle cx="28" cy="29" r="26" fill="#e03a52" stroke="#8d1630" strokeWidth="2.5" />
        <ellipse cx="18" cy="15" rx="8" ry="4.5" fill="#fff" opacity=".4" transform="rotate(-25 18 15)" />
        <MataMarah cx={28} cy={31} />
      </>)}
      {jenis === 'kubus' && (<>
        <rect x="3" y="5" width="50" height="48" rx="7" fill="#2f8cf0" stroke="#1450a8" strokeWidth="2.5" />
        <path d="M10 5 H46 Q53 5 53 12 V15 H3 V12 Q3 5 10 5Z" fill="#7cc8ff" opacity=".8" />
        <MataMarah cx={28} cy={32} />
      </>)}
      {jenis === 'limas' && (<>
        <path d="M28 4 L53 52 H3 Z" fill="#7a52e0" stroke="#4c2ea8" strokeWidth="3" strokeLinejoin="round" />
        <path d="M28 12 L14 42" stroke="#c4aeff" strokeWidth="3" strokeLinecap="round" opacity=".6" />
        <MataMarah cx={28} cy={38} s={0.8} />
      </>)}
    </svg>
  )
}

/* ----- gerbang soal ----- */
function Gerbang({ buka }: { buka: boolean }) {
  return (
    <svg viewBox="0 0 70 85" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
      <defs>
        <radialGradient id="gPortalG" cx=".5" cy=".5" r=".6"><stop offset="0" stopColor="#fff" /><stop offset=".5" stopColor="#8ff0ff" /><stop offset="1" stopColor="#2f9bff" /></radialGradient>
      </defs>
      {buka && <circle cx="35" cy="48" r="38" fill="#8ff0ff" opacity=".3" />}
      <path d="M4 85 V35 A31 31 0 0 1 66 35 V85Z" fill="#8f9bb0" stroke="#4d5b75" strokeWidth="3" />
      {[[10, 60], [10, 44], [58, 60], [58, 44]].map(([x, y]) => <rect key={x + '-' + y} x={x} y={y} width="3" height="12" rx="1" fill="#b6c0d2" />)}
      <path d="M15 85 V38 A20 20 0 0 1 55 38 V85Z" fill={buka ? 'url(#gPortalG)' : '#6b4a2b'} stroke="#3a4560" strokeWidth="2" />
      {!buka && (<>
        <path d="M35 20 V85 M15 52 H55 M15 68 H55" stroke="#4a331c" strokeWidth="2" />
        <rect x="27" y="46" width="16" height="14" rx="3" fill="#ffc72a" stroke="#c98a14" strokeWidth="2" />
        <path d="M30 46 V41 A5 5 0 0 1 40 41 V46" fill="none" stroke="#c98a14" strokeWidth="3" />
      </>)}
      {buka && <path d="M35 34 L39 44 L50 45 L42 52 L44 63 L35 57 L26 63 L28 52 L20 45 L31 44Z" fill="#fff" opacity=".9" />}
      <path d="M12 8 L35 -2 L58 8" fill="none" stroke="#4d5b75" strokeWidth="0" />
    </svg>
  )
}

/* ----- maskot dengan ekspresi (untuk umpan balik & hasil) ----- */
function MaskotMini({ mood, st }: { mood: 'senang' | 'sedih'; st: CSSProperties }) {
  return (
    <svg viewBox="0 0 100 110" style={{ position: 'absolute', filter: 'drop-shadow(0 1cqw .8cqw rgba(30,60,20,.3))', ...st }}>
      <rect x="2" y="48" width="26" height="40" rx="9" fill="#2f72dc" stroke="#12378a" strokeWidth="2" />
      <path d="M50 8 L10 92 H90Z" fill="#ffd428" stroke="#ffd428" strokeWidth="12" strokeLinejoin="round" />
      <path d="M50 8 L10 92 H40Z" fill="#e8a400" opacity=".3" />
      <ellipse cx="42" cy="58" rx="8" ry={mood === 'sedih' ? 9 : 10} fill="#fff" stroke="#222" strokeWidth="1.5" />
      <ellipse cx="64" cy="58" rx="8" ry={mood === 'sedih' ? 9 : 10} fill="#fff" stroke="#222" strokeWidth="1.5" />
      <circle cx="44" cy={mood === 'sedih' ? 63 : 61} r="5" fill="#1b1b1b" /><circle cx="66" cy={mood === 'sedih' ? 63 : 61} r="5" fill="#1b1b1b" />
      {mood === 'senang' ? (
        <path d="M47 74 Q54 90 62 74Z" fill="#e7323a" stroke="#7a1a1a" strokeWidth="1.5" strokeLinejoin="round" />
      ) : (<>
        <path d="M46 83 Q54 72 62 83" fill="none" stroke="#7a1a1a" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M34 48 L48 52 M72 48 L58 52" stroke="#7a4a00" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M38 70 Q35 76 38 79 Q41 76 38 70Z" fill="#6ec6ff" />
      </>)}
    </svg>
  )
}

/* ----- ledakan konfeti berbentuk bangun datar ----- */
function Ledakan({ x, y, n = 10, r = 12, warna = WARNA_KONFETI }: { x: number; y: number; n?: number; r?: number; warna?: string[] }) {
  return (
    <div className="ledak" style={{ left: x + 'cqw', top: y + 'cqw' }}>
      {Array.from({ length: n }, (_, i) => {
        const sudut = (i / n) * Math.PI * 2 + (i % 2) * 0.3
        const jarak = r * (0.7 + (i % 3) * 0.25)
        return <i key={i} className={'p' + (i % 3)} style={{ background: warna[i % warna.length], '--dx': Math.cos(sudut) * jarak + 'cqw', '--dy': Math.sin(sudut) * jarak + 'cqw' } as CSSProperties} />
      })}
    </div>
  )
}

/* ----- pemandangan per tema (statis, tidak di-render ulang tiap frame) ----- */
const Pinus = ({ x, y, s, c }: { x: number; y: number; s: number; c: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill={c}>
    <rect x="-1.2" y="-2" width="2.4" height="7" fill="#5a3a1f" />
    <path d="M0 -34 L9 -16 H-9Z" /><path d="M0 -26 L12 -6 H-12Z" /><path d="M0 -16 L15 4 H-15Z" />
  </g>
)
const Awan = ({ x, y, s, o = 0.92 }: { x: number; y: number; s: number; o?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill="#fff" opacity={o}>
    <ellipse cx="0" cy="0" rx="10" ry="4" /><ellipse cx="-6" cy="-2.5" rx="6" ry="4" /><ellipse cx="5" cy="-3.2" rx="7" ry="4.5" />
  </g>
)

const Pemandangan = memo(function Pemandangan({ tema }: { tema: TemaKey }) {
  return (
    <svg className="latar-game" viewBox="0 0 100 177.75" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {tema === 'pulau' && (<>
        <defs><linearGradient id="skP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3fa6ee" /><stop offset=".6" stopColor="#8fd3fb" /><stop offset="1" stopColor="#d6f2ff" /></linearGradient></defs>
        <rect width="100" height="177.75" fill="url(#skP)" />
        <circle cx="84" cy="42" r="17" fill="#fff6c0" opacity=".45" /><circle cx="84" cy="42" r="9.5" fill="#fff3a6" />
        <Awan x={16} y={40} s={1} /><Awan x={62} y={64} s={0.8} /><Awan x={30} y={96} s={0.9} /><Awan x={80} y={108} s={0.7} />
        <rect y="124" width="100" height="30" fill="#2f9ae0" />
        <path d="M0 124 q6 -2.4 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 V128 H0Z" fill="#6fc4f5" />
        <path d="M56 124 q16 -24 40 0Z" fill="#4fae4a" /><path d="M68 124 q9 -15 22 0Z" fill="#3a9640" />
        {[10, 90].map((x) => (
          <g key={x} transform={`translate(${x} 146)`}>
            <path d="M0 0 Q-2 -14 1 -26" stroke="#8a5a2b" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <g transform="translate(1 -26)" fill="#3bb03a">{[-70, -25, 20, 65, 110].map((r) => <ellipse key={r} cx="0" cy="-6" rx="2.6" ry="8" transform={`rotate(${r})`} />)}</g>
          </g>
        ))}
      </>)}
      {tema === 'lembah' && (<>
        <defs><linearGradient id="skL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff8f6b" /><stop offset=".55" stopColor="#ffc27a" /><stop offset="1" stopColor="#ffe9b8" /></linearGradient></defs>
        <rect width="100" height="177.75" fill="url(#skL)" />
        <circle cx="50" cy="104" r="19" fill="#fff2b8" opacity=".55" /><circle cx="50" cy="104" r="11" fill="#fffbe0" />
        <Awan x={22} y={46} s={1.1} o={0.4} /><Awan x={74} y={70} s={0.9} o={0.35} />
        <path d="M0 134 V100 L10 98 L14 88 L30 88 L34 98 L46 100 V134Z" fill="#d98050" />
        <path d="M50 134 L56 96 L60 92 L80 92 L84 100 L100 102 V134Z" fill="#c46a3d" />
        <path d="M0 146 V122 L18 120 L24 112 L40 112 L44 122 L60 124 L70 116 L90 116 L100 124 V146Z" fill="#a9532d" />
        {[14, 88].map((x) => (
          <g key={x} transform={`translate(${x} 146)`} fill="#3f9a52" stroke="#2a7a3c" strokeWidth=".6">
            <rect x="-1.4" y="-17" width="2.8" height="17" rx="1.4" /><rect x="-5.2" y="-12" width="2.4" height="6" rx="1.2" /><rect x="-5.2" y="-7" width="5" height="2.4" rx="1.2" />
            <rect x="2.8" y="-10" width="2.4" height="6" rx="1.2" /><rect x="0" y="-5" width="5" height="2.4" rx="1.2" />
          </g>
        ))}
      </>)}
      {tema === 'hutan' && (<>
        <defs><linearGradient id="skH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0f5a4a" /><stop offset=".55" stopColor="#2e9a6a" /><stop offset="1" stopColor="#b8ec9c" /></linearGradient></defs>
        <rect width="100" height="177.75" fill="url(#skH)" />
        <polygon points="20,0 34,0 52,150 6,150" fill="#fff" opacity=".07" /><polygon points="62,0 74,0 96,150 58,150" fill="#fff" opacity=".07" />
        {[6, 22, 38, 56, 72, 90].map((x, i) => <Pinus key={x} x={x} y={118 + (i % 2) * 6} s={0.95} c="#1f7d55" />)}
        {[0, 14, 30, 50, 66, 84, 100].map((x, i) => <Pinus key={x} x={x} y={150 - (i % 2) * 3} s={1.3} c="#2a9a5f" />)}
        {[[20, 70], [76, 52], [48, 96], [88, 110], [10, 112]].map(([x, y], i) => <circle key={i} className="kunang" cx={x} cy={y} r="0.9" fill="#fff7a8" style={{ animationDelay: i * 0.5 + 's' }} />)}
      </>)}
    </svg>
  )
})

const Statis = memo(function Statis({ lv }: { lv: Level }) {
  const d = lv.dunia
  return (<>
    <Pemandangan tema={lv.tema} />
    {d.pijakan.map((p, i) => <div key={i} className={'pl pl-' + lv.tema} style={{ left: p.x + 'cqw', top: p.y + 'cqw', width: p.w + 'cqw' }} />)}
    <div className={'tanah tn-' + lv.tema} />
    {d.duri.map((r, i) => {
      const n = Math.max(1, Math.floor(r.w / 3.6))
      return (
        <svg key={i} className="duri" viewBox={`0 0 ${n * 3.6} 3.6`} style={{ left: r.x + 'cqw', top: r.y - 3.6 + 'cqw', width: n * 3.6 + 'cqw', height: '3.6cqw' }}>
          {Array.from({ length: n }, (_, j) => <path key={j} d={`M${j * 3.6} 3.6 L${j * 3.6 + 1.8} 0 L${(j + 1) * 3.6} 3.6Z`} fill="#c9d3e3" stroke="#6e7f99" strokeWidth=".4" strokeLinejoin="round" />)}
        </svg>
      )
    })}
  </>)
})

/* ----- layar jeda ----- */
function Jeda({ onLanjut, onKeluar }: { onLanjut: () => void; onKeluar: () => void }) {
  const [bunyi, setBunyi] = useState(suara.nyala())
  return (
    <div className="tirai">
      <div className="kartu" style={{ position: 'absolute', ...a(12, 62, 76, 58), textAlign: 'center' }}>
        <b style={{ position: 'absolute', ...a(0, 6, 76, 8), fontSize: '6cqw' }}>Permainan dijeda</b>
        <div style={{ position: 'absolute', ...a(8, 18, 60, 11) }}><button className="tombol" onClick={onLanjut}>Lanjutkan</button></div>
        <button className="tombol tbl-putih" style={{ position: 'absolute', ...a(8, 33, 60, 10) }} onClick={onKeluar}>Keluar ke peta</button>
        <button className="tombol tbl-putih" style={{ position: 'absolute', ...a(8, 46, 60, 9) }} onClick={() => { const b = !bunyi; suara.atur(b); setBunyi(b) }}>Suara: {bunyi ? 'Nyala' : 'Mati'}</button>
      </div>
    </div>
  )
}

/* =====================================================================
   FASE 1 – JELAJAH: platformer kumpulkan bentuk target
   ===================================================================== */
function Jelajah({ g, ke }: { g: Konteks; ke: Ke }) {
  const lv = g.lv
  const d = lv.dunia
  const [S] = useState(() => buatKeadaan(d))
  const K = useRef<Kunci>({ kiri: false, kanan: false, buf: 0 }).current
  const [, setTick] = useState(0)
  const [jeda, setJedaState] = useState(false)
  const jedaRef = useRef(false)
  const setJeda = (v: boolean) => { jedaRef.current = v; setJedaState(v) }

  useEffect(() => { suara.main('mulai') }, [])

  useEffect(() => {
    let id = 0
    let t0 = performance.now()
    let kirim = false
    const loop = (t: number) => {
      const dt = Math.min((t - t0) / 1000, 1 / 30)
      t0 = t
      if (!jedaRef.current) {
        langkah(S, dt, K, d)
        if (S.bunyi.length) {
          for (const b of new Set<Bunyi>(S.bunyi)) suara.main(b)
          S.bunyi.length = 0
        }
        if (S.selesai && S.masuk <= 0 && !kirim) {
          kirim = true
          g.selesaiJelajah(S.jumlahKoin)
        }
      }
      setTick((n) => (n + 1) % 1000000)
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const bawah = (e: KeyboardEvent) => {
      const k = e.key
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') K.kiri = true
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') K.kanan = true
      else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') { if (!e.repeat) K.buf = 0.12 }
      else if (k === 'Escape' || k === 'p' || k === 'P') { setJeda(!jedaRef.current); return }
      else return
      e.preventDefault()
    }
    const atas = (e: KeyboardEvent) => {
      const k = e.key
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') K.kiri = false
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') K.kanan = false
    }
    const lepas = () => { K.kiri = false; K.kanan = false }
    window.addEventListener('keydown', bawah)
    window.addEventListener('keyup', atas)
    window.addEventListener('blur', lepas)
    return () => {
      window.removeEventListener('keydown', bawah)
      window.removeEventListener('keyup', atas)
      window.removeEventListener('blur', lepas)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tahan = (kunci: 'kiri' | 'kanan') => ({
    onPointerDown: (e: PtrEv<HTMLButtonElement>) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); K[kunci] = true },
    onPointerUp: () => { K[kunci] = false },
    onPointerCancel: () => { K[kunci] = false },
    onLostPointerCapture: () => { K[kunci] = false },
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  })

  const n = S.target.filter(Boolean).length
  const SP = 10.6
  const SH = SP * 1.1
  const sy = 1 + (S.darat ? 0 : Math.min(Math.abs(S.vy), 140) / 520)
  const miring = S.stun > 0 ? Math.sin(S.waktu * 40) * 10 : S.darat && Math.abs(S.vx) > 1 ? Math.sin(S.waktu * 18) * 6 : 0
  const kedip = S.kebal > 0 && Math.floor(S.waktu * 14) % 2 === 0
  const gb = d.gerbang

  return (
    <>
      <div className="dunia">
        <Statis lv={lv} />

        {/* gerbang soal */}
        <div style={{ left: gb.x - 7 + 'cqw', top: gb.y - GH + 'cqw', width: '14cqw', height: GH + 'cqw' }}><Gerbang buka={S.buka} /></div>
        {!S.buka && (
          <div className="gb-chip" style={{ left: gb.x - 4.5 + 'cqw', top: gb.y - GH - 4.6 + 'cqw' }}><Gm />{n}/{d.target.length}</div>
        )}
        {S.buka && (
          <svg className="gb-panah" viewBox="0 0 24 24" style={{ left: gb.x - 2.5 + 'cqw', top: gb.y - GH - 6 + 'cqw' }}>
            <path d="M12 21 L3 9 H9 V3 H15 V9 H21Z" fill="#ffc72a" stroke="#d98a00" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        )}

        {/* bentuk target */}
        {d.target.map((t, i) => !S.target[i] && (
          <div key={i} className="tg" style={{ left: t.x - 4 + 'cqw', top: t.y - 4 + 'cqw' }}>
            <div className="tg-lab">{t.nama}</div>
            <div className="tg-in"><Ikon k={t.ik} /></div>
          </div>
        ))}

        {/* koin */}
        {d.koin.map((c, i) => !S.koin[i] && <div key={i} className="kn" style={{ left: c.x - 2 + 'cqw', top: c.y - 2 + 'cqw' }}><Koin /></div>)}

        {/* musuh */}
        {d.musuh.map((m, i) => {
          const e = S.musuh[i]
          if (e.mati) return null
          return (
            <div key={i} className="mu" style={{ left: 0, top: 0, transform: `translate(${e.x}cqw, ${m.y - ES}cqw)` }}>
              <div className="mu-in" style={{ animationDelay: i * 0.13 + 's' }}><Penjaga jenis={m.jenis} /></div>
            </div>
          )
        })}

        {/* pemain */}
        {!S.selesai && (
          <Mas st={{
            left: 0, top: 0, width: SP + 'cqw', height: SH + 'cqw', opacity: kedip ? 0.35 : 1, transformOrigin: '50% 89%',
            transform: `translate(${S.x + PW / 2 - SP / 2}cqw, ${S.y + PH - SH * 0.89}cqw) rotate(${miring}deg) scale(${(1 / sy) * S.hadap}, ${sy})`,
          }} />
        )}

        {S.efek.map((e) => (
          <Ledakan key={e.id} x={e.x} y={e.y} n={e.w === 'koin' ? 6 : 10} r={e.w === 'koin' ? 6 : 11}
            warna={e.w === 'duar' ? ['#ff7a3c', '#ffd23c', '#ff4d6d'] : ['#ffd23c', '#ffffff', '#7be4ff']} />
        ))}
      </div>

      {/* HUD */}
      <TombolJeda onClick={() => setJeda(true)} />
      <Pill st={{ ...a(15, 5, 19, 7), zIndex: 8 }}>Level {lv.id}</Pill>
      <Pill st={{ ...a(36, 5, 15, 7), zIndex: 8 }}><Koin />{S.jumlahKoin}</Pill>
      <Pill st={{ ...a(53, 5, 42, 7), zIndex: 8 }}>{Array.from({ length: NYAWA }, (_, i) => <Hati key={i} s={5.2} />)}</Pill>
      <div className="kartu" style={{ position: 'absolute', ...a(4, 13.5, 92, 11.5), display: 'flex', alignItems: 'center', padding: '0 2.5cqw', gap: '1.5cqw', zIndex: 7 }}>
        {d.target.map((t, i) => (
          <div key={i} className={'slot' + (S.target[i] ? ' ok' : '')}>
            <div className="slot-ik"><Ikon k={t.ik} />{S.target[i] && <span className="slot-cek"><Centang c="#2a8a2e" /></span>}</div>
            <span>{t.nama}</span>
          </div>
        ))}
        <b className="slot-n">{n}/{d.target.length}</b>
      </div>
      {S.pesanT > 0 && <div className="toast" style={{ opacity: Math.min(1, S.pesanT * 3) }}>{S.pesan}</div>}

      {/* kontrol */}
      <button className="bt kontrol" style={{ position: 'absolute', ...a(5, 153, 14, 14), zIndex: 8 }} aria-label="Kiri" {...tahan('kiri')}><Panah /></button>
      <button className="bt kontrol" style={{ position: 'absolute', ...a(22, 153, 14, 14), zIndex: 8 }} aria-label="Kanan" {...tahan('kanan')}><Panah r={180} /></button>
      <div className="petunjuk-kontrol" style={{ position: 'absolute', ...a(40, 155, 36, 10) }}>Injak musuh dari atas untuk mengalahkannya</div>
      <button className="bt kontrol" style={{ position: 'absolute', ...a(80, 152, 16, 16), zIndex: 8 }} aria-label="Loncat"
        onPointerDown={(e) => { e.preventDefault(); K.buf = 0.12 }} onContextMenu={(e) => e.preventDefault()}><Panah r={90} /></button>

      {jeda && <Jeda onLanjut={() => setJeda(false)} onKeluar={() => ke('peta')} />}
    </>
  )
}

/* =====================================================================
   FASE 2 – KUIS: 5 soal, benar = bintang +1, salah = nyawa −1
   ===================================================================== */
function Kuis({ g, ke }: { g: Konteks; ke: Ke }) {
  const lv = g.lv
  const total = lv.soal.length
  const [urut] = useState(() => lv.soal.map((s) => acak(s.opsi.map((_, i) => i))))
  const [idx, setIdx] = useState(0)
  const [pilih, setPilih] = useState<number | null>(null)
  const [bintang, setBintang] = useState(0)
  const [nyawa, setNyawa] = useState(NYAWA)
  const [jeda, setJeda] = useState(false)

  const s = lv.soal[idx]
  const susun = urut[idx]
  const sudah = pilih !== null
  const benar = sudah && pilih === s.benar
  const habis = sudah && !benar && nyawa <= 0
  const terakhir = idx === total - 1

  const jawab = (o: number) => {
    if (sudah) return
    setPilih(o)
    if (o === s.benar) { setBintang((b) => b + 1); suara.main('benar') }
    else { setNyawa((n) => n - 1); suara.main('salah') }
  }
  const lanjut = () => {
    if (habis || terakhir) {
      g.selesaiKuis({ level: lv.id, bintang, nyawa, benar: bintang, koin: g.koinJelajah, lolos: bintang >= BINTANG_LOLOS })
    } else {
      setIdx(idx + 1)
      setPilih(null)
    }
  }

  const pusatOpsi = (pos: number) =>
    s.mode === 'teks' ? { x: 50, y: 84 + pos * 15 } : { x: pos % 2 ? 72 : 28, y: 93 + Math.floor(pos / 2) * 31 }
  const posPilih = sudah ? pusatOpsi(susun.indexOf(pilih)) : null

  return (
    <>
      <Pemandangan tema={lv.tema} />
      <div className="kabut" />
      <TombolJeda onClick={() => setJeda(true)} />
      <div className="prog" style={{ position: 'absolute', ...a(16, 6.3, 56, 3.6) }}><i style={{ width: ((idx + (sudah ? 1 : 0)) / total) * 100 + '%' }} /></div>
      <span className="prog-n" style={{ position: 'absolute', ...a(74, 5.2) }}>Soal {idx + 1}/{total}</span>

      <Pill st={a(6, 13.5, 50, 8)}>
        {Array.from({ length: total }, (_, i) => <span key={i} className={sudah && benar && i === bintang - 1 ? 'pop' : ''} style={{ display: 'inline-flex' }}><Bin s={6} on={i < bintang} /></span>)}
      </Pill>
      <Pill st={a(60, 13.5, 34, 8)}>
        {Array.from({ length: NYAWA }, (_, i) => <span key={i} className={sudah && !benar && i === nyawa ? 'hilang' : ''} style={{ display: 'inline-flex' }}><Hati s={5.6} on={i < nyawa} /></span>)}
      </Pill>

      <div key={'q' + idx} className="kartu masuk" style={{ position: 'absolute', ...a(6, 25, 88, 50), padding: '3.5cqw 4cqw', display: 'flex', flexDirection: 'column', gap: '2cqw' }}>
        <b style={{ fontSize: '4.3cqw', lineHeight: 1.2 }}>{s.q}</b>
        <div className="ilus"><Ilustrasi k={s.gambar} /></div>
      </div>

      {susun.map((o, pos) => {
        const op = s.opsi[o]
        const st = !sudah ? '' : o === s.benar ? 'benar' : o === pilih ? 'salah' : 'pudar'
        const tanda = sudah && (o === s.benar ? <Centang /> : o === pilih ? <Silang /> : null)
        if (s.mode === 'gambar') {
          return (
            <button key={idx + '-' + o} className={'ubin-g masuk ' + st} disabled={sudah} aria-label={op.t} onClick={() => jawab(o)}
              style={{ position: 'absolute', ...a(pos % 2 ? 51 : 7, 79 + Math.floor(pos / 2) * 31, 42, 28.5), animationDelay: pos * 0.06 + 's' }}>
              <span className="ubin-ik">{op.ik && <Ikon k={op.ik} />}</span>
              {tanda && <span className="ubin-tanda">{tanda}</span>}
            </button>
          )
        }
        return (
          <button key={idx + '-' + o} className={'opsi masuk ' + st} disabled={sudah} onClick={() => jawab(o)}
            style={{ position: 'absolute', ...a(11, 78 + pos * 15, 78, 12.5), background: WARNA_OPSI[pos], animationDelay: pos * 0.06 + 's' }}>
            {op.ik && <Ikon k={op.ik} />}
            <span style={{ flex: 1 }}>{op.t}</span>
            {tanda}
          </button>
        )
      })}

      {sudah && benar && posPilih && <Ledakan key={'l' + idx} x={posPilih.x} y={posPilih.y} n={16} r={30} />}

      {sudah && (
        <div className="sheet" style={{ position: 'absolute', ...a(0, 141, 100, 36.75), background: benar ? '#e8fbdc' : '#ffece8' }}>
          <MaskotMini mood={benar ? 'senang' : 'sedih'} st={a(3, 2.5, 15, 16.5)} />
          <div style={{ position: 'absolute', ...a(21, 3, 75, 22) }}>
            <b className="jdl" style={{ color: benar ? '#1f7a2a' : '#b02a2a' }}>
              {benar ? 'Hebat! Bintang +1' : habis ? 'Nyawa habis!' : 'Belum tepat. Nyawa −1'}
            </b>
            <p>{benar ? s.petunjuk : 'Petunjuk: ' + s.petunjuk}</p>
            {!benar && <p>Jawaban benar: <b>{s.opsi[s.benar].t}</b></p>}
          </div>
          <div style={{ position: 'absolute', ...a(6, 25.8, 88, 9.8) }}>
            <button className="tombol" style={{ fontSize: '4.4cqw', borderRadius: '5cqw' }} onClick={lanjut}>{habis || terakhir ? 'Lihat hasil' : 'Soal berikutnya'}</button>
          </div>
        </div>
      )}

      {jeda && <Jeda onLanjut={() => setJeda(false)} onKeluar={() => ke('peta')} />}
    </>
  )
}

/* =====================================================================
   HASIL LEVEL – lanjut jika bintang ≥ 2, wajib ulang jika bintang ≤ 1
   ===================================================================== */
function LayarHasil({ g, ke }: { g: Konteks; ke: Ke }) {
  const h = g.hasil
  useEffect(() => {
    if (!h) return
    for (let i = 0; i < h.bintang; i++) suara.bintang(i, 0.3 + i * 0.28) // selaras dengan animasi bintang-pop
    const akhir = 0.3 + h.bintang * 0.28 + 0.1
    suara.main(h.lolos ? 'menang' : 'kalah', h.lolos ? akhir : Math.max(akhir, 0.5))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (!h) return null
  const lv = LEVEL[h.level - 1]
  const berikut = LEVEL[h.level]
  const kuis = lv.soal.length
  const skor = h.benar * 100
  const xp = h.benar * 20
  const judul = h.lolos ? (berikut ? 'Level Selesai!' : 'Pulau Selesai!') : h.nyawa <= 0 ? 'Nyawa Habis!' : 'Coba Lagi!'
  const baris = (label: ReactNode, nilai: ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2cqw', fontSize: '3.6cqw', fontWeight: 600 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '2cqw' }}>{label}</span><span style={{ display: 'flex', alignItems: 'center', gap: '1.5cqw' }}>{nilai}</span>
    </div>
  )

  return (
    <>
      <div className="pg" style={{ background: h.lolos ? 'linear-gradient(#6bbcf0, #cdeeff 50%, #7fd16a)' : 'linear-gradient(#7a8fb8, #c9d4ea 50%, #9fb7a0)' }} />
      {h.lolos && Array.from({ length: 22 }, (_, i) => (
        <div key={i} className="konfeti" style={{ left: ((i * 37) % 96) + 1 + 'cqw', background: WARNA_KONFETI[i % 5], animationDelay: (i % 7) * 0.18 + 's',
          clipPath: i % 3 === 0 ? 'polygon(50% 0,100% 100%,0 100%)' : undefined, borderRadius: i % 3 === 1 ? '50%' : undefined }} />
      ))}
      <div style={{ position: 'absolute', ...a(8, 6, 84, 17), display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '1cqw' }}>
        {Array.from({ length: kuis }, (_, i) => (
          <span key={i} className={i < h.bintang ? 'bintang-hasil' : ''} style={{ display: 'inline-flex', animationDelay: 0.2 + i * 0.28 + 's' }}>
            <Bin s={[11, 14, 17, 14, 11][i] ?? 12} on={i < h.bintang} />
          </span>
        ))}
      </div>
      <div className="kay" style={{ ...a(10, 23, 80, 12), fontSize: '7.5cqw', background: h.lolos ? 'linear-gradient(#3d8ff0, #1b4aa8)' : 'linear-gradient(#e8695f, #b02f2f)', borderColor: h.lolos ? '#0f2a63' : '#7a1c1c', textShadow: '0 .4cqw 0 rgba(0,0,0,.35)' }}>{judul}</div>
      <MaskotMini mood={h.lolos ? 'senang' : 'sedih'} st={a(35, 37, 30, 33)} />
      <div className="kartu" style={{ position: 'absolute', ...a(8, 74, 84, 60), padding: '3.5cqw 4cqw', display: 'flex', flexDirection: 'column', gap: '2.2cqw', justifyContent: 'center' }}>
        <div style={{ background: h.lolos ? '#e3f7d6' : '#ffe6e2', color: h.lolos ? '#1f7a2a' : '#b02a2a', borderRadius: '2.6cqw', padding: '1.8cqw 3cqw', fontSize: '3.2cqw', fontWeight: 600, textAlign: 'center', lineHeight: 1.25 }}>
          {h.lolos
            ? berikut ? 'Kamu dapat ' + h.bintang + ' bintang. Level ' + berikut.id + ' terbuka!' : 'Kamu dapat ' + h.bintang + ' bintang. Semua level Pulau Bentuk selesai!'
            : 'Kamu dapat ' + h.bintang + ' bintang. Butuh minimal ' + BINTANG_LOLOS + ' bintang untuk lanjut. Ulangi soalnya!'}
        </div>
        {baris(<><Bin s={5} />Skor</>, <><span style={{ width: '5cqw', display: 'inline-flex' }}><Koin /></span>{skor}</>)}
        {baris(<><b style={{ background: '#2f6fd6', color: '#fff', borderRadius: '50%', fontSize: '2.2cqw', padding: '1cqw' }}>XP</b>XP</>, <span style={{ color: '#7a3fc0' }}>+{xp}</span>)}
        {baris(<>Koin di level ini</>, <><span style={{ width: '5cqw', display: 'inline-flex' }}><Koin /></span>{h.koin}</>)}
        {baris(<>Jawaban</>, <><span style={{ width: '5.5cqw', display: 'inline-flex' }}><Centang c="#3bb03a" /></span>{h.benar} benar / {kuis}</>)}
      </div>
      {h.lolos ? (<>
        <button className="tombol tbl-hijau" style={{ position: 'absolute', ...a(8, 139, 84, 12), fontSize: '4.6cqw' }} onClick={() => (berikut ? g.mulaiLevel(berikut.id) : ke('peta'))}>
          {berikut ? 'Lanjut ke Level ' + berikut.id : 'Lanjutkan'}
        </button>
        <button className="tombol tbl-putih" style={{ position: 'absolute', ...a(8, 155, 40, 9) }} onClick={g.ulangKuis}>Ulangi soal</button>
        <button className="tombol tbl-putih" style={{ position: 'absolute', ...a(52, 155, 40, 9) }} onClick={() => ke('peta')}>Peta</button>
      </>) : (<>
        <button className="tombol" style={{ position: 'absolute', ...a(8, 139, 84, 12), fontSize: '4.6cqw' }} onClick={g.ulangKuis}>Ulangi soal</button>
        <button className="tombol tbl-putih" style={{ position: 'absolute', ...a(24, 155, 52, 9) }} onClick={() => ke('peta')}>Peta</button>
      </>)}
    </>
  )
}

/* =====================================================================
   DETAIL LEVEL
   ===================================================================== */
/* bintang hasil di atas lencana level – dipakai bersama oleh peta utama & peta pulau (tampilan sama) */
function BintangLevel({ n, dapat, total, st }: { n: number; dapat: number; total: number; st: CSSProperties }) {
  const atas = Math.ceil(total / 2)
  const baris = [Array.from({ length: atas }, (_, i) => i), Array.from({ length: total - atas }, (_, i) => atas + i)]
  return (
    <div aria-label={'Level ' + n + ': ' + dapat + ' dari ' + total + ' bintang'}
      style={{ position: 'absolute', zIndex: 4, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: '.1cqw',
        filter: 'drop-shadow(0 .3cqw 0 rgba(8,30,70,.55))', ...st }}>
      {baris.map((r, k) => (
        <div key={k} style={{ display: 'flex', gap: '.2cqw' }}>
          {r.map((i) => <Bin key={i} s={3.2} on={i < dapat} />)}
        </div>
      ))}
    </div>
  )
}

function LayarDetail({ ke, g }: { ke: Ke; g: Konteks }) {
  const lv = g.lv
  const rekor = g.kemajuan.bintang[lv.id - 1]
  const aturan: [ReactNode, string][] = [
    [<Bin s={5} />, 'Jawaban benar: bintang +1'],
    [<Hati s={5} />, 'Jawaban salah: nyawa −1 (ada ' + NYAWA + ' nyawa)'],
    [<Gm2 />, 'Minimal ' + BINTANG_LOLOS + ' bintang untuk lanjut. Kurang? Ulangi soalnya.'],
  ]
  return (
    <>
      <div className="pg" />
      <button className="bt" style={{ position: 'absolute', ...a(4, 4, 9, 9) }} onClick={() => ke('peta')} aria-label="Kembali"><Panah /></button>
      <Pill st={a(56, 5, 17, 7)}><svg viewBox="0 0 24 24"><path d="M12 1.8 L15.2 8.6 L22.4 9.4 L17 14.4 L18.6 21.7 L12 18 L5.4 21.7 L7 14.4 L1.6 9.4 L8.8 8.6Z" fill="#ffc928" /></svg>{jumlahBintang(g.kemajuan)}</Pill>
      <Pill st={a(76, 5, 17, 7)}><Koin />{g.kemajuan.koin}</Pill>
      <div className="kay" style={{ ...a(28, 15, 44, 12), fontSize: '7.5cqw' }}>Level {lv.id}</div>
      <div className="bir" style={{ ...a(14, 28.5, 72, 8), fontSize: '3.8cqw' }}>{lv.nama}</div>
      <div className="kartu" style={{ position: 'absolute', ...a(8, 39, 84, 31), padding: '2.5cqw 4cqw', fontSize: '3.2cqw', lineHeight: 1.3 }}>
        <b style={{ fontSize: '3.5cqw' }}>Tujuan:</b> {lv.capaian}<br />
        <b style={{ fontSize: '3.5cqw' }}>Misi:</b> {lv.misi}
      </div>
      <div style={{ position: 'absolute', ...a(8, 72, 84, 11), display: 'flex', gap: '2cqw' }}>
        {lv.dunia.target.map((t, i) => (
          <div key={i} className="chip" style={{ flex: 1, justifyContent: 'flex-start', padding: '0 1.5cqw', gap: '1.2cqw', fontSize: '2.7cqw', fontWeight: 600 }}>
            <span style={{ width: '6.4cqw', height: '6.4cqw', display: 'inline-flex', flex: 'none' }}><Ikon k={t.ik} /></span>{t.nama}
          </div>
        ))}
      </div>
      <div className="kartu" style={{ position: 'absolute', ...a(8, 86, 84, 33), padding: '3cqw 4cqw', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.8cqw', fontSize: '3.2cqw', fontWeight: 600, lineHeight: 1.25 }}>
        {aturan.map(([ik, teks], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '2.5cqw' }}><span style={{ width: '5cqw', height: '5cqw', display: 'inline-flex', flex: 'none' }}>{ik}</span>{teks}</div>
        ))}
      </div>
      <div style={{ position: 'absolute', ...a(26, 121, 48, 8), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1cqw', fontSize: '3cqw', fontWeight: 600 }}>
        Rekor:{Array.from({ length: lv.soal.length }, (_, i) => <Bin key={i} s={6.4} on={i < rekor} />)}
      </div>
      <Mas st={a(40, 130, 18, 20)} />
      <div style={{ position: 'absolute', ...a(22, 154, 56, 13) }}><button className="tombol" onClick={g.mulaiJelajah}>{rekor > 0 ? 'Main Lagi' : 'Mulai'}</button></div>
    </>
  )
}
const Gm2 = () => (
  <svg viewBox="0 0 24 24"><path d="M6 21 V4 M6 5 H19 L16 9 L19 13 H6" stroke="#e03a52" strokeWidth="2.6" fill="#ff7a8a" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

/* ===== ALUR ===== */
function Alur({ layar, ke, g }: { layar: string; ke: Ke; g: Konteks }) {
  /* ---------- Peta Petualangan: latar langit + 5 gambar pulau (PNG transparan di /public/pulau) ---------- */
  if (layar === 'peta') {
    return (
      <>
        <img src={LATAR_PETA} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
        {/* jalur putih 1 → 15 mengikuti urutan level, plus semak/teratai penutup */}
        <svg viewBox="0 0 941 1672" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true"><defs><radialGradient id="aw"><stop offset="0" stop-color="#5fd0f5"/><stop offset=".8" stop-color="#46bdee"/><stop offset="1" stop-color="#46bdee" stop-opacity="0"/></radialGradient><mask id="am"><rect width="941" height="1672" fill="#fff"/><circle cx="150" cy="455" r="44"/><circle cx="285" cy="455" r="44"/><circle cx="395" cy="472" r="44"/></mask></defs><g transform="translate(587 666) scale(1.12)"><ellipse cx="0" cy="26" rx="52" ry="13" fill="#1e5a1e" opacity=".35"/><circle cx="-26" cy="8" r="26" fill="#2f8a2a"/><circle cx="26" cy="8" r="26" fill="#2f8a2a"/><circle cx="0" cy="-6" r="32" fill="#3fa534"/><circle cx="-24" cy="4" r="20" fill="#49b53c"/><circle cx="24" cy="4" r="20" fill="#49b53c"/><circle cx="0" cy="-10" r="24" fill="#5cc944"/><circle cx="-8" cy="-20" r="11" fill="#86dc57" opacity=".85"/><circle cx="20" cy="-6" r="7" fill="#86dc57" opacity=".8"/><circle cx="-28" cy="2" r="6" fill="#86dc57" opacity=".7"/><circle cx="-26" cy="-4" r="4.5" fill="#ffe14d" stroke="#2f6a2a" stroke-width="1"/><circle cx="12" cy="-24" r="4.5" fill="#ff8fb1" stroke="#2f6a2a" stroke-width="1"/><circle cx="-6" cy="-28" r="4.5" fill="#ffffff" stroke="#2f6a2a" stroke-width="1"/><circle cx="28" cy="6" r="4.5" fill="#ffe14d" stroke="#2f6a2a" stroke-width="1"/></g><g transform="translate(710 692) scale(1.12)"><ellipse cx="0" cy="26" rx="52" ry="13" fill="#1e5a1e" opacity=".35"/><circle cx="-26" cy="8" r="26" fill="#2f8a2a"/><circle cx="26" cy="8" r="26" fill="#2f8a2a"/><circle cx="0" cy="-6" r="32" fill="#3fa534"/><circle cx="-24" cy="4" r="20" fill="#49b53c"/><circle cx="24" cy="4" r="20" fill="#49b53c"/><circle cx="0" cy="-10" r="24" fill="#5cc944"/><circle cx="-8" cy="-20" r="11" fill="#86dc57" opacity=".85"/><circle cx="20" cy="-6" r="7" fill="#86dc57" opacity=".8"/><circle cx="-28" cy="2" r="6" fill="#86dc57" opacity=".7"/><circle cx="-24" cy="-6" r="4.5" fill="#ff8fb1" stroke="#2f6a2a" stroke-width="1"/><circle cx="14" cy="-22" r="4.5" fill="#ffe14d" stroke="#2f6a2a" stroke-width="1"/><circle cx="26" cy="4" r="4.5" fill="#ffffff" stroke="#2f6a2a" stroke-width="1"/><circle cx="2" cy="-30" r="4.5" fill="#ff8fb1" stroke="#2f6a2a" stroke-width="1"/></g><g transform="translate(830 692) scale(1.12)"><ellipse cx="0" cy="26" rx="52" ry="13" fill="#1e5a1e" opacity=".35"/><circle cx="-26" cy="8" r="26" fill="#2f8a2a"/><circle cx="26" cy="8" r="26" fill="#2f8a2a"/><circle cx="0" cy="-6" r="32" fill="#3fa534"/><circle cx="-24" cy="4" r="20" fill="#49b53c"/><circle cx="24" cy="4" r="20" fill="#49b53c"/><circle cx="0" cy="-10" r="24" fill="#5cc944"/><circle cx="-8" cy="-20" r="11" fill="#86dc57" opacity=".85"/><circle cx="20" cy="-6" r="7" fill="#86dc57" opacity=".8"/><circle cx="-28" cy="2" r="6" fill="#86dc57" opacity=".7"/><circle cx="-26" cy="-4" r="4.5" fill="#ffe14d" stroke="#2f6a2a" stroke-width="1"/><circle cx="12" cy="-24" r="4.5" fill="#ff8fb1" stroke="#2f6a2a" stroke-width="1"/><circle cx="-6" cy="-28" r="4.5" fill="#ffffff" stroke="#2f6a2a" stroke-width="1"/><circle cx="28" cy="6" r="4.5" fill="#ffe14d" stroke="#2f6a2a" stroke-width="1"/></g><g transform="translate(176 992) scale(1.12)"><ellipse cx="0" cy="26" rx="52" ry="13" fill="#1e5a1e" opacity=".35"/><circle cx="-26" cy="8" r="26" fill="#2f8a2a"/><circle cx="26" cy="8" r="26" fill="#2f8a2a"/><circle cx="0" cy="-6" r="32" fill="#3fa534"/><circle cx="-24" cy="4" r="20" fill="#49b53c"/><circle cx="24" cy="4" r="20" fill="#49b53c"/><circle cx="0" cy="-10" r="24" fill="#5cc944"/><circle cx="-8" cy="-20" r="11" fill="#86dc57" opacity=".85"/><circle cx="20" cy="-6" r="7" fill="#86dc57" opacity=".8"/><circle cx="-28" cy="2" r="6" fill="#86dc57" opacity=".7"/><circle cx="-24" cy="-6" r="4.5" fill="#ff8fb1" stroke="#2f6a2a" stroke-width="1"/><circle cx="14" cy="-22" r="4.5" fill="#ffe14d" stroke="#2f6a2a" stroke-width="1"/><circle cx="26" cy="4" r="4.5" fill="#ffffff" stroke="#2f6a2a" stroke-width="1"/><circle cx="2" cy="-30" r="4.5" fill="#ff8fb1" stroke="#2f6a2a" stroke-width="1"/></g><g transform="translate(274 987) scale(1.12)"><ellipse cx="0" cy="26" rx="52" ry="13" fill="#1e5a1e" opacity=".35"/><circle cx="-26" cy="8" r="26" fill="#2f8a2a"/><circle cx="26" cy="8" r="26" fill="#2f8a2a"/><circle cx="0" cy="-6" r="32" fill="#3fa534"/><circle cx="-24" cy="4" r="20" fill="#49b53c"/><circle cx="24" cy="4" r="20" fill="#49b53c"/><circle cx="0" cy="-10" r="24" fill="#5cc944"/><circle cx="-8" cy="-20" r="11" fill="#86dc57" opacity=".85"/><circle cx="20" cy="-6" r="7" fill="#86dc57" opacity=".8"/><circle cx="-28" cy="2" r="6" fill="#86dc57" opacity=".7"/><circle cx="-26" cy="-4" r="4.5" fill="#ffe14d" stroke="#2f6a2a" stroke-width="1"/><circle cx="12" cy="-24" r="4.5" fill="#ff8fb1" stroke="#2f6a2a" stroke-width="1"/><circle cx="-6" cy="-28" r="4.5" fill="#ffffff" stroke="#2f6a2a" stroke-width="1"/><circle cx="28" cy="6" r="4.5" fill="#ffe14d" stroke="#2f6a2a" stroke-width="1"/></g><g transform="translate(376 986) scale(1.12)"><ellipse cx="0" cy="26" rx="52" ry="13" fill="#1e5a1e" opacity=".35"/><circle cx="-26" cy="8" r="26" fill="#2f8a2a"/><circle cx="26" cy="8" r="26" fill="#2f8a2a"/><circle cx="0" cy="-6" r="32" fill="#3fa534"/><circle cx="-24" cy="4" r="20" fill="#49b53c"/><circle cx="24" cy="4" r="20" fill="#49b53c"/><circle cx="0" cy="-10" r="24" fill="#5cc944"/><circle cx="-8" cy="-20" r="11" fill="#86dc57" opacity=".85"/><circle cx="20" cy="-6" r="7" fill="#86dc57" opacity=".8"/><circle cx="-28" cy="2" r="6" fill="#86dc57" opacity=".7"/><circle cx="-24" cy="-6" r="4.5" fill="#ff8fb1" stroke="#2f6a2a" stroke-width="1"/><circle cx="14" cy="-22" r="4.5" fill="#ffe14d" stroke="#2f6a2a" stroke-width="1"/><circle cx="26" cy="4" r="4.5" fill="#ffffff" stroke="#2f6a2a" stroke-width="1"/><circle cx="2" cy="-30" r="4.5" fill="#ff8fb1" stroke="#2f6a2a" stroke-width="1"/></g><g transform="translate(392 1409) scale(1.12)"><ellipse cx="0" cy="26" rx="52" ry="13" fill="#1e5a1e" opacity=".35"/><circle cx="-26" cy="8" r="26" fill="#2f8a2a"/><circle cx="26" cy="8" r="26" fill="#2f8a2a"/><circle cx="0" cy="-6" r="32" fill="#3fa534"/><circle cx="-24" cy="4" r="20" fill="#49b53c"/><circle cx="24" cy="4" r="20" fill="#49b53c"/><circle cx="0" cy="-10" r="24" fill="#5cc944"/><circle cx="-8" cy="-20" r="11" fill="#86dc57" opacity=".85"/><circle cx="20" cy="-6" r="7" fill="#86dc57" opacity=".8"/><circle cx="-28" cy="2" r="6" fill="#86dc57" opacity=".7"/><circle cx="-26" cy="-4" r="4.5" fill="#ffe14d" stroke="#2f6a2a" stroke-width="1"/><circle cx="12" cy="-24" r="4.5" fill="#ff8fb1" stroke="#2f6a2a" stroke-width="1"/><circle cx="-6" cy="-28" r="4.5" fill="#ffffff" stroke="#2f6a2a" stroke-width="1"/><circle cx="28" cy="6" r="4.5" fill="#ffe14d" stroke="#2f6a2a" stroke-width="1"/></g><g transform="translate(478 1415) scale(1.12)"><ellipse cx="0" cy="26" rx="52" ry="13" fill="#1e5a1e" opacity=".35"/><circle cx="-26" cy="8" r="26" fill="#2f8a2a"/><circle cx="26" cy="8" r="26" fill="#2f8a2a"/><circle cx="0" cy="-6" r="32" fill="#3fa534"/><circle cx="-24" cy="4" r="20" fill="#49b53c"/><circle cx="24" cy="4" r="20" fill="#49b53c"/><circle cx="0" cy="-10" r="24" fill="#5cc944"/><circle cx="-8" cy="-20" r="11" fill="#86dc57" opacity=".85"/><circle cx="20" cy="-6" r="7" fill="#86dc57" opacity=".8"/><circle cx="-28" cy="2" r="6" fill="#86dc57" opacity=".7"/><circle cx="-24" cy="-6" r="4.5" fill="#ff8fb1" stroke="#2f6a2a" stroke-width="1"/><circle cx="14" cy="-22" r="4.5" fill="#ffe14d" stroke="#2f6a2a" stroke-width="1"/><circle cx="26" cy="4" r="4.5" fill="#ffffff" stroke="#2f6a2a" stroke-width="1"/><circle cx="2" cy="-30" r="4.5" fill="#ff8fb1" stroke="#2f6a2a" stroke-width="1"/></g><g transform="translate(568 1414) scale(1.12)"><ellipse cx="0" cy="26" rx="52" ry="13" fill="#1e5a1e" opacity=".35"/><circle cx="-26" cy="8" r="26" fill="#2f8a2a"/><circle cx="26" cy="8" r="26" fill="#2f8a2a"/><circle cx="0" cy="-6" r="32" fill="#3fa534"/><circle cx="-24" cy="4" r="20" fill="#49b53c"/><circle cx="24" cy="4" r="20" fill="#49b53c"/><circle cx="0" cy="-10" r="24" fill="#5cc944"/><circle cx="-8" cy="-20" r="11" fill="#86dc57" opacity=".85"/><circle cx="20" cy="-6" r="7" fill="#86dc57" opacity=".8"/><circle cx="-28" cy="2" r="6" fill="#86dc57" opacity=".7"/><circle cx="-26" cy="-4" r="4.5" fill="#ffe14d" stroke="#2f6a2a" stroke-width="1"/><circle cx="12" cy="-24" r="4.5" fill="#ff8fb1" stroke="#2f6a2a" stroke-width="1"/><circle cx="-6" cy="-28" r="4.5" fill="#ffffff" stroke="#2f6a2a" stroke-width="1"/><circle cx="28" cy="6" r="4.5" fill="#ffe14d" stroke="#2f6a2a" stroke-width="1"/></g><g transform="translate(652 1103)"><ellipse cx="0" cy="0" rx="58" ry="48" fill="url(#aw)"/><ellipse cx="0" cy="4" rx="44" ry="30" fill="none" stroke="#bdeeff" stroke-width="2" opacity=".55"/><g transform="translate(0 6) scale(1 .66)"><path d="M-16.0 2.0 L8.1 11.7 A26 26 0 1 1 8.1 -7.7 Z" fill="#37b552" stroke="#1c6e33" stroke-width="2"/><path d="M-16.0 2.0 L-31.6 -5.8" stroke="#7bdc7a" stroke-width="1.5" opacity=".7"/></g><g transform="translate(0 6) scale(1 .66) rotate(200)"><path d="M18.0 8.0 L36.5 15.5 A20 20 0 1 1 36.5 0.5 Z" fill="#37b552" stroke="#1c6e33" stroke-width="2"/><path d="M18.0 8.0 L6.0 2.0" stroke="#7bdc7a" stroke-width="1.5" opacity=".7"/></g><g transform="translate(8 -6)"><path d="M-11 4 Q-13 -11 0 -15 Q13 -11 11 4 Q0 9 -11 4Z" fill="#ff8fb1" stroke="#c4527a" stroke-width="1.5"/><path d="M-5 4 Q-6 -9 0 -13 Q6 -9 5 4Z" fill="#ffc2d6"/><circle cx="0" cy="-3" r="3" fill="#ffe14d"/></g></g><g transform="translate(756 1109)"><ellipse cx="0" cy="0" rx="58" ry="48" fill="url(#aw)"/><ellipse cx="0" cy="4" rx="44" ry="30" fill="none" stroke="#bdeeff" stroke-width="2" opacity=".55"/><g transform="translate(0 6) scale(1 .66)"><path d="M-16.0 2.0 L8.1 11.7 A26 26 0 1 1 8.1 -7.7 Z" fill="#37b552" stroke="#1c6e33" stroke-width="2"/><path d="M-16.0 2.0 L-31.6 -5.8" stroke="#7bdc7a" stroke-width="1.5" opacity=".7"/></g><g transform="translate(0 6) scale(1 .66) rotate(150)"><path d="M18.0 8.0 L36.5 15.5 A20 20 0 1 1 36.5 0.5 Z" fill="#37b552" stroke="#1c6e33" stroke-width="2"/><path d="M18.0 8.0 L6.0 2.0" stroke="#7bdc7a" stroke-width="1.5" opacity=".7"/></g><g transform="translate(-6 -6)"><path d="M-11 4 Q-13 -11 0 -15 Q13 -11 11 4 Q0 9 -11 4Z" fill="#ff8fb1" stroke="#c4527a" stroke-width="1.5"/><path d="M-5 4 Q-6 -9 0 -13 Q6 -9 5 4Z" fill="#ffc2d6"/><circle cx="0" cy="-3" r="3" fill="#ffe14d"/></g></g><g transform="translate(850 1102)"><ellipse cx="0" cy="0" rx="58" ry="48" fill="url(#aw)"/><ellipse cx="0" cy="4" rx="44" ry="30" fill="none" stroke="#bdeeff" stroke-width="2" opacity=".55"/><g transform="translate(0 6) scale(1 .66)"><path d="M-16.0 2.0 L8.1 11.7 A26 26 0 1 1 8.1 -7.7 Z" fill="#37b552" stroke="#1c6e33" stroke-width="2"/><path d="M-16.0 2.0 L-31.6 -5.8" stroke="#7bdc7a" stroke-width="1.5" opacity=".7"/></g><g transform="translate(0 6) scale(1 .66) rotate(200)"><path d="M18.0 8.0 L36.5 15.5 A20 20 0 1 1 36.5 0.5 Z" fill="#37b552" stroke="#1c6e33" stroke-width="2"/><path d="M18.0 8.0 L6.0 2.0" stroke="#7bdc7a" stroke-width="1.5" opacity=".7"/></g><g transform="translate(8 -6)"><path d="M-11 4 Q-13 -11 0 -15 Q13 -11 11 4 Q0 9 -11 4Z" fill="#ff8fb1" stroke="#c4527a" stroke-width="1.5"/><path d="M-5 4 Q-6 -9 0 -13 Q6 -9 5 4Z" fill="#ffc2d6"/><circle cx="0" cy="-3" r="3" fill="#ffe14d"/></g></g><g mask="url(#am)" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M150 455 C159 454 182 452 205 452 C228 452 262 453 285 455 C308 457 322 459 340 462 C358 465 378 467 395 472 C412 477 427 479 440 490 C453 501 466 522 472 540 C478 558 468 586 478 600 C488 614 512 624 530 625 C548 626 570 615 585 605 C600 595 608 570 620 567 C632 564 648 579 660 585 C672 591 681 598 695 602 C709 606 729 609 745 610 C761 611 784 600 790 607 C796 614 793 640 778 650 C763 660 726 661 700 668 C674 675 647 684 620 690 C593 696 563 700 540 702 C517 704 497 697 480 703 C463 709 446 724 440 740 C434 756 452 784 445 800 C438 816 424 829 400 835 C376 841 331 832 300 835 C269 838 237 841 215 850 C193 859 166 880 168 887 C170 894 206 895 225 895 C244 895 266 888 285 887 C304 886 322 888 340 890 C358 892 377 898 395 901 C413 904 434 898 450 905 C466 912 478 928 490 940 C502 952 508 965 520 975 C532 985 542 993 560 1000 C578 1007 609 1014 629 1019 C649 1024 663 1030 680 1033 C697 1036 714 1036 731 1037 C748 1038 768 1040 785 1038 C802 1036 820 1021 834 1026 C848 1031 871 1054 872 1070 C873 1086 854 1106 840 1120 C826 1134 806 1142 790 1152 C774 1162 756 1167 745 1180 C734 1193 732 1213 725 1230 C718 1247 717 1261 705 1280 C693 1299 672 1334 655 1345 C638 1356 616 1347 600 1345 C584 1343 576 1335 562 1335 C548 1335 530 1345 515 1345 C500 1345 486 1338 472 1336 C458 1334 444 1331 430 1330 C416 1329 393 1328 386 1328" stroke="#14336b" strokeOpacity=".38" strokeWidth="13" strokeDasharray="11 25" transform="translate(0 3)"/><path d="M150 455 C159 454 182 452 205 452 C228 452 262 453 285 455 C308 457 322 459 340 462 C358 465 378 467 395 472 C412 477 427 479 440 490 C453 501 466 522 472 540 C478 558 468 586 478 600 C488 614 512 624 530 625 C548 626 570 615 585 605 C600 595 608 570 620 567 C632 564 648 579 660 585 C672 591 681 598 695 602 C709 606 729 609 745 610 C761 611 784 600 790 607 C796 614 793 640 778 650 C763 660 726 661 700 668 C674 675 647 684 620 690 C593 696 563 700 540 702 C517 704 497 697 480 703 C463 709 446 724 440 740 C434 756 452 784 445 800 C438 816 424 829 400 835 C376 841 331 832 300 835 C269 838 237 841 215 850 C193 859 166 880 168 887 C170 894 206 895 225 895 C244 895 266 888 285 887 C304 886 322 888 340 890 C358 892 377 898 395 901 C413 904 434 898 450 905 C466 912 478 928 490 940 C502 952 508 965 520 975 C532 985 542 993 560 1000 C578 1007 609 1014 629 1019 C649 1024 663 1030 680 1033 C697 1036 714 1036 731 1037 C748 1038 768 1040 785 1038 C802 1036 820 1021 834 1026 C848 1031 871 1054 872 1070 C873 1086 854 1106 840 1120 C826 1134 806 1142 790 1152 C774 1162 756 1167 745 1180 C734 1193 732 1213 725 1230 C718 1247 717 1261 705 1280 C693 1299 672 1334 655 1345 C638 1356 616 1347 600 1345 C584 1343 576 1335 562 1335 C548 1335 530 1345 515 1345 C500 1345 486 1338 472 1336 C458 1334 444 1331 430 1330 C416 1329 393 1328 386 1328" stroke="#ffffff" strokeWidth="10" strokeDasharray="11 25"/></g></svg>
        <button className="bt" style={{ position: 'absolute', ...a(3.2, 17.2, 7.6, 7.6) }} onClick={() => ke('beranda')} aria-label="Kembali"><Panah /></button>
        <img src={GAMBAR_BANNER} alt="Peta Petualangan - Jelajahi Dunia, Temukan Bentuknya!" draggable={false} style={{ position: 'absolute', ...m(131, 71, 232, 66), pointerEvents: 'none', filter: 'drop-shadow(0 .8cqw 1cqw rgba(18,60,120,.28))' }} />
        <button style={{ position: 'absolute', background: 'none', borderRadius: '50%', ...m(58, 218, 44, 44) }} onClick={() => g.mulaiLevel(1)} aria-label="Level 1" />
        {/* level 2 & 3 di pulau pertama: lencana biru muncul setelah level sebelumnya lolos (bintang ≥ 2) */}
        {([[2, 126, 216], [3, 185, 226]] as [number, number, number][]).map(([n, x, y]) => g.terbuka(n) && (
          <button key={n} className="nd b" style={{ position: 'absolute', ...m(x, y, 44, 44), zIndex: 3 }} onClick={() => g.mulaiLevel(n)} aria-label={'Level ' + n}><span>{n}</span></button>
        ))}
        {/* bintang hasil di atas lencana level yang sudah dimainkan */}
        {([[1, 58, 218], [2, 126, 216], [3, 185, 226]] as [number, number, number][]).map(([n, x, y]) => (
          g.kemajuan.main[n - 1] && g.terbuka(n) && ( // belum dimainkan → tanpa bintang
            <BintangLevel key={'bp' + n} n={n} dapat={g.kemajuan.bintang[n - 1] ?? 0} total={LEVEL[n - 1].soal.length} st={m(x + 22 - 30, y - 38, 60, 36)} />
          )
        ))}
        {/* nomor level 1-15: tiap pulau 3 level (lencana digambar di atas gambar peta) */}
        {([[4, 620, 573, 74], [5, 695, 608, 74], [6, 790, 613, 74], [7, 168, 893, 74], [8, 285, 893, 74], [9, 395, 907, 74], [10, 629, 1025, 74], [11, 731, 1043, 74], [12, 834, 1032, 74], [13, 562, 1341, 74], [14, 472, 1342, 74], [15, 386, 1334, 74]] as [number, number, number, number][]).map(([n, x, y, d]) => (
          <div key={n} className="nl" aria-label={'Level ' + n + ' terkunci'} style={{ left: (x - d / 2) / 9.41 + 'cqw', top: (y - d / 2 - (d > 70 ? 6 : 0)) / 9.41 + 'cqw', width: d / 9.41 + 'cqw', height: d / 9.41 + 'cqw' }}><Gm /><span>{n}</span></div>
        ))}
        <div className="kartu" style={{ position: 'absolute', ...m(12, 709, 139, 60), display: 'flex', alignItems: 'center', gap: '2cqw', padding: '0 2cqw', borderRadius: '3cqw' }}>
          <svg viewBox="0 0 40 36" style={{ width: '9cqw' }}><rect x="3" y="14" width="34" height="20" rx="3" fill="#2f8cf0" stroke="#12378a" strokeWidth="2" /><path d="M3 18 Q20 -4 37 18Z" fill="#4aa0ff" stroke="#12378a" strokeWidth="2" /><rect x="16" y="18" width="8" height="8" rx="2" fill="#ffc72a" /></svg>
          <div style={{ flex: 1, fontSize: '2.4cqw', lineHeight: 1.2 }}><b>Koleksi Bentuk</b><div style={{ height: '1.6cqw', background: '#d4e2f3', borderRadius: '1cqw', margin: '.6cqw 0' }}><i style={{ display: 'block', width: '33%', height: '100%', background: '#54c93a', borderRadius: '1cqw' }} /></div>8/24</div>
        </div>
      </>
    )
  }

  /* ---------- Detail Level, Jelajah, Kuis, Hasil ---------- */
  if (layar === 'detail') return <LayarDetail ke={ke} g={g} />
  if (layar === 'main') return <Jelajah g={g} ke={ke} />
  if (layar === 'soal') return <Kuis g={g} ke={ke} />
  return <LayarHasil g={g} ke={ke} />
}

/* ===== APLIKASI ===== */
function App() {
  const [tab, setTab] = useState('beranda')
  const [layar, setLayar] = useState('beranda')
  const [levelAktif, setLevelAktif] = useState(1)
  const [kemajuan, setKemajuan] = useState<Kemajuan>({ bintang: [0, 0, 0], koin: 0, main: [false, false, false] })
  const [hasil, setHasil] = useState<Hasil | null>(null)
  const [koinJelajah, setKoinJelajah] = useState(0)
  const [percobaan, setPercobaan] = useState(0)
  const [bunyi, setBunyi] = useState(suara.nyala())
  const ke = (l: string) => { setLayar(l); if (l === 'beranda' || l === 'peta') setTab(l) }

  /* browser baru mengizinkan suara setelah pemain menyentuh layar */
  useEffect(() => {
    const buka = () => { suara.buka() }
    window.addEventListener('pointerdown', buka)
    window.addEventListener('keydown', buka)
    return () => { window.removeEventListener('pointerdown', buka); window.removeEventListener('keydown', buka) }
  }, [])

  /* musik latar mengikuti layar */
  useEffect(() => {
    suara.musik(layar === 'main' ? 'seru' : layar === 'hasil' ? null : 'tenang')
  }, [layar])

  /* bunyi "klik" untuk semua tombol biasa (tombol kuis & kontrol punya bunyi sendiri) */
  const klikGlobal = (e: { target: EventTarget }) => {
    const b = (e.target as HTMLElement).closest?.('button')
    if (b && !b.disabled && !/\b(opsi|ubin-g|kontrol)\b/.test(b.className)) suara.main('klik')
  }

  /* kemajuan: level n terbuka jika level sebelumnya meraih bintang ≥ 2 */
  const g: Konteks = {
    lv: LEVEL[levelAktif - 1],
    kemajuan,
    hasil,
    koinJelajah,
    terbuka: (n) => n <= 1 || (kemajuan.bintang[n - 2] ?? 0) >= BINTANG_LOLOS,
    mulaiLevel: (n) => { setLevelAktif(n); setLayar('detail') },
    mulaiJelajah: () => { setPercobaan((p) => p + 1); setLayar('main') },
    selesaiJelajah: (koin) => {
      setKemajuan((k) => ({ ...k, koin: k.koin + koin }))
      setKoinJelajah(koin)
      setPercobaan((p) => p + 1)
      setLayar('soal')
    },
    selesaiKuis: (h) => {
      setKemajuan((k) => {
        const bintang = [...k.bintang]
        const main = [...k.main]
        bintang[h.level - 1] = Math.max(bintang[h.level - 1], h.bintang)
        main[h.level - 1] = true
        return { ...k, bintang, main }
      })
      setHasil(h)
      setLayar('hasil')
    },
    ulangKuis: () => { setPercobaan((p) => p + 1); setLayar('soal') },
  }
 
  return (
    <section id="center" className="layar" onClickCapture={klikGlobal}>
      <style>{gaya + gayaPeta + gayaGame}</style>
      {layar === 'beranda' ? <Latar /> : <Alur key={layar + '-' + levelAktif + '-' + percobaan} layar={layar} ke={ke} g={g} />}
 
      {(layar === 'beranda' || layar === 'peta') && (<>
      {/* bar atas */}
      <header className="bar-atas">
        <div className={layar === 'peta' ? 'profil panel-gelap profil-mini' : 'profil panel-gelap'}>
          <svg className="avatar" viewBox="0 0 48 48" aria-hidden="true">
            <circle cx="24" cy="24" r="24" fill="#7fd6a6" />
            <path d="M6 46 Q24 28 42 46Z" fill="#2f6fd6" />
            <circle cx="24" cy="25" r="12" fill="#ffd2a6" />
            <path d="M11 25 Q9 7 24 7 Q39 7 37 25 Q33 14 24 15.5 Q15 14 11 25Z" fill="#14141f" />
            <ellipse cx="19.5" cy="26" rx="1.7" ry="2.1" fill="#222" />
            <ellipse cx="28.5" cy="26" rx="1.7" ry="2.1" fill="#222" />
            <circle cx="16" cy="30" r="2.2" fill="#ff9d8a" opacity=".6" />
            <circle cx="32" cy="30" r="2.2" fill="#ff9d8a" opacity=".6" />
            <path d="M19.5 31 Q24 35.5 28.5 31Z" fill="#fff" stroke="#b5503a" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          <div className="profil-info">
            <small>Siswa</small>
            <strong>{layar === 'beranda' ? 'CICINANA' : 'CICINANA'}</strong>
            <div className="xp"><span style={{ width: '62%' }} /></div>
            <small>Level 3</small>
          </div>
        </div>
 
        <div className="mata-uang bintang panel-gelap">
          <svg viewBox="0 0 24 24" className="koin" aria-hidden="true">
            <defs><linearGradient id="gBintang" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe066" /><stop offset="1" stopColor="#ffa800" /></linearGradient></defs>
            <path d="M12 1.8 L15.2 8.6 L22.4 9.4 L17 14.4 L18.6 21.7 L12 18 L5.4 21.7 L7 14.4 L1.6 9.4 L8.8 8.6Z" fill="url(#gBintang)" stroke="#d98a00" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M12 5.5 L13.4 9.4 L9 10.2Z" fill="#fff" opacity=".55" />
          </svg>
          <b>{120 + jumlahBintang(kemajuan)}</b>
          <button className="tambah" aria-label="Tambah bintang" />
        </div>
 
        <div className="mata-uang panel-gelap">
          <svg viewBox="0 0 24 24" className="koin" aria-hidden="true">
            <defs><linearGradient id="gPermata" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7be4ff" /><stop offset="1" stopColor="#1ea0e6" /></linearGradient></defs>
            <path d="M7 3 H17 L22 9 L12 22 L2 9Z" fill="url(#gPermata)" stroke="#1473b8" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M2 9 H22 M9 3 L12 9 L15 3 M12 9 V22 M7 3 L9 9 L12 22 M17 3 L15 9 L12 22" stroke="#d6f6ff" strokeWidth=".9" fill="none" opacity=".8" strokeLinejoin="round" />
          </svg>
          <b>45</b>
          <button className="tambah" aria-label="Tambah permata" />
        </div>
 
        <button className="pengaturan panel-gelap" aria-label={bunyi ? 'Matikan suara' : 'Nyalakan suara'} aria-pressed={bunyi}
          onClick={() => { const b = !bunyi; suara.atur(b); setBunyi(b); if (b) suara.main('klik') }}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 9 H7 L12 4.5 V19.5 L7 15 H3Z" fill="#fff" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
            {bunyi ? (
              <g fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                <path d="M15.5 9 Q17.5 12 15.5 15" />
                <path d="M18.5 6.5 Q22 12 18.5 17.5" />
              </g>
            ) : (
              <path d="M15.5 9.5 L21.5 14.5 M21.5 9.5 L15.5 14.5" stroke="#ff8a8a" strokeWidth="2.2" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </header>
 
      {(<button className={layar === 'peta' ? 'misi misi-mini' : 'misi'}>
        <svg className="misi-ikon" viewBox="0 0 32 40" aria-hidden="true">
          <rect x="2" y="6" width="28" height="32" rx="5" fill="#3d8ff0" stroke="#1e68c2" strokeWidth="1.5" />
          <rect x="6" y="11" width="20" height="23" rx="2.5" fill="#eaf4ff" />
          <rect x="10" y="2" width="12" height="7" rx="2.5" fill="#f4b73a" stroke="#c98a14" strokeWidth="1.2" />
          <path d="M9 17 H23 M9 22 H23 M9 27 H20" stroke="#3d8ff0" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        <div className="misi-teks">
          <b>Misi Hari Ini</b>
          <span>Selesaikan 3 level dengan nilai sempurna</span>
          <div className="misi-progres">
            <div className="bar"><i style={{ width: '33%' }} /></div>
            <em>1/3</em>
          </div>
        </div>
        <svg className="panah" viewBox="0 0 10 14" aria-hidden="true">
          <path d="M2 2 L8 7 L2 12" stroke="#2d4f8c" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>)}
      </>)}
 
      {layar === 'beranda' && (<>
      <Logo />
 
      <div className="aksi">
        <Tombol onClick={() => ke('peta')} />
      </div>
 
      {/* adegan */}
      <Papan />
      <Maskot />
      <Musuh />
 
      </>)}
 
      {/* navigasi bawah */}
      {['beranda', 'peta'].includes(layar) && (<nav className="navigasi">
        {menu.map((m) => (
          <button key={m.id} className={tab === m.id ? 'aktif' : ''} onClick={() => { if (m.id === 'beranda' || m.id === 'peta') ke(m.id); else setTab(m.id) }}>
            <svg
              viewBox="0 0 24 24"
              fill={tab === m.id && m.id === 'beranda' ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinejoin="round"
              strokeLinecap="round"
            >
              {m.ikon}
            </svg>
            <span>{m.label}</span>
          </button>
        ))}
      </nav>)}
    </section>
  )
}
 
export default App

/* ===== GAMBAR (tertanam, tidak perlu folder public) ===== */
const LATAR_PETA = 'data:image/webp;base64,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'
const GAMBAR_BANNER = 'data:image/webp;base64,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'