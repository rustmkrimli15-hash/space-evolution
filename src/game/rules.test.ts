import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRNG,
  hashSeed,
  calculateRadius,
  calculateGravityRadius,
  calculateGravityForce,
  deriveStats,
  canEvolve,
  collectMatter,
  canCaptureMoon,
  createMoonOrbit,
  updateMoonOrbits,
} from './rules';
import { MatterInventory } from './types';

test('deterministic RNG generates consistent numbers from the same seed', () => {
  const rng1 = createRNG(1337);
  const rng2 = createRNG(1337);

  const seq1 = [rng1(), rng1(), rng1()];
  const seq2 = [rng2(), rng2(), rng2()];

  assert.deepEqual(seq1, seq2);
  assert.equal(hashSeed('COSMOS_2026'), hashSeed('COSMOS_2026'));
});

test('calculateRadius increases with mass and respects base bounds', () => {
  const r1 = calculateRadius('meteorite', 10);
  const r2 = calculateRadius('meteorite', 100);
  assert.ok(r2 > r1, 'Higher mass must yield larger radius');

  const rStar = calculateRadius('star_sun_like', 8500);
  assert.ok(rStar > 20, 'Star radius should reflect base stellar radius');
});

test('canEvolve correctly evaluates mass and matter requirements', () => {
  const emptyInventory: MatterInventory = {
    rock: 0,
    metal: 0,
    ice: 0,
    gas: 0,
    plasma: 0,
    dark_matter: 0,
    exotic_matter: 0,
  };

  // Not enough mass or rocks for asteroid_rocky
  const res1 = canEvolve('asteroid_rocky', 50, emptyInventory);
  assert.equal(res1.can, false);
  assert.ok(res1.reasons.length >= 1);

  // Sufficient mass and rocks
  const richInventory: MatterInventory = {
    ...emptyInventory,
    rock: 50,
  };
  const res2 = canEvolve('asteroid_rocky', 150, richInventory);
  assert.equal(res2.can, true);
  assert.equal(res2.reasons.length, 0);
});

test('collectMatter respects matter affinity multiplier', () => {
  const emptyInventory: MatterInventory = {
    rock: 0,
    metal: 0,
    ice: 0,
    gas: 0,
    plasma: 0,
    dark_matter: 0,
    exotic_matter: 0,
  };

  // Icy asteroid has affinity 2.2 for ice and 0 for rock
  const { gainedMass: iceGain, newInventory: inv1 } = collectMatter(
    'asteroid_icy',
    'ice',
    10,
    100,
    emptyInventory
  );
  const { gainedMass: rockGain } = collectMatter(
    'asteroid_icy',
    'rock',
    10,
    100,
    emptyInventory
  );

  assert.ok(iceGain > rockGain, 'Ice should yield more mass than rock for icy asteroid');
  assert.equal(inv1.ice, 10);
});

test('canCaptureMoon respects evolution stage requirements', () => {
  // Meteorite (stage 1) cannot capture moons
  assert.equal(canCaptureMoon('meteorite', []), false);

  // Rocky Asteroid (stage 2) cannot capture moons
  assert.equal(canCaptureMoon('asteroid_rocky', []), false);

  // Mini Planet (stage 3) can capture up to 2 moons
  assert.equal(canCaptureMoon('mini_planet_rocky', []), true);

  // Terrestrial Planet (stage 4) can capture moons
  assert.equal(canCaptureMoon('planet_terrestrial', []), true);
});

test('white hole exhibits repulsive gravity while black hole exhibits strong attractive gravity', () => {
  const blackHoleForce = calculateGravityForce('black_hole', 50000, 20);
  const whiteHoleForce = calculateGravityForce('white_hole', 65000, 20);

  assert.ok(blackHoleForce > 0, 'Black hole must have positive attractive gravity');
  assert.ok(whiteHoleForce < 0, 'White hole must have negative repulsive gravity');
});

test('deriveStats returns full coherent physical stats', () => {
  const stats = deriveStats('star_sun_like', 10000, 120, 15);
  assert.equal(stats.mass, 10000);
  assert.ok(stats.radius > 20);
  assert.ok(stats.temperature > 5000);
  assert.equal(stats.age, 120);
});

test('new branching paths evaluate requirements correctly', () => {
  const emptyInventory: MatterInventory = {
    rock: 0,
    metal: 0,
    ice: 0,
    gas: 0,
    plasma: 0,
    dark_matter: 0,
    exotic_matter: 0,
  };

  // Carbonaceous asteroid check (requires rock and ice)
  const carbCheck = canEvolve('asteroid_carbonaceous', 130, { ...emptyInventory, rock: 45, ice: 25 });
  assert.equal(carbCheck.can, true);

  // Lava planet check (requires rock and metal)
  const lavaCheck = canEvolve('planet_lava', 2200, { ...emptyInventory, rock: 350, metal: 200 });
  assert.equal(lavaCheck.can, true);

  // Dyson sphere check requires mass 80000, metal 8000, exotic_matter 2000
  const dysonCheckNoRes = canEvolve('dyson_sphere', 80000, emptyInventory);
  assert.equal(dysonCheckNoRes.can, false);

  const dysonCheckSuccess = canEvolve('dyson_sphere', 80000, {
    ...emptyInventory,
    metal: 8500,
    exotic_matter: 2100,
  });
  assert.equal(dysonCheckSuccess.can, true);
});

