/* ============================================================
   SKY HOPPER — script.js
   Inspired by Flappy Bird mechanics, original visual design.
   ============================================================ */

'use strict';

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
const GRAVITY       = 0.45;
const JUMP_FORCE    = -8.5;
const BASE_SPEED    = 3.2;
const GAP           = 180;          // vertical gap between pillars
const PILLAR_W      = 60;
const PILLAR_MIN_H  = 60;
const SPAWN_DIST    = 280;          // horizontal distance between pillar pairs
const SPEED_INC     = 0.0008;       // speed increase per frame
const ROCKET_W      = 44;
const ROCKET_H      = 32;

// ── Audio (Web Audio API) ─────────────────────────────────────
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq, type, duration, gainVal, delay) {
  try {
    const ac   = getAudio();
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type      = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime + (delay || 0));
    gain.gain.setValueAtTime(gainVal, ac.currentTime + (delay || 0));
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + (delay || 0) + duration);
    osc.start(ac.currentTime + (delay || 0));
    osc.stop(ac.currentTime  + (delay || 0) + duration);
  } catch(e) {}
}
function sfxJump()  { playTone(520, 'sine',     0.12, 0.3); }
function sfxPoint() {
  playTone(660, 'sine', 0.08, 0.3);
  playTone(880, 'sine', 0.08, 0.3, 0.09);
}
function sfxDie() {
  playTone(220, 'sawtooth', 0.18, 0.4);
  playTone(140, 'sawtooth', 0.18, 0.4, 0.15);
}

// ── State ─────────────────────────────────────────────────────
let gameState   = 'idle'; // idle | running | paused | dead
let score       = 0;
let best        = parseInt(localStorage.getItem('skyhopper_best') || '0', 10);
let speed       = BASE_SPEED;
let frames      = 0;
let particles   = [];
let stars       = [];
let starLayers  = [];

// Rocket
let rocketX, rocketY, rocketVY, rocketAngle;
let thrustFrames = 0;

// Pillars
let pillars = [];
let nextSpawnX = 0;

// ── Resize canvas to fill the screen ──────────────────────────
function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', () => { resize(); if (gameState === 'idle' || gameState === 'dead') {} });
resize();

// ── Star layers for parallax ───────────────────────────────────
function buildStars() {
  starLayers = [
    { speed: 0.2, stars: makeStars(60,  0.6, 1.2) },
    { speed: 0.5, stars: makeStars(40,  1.0, 1.8) },
    { speed: 1.0, stars: makeStars(20,  1.5, 2.5) },
  ];
}
function makeStars(count, minR, maxR) {
  const arr = [];
  for (let i = 0; i < count; i++) {
    arr.push({
      x: Math.random() * (canvas.width  + 200),
      y: Math.random() * canvas.height,
      r: minR + Math.random() * (maxR - minR),
      brightness: 0.4 + Math.random() * 0.6,
    });
  }
  return arr;
}

// ── Pillar helpers ─────────────────────────────────────────────
function spawnPillar(x) {
  const maxTop = canvas.height - GAP - PILLAR_MIN_H - 60;
  const topH   = PILLAR_MIN_H + Math.random() * (maxTop - PILLAR_MIN_H);
  pillars.push({ x, topH, scored: false });
}

// ── Particle helpers ───────────────────────────────────────────
function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd   = 2 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 1,
      decay: 0.03 + Math.random() * 0.04,
      r: 3 + Math.random() * 4,
      color,
    });
  }
}

// ── Init / Reset ───────────────────────────────────────────────
function initGame() {
  resize();
  score        = 0;
  speed        = BASE_SPEED;
  frames       = 0;
  pillars      = [];
  particles    = [];
  thrustFrames = 0;

  rocketX    = canvas.width  * 0.22;
  rocketY    = canvas.height * 0.45;
  rocketVY   = 0;
  rocketAngle = 0;

  // First pillar a bit away so player has time to react
  nextSpawnX = canvas.width + 80;
  spawnPillar(nextSpawnX);
  nextSpawnX += SPAWN_DIST;

  buildStars();
  scoreDisplay.textContent = '0';
  pauseOverlay.classList.add('hidden');
  gameState = 'running';
}

