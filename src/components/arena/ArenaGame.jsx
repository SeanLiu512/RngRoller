import { useRef, useEffect, useState } from 'react';
import { computePlayerStats, BADGE_EFFECTS } from '@/lib/arenaConfig';

const ARENA_W = 1100;
const ARENA_H = 800;
const FIGHTER_RADIUS = 18;

export default function ArenaGame({ weapon, badgeIds, playerBadgeIds, onLeave }) {
  const canvasRef = useRef(null);
  const [hud, setHud] = useState({ players: [], time: 0, playerKills: 0, playerDeaths: 0 });
  const [killFeed, setKillFeed] = useState([]);

  // Refs for game loop (avoids stale closures)
  const stateRef = useRef(null);
  const keysRef = useRef({});
  const mouseRef = useRef({ x: ARENA_W / 2, y: ARENA_H / 2, down: false });
  const rafRef = useRef(null);
  const onLeaveRef = useRef(onLeave);
  useEffect(() => { onLeaveRef.current = onLeave; });

  // ── Initialize game ──
  function initGame() {
    const playerEffects = computePlayerStats(weapon, playerBadgeIds.map(id => {
      const eff = BADGE_EFFECTS[id];
      return eff ? { badgeId: id, ...eff } : null;
    }).filter(Boolean));

    const player = createFighter({
      id: 'player',
      name: 'You',
      x: ARENA_W / 2,
      y: ARENA_H / 2,
      color: '#8b5cf6',
      isPlayer: true,
      weapon,
      stats: playerEffects.stats,
      flags: playerEffects.flags,
      badgeIds: playerBadgeIds,
    });

    stateRef.current = {
      fighters: [player],
      projectiles: [],
      effects: [], // visual effects
      startTime: performance.now(),
      elapsed: 0,
      playerStats: { kills: 0, deaths: 0, damageDealt: 0, damageTaken: 0 },
      killFeed: [],
      // Recomputed every frame in updateGame() based on who's actually
      // present — this is just the starting value before the first frame.
      isTrainingRoom: true,
    };
  }

  function createFighter(opts) {
    return {
      ...opts,
      hp: opts.stats.maxHp,
      maxHp: opts.stats.maxHp,
      vx: 0, vy: 0,
      radius: FIGHTER_RADIUS,
      lastAttack: 0,
      alive: true,
      stunUntil: 0,
      shieldHp: 0,
      hitCount: 0,
      killCount: 0,
      deaths: 0,
      respawnAt: 0,
      immuneUntil: opts.flags.has('perfectImmune') ? 3000 : 0,
      // Ascending power tracking
      ascStartTime: 0,
      // Clone summons
      clones: [],
    };
  }

  function respawnFighter(f, state, now) {
    // Spawn at random edge position
    const edges = [
      { x: 50, y: Math.random() * (ARENA_H - 100) + 50 },
      { x: ARENA_W - 50, y: Math.random() * (ARENA_H - 100) + 50 },
      { x: Math.random() * (ARENA_W - 100) + 50, y: 50 },
      { x: Math.random() * (ARENA_W - 100) + 50, y: ARENA_H - 50 },
    ];
    const spawn = edges[Math.floor(Math.random() * edges.length)];
    f.x = spawn.x;
    f.y = spawn.y;
    f.hp = f.maxHp;
    f.alive = true;
    f.respawnAt = 0;
    f.shieldHp = 0;
    f.stunUntil = 0;
    f.hitCount = 0;
    f._slowUntil = 0;
    f._ascBonus = 0;
    f._descReduction = 0;
    f._expMult = 1;
    f._lastShieldTime = 0;
    f.lastHitBy = null;
    f.lastHitAt = 0;
    f.immuneUntil = f.flags.has('perfectImmune') ? 3000 : 0;
    state.effects.push({ type: 'spawn', x: f.x, y: f.y, color: f.color, time: now, duration: 500 });
  }

  // ── Initialize on mount — drop straight into the fight ──
  useEffect(() => {
    initGame();
  }, []);

  // ── Input handling ──
  useEffect(() => {
    const handleKey = (e, down) => {
      const k = e.key.toLowerCase();
      keysRef.current[k] = down;
      if (k === ' ') {
        e.preventDefault();
        mouseRef.current.down = down;
      }
    };
    const onKeyDown = (e) => handleKey(e, true);
    const onKeyUp = (e) => handleKey(e, false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = ARENA_W / rect.width;
    const scaleY = ARENA_H / rect.height;

    const onMouseMove = (e) => {
      const r = canvas.getBoundingClientRect();
      mouseRef.current.x = (e.clientX - r.left) * (ARENA_W / r.width);
      mouseRef.current.y = (e.clientY - r.top) * (ARENA_H / r.height);
    };
    const onMouseDown = () => { mouseRef.current.down = true; };
    const onMouseUp = () => { mouseRef.current.down = false; };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // ── Game loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const loop = (now) => {
      const state = stateRef.current;
      if (!state) return;

      state.elapsed = (now - state.startTime) / 1000;

      updateGame(state, now);
      render(ctx, state);

      // Update HUD
      setHud({
        players: state.fighters.map(f => ({
          id: f.id,
          name: f.name,
          hp: Math.max(0, Math.round(f.hp)),
          maxHp: Math.round(f.maxHp),
          alive: f.alive,
          kills: f.killCount,
          deaths: f.deaths,
          respawning: !f.alive && f.respawnAt > 0,
          respawnIn: f.respawnAt > 0 ? Math.max(0, (f.respawnAt - now) / 1000) : 0,
          color: f.color,
          isPlayer: f.isPlayer,
        })),
        time: state.elapsed,
        playerKills: state.playerStats.kills,
        playerDeaths: state.playerStats.deaths,
      });

      // Update kill feed
      if (state.killFeed && state.killFeed.length > 0) {
        const now2 = performance.now();
        const fresh = state.killFeed.filter(k => now2 - k.time < 5000);
        if (fresh.length !== state.killFeed.length) state.killFeed = fresh;
        setKillFeed([...fresh]);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Game update logic ──
  function updateGame(state, now) {
    const { fighters, projectiles, effects } = state;
    const player = fighters[0];

    // Recomputed every frame (not just at init) so this stays correct once
    // real opponents can actually join a session in progress.
    state.isTrainingRoom = fighters.filter(f => f !== player && (f.alive || f.respawnAt > 0)).length === 0;

    // Update fighters
    for (const f of fighters) {
      // Dead fighters: check for respawn
      if (!f.alive) {
        if (f.respawnAt > 0 && now >= f.respawnAt) {
          respawnFighter(f, state, now);
        }
        continue;
      }

      // Regeneration
      if (f.stats.regen > 0 && f.hp < f.maxHp) {
        f.hp = Math.min(f.maxHp, f.hp + f.stats.regen / 60);
      }

      // Stun check
      if (now < f.stunUntil) continue;

      // Immunity expiry
      if (f.immuneUntil && now > f.immuneUntil + state.startTime) {
        f.immuneUntil = 0;
      }

      if (f.isPlayer) {
        updatePlayer(f, state, now);
      } else if (!f.isDummy) {
        updateBot(f, state, now);
      }

      // Keep in bounds
      f.x = Math.max(f.radius, Math.min(ARENA_W - f.radius, f.x));
      f.y = Math.max(f.radius, Math.min(ARENA_H - f.radius, f.y));

      // Death check
      if (f.hp <= 0 && f.alive) {
        f.alive = false;
        f.deaths++;
        if (f.isPlayer) state.playerStats.deaths++;
        f.respawnAt = now + 3000;
        effects.push({ type: 'death', x: f.x, y: f.y, color: f.color, time: now, duration: 600 });
        // Award kill to whoever actually landed the last hit (within a
        // short window, so a hit from 10 seconds ago doesn't count) —
        // not just "whoever happens to be standing nearby" when they died.
        const killer = f.lastHitBy && f.lastHitBy.alive && (now - (f.lastHitAt || 0) < 3000) ? f.lastHitBy : null;
        if (killer) {
          killer.killCount++;
          if (killer.isPlayer) state.playerStats.kills++;
        }
        // Kill feed
        state.killFeed = state.killFeed || [];
        state.killFeed.unshift({
          killer: killer ? killer.name : null,
          killerColor: killer ? killer.color : '#888',
          victim: f.name,
          victimColor: f.color,
          time: performance.now(),
        });
        if (state.killFeed.length > 5) state.killFeed.pop();
      }
    }

    // Collision: fighters can't physically overlap. Pure positional
    // separation only — bumping into someone deals no damage.
    for (let a = 0; a < fighters.length; a++) {
      for (let b = a + 1; b < fighters.length; b++) {
        const f1 = fighters[a];
        const f2 = fighters[b];
        if (!f1.alive || !f2.alive) continue;
        const d = dist(f1, f2);
        const minDist = f1.radius + f2.radius;
        if (d > 0 && d < minDist) {
          const overlap = minDist - d;
          const nx = (f2.x - f1.x) / d;
          const ny = (f2.y - f1.y) / d;
          f1.x -= nx * overlap * 0.5;
          f1.y -= ny * overlap * 0.5;
          f2.x += nx * overlap * 0.5;
          f2.y += ny * overlap * 0.5;
          f1.x = Math.max(f1.radius, Math.min(ARENA_W - f1.radius, f1.x));
          f1.y = Math.max(f1.radius, Math.min(ARENA_H - f1.radius, f1.y));
          f2.x = Math.max(f2.radius, Math.min(ARENA_W - f2.radius, f2.x));
          f2.y = Math.max(f2.radius, Math.min(ARENA_H - f2.radius, f2.y));
        }
      }
    }

    // Void pull effect
    if (player.flags.has('voidPull') && player.alive) {
      for (const f of fighters) {
        if (f === player || !f.alive) continue;
        const d = dist(player, f);
        if (d < 250 && d > 5) {
          const pull = 0.8;
          f.x += (player.x - f.x) / d * pull;
          f.y += (player.y - f.y) / d * pull;
        }
      }
    }

    // Radiation aura
    if (player.flags.has('radiation') && player.alive) {
      for (const f of fighters) {
        if (f === player || !f.alive) continue;
        if (dist(player, f) < 120) {
          dealDamage(f, 6 / 60, null, state, now, true);
        }
      }
    }

    // Fire aura
    if (player.flags.has('fireAura') && player.alive) {
      for (const f of fighters) {
        if (f === player || !f.alive) continue;
        if (dist(player, f) < 100) {
          dealDamage(f, 4 / 60, null, state, now, true);
        }
      }
    }

    // Hex shield regen
    if (player.flags.has('hexShield') && player.alive) {
      if (!player._lastShieldTime) player._lastShieldTime = now;
      if (now - player._lastShieldTime > 5000) {
        player._lastShieldTime = now;
        player.shieldHp = Math.min(player.shieldHp + 30, 60);
      }
    }

    // Ascending power
    if (player.flags.has('ascending') && player.alive) {
      const seconds = state.elapsed;
      const bonus = Math.min(0.6, seconds * 0.02);
      player._ascBonus = bonus;
    }

    // Descending doom (enemy damage reduction)
    if (player.flags.has('descending') && player.alive) {
      const seconds = state.elapsed;
      player._descReduction = Math.min(0.5, seconds * 0.03);
    }

    // Exponential growth
    if (player.flags.has('exponential') && player.alive) {
      const seconds = Math.min(10, state.elapsed);
      player._expMult = Math.pow(Math.E, seconds / 10 * Math.log(2.718));
    }

    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      // Spiral shot
      if (p.owner?.flags?.has('spiralShot')) {
        const angle = Math.atan2(p.vy, p.vx) + 0.15;
        const speed = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
      }

      // Out of bounds
      const outOfBounds = p.x < 0 || p.x > ARENA_W || p.y < 0 || p.y > ARENA_H;
      if (outOfBounds && p.owner?.flags?.has('bounce') && !p.hasBounced) {
        if (p.x < 0 || p.x > ARENA_W) p.vx *= -1;
        if (p.y < 0 || p.y > ARENA_H) p.vy *= -1;
        p.x = Math.max(0, Math.min(ARENA_W, p.x));
        p.y = Math.max(0, Math.min(ARENA_H, p.y));
        p.hasBounced = true;
      } else if (outOfBounds || p.life <= 0) {
        projectiles.splice(i, 1);
        continue;
      }

      // Collision with fighters
      for (const f of fighters) {
        if (f === p.owner || !f.alive) continue;
        if (dist(p, f) < f.radius + p.radius) {
          handleProjectileHit(p, f, state, now);
          projectiles.splice(i, 1);
          break;
        }
      }
    }

    // Update visual effects
    for (let i = effects.length - 1; i >= 0; i--) {
      if (now - effects[i].time > effects[i].duration) {
        effects.splice(i, 1);
      }
    }
  }

  function updatePlayer(f, state, now) {
    const keys = keysRef.current;
    let dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      const slow = (f._slowUntil && now < f._slowUntil) ? 0.5 : 1;
      f.x += (dx / len) * f.stats.speed * slow;
      f.y += (dy / len) * f.stats.speed * slow;
    }

    // Attack
    if (mouseRef.current.down || keys[' ']) {
      tryAttack(f, state, now);
    }
  }

  function updateBot(f, state, now) {
    // Find nearest alive target
    const targets = state.fighters.filter(o => o !== f && o.alive);
    if (targets.length === 0) return;
    const target = targets.sort((a, b) => dist(f, a) - dist(f, b))[0];
    const d = dist(f, target);
    const angle = Math.atan2(target.y - f.y, target.x - f.x);

    // Move toward target if too far, strafe if close
    const slow = (f._slowUntil && now < f._slowUntil) ? 0.5 : 1;
    if (d > f.weapon.range * 0.7) {
      f.x += Math.cos(angle) * f.stats.speed * 0.85 * slow;
      f.y += Math.sin(angle) * f.stats.speed * 0.85 * slow;
    } else {
      // Strafe — direction picked from a stable hash of the fighter's id,
      // so it works for any id shape (not just the old 'bot0'/'bot1' format).
      const strafeDir = [...f.id].reduce((h, c) => h + c.charCodeAt(0), 0) % 2 ? 1 : -1;
      f.x += Math.cos(angle + Math.PI / 2) * f.stats.speed * 0.5 * slow * strafeDir;
      f.y += Math.sin(angle + Math.PI / 2) * f.stats.speed * 0.5 * slow * strafeDir;
    }

    // Attack if in range
    if (d <= f.weapon.range) {
      f._aimAngle = angle;
      tryAttack(f, state, now, angle);
    }
  }

  function tryAttack(f, state, now, aimAngle) {
    const cd = f.weapon.cooldown / f.stats.attackSpeed;
    if (now - f.lastAttack < cd) return;
    f.lastAttack = now;
    f.hitCount++;

    let angle = aimAngle;
    if (f.isPlayer) {
      angle = Math.atan2(mouseRef.current.y - f.y, mouseRef.current.x - f.x);
    } else if (angle === undefined) {
      angle = f._aimAngle || 0;
    }

    // Fifth power: guaranteed crit every 5th hit
    let forceCrit = false;
    if (f.flags.has('fifthPower') && f.hitCount % 5 === 0) forceCrit = true;

    // Sixth power: 6x damage every 6th hit
    let damageMult = 1;
    if (f.flags.has('sixthPower') && f.hitCount % 6 === 0) damageMult = 6;

    // Pronic combo: every 3rd attack 2x
    if (f.flags.has('pronicCombo') && f.hitCount % 3 === 0) damageMult *= 2;

    // Ascending bonus
    if (f._ascBonus) damageMult *= (1 + f._ascBonus);
    // Exponential
    if (f._expMult) damageMult *= f._expMult;

    // Quad damage chance
    if (f.flags.has('quadDmg') && Math.random() < 0.25) damageMult *= 4;

    let damage = f.stats.damage * damageMult;
    const isCrit = forceCrit || Math.random() < f.stats.crit;
    if (isCrit) damage *= f.stats.critDmg;

    const projectileCount = f.flags.has('multishot5') ? 5 : f.flags.has('multishot3') ? 3 : 1;

    if (f.weapon.projectile) {
      for (let i = 0; i < projectileCount; i++) {
        const spread = projectileCount > 1 ? (i - (projectileCount - 1) / 2) * 0.2 : 0;
        const a = angle + spread;
        state.projectiles.push({
          x: f.x + Math.cos(a) * f.radius,
          y: f.y + Math.sin(a) * f.radius,
          vx: Math.cos(a) * f.weapon.projectileSpeed,
          vy: Math.sin(a) * f.weapon.projectileSpeed,
          radius: 6,
          damage,
          isCrit,
          owner: f,
          life: 120,
          aoe: f.weapon.aoe || 0,
          color: f.color,
        });
      }
      // Split shot
      if (f.flags.has('splitShot') && Math.random() < 0.1) {
        for (let i = 0; i < 2; i++) {
          const a = angle + (i === 0 ? 0.3 : -0.3);
          state.projectiles.push({
            x: f.x, y: f.y,
            vx: Math.cos(a) * f.weapon.projectileSpeed,
            vy: Math.sin(a) * f.weapon.projectileSpeed,
            radius: 5, damage: damage * 0.5, isCrit: false, owner: f, life: 100, aoe: 0, color: f.color,
          });
        }
      }
    } else {
      // Melee attack — arc hit
      performMeleeHit(f, state, now, angle, damage, isCrit);
      if (f.flags.has('doubleHit')) {
        setTimeout(() => { if (f.alive) performMeleeHit(f, stateRef.current, performance.now(), angle, damage, isCrit); }, 150);
      }
    }

    // Echo blast
    if (f.flags.has('echoBlast')) {
      const echoX = f.x + Math.cos(angle) * (f.weapon.projectile ? 100 : 0);
      const echoY = f.y + Math.sin(angle) * (f.weapon.projectile ? 100 : 0);
      setTimeout(() => {
        const s = stateRef.current;
        if (!s) return;
        for (const target of s.fighters) {
          if (target === f || !target.alive) continue;
          if (dist({ x: echoX, y: echoY }, target) < (f.weapon.aoe || 50)) {
            dealDamage(target, damage * 0.5, f, s, performance.now(), false, isCrit);
          }
        }
        s.effects.push({ type: 'explosion', x: echoX, y: echoY, color: f.color, time: performance.now(), duration: 400, radius: f.weapon.aoe || 50 });
      }, 1000);
    }
  }

  function performMeleeHit(f, state, now, angle, damage, isCrit) {
    const range = f.weapon.range;
    const arc = f.weapon.arc || 60;
    let hit = false;

    for (const target of state.fighters) {
      if (target === f || !target.alive) continue;
      const d = dist(f, target);
      if (d > range + target.radius) continue;
      const angleToTarget = Math.atan2(target.y - f.y, target.x - f.x);
      let diff = Math.abs(normalizeAngle(angleToTarget - angle));
      if (diff < (arc / 180) * Math.PI) {
        // Triangular AoE — hit all in range
        dealDamage(target, damage, f, state, now, false, isCrit);
        if (f.flags.has('slowOnHit')) target._slowUntil = now + 1000;
        if (f.flags.has('stunChance') && Math.random() < 0.15) target.stunUntil = now + 800;
        hit = true;

        // Chain lightning
        if (f.flags.has('chainLightning')) {
          const chained = new Set([target]);
          let chainTarget = target;
          for (let c = 0; c < 2; c++) {
            const next = state.fighters.find(o => !chained.has(o) && o.alive && o !== f && dist(chainTarget, o) < 150);
            if (next) {
              chained.add(next);
              dealDamage(next, damage * 0.5, f, state, now, false, false);
              state.effects.push({ type: 'lightning', x1: chainTarget.x, y1: chainTarget.y, x2: next.x, y2: next.y, time: now, duration: 200 });
              chainTarget = next;
            }
          }
        }
      }
    }

    // Visual slash effect
    state.effects.push({
      type: 'slash', x: f.x, y: f.y, angle, range, arc: f.weapon.arc || 60,
      color: f.color, time: now, duration: 200,
    });
  }

  function handleProjectileHit(p, target, state, now) {
    let damage = p.damage;

    // Kaprekar split
    if (p.owner?.flags?.has('splitOnImpact')) {
      for (let i = 0; i < 2; i++) {
        const a = Math.atan2(p.vy, p.vx) + (i === 0 ? 1 : -1);
        state.projectiles.push({
          x: p.x, y: p.y,
          vx: Math.cos(a) * Math.hypot(p.vx, p.vy) * 0.7,
          vy: Math.sin(a) * Math.hypot(p.vx, p.vy) * 0.7,
          radius: 4, damage: damage * 0.4, isCrit: false, owner: p.owner, life: 60, aoe: 0, color: p.color,
        });
      }
    }

    if (p.aoe > 0) {
      // AoE explosion
      state.effects.push({ type: 'explosion', x: p.x, y: p.y, color: p.color, time: now, duration: 400, radius: p.aoe });
      for (const f of state.fighters) {
        if (f === p.owner || !f.alive) continue;
        if (dist(p, f) < p.aoe + f.radius) {
          dealDamage(f, damage, p.owner, state, now, false, p.isCrit);
        }
      }
    } else {
      dealDamage(target, damage, p.owner, state, now, false, p.isCrit);
    }

    state.effects.push({ type: 'hit', x: p.x, y: p.y, color: p.color, time: now, duration: 200 });
  }

  function dealDamage(target, damage, attacker, state, now, isDot = false, isCrit = false) {
    if (!target.alive) return;
    if (target.immuneUntil && now < target.immuneUntil + state.startTime) return;

    // Binary dodge
    if (target.flags.has('binaryDodge') && Math.random() < 0.4 && !isDot) return;

    // Happy dodge
    if (target.flags.has('happyDodge') && Math.random() < 0.08 && !isDot) return;

    // Defense
    let finalDmg = damage * (1 - (target.stats?.defense || 0));

    // Descending reduction
    if (target._descReduction) finalDmg *= (1 - target._descReduction);

    // Shield
    if (target.shieldHp > 0) {
      const absorbed = Math.min(target.shieldHp, finalDmg);
      target.shieldHp -= absorbed;
      finalDmg -= absorbed;
    }

    // Reality warp — attacker takes the damage
    if (target.flags.has('realityWarp') && attacker && !isDot) {
      dealDamage(attacker, finalDmg, null, state, now, false, false);
      return;
    }

    // Narcissist — attacker takes same damage
    if (target.flags.has('narcissist') && attacker && !isDot) {
      dealDamage(attacker, finalDmg, null, state, now, false, false);
    }

    // Reflect 10%
    if (target.flags.has('reflect10') && attacker && !isDot) {
      dealDamage(attacker, finalDmg * 0.1, null, state, now, false, false);
    }
    // Reflect 25% (palindrome)
    if (target.flags.has('reflect25') && attacker && !isDot) {
      dealDamage(attacker, finalDmg * 0.25, null, state, now, false, false);
    }

    // Void execute (The Void badge) — kill enemies below 10% HP
    if (attacker?.flags?.has('voidExecute') && target.hp / target.maxHp < 0.10 && !isDot) {
      finalDmg = target.hp + 1;
    }

    // Nice Executioner — +20% damage to enemies below 30% HP
    if (attacker?.flags?.has('execute') && target.hp / target.maxHp < 0.30 && !isDot) {
      finalDmg *= 1.2;
    }

    // Instakill 7%
    if (attacker?.flags?.has('instakill7') && Math.random() < 0.07 && !isDot) {
      finalDmg = target.hp + 1;
    }

    // Training Room: while no other real players are present, you can't
    // take damage at all (the dummy is a pure DPS-testing target).
    if (target.isPlayer && state.isTrainingRoom) {
      finalDmg = 0;
    }

    target.hp -= finalDmg;

    if (attacker && attacker !== target && !isDot) {
      target.lastHitBy = attacker;
      target.lastHitAt = now;
    }

    if (attacker) {
      // Lifesteal
      if (attacker.stats?.lifesteal > 0) {
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + finalDmg * attacker.stats.lifesteal);
      }
      if (attacker.isPlayer) {
        state.playerStats.damageDealt += Math.round(finalDmg);
      }
      if (target.isPlayer) {
        state.playerStats.damageTaken += Math.round(finalDmg);
      }
    }
  }

  // ── Render ──
  function render(ctx, state) {
    // Background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);

    // Grid
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < ARENA_W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_H); ctx.stroke();
    }
    for (let y = 0; y < ARENA_H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA_W, y); ctx.stroke();
    }

    // Arena border
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, ARENA_W - 4, ARENA_H - 4);

    // Visual effects (under fighters)
    for (const e of state.effects) {
      const age = (performance.now() - e.time) / e.duration;
      if (e.type === 'slash') {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle);
        ctx.strokeStyle = e.color;
        ctx.globalAlpha = 1 - age;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, e.range, -e.arc / 2 * Math.PI / 180, e.arc / 2 * Math.PI / 180);
        ctx.stroke();
        ctx.restore();
      } else if (e.type === 'explosion') {
        ctx.fillStyle = e.color;
        ctx.globalAlpha = (1 - age) * 0.4;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * (0.5 + age), 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'lightning') {
        ctx.strokeStyle = '#a3e635';
        ctx.globalAlpha = 1 - age;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.x1, e.y1);
        // Jagged line
        const steps = 4;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          ctx.lineTo(e.x1 + (e.x2 - e.x1) * t + (Math.random() - 0.5) * 20, e.y1 + (e.y2 - e.y1) * t + (Math.random() - 0.5) * 20);
        }
        ctx.stroke();
      } else if (e.type === 'death') {
        ctx.fillStyle = e.color;
        ctx.globalAlpha = (1 - age) * 0.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 30 * age, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'hit') {
        ctx.fillStyle = e.color;
        ctx.globalAlpha = 1 - age;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 8 * (1 - age), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Void pull visualization
    const player = state.fighters[0];
    if (player.flags.has('voidPull') && player.alive) {
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 250, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(168, 85, 247, 0.03)';
      ctx.beginPath();
      ctx.arc(player.x, player.y, 250, 0, Math.PI * 2);
      ctx.fill();
    }
    // Radiation visualization
    if (player.flags.has('radiation') && player.alive) {
      ctx.fillStyle = 'rgba(132, 204, 22, 0.08)';
      ctx.beginPath();
      ctx.arc(player.x, player.y, 120, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fire aura
    if (player.flags.has('fireAura') && player.alive) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.06)';
      ctx.beginPath();
      ctx.arc(player.x, player.y, 100, 0, Math.PI * 2);
      ctx.fill();
    }

    // Projectiles
    for (const p of state.projectiles) {
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Fighters
    for (const f of state.fighters) {
      if (!f.alive) {
        // Show respawn indicator
        if (f.respawnAt > 0) {
          const respawnIn = Math.max(0, (f.respawnAt - performance.now()) / 1000);
          ctx.fillStyle = f.color;
          ctx.globalAlpha = 0.15;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.radius * 0.7, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.5;
          ctx.font = 'bold 10px ui-sans-serif, system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(`${respawnIn.toFixed(1)}s`, f.x, f.y + 3);
          ctx.globalAlpha = 1;
        }
        continue;
      }

      // Immune glow
      if (f.immuneUntil && performance.now() < f.immuneUntil + state.startTime) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.6 + Math.sin(performance.now() / 100) * 0.3;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Shield
      if (f.shieldHp > 0) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Body
      ctx.fillStyle = f.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = f.color;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Outline
      ctx.strokeStyle = f.isPlayer ? '#fff' : 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Aim direction
      const aimAngle = f.isPlayer
        ? Math.atan2(mouseRef.current.y - f.y, mouseRef.current.x - f.x)
        : f._aimAngle || 0;
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x + Math.cos(aimAngle) * (f.radius + 12), f.y + Math.sin(aimAngle) * (f.radius + 12));
      ctx.stroke();

      // Name + HP bar
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(f.name, f.x, f.y - f.radius - 14);

      // HP bar
      const barW = 40;
      const barH = 4;
      const barX = f.x - barW / 2;
      const barY = f.y - f.radius - 10;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = f.hp / f.maxHp > 0.5 ? '#10b981' : f.hp / f.maxHp > 0.25 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(barX, barY, barW * Math.max(0, f.hp / f.maxHp), barH);
    }
  }

  // ── Helpers ──
  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-4">
      {/* Scoreboard */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {hud.players.map(p => (
            <div key={p.id} className={`rounded-lg border px-3 py-1.5 ${p.isPlayer ? 'border-violet-600 bg-violet-950/40' : 'border-zinc-800 bg-zinc-900/40'} ${!p.alive ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                <span className="text-xs font-bold text-zinc-200">{p.name}</span>
                {p.respawning ? (
                  <span className="text-[10px] text-zinc-500">respawn {p.respawnIn.toFixed(1)}s</span>
                ) : (
                  <span className="text-[10px] font-semibold text-zinc-500">{p.kills}K/{p.deaths}D</span>
                )}
              </div>
              {p.alive && (
                <div className="mt-0.5 h-1.5 w-20 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(p.hp / p.maxHp) * 100}%`, background: p.color }} />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-black tabular-nums text-violet-400">{hud.playerKills} <span className="text-zinc-600">/</span> <span className="text-red-400">{hud.playerDeaths}</span></div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-600">K / D</div>
          </div>
          <button
            onClick={() => onLeaveRef.current({ kills: hud.playerKills, deaths: hud.playerDeaths, time: hud.time })}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-bold text-zinc-300 transition hover:bg-zinc-700"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-violet-800/30 bg-zinc-950">
        <canvas
          ref={canvasRef}
          width={ARENA_W}
          height={ARENA_H}
          className="w-full touch-none"
          style={{ aspectRatio: `${ARENA_W}/${ARENA_H}`, cursor: 'crosshair' }}
        />

        {/* Kill feed */}
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
          {killFeed.map((k, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-lg bg-black/60 px-2 py-1 text-[11px] backdrop-blur-sm" style={{ opacity: 1 - i * 0.15 }}>
              {k.killer && <span className="font-bold" style={{ color: k.killerColor }}>{k.killer}</span>}
              <span className="text-zinc-500">⚔</span>
              <span className="font-bold" style={{ color: k.victimColor }}>{k.victim}</span>
            </div>
          ))}
        </div>

        {/* Respawn overlay for player */}
        {hud.players[0]?.respawning && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <div className="text-center">
              <div className="text-sm uppercase tracking-widest text-zinc-500">Respawning in</div>
              <div className="text-5xl font-black text-violet-400">{hud.players[0].respawnIn.toFixed(1)}s</div>
            </div>
          </div>
        )}
      </div>

      {/* Controls hint */}
      <div className="mt-3 flex items-center justify-center gap-6 text-xs text-zinc-600">
        <span><kbd className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-400">WASD</kbd> Move</span>
        <span><kbd className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-400">Mouse</kbd> Aim</span>
        <span><kbd className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-400">Click/Space</kbd> Attack</span>
      </div>
    </div>
  );
}