/* ============================================================
   SKY HOPPER — script.js  (v2 — bugfix release)
   Mecânica inspirada em Flappy Bird, visual original.
   ============================================================ */

'use strict';

// ── roundRect polyfill (Safari < 16, navegadores móveis antigos) ──
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (typeof r === 'number') r = [r, r, r, r];
    else if (Array.isArray(r)) {
      if (r.length === 1) r = [r[0], r[0], r[0], r[0]];
      else if (r.length === 2) r = [r[0], r[1], r[0], r[1]];
      else if (r.length === 3) r = [r[0], r[1], r[2], r[1]];
    } else {
      r = [0, 0, 0, 0];
    }
    const [tl, tr, br, bl] = r;
    this.moveTo(x + tl, y);
    this.lineTo(x + w - tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + tr);
    this.lineTo(x + w, y + h - br);
    this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    this.lineTo(x + bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - bl);
    this.lineTo(x, y + tl);
    this.quadraticCurveTo(x, y, x + tl, y);
    return this;
  };
}

// ── DOM refs ─────────────────────────────────────────────────
const screenStart    = document.getElementById('screen-start');
const screenGame     = document.getElementById('screen-game');
const screenGameover = document.getElementById('screen-gameover');
const canvas         = document.getElementById('gameCanvas');
const ctx            = canvas.getContext('2d');
const scoreDisplay   = document.getElementById('score-display');
const finalScore     = document.getElementById('final-score');
const bestScore      = document.getElementById('best-score');
const startBest      = document.getElementById('start-best');
const pauseOverlay   = document.getElementById('pause-overlay');
const btnStart       = document.getElementById('btn-start');
const btnPause       = document.getElementById('btn-pause');
const btnResume      = document.getElementById('btn-resume');
const btnQuit        = document.getElementById('btn-quit');
const btnRestart     = document.getElementById('btn-restart');
const btnMenu        = document.getElementById('btn-menu');

// ── Constants ─────────────────────────────────────────────────
const GRAVITY      = 0.42;
const JUMP_FORCE   = -8.2;
const BASE_SPEED   = 3.0;
const MAX_SPEED    = 6.0;
const GAP          = 190;
const PILLAR_W     = 64;
const PILLAR_MIN_H = 70;
const SPAWN_DIST   = 290;
const SPEED_INC    = 0.0006;
const ROCKET_W     = 46;
const ROCKET_H     = 34;
const GROUND_H     = 42;

// ── Audio (Web Audio API) ─────────────────────────────────────
let audioCtx = null;
function ensureAudio() {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  } catch (e) {}
  return audioCtx;
}
function playTone(freq, type, duration, gainVal, delay) {
  try {
    const ac = ensureAudio();
    if (!ac) return;
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = type;
    const t0 = ac.currentTime + (delay || 0);
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(gainVal, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.start(t0);
    osc.stop(t0 + duration);
  } catch (e) {}
}
function sfxJump()  { playTone(520, 'sine', 0.10, 0.25); }
function sfxPoint() {
  playTone(660, 'sine', 0.08, 0.28);
  playTone(880, 'sine', 0.08, 0.28, 0.09);
}
function sfxDie() {
  playTone(220, 'sawtooth', 0.18, 0.35);
  playTone(140, 'sawtooth', 0.18, 0.35, 0.15);
}

// ── State ─────────────────────────────────────────────────────
let gameState  = 'idle';
let score      = 0;
let best       = 0;
try { best = parseInt(localStorage.getItem('skyhopper_best') || '0', 10) || 0; } catch (e) {}
let speed      = BASE_SPEED;
let frames     = 0;
let particles  = [];
let starLayers = [];
let rafId      = null;
let deadTimer  = null;

let rocketX, rocketY, rocketVY, rocketAngle;
let thrustFrames = 0;
let pillars = [];

// ── Resize ───────────────────────────────────────────────────
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width  = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function viewW() { return window.innerWidth;  }
function viewH() { return window.innerHeight; }

window.addEventListener('resize', () => { resize(); });
resize();

// ── Stars (parallax) ─────────────────────────────────────────
function buildStars() {
  starLayers = [
    { speed: 0.25, stars: makeStars(70, 0.5, 1.1) },
    { speed: 0.60, stars: makeStars(45, 0.9, 1.7) },
    { speed: 1.15, stars: makeStars(22, 1.4, 2.4) },
  ];
}
function makeStars(count, minR, maxR) {
  const arr = [];
  const w = viewW(), h = viewH();
  for (let i = 0; i < count; i++) {
    arr.push({
      x: Math.random() * (w + 200),
      y: Math.random() * h,
      r: minR + Math.random() * (maxR - minR),
      brightness: 0.4 + Math.random() * 0.6,
    });
  }
  return arr;
}

// ── Pillars ──────────────────────────────────────────────────
function spawnPillar(x) {
  const maxTop = viewH() - GAP - PILLAR_MIN_H - GROUND_H - 20;
  const topH   = PILLAR_MIN_H + Math.random() * Math.max(40, maxTop - PILLAR_MIN_H);
  pillars.push({ x, topH, scored: false });
}

// ── Particles ────────────────────────────────────────────────
function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd   = 1.5 + Math.random() * 4.5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 1,
      decay: 0.025 + Math.random() * 0.035,
      r: 3 + Math.random() * 4,
      color,
    });
  }
}

