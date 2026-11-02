import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { soundManager } from '../game/audio';
import {
  createCosmicObjectGroup,
  createProceduralTexture,
  createRealisticNebulaSky,
  updateMoonMeshes,
} from '../game/cosmicRenderer';
import { EVOLUTION_FORMS } from '../game/evolutionData';
import { UniverseManager, MATTER_COLORS } from '../game/proceduralUniverse';
import {
  calculateGravityForce,
  calculateGravityRadius,
  calculateRadius,
  canCaptureMoon,
  canEvolve,
  collectMatter,
  createMoonOrbit,
  createRNG,
  deriveStats,
  getAvailableEvolutions,
  hashSeed,
  updateMoonOrbits,
} from '../game/rules';
import {
  clearGameState,
  DEFAULT_SETTINGS,
  GameSaveData,
  INITIAL_INVENTORY,
  loadGameState,
  saveGameState,
} from '../game/storage';
import {
  CosmicEvent,
  CosmicFormId,
  CosmicStats,
  GameSettings,
  MatterInventory,
  MatterType,
  MoonOrbit,
} from '../game/types';
import {
  Compass,
  Sparkles,
  Volume2,
  VolumeX,
  Orbit,
  Zap,
  BookOpen,
  Settings,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Download,
  AlertTriangle,
  Flame,
  Globe,
  Radio,
} from 'lucide-react';

