import * as THREE from 'three';
import { EVOLUTION_FORMS } from './evolutionData';
import { CosmicFormId, MoonOrbit } from './types';

// Fast 2D Value Noise generator for high-fidelity procedural textures
function createNoise2D(seed = 1337) {
  const perm = new Uint8Array(512);
  let s = seed >>> 0;
  function rnd() {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return (s >>> 0) / 4294967296;
  }
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 256; i++) {
    perm[i] = perm[i + 256] = p[i];
  }

  return function (x: number, y: number) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = perm[X] + Y;
    const b = perm[X + 1] + Y;
    const aa = perm[a] / 255;
    const ab = perm[a + 1] / 255;
    const ba = perm[b] / 255;
    const bb = perm[b + 1] / 255;
    const x1 = (1 - u) * aa + u * ba;
    const x2 = (1 - u) * ab + u * bb;
    return (1 - v) * x1 + v * x2;
  };
}

// Fractal Brownian Motion (fBm)
function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves = 6): number {
  let v = 0;
  let a = 0.5;
  let f = 1.0;
  for (let i = 0; i < octaves; i++) {
    v += noise(x * f, y * f) * a;
    f *= 2.0;
    a *= 0.5;
  }
  return v;
}

// Procedural Bump Map Generator for tactile 3D surface relief
export function createBumpMap(type: 'rock' | 'earth' | 'lunar' | 'lava', size: number = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;
  const n1 = createNoise2D(77);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const height = fbm(n1, u * 8, v * 8, 4);
      const val = Math.floor(height * 255);
      const idx = (y * size + x) * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// Generate photorealistic procedural textures matching the user's reference image
export function createProceduralTexture(
  type:
    | 'earth'
    | 'clouds'
    | 'rock'
    | 'lunar'
    | 'metal'
    | 'ice'
    | 'lava'
    | 'desert'
    | 'gas_giant'
    | 'ice_giant'
    | 'eyeball'
    | 'sulfur_volcano'
    | 'nebula_bg',
  size: number = 512
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const n1 = createNoise2D(42);
  const n2 = createNoise2D(99);
  const n3 = createNoise2D(314);

  if (type === 'earth') {
    // Photorealistic Earth: deep navy oceans, shallow coastal turquoise reefs, lush green biomes, arid deserts, mountain snow caps, and polar ice caps
    for (let y = 0; y < size; y++) {
      const lat = (y / size) * Math.PI - Math.PI / 2;
      const isPolar = Math.abs(lat) > 1.22;

      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const nx = Math.cos(u * Math.PI * 2) * 2.2;
        const ny = Math.sin(u * Math.PI * 2) * 2.2;
        const nz = (v - 0.5) * 4.4;

        const elevation = fbm(n1, nx + 10, ny + nz + 10, 6);
        const moisture = fbm(n2, nx + 25, ny + nz + 25, 4);

        let r = 0, g = 0, b = 0;

        if (isPolar && elevation > 0.36) {
          // Polar ice cap & glacier shelves
          r = 230; g = 242; b = 255;
        } else if (elevation < 0.43) {
          // Deep Oceanic Abyssal Trench
          r = 5; g = 18; b = 48;
        } else if (elevation < 0.48) {
          // Open Ocean
          r = 12; g = 42; b = 95;
        } else if (elevation < 0.51) {
          // Continental Shelf Shallow Turquoise Water
          r = 22; g = 135; b = 175;
        } else if (elevation < 0.53) {
          // Coastal White Sand Beaches
          r = 215; g = 195; b = 145;
        } else if (elevation < 0.67) {
          // Continental Lowlands: Temperate Forest or Arid Savanna
          if (moisture > 0.48) {
            r = 30; g = 105; b = 50; // Lush green forest
          } else {
            r = 150; g = 125; b = 75; // Arid savanna
          }
        } else if (elevation < 0.77) {
          // Rugged Mountain Highlands
          r = 115; g = 88; b = 62;
        } else {
          // Alpine Glacier Snow Caps
          r = 245; g = 248; b = 255;
        }

        const idx = (y * size + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
  } else if (type === 'eyeball') {
    // Eyeball Planet (From row 3, col 3 of the 25-planet reference image):
    // Tidally locked planet with concentric glacier ice sheets and a striking open circular sapphire sea!
    const centerX = size * 0.5;
    const centerY = size * 0.5;
    const maxRadius = size * 0.42;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - centerX) / maxRadius;
        const dy = (y - centerY) / maxRadius;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);

        const noiseWarp = fbm(n1, (x / size) * 8, (y / size) * 8, 4) * 0.18;
        const effectiveDist = distFromCenter + noiseWarp;

        let r = 0, g = 0, b = 0;

        if (effectiveDist < 0.45) {
          // Central warm subsolar open ocean (deep sapphire blue)
          const oceanDepth = effectiveDist / 0.45;
          r = Math.floor(10 + oceanDepth * 25);
          g = Math.floor(40 + oceanDepth * 90);
          b = Math.floor(110 + oceanDepth * 90);
        } else if (effectiveDist < 0.65) {
          // Coastal ring of slush and melting turquoise shallows
          const t = (effectiveDist - 0.45) / 0.2;
          r = Math.floor(35 + t * 140);
          g = Math.floor(130 + t * 90);
          b = Math.floor(180 + t * 65);
        } else if (effectiveDist < 0.85) {
          // Cracked pack ice and crevasses
          const crack = fbm(n2, (x / size) * 16, (y / size) * 16, 5);
          if (crack > 0.68) {
            r = 130; g = 170; b = 210; // Blue ice crevasse
          } else {
            r = 220; g = 230; b = 242; // White pack ice
          }
        } else {
          // Global permanent nightside/polar glacier sheet
          const glacialShade = Math.floor(215 + fbm(n3, (x / size) * 6, (y / size) * 6, 3) * 35);
          r = glacialShade;
          g = glacialShade + 5;
          b = Math.min(255, glacialShade + 15);
        }

        const idx = (y * size + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
  } else if (type === 'gas_giant') {
    // Photorealistic Jupiter-style Gas Giant (Row 4, Col 1 of reference image):
    // Alternating turbulent cloud bands, Coriolis eddies, white oval storms, and iconic Great Red Spot
    const spotX = size * 0.62;
    const spotY = size * 0.66;
    const spotRx = size * 0.12;
    const spotRy = size * 0.06;

    for (let y = 0; y < size; y++) {
      const v = y / size;
      // High-frequency alternating atmospheric band base
      const bandWave = Math.sin(v * Math.PI * 14) * 0.5 + 0.5;
      const subBand = Math.sin(v * Math.PI * 28) * 0.25;

      for (let x = 0; x < size; x++) {
        const u = x / size;

        // Coriolis turbulence & wave eddies
        const eddy1 = fbm(n1, u * 12, v * 3, 5);
        const eddy2 = fbm(n2, u * 24 + eddy1 * 2, v * 6, 4) * 0.35;
        const turbulence = bandWave * 0.6 + eddy1 * 0.3 + subBand + eddy2;

        // Base Jovian palette (creamy zones, terracotta/ochre belts, rust stripes)
        let r = Math.floor(180 + turbulence * 60);
        let g = Math.floor(125 + turbulence * 40);
        let b = Math.floor(80 + turbulence * 30);

        // Check for Great Red Spot vortex
        const sDistX = (x - spotX) / spotRx;
        const sDistY = (y - spotY) / spotRy;
        const spotDist = Math.sqrt(sDistX * sDistX + sDistY * sDistY);

        if (spotDist < 1.0) {
          // Swirling anticyclonic storm center (vivid reddish-orange)
          const stormSpiral = Math.sin(spotDist * Math.PI * 4 + Math.atan2(sDistY, sDistX) * 2) * 0.15;
          const spotIntensity = (1.0 - spotDist) + stormSpiral;
          r = Math.min(255, Math.floor(215 + spotIntensity * 35));
          g = Math.floor(65 + spotIntensity * 25);
          b = Math.floor(45 + spotIntensity * 15);
        } else if (spotDist < 1.35) {
          // White storm turbulence halo around Great Red Spot
          const haloT = (1.35 - spotDist) / 0.35;
          r = Math.floor(r * (1 - haloT) + 240 * haloT);
          g = Math.floor(g * (1 - haloT) + 225 * haloT);
          b = Math.floor(b * (1 - haloT) + 205 * haloT);
        }

        const idx = (y * size + x) * 4;
        data[idx] = Math.min(255, r);
        data[idx + 1] = Math.min(255, g);
        data[idx + 2] = Math.min(255, b);
        data[idx + 3] = 255;
      }
    }
  } else if (type === 'ice_giant') {
    // Neptunian / Uranian Ice Giant (Row 3, Col 2 of reference image):
    // Smooth, serene cyan-cerulean atmospheric haze with subtle white methane cirrus cloud streaks
    for (let y = 0; y < size; y++) {
      const v = y / size;
      const poleShade = 1.0 - Math.pow(Math.abs(v - 0.5) * 1.8, 2) * 0.25;

      for (let x = 0; x < size; x++) {
        const u = x / size;
        const cloudStreak = fbm(n1, u * 16, v * 2, 4);
        const streakAlpha = Math.max(0, (cloudStreak - 0.58) * 3);

        const r = Math.floor((45 + streakAlpha * 140) * poleShade);
        const g = Math.floor((140 + streakAlpha * 105) * poleShade);
        const b = Math.floor((210 + streakAlpha * 45) * poleShade);

        const idx = (y * size + x) * 4;
        data[idx] = Math.min(255, r);
        data[idx + 1] = Math.min(255, g);
        data[idx + 2] = Math.min(255, b);
        data[idx + 3] = 255;
      }
    }
  } else if (type === 'sulfur_volcano') {
    // Volcanic Sulfur World (Io style, Row 2, Col 2 of reference image):
    // Olive greens, bright sulfur yellows, dark volcanic calderas with lava centers
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const base = fbm(n1, u * 6, v * 6, 5);
        const calderaNoise = fbm(n2, u * 12, v * 12, 4);

        let r = 0, g = 0, b = 0;
        if (calderaNoise > 0.72) {
          // Caldera pit with molten lava
          r = 255; g = 90; b = 20;
        } else if (base > 0.55) {
          // Sulfur yellow plains
          r = 210; g = 190; b = 60;
        } else if (base > 0.42) {
          // Olive-green silicates
          r = 135; g = 145; b = 65;
        } else {
          // Burnt orange crust
          r = 160; g = 95; b = 45;
        }

        const idx = (y * size + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
  } else if (type === 'lava') {
    // Molten Magma World (Row 1, Col 3 of reference image):
    // Dark cooling basalt crust plates with fiery glowing yellow/orange magma fissure networks
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const fissure = fbm(n1, u * 8, v * 8, 5);
        const microCrack = fbm(n2, u * 20, v * 20, 3) * 0.2;
        const total = fissure + microCrack;

        let r = 0, g = 0, b = 0;
        if (total > 0.62) {
          // Blazing magma fissure
          const heat = (total - 0.62) / 0.38;
          r = 255;
          g = Math.floor(100 + heat * 155);
          b = Math.floor(20 + heat * 40);
        } else {
          // Cooled obsidian basalt crust
          const c = Math.floor(total * 45 + 15);
          r = c + 15;
          g = c + 5;
          b = c;
        }

        const idx = (y * size + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
  } else if (type === 'clouds') {
    // Dynamic swirling weather fronts, hurricane spirals, and soft translucent cloud cover
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const nx = Math.cos(u * Math.PI * 2) * 2.8;
        const ny = Math.sin(u * Math.PI * 2) * 2.8;
        const nz = (v - 0.5) * 5.5;

        // Swirling atmospheric warp
        const warp = fbm(n2, nx * 2, ny * 2 + nz, 3) * 0.5;
        const density = fbm(n1, nx + warp, ny + nz + warp, 5);

        const alpha = Math.max(0, Math.min(255, (density - 0.45) * 650));
        const idx = (y * size + x) * 4;
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = alpha;
      }
    }
  } else if (type === 'rock' || type === 'lunar') {
    // Realistic impact craters, rayed basins, and basaltic regolith (Row 2, Col 4 of reference image)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x / size) * 5;
        const v = (y / size) * 5;* 4, 3) * 0.2;
        const val = Math.min(1, Math.max(0, base * 0.85 + fine));

        const base = fbm(n1, u, v, 6);
        const fine = fbm(n2, u * 4, v 
        const shade = Math.floor(val * 160 + 50);
        const idx = (y * size + x) * 4;
        data[idx] = Math.floor(shade * 1.05);
        data[idx + 1] = shade;
        data[idx + 2] = Math.floor(shade * 0.96);
        data[idx + 3] = 255;
      }
    }
    // High-fidelity impact crater stamps
    ctx.putImageData(imgData, 0, 0);
    const craterRng = createNoise2D(888);
    for (let i = 0; i < 50; i++) {
      const cx = (craterRng(i * 1.2, 0.5) * 0.5 + 0.5) * size;
      const cy = (craterRng(0.5, i * 1.2) * 0.5 + 0.5) * size;
      const cr = 4 + craterRng(i, i) * 18;

      // Dark shadow floor
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(25, 22, 20, 0.45)';
      ctx.fill();

      // Bright illuminated rim
      ctx.beginPath();
      ctx.arc(cx + 1.2, cy + 1.2, cr * 0.95, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(235, 230, 225, 0.4)';
      ctx.lineWidth = 2.0;
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  } else if (type === 'metal') {
    // Nickel-iron metallic asteroid texture with crystalline scratches
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const base = fbm(n1, (x / size) * 6, (y / size) * 6, 5);
        const val = Math.floor(base * 110 + 95);
        const idx = (y * size + x) * 4;
        data[idx] = Math.floor(val * 0.92);
        data[idx + 1] = Math.floor(val * 0.96);
        data[idx + 2] = Math.min(255, Math.floor(val * 1.18));
        data[idx + 3] = 255;
      }
    }
  } else if (type === 'ice') {
    // Cryogenic ice with glacier fractures
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const base = fbm(n1, (x / size) * 5, (y / size) * 5, 5);
        const val = Math.floor(base * 140 + 105);
        const idx = (y * size + x) * 4;
        data[idx] = Math.floor(val * 0.65);
        data[idx + 1] = Math.floor(val * 0.88);
        data[idx + 2] = Math.min(255, Math.floor(val * 1.25));
        data[idx + 3] = 255;
      }
    }
  } else if (type === 'desert') {
    // Rust-tinted dune patterns and deep canyon fissures
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const base = fbm(n1, (x / size) * 5, (y / size) * 5, 5);
        const dunes = Math.sin(y * 0.18 + base * 8) * 0.5 + 0.5;
        const idx = (y * size + x) * 4;
        data[idx] = Math.floor(195 + dunes * 40);
        data[idx + 1] = Math.floor(115 + dunes * 30);
        data[idx + 2] = Math.floor(45 + dunes * 20);
        data[idx + 3] = 255;
      }
    }
  } else if (type === 'nebula_bg') {
    // Deep Space Nebula matching the user's screenshot: glowing cyan/cerulean clouds against deep navy space
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;

        const nx = Math.cos(u * Math.PI * 2) * Math.sin(v * Math.PI);
        const ny = Math.cos(v * Math.PI);
        const nz = Math.sin(u * Math.PI * 2) * Math.sin(v * Math.PI);

        const gas1 = fbm(n1, nx * 2.2 + 10, ny * 2.2 + 10, 6);
        const gas2 = fbm(n2, nz * 3.5 + 40, nx * 3.5 + 40, 5);
        const nebulaIntensity = Math.max(0, gas1 * 0.65 + gas2 * 0.35 - 0.25);

        const r = Math.floor(4 + nebulaIntensity * 125);
        const g = Math.floor(10 + nebulaIntensity * 195);
        const b = Math.floor(26 + nebulaIntensity * 255);

        const idx = (y * size + x) * 4;
        data[idx] = Math.min(255, r);
        data[idx + 1] = Math.min(255, g);
        data[idx + 2] = Math.min(255, b);
        data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Deep Space Nebula Sky Dome (realistic cyan-blue glow matching the screenshot)
export function createRealisticNebulaSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(3500, 32, 32);
  const tex = createProceduralTexture('nebula_bg', 512);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.name = 'realistic_nebula_sky';
  return sky;
}

