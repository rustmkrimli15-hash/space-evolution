import * as THREE from 'three';
import { createRNG, hashSeed } from './rules';
import { CosmicEvent, MatterType } from './types';

export interface MatterEntity {
  id: string;
  type: MatterType;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  rotationSpeed: THREE.Vector3;
  amount: number;
  radius: number;
  color: string;
  isConsumed: boolean;
}

export interface HazardEntity {
  id: string;
  type: 'antimatter' | 'rogue_meteor' | 'dense_core' | 'radiation_pocket';
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  damage: number;
  color: string;
  rotationSpeed: number;
}

export interface UniverseCluster {
  entities: MatterEntity[];
  hazards: HazardEntity[];
  activeEvents: CosmicEvent[];
}

export const MATTER_COLORS: Record<MatterType, string> = {
  rock: '#8a7e72',
  metal: '#71717a',
  ice: '#94a3b8',
  gas: '#a8a29e',
  plasma: '#f59e0b',
  dark_matter: '#4c1d95',
  exotic_matter: '#059669',
};

export class UniverseManager {
  public entities: MatterEntity[] = [];
  public hazards: HazardEntity[] = [];
  public activeEvents: CosmicEvent[] = [];
  public seed: string;
  private rng: () => number;
  public worldRadius: number = 3000;

  constructor(seed: string = 'COSMOS_GENESIS_SEED') {
    this.seed = seed;
    this.rng = createRNG(hashSeed(seed));
    this.populateUniverse();
  }

  public resetWithSeed(seed: string) {
    this.seed = seed;
    this.rng = createRNG(hashSeed(seed));
    this.entities = [];
    this.hazards = [];
    this.activeEvents = [];
    this.populateUniverse();
  }

  private populateUniverse() {
    const totalEntities = 350;

    // Distribute matter according to cosmological rarity
    for (let i = 0; i < totalEntities; i++) {
      const typeRoll = this.rng();
      let type: MatterType = 'rock';
      let amount = 1.0;
      let radius = 0.8;

      if (typeRoll < 0.35) {
        type = 'rock';
        amount = 1 + this.rng() * 2;
        radius = 0.7 + this.rng() * 0.4;
      } else if (typeRoll < 0.55) {
        type = 'metal';
        amount = 1 + this.rng() * 3;
        radius = 0.8 + this.rng() * 0.5;
      } else if (typeRoll < 0.72) {
        type = 'ice';
        amount = 1 + this.rng() * 2.5;
        radius = 0.9 + this.rng() * 0.5;
      } else if (typeRoll < 0.85) {
        type = 'gas';
        amount = 2 + this.rng() * 4;
        radius = 1.2 + this.rng() * 0.8;
      } else if (typeRoll < 0.93) {
        type = 'plasma';
        amount = 3 + this.rng() * 5;
        radius = 1.4 + this.rng() * 1.0;
      } else if (typeRoll < 0.97) {
        type = 'dark_matter';
        amount = 5 + this.rng() * 8;
        radius = 1.6 + this.rng() * 1.2;
      } else {
        type = 'exotic_matter';
        amount = 8 + this.rng() * 12;
        radius = 2.0 + this.rng() * 1.5;
      }

      // 3D galactic disk distribution (flatter on Y)
      const dist = 30 + Math.pow(this.rng(), 0.7) * (this.worldRadius - 100);
      const angle = this.rng() * Math.PI * 2;
      const height = (this.rng() - 0.5) * (dist * 0.25 + 50);

      const pos = new THREE.Vector3(
        Math.cos(angle) * dist,
        height,
        Math.sin(angle) * dist
      );

      // Orbital tangential velocity
      const orbitSpeed = (1.5 + this.rng() * 2.5);
      const vel = new THREE.Vector3(-Math.sin(angle) * orbitSpeed, (this.rng() - 0.5) * 0.5, Math.cos(angle) * orbitSpeed);

      this.entities.push({
        id: `matter_${i}`,
        type,
        position: pos,
        velocity: vel,
        rotation: new THREE.Euler(this.rng() * Math.PI, this.rng() * Math.PI, 0),
        rotationSpeed: new THREE.Vector3(
          (this.rng() - 0.5) * 1.2,
          (this.rng() - 0.5) * 1.2,
          (this.rng() - 0.5) * 1.2
        ),
        amount,
        radius,
        color: MATTER_COLORS[type],
        isConsumed: false,
      });
    }

    // Spawn initial hazards
    const totalHazards = 40;
    for (let i = 0; i < totalHazards; i++) {
      const dist = 100 + this.rng() * (this.worldRadius - 200);
      const angle = this.rng() * Math.PI * 2;
      const height = (this.rng() - 0.5) * 120;
      const hType = this.rng() < 0.4 ? 'antimatter' : this.rng() < 0.7 ? 'rogue_meteor' : 'radiation_pocket';

      this.hazards.push({
        id: `hazard_${i}`,
        type: hType,
        position: new THREE.Vector3(
          Math.cos(angle) * dist,
          height,
          Math.sin(angle) * dist
        ),
        velocity: new THREE.Vector3((this.rng() - 0.5) * 4, (this.rng() - 0.5) * 1, (this.rng() - 0.5) * 4),
        radius: hType === 'radiation_pocket' ? 14 : 4.5,
        damage: hType === 'antimatter' ? 35 : 18,
        color: hType === 'antimatter' ? '#f43f5e' : hType === 'radiation_pocket' ? '#eab308' : '#ef4444',
        rotationSpeed: (this.rng() - 0.5) * 2,
      });
    }
  }

