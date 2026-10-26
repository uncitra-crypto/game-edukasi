import { useState, type ReactNode } from 'react'

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
  .maskot, .mata-kedip, .pupil, .tangan-kanan, .tangan-kiri, .ransel-ayun { animation: none; }
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
  return (
    <svg viewBox="0 0 176 208" className="maskot" aria-label="Maskot segitiga berpetualang">
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

/* ===== APLIKASI ===== */
function App() {
  const [tab, setTab] = useState('beranda')

  return (
    <section id="center" className="layar">
      <style>{gaya}</style>
      <Latar />

      {/* bar atas */}
      <header className="bar-atas">
        <div className="profil panel-gelap">
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
            <strong>Citra</strong>
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
          <b>120</b>
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

        <button className="pengaturan panel-gelap" aria-label="Pengaturan">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <g fill="#fff">
              <circle cx="12" cy="12" r="7.2" />
              {[0, 45, 90, 135].map((r) => (
                <rect key={r} x="9.8" y="1.4" width="4.4" height="21.2" rx="1.3" transform={`rotate(${r} 12 12)`} />
              ))}
            </g>
            <circle cx="12" cy="12" r="3.4" fill="#0f3170" />
          </svg>
        </button>
      </header>

      {/* misi */}
      <button className="misi">
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
      </button>

      <Logo />

      <div className="aksi">
        <Tombol onClick={() => alert('Petualangan dimulai!')} />
      </div>

      {/* adegan */}
      <Papan />
      <Maskot />
      <Musuh />

      {/* navigasi bawah */}
      <nav className="navigasi">
        {menu.map((m) => (
          <button key={m.id} className={tab === m.id ? 'aktif' : ''} onClick={() => setTab(m.id)}>
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
      </nav>
    </section>
  )
}

export default App