// Atmospheric Rayleigh Scattering Glow Halo for Planets
export function createAtmosphereGlow(radius: number, colorHex = '#38bdf8'): THREE.Mesh {
  const atmoGeo = new THREE.SphereGeometry(radius * 1.15, 32, 32);
  const atmoMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(colorHex),
    transparent: true,
    opacity: 0.35,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(atmoGeo, atmoMat);
}

// Generate Realistic 3D Models for all cosmic forms matching the 25 planet types
export function createCosmicObjectGroup(formId: CosmicFormId, radius: number): THREE.Group {
  const group = new THREE.Group();
  group.name = `cosmic_form_${formId}`;

  const formDef = EVOLUTION_FORMS[formId];
  const col = new THREE.Color(formDef?.color || '#ffffff');
  const emissiveCol = new THREE.Color(formDef?.emissiveColor || '#000000');

  switch (formId) {
    case 'meteorite': {
      // Realistic craggy meteorite with deformed facets, crater depressions, and bump mapping
      const coreGeo = new THREE.DodecahedronGeometry(radius, 3);
      const pos = coreGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const noise = 1 + Math.sin(vx * 2.5) * Math.cos(vy * 2.5) * 0.16 - Math.sin(vz * 3) * 0.08;
        pos.setXYZ(i, vx * noise, vy * noise, vz * noise);
      }
      coreGeo.computeVertexNormals();
      const coreMat = new THREE.MeshStandardMaterial({
        color: '#8b8478',
        roughness: 0.9,
        metalness: 0.15,
        map: createProceduralTexture('rock', 256),
        bumpMap: createBumpMap('rock', 256),
        bumpScale: 0.08,
      });
      group.add(new THREE.Mesh(coreGeo, coreMat));

      // Realistic impact boulders orbiting the meteorite
      for (let j = 0; j < 4; j++) {
        const mGeo = new THREE.DodecahedronGeometry(radius * 0.22, 1);
        const mMat = new THREE.MeshStandardMaterial({ color: '#574e44', roughness: 0.95 });
        const mMesh = new THREE.Mesh(mGeo, mMat);
        const ang = (j / 4) * Math.PI * 2;
        mMesh.position.set(Math.cos(ang) * radius * 0.88, (j % 2 - 0.5) * radius * 0.5, Math.sin(ang) * radius * 0.88);
        group.add(mMesh);
      }
      break;
    }

    // ---------------- Stage 2: Asteroids ----------------
    case 'asteroid_rocky':
    case 'asteroid_carbonaceous': {
      const isCarbon = formId === 'asteroid_carbonaceous';
      const geo = new THREE.DodecahedronGeometry(radius, 3);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const n = 1.0 + Math.sin(vx * 1.8) * Math.sin(vz * 1.8) * 0.18 - Math.cos(vy * 2.2) * 0.1;
        pos.setXYZ(i, vx * n, vy * n, vz * n);
      }
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({
        color: isCarbon ? '#3f3f46' : '#8a7968',
        roughness: 0.92,
        metalness: 0.12,
        map: createProceduralTexture('rock', 512),
        bumpMap: createBumpMap('rock', 256),
        bumpScale: 0.12,
      });
      group.add(new THREE.Mesh(geo, mat));
      break;
    }

    case 'asteroid_metallic': {
      // Nickel-iron crystalline meteorite
      const geo = new THREE.OctahedronGeometry(radius, 3);
      const mat = new THREE.MeshStandardMaterial({
        color: '#a0a8b2',
        metalness: 0.92,
        roughness: 0.28,
        map: createProceduralTexture('metal', 512),
      });
      group.add(new THREE.Mesh(geo, mat));

      // Magnetic flux ring
      const ringGeo = new THREE.TorusGeometry(radius * 1.35, radius * 0.03, 8, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: '#7098c7', transparent: true, opacity: 0.45 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 3;
      group.add(ring);
      break;
    }

    case 'asteroid_icy': {
      // Translucent cryo-core with frost vapors
      const geo = new THREE.IcosahedronGeometry(radius, 2);
      const mat = new THREE.MeshStandardMaterial({
        color: '#8be5ff',
        roughness: 0.2,
        metalness: 0.1,
        transparent: true,
        opacity: 0.88,
        map: createProceduralTexture('ice', 256),
      });
      group.add(new THREE.Mesh(geo, mat));
      break;
    }

    case 'asteroid_crystalline': {
      // Prismatic gemstone asteroid
      const geo = new THREE.IcosahedronGeometry(radius, 1);
      const mat = new THREE.MeshPhysicalMaterial({
        color: '#c084fc',
        roughness: 0.1,
        metalness: 0.2,
        transmission: 0.6,
        transparent: true,
        opacity: 0.9,
      });
      group.add(new THREE.Mesh(geo, mat));
      break;
    }

    // ---------------- Stage 3: Mini Planets ----------------
    case 'mini_planet_rocky':
    case 'mini_planet_ocean':
    case 'mini_planet_volcanic':
    case 'mini_planet_desert':
    case 'mini_planet_crystal': {
      const isVolcanic = formId === 'mini_planet_volcanic';
      const isOcean = formId === 'mini_planet_ocean';
      const isDesert = formId === 'mini_planet_desert';

      const sphereGeo = new THREE.SphereGeometry(radius, 48, 48);
      const texType = isVolcanic ? 'sulfur_volcano' : isOcean ? 'eyeball' : isDesert ? 'desert' : 'lunar';
      const sphereMat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: isOcean ? 0.35 : 0.8,
        metalness: isVolcanic ? 0.35 : 0.08,
        emissive: emissiveCol,
        emissiveIntensity: isVolcanic ? 0.5 : 0.02,
        map: createProceduralTexture(texType, 512),
        bumpMap: isOcean ? undefined : createBumpMap('rock', 256),
        bumpScale: 0.06,
      });
      group.add(new THREE.Mesh(sphereGeo, sphereMat));

      // Atmospheric rim haze
      group.add(createAtmosphereGlow(radius, isOcean ? '#38bdf8' : isVolcanic ? '#f97316' : '#94a3b8'));
      break;
    }

    // ---------------- Stage 4: Full Planets (Matching 25 Planet Types Photo) ----------------
    case 'planet_terrestrial': {
      // 1. Earth Surface (continents, blue oceans, elevation relief)
      const earthGeo = new THREE.SphereGeometry(radius, 64, 64);
      const earthMat = new THREE.MeshStandardMaterial({
        roughness: 0.45,
        metalness: 0.05,
        map: createProceduralTexture('earth', 512),
        bumpMap: createBumpMap('earth', 256),
        bumpScale: 0.05,
      });
      group.add(new THREE.Mesh(earthGeo, earthMat));

      // 2. Realistic dynamic cloud envelope with shadows
      const cloudGeo = new THREE.SphereGeometry(radius * 1.025, 48, 48);
      const cloudMat = new THREE.MeshStandardMaterial({
        map: createProceduralTexture('clouds', 512),
        transparent: true,
        opacity: 0.85,
        blending: THREE.NormalBlending,
      });
      const clouds = new THREE.Mesh(cloudGeo, cloudMat);
      clouds.name = 'cloud_layer';
      group.add(clouds);

      // 3. Atmospheric Rayleigh Scattering Cyan Glow (seen in user's screenshot)
      group.add(createAtmosphereGlow(radius, '#38bdf8'));
      break;
    }

    case 'planet_oceanus': {
      // Eyeball Ocean World (From Row 3, Col 3 of reference image)
      const sphereGeo = new THREE.SphereGeometry(radius, 64, 64);
      const sphereMat = new THREE.MeshStandardMaterial({
        roughness: 0.3,
        metalness: 0.08,
        map: createProceduralTexture('eyeball', 512),
      });
      group.add(new THREE.Mesh(sphereGeo, sphereMat));

      // Cloud swirls
      const cloudGeo = new THREE.SphereGeometry(radius * 1.02, 48, 48);
      const cloudMat = new THREE.MeshStandardMaterial({
        map: createProceduralTexture('clouds', 512),
        transparent: true,
        opacity: 0.75,
      });
      const clouds = new THREE.Mesh(cloudGeo, cloudMat);
      clouds.name = 'cloud_layer';
      group.add(clouds);

      group.add(createAtmosphereGlow(radius, '#0284c7'));
      break;
    }

    case 'planet_lava': {
      // Molten Basalt & Magma Fissure Superworld (Row 1, Col 3 of reference image)
      const sphereGeo = new THREE.SphereGeometry(radius, 64, 64);
      const sphereMat = new THREE.MeshStandardMaterial({
        roughness: 0.85,
        metalness: 0.25,
        emissive: new THREE.Color('#ff4500'),
        emissiveIntensity: 0.65,
        map: createProceduralTexture('lava', 512),
        bumpMap: createBumpMap('lava', 256),
        bumpScale: 0.08,
      });
      group.add(new THREE.Mesh(sphereGeo, sphereMat));
      group.add(createAtmosphereGlow(radius, '#ef4444'));
      break;
    }

    case 'planet_super_earth': {
      // Massive Super-Earth with rich mountain ranges and atmospheric ring
      const sphereGeo = new THREE.SphereGeometry(radius, 64, 64);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.65,
        metalness: 0.15,
        map: createProceduralTexture('earth', 512),
        bumpMap: createBumpMap('earth', 256),
        bumpScale: 0.08,
      });
      group.add(new THREE.Mesh(sphereGeo, sphereMat));
      group.add(createAtmosphereGlow(radius, '#60a5fa'));
      break;
    }

    case 'planet_carbon': {
      // Diamond mantle carbon world with graphite facets
      const sphereGeo = new THREE.SphereGeometry(radius, 64, 64);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: '#475569',
        roughness: 0.25,
        metalness: 0.88,
        map: createProceduralTexture('metal', 512),
      });
      group.add(new THREE.Mesh(sphereGeo, sphereMat));
      group.add(createAtmosphereGlow(radius, '#94a3b8'));
      break;
    }

    case 'planet_gas_giant': {
      // Photorealistic Jupiter-Style Banded Gas Giant (Row 4, Col 1 of reference image)
      const sphereGeo = new THREE.SphereGeometry(radius, 64, 64);
      const sphereMat = new THREE.MeshStandardMaterial({
        roughness: 0.38,
        metalness: 0.04,
        map: createProceduralTexture('gas_giant', 512),
      });
      group.add(new THREE.Mesh(sphereGeo, sphereMat));

      // Equatorial Rings with Cassini division
      const ringGeo = new THREE.RingGeometry(radius * 1.5, radius * 2.4, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: '#d4a373',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2.3;
      group.add(ring);

      group.add(createAtmosphereGlow(radius, '#f59e0b'));
      break;
    }

    case 'planet_ice_giant': {
      // Neptunian Cyan Ice Giant (Row 3, Col 2 of reference image)
      const sphereGeo = new THREE.SphereGeometry(radius, 64, 64);
      const sphereMat = new THREE.MeshStandardMaterial({
        roughness: 0.25,
        metalness: 0.05,
        map: createProceduralTexture('ice_giant', 512),
      });
      group.add(new THREE.Mesh(sphereGeo, sphereMat));

      // Delicate thin icy ring
      const ringGeo = new THREE.RingGeometry(radius * 1.6, radius * 1.9, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: '#bae6fd',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2.3;
      group.add(ring);

      group.add(createAtmosphereGlow(radius, '#38bdf8'));
      break;
    }

    // ---------------- Stage 5: Stars ----------------
    case 'star_red_dwarf':
    case 'star_sun_like':
    case 'star_blue_giant':
    case 'star_white_dwarf':
    case 'star_wolf_rayet': {
      const starGeo = new THREE.SphereGeometry(radius, 48, 48);
      const starMat = new THREE.MeshBasicMaterial({
        color: col,
        map: createProceduralTexture('lava', 256),
      });
      group.add(new THREE.Mesh(starGeo, starMat));

      // Radiant coronal aura
      const coronaGeo = new THREE.SphereGeometry(radius * 1.25, 32, 32);
      const coronaMat = new THREE.MeshBasicMaterial({
        color: emissiveCol,
        transparent: true,
        opacity: 0.5,
        side: THREE.BackSide,
      });
      group.add(new THREE.Mesh(coronaGeo, coronaMat));

      // Illuminating light
      const light = new THREE.PointLight(col, 4.0, radius * 45, 1.2);
      group.add(light);
      break;
    }

    // ---------------- Stage 6: Remnants & Collapses ----------------
    case 'supernova_remnant': {
      const shellGeo = new THREE.SphereGeometry(radius, 32, 32);
      const shellMat = new THREE.MeshBasicMaterial({
        color: col,
        wireframe: true,
        transparent: true,
        opacity: 0.7,
      });
      group.add(new THREE.Mesh(shellGeo, shellMat));
      break;
    }

    case 'neutron_star':
    case 'magnetar': {
      const coreGeo = new THREE.SphereGeometry(radius, 32, 32);
      const coreMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
      group.add(new THREE.Mesh(coreGeo, coreMat));

      // Relativistic beams
      const beamGeo = new THREE.CylinderGeometry(radius * 0.1, radius * 1.5, radius * 12, 16, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: formDef.trailColor,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
      });
      const topBeam = new THREE.Mesh(beamGeo, beamMat);
      topBeam.position.y = radius * 6;
      group.add(topBeam);
      const btmBeam = new THREE.Mesh(beamGeo, beamMat);
      btmBeam.position.y = -radius * 6;
      btmBeam.rotation.x = Math.PI;
      group.add(btmBeam);
      break;
    }

    // ---------------- Stage 7: Black Holes & Endgame ----------------
    case 'black_hole':
    case 'supermassive_black_hole':
    case 'quasar': {
      // Event Horizon
      const horizonGeo = new THREE.SphereGeometry(radius, 48, 48);
      const horizonMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      group.add(new THREE.Mesh(horizonGeo, horizonMat));

      // Photon Sphere Ring
      const photonGeo = new THREE.RingGeometry(radius * 1.15, radius * 1.35, 64);
      const photonMat = new THREE.MeshBasicMaterial({
        color: '#ffffff',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const photon = new THREE.Mesh(photonGeo, photonMat);
      photon.rotation.x = Math.PI / 2.2;
      group.add(photon);

      // Relativistic Accretion Disk
      const diskGeo = new THREE.RingGeometry(radius * 1.5, radius * 3.8, 64);
      const diskMat = new THREE.MeshBasicMaterial({
        color: formId === 'quasar' ? '#facc15' : formId === 'black_hole' ? '#f97316' : '#a855f7',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const disk = new THREE.Mesh(diskGeo, diskMat);
      disk.name = 'accretion_disk';
      disk.rotation.x = Math.PI / 2;
      group.add(disk);
      break;
    }

    case 'white_hole': {
      const coreGeo = new THREE.SphereGeometry(radius, 48, 48);
      const coreMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
      group.add(new THREE.Mesh(coreGeo, coreMat));
      group.add(createAtmosphereGlow(radius, '#38bdf8'));
      break;
    }

    case 'dyson_sphere': {
      // Hexagonal photovoltaic megastructure sphere
      const dysonGeo = new THREE.IcosahedronGeometry(radius, 3);
      const dysonMat = new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        metalness: 0.95,
        roughness: 0.15,
        wireframe: true,
      });
      group.add(new THREE.Mesh(dysonGeo, dysonMat));

      // Central captured star
      const innerStar = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 0.45, 32, 32),
        new THREE.MeshBasicMaterial({ color: '#fef08a' })
      );
      group.add(innerStar);
      break;
    }

    case 'unstable_galaxy': {
      const coreGeo = new THREE.SphereGeometry(radius * 0.35, 32, 32);
      const coreMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });
      group.add(new THREE.Mesh(coreGeo, coreMat));

      const dustRingGeo = new THREE.RingGeometry(radius * 0.4, radius * 2.2, 48);
      const dustRingMat = new THREE.MeshBasicMaterial({
        color: '#8b5cf6',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35,
      });
      const dustRing = new THREE.Mesh(dustRingGeo, dustRingMat);
      dustRing.rotation.x = Math.PI / 2;
      group.add(dustRing);
      break;
    }

    case 'void_singularity':
    case 'cosmic_anomaly': {
      const icosaGeo = new THREE.IcosahedronGeometry(radius, 1);
      const icosaMat = new THREE.MeshStandardMaterial({
        color: '#10b981',
        wireframe: true,
        emissive: '#059669',
        emissiveIntensity: 1.5,
      });
      const icosa = new THREE.Mesh(icosaGeo, icosaMat);
      icosa.name = 'anomaly_inner';
      group.add(icosa);

      const outerGeo = new THREE.DodecahedronGeometry(radius * 1.4, 0);
      const outerMat = new THREE.MeshBasicMaterial({
        color: '#34d399',
        wireframe: true,
        transparent: true,
        opacity: 0.6,
      });
      const outer = new THREE.Mesh(outerGeo, outerMat);
      outer.name = 'anomaly_outer';
      group.add(outer);
      break;
    }
  }

  return group;
}

