// FIZZZIO - REAL AI POSTURE CAMERA ENGINE

// Uses Google's MediaPipe Pose Landmarker (BlazePose) running entirely
// in-browser via WebAssembly

// SIMULATION FALLBACK: if the camera is denied, or the model fails to
// load (slow connection, unsupported browser, ad-blocker, CDN hiccup,
// etc.), this module falls back to the original sine-wave-driven mock
// skeleton so the feature still demos something instead of breaking
// outright. The MediaPipe library itself is loaded with a dynamic
// import() (not a static top-level import) specifically so that a
// failure to fetch it can be caught here, rather than crashing this
// entire module.
const MEDIAPIPE_CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';

let videoEl = null;
let canvasEl = null;
let ctx = null;
let stream = null;
let isRunning = false;
let selectedExercise = 'squat';
let animationFrameId = null;
let toastCallback = null;

// Mode flag: 'live' = real MediaPipe detection from webcam,
// 'simulation' = the original sine-wave mock skeleton.
let mode = 'simulation';

// MediaPipe model instance — created once, reused across sessions.
let poseLandmarker = null;
let modelLoadPromise = null;
let lastVideoTime = -1;

// Simulation-mode state (unchanged from the original engine)
let simTime = 0;
let feedbackTimer = 0;

// Skeleton joints structure for rendering — shared by both live and
// simulation modes so drawBones/drawNodes/analyzePostureMetrics never
// need to know which mode produced the coordinates.
const joints = {
  head: { x: 0, y: 0 },
  neck: { x: 0, y: 0 },
  shoulderL: { x: 0, y: 0 },
  shoulderR: { x: 0, y: 0 },
  elbowL: { x: 0, y: 0 },
  elbowR: { x: 0, y: 0 },
  wristL: { x: 0, y: 0 },
  wristR: { x: 0, y: 0 },
  hipL: { x: 0, y: 0 },
  hipR: { x: 0, y: 0 },
  kneeL: { x: 0, y: 0 },
  kneeR: { x: 0, y: 0 },
  ankleL: { x: 0, y: 0 },
  ankleR: { x: 0, y: 0 },
};

// True once MediaPipe has detected a person in the current frame.
// When false in live mode, we skip drawing/analysis rather than show
// stale or zeroed-out joints.
let hasLiveDetection = false;

export function initPosture(showToast) {
  toastCallback = showToast;
  videoEl = document.getElementById('webcam-video');
  canvasEl = document.getElementById('skeleton-canvas');
  const btnWebcam = document.getElementById('btn-enable-webcam');
  const btnSimulate = document.getElementById('btn-simulate-feed');
  const btnStop = document.getElementById('btn-stop-webcam');
  const exerciseSelect = document.getElementById('exercise-select');

  if (!canvasEl) return;
  ctx = canvasEl.getContext('2d');

  // Set up listeners
  btnWebcam.addEventListener('click', startWebcam);
  btnSimulate.addEventListener('click', startSimulationOnly);

  if (btnStop) {
    btnStop.addEventListener('click', stopPosture);
  }

  exerciseSelect.addEventListener('change', (e) => {
    selectedExercise = e.target.value;
    addCoachingMessage('Fizzz Coach', `Switched Posture AI mode → ${selectedExercise.toUpperCase()}. Rezzzalibrating...`, 'system-msg');
  });

  // Handle canvas sizing
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Kick off the (slow, one-time) model download in the background as
  // soon as this view is initialized, so it's hopefully ready by the
  // time the person clicks "Allow Webcam" instead of making them wait.
  getOrCreatePoseLandmarker().catch((err) => {
    console.warn('Fizzzio: pose model failed to preload —', err);
  });
}

function resizeCanvas() {
  if (!canvasEl) return;
  const parent = canvasEl.parentElement;
  canvasEl.width = parent.clientWidth;
  canvasEl.height = parent.clientHeight;
}

// ---------------------------------------------------------------------------
// MediaPipe model loading
// ---------------------------------------------------------------------------

// Lazily creates the PoseLandmarker exactly once, sharing the in-flight
// promise across repeated calls so clicking "Allow Webcam" twice in a
// row doesn't trigger two model downloads.
function getOrCreatePoseLandmarker() {
  if (poseLandmarker) return Promise.resolve(poseLandmarker);
  if (modelLoadPromise) return modelLoadPromise;

  modelLoadPromise = (async () => {
    // Dynamic import (not a static top-level one) so a CDN failure
    // here is just a rejected promise we can catch, rather than a
    // module-load-time crash that would take down the whole app.
    const { PoseLandmarker, FilesetResolver } = await import(MEDIAPIPE_CDN_BASE);

    const vision = await FilesetResolver.forVisionTasks(`${MEDIAPIPE_CDN_BASE}/wasm`);
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
    return poseLandmarker;
  })();

  // If loading fails, clear the cached promise so a future retry
  // (e.g. clicking "Allow Webcam" again after a flaky connection)
  // can attempt a fresh download instead of replaying the same
  // rejected promise forever.
  modelLoadPromise.catch(() => {
    modelLoadPromise = null;
  });

  return modelLoadPromise;
}

