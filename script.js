/* ═══════════════════════════════════════════════════════════════
   RoomViz Pro — script.js
   Three.js 3D Room Visualizer
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Loading overlay ─────────────────────────────────────── */
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'loading-overlay';
  loadingDiv.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text">Initializing Room…</div>`;
  document.body.appendChild(loadingDiv);

  /* ── Toast helper ─────────────────────────────────────────── */
  let toastEl = null;
  let toastTimer = null;
  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  /* ── DOM refs ─────────────────────────────────────────────── */
  const canvas       = document.getElementById('room-canvas');
  const wrapper      = document.getElementById('canvas-wrapper');
  const wallLabel    = document.getElementById('wall-label');
  const wallLabelTxt = document.getElementById('wall-label-text');
  const selIndicator = document.getElementById('selection-indicator');
  const selText      = document.getElementById('selection-text');
  const dimOverlay   = document.getElementById('dim-overlay');

  /* ── Default colors ───────────────────────────────────────── */
  const DEFAULTS = {
    front: '#FFD700',
    back:  '#2E8B57',
    left:  '#2E8B57',
    right: '#D2042D',
    floor: 'wood'
  };

  const WALL_NAMES = {
    front: 'Front Wall — Bright Yellow',
    back:  'Back Wall — Sea Green',
    left:  'Left Wall — Sea Green',
    right: 'Right Wall — Cherry Red'
  };

  const COLOR_NAMES = {
    '#ffd700': 'Bright Yellow',
    '#d2042d': 'Cherry Red',
    '#2e8b57': 'Sea Green',
  };

  function getColorName(hex) {
    const lo = hex.toLowerCase();
    return COLOR_NAMES[lo] || hex.toUpperCase();
  }

  /* ══════════════════════════════════════════════════════════
     THREE.JS SETUP
  ══════════════════════════════════════════════════════════ */

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true   // needed for screenshot
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene  = new THREE.Scene();
  scene.background = new THREE.Color('#0d1018');
  scene.fog = new THREE.FogExp2('#0d1018', 0.018);

  /* ── Camera ───────────────────────────────────────────────── */
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(8, 9, 14);

  /* ── OrbitControls ────────────────────────────────────────── */
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping  = true;
  controls.dampingFactor  = 0.07;
  controls.minDistance    = 3;
  controls.maxDistance    = 30;
  controls.maxPolarAngle  = Math.PI / 1.85;
  controls.target.set(0, 1.5, 0);
  controls.update();

  /* ── Room dimensions ──────────────────────────────────────── */
  const W = 10, H = 5, D = 10;   // width, height, depth

  /* ══════════════════════════════════════════════════════════
     MATERIALS & TEXTURES
  ══════════════════════════════════════════════════════════ */

  function hexToThreeColor(hex) {
    return new THREE.Color(hex);
  }

  /* Wall material factory */
  function wallMat(hex) {
    return new THREE.MeshStandardMaterial({
      color: hexToThreeColor(hex),
      roughness: 0.82,
      metalness: 0.0,
    });
  }

  /* Floor texture generated procedurally via canvas */
  function makeFloorTexture(style) {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');

    if (style === 'wood') {
      // Wood planks
      for (let i = 0; i < 8; i++) {
        const y0 = (size / 8) * i;
        const plankH = size / 8;
        const hue = 28 + Math.random() * 8;
        ctx.fillStyle = `hsl(${hue}, 38%, ${24 + Math.random() * 6}%)`;
        ctx.fillRect(0, y0, size, plankH);
        ctx.fillStyle = `rgba(0,0,0,0.08)`;
        ctx.fillRect(0, y0 + plankH - 2, size, 2);
        // grain lines
        for (let g = 0; g < 14; g++) {
          ctx.strokeStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.04})`;
          ctx.lineWidth = 0.5 + Math.random();
          ctx.beginPath();
          const xg = Math.random() * size;
          ctx.moveTo(xg + Math.random() * 10, y0);
          ctx.bezierCurveTo(xg + 5, y0 + plankH * 0.3, xg - 5, y0 + plankH * 0.6, xg + Math.random() * 8, y0 + plankH);
          ctx.stroke();
        }
      }
    } else if (style === 'marble') {
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0,   '#e8e4df');
      grad.addColorStop(0.3, '#d4cfc8');
      grad.addColorStop(0.7, '#c8c3bb');
      grad.addColorStop(1,   '#e0dbd4');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      // veins
      for (let v = 0; v < 10; v++) {
        ctx.strokeStyle = `rgba(${150 + Math.random()*60}, ${140 + Math.random()*50}, ${130 + Math.random()*40}, 0.3)`;
        ctx.lineWidth = 0.5 + Math.random() * 2;
        ctx.beginPath();
        ctx.moveTo(Math.random() * size, 0);
        ctx.bezierCurveTo(
          Math.random() * size, size * 0.3,
          Math.random() * size, size * 0.6,
          Math.random() * size, size
        );
        ctx.stroke();
      }
    } else if (style === 'tile') {
      ctx.fillStyle = '#c8c4be';
      ctx.fillRect(0, 0, size, size);
      const tileSize = size / 8;
      for (let tx = 0; tx < 8; tx++) {
        for (let ty = 0; ty < 8; ty++) {
          const light = (tx + ty) % 2 === 0 ? '#d5d0ca' : '#bcb8b2';
          ctx.fillStyle = light;
          ctx.fillRect(tx * tileSize + 2, ty * tileSize + 2, tileSize - 4, tileSize - 4);
        }
      }
      ctx.strokeStyle = '#a8a49e';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 8; i++) {
        ctx.beginPath(); ctx.moveTo(i * tileSize, 0); ctx.lineTo(i * tileSize, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * tileSize); ctx.lineTo(size, i * tileSize); ctx.stroke();
      }
    } else { // concrete
      const imageData = ctx.createImageData(size, size);
      for (let p = 0; p < imageData.data.length; p += 4) {
        const n = 110 + Math.random() * 30;
        imageData.data[p]     = n;
        imageData.data[p + 1] = n;
        imageData.data[p + 2] = n;
        imageData.data[p + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  }

  /* Ceiling material */
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#e8e4dc'),
    roughness: 0.9,
    metalness: 0.0
  });

  /* ══════════════════════════════════════════════════════════
     GEOMETRY — Room Panels
  ══════════════════════════════════════════════════════════ */

  // Each wall is a plane; we build them as separate meshes for raycasting
  const walls = {};

  function makePlane(w, h, mat, name) {
    const geo = new THREE.PlaneGeometry(w, h, 12, 8);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.userData.wallKey = name;
    scene.add(mesh);
    walls[name] = mesh;
    return mesh;
  }

  // Floor
  const floorGeo = new THREE.PlaneGeometry(W, D, 20, 20);
  let floorMat = new THREE.MeshStandardMaterial({
    map: makeFloorTexture('wood'),
    roughness: 0.7,
    metalness: 0.05
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  floorMesh.userData.wallKey = 'floor';
  scene.add(floorMesh);

  // Ceiling
  const ceilMesh = makePlane(W, D, ceilingMat, 'ceiling');
  ceilMesh.rotation.x = Math.PI / 2;
  ceilMesh.position.y = H;

  // Back wall (z = -D/2)
  const backWall = makePlane(W, H, wallMat(DEFAULTS.back), 'back');
  backWall.position.set(0, H / 2, -D / 2);

  // Front wall (z = +D/2, flipped)
  const frontWall = makePlane(W, H, wallMat(DEFAULTS.front), 'front');
  frontWall.rotation.y = Math.PI;
  frontWall.position.set(0, H / 2, D / 2);

  // Left wall (x = -W/2)
  const leftWall = makePlane(D, H, wallMat(DEFAULTS.left), 'left');
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-W / 2, H / 2, 0);

  // Right wall (x = +W/2, flipped)
  const rightWall = makePlane(D, H, wallMat(DEFAULTS.right), 'right');
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(W / 2, H / 2, 0);

  /* ── Baseboard trim ───────────────────────────────────────── */
  function addBaseboard(lx, lz, ry, px, pz) {
    const geo = new THREE.BoxGeometry(lx, 0.12, 0.08);
    const mat = new THREE.MeshStandardMaterial({ color: '#f0ece6', roughness: 0.9 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, 0.06, pz);
    m.rotation.y = ry;
    m.castShadow = true;
    scene.add(m);
  }
  addBaseboard(W,  0, 0,            0,       -D/2 + 0.04);  // back
  addBaseboard(W,  0, 0,            0,        D/2 - 0.04);  // front
  addBaseboard(D,  0, Math.PI/2,   -W/2+0.04, 0);           // left
  addBaseboard(D,  0, Math.PI/2,    W/2-0.04, 0);           // right

  /* ── Crown molding ────────────────────────────────────────── */
  function addMolding(lx, ry, px, pz) {
    const geo = new THREE.BoxGeometry(lx, 0.1, 0.08);
    const mat = new THREE.MeshStandardMaterial({ color: '#fffff8', roughness: 0.85 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, H - 0.05, pz);
    m.rotation.y = ry;
    scene.add(m);
  }
  addMolding(W, 0, 0, -D/2 + 0.04);
  addMolding(W, 0, 0,  D/2 - 0.04);
  addMolding(D, Math.PI/2, -W/2+0.04, 0);
  addMolding(D, Math.PI/2,  W/2-0.04, 0);

  /* ── Simple furniture silhouettes ────────────────────────── */
  function addBox(w, h, d, x, y, z, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  function addCylinder(rt, rb, h, x, y, z, color) {
    const geo = new THREE.CylinderGeometry(rt, rb, h, 32);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    scene.add(m);
    return m;
  }

  // Sofa
  const sofaBase = addBox(3.2, 0.5, 1.1, -1, 0, 1.5, '#4a3f35');
  addBox(3.2, 0.55, 0.28, -1, 0.5, 1.95, '#4a3f35');   // back cushion
  addBox(0.28, 0.45, 1.1, -2.46, 0.5, 1.5, '#4a3f35'); // left arm
  addBox(0.28, 0.45, 1.1,  0.46, 0.5, 1.5, '#4a3f35'); // right arm
  // Cushions
  for (let i = 0; i < 3; i++) {
    addBox(0.9, 0.22, 0.9, -1.9 + i * 0.95, 0.5, 1.44, '#5a4e43');
  }

  // Coffee table
  addBox(1.4, 0.06, 0.7, -1, 0.42, 0, '#7a6050');
  addCylinder(0.04, 0.04, 0.4, -1.55, 0, -0.27, '#5a4a3a');
  addCylinder(0.04, 0.04, 0.4, -0.45, 0, -0.27, '#5a4a3a');
  addCylinder(0.04, 0.04, 0.4, -1.55, 0,  0.27, '#5a4a3a');
  addCylinder(0.04, 0.04, 0.4, -0.45, 0,  0.27, '#5a4a3a');

  // Bookshelf (back wall, right side)
  addBox(1.2, 2.4, 0.3, 3, 0, -4.8, '#8a6c4a');
  for (let s = 0; s < 4; s++) {
    addBox(1.1, 0.04, 0.28, 3, 0.55 + s * 0.55, -4.8, '#5a3c24');
    // books
    for (let b = 0; b < 4; b++) {
      addBox(0.16, 0.45, 0.2, 2.56 + b * 0.22, 0.58 + s * 0.55, -4.73,
        ['#a83232','#3282a8','#a8a832','#8232a8'][b % 4]);
    }
  }

  // Floor lamp
  addCylinder(0.04, 0.06, 1.7, 3.8, 0, 3.5, '#888');
  addCylinder(0.26, 0.18, 0.38, 3.8, 1.7, 3.5, '#ccc'); // shade

  // Small side table
  addBox(0.45, 0.04, 0.45, 0.7, 0.5, 1.62, '#8a6c4a');
  addCylinder(0.03, 0.03, 0.5, 0.7, 0, 1.62, '#8a6c4a');

  // Potted plant
  addCylinder(0.14, 0.18, 0.22, -4.2, 0, -4.2, '#7a5a3a');
  addBox(0.04, 0.55, 0.04, -4.2, 0.22, -4.2, '#2d5a1e');
  addBox(0.04, 0.5,  0.04, -4.14, 0.22, -4.2, '#327a22');
  addBox(0.04, 0.48, 0.04, -4.26, 0.22, -4.2, '#2a6a1c');

  /* ══════════════════════════════════════════════════════════
     LIGHTS
  ══════════════════════════════════════════════════════════ */

  // Ambient
  const ambient = new THREE.AmbientLight(0xfff8e8, 0.45);
  scene.add(ambient);

  // Main directional (sun-like)
  const dirLight = new THREE.DirectionalLight(0xfff5e0, 1.1);
  dirLight.position.set(5, 12, 8);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far  = 50;
  dirLight.shadow.camera.left = dirLight.shadow.camera.bottom = -12;
  dirLight.shadow.camera.right = dirLight.shadow.camera.top  = 12;
  dirLight.shadow.bias = -0.001;
  scene.add(dirLight);

  // Ceiling fill lights (simulating overhead fixtures)
  const ceilLights = [
    { pos: [ 2.5, H - 0.2,  2.5], color: 0xfff0d0, intensity: 0.5 },
    { pos: [-2.5, H - 0.2, -2.5], color: 0xfff0d0, intensity: 0.5 },
    { pos: [ 2.5, H - 0.2, -2.5], color: 0xffe8c0, intensity: 0.3 },
    { pos: [-2.5, H - 0.2,  2.5], color: 0xffe8c0, intensity: 0.3 },
  ];
  ceilLights.forEach(({ pos, color, intensity }) => {
    const pl = new THREE.PointLight(color, intensity, 14);
    pl.position.set(...pos);
    pl.castShadow = true;
    pl.shadow.mapSize.set(512, 512);
    scene.add(pl);
    // Fixture disc
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.15, 24),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0d0, emissiveIntensity: 0.6, side: THREE.DoubleSide })
    );
    disc.rotation.x = Math.PI / 2;
    disc.position.set(pos[0], H - 0.02, pos[2]);
    scene.add(disc);
  });

  // Lamp point light
  const lampLight = new THREE.PointLight(0xffd090, 0.7, 5);
  lampLight.position.set(3.8, 2.0, 3.5);
  scene.add(lampLight);

  /* ══════════════════════════════════════════════════════════
     DIMENSION LABELS
  ══════════════════════════════════════════════════════════ */

  const dimTags = [];

  function addDimTag(text, worldPos) {
    const el = document.createElement('div');
    el.className = 'dim-tag';
    el.textContent = text;
    dimOverlay.appendChild(el);
    dimTags.push({ el, worldPos: new THREE.Vector3(...worldPos) });
  }

  addDimTag(`${W}m wide`,  [0,     0.2,  -D / 2 - 0.6]);
  addDimTag(`${D}m deep`,  [-W/2 - 0.6, 0.2, 0]);
  addDimTag(`${H}m high`,  [-W/2 - 0.6, H/2,  -D/2 - 0.6]);
  addDimTag(`${W}m wide`,  [0,     0.2,   D / 2 + 0.6]);

  function updateDimTags() {
    const showDims = document.getElementById('toggle-dimensions').checked;
    dimTags.forEach(({ el, worldPos }) => {
      el.style.opacity = showDims ? '1' : '0';
      if (!showDims) return;
      const v = worldPos.clone().project(camera);
      const rect = wrapper.getBoundingClientRect();
      const x = (v.x * 0.5 + 0.5) * rect.width;
      const y = (-(v.y) * 0.5 + 0.5) * rect.height;
      if (v.z > 1) { el.style.opacity = '0'; return; }
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
    });
  }

  /* ══════════════════════════════════════════════════════════
     RAYCASTING — hover & click
  ══════════════════════════════════════════════════════════ */

  const raycaster = new THREE.Raycaster();
  const mouse     = new THREE.Vector2();
  let hoveredWall = null;
  let selectedWall = null;
  const wallMeshes = [frontWall, backWall, leftWall, rightWall];

  function getWallMeshes() { return wallMeshes; }

  function onMouseMove(e) {
    const rect = wrapper.getBoundingClientRect();
    const cx = e.clientX ?? (e.touches && e.touches[0].clientX);
    const cy = e.clientY ?? (e.touches && e.touches[0].clientY);
    if (cx == null) return;
    mouse.x =  ((cx - rect.left) / rect.width)  * 2 - 1;
    mouse.y = -((cy - rect.top)  / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(getWallMeshes());
    if (hits.length > 0) {
      const key = hits[0].object.userData.wallKey;
      if (hoveredWall !== key) {
        hoveredWall = key;
        wallLabelTxt.textContent = WALL_NAMES[key] || key;
        wallLabel.classList.remove('hidden');
      }
    } else {
      hoveredWall = null;
      wallLabel.classList.add('hidden');
    }
  }

  function onMouseClick(e) {
    if (e.target !== canvas) return;
    const rect = wrapper.getBoundingClientRect();
    const cx = e.clientX ?? (e.changedTouches && e.changedTouches[0].clientX);
    const cy = e.clientY ?? (e.changedTouches && e.changedTouches[0].clientY);
    if (cx == null) return;
    mouse.x =  ((cx - rect.left) / rect.width)  * 2 - 1;
    mouse.y = -((cy - rect.top)  / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(getWallMeshes());
    if (hits.length > 0) {
      selectWall(hits[0].object.userData.wallKey);
    } else {
      deselectWall();
    }
  }

  function selectWall(key) {
    selectedWall = key;
    selText.textContent = (WALL_NAMES[key] || key) + ' — change color →';
    selIndicator.classList.remove('hidden');
    // Highlight color row
    document.querySelectorAll('.color-row').forEach(r => {
      r.classList.toggle('selected', r.dataset.wall === key);
    });
    // Open the color input
    const colorInput = document.getElementById('color-' + key);
    if (colorInput) { colorInput.focus(); }
    // Flash the swatch
    const swatch = document.getElementById('swatch-' + key);
    if (swatch) {
      swatch.style.transform = 'scale(1.25)';
      setTimeout(() => swatch.style.transform = '', 300);
    }
  }

  function deselectWall() {
    selectedWall = null;
    selIndicator.classList.add('hidden');
    document.querySelectorAll('.color-row').forEach(r => r.classList.remove('selected'));
  }

  wrapper.addEventListener('mousemove', onMouseMove);
  wrapper.addEventListener('click', onMouseClick);

  /* ══════════════════════════════════════════════════════════
     COLOR CONTROLS
  ══════════════════════════════════════════════════════════ */

  function setWallColor(key, hex) {
    const mesh = walls[key];
    if (!mesh) return;
    mesh.material.color.set(hex);
    // Update swatch
    const swatch = document.getElementById('swatch-' + key);
    if (swatch) swatch.style.background = hex;
    // Update desc
    const desc = document.getElementById('desc-' + key);
    if (desc) desc.textContent = getColorName(hex);
  }

  ['front', 'back', 'left', 'right'].forEach(key => {
    const input = document.getElementById('color-' + key);
    input.addEventListener('input', () => setWallColor(key, input.value));
    // Row click → open picker
    const row = document.querySelector(`.color-row[data-wall="${key}"]`);
    row.addEventListener('click', (e) => {
      if (!e.target.classList.contains('wall-select-btn')) return;
      selectWall(key);
    });
    // Swatch wrap click → trigger color picker
    const wrap = document.querySelector(`.color-row[data-wall="${key}"] .color-swatch-wrap`);
    wrap.addEventListener('click', () => input.click());
  });

  /* Wall select buttons */
  document.querySelectorAll('.wall-select-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectWall(btn.dataset.wall);
    });
  });

  /* Reset */
  function resetColors() {
    ['front', 'back', 'left', 'right'].forEach(key => {
      const hex = DEFAULTS[key];
      document.getElementById('color-' + key).value = hex;
      setWallColor(key, hex);
    });
    showToast('Colors reset to defaults');
    deselectWall();
  }
  document.getElementById('btn-reset').addEventListener('click', resetColors);

  /* ══════════════════════════════════════════════════════════
     FLOOR TEXTURE SWITCH
  ══════════════════════════════════════════════════════════ */

  let currentFloor = 'wood';
  document.querySelectorAll('.floor-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.floor-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const style = btn.dataset.floor;
      if (style === currentFloor) return;
      currentFloor = style;
      floorMat.map?.dispose();
      floorMat.map = makeFloorTexture(style);
      floorMat.needsUpdate = true;
      showToast(`Floor: ${btn.textContent}`);
    });
  });

  /* ══════════════════════════════════════════════════════════
     TOGGLE OPTIONS
  ══════════════════════════════════════════════════════════ */

  /* Auto-rotate */
  document.getElementById('toggle-autorotate').addEventListener('change', e => {
    controls.autoRotate = e.target.checked;
    controls.autoRotateSpeed = 0.7;
  });

  /* Shadows */
  document.getElementById('toggle-shadows').addEventListener('change', e => {
    renderer.shadowMap.enabled = e.target.checked;
    scene.traverse(obj => {
      if (obj.isMesh) { obj.castShadow = e.target.checked; obj.receiveShadow = e.target.checked; }
    });
  });

  /* Wireframe */
  document.getElementById('toggle-wireframe').addEventListener('change', e => {
    [...wallMeshes, floorMesh, ceilMesh].forEach(m => {
      m.material.wireframe = e.target.checked;
    });
  });

  /* ══════════════════════════════════════════════════════════
     SCREENSHOT
  ══════════════════════════════════════════════════════════ */

  function takeScreenshot() {
    renderer.render(scene, camera);
    const dataURL = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `roomviz-${Date.now()}.png`;
    a.click();
    // Flash effect
    const flash = document.createElement('div');
    flash.className = 'screenshot-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 500);
    showToast('Screenshot saved!');
  }

  document.getElementById('btn-screenshot').addEventListener('click', takeScreenshot);
  document.getElementById('btn-screenshot-panel').addEventListener('click', takeScreenshot);

  /* ══════════════════════════════════════════════════════════
     FULLSCREEN
  ══════════════════════════════════════════════════════════ */

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
  document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
  document.getElementById('btn-fullscreen-panel').addEventListener('click', toggleFullscreen);

  /* ══════════════════════════════════════════════════════════
     MOBILE PANEL TOGGLE
  ══════════════════════════════════════════════════════════ */

  const panel = document.getElementById('control-panel');
  const mobileToggle = document.getElementById('panel-toggle-mobile');
  let panelOpen = false;

  mobileToggle.addEventListener('click', () => {
    panelOpen = !panelOpen;
    panel.classList.toggle('open', panelOpen);
    mobileToggle.textContent = panelOpen ? '✕' : '🎨';
  });

  /* ══════════════════════════════════════════════════════════
     RESIZE
  ══════════════════════════════════════════════════════════ */

  function onResize() {
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);
  onResize();

  /* ══════════════════════════════════════════════════════════
     EMISSIVE GLOW ON HOVER (subtle)
  ══════════════════════════════════════════════════════════ */

  let prevHovered = null;
  function updateHoverGlow() {
    if (prevHovered && prevHovered !== hoveredWall) {
      const m = walls[prevHovered];
      if (m) { m.material.emissive.set(0x000000); m.material.emissiveIntensity = 0; }
    }
    if (hoveredWall) {
      const m = walls[hoveredWall];
      if (m) {
        m.material.emissive.copy(m.material.color).multiplyScalar(0.12);
        m.material.emissiveIntensity = 1;
      }
    }
    prevHovered = hoveredWall;
  }

  /* ══════════════════════════════════════════════════════════
     ANIMATION LOOP
  ══════════════════════════════════════════════════════════ */

  let frameId;
  function animate() {
    frameId = requestAnimationFrame(animate);
    controls.update();
    updateHoverGlow();
    updateDimTags();
    renderer.render(scene, camera);
  }
  animate();

  /* ── Hide loading overlay ─────────────────────────────── */
  setTimeout(() => {
    loadingDiv.classList.add('fade-out');
    setTimeout(() => loadingDiv.remove(), 600);
  }, 700);

  /* ══════════════════════════════════════════════════════════
     KEYBOARD SHORTCUTS
  ══════════════════════════════════════════════════════════ */

  document.addEventListener('keydown', e => {
    if (e.key === 'r' || e.key === 'R') {
      const toggle = document.getElementById('toggle-autorotate');
      toggle.checked = !toggle.checked;
      controls.autoRotate = toggle.checked;
    }
    if (e.key === 'Escape') deselectWall();
    if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    if (e.key === 's' || e.key === 'S') takeScreenshot();
  });

  /* ══════════════════════════════════════════════════════════
     TOUCH support for wall hover
  ══════════════════════════════════════════════════════════ */
  wrapper.addEventListener('touchstart', (e) => {
    onMouseMove(e.touches[0]);
  }, { passive: true });
  wrapper.addEventListener('touchend', (e) => {
    onMouseClick(e);
  });

})();