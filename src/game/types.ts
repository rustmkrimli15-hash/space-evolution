export type CosmicFormId =
  | 'meteorite'
  // Asteroids
  | 'asteroid_rocky'
  | 'asteroid_metallic'
  | 'asteroid_icy'
  | 'asteroid_carbonaceous'
  | 'asteroid_crystalline'
  // Mini Planets
  | 'mini_planet_rocky'
  | 'mini_planet_ocean'
  | 'mini_planet_volcanic'
  | 'mini_planet_desert'
  | 'mini_planet_crystal'
  // Full Planets
  | 'planet_terrestrial'
  | 'planet_super_earth'
  | 'planet_gas_giant'
  | 'planet_ice_giant'
  | 'planet_lava'
  | 'planet_oceanus'
  | 'planet_carbon'
  // Stars
  | 'star_red_dwarf'
  | 'star_sun_like'
  | 'star_blue_giant'
  | 'star_white_dwarf'
  | 'star_wolf_rayet'
  // Stellar Remnants & Endgames
  | 'neutron_star'
  | 'magnetar'
  | 'supernova_remnant'
  | 'black_hole'
  | 'supermassive_black_hole'
  | 'quasar'
  // Mysterious / Exotic
  | 'white_hole'
  | 'unstable_galaxy'
  | 'dyson_sphere'
  | 'void_singularity'
  | 'cosmic_anomaly';

export type MatterType =
  | 'rock'
  | 'metal'
  | 'ice'
  | 'gas'
  | 'plasma'
  | 'dark_matter'
  | 'exotic_matter';

export interface MatterInventory {
  rock: number;
  metal: number;
  ice: number;
  gas: number;
  plasma: number;
  dark_matter: number;
  exotic_matter: number;
}

export interface CosmicStats {
  mass: number;
  radius: number;
  gravity: number;
  energy: number;
  density: number;
  temperature: number; // Kelvin
  velocity: number;
  age: number; // seconds lived
}

export interface EvolutionRequirement {
  mass: number;
  requiredMatters?: Partial<Record<MatterType, number>>;
  specialCondition?: string;
}

export interface CosmicFormDefinition {
  id: CosmicFormId;
  name: string;
  stageName: string;
  stageLevel: number; // 1 to 7
  tier: 'Common' | 'Advanced' | 'Stellar' | 'Extreme' | 'Mythic' | 'Exotic';
  description: string;
  lore: string;
  baseRadius: number;
  color: string;
  emissiveColor: string;
  trailColor: string;
  evolutionChoices: CosmicFormId[];
  requirements: EvolutionRequirement;
  abilities: {
    name: string;
    description: string;
    cooldown: number; // seconds
  }[];
  statMultipliers: {
    density: number;
    gravityMult: number;
    energyMult: number;
    speedMult: number;
    temperature: number;
  };
  matterAffinities: Partial<Record<MatterType, number>>; // Multiplier for bonus growth
  isMysterious?: boolean;
}

export interface MoonOrbit {
  id: string;
  radius: number;
  orbitDistance: number;
  orbitSpeed: number;
  angle: number;
  inclination: number;
  color: string;
  mass: number;
}

export interface CosmicEvent {
  id: string;
  name: string;
  type:
    | 'asteroid_storm'
    | 'comet'
    | 'solar_flare'
    | 'supernova'
    | 'gravitational_wave'
    | 'wormhole'
    | 'anomaly';
  position: [number, number, number];
  radius: number;
  duration: number; // seconds
  remainingTime: number;
  intensity: number;
  color: string;
  description: string;
}

export interface GameSettings {
  quality: 'low' | 'medium' | 'high' | 'ultra';
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
  cameraSensitivity: number;
  invertY: boolean;
}
