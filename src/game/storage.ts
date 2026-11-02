import { CosmicFormId, GameSettings, MatterInventory, MoonOrbit } from './types';

const SAVE_KEY = 'cosmic_evolution_save_v1';

export interface GameSaveData {
  currentFormId: CosmicFormId;
  discoveredForms: CosmicFormId[];
  mass: number;
  inventory: MatterInventory;
  worldSeed: string;
  moons: MoonOrbit[];
  settings: GameSettings;
  age: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  quality: 'high',
  sfxVolume: 0.7,
  musicVolume: 0.5,
  muted: false,
  cameraSensitivity: 1.0,
  invertY: false,
};

export const INITIAL_INVENTORY: MatterInventory = {
  rock: 15,
  metal: 5,
  ice: 5,
  gas: 0,
  plasma: 0,
  dark_matter: 0,
  exotic_matter: 0,
};

export function saveGameState(data: GameSaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
}

export function loadGameState(): GameSaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.currentFormId || !parsed.discoveredForms) return null;
    return parsed as GameSaveData;
  } catch (e) {
    console.warn('Failed to load from localStorage:', e);
    return null;
  }
}

export function clearGameState(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    console.warn('Failed to clear save:', e);
  }
}