// Render Moons orbiting around the celestial body (as seen in the screenshot)
export function updateMoonMeshes(
  moonGroup: THREE.Group,
  moons: MoonOrbit[],
  playerPosition: THREE.Vector3
) {
  while (moonGroup.children.length < moons.length) {
    const geo = new THREE.SphereGeometry(1, 24, 24);
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.1,
      map: createProceduralTexture('lunar', 128),
      bumpMap: createBumpMap('lunar', 128),
      bumpScale: 0.05,
    });
    const mesh = new THREE.Mesh(geo, mat);
    moonGroup.add(mesh);
  }
  while (moonGroup.children.length > moons.length) {
    moonGroup.remove(moonGroup.children[moonGroup.children.length - 1]);
  }

  for (let i = 0; i < moons.length; i++) {
    const m = moons[i];
    const mesh = moonGroup.children[i] as THREE.Mesh;
    mesh.scale.set(m.radius, m.radius, m.radius);
    (mesh.material as THREE.MeshStandardMaterial).color.set(m.color);

    const x = Math.cos(m.angle) * m.orbitDistance;
    const y = Math.sin(m.angle) * Math.sin(m.inclination) * m.orbitDistance;
    const z = Math.sin(m.angle) * Math.cos(m.inclination) * m.orbitDistance;

    mesh.position.set(playerPosition.x + x, playerPosition.y + y, playerPosition.z + z);
  }
}