// ── Init / Reset ─────────────────────────────────────────────
function initGame() {
  resize();
  score        = 0;
  speed        = BASE_SPEED;
  frames       = 0;
  pillars      = [];
  particles    = [];
  thrustFrames = 0;
  rocketX      = viewW() * 0.24;
  rocketY      = viewH() * 0.42;
  rocketVY     = 0;
  rocketAngle  = 0;
  spawnPillar(viewW() + 120);
  buildStars();
  scoreDisplay.textContent = '0';
  pauseOverlay.classList.add('hidden');
  gameState = 'running';
}

// ── Input ────────────────────────────────────────────────────
function jump() {
  if (gameState !== 'running') return;
  rocketVY     = JUMP_FORCE;
  thrustFrames = 8;
  sfxJump();
}

document.addEventListener('keydown', e => {
  if (gameState !== 'running' && gameState !== 'paused') return;
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    jump();
  } else if (e.code === 'Escape' || e.code === 'KeyP') {
    e.preventDefault();
    togglePause();
  }
});

canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  jump();
}, { passive: false });

// ── Pause ────────────────────────────────────────────────────
function togglePause() {
  if (gameState === 'running') {
    gameState = 'paused';
    pauseOverlay.classList.remove('hidden');
    cancelLoop();
  } else if (gameState === 'paused') {
    gameState = 'running';
    pauseOverlay.classList.add('hidden');
    startLoop();
  }
}
btnPause.addEventListener('click',  e => { e.stopPropagation(); togglePause(); });
btnResume.addEventListener('click', e => { e.stopPropagation(); togglePause(); });
btnQuit.addEventListener('click',   e => { e.stopPropagation(); goToMenu(); });