export const CosmicGame: React.FC = () => {
  const canvasMountRef = useRef<HTMLDivElement>(null);

  // Game UI States
  const [gameState, setGameState] = useState<'title' | 'playing' | 'paused'>('title');
  const [currentFormId, setCurrentFormId] = useState<CosmicFormId>('meteorite');
  const [discoveredForms, setDiscoveredForms] = useState<CosmicFormId[]>(['meteorite']);
  const [mass, setMass] = useState<number>(30);
  const [inventory, setInventory] = useState<MatterInventory>(INITIAL_INVENTORY);
  const [stats, setStats] = useState<CosmicStats | null>(null);
  const [moons, setMoons] = useState<MoonOrbit[]>([]);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [worldSeed, setWorldSeed] = useState<string>('COSMOS_2026');

  // Modals & Panels
  const [showEvolveModal, setShowEvolveModal] = useState<boolean>(false);
  const [showTreeModal, setShowTreeModal] = useState<boolean>(false);
  const [showCodexModal, setShowCodexModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [discoveredPopup, setDiscoveredPopup] = useState<CosmicFormId | null>(null);
  const [hudCollapsed, setHudCollapsed] = useState<boolean>(false);
  const [activeEventNotification, setActiveEventNotification] = useState<CosmicEvent | null>(null);
  const [abilityCooldown, setAbilityCooldown] = useState<number>(0);
  const [touchPoint, setTouchPoint] = useState<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });

  // Mutable Engine State (avoiding React re-render inside 60fps render loop)
  const engineRef = useRef<{
    renderer: THREE.WebGLRenderer | null;
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    universe: UniverseManager | null;
    playerGroup: THREE.Group | null;
    moonGroup: THREE.Group | null;
    matterInstancedMeshes: Map<MatterType, THREE.InstancedMesh>;
    hazardMeshes: THREE.Mesh[];
    eventMeshes: THREE.Mesh[];
    starfield: THREE.Points | null;
    nebulaSky: THREE.Mesh | null;
    playerPosition: THREE.Vector3;
    playerVelocity: THREE.Vector3;
    cameraOffset: THREE.Vector3;
    cameraRotation: { yaw: number; pitch: number };
    keys: Record<string, boolean>;
    touchActive: boolean;
    touchScreenPos: { x: number; y: number };
    touchOriginPos: { x: number; y: number };
    touchTargetWorld: THREE.Vector3 | null;
    isDraggingCamera: boolean;
    lastMousePos: { x: number; y: number };
    zoomDistance: number;
    currentFormId: CosmicFormId;
    mass: number;
    inventory: MatterInventory;
    moons: MoonOrbit[];
    age: number;
    abilityTimer: number;
    isEvolvingAnim: boolean;
    evolveAnimProgress: number;
    targetFormId: CosmicFormId | null;
    frameId: number;
    lastTime: number;
  }>({
    renderer: null,
    scene: null,
    camera: null,
    universe: null,
    playerGroup: null,
    moonGroup: null,
    matterInstancedMeshes: new Map(),
    hazardMeshes: [],
    eventMeshes: [],
    starfield: null,
    nebulaSky: null,
    playerPosition: new THREE.Vector3(0, 0, 0),
    playerVelocity: new THREE.Vector3(0, 0, 0),
    cameraOffset: new THREE.Vector3(0, 15, 30),
    cameraRotation: { yaw: 0, pitch: 0.35 },
    keys: {},
    touchActive: false,
    touchScreenPos: { x: 0, y: 0 },
    touchOriginPos: { x: 0, y: 0 },
    touchTargetWorld: null,
    isDraggingCamera: false,
    lastMousePos: { x: 0, y: 0 },
    zoomDistance: 35,
    currentFormId: 'meteorite',
    mass: 30,
    inventory: { ...INITIAL_INVENTORY },
    moons: [],
    age: 0,
    abilityTimer: 0,
    isEvolvingAnim: false,
    evolveAnimProgress: 0,
    targetFormId: null,
    frameId: 0,
    lastTime: 0,
  });

  // Load Saved Game
  useEffect(() => {
    const saved = loadGameState();
    if (saved) {
      setCurrentFormId(saved.currentFormId);
      setDiscoveredForms(saved.discoveredForms);
      setMass(saved.mass);
      setInventory(saved.inventory);
      setMoons(saved.moons);
      setSettings(saved.settings);
      setWorldSeed(saved.worldSeed);

      const eng = engineRef.current;
      eng.currentFormId = saved.currentFormId;
      eng.mass = saved.mass;
      eng.inventory = { ...saved.inventory };
      eng.moons = [...saved.moons];
      eng.age = saved.age;
    }

    // Check URL parameters for autostart
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autostart') === '1') {
      setGameState('playing');
      soundManager.init();
    }
  }, []);

  // Initialize Three.js Engine
  useEffect(() => {
    if (!canvasMountRef.current) return;
    const mount = canvasMountRef.current;
    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;

    // Detect software WebGL as instructed by threejs skill
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020308, 0.00035);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.5, 8000);
    camera.position.set(0, 15, 35);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    // 1. Realistic Deep Space Nebula Sky (matching the user's screenshot)
    const nebulaSky = createRealisticNebulaSky();
    scene.add(nebulaSky);

    // 2. Realistic Cinematic Lighting
    const ambientLight = new THREE.AmbientLight(0x0f172a, 1.0);
    scene.add(ambientLight);

    const hemisphereLight = new THREE.HemisphereLight(0x38bdf8, 0x020617, 1.2);
    scene.add(hemisphereLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 2.8);
    dirLight.position.set(150, 120, 180);
    scene.add(dirLight);

    // 3. Deep Galactic Background Stars
    const starCount = isSoftwareGl ? 1200 : 3500;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const rng = createRNG(hashSeed(worldSeed));

    for (let i = 0; i < starCount; i++) {
      const dist = 1600 + rng() * 2500;
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(rng() * 2 - 1);

      starPos[i * 3] = dist * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = dist * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = dist * Math.cos(phi);

      const colorRoll = rng();
      const col = new THREE.Color(
        colorRoll > 0.75 ? '#93c5fd' : colorRoll > 0.5 ? '#fef08a' : '#ffffff'
      );
      starColors[i * 3] = col.r;
      starColors[i * 3 + 1] = col.g;
      starColors[i * 3 + 2] = col.b;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });
    const starfield = new THREE.Points(starGeo, starMat);
    scene.add(starfield);

    // 4. Initialize Universe Manager
    const universe = new UniverseManager(worldSeed);

    // 5. Realistic Asteroid Geometries & Stony Textures for Matter Pickups
    const rockTex = createProceduralTexture('rock', 256);
    const metalTex = createProceduralTexture('metal', 256);

    const createRealisticAsteroidGeo = (subdiv = 1, seedOff = 0) => {
      const geo = new THREE.DodecahedronGeometry(1.0, subdiv);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const n = 1.0 + Math.sin(vx * 3.2 + seedOff) * 0.2 - Math.cos(vy * 3.0 + vz * 2.0) * 0.12;
        pos.setXYZ(i, vx * n, vy * n, vz * n);
      }
      geo.computeVertexNormals();
      return geo;
    };

    const matterTypes: MatterType[] = [
      'rock',
      'metal',
      'ice',
      'gas',
      'plasma',
      'dark_matter',
      'exotic_matter',
    ];
    const matterInstancedMap = new Map<MatterType, THREE.InstancedMesh>();

    matterTypes.forEach((mType, idx) => {
      const geo = createRealisticAsteroidGeo(1, idx * 1.5);
      const isMetal = mType === 'metal';

      const mat = new THREE.MeshStandardMaterial({
        color: MATTER_COLORS[mType],
        roughness: isMetal ? 0.35 : 0.88,
        metalness: isMetal ? 0.85 : 0.12,
        map: isMetal ? metalTex : rockTex,
        emissive: mType === 'plasma' || mType === 'dark_matter' || mType === 'exotic_matter' ? MATTER_COLORS[mType] : '#000000',
        emissiveIntensity: 0.35,
      });

      const instancedMesh = new THREE.InstancedMesh(geo, mat, 150);
      instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(instancedMesh);
      matterInstancedMap.set(mType, instancedMesh);
    });

    // 6. Create Player Group & Moon Group
    const playerRadius = calculateRadius(engineRef.current.currentFormId, engineRef.current.mass);
    const playerGroup = createCosmicObjectGroup(engineRef.current.currentFormId, playerRadius);
    scene.add(playerGroup);

    const moonGroup = new THREE.Group();
    scene.add(moonGroup);

    // Store references in engineRef
    const eng = engineRef.current;
    eng.renderer = renderer;
    eng.scene = scene;
    eng.camera = camera;
    eng.universe = universe;
    eng.playerGroup = playerGroup;
    eng.moonGroup = moonGroup;
    eng.matterInstancedMeshes = matterInstancedMap;
    eng.starfield = starfield;
    eng.nebulaSky = nebulaSky;
    eng.lastTime = performance.now();

    // Event Listeners for Resize, Keys, Mouse/Touch
    const handleResize = () => {
      if (!mount || !eng.camera || !eng.renderer) return;
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      eng.camera.aspect = w / h;
      eng.camera.updateProjectionMatrix();
      eng.renderer.setSize(w, h);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture keys if typing inside an input or textarea
      if (
        (e.target as HTMLElement)?.tagName === 'INPUT' ||
        (e.target as HTMLElement)?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      eng.keys[key] = true;
      if (e.code) {
        eng.keys[e.code.toLowerCase()] = true;
      }

      // Prevent window scrolling on arrow keys and spacebar during gameplay
      if (
        e.code === 'Space' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
      }

      // Space or Q = Capture / Stardust Pull
      if (e.code === 'Space' || key === 'q') {
        triggerPlayerAbility();
      }
      // E = Trigger Evolve if ready
      if (key === 'e') {
        setShowEvolveModal((prev) => !prev);
      }
      // Escape = Toggle Settings or close modals
      if (e.key === 'Escape') {
        if (showEvolveModal || showTreeModal || showCodexModal) {
          setShowEvolveModal(false);
          setShowTreeModal(false);
          setShowCodexModal(false);
        } else {
          setShowSettingsModal((prev) => !prev);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      eng.keys[key] = false;
      if (e.code) {
        eng.keys[e.code.toLowerCase()] = false;
      }
    };

    const handleBlur = () => {
      eng.keys = {};
    };

    const handlePointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.closest('.interactive') || (e.target as HTMLElement)?.tagName === 'BUTTON') return;
      if (e.button === 2) {
        // Right click drag rotates camera
        eng.isDraggingCamera = true;
        eng.lastMousePos = { x: e.clientX, y: e.clientY };
        return;
      }
      eng.touchActive = true;
      eng.touchOriginPos = { x: e.clientX, y: e.clientY };
      eng.touchScreenPos = { x: e.clientX, y: e.clientY };
      setTouchPoint({ x: e.clientX, y: e.clientY, active: true });
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (eng.isDraggingCamera) {
        const dx = e.clientX - eng.lastMousePos.x;
        const dy = e.clientY - eng.lastMousePos.y;
        eng.cameraRotation.yaw -= dx * 0.005;
        eng.cameraRotation.pitch = Math.max(-0.4, Math.min(1.2, eng.cameraRotation.pitch + dy * 0.005));
        eng.lastMousePos = { x: e.clientX, y: e.clientY };
      } else if (eng.touchActive) {
        eng.touchScreenPos = { x: e.clientX, y: e.clientY };
        setTouchPoint({ x: e.clientX, y: e.clientY, active: true });

        // Gently adjust touch origin if dragged far across the screen so navigation remains fluid
        const dragDx = e.clientX - eng.touchOriginPos.x;
        const dragDy = e.clientY - eng.touchOriginPos.y;
        const dragDist = Math.hypot(dragDx, dragDy);
        if (dragDist > 95) {
          const shift = (dragDist - 95) / dragDist;
          eng.touchOriginPos.x += dragDx * shift * 0.25;
          eng.touchOriginPos.y += dragDy * shift * 0.25;
        }
      }
    };

    const handlePointerUp = () => {
      eng.touchActive = false;
      eng.isDraggingCamera = false;
      setTouchPoint((prev) => ({ ...prev, active: false }));
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const currentRad = calculateRadius(eng.currentFormId, eng.mass);
      const minZoom = currentRad * 2.2;
      const maxZoom = currentRad * 25.0;
      eng.zoomDistance = Math.max(minZoom, Math.min(maxZoom, eng.zoomDistance + e.deltaY * 0.05));
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    mount.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    mount.addEventListener('contextmenu', handleContextMenu);
    mount.addEventListener('wheel', handleWheel, { passive: false });

    // Periodic Cosmic Event Spawner
    const eventInterval = window.setInterval(() => {
      if (eng.universe && Math.random() < 0.3) {
        const ev = eng.universe.triggerRandomEvent(eng.playerPosition);
        setActiveEventNotification(ev);
        window.setTimeout(() => setActiveEventNotification(null), 8000);
      }
    }, 28000);

    // Periodic Autosave every 10 seconds
    const saveInterval = window.setInterval(() => {
      saveGameState({
        currentFormId: eng.currentFormId,
        discoveredForms,
        mass: eng.mass,
        inventory: eng.inventory,
        worldSeed,
        moons: eng.moons,
        settings,
        age: eng.age,
      });
    }, 10000);

    // Main 60fps Animation Loop
    const tick = () => {
      const now = performance.now();
      const rawDt = (now - eng.lastTime) / 1000;
      eng.lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      eng.age += dt;

      // Handle ability cooldown
      if (eng.abilityTimer > 0) {
        eng.abilityTimer = Math.max(0, eng.abilityTimer - dt);
        setAbilityCooldown(eng.abilityTimer);
      }

      // 1. Process Movement Inputs (Direct Finger Touch Steering)
      const moveVec = new THREE.Vector3();

      if (eng.touchActive) {
        // Compute displacement from touch origin (finger drag direction)
        const dx = eng.touchScreenPos.x - eng.touchOriginPos.x;
        const dy = eng.touchScreenPos.y - eng.touchOriginPos.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 6) {
          // Precise directional vector relative to camera heading
          const nx = dx / dist;
          const ny = dy / dist;

          const fwd = new THREE.Vector3(-Math.sin(eng.cameraRotation.yaw), 0, -Math.cos(eng.cameraRotation.yaw));
          const right = new THREE.Vector3(Math.cos(eng.cameraRotation.yaw), 0, -Math.sin(eng.cameraRotation.yaw));

          // Dragging finger upward (ny < 0) moves forward into space
          // Dragging finger right (nx > 0) moves right
          moveVec.addScaledVector(fwd, -ny);
          moveVec.addScaledVector(right, nx);

          // Dynamic speed acceleration scaling
          const speedFactor = Math.min(2.5, Math.max(0.4, Math.pow(dist / 40, 0.95)));
          moveVec.multiplyScalar(speedFactor);

          // Smoothly align camera yaw toward travel direction
          const targetYaw = Math.atan2(-moveVec.x, -moveVec.z);
          const diff = Math.atan2(Math.sin(targetYaw - eng.cameraRotation.yaw), Math.cos(targetYaw - eng.cameraRotation.yaw));
          eng.cameraRotation.yaw += diff * dt * 1.8;
        }
      }

      // Keyboard WASD/Arrow keys support with camera-aligned heading
      const isUp = Boolean(eng.keys['w'] || eng.keys['keyw'] || eng.keys['arrowup']);
      const isDown = Boolean(eng.keys['s'] || eng.keys['keys'] || eng.keys['arrowdown']);
      const isLeft = Boolean(eng.keys['a'] || eng.keys['keya'] || eng.keys['arrowleft']);
      const isRight = Boolean(eng.keys['d'] || eng.keys['keyd'] || eng.keys['arrowright']);

      if (isUp) moveVec.z -= 1;
      if (isDown) moveVec.z += 1;
      if (isLeft) moveVec.x -= 1;
      if (isRight) moveVec.x += 1;

      // Vertical 3D space movement (R for pitch up, C for pitch down)
      if (eng.keys['r'] || eng.keys['keyr']) moveVec.y += 1;
      if (eng.keys['c'] || eng.keys['keyc']) moveVec.y -= 1;

      // Apply movement force
      if (moveVec.lengthSq() > 0) {
        if (!eng.touchActive) {
          moveVec.normalize();
          // Transform camera-relative X/Z controls into world-space coordinates
          const fwd = new THREE.Vector3(-Math.sin(eng.cameraRotation.yaw), 0, -Math.cos(eng.cameraRotation.yaw));
          const right = new THREE.Vector3(Math.cos(eng.cameraRotation.yaw), 0, -Math.sin(eng.cameraRotation.yaw));
          
          const worldDir = new THREE.Vector3();
          worldDir.addScaledVector(fwd, -moveVec.z); // -(-1) = +1 for W forward
          worldDir.addScaledVector(right, moveVec.x);
          worldDir.y = moveVec.y * 0.7;
          moveVec.copy(worldDir);

          // Responsive camera yaw follow-through when banking left/right with A/D
          if (isLeft && !isRight) {
            eng.cameraRotation.yaw += dt * 0.9;
          } else if (isRight && !isLeft) {
            eng.cameraRotation.yaw -= dt * 0.9;
          }
        }
        const formDef = EVOLUTION_FORMS[eng.currentFormId];
        const baseSpeed = 26.0 * (formDef?.statMultipliers.speedMult ?? 1.0);
        eng.playerVelocity.addScaledVector(moveVec, baseSpeed * dt * 4.8);
      }

      // Inertia & Damping
      eng.playerVelocity.multiplyScalar(Math.pow(0.89, dt * 60));
      eng.playerPosition.addScaledVector(eng.playerVelocity, dt);

      // Player rotation & physical rolling animation
      if (eng.playerGroup) {
        eng.playerGroup.position.copy(eng.playerPosition);
        // Base axial rotation
        eng.playerGroup.rotation.y += 0.4 * dt;
        // Physical rolling in direction of travel
        eng.playerGroup.rotation.x += eng.playerVelocity.z * dt * 0.08;
        eng.playerGroup.rotation.z -= eng.playerVelocity.x * dt * 0.08;

        // Specific sub-object animations (clouds, accretion disks, pulsar beams)
        const clouds = eng.playerGroup.getObjectByName('cloud_layer');
        if (clouds) clouds.rotation.y += 0.2 * dt;

        const accretion = eng.playerGroup.getObjectByName('accretion_disk');
        if (accretion) accretion.rotation.z += 1.8 * dt;

        const innerAnomaly = eng.playerGroup.getObjectByName('anomaly_inner');
        const outerAnomaly = eng.playerGroup.getObjectByName('anomaly_outer');
        if (innerAnomaly && outerAnomaly) {
          innerAnomaly.rotation.x += 0.8 * dt;
          innerAnomaly.rotation.y += 0.8 * dt;
          outerAnomaly.rotation.y -= 0.6 * dt;
          outerAnomaly.rotation.z -= 0.6 * dt;
        }

        // Evolution pulse transformation effect
        if (eng.isEvolvingAnim) {
          eng.evolveAnimProgress += dt * 1.5;
          const scale = 1 + Math.sin(eng.evolveAnimProgress * Math.PI) * 0.45;
          eng.playerGroup.scale.set(scale, scale, scale);
          if (eng.evolveAnimProgress >= 1.0) {
            eng.isEvolvingAnim = false;
            eng.playerGroup.scale.set(1, 1, 1);
          }
        }
      }

      // 2. Gravitational Physics & Matter Attraction
      const currentRadius = calculateRadius(eng.currentFormId, eng.mass);
      const gravityRadius = calculateGravityRadius(eng.currentFormId, eng.mass);

      if (eng.universe) {
        eng.universe.update(dt, eng.playerPosition, currentRadius);

        // Update matter instanced meshes & gravitational pull
        const countsByType: Record<MatterType, number> = {
          rock: 0,
          metal: 0,
          ice: 0,
          gas: 0,
          plasma: 0,
          dark_matter: 0,
          exotic_matter: 0,
        };

        const dummy = new THREE.Object3D();

        for (let i = 0; i < eng.universe.entities.length; i++) {
          const item = eng.universe.entities[i];
          const dist = item.position.distanceTo(eng.playerPosition);

          // Gravitational attraction
          if (dist < gravityRadius && dist > currentRadius * 0.5) {
            const pullForce = calculateGravityForce(eng.currentFormId, eng.mass, dist);
            const pullDir = new THREE.Vector3().subVectors(eng.playerPosition, item.position).normalize();
            item.velocity.addScaledVector(pullDir, pullForce * dt);
          }

          // Collection check
          if (dist < currentRadius * 1.05 + item.radius) {
            item.isConsumed = true;
            soundManager.playPickup(item.type);

            const { newMass, newInventory } = collectMatter(
              eng.currentFormId,
              item.type,
              item.amount,
              eng.mass,
              eng.inventory
            );

            eng.mass = newMass;
            eng.inventory = newInventory;
            setMass(newMass);
            setInventory({ ...newInventory });

            // Check moon capture: when big enough, random chance to lock into orbit!
            if (canCaptureMoon(eng.currentFormId, eng.moons) && Math.random() < 0.03) {
              const newMoon = createMoonOrbit(currentRadius, eng.moons.length, Math.random);
              eng.moons.push(newMoon);
              setMoons([...eng.moons]);
              soundManager.playDiscovery();
            }
          }

          // Render instanced mesh
          const typeCount = countsByType[item.type];
          if (typeCount < 150) {
            const instMesh = eng.matterInstancedMeshes.get(item.type);
            if (instMesh) {
              dummy.position.copy(item.position);
              dummy.rotation.copy(item.rotation);
              dummy.scale.set(item.radius, item.radius, item.radius);
              dummy.updateMatrix();
              instMesh.setMatrixAt(typeCount, dummy.matrix);
              countsByType[item.type] = typeCount + 1;
            }
          }
        }

        // Commit instanced mesh matrices
        eng.matterInstancedMeshes.forEach((mesh, mType) => {
          mesh.count = countsByType[mType];
          mesh.instanceMatrix.needsUpdate = true;
        });

        // Hazard collision detection
        for (let i = 0; i < eng.universe.hazards.length; i++) {
          const h = eng.universe.hazards[i];
          const hDist = h.position.distanceTo(eng.playerPosition);
          if (hDist < currentRadius + h.radius) {
            // Collision pushback & slight mass penalty
            const pushDir = new THREE.Vector3().subVectors(eng.playerPosition, h.position).normalize();
            eng.playerVelocity.addScaledVector(pushDir, 35);
            eng.mass = Math.max(10, eng.mass - h.damage * 0.5);
            setMass(eng.mass);
            soundManager.playSupernova();

            // Reposition hazard away
            h.position.addScaledVector(pushDir.negate(), 200);
          }
        }
      }

      // 3. Update Moon Orbits
      if (eng.moons.length > 0 && eng.moonGroup) {
        eng.moons = updateMoonOrbits(eng.moons, dt);
        updateMoonMeshes(eng.moonGroup, eng.moons, eng.playerPosition);
      }

      // 4. Update Dynamic Camera with Smooth Exponential Damping & Velocity Anticipation
      if (eng.camera) {
        const camDistance = Math.max(currentRadius * 2.5, eng.zoomDistance);
        // Dynamic look-ahead lead based on current meteorite velocity
        const lead = new THREE.Vector3(
          eng.playerVelocity.x * 0.4,
          eng.playerVelocity.y * 0.25,
          eng.playerVelocity.z * 0.4
        );
        const lookTarget = new THREE.Vector3().addVectors(eng.playerPosition, lead);

        const camX = lookTarget.x + Math.sin(eng.cameraRotation.yaw) * Math.cos(eng.cameraRotation.pitch) * camDistance;
        const camY = lookTarget.y + Math.sin(eng.cameraRotation.pitch) * camDistance;
        const camZ = lookTarget.z + Math.cos(eng.cameraRotation.yaw) * Math.cos(eng.cameraRotation.pitch) * camDistance;

        const desiredCamPos = new THREE.Vector3(camX, camY, camZ);
        // Frame-rate independent exponential smooth damping
        const smoothFactor = 1.0 - Math.exp(-7.5 * dt);
        eng.camera.position.lerp(desiredCamPos, smoothFactor);
        eng.camera.lookAt(lookTarget);

        // Keep starfield and nebula centered with camera to give infinite cosmic depth
        if (eng.starfield) {
          eng.starfield.position.copy(eng.camera.position);
        }
        if (eng.nebulaSky) {
          eng.nebulaSky.position.copy(eng.camera.position);
        }
      }

      // 5. Update derived HUD stats at ~5Hz to save React cycles
      if (Math.random() < 0.1) {
        const derived = deriveStats(
          eng.currentFormId,
          eng.mass,
          eng.age,
          eng.playerVelocity.length()
        );
        setStats(derived);
      }

      // Render Three.js Scene
      if (eng.renderer && eng.scene && eng.camera) {
        eng.renderer.render(eng.scene, eng.camera);
      }

      eng.frameId = requestAnimationFrame(tick);
    };

    eng.frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(eng.frameId);
      clearInterval(eventInterval);
      clearInterval(saveInterval);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      mount.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      mount.removeEventListener('contextmenu', handleContextMenu);
      mount.removeEventListener('wheel', handleWheel);
      if (renderer) renderer.dispose();
    };
  }, [worldSeed]);

  // Ability trigger handler
  const triggerPlayerAbility = useCallback(() => {
    const eng = engineRef.current;
    if (eng.abilityTimer > 0) return;

    const formDef = EVOLUTION_FORMS[eng.currentFormId];
    if (!formDef || formDef.abilities.length === 0) return;

    soundManager.playAbility();
    eng.abilityTimer = formDef.abilities[0].cooldown;
    setAbilityCooldown(eng.abilityTimer);

    // Apply ability effects based on current form
    if (formDef.stageLevel <= 2) {
      // Stardust Attraction pulse: draws nearby mineral matter directly inward
      soundManager.playAbility();
      if (eng.universe) {
        eng.universe.entities.forEach((ent) => {
          const d = ent.position.distanceTo(eng.playerPosition);
          if (d < 350) {
            const dir = new THREE.Vector3().subVectors(eng.playerPosition, ent.position).normalize();
            ent.velocity.addScaledVector(dir, 45);
          }
        });
      }
    } else if (formDef.id === 'white_hole') {
      // Eject matter burst in all directions!
      soundManager.playSupernova();
      if (eng.universe) {
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 40 + Math.random() * 30;
          eng.universe.entities.push({
            id: `ejected_${Date.now()}_${i}`,
            type: 'exotic_matter',
            position: eng.playerPosition.clone().add(new THREE.Vector3((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10)),
            velocity: new THREE.Vector3(Math.cos(angle) * speed, (Math.random() - 0.5) * 10, Math.sin(angle) * speed),
            rotation: new THREE.Euler(0, 0, 0),
            rotationSpeed: new THREE.Vector3(1, 1, 1),
            amount: 5,
            radius: 1.5,
            color: MATTER_COLORS['exotic_matter'],
            isConsumed: false,
          });
        }
      }
    } else {
      // Powerful Gravitational Vortex / Singularity Pull
      if (eng.universe) {
        eng.universe.entities.forEach((ent) => {
          const d = ent.position.distanceTo(eng.playerPosition);
          if (d < 450) {
            const dir = new THREE.Vector3().subVectors(eng.playerPosition, ent.position).normalize();
            ent.velocity.addScaledVector(dir, 50);
          }
        });
      }
    }
  }, []);

  // Perform Evolution Transformation
  const handlePerformEvolution = useCallback((targetFormId: CosmicFormId) => {
    const eng = engineRef.current;
    if (!eng.scene) return;

    soundManager.playEvolutionFanfare();
    eng.isEvolvingAnim = true;
    eng.evolveAnimProgress = 0;
    eng.currentFormId = targetFormId;
    setCurrentFormId(targetFormId);

    // Track in discovered codex
    if (!discoveredForms.includes(targetFormId)) {
      const updated = [...discoveredForms, targetFormId];
      setDiscoveredForms(updated);
      setDiscoveredPopup(targetFormId);
      soundManager.playDiscovery();
    }

    // Rebuild 3D Model
    if (eng.playerGroup) {
      eng.scene.remove(eng.playerGroup);
    }
    const newRadius = calculateRadius(targetFormId, eng.mass);
    const newGroup = createCosmicObjectGroup(targetFormId, newRadius);
    newGroup.position.copy(eng.playerPosition);
    eng.scene.add(newGroup);
    eng.playerGroup = newGroup;

    // Adjust camera distance to match new scale
    eng.zoomDistance = newRadius * 3.8;

    setShowEvolveModal(false);
  }, [discoveredForms]);

  // Start Evolution Game
  const handleStartGame = () => {
    soundManager.init();
    soundManager.playClick();
    setGameState('playing');
  };

  // Toggle Mute
  const handleToggleMute = () => {
    const nextMuted = !settings.muted;
    const newSettings = { ...settings, muted: nextMuted };
    setSettings(newSettings);
    soundManager.setMuted(nextMuted);
  };

  // Clean In-Memory Reset (Reliable across iframes and sandboxes)
  const executeCleanReset = useCallback(() => {
    clearGameState();
    const eng = engineRef.current;
    eng.mass = 30;
    eng.currentFormId = 'meteorite';
    eng.inventory = { ...INITIAL_INVENTORY };
    eng.moons = [];
    eng.age = 0;
    eng.abilityTimer = 0;
    eng.playerPosition.set(0, 0, 0);
    eng.playerVelocity.set(0, 0, 0);
    eng.cameraRotation = { yaw: 0, pitch: 0.35 };
    eng.zoomDistance = 35;

    // Reset universe matter distribution
    if (eng.universe) {
      eng.universe.resetWithSeed(worldSeed);
    }

    // Rebuild player 3D body as the Primordial Meteorite
    if (eng.playerGroup && eng.scene) {
      eng.scene.remove(eng.playerGroup);
      const newRadius = calculateRadius('meteorite', 30);
      const newGroup = createCosmicObjectGroup('meteorite', newRadius);
      newGroup.position.set(0, 0, 0);
      eng.scene.add(newGroup);
      eng.playerGroup = newGroup;
    }

    // Remove any orbiting moons
    if (eng.moonGroup) {
      while (eng.moonGroup.children.length > 0) {
        eng.moonGroup.remove(eng.moonGroup.children[0]);
      }
    }

    // Reset React state
    setMass(30);
    setCurrentFormId('meteorite');
    setInventory({ ...INITIAL_INVENTORY });
    setMoons([]);
    setDiscoveredForms(['meteorite']);
    setShowSettingsModal(false);
    setShowResetConfirm(false);

    soundManager.playDiscovery();
    setToastMessage('Cosmic journey reset to Primordial Meteorite!');
    setTimeout(() => setToastMessage(null), 4000);
  }, [worldSeed]);

  // Export Standalone HTML
  const handleExportHtml = () => {
    window.open('/cosmic_evolution.html', '_blank');
  };

  const currentFormDef = EVOLUTION_FORMS[currentFormId] || EVOLUTION_FORMS.meteorite;
  const availableEvolutions = getAvailableEvolutions(currentFormId);
  const canEvolveAny = availableEvolutions.some((fid) => canEvolve(fid, mass, inventory).can);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none font-sans text-slate-100 touch-none">
      {/* 3D WebGL Canvas Mount Container */}
      <div ref={canvasMountRef} className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing" />

      {/* Visual Finger Touch Indicator Ring */}
      {touchPoint.active && (
        <div
          className="pointer-events-none fixed z-30 transform -translate-x-1/2 -translate-y-1/2 transition-opacity duration-150"
          style={{ left: touchPoint.x, top: touchPoint.y }}
        >
          <div className="w-14 h-14 rounded-full border-2 border-cyan-400 bg-cyan-400/20 shadow-lg shadow-cyan-400/50 animate-ping" />
          <div className="absolute inset-2 rounded-full border border-white/80 bg-white/30" />
        </div>
      )}

      {/* ================= START / TITLE SCREEN ================= */}
      {gameState === 'title' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-between p-8 bg-gradient-to-b from-black/60 via-black/40 to-black/90 pointer-events-auto backdrop-blur-xs">
          {/* Bespoke inline SVG Title Lockup */}
          <div className="flex flex-col items-center mt-12 text-center animate-fade-in">
            <div className="relative flex items-center justify-center w-20 h-20 mb-4 rounded-full bg-gradient-to-tr from-cyan-600 via-indigo-600 to-amber-500 shadow-2xl shadow-cyan-500/20">
              <Sparkles className="w-10 h-10 text-white animate-spin-slow" />
              <div className="absolute inset-0 rounded-full border border-cyan-400/30 scale-125" />
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-sky-200 to-indigo-300 drop-shadow-md">
              COSMIC EVOLUTION 3D
            </h1>
            <p className="mt-3 text-sm md:text-base text-slate-300 max-w-lg font-light tracking-wide">
              From a single drifting chondritic meteorite to celestial worlds, blazing stars, and incomprehensible cosmic singularities.
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            <button
              onClick={handleStartGame}
              className="w-full py-4 px-8 rounded-xl font-bold text-lg tracking-wider text-black bg-gradient-to-r from-amber-400 via-sky-400 to-cyan-300 hover:from-amber-300 hover:to-cyan-200 shadow-xl shadow-cyan-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer"
            >
              <Play className="w-6 h-6 fill-black" />
              START EVOLUTION
            </button>

            <div className="grid grid-cols-3 gap-2 w-full">
              <button
                onClick={() => { setShowTreeModal(true); soundManager.playClick(); }}
                className="py-2.5 px-3 rounded-lg text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 flex flex-col items-center gap-1 transition"
              >
                <Compass className="w-4 h-4 text-sky-400" />
                TREE
              </button>
              <button
                onClick={() => { setShowCodexModal(true); soundManager.playClick(); }}
                className="py-2.5 px-3 rounded-lg text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 flex flex-col items-center gap-1 transition"
              >
                <BookOpen className="w-4 h-4 text-amber-400" />
                CODEX
              </button>
              <button
                onClick={() => { setShowSettingsModal(true); soundManager.playClick(); }}
                className="py-2.5 px-3 rounded-lg text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 flex flex-col items-center gap-1 transition"
              >
                <Settings className="w-4 h-4 text-purple-400" />
                SETTINGS
              </button>
            </div>
          </div>

          {/* Single Flat Control-Hint Line */}
          <div className="text-xs text-slate-300 font-mono tracking-wider flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300 font-bold">WASD / Arrows</span>
            <span>to Move Meteorite · Touch/Drag to Steer · Q/Space Capture · E Evolve</span>
          </div>
        </div>
      )}

      {/* ================= LIVE HUD OVERLAY ================= */}
      {gameState === 'playing' && (
        <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 md:p-6">
          {/* Top Status Bar: Form Badge & Resources Cluster */}
          <div className="flex items-start justify-between w-full">
            {/* Top-Left: Screenshot-matched HUD Cluster */}
            <div className="pointer-events-auto flex flex-col gap-3 select-none">
              <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10 shadow-2xl">
                {/* Circular Planet Preview Sphere */}
                <div
                  className="w-11 h-11 rounded-full shadow-lg border border-white/20 relative overflow-hidden flex items-center justify-center shrink-0"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, #ffffff 0%, ${currentFormDef.color} 50%, #050a14 100%)`,
                    boxShadow: `0 0 16px ${currentFormDef.color}66`,
                  }}
                >
                  <span className="text-[10px] font-black uppercase text-white/90 drop-shadow">
                    {currentFormDef.tier.slice(0, 3)}
                  </span>
                </div>

                <div className="flex flex-col min-w-[140px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold tracking-wide text-white drop-shadow-sm">
                      {currentFormDef.name}
                    </span>
                  </div>
                  
                  {/* Mass & Yellow Progress Bar (matching screenshot) */}
                  <div className="mt-1">
                    <div className="text-[11px] font-mono font-medium text-amber-300 tracking-tight">
                      {Math.floor(mass).toLocaleString()}
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden mt-0.5">
                      <div
                        className="h-full bg-amber-400 transition-all duration-300 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                        style={{
                          width: `${Math.min(100, Math.max(8, (mass / (availableEvolutions.length > 0 ? EVOLUTION_FORMS[availableEvolutions[0]].requirements.mass : Math.max(mass * 1.5, 500))) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Circular Action Buttons (matching screenshot: Settings [Esc], Capture [Q], Evolve [E]) */}
              <div className="flex items-center gap-3 pl-1">
                {/* Settings Button */}
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="flex flex-col items-center group transition active:scale-95"
                >
                  <div className="w-10 h-10 rounded-full bg-black/50 border border-white/25 flex items-center justify-center text-white/90 shadow-lg group-hover:bg-white/20 group-hover:border-white/50 transition">
                    <Settings className="w-4 h-4" />
                  </div>
                  <span className="text-[9px] font-mono text-white/60 mt-1 uppercase tracking-tighter">Esc</span>
                  <span className="text-[10px] text-white/80 font-medium -mt-0.5">Settings</span>
                </button>

                {/* Capture / Pull Button */}
                <button
                  onClick={triggerPlayerAbility}
                  disabled={abilityCooldown > 0}
                  className={`flex flex-col items-center group transition active:scale-95 ${abilityCooldown > 0 ? 'opacity-40' : ''}`}
                >
                  <div className="w-10 h-10 rounded-full bg-black/50 border border-white/25 flex items-center justify-center text-sky-300 shadow-lg group-hover:bg-sky-500/30 group-hover:border-sky-400 transition relative">
                    <Orbit className="w-4 h-4 animate-spin-slow" />
                    {abilityCooldown > 0 && (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white bg-black/70 rounded-full">
                        {abilityCooldown.toFixed(0)}s
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-white/60 mt-1 uppercase tracking-tighter">Q</span>
                  <span className="text-[10px] text-white/80 font-medium -mt-0.5">Capture</span>
                </button>

                {/* Evolution Path Button */}
                <button
                  onClick={() => setShowEvolveModal(true)}
                  className="flex flex-col items-center group transition active:scale-95 relative"
                >
                  <div
                    className={`w-10 h-10 rounded-full bg-black/50 border flex items-center justify-center shadow-lg transition ${
                      availableEvolutions.length > 0
                        ? 'border-amber-400 text-amber-300 bg-amber-500/20 shadow-[0_0_12px_rgba(251,191,36,0.5)] animate-pulse'
                        : 'border-white/25 text-white/90 group-hover:bg-white/20 group-hover:border-white/50'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                  </div>
                  {availableEvolutions.length > 0 && (
                    <span className="absolute -top-1 right-2 w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                  )}
                  <span className="text-[9px] font-mono text-white/60 mt-1 uppercase tracking-tighter">E</span>
                  <span className="text-[10px] text-white/80 font-medium -mt-0.5">Paths</span>
                </button>
              </div>
            </div>

            {/* Top-Right: Resources & Quick Controls */}
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800/80 rounded-2xl px-3 py-2 shadow-xl">
                <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                  <span className="flex items-center gap-1 text-amber-200" title="Rock">
                    <span className="w-2 h-2 rounded-full bg-stone-400" />
                    {Math.floor(inventory.rock)}
                  </span>
                  <span className="flex items-center gap-1 text-sky-300" title="Metal">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    {Math.floor(inventory.metal)}
                  </span>
                  <span className="flex items-center gap-1 text-cyan-300" title="Ice">
                    <span className="w-2 h-2 rounded-full bg-cyan-300" />
                    {Math.floor(inventory.ice)}
                  </span>
                  <span className="flex items-center gap-1 text-pink-300" title="Gas">
                    <span className="w-2 h-2 rounded-full bg-pink-400" />
                    {Math.floor(inventory.gas)}
                  </span>
                  <span className="flex items-center gap-1 text-amber-400" title="Plasma">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    {Math.floor(inventory.plasma)}
                  </span>
                  {inventory.dark_matter > 0 && (
                    <span className="flex items-center gap-1 text-purple-400" title="Dark Matter">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      {Math.floor(inventory.dark_matter)}
                    </span>
                  )}
                  {inventory.exotic_matter > 0 && (
                    <span className="flex items-center gap-1 text-emerald-400" title="Exotic Matter">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      {Math.floor(inventory.exotic_matter)}
                    </span>
                  )}
                </div>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                <button
                  onClick={handleToggleMute}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                  title={settings.muted ? 'Unmute' : 'Mute'}
                >
                  {settings.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>

              {/* Event Notification Banner */}
              {activeEventNotification && (
                <div className="flex items-center gap-2 bg-gradient-to-r from-purple-950/90 to-slate-950/90 border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-purple-200 animate-bounce">
                  <AlertTriangle className="w-4 h-4 text-purple-400" />
                  <div>
                    <div className="font-bold">{activeEventNotification.name}</div>
                    <div className="text-[10px] text-slate-300">{activeEventNotification.description}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ================= COLLAPSIBLE BOTTOM CONTROL DOCK ================= */}
          <div className="pointer-events-auto self-center flex flex-col items-center w-full max-w-2xl mb-2">
            {/* Collapse/Expand Toggle Pill */}
            <button
              onClick={() => setHudCollapsed(!hudCollapsed)}
              className="py-1 px-4 mb-1.5 rounded-full text-[11px] font-mono tracking-wider bg-slate-950/80 border border-slate-800/80 text-slate-400 hover:text-white flex items-center gap-1.5 transition"
            >
              {hudCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {hudCollapsed ? 'EXPAND DOCK' : 'COLLAPSE DOCK'}
            </button>

            {!hudCollapsed && (
              <div className="w-full bg-slate-950/90 border border-slate-800/90 rounded-2xl p-3 md:p-4 shadow-2xl flex flex-col gap-3">
                {/* Evolution Requirement & Mass Progress Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Orbit className="w-3.5 h-3.5 text-sky-400" />
                      GROWTH PROGRESS
                    </span>
                    <span className="font-bold text-amber-300">
                      {Math.floor(mass).toLocaleString()} MASS
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-amber-400 transition-all duration-300 rounded-full"
                      style={{
                        width: `${Math.min(100, (mass / (availableEvolutions.length > 0 ? EVOLUTION_FORMS[availableEvolutions[0]].requirements.mass : 100000)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Physics Stats Cluster */}
                {stats && (
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-2 text-center text-[10px] md:text-[11px] font-mono">
                    <div className="p-1.5 rounded-lg bg-slate-900/60 border border-slate-800/60">
                      <div className="text-slate-500">RADIUS</div>
                      <div className="font-bold text-slate-200">{stats.radius.toFixed(1)} km</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-slate-900/60 border border-slate-800/60">
                      <div className="text-slate-500">GRAVITY</div>
                      <div className="font-bold text-sky-300">{stats.gravity.toFixed(1)} G</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-slate-900/60 border border-slate-800/60">
                      <div className="text-slate-500">TEMP</div>
                      <div className="font-bold text-amber-300">{Math.floor(stats.temperature)} K</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-slate-900/60 border border-slate-800/60">
                      <div className="text-slate-500">VELOCITY</div>
                      <div className="font-bold text-emerald-300">{stats.velocity.toFixed(1)} km/s</div>
                    </div>
                    <div className="hidden md:block p-1.5 rounded-lg bg-slate-900/60 border border-slate-800/60">
                      <div className="text-slate-500">DENSITY</div>
                      <div className="font-bold text-purple-300">{stats.density.toFixed(1)} g/cm³</div>
                    </div>
                    <div className="hidden md:block p-1.5 rounded-lg bg-slate-900/60 border border-slate-800/60">
                      <div className="text-slate-500">ENERGY</div>
                      <div className="font-bold text-pink-300">{Math.floor(stats.energy).toLocaleString()}</div>
                    </div>
                  </div>
                )}

                {/* Interactive Action Dock Buttons */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setShowTreeModal(true); soundManager.playClick(); }}
                      className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-700/60 flex items-center gap-1.5 transition"
                    >
                      <Compass className="w-3.5 h-3.5 text-sky-400" />
                      TREE
                    </button>
                    <button
                      onClick={() => { setShowCodexModal(true); soundManager.playClick(); }}
                      className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-700/60 flex items-center gap-1.5 transition"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                      CODEX
                    </button>
                    <button
                      onClick={() => { setShowSettingsModal(true); soundManager.playClick(); }}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 transition"
                      title="Settings"
                    >
                      <Settings className="w-4 h-4 text-purple-400" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Ability / Boost Button */}
                    <button
                      onClick={triggerPlayerAbility}
                      disabled={abilityCooldown > 0}
                      className={`py-1.5 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                        abilityCooldown > 0
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {abilityCooldown > 0 ? `${abilityCooldown.toFixed(1)}s` : currentFormDef.abilities[0]?.name || 'ABILITY'}
                    </button>

                    {/* Evolve Button (Pulses when ready!) */}
                    <button
                      onClick={() => {
                        setShowEvolveModal(true);
                        soundManager.playClick();
                      }}
                      className={`py-1.5 px-5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                        canEvolveAny
                          ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-lg shadow-amber-400/40 hover:scale-105 active:scale-95 cursor-pointer font-black'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {canEvolveAny ? 'EVOLVE READY' : 'EVOLUTIONS'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= NEW DISCOVERY POPUP MODAL ================= */}
      {discoveredPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs pointer-events-auto animate-fade-in">
          <div className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/50 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-tr from-amber-500 to-yellow-300 text-black shadow-xl shadow-amber-500/30">
              <Sparkles className="w-8 h-8" />
            </div>
            <span className="text-xs uppercase font-mono tracking-widest text-amber-400 font-bold mb-1">
              NEW COSMIC FORM DISCOVERED
            </span>
            <h2 className="text-2xl font-black text-white mb-2">
              {EVOLUTION_FORMS[discoveredPopup]?.name}
            </h2>
            <div className="text-xs font-mono text-slate-400 mb-4 px-2 py-0.5 rounded bg-slate-800">
              {EVOLUTION_FORMS[discoveredPopup]?.stageName} · Tier: {EVOLUTION_FORMS[discoveredPopup]?.tier}
            </div>
            <p className="text-sm text-slate-300 mb-4 leading-relaxed font-light">
              {EVOLUTION_FORMS[discoveredPopup]?.description}
            </p>
            <div className="w-full p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-left text-slate-300 mb-5 font-mono">
              <div className="text-amber-400 font-bold mb-1">Special Ability:</div>
              <div>{EVOLUTION_FORMS[discoveredPopup]?.abilities[0]?.name} - {EVOLUTION_FORMS[discoveredPopup]?.abilities[0]?.description}</div>
            </div>
            <button
              onClick={() => {
                setDiscoveredPopup(null);
                soundManager.playClick();
              }}
              className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-400 to-yellow-400 text-black hover:opacity-90 transition"
            >
              CONTINUE COSMIC DRIFT
            </button>
          </div>
        </div>
      )}

      {/* ================= EVOLUTION CHOICE MODAL ================= */}
      {showEvolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs pointer-events-auto animate-fade-in">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div>
                <h2 className="text-2xl font-black tracking-wide text-white">COSMIC EVOLUTION CHOICES</h2>
                <p className="text-xs text-slate-400 mt-1">Select your evolutionary metamorphosis branch.</p>
              </div>
              <button
                onClick={() => setShowEvolveModal(false)}
                className="py-1 px-3 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {availableEvolutions.map((formKey) => {
                const targetDef = EVOLUTION_FORMS[formKey];
                const check = canEvolve(formKey, mass, inventory);

                return (
                  <div
                    key={formKey}
                    className={`flex flex-col justify-between p-4 rounded-2xl border transition-all ${
                      check.can
                        ? 'bg-slate-900/90 border-sky-500/60 hover:border-amber-400/80 shadow-lg'
                        : 'bg-slate-950/60 border-slate-800/60 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {targetDef.tier}
                        </span>
                        <div
                          className="w-4 h-4 rounded-full border border-white/20"
                          style={{ backgroundColor: targetDef.color }}
                        />
                      </div>
                      <h3 className="font-bold text-base text-white mb-1">{targetDef.name}</h3>
                      <p className="text-xs text-slate-400 mb-3 leading-snug">{targetDef.description}</p>

                      <div className="text-[11px] font-mono text-slate-300 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80 mb-3">
                        <div className="text-slate-400 font-semibold mb-1">Requirements:</div>
                        <div>Mass: {targetDef.requirements.mass.toLocaleString()}</div>
                        {targetDef.requirements.requiredMatters &&
                          Object.entries(targetDef.requirements.requiredMatters).map(([mType, amt]) => (
                            <div key={mType} className="capitalize">
                              {mType}: {amt}
                            </div>
                          ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handlePerformEvolution(formKey)}
                      disabled={!check.can}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition ${
                        check.can
                          ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black hover:scale-[1.02] shadow-md shadow-amber-500/20 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {check.can ? 'CHOOSE EVOLUTION' : 'LOCKED'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= EVOLUTION TREE MODAL ================= */}
      {showTreeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs pointer-events-auto animate-fade-in">
          <div className="w-full max-w-4xl max-h-[85vh] overflow-y-auto bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div>
                <h2 className="text-2xl font-black text-white">COSMIC EVOLUTION TREE</h2>
                <p className="text-xs text-slate-400 mt-1">Explore all cosmological progression trajectories.</p>
              </div>
              <button
                onClick={() => setShowTreeModal(false)}
                className="py-1 px-3 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-6">
              {[1, 2, 3, 4, 5, 6, 7].map((lvl) => {
                const formsInLevel = Object.values(EVOLUTION_FORMS).filter((f) => f.stageLevel === lvl);
                return (
                  <div key={lvl} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                    <div className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider mb-3">
                      STAGE {lvl}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {formsInLevel.map((f) => {
                        const isUnlocked = discoveredForms.includes(f.id);
                        return (
                          <div
                            key={f.id}
                            className={`p-3 rounded-xl border text-xs ${
                              isUnlocked
                                ? 'bg-slate-800/80 border-slate-700 text-white'
                                : 'bg-slate-950/40 border-slate-800/50 text-slate-600'
                            }`}
                          >
                            <div className="font-bold mb-1">
                              {isUnlocked ? f.name : f.isMysterious ? '?????????' : f.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {isUnlocked ? f.tier : 'Undiscovered'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= CODEX / DISCOVERY ENCYCLOPEDIA ================= */}
      {showCodexModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs pointer-events-auto animate-fade-in">
          <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div>
                <h2 className="text-2xl font-black text-white">COSMIC CODEX</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Discovered Celestial Forms ({discoveredForms.length} / {Object.keys(EVOLUTION_FORMS).length})
                </p>
              </div>
              <button
                onClick={() => setShowCodexModal(false)}
                className="py-1 px-3 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.values(EVOLUTION_FORMS).map((f) => {
                const isDiscovered = discoveredForms.includes(f.id);
                return (
                  <div
                    key={f.id}
                    className={`p-4 rounded-2xl border text-xs flex flex-col justify-between ${
                      isDiscovered
                        ? 'bg-slate-900/80 border-slate-800 text-slate-200'
                        : 'bg-slate-950/40 border-slate-900 text-slate-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-white">
                          {isDiscovered ? f.name : 'Unknown Cosmic Entity'}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          {isDiscovered ? f.tier : '???'}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs mb-3">
                        {isDiscovered ? f.lore : 'Traverse the cosmos and meet the physical thresholds to discover this form.'}
                      </p>
                    </div>
                    {isDiscovered && (
                      <div className="text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-2 flex items-center justify-between">
                        <span>Base Radius: {f.baseRadius} km</span>
                        <span>Stage {f.stageLevel}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= SETTINGS MODAL ================= */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs pointer-events-auto animate-fade-in">
          <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <h2 className="text-xl font-black text-white">SETTINGS & EXPORT</h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="py-1 px-3 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono mb-6">
              <div>
                <label className="text-slate-400 block mb-1">Audio Master Volume</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.sfxVolume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setSettings({ ...settings, sfxVolume: val });
                    soundManager.setVolume(val);
                  }}
                  className="w-full accent-amber-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Universe Deterministic Seed</label>
                <input
                  type="text"
                  value={worldSeed}
                  onChange={(e) => setWorldSeed(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-800">
                <button
                  onClick={handleExportHtml}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-semibold flex items-center justify-center gap-2 transition"
                >
                  <Download className="w-4 h-4 text-sky-400" />
                  EXPORT STANDALONE HTML
                </button>
              </div>

              <div>
                {!showResetConfirm ? (
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="w-full py-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    RESET COSMIC JOURNEY
                  </button>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-red-950/70 border border-red-500/60 flex flex-col gap-2.5 animate-fade-in">
                    <div className="flex items-center gap-2 text-red-300 font-bold text-xs tracking-wide">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>Confirm Cosmic Reset?</span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-sans leading-normal">
                      All celestial progress, collected mass, and forms will be restored to the Primordial Meteorite (Mass: 30).
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-0.5">
                      <button
                        onClick={executeCleanReset}
                        className="py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition shadow-md shadow-red-900/40 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        YES, RESET
                      </button>
                      <button
                        onClick={() => setShowResetConfirm(false)}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Status Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-slate-900/95 border border-sky-400/60 text-sky-200 text-xs font-mono font-bold tracking-wide shadow-2xl backdrop-blur-md animate-bounce pointer-events-none">
          ✦ {toastMessage}
        </div>
      )}
    </div>
  );
};