  // Trigger random dynamic cosmic event
  public triggerRandomEvent(playerPos: THREE.Vector3): CosmicEvent {
    const eventTypes: Array<CosmicEvent['type']> = [
      'asteroid_storm',
      'comet',
      'solar_flare',
      'supernova',
      'gravitational_wave',
      'wormhole',
    ];
    const pickedType = eventTypes[Math.floor(this.rng() * eventTypes.length)];

    const offsetDist = 80 + this.rng() * 150;
    const angle = this.rng() * Math.PI * 2;
    const pos: [number, number, number] = [
      playerPos.x + Math.cos(angle) * offsetDist,
      playerPos.y + (this.rng() - 0.5) * 40,
      playerPos.z + Math.sin(angle) * offsetDist,
    ];

    let name = 'Cosmic Event';
    let duration = 25;
    let radius = 60;
    let intensity = 1.0;
    let color = '#38bdf8';
    let description = '';

    switch (pickedType) {
      case 'asteroid_storm':
        name = 'Dense Asteroid Storm';
        duration = 30;
        radius = 80;
        intensity = 1.4;
        color = '#f97316';
        description = 'A violent swarm of high-speed debris sweeps across the sector! Plentiful minerals but hazardous!';
        break;
      case 'comet':
        name = 'Interstellar Cryo-Comet';
        duration = 22;
        radius = 50;
        intensity = 1.8;
        color = '#38bdf8';
        description = 'A hyper-velocity cryo-comet streaks past, shedding copious ice crystals and exotic gases!';
        break;
      case 'solar_flare':
        name = 'Coronal Stellar Flare';
        duration = 18;
        radius = 90;
        intensity = 2.0;
        color = '#eab308';
        description = 'Surging plasma currents arc across space, showering the region with superheated ions!';
        break;
      case 'supernova':
        name = 'Distant Supernova Shockwave';
        duration = 20;
        radius = 120;
        intensity = 3.0;
        color = '#ec4899';
        description = 'A dying star has collapsed! High-energy heavy elements and dark matter ride the expanding wavefront!';
        break;
      case 'gravitational_wave':
        name = 'Gravitational Distortion Wave';
        duration = 24;
        radius = 100;
        intensity = 1.5;
        color = '#a855f7';
        description = 'Spacetime ripples disrupt orbital paths, pulling matter into dense harvesting pockets!';
        break;
      case 'wormhole':
        name = 'Unstable Einstein-Rosen Wormhole';
        duration = 35;
        radius = 45;
        intensity = 2.5;
        color = '#10b981';
        description = 'A spacetime rift has opened! Entering it teleports you to an exotic resource cache!';
        break;
    }

    const event: CosmicEvent = {
      id: `event_${Date.now()}_${Math.floor(this.rng() * 1000)}`,
      name,
      type: pickedType,
      position: pos,
      radius,
      duration,
      remainingTime: duration,
      intensity,
      color,
      description,
    };

    this.activeEvents.push(event);
    return event;
  }

  // Update universe physics and event timers
  public update(dt: number, playerPos: THREE.Vector3, playerRadius: number) {
    // Update active events
    for (let i = this.activeEvents.length - 1; i >= 0; i--) {
      const ev = this.activeEvents[i];
      ev.remainingTime -= dt;
      if (ev.remainingTime <= 0) {
        this.activeEvents.splice(i, 1);
      }
    }

    // Update matter positions & wrap-around around player so player is never in empty space
    const maxViewDist = Math.max(500, playerRadius * 35);
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      e.position.addScaledVector(e.velocity, dt);
      e.rotation.x += e.rotationSpeed.x * dt;
      e.rotation.y += e.rotationSpeed.y * dt;
      e.rotation.z += e.rotationSpeed.z * dt;

      // If consumed or drifted too far from player, recycle nearby
      const dist = e.position.distanceTo(playerPos);
      if (e.isConsumed || dist > maxViewDist) {
        e.isConsumed = false;
        const angle = this.rng() * Math.PI * 2;
        const spawnDist = playerRadius * 4 + this.rng() * (maxViewDist * 0.8);
        e.position.set(
          playerPos.x + Math.cos(angle) * spawnDist,
          playerPos.y + (this.rng() - 0.5) * (spawnDist * 0.3),
          playerPos.z + Math.sin(angle) * spawnDist
        );
        const orbitSpeed = 1.5 + this.rng() * 3.0;
        e.velocity.set(
          -Math.sin(angle) * orbitSpeed,
          (this.rng() - 0.5) * 0.8,
          Math.cos(angle) * orbitSpeed
        );
      }
    }

    // Update hazards
    for (let i = 0; i < this.hazards.length; i++) {
      const h = this.hazards[i];
      h.position.addScaledVector(h.velocity, dt);
      const hDist = h.position.distanceTo(playerPos);
      if (hDist > maxViewDist * 1.2) {
        const angle = this.rng() * Math.PI * 2;
        const spawnDist = playerRadius * 8 + this.rng() * (maxViewDist * 0.9);
        h.position.set(
          playerPos.x + Math.cos(angle) * spawnDist,
          playerPos.y + (this.rng() - 0.5) * 60,
          playerPos.z + Math.sin(angle) * spawnDist
        );
      }
    }
  }
}