// ── Screen transitions ───────────────────────────────────────
function showScreen(id) {
  [screenStart, screenGame, screenGameover].forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function startGame() {
  ensureAudio();
  cancelLoop();
  clearTimeout(deadTimer);
  showScreen('screen-game');
  initGame();
  startLoop();
}
function goToMenu() {
  cancelLoop();
  clearTimeout(deadTimer);
  gameState = 'idle';
  particles = [];
  pauseOverlay.classList.add('hidden');
  startBest.textContent = 'Melhor: ' + best;
  showScreen('screen-start');
}
function showGameover() {
  finalScore.textContent = score;
  bestScore.textContent  = best;
  gameState = 'gameover';
  showScreen('screen-gameover');
}

btnStart.addEventListener('click',   e => { e.stopPropagation(); startGame(); });
btnRestart.addEventListener('click', e => { e.stopPropagation(); startGame(); });
btnMenu.addEventListener('click',    e => { e.stopPropagation(); goToMenu(); });

document.addEventListener('keydown', e => {
  if ((gameState === 'idle' || gameState === 'gameover') &&
      (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp')) {
    e.preventDefault();
    startGame();
  }
});

// ── Collision ────────────────────────────────────────────────
function rocketHitbox() {
  const pad = 7;
  return {
    x: rocketX - ROCKET_W / 2 + pad,
    y: rocketY - ROCKET_H / 2 + pad,
    w: ROCKET_W - pad * 2,
    h: ROCKET_H - pad * 2,
  };
}
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// ── Drawing ──────────────────────────────────────────────────
function drawBackground() {
  const h = viewH();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#07071a');
  grad.addColorStop(1, '#0f0f2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW(), h);
}

function drawStars() {
  const w = viewW();
  starLayers.forEach(layer => {
    layer.stars.forEach(s => {
      const twinkle = 0.7 + 0.3 * Math.sin(frames * 0.05 + s.x);
      ctx.save();
      ctx.globalAlpha = s.brightness * twinkle;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (gameState === 'running') {
        s.x -= layer.speed;
        if (s.x < -4) s.x = w + 4;
      }
    });
  });
}

function drawGround() {
  const w  = viewW();
  const gy = viewH() - GROUND_H;
  const grad = ctx.createLinearGradient(0, gy, 0, viewH());
  grad.addColorStop(0, '#1a1a3a');
  grad.addColorStop(1, '#0a0a1a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, gy, w, GROUND_H);

  ctx.strokeStyle = '#7f5af0';
  ctx.lineWidth   = 2;
  ctx.shadowColor = '#7f5af0';
  ctx.shadowBlur  = 8;
  ctx.beginPath();
  ctx.moveTo(0, gy);
  ctx.lineTo(w, gy);
  ctx.stroke();
  ctx.shadowBlur = 0;

  const dashOffset = (frames * 2) % 32;
  ctx.fillStyle = 'rgba(127, 90, 240, 0.45)';
  for (let x = -dashOffset; x < w; x += 32) {
    ctx.fillRect(x, gy + 6, 16, 2);
  }
}

function drawPillar(p) {
  const botY  = p.topH + GAP;
  const botH  = viewH() - GROUND_H - botY;
  const cx    = p.x + PILLAR_W / 2;

  const hue  = (160 + score * 4) % 360;
  const col1 = 'hsl(' + hue + ', 80%, 55%)';
  const col2 = 'hsl(' + ((hue + 40) % 360) + ', 90%, 35%)';
  const glow = 'hsl(' + hue + ', 100%, 65%)';

  ctx.shadowColor = glow;
  ctx.shadowBlur  = 14;

  const tg = ctx.createLinearGradient(p.x, 0, p.x + PILLAR_W, 0);
  tg.addColorStop(0, col2);
  tg.addColorStop(0.4, col1);
  tg.addColorStop(1, col2);
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.roundRect(p.x, 0, PILLAR_W, p.topH, [0, 0, 8, 8]);
  ctx.fill();

  ctx.fillStyle = col1;
  ctx.beginPath();
  ctx.moveTo(cx,                   p.topH + 18);
  ctx.lineTo(p.x + 4,              p.topH);
  ctx.lineTo(p.x,                  p.topH - 8);
  ctx.lineTo(cx,                   p.topH - 24);
  ctx.lineTo(p.x + PILLAR_W,       p.topH - 8);
  ctx.lineTo(p.x + PILLAR_W - 4,   p.topH);
  ctx.closePath();
  ctx.fill();

  const bg = ctx.createLinearGradient(p.x, 0, p.x + PILLAR_W, 0);
  bg.addColorStop(0, col2);
  bg.addColorStop(0.4, col1);
  bg.addColorStop(1, col2);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(p.x, botY, PILLAR_W, Math.max(0, botH), [8, 8, 0, 0]);
  ctx.fill();

  ctx.fillStyle = col1;
  ctx.beginPath();
  ctx.moveTo(cx,                 botY - 18);
  ctx.lineTo(p.x + 4,            botY);
  ctx.lineTo(p.x,                botY + 8);
  ctx.lineTo(cx,                 botY + 24);
  ctx.lineTo(p.x + PILLAR_W,     botY + 8);
  ctx.lineTo(p.x + PILLAR_W - 4, botY);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
}

function drawRocket() {
  ctx.save();
  ctx.translate(rocketX, rocketY);

  const targetAngle = Math.max(-0.5, Math.min(1.1, rocketVY * 0.065));
  rocketAngle += (targetAngle - rocketAngle) * 0.18;
  ctx.rotate(rocketAngle);

  const hw = ROCKET_W / 2;
  const hh = ROCKET_H / 2;

  if (thrustFrames > 0) {
    const flameLen = 18 + Math.random() * 14;
    const flameGrad = ctx.createLinearGradient(-hw - flameLen, 0, -hw, 0);
    flameGrad.addColorStop(0,   'rgba(255,200,50,0)');
    flameGrad.addColorStop(0.4, 'rgba(255,120,20,0.9)');
    flameGrad.addColorStop(1,   'rgba(255,220,80,1)');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.ellipse(-hw - flameLen * 0.5, 0, flameLen * 0.5, hh * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    thrustFrames--;
  } else {
    ctx.fillStyle = 'rgba(255,160,30,0.5)';
    ctx.beginPath();
    ctx.ellipse(-hw - 5, 0, 7, hh * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const bodyGrad = ctx.createLinearGradient(-hw, -hh, hw, hh);
  bodyGrad.addColorStop(0,   '#c0c8e0');
  bodyGrad.addColorStop(0.5, '#7f5af0');
  bodyGrad.addColorStop(1,   '#3a2070');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f7c948';
  ctx.beginPath();
  ctx.moveTo(hw,        0);
  ctx.lineTo(hw - 10,  -hh * 0.6);
  ctx.lineTo(hw + 14,   0);
  ctx.lineTo(hw - 10,   hh * 0.6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#a0e8ff';
  ctx.shadowColor = '#a0e8ff';
  ctx.shadowBlur  = 8;
  ctx.beginPath();
  ctx.arc(4, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#5a2eb0';
  ctx.beginPath();
  ctx.moveTo(-hw + 4,  -hh * 0.3);
  ctx.lineTo(-hw - 8,  -hh - 2);
  ctx.lineTo(-hw + 14, -hh * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-hw + 4,   hh * 0.3);
  ctx.lineTo(-hw - 8,   hh + 2);
  ctx.lineTo(-hw + 14,  hh * 0.1);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle   = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.r * p.life), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ── Main update ─────────────────────────────────────────────
function update() {
  frames++;
  speed = Math.min(MAX_SPEED, speed + SPEED_INC);

  rocketVY += GRAVITY;
  rocketY  += rocketVY;

  if (rocketY - ROCKET_H / 2 < 0) {
    rocketY  = ROCKET_H / 2;
    rocketVY = Math.abs(rocketVY) * 0.4;
  }

  const groundY = viewH() - GROUND_H;
  if (rocketY + ROCKET_H / 2 >= groundY) {
    rocketY = groundY - ROCKET_H / 2;
    triggerDeath();
    return;
  }

  for (let i = pillars.length - 1; i >= 0; i--) {
    const p = pillars[i];
    p.x -= speed;

    if (!p.scored && p.x + PILLAR_W < rocketX - ROCKET_W / 2) {
      p.scored = true;
      score++;
      scoreDisplay.textContent = score;
      if (score > best) {
        best = score;
        try { localStorage.setItem('skyhopper_best', String(best)); } catch (e) {}
      }
      sfxPoint();
      spawnParticles(rocketX + 20, rocketY, '#f7c948', 12);
    }

    if (p.x + PILLAR_W < -10) pillars.splice(i, 1);
  }

  const last = pillars[pillars.length - 1];
  if (!last || last.x <= viewW() - SPAWN_DIST) {
    spawnPillar(viewW() + PILLAR_W);
  }

  const hb = rocketHitbox();
  for (const p of pillars) {
    const topRect = { x: p.x, y: 0,              w: PILLAR_W, h: p.topH };
    const botRect = { x: p.x, y: p.topH + GAP,   w: PILLAR_W, h: viewH() };
    if (rectsOverlap(hb, topRect) || rectsOverlap(hb, botRect)) {
      triggerDeath();
      return;
    }
  }

  updateParticles();
}

function triggerDeath() {
  if (gameState !== 'running') return;
  sfxDie();
  spawnParticles(rocketX, rocketY, '#ff6b6b', 22);
  spawnParticles(rocketX, rocketY, '#f7c948', 14);
  gameState = 'dead';
  clearTimeout(deadTimer);
  deadTimer = setTimeout(() => {
    if (gameState === 'dead') showGameover();
  }, 700);
}

function render() {
  drawBackground();
  drawStars();
  pillars.forEach(drawPillar);
  drawGround();
  drawRocket();
  drawParticles();
}

// ── Loop (single-instance) ──────────────────────────────────
function startLoop() {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(tick);
}
function cancelLoop() {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
}
function tick() {
  rafId = null;
  if (gameState === 'running') {
    update();
    render();
    rafId = requestAnimationFrame(tick);
  } else if (gameState === 'dead') {
    drawBackground();
    drawStars();
    pillars.forEach(drawPillar);
    drawGround();
    drawRocket();
    drawParticles();
    updateParticles();
    rafId = requestAnimationFrame(tick);
  }
}

// ── Boot ────────────────────────────────────────────────────
startBest.textContent = 'Melhor: ' + best;
showScreen('screen-start');
