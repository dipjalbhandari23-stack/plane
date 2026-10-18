/**
 * Skywriting Heart - Dynamic Canvas Animation
 * High-performance HTML5 Canvas animation featuring an aerobatic airplane
 * sky-writing a mathematically symmetrical heart shape across a vibrant sky gradient.
 */

(function () {
  'use strict';

  // --- DOM Elements ---
  const canvas = document.getElementById('sky-canvas');
  const ctx = canvas.getContext('2d');
  const flightStatus = document.getElementById('flight-status');
  const btnReplay = document.getElementById('btn-replay');
  const btnPause = document.getElementById('btn-pause');
  const pauseIcon = document.getElementById('pause-icon');
  const pauseLabel = document.getElementById('pause-label');
  const btnSound = document.getElementById('btn-sound');
  const soundIconOff = document.getElementById('sound-icon-off');
  const soundIconOn = document.getElementById('sound-icon-on');
  const soundLabel = document.getElementById('sound-label');
  const speedSlider = document.getElementById('speed-slider');
  const speedVal = document.getElementById('speed-val');

  // --- Configuration & State ---
  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  let isPaused = false;
  let flightSpeedFactor = 1.0;
  let lastTimestamp = 0;

  // Flight cycle states
  const STATE = {
    ENTRY: 0,
    DRAWING: 1,
    EXIT: 2,
    HOLD: 3,
    FADING: 4,
    IDLE_RESET: 5
  };

  let currentState = STATE.ENTRY;
  let stateTimer = 0;

  // Path data
  let flightPath = []; // Array of {x, y, angle, distance, isWriting}
  let totalPathDistance = 0;
  let currentDistance = 0;
  let entryEndDist = 0;
  let heartEndDist = 0;
  let exitEndDist = 0;

  // Base flight speed in pixels per second
  const BASE_SPEED = 230;

  // Smoke trail particles
  let smokePillows = [];
  let lastSmokePos = null;

  // Distant birds & clouds
  let birds = [];
  let clouds = [];

  // Sparkles on heart completion
  let sparkles = [];

  // Audio state
  let audioCtx = null;
  let isAudioEnabled = false;
  let engineNode = null;
  let windNode = null;
  let masterGain = null;

  // Pre-rendered puff sprite for maximum FPS and soft cloud look
  let puffCanvas = null;
  const PUFF_SIZE = 64;

  // --- Pre-render Smoke Puff Sprite ---
  function createPuffSprite() {
    puffCanvas = document.createElement('canvas');
    puffCanvas.width = PUFF_SIZE;
    puffCanvas.height = PUFF_SIZE;
    const pCtx = puffCanvas.getContext('2d');
    const center = PUFF_SIZE / 2;
    const radius = PUFF_SIZE / 2;

    const grad = pCtx.createRadialGradient(center, center, 0, center, center, radius);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.96)');
    grad.addColorStop(0.30, 'rgba(255, 255, 255, 0.88)');
    grad.addColorStop(0.60, 'rgba(245, 250, 255, 0.50)');
    grad.addColorStop(0.85, 'rgba(230, 242, 255, 0.18)');
    grad.addColorStop(1.0, 'rgba(220, 238, 255, 0.0)');

    pCtx.fillStyle = grad;
    pCtx.beginPath();
    pCtx.arc(center, center, radius, 0, Math.PI * 2);
    pCtx.fill();
  }

  // --- Responsive Setup ---
  function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);

    initBackgroundClouds();
    initBackgroundBirds();
    computeFlightTrajectory();
  }

  window.addEventListener('resize', () => {
    const curRatio = currentDistance / (totalPathDistance || 1);
    resizeCanvas();
    currentDistance = curRatio * totalPathDistance;
  });

  // --- Background Elements ---
  function initBackgroundClouds() {
    clouds = [];
    const cloudCount = 5;
    for (let i = 0; i < cloudCount; i++) {
      clouds.push({
        x: Math.random() * width,
        y: (height * 0.06) + Math.random() * (height * 0.42),
        scale: 0.65 + Math.random() * 0.85,
        speed: 3 + Math.random() * 5,
        opacity: 0.15 + Math.random() * 0.14,
        puffs: [
          { dx: 0, dy: 0, r: 48 },
          { dx: -38, dy: 10, r: 36 },
          { dx: 40, dy: 8, r: 38 },
          { dx: -62, dy: 18, r: 28 },
          { dx: 68, dy: 16, r: 26 },
        ]
      });
    }
  }

  function initBackgroundBirds() {
    birds = [];
    const birdCount = 6;
    for (let i = 0; i < birdCount; i++) {
      birds.push({
        x: Math.random() * width,
        y: height * 0.12 + Math.random() * (height * 0.52),
        vx: 16 + Math.random() * 20,
        vy: (Math.random() - 0.5) * 3,
        scale: 0.55 + Math.random() * 0.45,
        wingPhase: Math.random() * Math.PI * 2,
        wingFreq: 3.2 + Math.random() * 2.2,
        flapAmp: 3.5 + Math.random() * 2.5
      });
    }
  }

  // --- Trajectory Generation (Flawless Parametric Heart Curve) ---
  function computeFlightTrajectory() {
    // Proportions adapted to viewport size
    const minDim = Math.min(width, height);
    const scale = Math.min(minDim * 0.021, 18.5);

    // Heart center
    const cx = width * 0.5;
    const cy = height * 0.52;

    // 1. Parametric Heart Loop (Classic mathematical heart curve)
    // x(t) = 16 * sin^3(t)
    // y(t) = -(13*cos(t) - 5*cos(2t) - 2*cos(3t) - cos(4t))
    // Symmetrical, organic, and globally recognized heart proportions
    const N = 1000;
    const heartPts = [];
    for (let i = 0; i <= N; i++) {
      // t from 0 to -2*PI: flies around left lobe, down to bottom tip, up around right lobe, back to notch
      const t = -(i / N) * Math.PI * 2;
      const x = cx + scale * (16 * Math.pow(Math.sin(t), 3));
      const y = cy - scale * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      heartPts.push({ x, y, isWriting: true });
    }

    // Smooth the bottom tip transition so the airplane banks naturally around the tip
    const smoothedHeart = heartPts.map(p => ({ ...p }));
    const tipIdx = N / 2;
    for (let pass = 0; pass < 2; pass++) {
      for (let k = tipIdx - 10; k <= tipIdx + 10; k++) {
        smoothedHeart[k].x = 0.25 * smoothedHeart[k - 1].x + 0.5 * smoothedHeart[k].x + 0.25 * smoothedHeart[k + 1].x;
        smoothedHeart[k].y = 0.25 * smoothedHeart[k - 1].y + 0.5 * smoothedHeart[k].y + 0.25 * smoothedHeart[k + 1].y;
      }
    }

    // 2. Entry path: plane dives down from top-center sky into the top notch (cx, cy - 5*scale)
    const notchY = cy - 5 * scale;
    const entryPts = [];
    const entrySteps = 140;
    for (let i = 0; i <= entrySteps; i++) {
      const u = i / entrySteps;
      const p0 = { x: cx, y: -90 };
      const p1 = { x: cx, y: notchY - 140 };
      const p2 = { x: cx + 12, y: notchY - 20 };
      const p3 = { x: smoothedHeart[0].x, y: smoothedHeart[0].y };

      const inv = 1 - u;
      const x = inv * inv * inv * p0.x + 3 * inv * inv * u * p1.x + 3 * inv * u * u * p2.x + u * u * u * p3.x;
      const y = inv * inv * inv * p0.y + 3 * inv * inv * u * p1.y + 3 * inv * u * u * p2.y + u * u * u * p3.y;
      entryPts.push({ x, y, isWriting: false });
    }

    // 3. Exit path: plane swoops through notch and climbs away off screen into the upper right sky
    const exitPts = [];
    const exitSteps = 160;
    const endNotch = smoothedHeart[N];
    for (let i = 0; i <= exitSteps; i++) {
      const u = i / exitSteps;
      const p0 = { x: endNotch.x, y: endNotch.y };
      const p1 = { x: cx - 28, y: notchY + 22 };
      const p2 = { x: cx + 180, y: notchY - 140 };
      const p3 = { x: width + 120, y: -90 };

      const inv = 1 - u;
      const x = inv * inv * inv * p0.x + 3 * inv * inv * u * p1.x + 3 * inv * u * u * p2.x + u * u * u * p3.x;
      const y = inv * inv * inv * p0.y + 3 * inv * inv * u * p1.y + 3 * inv * u * u * p2.y + u * u * u * p3.y;
      exitPts.push({ x, y, isWriting: false });
    }

    // Combine all trajectory segments
    const combined = [...entryPts, ...smoothedHeart, ...exitPts];

    // Compute cumulative arc-length distances and continuous tangent angles
    flightPath = [];
    totalPathDistance = 0;
    let entryDist = 0;
    let heartDist = 0;
    let writingStarted = false;
    let writingEnded = false;

    for (let i = 0; i < combined.length; i++) {
      let angle = 0;
      if (i < combined.length - 1) {
        const dx = combined[i + 1].x - combined[i].x;
        const dy = combined[i + 1].y - combined[i].y;
        angle = Math.atan2(dy, dx);
      } else if (flightPath.length > 0) {
        angle = flightPath[flightPath.length - 1].angle;
      }

      let segDist = 0;
      if (i > 0) {
        const pdx = combined[i].x - combined[i - 1].x;
        const pdy = combined[i].y - combined[i - 1].y;
        segDist = Math.hypot(pdx, pdy);
      }
      totalPathDistance += segDist;

      if (!writingStarted && combined[i].isWriting) {
        writingStarted = true;
        entryDist = totalPathDistance;
      } else if (writingStarted && !writingEnded && !combined[i].isWriting) {
        writingEnded = true;
        heartDist = totalPathDistance;
      }

      flightPath.push({
        x: combined[i].x,
        y: combined[i].y,
        angle: angle,
        distance: totalPathDistance,
        isWriting: combined[i].isWriting
      });
    }

    entryEndDist = entryDist;
    heartEndDist = heartDist;
    exitEndDist = totalPathDistance;
  }

  // Binary search to find exact position and heading angle at distance
  function getSampleAtDistance(dist) {
    if (!flightPath || flightPath.length === 0) return null;
    const clampedDist = Math.max(0, Math.min(dist, totalPathDistance));

    let low = 0;
    let high = flightPath.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (flightPath[mid].distance < clampedDist) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx = Math.max(0, Math.min(low, flightPath.length - 1));
    if (idx === 0) return flightPath[0];

    const prev = flightPath[idx - 1];
    const curr = flightPath[idx];
    const segmentSpan = curr.distance - prev.distance;
    const ratio = segmentSpan > 0.0001 ? (clampedDist - prev.distance) / segmentSpan : 0;

    const x = prev.x + (curr.x - prev.x) * ratio;
    const y = prev.y + (curr.y - prev.y) * ratio;

    let diff = curr.angle - prev.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    const angle = prev.angle + diff * ratio;

    return {
      x,
      y,
      angle,
      isWriting: prev.isWriting && curr.isWriting
    };
  }

  // --- Smoke Particle System ---
  function emitSmokePuff(x, y, headingAngle) {
    // Tail nozzle position
    const exhaustDist = 18;
    const exhaustX = x - Math.cos(headingAngle) * exhaustDist;
    const exhaustY = y - Math.sin(headingAngle) * exhaustDist;

    // Slight organic puff jitter
    const perpAngle = headingAngle + Math.PI / 2;
    const spread = (Math.random() - 0.5) * 5;
    const px = exhaustX + Math.cos(perpAngle) * spread;
    const py = exhaustY + Math.sin(perpAngle) * spread;

    smokePillows.push({
      x: px,
      y: py,
      vx: (Math.random() - 0.5) * 0.4, // minimal drift so heart keeps its perfect shape!
      vy: (Math.random() - 0.5) * 0.3 - 0.08, // gentle thermal rise
      radius: 10 + Math.random() * 3,
      maxRadius: 25 + Math.random() * 7,
      opacity: 0.94,
      fadeRate: 0.0,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.25,
      age: 0
    });
  }

  function emitSmokeContinuous(fromPos, toPos) {
    if (!fromPos || !toPos) return;
    const dist = Math.hypot(toPos.x - fromPos.x, toPos.y - fromPos.y);
    const step = 3; // Dense continuous puffs every 3px
    const count = Math.max(1, Math.floor(dist / step));

    for (let i = 1; i <= count; i++) {
      const alpha = i / count;
      const x = fromPos.x + (toPos.x - fromPos.x) * alpha;
      const y = fromPos.y + (toPos.y - fromPos.y) * alpha;
      const angle = fromPos.angle + (toPos.angle - fromPos.angle) * alpha;
      emitSmokePuff(x, y, angle);
    }
  }

  function createHeartBurstSparkles() {
    sparkles = [];
    const minDim = Math.min(width, height);
    const scale = Math.min(minDim * 0.021, 18.5);
    const cx = width * 0.5;
    const cy = height * 0.52;

    for (let i = 0; i < 45; i++) {
      const t = Math.random() * Math.PI * 2;
      const hx = cx + scale * (16 * Math.pow(Math.sin(t), 3));
      const hy = cy - scale * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));

      sparkles.push({
        x: hx + (Math.random() - 0.5) * 20,
        y: hy + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 22,
        vy: (Math.random() - 0.5) * 22 - 8,
        size: 2.2 + Math.random() * 3.5,
        alpha: 1.0,
        decay: 0.6 + Math.random() * 0.7
      });
    }
  }

  // --- Airplane Drawing ---
  function drawAirplane(ctx, x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Drop shadow on high-altitude haze
    ctx.save();
    ctx.translate(14, 20);
    drawPlaneSilhouette(ctx, 'rgba(0, 30, 80, 0.16)');
    ctx.restore();

    // Plane model
    drawPlaneBody(ctx);

    ctx.restore();
  }

  function drawPlaneSilhouette(ctx, fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 5.5, 0, 0, Math.PI * 2);
    ctx.ellipse(1, 0, 8, 26, 0, 0, Math.PI * 2);
    ctx.ellipse(-14, 0, 5, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlaneBody(ctx) {
    const time = performance.now() * 0.001;

    // 1. Aerobatic Wings
    const wingGrad = ctx.createLinearGradient(-5, -28, 5, 28);
    wingGrad.addColorStop(0, '#f0f5fa');
    wingGrad.addColorStop(0.5, '#ffffff');
    wingGrad.addColorStop(1, '#e4ecf5');

    ctx.fillStyle = wingGrad;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(2, -26);
    ctx.lineTo(-4, -26);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-4, 26);
    ctx.lineTo(2, 26);
    ctx.closePath();
    ctx.fill();

    // Port Wingtip (Red Beacon)
    ctx.fillStyle = '#ff3344';
    ctx.fillRect(0, -26, 3, 5);
    ctx.shadowColor = '#ff3344';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(1.5, -26, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Starboard Wingtip (Green Beacon)
    ctx.fillStyle = '#22e066';
    ctx.fillRect(0, 21, 3, 5);
    ctx.shadowColor = '#22e066';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(1.5, 26, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Wing panel line
    ctx.strokeStyle = '#c5d5e6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-1, -25);
    ctx.lineTo(1, 0);
    ctx.lineTo(-1, 25);
    ctx.stroke();

    // 2. Horizontal Stabilizers
    ctx.fillStyle = '#e8f0f8';
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(-15, -13);
    ctx.lineTo(-18, -12);
    ctx.lineTo(-17, 0);
    ctx.lineTo(-18, 12);
    ctx.lineTo(-15, 13);
    ctx.closePath();
    ctx.fill();

    // 3. Main Fuselage
    const fuseGrad = ctx.createLinearGradient(0, -6, 0, 6);
    fuseGrad.addColorStop(0, '#ffffff');
    fuseGrad.addColorStop(0.4, '#f8fbff');
    fuseGrad.addColorStop(0.7, '#e2ecf7');
    fuseGrad.addColorStop(1, '#ccd9e8');

    ctx.fillStyle = fuseGrad;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.bezierCurveTo(18, -5.5, 5, -6.5, -10, -5);
    ctx.bezierCurveTo(-15, -4, -18, -2, -20, 0);
    ctx.bezierCurveTo(-18, 2, -15, 4, -10, 5);
    ctx.bezierCurveTo(5, 6.5, 18, 5.5, 22, 0);
    ctx.closePath();
    ctx.fill();

    // Aerobatic Red Stripe
    ctx.fillStyle = '#ff4455';
    ctx.beginPath();
    ctx.moveTo(14, -1.2);
    ctx.lineTo(-18, -0.6);
    ctx.lineTo(-18, 0.6);
    ctx.lineTo(14, 1.2);
    ctx.closePath();
    ctx.fill();

    // 4. Cockpit Canopy
    const glassGrad = ctx.createLinearGradient(0, -3.5, 0, 3.5);
    glassGrad.addColorStop(0, '#66c0f4');
    glassGrad.addColorStop(0.4, '#1b6ca8');
    glassGrad.addColorStop(1, '#0e3a60');

    ctx.fillStyle = glassGrad;
    ctx.beginPath();
    ctx.ellipse(3, 0, 7.5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.ellipse(3, -1.2, 5, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // 5. Vertical Tail Fin
    ctx.fillStyle = '#d0deed';
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(-21, 0);
    ctx.lineTo(-19, -1.2);
    ctx.lineTo(-14, -1.2);
    ctx.closePath();
    ctx.fill();

    // 6. Spinning Propeller
    ctx.fillStyle = 'rgba(230, 245, 255, 0.35)';
    ctx.beginPath();
    ctx.ellipse(23, 0, 2.5, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.arc(22.5, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();

    const propAngle = time * 45;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(23, Math.sin(propAngle) * 12);
    ctx.lineTo(23, -Math.sin(propAngle) * 12);
    ctx.stroke();

    // Active smoke nozzle glow
    if (currentState === STATE.DRAWING) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(-20, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Sound Generation (Procedural Web Audio API) ---
  function initAudio() {
    if (audioCtx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    audioCtx = new AudioContextClass();

    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);

    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(85, audioCtx.currentTime);

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, audioCtx.currentTime);

    const engineGain = audioCtx.createGain();
    engineGain.gain.setValueAtTime(0.7, audioCtx.currentTime);

    osc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(masterGain);
    osc.start();

    const bufferSize = audioCtx.sampleRate * 2;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const windFilter = audioCtx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(600, audioCtx.currentTime);
    windFilter.Q.setValueAtTime(1.5, audioCtx.currentTime);

    const windGain = audioCtx.createGain();
    windGain.gain.setValueAtTime(0.25, audioCtx.currentTime);

    whiteNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(masterGain);
    whiteNoise.start();

    engineNode = { osc, filter, gain: engineGain };
    windNode = { filter: windFilter, gain: windGain };
  }

  function toggleAudio() {
    if (!audioCtx) {
      initAudio();
      isAudioEnabled = true;
    } else {
      isAudioEnabled = !isAudioEnabled;
      if (audioCtx.state === 'suspended' && isAudioEnabled) {
        audioCtx.resume();
      }
    }

    if (masterGain) {
      masterGain.gain.setTargetAtTime(isAudioEnabled ? 0.08 : 0.0, audioCtx.currentTime, 0.05);
    }

    if (isAudioEnabled) {
      soundIconOff.classList.add('hidden');
      soundIconOn.classList.remove('hidden');
      soundLabel.textContent = 'Audio: On';
    } else {
      soundIconOff.classList.remove('hidden');
      soundIconOn.classList.add('hidden');
      soundLabel.textContent = 'Audio: Off';
    }
  }

  // --- Reset Animation Sequence ---
  function restartAnimation() {
    currentState = STATE.ENTRY;
    currentDistance = 0;
    stateTimer = 0;
    smokePillows = [];
    sparkles = [];
    lastSmokePos = null;
    flightStatus.textContent = 'Approaching Sky Area...';
  }

  // --- Animation Loop ---
  function updateAndRender(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
    lastTimestamp = timestamp;

    if (!isPaused) {
      const effectiveSpeed = BASE_SPEED * flightSpeedFactor;

      if (currentState === STATE.ENTRY) {
        flightStatus.textContent = 'Approaching Sky Area...';
        currentDistance += effectiveSpeed * dt;
        if (currentDistance >= entryEndDist) {
          currentState = STATE.DRAWING;
          flightStatus.textContent = 'Skywriting Heart Shape...';
        }
      } else if (currentState === STATE.DRAWING) {
        flightStatus.textContent = 'Skywriting Heart Shape...';
        currentDistance += effectiveSpeed * dt;
        if (currentDistance >= heartEndDist) {
          currentState = STATE.EXIT;
          flightStatus.textContent = 'Heart Outline Complete!';
          createHeartBurstSparkles();
        }
      } else if (currentState === STATE.EXIT) {
        currentDistance += effectiveSpeed * 1.35 * dt;
        if (currentDistance >= exitEndDist) {
          currentState = STATE.HOLD;
          stateTimer = 0;
          flightStatus.textContent = 'Heart in Full Bloom';
        }
      } else if (currentState === STATE.HOLD) {
        stateTimer += dt;
        if (stateTimer >= 2.0) {
          currentState = STATE.FADING;
          stateTimer = 0;
          flightStatus.textContent = 'Smoke Dissipating...';
        }
      } else if (currentState === STATE.FADING) {
        stateTimer += dt;
        for (let i = 0; i < smokePillows.length; i++) {
          smokePillows[i].fadeRate = 0.52;
        }
        if (stateTimer >= 2.0) {
          currentState = STATE.IDLE_RESET;
          stateTimer = 0;
        }
      } else if (currentState === STATE.IDLE_RESET) {
        stateTimer += dt;
        if (stateTimer >= 0.5) {
          restartAnimation();
        }
      }

      if (isAudioEnabled && engineNode) {
        const turnIntensity = Math.sin(timestamp * 0.003) * 15;
        engineNode.osc.frequency.setTargetAtTime(85 + turnIntensity, audioCtx.currentTime, 0.1);
      }
    }

    // --- Render Scene ---
    ctx.clearRect(0, 0, width, height);

    // A. Sky Gradient Background (#0088FF to #70D0FF)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0.0, '#0088FF');
    skyGrad.addColorStop(0.55, '#2eabff');
    skyGrad.addColorStop(1.0, '#70D0FF');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Ambient Sun Glow in upper sky
    const sunGlow = ctx.createRadialGradient(width * 0.22, height * 0.12, 10, width * 0.22, height * 0.12, width * 0.65);
    sunGlow.addColorStop(0, 'rgba(255, 255, 255, 0.32)');
    sunGlow.addColorStop(0.35, 'rgba(240, 250, 255, 0.10)');
    sunGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, width, height);

    // B. Distant Atmospheric Clouds
    renderClouds(ctx, dt);

    // C. Distant Floating Bird Silhouettes
    renderBirds(ctx, dt);

    // D. Smoke Trail Simulation & Rendering
    updateAndRenderSmoke(ctx, dt);

    // E. Heart Completion Sparkles
    renderSparkles(ctx, dt);

    // F. Airplane Flight & Heading Animation
    if (currentState === STATE.ENTRY || currentState === STATE.DRAWING || currentState === STATE.EXIT) {
      const planePos = getSampleAtDistance(currentDistance);
      if (planePos) {
        drawAirplane(ctx, planePos.x, planePos.y, planePos.angle);

        // Emit smoke during drawing state
        if (currentState === STATE.DRAWING && !isPaused) {
          if (lastSmokePos) {
            emitSmokeContinuous(lastSmokePos, planePos);
          } else {
            emitSmokePuff(planePos.x, planePos.y, planePos.angle);
          }
          lastSmokePos = planePos;
        } else {
          lastSmokePos = null;
        }
      }
    }

    requestAnimationFrame(updateAndRender);
  }

  // --- Render Distant Clouds ---
  function renderClouds(ctx, dt) {
    ctx.save();
    for (let c of clouds) {
      if (!isPaused) {
        c.x += c.speed * dt;
        if (c.x - 120 * c.scale > width) {
          c.x = -150 * c.scale;
          c.y = (height * 0.06) + Math.random() * (height * 0.42);
        }
      }

      ctx.fillStyle = `rgba(255, 255, 255, ${c.opacity})`;
      ctx.beginPath();
      for (let p of c.puffs) {
        ctx.arc(c.x + p.dx * c.scale, c.y + p.dy * c.scale, p.r * c.scale, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();
  }

  // --- Render Distant Birds ---
  function renderBirds(ctx, dt) {
    ctx.save();
    for (let b of birds) {
      if (!isPaused) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.wingPhase += b.wingFreq * dt;

        if (b.x > width + 50) {
          b.x = -50;
          b.y = height * 0.12 + Math.random() * (height * 0.52);
        }
      }

      const flap = Math.sin(b.wingPhase) * b.flapAmp * b.scale;
      const wingSpan = 14 * b.scale;

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = 'rgba(12, 48, 92, 0.42)';
      ctx.strokeStyle = 'rgba(12, 48, 92, 0.42)';
      ctx.lineWidth = 1.4 * b.scale;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-wingSpan * 0.45, flap - 3 * b.scale, -wingSpan, flap);
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(wingSpan * 0.45, flap - 3 * b.scale, wingSpan, flap);
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(0, 0.5 * b.scale, 1.8 * b.scale, 1.1 * b.scale, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
    ctx.restore();
  }

  // --- Render Puffy Smoke Trail ---
  function updateAndRenderSmoke(ctx, dt) {
    if (!puffCanvas) return;

    ctx.save();

    for (let i = smokePillows.length - 1; i >= 0; i--) {
      const p = smokePillows[i];

      if (!isPaused) {
        p.age += dt;

        // Billowing expansion
        if (p.radius < p.maxRadius) {
          p.radius += (p.maxRadius - p.radius) * 1.6 * dt;
        }

        // Drift
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.rotSpeed * dt;

        // Fading
        if (p.fadeRate > 0) {
          p.opacity -= p.fadeRate * dt;
          p.radius += 8 * dt;
        }
      }

      if (p.opacity <= 0.01) {
        smokePillows.splice(i, 1);
        continue;
      }

      const drawSize = p.radius * 2;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(p.opacity, 1.0));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.drawImage(puffCanvas, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      ctx.restore();
    }

    ctx.restore();
  }

  // --- Render Completion Sparkles ---
  function renderSparkles(ctx, dt) {
    if (sparkles.length === 0) return;
    ctx.save();
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i];
      if (!isPaused) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.alpha -= s.decay * dt;
      }

      if (s.alpha <= 0) {
        sparkles.splice(i, 1);
        continue;
      }

      ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // --- UI Event Handlers ---
  btnReplay.addEventListener('click', () => {
    restartAnimation();
  });

  btnPause.addEventListener('click', () => {
    isPaused = !isPaused;
    if (isPaused) {
      pauseLabel.textContent = 'Resume';
      pauseIcon.innerHTML = '<polygon points="5,3 19,12 5,21" fill="currentColor" stroke="none"/>';
    } else {
      pauseLabel.textContent = 'Pause';
      pauseIcon.innerHTML = '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>';
    }
  });

  btnSound.addEventListener('click', () => {
    toggleAudio();
  });

  speedSlider.addEventListener('input', (e) => {
    flightSpeedFactor = parseFloat(e.target.value);
    speedVal.textContent = flightSpeedFactor.toFixed(1) + 'x';
  });

  // --- Initialization ---
  createPuffSprite();
  resizeCanvas();
  requestAnimationFrame(updateAndRender);

})();