// ---------------------------------------------------------------------------
// Webcam + live detection
// ---------------------------------------------------------------------------

async function startWebcam() {
  try {
    stopPosture(); // Reset any active loops

    if (toastCallback) {
      toastCallback('Loading Fizzz Coach AI 🧠', 'Downloading the pose model — one moment...');
    }

    // Request webcam access and load the model in parallel — whichever
    // finishes last determines when we actually start the loop.
    const [mediaStream] = await Promise.all([
      navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 360, facingMode: 'user' },
      }),
      getOrCreatePoseLandmarker(),
    ]);

    stream = mediaStream;
    videoEl.srcObject = stream;
    await videoEl.play();

    videoEl.classList.remove('hidden');
    document.getElementById('camera-fallback').classList.add('hidden');
    document.getElementById('btn-stop-webcam').classList.remove('hidden');

    mode = 'live';
    isRunning = true;
    lastVideoTime = -1;
    startAnimationLoop();

    if (toastCallback) {
      toastCallback('Buzzz-cam Online 📷', 'Skeletzzzon Engine is live and tracking!');
    }
    addCoachingMessage('Fizzz Coach', 'Buzzz-cam online. Position your whole body in the frame.', 'system-msg');
  } catch (err) {
    console.error('Camera connection or model load failed:', err);
    if (toastCallback) {
      toastCallback('Webcam Error', 'Could not start live tracking. Falling back to simulation mode.');
    }
    startSimulationOnly();
  }
}

// Runs once per animation frame while in live mode. Feeds the current
// video frame to MediaPipe and converts the result into this module's
// joint coordinate system.
function detectLiveFrame() {
  if (!poseLandmarker || !videoEl || videoEl.readyState < 2) {
    hasLiveDetection = false;
    return;
  }

  const currentTime = videoEl.currentTime;
  if (currentTime === lastVideoTime) {
    // No new frame since last tick — reuse the previous detection
    // rather than calling detectForVideo again with a stale timestamp.
    return;
  }
  lastVideoTime = currentTime;

  const result = poseLandmarker.detectForVideo(videoEl, performance.now());

  if (!result.landmarks || result.landmarks.length === 0) {
    hasLiveDetection = false;
    return;
  }

  hasLiveDetection = true;
  mapLandmarksToJoints(result.landmarks[0], canvasEl.width, canvasEl.height);
}

// MediaPipe returns 33 normalized landmarks (x, y in [0, 1] relative to
// the video frame). We map the ones we care about onto this module's
// 14-joint skeleton, scale them to canvas pixels, and mirror the
// x-axis to match the mirrored (.video-feed { transform: scaleX(-1) })
// video element — otherwise the skeleton would be a mirror image of
// what's drawn on top of.
function mapLandmarksToJoints(lm, canvasW, canvasH) {
  const toPoint = (landmark) => ({
    x: (1 - landmark.x) * canvasW, // mirrored horizontally
    y: landmark.y * canvasH,
  });

  const leftShoulder = toPoint(lm[11]);
  const rightShoulder = toPoint(lm[12]);
  const leftHip = toPoint(lm[23]);
  const rightHip = toPoint(lm[24]);

  joints.head = toPoint(lm[0]); // nose, used as head position
  joints.neck = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };
  joints.shoulderL = leftShoulder;
  joints.shoulderR = rightShoulder;
  joints.elbowL = toPoint(lm[13]);
  joints.elbowR = toPoint(lm[14]);
  joints.wristL = toPoint(lm[15]);
  joints.wristR = toPoint(lm[16]);
  joints.hipL = leftHip;
  joints.hipR = rightHip;
  joints.kneeL = toPoint(lm[25]);
  joints.kneeR = toPoint(lm[26]);
  joints.ankleL = toPoint(lm[27]);
  joints.ankleR = toPoint(lm[28]);
}

