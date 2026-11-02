import { EVOLUTION_FORMS } from './evolutionData';
import {
  CosmicFormId,
  CosmicStats,
  MatterInventory,
  MatterType,
  MoonOrbit,
} from './types';

// Deterministic Pseudo-Random Number Generator based on Seed (Mulberry32)
export function createRNG(seed: number) {
  let s = Math.floor(seed) >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Convert a string seed to a 32-bit integer seed
export function hashSeed(seedStr: string): number {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (Math.imul(31, hash) + seedStr.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

// Calculate effective radius from baseRadius and current mass
export function calculateRadius(formId: CosmicFormId, mass: number): number {
  const form = EVOLUTION_FORMS[formId];
  if (!form) return 1.0;
  const baseMass = Math.max(1, form.requirements.mass);
  const ratio = Math.max(1, mass / baseMass);
  // Cube root scaling for physical volume
  const scale = Math.pow(ratio, 0.33);
  return form.baseRadius * Math.min(2.8, Math.max(0.8, scale));
}

// Calculate gravitational pull radius based on mass and form
export function calculateGravityRadius(formId: CosmicFormId, mass: number): number {
  const form = EVOLUTION_FORMS[formId];
  if (!form) return 10;
  const radius = calculateRadius(formId, mass);
  const gravityMult = Math.abs(form.statMultipliers.gravityMult);
  return radius * 3.5 + Math.sqrt(mass) * (0.8 + gravityMult * 0.15);
}

// Calculate gravity pull strength at distance
export function calculateGravityForce(
  formId: CosmicFormId,
  mass: number,
  distance: number
): number {
  if (distance <= 0.1) return 0;
  const form = EVOLUTION_FORMS[formId];
  const mult = form ? form.statMultipliers.gravityMult : 1.0;
  // White hole repels instead of attracting!
  const baseForce = (mass * 0.4) / (distance * distance + 4.0);
  return baseForce * mult;
}

// Derive full stats for HUD and physics
export function deriveStats(
  formId: CosmicFormId,
  mass: number,
  age: number,
  currentVelocity: number
): CosmicStats {
  const form = EVOLUTION_FORMS[formId];
  const radius = calculateRadius(formId, mass);
  const density = form.statMultipliers.density * (mass / (radius * radius * radius + 0.1));
  const gravity = form.statMultipliers.gravityMult * (mass / (radius * radius + 0.1));
  const energy = mass * form.statMultipliers.energyMult * (1 + age * 0.001);
  const temperature = form.statMultipliers.temperature + Math.sqrt(mass) * 2;

  return {
    mass,
    radius,
    gravity,
    energy,
    density,
    temperature,
    velocity: currentVelocity,
    age,
  };
}

// Check if player meets requirements to evolve into targetFormId
export function canEvolve(
  targetFormId: CosmicFormId,
  currentMass: number,
  inventory: MatterInventory
): { can: boolean; reasons: string[] } {
  const target = EVOLUTION_FORMS[targetFormId];
  if (!target) return { can: false, reasons: ['Unknown form'] };

  const reasons: string[] = [];

  if (currentMass < target.requirements.mass) {
    reasons.push(
      `Mass: ${Math.floor(currentMass)} / ${target.requirements.mass}`
    );
  }

  if (target.requirements.requiredMatters) {
    for (const [key, reqVal] of Object.entries(target.requirements.requiredMatters)) {
      const matterType = key as MatterType;
      const currentVal = inventory[matterType] || 0;
      if (currentVal < (reqVal as number)) {
        reasons.push(`${matterType.toUpperCase()}: ${Math.floor(currentVal)} / ${reqVal}`);
      }
    }
  }

  return {
    can: reasons.length === 0,
    reasons,
  };
}

// Get all currently accessible evolutions from a form
export function getAvailableEvolutions(
  currentFormId: CosmicFormId
): CosmicFormId[] {
  const current = EVOLUTION_FORMS[currentFormId];
  if (!current) return [];
  return current.evolutionChoices;
}

// Add matter to inventory and calculate mass growth based on affinities
export function collectMatter(
  currentFormId: CosmicFormId,
  matterType: MatterType,
  amount: number,
  currentMass: number,
  inventory: MatterInventory
): { newMass: number; newInventory: MatterInventory; gainedMass: number } {
  const form = EVOLUTION_FORMS[currentFormId];
  const affinity = form.matterAffinities[matterType] ?? 1.0;
  const gainedMass = amount * affinity * 5.0;

  const newInventory: MatterInventory = {
    ...inventory,
    [matterType]: (inventory[matterType] || 0) + amount,
  };

  return {
    newMass: currentMass + gainedMass,
    newInventory,
    gainedMass,
  };
}

// Moon capture check: can the current form capture a moon?
export function canCaptureMoon(formId: CosmicFormId, currentMoons: MoonOrbit[]): boolean {
  const form = EVOLUTION_FORMS[formId];
  if (form.stageLevel < 3) return false; // Mini planets, planets, stars can capture moons
  const maxMoons = form.stageLevel === 3 ? 2 : form.stageLevel === 4 ? 6 : 12;
  return currentMoons.length < maxMoons;
}

// Create a new moon orbit configuration
export function createMoonOrbit(
  playerRadius: number,
  moonCount: number,
  seedRng: () => number
): MoonOrbit {
  const minDistance = playerRadius * 1.8;
  const distance = minDistance + moonCount * (playerRadius * 0.8) + seedRng() * playerRadius;
  const speed = (0.8 + seedRng() * 0.6) / Math.sqrt(distance / 5);
  const inclination = (seedRng() - 0.5) * 0.6;
  const colors = ['#94a3b8', '#cbd5e1', '#fcd34d', '#38bdf8', '#c084fc', '#f43f5e'];
  const color = colors[Math.floor(seedRng() * colors.length)];

  return {
    id: `moon_${Date.now()}_${Math.floor(seedRng() * 9999)}`,
    radius: Math.max(0.4, playerRadius * (0.12 + seedRng() * 0.08)),
    orbitDistance: distance,
    orbitSpeed: speed,
    angle: seedRng() * Math.PI * 2,
    inclination,
    color,
    mass: 10 + seedRng() * 30,
  };
}

// Update moon angles
export function updateMoonOrbits(moons: MoonOrbit[], dt: number): MoonOrbit[] {
  return moons.map((m) => ({
    ...m,
    angle: (m.angle + m.orbitSpeed * dt) % (Math.PI * 2),
  }));
}
