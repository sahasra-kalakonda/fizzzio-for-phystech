let toastCallback = null;

// Comprehensive Muscle stretching database
const muscleDatabase = {
  shoulders: {
    name: 'Shoulders & Rotator Cuff',
    desc: 'The shoulder complex is highly mobile and prone to impingement, especially in overhead movements (swimming, rock climbing) or paddling (kayaking, rowing). Keeping them loose prevents rotator cuff strains.',
    stretches: [
      { title: 'Cross-Body Shoulder Stretch', duration: '30s per arm', desc: 'Pull one arm straight across your chest using your other forearm. Keep shoulder low, do not shrug.', tip: 'Prevents rotator cuff tightness in climbing and swimming.' },
      { title: 'Doorway Pec & Deltoid Stretch', duration: '40s hold', desc: 'Place elbow and forearm at 90 degrees against a doorframe, step forward with one foot until you feel a gentle chest/shoulder stretch.', tip: 'Improves posture after rowing or cycling.' }
    ]
  },
  chest: {
    name: 'Pectoral Muscles',
    desc: 'Tight chest muscles pull shoulders forward, causing poor posture and neck strain. Crucial for stability in pushups, swimming, and kayaking.',
    stretches: [
      { title: 'Behind-the-Back Clasp', duration: '30s hold', desc: 'Clasp your hands behind your back, roll shoulders down and back, and gently lift your hands up while keeping chest tall.', tip: 'Counteracts desk hunch and cycling postures.' }
    ]
  },
  abs: {
    name: 'Rectus Abdominis & Core',
    desc: 'The core provides structural stability for all rotational sports (disc golf, kayaking) and stability disciplines (plank, yoga). Keeping it flexible prevents compression of the spine.',
    stretches: [
      { title: 'Cobra Pose (Sanskrit: Bhujangasana)', duration: '45s stretch', desc: 'Lie flat on stomach, place hands under shoulders, and gently push your chest up while keeping hips on the floor. Look forward.', tip: 'Resets the lumbar spine after heavy squats or cycling.' }
    ]
  },
  arms: {
    name: 'Biceps & Forearm Flexors',
    desc: 'Forearms and wrists take a beating during climbing, gardening, skateboarding, and tennis. Stretching them avoids tendonitis (tennis/golfer elbow).',
    stretches: [
      { title: 'Wrist Flexor Stretch', duration: '20s per hand', desc: 'Extend your arm in front with palm facing out, fingers pointing down. Use other hand to gently pull fingers back.', tip: 'Crucial for climbers, gardeners, and paddle sports.' }
    ]
  },
  quads: {
    name: 'Quadriceps (Thighs)',
    desc: 'Quads drive running, cycling, hiking, and soccer. Tightness pull on the patella, causing runner\'s knee (patellofemoral pain).',
    stretches: [
      { title: 'Standing Quad Stretch', duration: '30s per leg', desc: 'Stand tall (hold wall for balance). Bend one knee and hold your ankle. Pull heel towards glutes, keeping knees close together.', tip: 'Prevents knee strains and patella tendonitis in runners.' },
      { title: 'Kneeling Hip Flexor Lunge', duration: '40s per leg', desc: 'Kneel on one knee, other foot flat in front. Gently tuck pelvis and lean forward until you feel a stretch in front of the hip.', tip: 'Key stretch for cyclists and runners.' }
    ]
  },
  shins: {
    name: 'Tibialis Anterior (Shins)',
    desc: 'Repetitive impact on hard surfaces (running, dancing, basketball) causes shin splints. Stretching the shins resets muscle tension.',
    stretches: [
      { title: 'Seated Shin Stretch', duration: '30s hold', desc: 'Kneel on a soft mat, sit back on your heels with tops of your feet flat on the floor. Place hands behind you and lift knees slightly.', tip: 'Best dynamic recovery for running on pavement.' }
    ]
  },
  traps: {
    name: 'Trapezius & Neck',
    desc: 'Strained by poor cycling posture (looking up while bent over), horseback riding, or stress. Keeping neck relaxed prevents cervicogenic headaches.',
    stretches: [
      { title: 'Upper Trap Release', duration: '30s per side', desc: 'Sit tall, place right hand on the left side of your head, and gently pull your right ear towards right shoulder. Let left shoulder drop.', tip: 'Relieves upper shoulder strain after cycling and swimming.' }
    ]
  },
  upperback: {
    name: 'Rhomboids & Latissimus Dorsi',
    desc: 'Lats are primary drivers in kayaking, swimming, and climbing. Stretching lats improves thoracic mobility and shoulder extension.',
    stretches: [
      { title: 'Child\'s Pose (Sanskrit: Balasana)', duration: '60s hold', desc: 'Kneel, sit back on your heels, separate knees, and reach your arms forward on the floor, lowering forehead to the mat.', tip: 'Superb calming stretch for back recovery.' },
      { title: 'Thread the Needle', duration: '30s per side', desc: 'From hands and knees, slide one arm underneath your chest, placing shoulder and ear flat on the floor. Rotate upper chest.', tip: 'Improves rotation flexibility in golf and kayaking.' }
    ]
  },
  lowerback: {
    name: 'Erector Spinae & Lumbar',
    desc: 'Core lower back is stressed during gardening, rowing, and squats. Tight lower backs lead to acute spasms. Prioritize decompression.',
    stretches: [
      { title: 'Double Knee-to-Chest', duration: '45s hold', desc: 'Lie on your back, pull both knees up towards your chest, and hug them with your arms. Rock gently side-to-side.', tip: 'Decompresses the lumbar spine after heavy loading.' }
    ]
  },
  glutes: {
    name: 'Gluteal Muscles (Hips)',
    desc: 'Glutes generate power in climbing, running, and jumping. Tight glutes pull on the sciatic nerve and lower back.',
    stretches: [
      { title: 'Figure-Four Stretch', duration: '30s per leg', desc: 'Lie on your back, bend knees. Cross left ankle over right knee. Grab back of right thigh and pull towards chest.', tip: 'Relieves hip tightness and minor sciatic pain.' },
      { title: 'Pigeon Pose', duration: '45s per leg', desc: 'Bring one knee forward behind your wrist, extend back leg straight behind you. Lower hips to floor and fold over front leg.', tip: 'Improves hip mobility for martial arts and yoga.' }
    ]
  },
  hamstrings: {
    name: 'Hamstrings (Back of Thighs)',
    desc: 'Very prone to tears in sprinting and sports. Tight hamstrings pull on the pelvis, causing chronic lower back pain.',
    stretches: [
      { title: 'Seated Hamstring Fold', duration: '40s hold', desc: 'Sit on floor, extend one leg straight, bend other foot flat against inner thigh. Fold forward from hips, reaching for toes.', tip: 'Crucial for runners, soccer players, and dancers.' }
    ]
  },
  calves: {
    name: 'Gastrocnemius & Soleus',
    desc: 'Calves absorb impact in running, jumping, and casual hiking. Tight calves contribute to plantar fasciitis and Achilles tendonitis.',
    stretches: [
      { title: 'Step Calf Stretch', duration: '30s per leg', desc: 'Stand on a step, let heel of one foot hang off the edge, letting gravity push your heel down. Keep knee straight.', tip: 'Prevents Achilles tendon strain in runners and hikers.' }
    ]
  }
};