// ── Input ──────────────────────────────────────────────────────
function jump() {
  if (gameState !== 'running') return;
  rocketVY   = JUMP_FORCE;
  thrustFrames = 8;
  sfxJump();
}

document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    jump();
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
});

canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  jump();
}, { passive: false });

// ── Pause ──────────────────────────────────────────────────────
function togglePause() {
  if (gameState === 'running') {
    gameState = 'paused';
    pauseOverlay.classList.remove('hidden');
  } else if (gameState === 'paused') {
    gameState = 'running';
    pauseOverlay.classList.add('hidden');
    requestAnimationFrame(loop);
  }
}
btnPause.addEventListener('click',  e => { e.stopPropagation(); togglePause(); });
btnResume.addEventListener('click', () => togglePause());
btnQuit.addEventListener('click',   () => { showMenu(); });

// ── Screen transitions ─────────────────────────────────────────
function showScreen(id) {
  [screenStart, screenGame, screenGameover].forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function showMenu() {
  gameState = 'idle';
  startBest.textContent = 'Melhor: ' + best;
  showScreen('screen-start');
}
function showGameover() {
  finalScore.textContent = score;
  bestScore.textContent  = best;
  showScreen('screen-gameover');
}

btnStart.addEventListener('click',   () => { showScreen('screen-game'); initGame(); loop(); });
btnRestart.addEventListener('click', () => { showScreen('screen-game'); initGame(); loop(); });
btnMenu.addEventListener('click',    () => showMenu());

// ── Collision helper ───────────────────────────────────────────
// Uses a slightly-shrunk hitbox for fairness
function rocketHitbox() {
  const pad = 6;
  return {
    x: rocketX - ROCKET_W / 2 + pad,
    y: rocketY - ROCKET_H / 2 + pad,
    w: ROCKET_W - pad * 2,
    h: ROCKET_H - pad * 2,
  };
}
function rectsOverlap(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

// ── Drawing helpers ────────────────────────────────────────────
function drawBackground() {
  // Deep space gradient
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#07071a');
  grad.addColorStop(1, '#0f0f2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawStars() {
  starLayers.forEach(layer => {
    layer.stars.forEach(s => {
      // Twinkle
      const twinkle = 0.7 + 0.3 * Math.sin(frames * 0.05 + s.x);
      ctx.save();
      ctx.globalAlpha = s.brightness * twinkle;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Scroll star left
      if (gameState === 'running') {
        s.x -= layer.speed;
        if (s.x < -4) s.x = canvas.width + 4;
      }
    });
  });
}

function drawGround() {
  const gh = 40;
  const gy = canvas.height - gh;
  const grad = ctx.createLinearGradient(0, gy, 0, canvas.height);
  grad.addColorStop(0, '#1a1a3a');
  grad.addColorStop(1, '#0a0a1a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, gy, canvas.width, gh);

  // Glowing line at top of ground
  ctx.strokeStyle = '#7f5af0';
  ctx.lineWidth   = 2;
  ctx.shadowColor = '#7f5af0';
  ctx.shadowBlur  = 8;
  ctx.beginPath();
  ctx.moveTo(0, gy);
  ctx.lineTo(canvas.width, gy);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawPillar(p) {
  const botY  = p.topH + GAP;
  const botH  = canvas.height - 40 - botY;
  const cx    = p.x + PILLAR_W / 2;

  // Crystal colour shifts with score
  const hue  = (160 + score * 3) % 360;
  const col1 = `hsl(${hue}, 80%, 55%)`;
  const col2 = `hsl(${hue + 40}, 90%, 35%)`;
  const glow = `hsl(${hue}, 100%, 65%)`;

  ctx.shadowColor = glow;
  ctx.shadowBlur  = 14;

  // Top pillar body
  const tg = ctx.createLinearGradient(p.x, 0, p.x + PILLAR_W, 0);
  tg.addColorStop(0, col2);
  tg.addColorStop(0.4, col1);
  tg.addColorStop(1, col2);
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.roundRect(p.x, 0, PILLAR_W, p.topH, [0, 0, 8, 8]);
  ctx.fill();

  // Top crystal tip (diamond shape)
  ctx.fillStyle = col1;
  ctx.beginPath();
  ctx.moveTo(cx,          p.topH + 18);
  ctx.lineTo(p.x + 4,    p.topH);
  ctx.lineTo(p.x,        p.topH - 8);
  ctx.lineTo(cx,          p.topH - 24);
  ctx.lineTo(p.x + PILLAR_W,     p.topH - 8);
  ctx.lineTo(p.x + PILLAR_W - 4, p.topH);
  ctx.closePath();
  ctx.fill();

  // Bottom pillar body
  const bg = ctx.createLinearGradient(p.x, 0, p.x + PILLAR_W, 0);
  bg.addColorStop(0, col2);
  bg.addColorStop(0.4, col1);
  bg.addColorStop(1, col2);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(p.x, botY, PILLAR_W, botH, [8, 8, 0, 0]);
  ctx.fill();

  // Bottom crystal tip
  ctx.fillStyle = col1;
  ctx.beginPath();
  ctx.moveTo(cx,       botY - 18);
  ctx.lineTo(p.x + 4, botY);
  ctx.lineTo(p.x,     botY + 8);
  ctx.lineTo(cx,       botY + 24);
  ctx.lineTo(p.x + PILLAR_W,     botY + 8);
  ctx.lineTo(p.x + PILLAR_W - 4, botY);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
}

function drawRocket() {
  ctx.save();
  ctx.translate(rocketX, rocketY);

  // Angle: nose-up on jump, nose-down on fall (clamped)
  const targetAngle = Math.max(-0.5, Math.min(1.1, rocketVY * 0.065));
  rocketAngle += (targetAngle - rocketAngle) * 0.18;
  ctx.rotate(rocketAngle);

  const hw = ROCKET_W / 2;
  const hh = ROCKET_H / 2;

  // ── Thruster flame ──
  if (thrustFrames > 0) {
    const flameLen = 18 + Math.random() * 14;
    const flameGrad = ctx.createLinearGradient(-hw - flameLen, 0, -hw, 0);
    flameGrad.addColorStop(0, 'rgba(255,200,50,0)');
    flameGrad.addColorStop(0.4, 'rgba(255,120,20,0.9)');
    flameGrad.addColorStop(1,   'rgba(255,220,80,1)');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.ellipse(-hw - flameLen * 0.5, 0, flameLen * 0.5, hh * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    thrustFrames--;
  } else {
    // Idle small flame
    ctx.fillStyle = 'rgba(255,160,30,0.5)';
    ctx.beginPath();
    ctx.ellipse(-hw - 5, 0, 7, hh * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Body ──
  const bodyGrad = ctx.createLinearGradient(-hw, -hh, hw, hh);
  bodyGrad.addColorStop(0, '#c0c8e0');
  bodyGrad.addColorStop(0.5, '#7f5af0');
  bodyGrad.addColorStop(1, '#3a2070');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Nose cone ──
  ctx.fillStyle = '#f7c948';
  ctx.beginPath();
  ctx.moveTo(hw,       0);
  ctx.lineTo(hw - 10, -hh * 0.6);
  ctx.lineTo(hw + 14,  0);
  ctx.lineTo(hw - 10,  hh * 0.6);
  ctx.closePath();
  ctx.fill();

  // ── Window ──
  ctx.fillStyle = '#a0e8ff';
  ctx.shadowColor = '#a0e8ff';
  ctx.shadowBlur  = 8;
  ctx.beginPath();
  ctx.arc(4, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // ── Fins ──
  ctx.fillStyle = '#5a2eb0';
  ctx.beginPath();
  ctx.moveTo(-hw + 4, -hh * 0.3);
  ctx.lineTo(-hw - 8, -hh - 2);
  ctx.lineTo(-hw + 14, -hh * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-hw + 4,  hh * 0.3);
  ctx.lineTo(-hw - 8,  hh + 2);
  ctx.lineTo(-hw + 14, hh * 0.1);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle   = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function updateParticles() {
  particles.forEach(p => {
    p.x    += p.vx;
    p.y    += p.vy;
    p.vy   += 0.15;
    p.life -= p.decay;
  });
  particles = particles.filter(p => p.life > 0);
}

// ── Main update ────────────────────────────────────────────────
function update() {
  frames++;
  speed += SPEED_INC;

  // Gravity
  rocketVY += GRAVITY;
  rocketY  += rocketVY;

  // Clamp to top (bounce off ceiling)
  if (rocketY - ROCKET_H / 2 < 0) {
    rocketY  = ROCKET_H / 2;
    rocketVY = Math.abs(rocketVY) * 0.4;
  }

  // Ground / ceiling death
  const groundY = canvas.height - 40;
  if (rocketY + ROCKET_H / 2 >= groundY) {
    triggerDeath();
    return;
  }

  // Move & spawn pillars
  for (let i = pillars.length - 1; i >= 0; i--) {
    const p = pillars[i];
    p.x -= speed;

    // Score: pillar fully passed the rocket
    if (!p.scored && p.x + PILLAR_W < rocketX - ROCKET_W / 2) {
      p.scored = true;
      score++;
      scoreDisplay.textContent = score;
      if (score > best) {
        best = score;
        localStorage.setItem('skyhopper_best', best);
      }
      sfxPoint();
      spawnParticles(rocketX + 20, rocketY, '#f7c948', 12);
    }

    // Remove off-screen
    if (p.x + PILLAR_W < -10) {
      pillars.splice(i, 1);
    }
  }

  // Spawn next pillar
  if (pillars.length === 0 || pillars[pillars.length - 1].x <= canvas.width - SPAWN_DIST) {
    spawnPillar(canvas.width + PILLAR_W);
  }

  // Collision
  const hb = rocketHitbox();
  for (const p of pillars) {
    const topRect = { x: p.x, y: 0,        w: PILLAR_W, h: p.topH };
    const botRect = { x: p.x, y: p.topH + GAP, w: PILLAR_W, h: canvas.height };
    if (rectsOverlap(hb, topRect) || rectsOverlap(hb, botRect)) {
      triggerDeath();
      return;
    }
  }

  updateParticles();
}

function triggerDeath() {
  sfxDie();
  spawnParticles(rocketX, rocketY, '#ff6b6b', 20);
  spawnParticles(rocketX, rocketY, '#f7c948', 12);
  gameState = 'dead';
  // Brief delay to show explosion particles
  setTimeout(() => {
    showGameover();
    gameState = 'dead';
  }, 600);
}

// ── Render ─────────────────────────────────────────────────────
function render() {
  drawBackground();
  drawStars();
  pillars.forEach(drawPillar);
  drawGround();
  drawRocket();
  drawParticles();
}

// ── Game loop ──────────────────────────────────────────────────
function loop() {
  if (gameState === 'paused') return;
  if (gameState === 'dead') {
    // Keep rendering particles during death animation
    drawBackground();
    drawStars();
    pillars.forEach(drawPillar);
    drawGround();
    drawParticles();
    updateParticles();
    if (particles.length > 0) requestAnimationFrame(loop);
    return;
  }
  if (gameState !== 'running') return;

  update();
  render();
  requestAnimationFrame(loop);
}

// ── Boot ───────────────────────────────────────────────────────
startBest.textContent = 'Melhor: ' + best;
showScreen('screen-start');