function startSimulationOnly() {
  stopPosture();
  videoEl.classList.add('hidden');
  document.getElementById('camera-fallback').classList.add('hidden');
  document.getElementById('btn-stop-webcam').classList.remove('hidden');

  mode = 'simulation';
  hasLiveDetection = true; // simulation always "detects" — it's drawing math, not a person
  isRunning = true;
  startAnimationLoop();

  if (toastCallback) {
    toastCallback('Fizzzulation Active ⚡', 'Skeletzzzon model is buzzing!');
  }
  addCoachingMessage('Fizzz Coach', 'High-Fidelity Simulation Engine online. Select an exercise to analyze.', 'system-msg');
}

export function stopPosture() {
  isRunning = false;
  hasLiveDetection = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  if (videoEl) {
    videoEl.srcObject = null;
    videoEl.classList.add('hidden');
  }

  const fallback = document.getElementById('camera-fallback');
  if (fallback) fallback.classList.remove('hidden');

  const btnStop = document.getElementById('btn-stop-webcam');
  if (btnStop) btnStop.classList.add('hidden');

  if (ctx && canvasEl) {
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }
}

// Animation core loop — same loop drives both live and simulation modes.
function startAnimationLoop() {
  function tick() {
    if (!isRunning) return;

    simTime += 0.03;

    if (mode === 'live') {
      detectLiveFrame();
    } else {
      calculateJointCoordinates(canvasEl.width, canvasEl.height);
    }

    renderSkeleton();

    animationFrameId = requestAnimationFrame(tick);
  }
  tick();
}

// Draws the scanner grid + skeleton (if a person/simulation is present)
// and runs the angle analysis. Shared by both modes.
function renderSkeleton() {
  const w = canvasEl.width;
  const h = canvasEl.height;
  ctx.clearRect(0, 0, w, h);

  drawScannerGrid(w, h);

  if (hasLiveDetection) {
    drawBones();
    drawNodes();
    analyzePostureMetrics();
    setDetectionStatus(true);
  } else {
    setDetectionStatus(false);
  }
}

// Updates the on-screen status text so it's honest about whether a
// person is actually being seen right now (live mode only — simulation mode never shows this state since hasLiveDetection is always true there).
function setDetectionStatus(detected) {
  const statusEl = document.querySelector('.camera-status-text');
  if (!statusEl) return;

  if (mode === 'simulation') {
    statusEl.textContent = 'High-Fidelity Simulation Engine Active';
  } else if (detected) {
    statusEl.textContent = 'AI Skeleton Tracking Engine Active';
  } else {
    statusEl.textContent = 'Searching for a person — step into frame';
  }
}