export function initRecovery(showToast) {
  toastCallback = showToast;
  
  const antSvg = document.getElementById('human-anterior');
  const postSvg = document.getElementById('human-posterior');
  const btnAnt = document.getElementById('btn-view-anterior');
  const btnPost = document.getElementById('btn-view-posterior');

  if (!antSvg || !postSvg) return;

  // View toggles
  btnAnt.addEventListener('click', () => {
    btnAnt.classList.add('active');
    btnPost.classList.remove('active');
    antSvg.classList.remove('hidden');
    postSvg.classList.add('hidden');
    
    // Clear selections on switch
    clearSelections();
  });

  btnPost.addEventListener('click', () => {
    btnPost.classList.add('active');
    btnAnt.classList.remove('active');
    postSvg.classList.remove('hidden');
    antSvg.classList.add('hidden');
    
    // Clear selections on switch
    clearSelections();
  });

  // Attach click listeners to all muscle paths
  const muscles = document.querySelectorAll('.muscle-group');
  muscles.forEach(m => {
    m.addEventListener('click', (e) => {
      const muscleKey = e.currentTarget.getAttribute('data-muscle');
      
      // Toggle active states on path
      muscles.forEach(p => p.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      loadMuscleData(muscleKey);
    });
  });
}

function clearSelections() {
  const muscles = document.querySelectorAll('.muscle-group');
  muscles.forEach(p => p.classList.remove('active'));
  
  document.getElementById('selected-muscle-name').textContent = 'Select a Muscle Group';
  document.getElementById('selected-muscle-desc').textContent = 'Interactive stretches, alignment reminders, and injury prevention exercises will load here once you select a muscle on the diagram.';
  document.getElementById('stretches-list').innerHTML = '';
}

function loadMuscleData(key) {
  const data = muscleDatabase[key];
  if (!data) return;

  // Update text
  document.getElementById('selected-muscle-name').textContent = data.name;
  document.getElementById('selected-muscle-desc').textContent = data.desc;

  // Render stretches list
  const container = document.getElementById('stretches-list');
  container.innerHTML = '';

  data.stretches.forEach(stretch => {
    const itemEl = document.createElement('div');
    itemEl.className = 'stretch-item';
    itemEl.innerHTML = `
      <div class="stretch-header">
        <span class="stretch-title">${stretch.title}</span>
        <span class="stretch-dur">${stretch.duration}</span>
      </div>
      <p class="stretch-desc">${stretch.desc}</p>
      <span class="stretch-prevention">💡 Prevention Tip: ${stretch.tip}</span>
    `;
    container.appendChild(itemEl);
  });

  // Call Toast Notification
  if (toastCallback) {
    toastCallback('Exercises Loaded', `Targeting: ${data.name}`);
  }
}