function drawScannerGrid(w, h) {
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.05)';
  ctx.lineWidth = 1;

  const cols = 16;
  for (let i = 0; i <= cols; i++) {
    const x = (w / cols) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  const rows = 9;
  for (let i = 0; i <= rows; i++) {
    const y = (h / rows) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function calculateJointCoordinates(w, h) {
  const cx = w / 2;
  const cy = h / 2;

  if (selectedExercise === 'squat') {
    const cycle = Math.sin(simTime) * 0.5 + 0.5; // 0 (standing) to 1 (deep squat)

    const headY = cy - 70 + (cycle * 50);
    const shoulderY = cy - 40 + (cycle * 55);
    const hipY = cy + 30 + (cycle * 60);
    const kneeY = cy + 100 + (cycle * 25);
    const ankleY = cy + 150;

    const kneeDisplace = cycle * 12;

    joints.head = { x: cx, y: headY };
    joints.neck = { x: cx, y: cy - 50 + (cycle * 50) };

    joints.shoulderL = { x: cx - 35, y: shoulderY };
    joints.shoulderR = { x: cx + 35, y: shoulderY };

    joints.elbowL = { x: cx - 65 - (cycle * 15), y: shoulderY - 10 };
    joints.elbowR = { x: cx + 65 + (cycle * 15), y: shoulderY - 10 };
    joints.wristL = { x: cx - 95, y: shoulderY - 15 };
    joints.wristR = { x: cx + 95, y: shoulderY - 15 };

    joints.hipL = { x: cx - 22, y: hipY };
    joints.hipR = { x: cx + 22, y: hipY };

    joints.kneeL = { x: cx - 35 - kneeDisplace, y: kneeY };
    joints.kneeR = { x: cx + 35 + kneeDisplace, y: kneeY };
    joints.ankleL = { x: cx - 30, y: ankleY };
    joints.ankleR = { x: cx + 30, y: ankleY };

  } else if (selectedExercise === 'warrior') {
    joints.head = { x: cx - 10, y: cy - 70 };
    joints.neck = { x: cx - 10, y: cy - 50 };

    joints.shoulderL = { x: cx - 40, y: cy - 35 };
    joints.shoulderR = { x: cx + 20, y: cy - 35 };

    joints.elbowL = { x: cx - 80, y: cy - 35 + Math.sin(simTime * 2) * 2 };
    joints.wristL = { x: cx - 120, y: cy - 35 + Math.sin(simTime * 2) * 3 };

    joints.elbowR = { x: cx + 65, y: cy - 35 - Math.sin(simTime * 2) * 2 };
    joints.wristR = { x: cx + 110, y: cy - 35 - Math.sin(simTime * 2) * 3 };

    joints.hipL = { x: cx - 30, y: cy + 30 };
    joints.hipR = { x: cx + 10, y: cy + 30 };

    const kneeBendCycle = Math.sin(simTime * 0.5) * 10;
    joints.kneeL = { x: cx - 65 + kneeBendCycle, y: cy + 85 };
    joints.ankleL = { x: cx - 75, y: cy + 140 };

    joints.kneeR = { x: cx + 50, y: cy + 85 };
    joints.ankleR = { x: cx + 90, y: cy + 140 };

  } else if (selectedExercise === 'plank') {
    const shake = Math.sin(simTime * 45) * 1.5;

    const startX = cx - 120;
    const startY = cy + 40;

    joints.ankleL = { x: startX, y: startY };
    joints.ankleR = { x: startX + 5, y: startY + 5 };

    joints.kneeL = { x: startX + 50, y: startY - 15 + shake * 0.2 };
    joints.kneeR = { x: startX + 53, y: startY - 10 + shake * 0.2 };

    joints.hipL = { x: startX + 110, y: startY - 35 + shake * 0.6 };
    joints.hipR = { x: startX + 112, y: startY - 30 + shake * 0.6 };

    joints.shoulderL = { x: startX + 190, y: startY - 55 + shake };
    joints.shoulderR = { x: startX + 192, y: startY - 50 + shake };

    joints.neck = { x: startX + 210, y: startY - 60 };
    joints.head = { x: startX + 225, y: startY - 67 };

    joints.elbowL = { x: startX + 190, y: startY + 5 };
    joints.elbowR = { x: startX + 192, y: startY + 8 };
    joints.wristL = { x: startX + 220, y: startY + 5 };
    joints.wristR = { x: startX + 222, y: startY + 8 };
  }
}

function drawBones() {
  ctx.strokeStyle = 'hsl(145, 80%, 50%)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.shadowBlur = 8;
  ctx.shadowColor = 'rgba(16, 185, 129, 0.4)';

  const bonePairs = [
    [joints.head, joints.neck],
    [joints.neck, joints.shoulderL],
    [joints.neck, joints.shoulderR],
    [joints.shoulderL, joints.elbowL],
    [joints.elbowL, joints.wristL],
    [joints.shoulderR, joints.elbowR],
    [joints.elbowR, joints.wristR],
    [joints.shoulderL, joints.hipL],
    [joints.shoulderR, joints.hipR],
    [joints.hipL, joints.kneeL],
    [joints.kneeL, joints.ankleL],
    [joints.hipR, joints.kneeR],
    [joints.kneeR, joints.ankleR],
  ];

  bonePairs.forEach((pair) => {
    ctx.beginPath();
    ctx.moveTo(pair[0].x, pair[0].y);
    ctx.lineTo(pair[1].x, pair[1].y);
    ctx.stroke();
  });

  ctx.shadowBlur = 0;
}

function drawNodes() {
  ctx.fillStyle = 'hsl(270, 85%, 65%)';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;

  Object.keys(joints).forEach((key) => {
    const joint = joints[key];
    ctx.beginPath();
    ctx.arc(joint.x, joint.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

function getAngle(p1, p2, p3) {
  const rad = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
  let angle = Math.abs(rad * 180 / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return Math.round(angle);
}

function analyzePostureMetrics() {
  const badge = document.getElementById('alignment-quality');
  const angle1Name = document.getElementById('angle-1-name');
  const angle1Bar = document.getElementById('angle-1-progress');
  const angle1Val = document.getElementById('angle-1-val');
  const angle2Name = document.getElementById('angle-2-name');
  const angle2Bar = document.getElementById('angle-2-progress');
  const angle2Val = document.getElementById('angle-2-val');

  if (selectedExercise === 'squat') {
    const kneeAngle = getAngle(joints.hipL, joints.kneeL, joints.ankleL);
    angle1Name.textContent = 'Knee Flexion Angle';
    angle1Val.textContent = `${kneeAngle}° / 90°`;
    angle1Bar.style.width = `${Math.min(100, Math.max(0, (180 - kneeAngle) / 90 * 100))}%`;

    const torsoAngle = getAngle(joints.shoulderL, joints.hipL, joints.kneeL);
    angle2Name.textContent = 'Hip-Torso Tilt';
    angle2Val.textContent = `${torsoAngle}° / 80°`;
    angle2Bar.style.width = `${Math.min(100, Math.max(0, (180 - torsoAngle) / 100 * 100))}%`;

    feedbackTimer++;
    if (feedbackTimer > 90) {
      feedbackTimer = 0;
      if (kneeAngle < 100 && torsoAngle > 75) {
        badge.textContent = 'Excellent';
        badge.className = 'active-badge success';
        addCoachingMessage('Fizzz Coach', 'Nailed it! Squat depth is zzzpot on. Drive through those heels!', 'success-msg');
      } else if (kneeAngle >= 140) {
        badge.textContent = 'Analyzing';
        badge.className = 'active-badge';
        addCoachingMessage('Fizzz Coach', 'Sinking in... keep that spine zzzero-tilted.', 'system-msg');
      } else if (torsoAngle < 70) {
        badge.textContent = 'Form Warning';
        badge.className = 'active-badge danger';
        addCoachingMessage('Fizzz Coach', '⚠️ Chest caving! Fizzzix it — raise up, shoulders back.', 'warning-msg');
      }
    }

  } else if (selectedExercise === 'warrior') {
    const kneeAngle = getAngle(joints.hipL, joints.kneeL, joints.ankleL);
    angle1Name.textContent = 'Front Knee Angle';
    angle1Val.textContent = `${kneeAngle}° / 90°`;
    angle1Bar.style.width = `${Math.min(100, Math.max(0, (180 - kneeAngle) / 90 * 100))}%`;

    const armAngle = getAngle(joints.wristL, joints.shoulderL, joints.shoulderR);
    angle2Name.textContent = 'Shoulder-Arm Line';
    angle2Val.textContent = `${armAngle}° / 180°`;
    angle2Bar.style.width = `${Math.min(100, Math.max(0, armAngle / 180 * 100))}%`;

    feedbackTimer++;
    if (feedbackTimer > 90) {
      feedbackTimer = 0;
      if (armAngle > 170 && kneeAngle < 120) {
        badge.textContent = 'Perfect Pose';
        badge.className = 'active-badge success';
        addCoachingMessage('Fizzz Coach', 'Posture is on point! Lock that gaze over your front hand.', 'success-msg');
      } else if (armAngle <= 170) {
        badge.textContent = 'Align Arms';
        badge.className = 'active-badge';
        addCoachingMessage('Fizzz Coach', '⚠️ Arms droooping! Fizzzix it — wrists level with shoulders.', 'warning-msg');
      }
    }

  } else if (selectedExercise === 'plank') {
    const coreAngle = getAngle(joints.shoulderL, joints.hipL, joints.ankleL);
    angle1Name.textContent = 'Core Neutral Angle';
    angle1Val.textContent = `${coreAngle}° / 175°`;
    angle1Bar.style.width = `${Math.min(100, Math.max(0, coreAngle / 180 * 100))}%`;

    const supportAngle = getAngle(joints.elbowL, joints.shoulderL, joints.hipL);
    angle2Name.textContent = 'Elbow-Shoulder Angle';
    angle2Val.textContent = `${supportAngle}° / 90°`;
    angle2Bar.style.width = `${Math.min(100, Math.max(0, supportAngle / 90 * 100))}%`;

    feedbackTimer++;
    if (feedbackTimer > 90) {
      feedbackTimer = 0;
      if (coreAngle > 170) {
        badge.textContent = 'Stable';
        badge.className = 'active-badge success';
        addCoachingMessage('Fizzz Coach', 'Zzzolid plank! Core locked in, glutes buzzing. Hold the line!', 'success-msg');
      } else {
        badge.textContent = 'Sagging Hips';
        badge.className = 'active-badge danger';
        addCoachingMessage('Fizzz Coach', '⚠️ Hips zzzonking down! Fizzzix it — lift that midsection, fire up the core.', 'warning-msg');
      }
    }
  }
}

function addCoachingMessage(sender, text, msgClass) {
  const feed = document.getElementById('coaching-feed');
  if (!feed) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const msgEl = document.createElement('div');
  msgEl.className = `coaching-msg ${msgClass}`;
  msgEl.innerHTML = `
    <span class="msg-time">${sender} • ${timeStr}</span>
    <span class="msg-text">${text}</span>
  `;

  feed.appendChild(msgEl);
  feed.scrollTop = feed.scrollHeight;

  while (feed.childElementCount > 15) {
    feed.removeChild(feed.firstChild);
  }
}
