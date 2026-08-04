import { useRef, useEffect, useState } from 'react';
import { computePlayerStats, BADGE_EFFECTS } from '@/lib/arenaConfig';
import { getPusherClient, realtimeEnabled } from '@/lib/pusherClient';

const ARENA_W = 1100;
const ARENA_H = 800;
const FIGHTER_RADIUS = 18;
const BROADCAST_INTERVAL_MS = 80; // ~12.5 times/sec

export default function ArenaGame({ weapon, badgeIds, playerBadgeIds, onLeave, user }) {
  const canvasRef = useRef(null);
  const [hud, setHud] = useState({ players: [], time: 0, playerKills: 0, playerDeaths: 0 });
  const [killFeed, setKillFeed] = useState([]);
  const [onlineCount, setOnlineCount] = useState(1);

  // Refs for game loop (avoids stale closures)
  const stateRef = useRef(null);
  const keysRef = useRef({});
  const mouseRef = useRef({ x: ARENA_W / 2, y: ARENA_H / 2, down: false });
  const rafRef = useRef(null);
  const onLeaveRef = useRef(onLeave);
  useEffect(() => { onLeaveRef.current = onLeave; });

  const channelRef = useRef(null);
  const remoteFightersRef = useRef(new Map()); // userId -> fighter mirror object
  const myUserIdRef = useRef(user?.id);
  useEffect(() => { myUserIdRef.current = user?.id; }, [user?.id]);
  // Real display name for broadcasts to others — separate from the 'You'
  // label used in our own local HUD, which wouldn't make sense to anyone
  // else's screen or kill feed.
  const myNameRef = useRef(user?.email?.split('@')[0] || 'Player');
  const hasWarnedBroadcastRef = useRef(false);
  useEffect(() => { myNameRef.current = user?.email?.split('@')[0] || 'Player'; }, [user?.email]);

  // ── Initialize game ──
  function initGame() {
    const playerEffects = computePlayerStats(weapon, playerBadgeIds.map(id => {
      const eff = BADGE_EFFECTS[id];
      return eff ? { badgeId: id, ...eff } : null;
    }).filter(Boolean));

    const spawn = randomEdgeSpawn();

    const player = createFighter({
      id: 'player',
      userId: user?.id,
      isRemote: false,
      name: 'You',
      x: spawn.x,
      y: spawn.y,
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
      particles: [], // spark/debris particles for hits, deaths, auras
      shake: 0, // screen-shake magnitude, decays each frame
      startTime: performance.now(),
      elapsed: 0,
      playerStats: { kills: 0, deaths: 0, damageDealt: 0, damageTaken: 0 },
      killFeed: [],
      // Recomputed every frame in updateGame() based on who's actually
      // present — this is just the starting value before the first frame.
      isTrainingRoom: true,
    };
  }

  // Spawns a burst of small physics-y spark/debris particles at a point.
  // Used for hits, deaths, crits, and aura ambience.
  function spawnParticles(state, x, y, color, count, opts = {}) {
    const speed = opts.speed || 3;
    const size = opts.size || 3;
    const life = opts.life || 500;
    const spread = opts.spread || Math.PI * 2;
    const baseAngle = opts.angle || 0;
    const gravity = opts.gravity ?? 0.05;
    for (let i = 0; i < count; i++) {
      const a = baseAngle + (Math.random() - 0.5) * spread;
      const s = speed * (0.4 + Math.random() * 0.9);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        size: size * (0.5 + Math.random() * 0.8),
        color,
        life,
        maxLife: life,
        gravity,
        born: performance.now(),
      });
    }
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
      immuneUntil: opts.flags.has('perfectImmune') ? 1500 : 0,
      // Ascending power tracking
      ascStartTime: 0,
      // Clone summons
      clones: [],
    };
  }

  function randomEdgeSpawn() {
    const edges = [
      { x: 50, y: Math.random() * (ARENA_H - 100) + 50 },
      { x: ARENA_W - 50, y: Math.random() * (ARENA_H - 100) + 50 },
      { x: Math.random() * (ARENA_W - 100) + 50, y: 50 },
      { x: Math.random() * (ARENA_W - 100) + 50, y: ARENA_H - 50 },
    ];
    return edges[Math.floor(Math.random() * edges.length)];
  }

  function createRemoteFighter(userId, info) {
    const spawn = randomEdgeSpawn();
    return {
      id: `remote-${userId}`,
      userId,
      name: info?.name || 'Player',
      color: info?.color || '#f472b6',
      x: spawn.x,
      y: spawn.y,
      radius: FIGHTER_RADIUS,
      hp: 100,
      maxHp: 100,
      alive: true,
      isPlayer: false,
      isRemote: true,
      respawnAt: 0,
      killCount: 0,
      deaths: 0,
      shieldHp: 0,
      flags: new Set(),
      stats: {},
      _aimAngle: 0,
    };
  }

  function respawnFighter(f, state, now) {
    const spawn = randomEdgeSpawn();
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
    f.immuneUntil = f.flags.has('perfectImmune') ? 1500 : 0;
    state.effects.push({ type: 'spawn', x: f.x, y: f.y, color: f.color, time: now, duration: 500 });
  }

  // ── Initialize on mount — drop straight into the fight ──
  useEffect(() => {
    initGame();
  }, []);

  // ── Real-time networking (Pusher) ──
  // Gracefully does nothing if VITE_PUSHER_KEY/CLUSTER aren't configured —
  // the arena just stays solo (Training Room) in that case.
  useEffect(() => {
    if (!realtimeEnabled || !user?.id) return;
    const pusherClient = getPusherClient();
    if (!pusherClient) return;

    const channel = pusherClient.subscribe('presence-arena');
    channelRef.current = channel;

    const addRemote = (member) => {
      if (member.id === myUserIdRef.current) return; // that's me
      if (remoteFightersRef.current.has(member.id)) return;
      const fighter = createRemoteFighter(member.id, member.info);
      remoteFightersRef.current.set(member.id, fighter);
      const state = stateRef.current;
      if (state) state.fighters.push(fighter);
    };

    const removeRemote = (userId) => {
      remoteFightersRef.current.delete(userId);
      const state = stateRef.current;
      if (state) state.fighters = state.fighters.filter(f => f.userId !== userId || f.isPlayer);
    };

    channel.bind('pusher:subscription_succeeded', (members) => {
      members.each((member) => addRemote(member));
      setOnlineCount(members.count);
    });
    channel.bind('pusher:member_added', (member) => {
      addRemote(member);
      setOnlineCount(channel.members.count);
    });
    channel.bind('pusher:member_removed', (member) => {
      removeRemote(member.id);
      setOnlineCount(channel.members.count);
    });

    // Another player's position/status update.
    channel.bind('client-state', (data, metadata) => {
      const senderId = metadata?.user_id;
      if (!senderId || senderId === myUserIdRef.current) return;
      const fighter = remoteFightersRef.current.get(senderId);
      if (!fighter) return;
      const state = stateRef.current;

      // Confirm a pending kill claim: only actually award it now that THEY
      // confirm they died, not based on our own approximate local math —
      // this is what keeps both players' screens agreeing on what happened.
      if (fighter.alive && !data.alive && fighter.pendingKillClaimBy && state && performance.now() - (fighter.pendingKillClaimAt || 0) < 2000) {
        const attacker = fighter.pendingKillClaimBy;
        attacker.killCount++;
        if (attacker.isPlayer) {
          state.playerStats.kills++;
          state.killFeed = state.killFeed || [];
          state.killFeed.unshift({
            killer: attacker.name, killerColor: attacker.color,
            victim: fighter.name, victimColor: fighter.color,
            time: performance.now(),
          });
          if (state.killFeed.length > 5) state.killFeed.pop();
        }
      }
      fighter.pendingKillClaimBy = null;
      fighter.pendingKillClaimAt = 0;

      fighter.targetX = data.x;
      fighter.targetY = data.y;
      if (typeof fighter.x !== 'number' || Number.isNaN(fighter.x)) {
        // First update ever received — snap immediately, nothing to glide from yet.
        fighter.x = data.x;
        fighter.y = data.y;
      }
      fighter._aimAngle = data.aimAngle;
      fighter.hp = data.hp;
      fighter.maxHp = data.maxHp;
      fighter.alive = data.alive;
      fighter.respawnAt = data.respawnInMs > 0 ? performance.now() + data.respawnInMs : 0;
      fighter.killCount = data.killCount;
      fighter.deaths = data.deaths;
      fighter.name = data.name || fighter.name;
      fighter.color = data.color || fighter.color;
      if (data.stats) fighter.stats = data.stats;
      if (data.flags) fighter.flags = new Set(data.flags);
    });

    // Someone's attack landed on me. The attacker already computed the
    // fully-mitigated damage on their own client (using our synced stats/
    // flags for defense, dodge, shield, reflect, etc.) — applying all of
    // that a second time here would double-mitigate it, which could even
    // flip damage into healing if defense stacked past 100%. Just apply
    // the final number directly; our own next broadcast carries the
    // updated HP to everyone else.
    channel.bind('client-hit', (data, metadata) => {
      if (data.targetUserId !== myUserIdRef.current) return;
      const state = stateRef.current;
      if (!state) return;
      const player = state.fighters.find(f => f.isPlayer);
      if (!player || !player.alive) return;

      const dmg = Math.max(0, Number(data.damage) || 0);
      player.hp = Math.max(0, player.hp - dmg);
      state.playerStats.damageTaken += Math.round(dmg);

      const attackerFighter = remoteFightersRef.current.get(metadata?.user_id);
      if (attackerFighter) {
        player.lastHitBy = attackerFighter;
        player.lastHitAt = performance.now();
      }
    });

    // Someone else's death, for a consistent kill feed across all screens.
    channel.bind('client-death', (data, metadata) => {
      if (metadata?.user_id === myUserIdRef.current) return; // we already added our own locally
      const state = stateRef.current;
      if (!state) return;
      state.killFeed = state.killFeed || [];
      state.killFeed.unshift({ ...data, time: performance.now() });
      if (state.killFeed.length > 5) state.killFeed.pop();
    });

    // Someone else's attack — purely cosmetic, so their shot/swing is
    // actually visible on our screen too. Damage itself is handled
    // separately via 'client-hit', so this never touches HP.
    channel.bind('client-attack', (data, metadata) => {
      const senderId = metadata?.user_id;
      if (!senderId || senderId === myUserIdRef.current) return;
      const state = stateRef.current;
      if (!state) return;
      const fighter = remoteFightersRef.current.get(senderId);
      const color = data.color || fighter?.color || '#f472b6';

      if (data.projectile) {
        state.projectiles.push({
          x: data.x, y: data.y,
          vx: Math.cos(data.angle) * (data.projectileSpeed || 8),
          vy: Math.sin(data.angle) * (data.projectileSpeed || 8),
          radius: 6, damage: 0, isCrit: false, owner: fighter || null,
          life: 120, aoe: data.aoe || 0, color, weaponId: data.weaponId,
          cosmeticOnly: true,
        });
      } else {
        state.effects.push({
          type: 'slash', x: data.x, y: data.y, angle: data.angle,
          range: data.range || 65, arc: data.arc || 60,
          color, time: performance.now(), duration: 200, weaponId: data.weaponId,
        });
      }
    });

    // Broadcast my own state at a steady rate.
    const broadcastInterval = setInterval(() => {
      const state = stateRef.current;
      if (!state) return;
      const player = state.fighters.find(f => f.isPlayer);
      if (!player) return;
      const aimAngle = Math.atan2(mouseRef.current.y - player.y, mouseRef.current.x - player.x);
      const sent = channel.trigger('client-state', {
        x: player.x,
        y: player.y,
        aimAngle,
        hp: player.hp,
        maxHp: player.maxHp,
        alive: player.alive,
        respawnInMs: player.alive ? 0 : Math.max(0, player.respawnAt - performance.now()),
        killCount: player.killCount,
        deaths: player.deaths,
        name: myNameRef.current,
        color: player.color,
        stats: player.stats,
        flags: [...player.flags],
      });
      if (sent === false && !hasWarnedBroadcastRef.current) {
        hasWarnedBroadcastRef.current = true;
        console.warn(
          '[arena] Broadcasting position/attacks failed. This almost always means ' +
          '"Enable client events" is turned off for this app in the Pusher dashboard ' +
          '(App Settings → Enable client events).'
        );
      }
    }, BROADCAST_INTERVAL_MS);

    return () => {
      clearInterval(broadcastInterval);
      pusherClient.unsubscribe('presence-arena');
      channelRef.current = null;
      remoteFightersRef.current = new Map();
    };
  }, [user?.id]);

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

      try {
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
            killedByName: f.lastHitBy?.name || null,
            killedByColor: f.lastHitBy?.color || null,
          })),
          time: state.elapsed,
          playerKills: state.playerStats.kills,
          playerDeaths: state.playerStats.deaths,
          isTrainingRoom: state.isTrainingRoom,
        });

        // Update kill feed
        if (state.killFeed && state.killFeed.length > 0) {
          const now2 = performance.now();
          const fresh = state.killFeed.filter(k => now2 - k.time < 5000);
          if (fresh.length !== state.killFeed.length) state.killFeed = fresh;
          setKillFeed([...fresh]);
        }
      } catch (err) {
        // A bug in one frame should never permanently freeze the match —
        // log it and keep the game running instead of silently stalling.
        console.error('Arena frame error (recovered):', err);
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
      // Remote fighters are pure mirrors of another player's own client —
      // their position/hp/status comes from network events, not local sim.
      // Network updates only arrive ~12/sec, so smoothly glide toward the
      // latest known position each frame (60/sec) instead of snapping
      // instantly, which is what made movement look choppy/teleport-y.
      if (f.isRemote) {
        if (typeof f.targetX === 'number') {
          f.x += (f.targetX - f.x) * 0.25;
          f.y += (f.targetY - f.y) * 0.25;
        }
        continue;
      }

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
        f.respawnAt = now + 5000;
        effects.push({ type: 'death', x: f.x, y: f.y, color: f.color, time: now, duration: 700 });
        spawnParticles(state, f.x, f.y, f.color, 28, { speed: 5.5, size: 4, life: 900, gravity: 0.08 });
        spawnParticles(state, f.x, f.y, '#ffffff', 14, { speed: 4, size: 2.5, life: 650, gravity: 0.06 });
        if (f.isPlayer) state.shake = 12;
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
        const killFeedEntry = {
          killer: killer ? killer.name : null,
          killerColor: killer ? killer.color : '#888',
          victim: f.name,
          victimColor: f.color,
          time: performance.now(),
        };
        state.killFeed.unshift(killFeedEntry);
        if (state.killFeed.length > 5) state.killFeed.pop();

        // Tell everyone else so a 3rd/4th spectating player's kill feed
        // stays in sync too (the attacker's and victim's own screens
        // already reflect this locally, without needing the broadcast).
        if (f.isPlayer && channelRef.current) {
          channelRef.current.trigger('client-death', killFeedEntry);
        }
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
        if (d < 180 && d > 5) {
          const pull = 0.4;
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
          dealDamage(f, 3 / 60, null, state, now, true);
        }
      }
    }

    // Fire aura
    if (player.flags.has('fireAura') && player.alive) {
      for (const f of fighters) {
        if (f === player || !f.alive) continue;
        if (dist(player, f) < 100) {
          dealDamage(f, 2 / 60, null, state, now, true);
        }
      }
    }

    // Hex shield regen
    if (player.flags.has('hexShield') && player.alive) {
      if (!player._lastShieldTime) player._lastShieldTime = now;
      if (now - player._lastShieldTime > 6000) {
        player._lastShieldTime = now;
        player.shieldHp = Math.min(player.shieldHp + 15, 40);
      }
    }

    // Ascending power
    if (player.flags.has('ascending') && player.alive) {
      const seconds = state.elapsed;
      const bonus = Math.min(0.3, seconds * 0.01);
      player._ascBonus = bonus;
    }

    // Descending doom (enemy damage reduction)
    if (player.flags.has('descending') && player.alive) {
      const seconds = state.elapsed;
      player._descReduction = Math.min(0.25, seconds * 0.015);
    }

    // Exponential growth
    if (player.flags.has('exponential') && player.alive) {
      const seconds = Math.min(6, state.elapsed);
      player._expMult = Math.pow(1.6, seconds / 10);
    }

    // Update particles (hit sparks, death debris, aura ambience)
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vx *= 0.94;
      pt.vy = pt.vy * 0.94 + pt.gravity;
      pt.life -= 16.67;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }

    // Screen shake decays every frame
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 0.6);

    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      // Spiral shot
      if (p.owner?.flags?.has('spiralShot')) {
        const angle = Math.atan2(p.vy, p.vx) + 0.08;
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
      const slow = (f._slowUntil && now < f._slowUntil) ? 0.7 : 1;
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
    const slow = (f._slowUntil && now < f._slowUntil) ? 0.7 : 1;
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
      if (channelRef.current) {
        channelRef.current.trigger('client-attack', {
          x: f.x, y: f.y, angle, weaponId: f.weapon.id, projectile: !!f.weapon.projectile,
          range: f.weapon.range, arc: f.weapon.arc || 60,
          projectileSpeed: f.weapon.projectileSpeed, aoe: f.weapon.aoe || 0, color: f.color,
        });
      }
    } else if (angle === undefined) {
      angle = f._aimAngle || 0;
    }

    // Fifth power: guaranteed crit every 8th hit (was every 5th)
    let forceCrit = false;
    if (f.flags.has('fifthPower') && f.hitCount % 8 === 0) forceCrit = true;

    // Sixth power: 3x damage every 8th hit (was 6x every 6th)
    let damageMult = 1;
    if (f.flags.has('sixthPower') && f.hitCount % 8 === 0) damageMult = 3;

    // Pronic combo: every 4th attack 1.5x (was every 3rd, 2x)
    if (f.flags.has('pronicCombo') && f.hitCount % 4 === 0) damageMult *= 1.5;

    // Ascending bonus
    if (f._ascBonus) damageMult *= (1 + f._ascBonus);
    // Exponential
    if (f._expMult) damageMult *= f._expMult;

    // Quad damage chance: 12% for 2.5x (was 25% for 4x)
    if (f.flags.has('quadDmg') && Math.random() < 0.12) damageMult *= 2.5;

    let damage = f.stats.damage * damageMult;
    const isCrit = forceCrit || Math.random() < f.stats.crit;
    if (isCrit) damage *= f.stats.critDmg;

    const projectileCount = f.flags.has('multishot5') ? 5 : f.flags.has('multishot3') ? 3 : 1;
    const multishotDmgMult = f.flags.has('multishot5') ? 0.5 : f.flags.has('multishot3') ? 0.7 : 1;

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
          damage: damage * multishotDmgMult,
          isCrit,
          owner: f,
          life: 120,
          aoe: f.weapon.aoe || 0,
          color: f.color,
          weaponId: f.weapon.id,
        });
      }
      // Split shot: 6% chance (was 10%), 35% damage (was 50%)
      if (f.flags.has('splitShot') && Math.random() < 0.06) {
        for (let i = 0; i < 2; i++) {
          const a = angle + (i === 0 ? 0.3 : -0.3);
          state.projectiles.push({
            x: f.x, y: f.y,
            vx: Math.cos(a) * f.weapon.projectileSpeed,
            vy: Math.sin(a) * f.weapon.projectileSpeed,
            radius: 5, damage: damage * 0.35, isCrit: false, owner: f, life: 100, aoe: 0, color: f.color,
            weaponId: f.weapon.id,
          });
        }
      }
    } else {
      // Melee attack — arc hit
      performMeleeHit(f, state, now, angle, damage, isCrit);
      if (f.flags.has('doubleHit')) {
        // Second hit does 60% damage (was full damage)
        setTimeout(() => { if (f.alive) performMeleeHit(f, stateRef.current, performance.now(), angle, damage * 0.6, isCrit); }, 150);
      }
    }

    // Echo blast: 35% damage (was 50%)
    if (f.flags.has('echoBlast')) {
      const echoX = f.x + Math.cos(angle) * (f.weapon.projectile ? 100 : 0);
      const echoY = f.y + Math.sin(angle) * (f.weapon.projectile ? 100 : 0);
      setTimeout(() => {
        const s = stateRef.current;
        if (!s) return;
        for (const target of s.fighters) {
          if (target === f || !target.alive) continue;
          if (dist({ x: echoX, y: echoY }, target) < (f.weapon.aoe || 50)) {
            dealDamage(target, damage * 0.35, f, s, performance.now(), false, isCrit);
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
        state.effects.push({ type: 'hit', x: target.x, y: target.y, color: f.color, time: now, duration: 220 });
        spawnParticles(state, target.x, target.y, f.color, isCrit ? 14 : 7, { speed: 3.5, size: 2.5, life: 400, gravity: 0.05 });
        if (isCrit) spawnParticles(state, target.x, target.y, '#fde047', 8, { speed: 4.5, size: 2, life: 350, gravity: 0.03 });
        if (f.flags.has('slowOnHit')) target._slowUntil = now + 600;
        if (f.flags.has('stunChance') && Math.random() < 0.08) target.stunUntil = now + 500;
        hit = true;

        // Chain lightning: 1 jump (was 2), 35% damage (was 50%), shorter range
        if (f.flags.has('chainLightning')) {
          const chained = new Set([target]);
          let chainTarget = target;
          for (let c = 0; c < 1; c++) {
            const next = state.fighters.find(o => !chained.has(o) && o.alive && o !== f && dist(chainTarget, o) < 120);
            if (next) {
              chained.add(next);
              dealDamage(next, damage * 0.35, f, state, now, false, false);
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
      color: f.color, time: now, duration: 200, weaponId: f.weapon.id,
    });
  }

  function handleProjectileHit(p, target, state, now) {
    let damage = p.damage;

    // Kaprekar split: 1 projectile (was 2), 30% damage (was 40%)
    if (p.owner?.flags?.has('splitOnImpact')) {
      for (let i = 0; i < 1; i++) {
        const a = Math.atan2(p.vy, p.vx) + (i === 0 ? 1 : -1);
        state.projectiles.push({
          x: p.x, y: p.y,
          vx: Math.cos(a) * Math.hypot(p.vx, p.vy) * 0.7,
          vy: Math.sin(a) * Math.hypot(p.vx, p.vy) * 0.7,
          radius: 4, damage: damage * 0.3, isCrit: false, owner: p.owner, life: 60, aoe: 0, color: p.color,
          weaponId: p.weaponId,
        });
      }
    }

    if (p.aoe > 0) {
      // AoE explosion
      state.effects.push({ type: 'explosion', x: p.x, y: p.y, color: p.color, time: now, duration: 450, radius: p.aoe });
      spawnParticles(state, p.x, p.y, p.color, 16, { speed: 4.5, size: 3.5, life: 550, gravity: 0.03 });
      for (const f of state.fighters) {
        if (f === p.owner || !f.alive) continue;
        if (dist(p, f) < p.aoe + f.radius) {
          dealDamage(f, damage, p.owner, state, now, false, p.isCrit);
        }
      }
    } else {
      dealDamage(target, damage, p.owner, state, now, false, p.isCrit);
    }

    state.effects.push({ type: 'hit', x: p.x, y: p.y, color: p.color, time: now, duration: 220 });
    spawnParticles(state, p.x, p.y, p.color, p.isCrit ? 14 : 7, { speed: 3.5, size: 2.5, life: 400, gravity: 0.05 });
    if (p.isCrit) spawnParticles(state, p.x, p.y, '#fde047', 8, { speed: 4.5, size: 2, life: 350, gravity: 0.03 });
  }

  function dealDamage(target, damage, attacker, state, now, isDot = false, isCrit = false) {
    if (!target.alive) return;
    if (target.immuneUntil && now < target.immuneUntil + state.startTime) return;

    // Binary dodge: 20% (was 40%)
    if (target.flags.has('binaryDodge') && Math.random() < 0.2 && !isDot) return;

    // Happy dodge: 5% (was 8%)
    if (target.flags.has('happyDodge') && Math.random() < 0.05 && !isDot) return;

    // Defense — capped so it can reduce damage close to zero but can
    // never flip it negative (which would heal the target instead of
    // damaging them, if enough defense badges stacked past 100%).
    let finalDmg = Math.max(0, damage * (1 - Math.min(target.stats?.defense || 0, 0.9)));

    // Descending reduction
    if (target._descReduction) finalDmg *= (1 - target._descReduction);

    // Shield
    if (target.shieldHp > 0) {
      const absorbed = Math.min(target.shieldHp, finalDmg);
      target.shieldHp -= absorbed;
      finalDmg -= absorbed;
    }

    // Reality warp — attacker takes 50% of the damage (was 100%)
    if (target.flags.has('realityWarp') && attacker && !isDot) {
      dealDamage(attacker, finalDmg * 0.5, null, state, now, false, false);
      return;
    }

    // Narcissist — attacker takes 40% of the damage too (was 100%)
    if (target.flags.has('narcissist') && attacker && !isDot) {
      dealDamage(attacker, finalDmg * 0.4, null, state, now, false, false);
    }

    // Reflect 6% (was 10%)
    if (target.flags.has('reflect10') && attacker && !isDot) {
      dealDamage(attacker, finalDmg * 0.06, null, state, now, false, false);
    }
    // Reflect 15% (palindrome, was 25%)
    if (target.flags.has('reflect25') && attacker && !isDot) {
      dealDamage(attacker, finalDmg * 0.15, null, state, now, false, false);
    }

    // Void execute (The Void badge) — kill enemies below 6% HP (was 10%)
    if (attacker?.flags?.has('voidExecute') && target.hp / target.maxHp < 0.06 && !isDot) {
      finalDmg = target.hp + 1;
    }

    // Nice Executioner — +10% damage to enemies below 20% HP (was +20%/30%)
    if (attacker?.flags?.has('execute') && target.hp / target.maxHp < 0.20 && !isDot) {
      finalDmg *= 1.1;
    }

    // Instakill 3% (was 7%)
    if (attacker?.flags?.has('instakill7') && Math.random() < 0.03 && !isDot) {
      finalDmg = target.hp + 1;
    }

    // Training Room: while no other real players are present, you can't
    // take damage at all (the dummy is a pure DPS-testing target).
    if (target.isPlayer && state.isTrainingRoom) {
      finalDmg = 0;
    }

    target.hp -= finalDmg;

    // If this hit landed on a real remote player (not just our local mirror
    // of them), tell their own client so their actual HP drops too — our
    // copy is just a visual approximation until their next broadcast.
    if (target.isRemote && finalDmg !== 0 && channelRef.current) {
      channelRef.current.trigger('client-hit', {
        targetUserId: target.userId,
        damage: finalDmg,
        isCrit,
      });
    }

    // Remote mirrors are skipped by the main per-fighter loop entirely (see
    // `if (f.isRemote) continue` in updateGame), so a kill against one would
    // otherwise never register on the attacker's own screen. But we must
    // NOT declare them dead here — our local copy of their HP is only an
    // approximation (it only truly syncs every ~80ms, and can drift from
    // reality during a fast exchange of hits). Only THEIR OWN client knows
    // whether they actually died. So: just remember that we believe we
    // landed the killing blow, and only actually credit the kill once
    // their own broadcast confirms they're really dead (see the
    // `client-state` handler below) — that's what keeps both screens
    // agreeing on what happened, instead of drifting apart.
    if (target.isRemote && target.alive && target.hp <= 0 && attacker) {
      target.pendingKillClaimBy = attacker;
      target.pendingKillClaimAt = now;
    }

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
    ctx.save();
    // Screen shake: small random jolt that decays over time (mainly on
    // your own death, so it actually feels like it landed).
    if (state.shake > 0.1) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }

    // Background
    const bgGrad = ctx.createRadialGradient(
      ARENA_W / 2, ARENA_H / 2, 0,
      ARENA_W / 2, ARENA_H / 2, Math.max(ARENA_W, ARENA_H) * 0.7
    );
    bgGrad.addColorStop(0, '#12101d');
    bgGrad.addColorStop(1, '#07060b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);

    // Grid
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < ARENA_W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_H); ctx.stroke();
    }
    for (let y = 0; y < ARENA_H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA_W, y); ctx.stroke();
    }

    // Arena border, with a soft outer glow
    ctx.save();
    ctx.shadowColor = 'rgba(139, 92, 246, 0.6)';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, ARENA_W - 4, ARENA_H - 4);
    ctx.restore();

    // Visual effects (under fighters)
    for (const e of state.effects) {
      const age = (performance.now() - e.time) / e.duration;
      if (e.type === 'slash') {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle);
        ctx.strokeStyle = e.color;
        ctx.fillStyle = e.color;
        ctx.globalAlpha = 1 - age;
        const halfArc = (e.arc / 2) * Math.PI / 180;

        switch (e.weaponId) {
          case 'spear': {
            // A straight thrusting lunge line, not an arc.
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(e.range * 0.15, 0);
            ctx.lineTo(e.range, 0);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(e.range, 0, 5, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'hammer': {
            // A heavy filled wedge with an impact ring at the end.
            ctx.globalAlpha = (1 - age) * 0.55;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, e.range, -halfArc, halfArc);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1 - age;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(e.range * 0.9, 0, 14 * (0.6 + age), 0, Math.PI * 2);
            ctx.stroke();
            break;
          }
          case 'gauntlets': {
            // Rapid short jabs — a few quick radiating punch marks.
            ctx.lineWidth = 3;
            for (const jab of [-0.35, 0, 0.35]) {
              ctx.beginPath();
              ctx.moveTo(e.range * 0.3, jab * e.range * 0.5);
              ctx.lineTo(e.range * 0.75, jab * e.range * 0.5);
              ctx.stroke();
            }
            break;
          }
          default: {
            // Sword and anything else: the classic clean arc slash.
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, e.range, -halfArc, halfArc);
            ctx.stroke();
          }
        }
        ctx.restore();
      } else if (e.type === 'explosion') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const ease = 1 - Math.pow(1 - age, 2);
        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 20;
        ctx.globalAlpha = (1 - age) * 0.55;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * (0.4 + ease * 0.7), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = (1 - age) * 0.9;
        ctx.lineWidth = 2;
        ctx.strokeStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * (0.6 + ease * 0.6), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (e.type === 'lightning') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowColor = '#a3e635';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#a3e635';
        ctx.globalAlpha = 1 - age;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(e.x1, e.y1);
        // Jagged line
        const steps = 4;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          ctx.lineTo(e.x1 + (e.x2 - e.x1) * t + (Math.random() - 0.5) * 20, e.y1 + (e.y2 - e.y1) * t + (Math.random() - 0.5) * 20);
        }
        ctx.stroke();
        ctx.restore();
      } else if (e.type === 'death') {
        // Multi-layer expanding shockwave rings, eased outward.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const ease = 1 - Math.pow(1 - age, 3);
        for (const [delayFrac, maxR, width] of [[0, 55, 3], [0.15, 40, 2]]) {
          const localAge = Math.max(0, Math.min(1, (age - delayFrac) / (1 - delayFrac)));
          if (localAge <= 0) continue;
          const localEase = 1 - Math.pow(1 - localAge, 3);
          ctx.globalAlpha = (1 - localAge) * 0.8;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.arc(e.x, e.y, maxR * localEase, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = (1 - ease) * 0.35;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 20 * (1 - age * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (e.type === 'hit') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const ease = 1 - Math.pow(1 - age, 2);
        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 12;
        ctx.globalAlpha = (1 - age) * 0.9;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 10 * (1 - ease * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // Void pull visualization — pulsing rings + inward-swirling particles
    const player = state.fighters[0];
    const t = performance.now() / 1000;
    if (player.flags.has('voidPull') && player.alive) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.7 + Math.sin(t * 2) * 0.3;
      const grad = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, 180);
      grad.addColorStop(0, `rgba(168, 85, 247, ${0.1 * pulse})`);
      grad.addColorStop(1, 'rgba(168, 85, 247, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 180, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(192, 132, 252, ${0.25 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 10]);
      ctx.lineDashOffset = -t * 40;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 180, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      if (Math.random() < 0.3) {
        const a = Math.random() * Math.PI * 2;
        spawnParticles(state, player.x + Math.cos(a) * 170, player.y + Math.sin(a) * 170, '#c084fc', 1, { speed: 0, size: 2, life: 300, gravity: 0 });
      }
    }
    // Radiation visualization — toxic pulsing glow + rising particles
    if (player.flags.has('radiation') && player.alive) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.7 + Math.sin(t * 3) * 0.3;
      const grad = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, 120);
      grad.addColorStop(0, `rgba(132, 204, 22, ${0.12 * pulse})`);
      grad.addColorStop(1, 'rgba(132, 204, 22, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (Math.random() < 0.25) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 120;
        spawnParticles(state, player.x + Math.cos(a) * r, player.y + Math.sin(a) * r, '#a3e635', 1, { speed: 0.6, size: 2, life: 500, gravity: -0.02, angle: -Math.PI / 2, spread: 1 });
      }
    }
    // Fire aura — warm pulsing glow + rising embers
    if (player.flags.has('fireAura') && player.alive) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.7 + Math.sin(t * 4) * 0.3;
      const grad = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, 100);
      grad.addColorStop(0, `rgba(239, 68, 68, ${0.1 * pulse})`);
      grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 100, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (Math.random() < 0.3) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 100;
        spawnParticles(state, player.x + Math.cos(a) * r, player.y + Math.sin(a) * r, '#fb923c', 1, { speed: 0.8, size: 2.5, life: 450, gravity: -0.03, angle: -Math.PI / 2, spread: 0.8 });
      }
    }
    // Hex shield — a rotating hexagonal glow ring (previously had no visual at all)
    if (player.flags.has('hexShield') && player.alive && player.shieldHp > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(player.x, player.y);
      ctx.rotate(t * 0.6);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const r = player.radius + 10;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }
    // Perfection shimmer — rotating rainbow-ish ring while immune
    if (player.immuneUntil > performance.now() && player.alive) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(player.x, player.y);
      ctx.rotate(-t * 1.4);
      const hue = (t * 120) % 360;
      ctx.strokeStyle = `hsla(${hue}, 90%, 65%, 0.7)`;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, player.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Projectiles — each weapon gets a distinct shape, not just a plain
    // circle, so you can tell an arrow from a bolt from a chakram at a glance.
    for (const p of state.projectiles) {
      const travelAngle = Math.atan2(p.vy, p.vx);
      const speed = Math.hypot(p.vx, p.vy);

      // Motion trail: a fading gradient streak behind the projectile,
      // pointing back the way it came from.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const trailLen = Math.min(60, speed * 4);
      const tailX = p.x - Math.cos(travelAngle) * trailLen;
      const tailY = p.y - Math.sin(travelAngle) * trailLen;
      const trailGrad = ctx.createLinearGradient(p.x, p.y, tailX, tailY);
      trailGrad.addColorStop(0, p.color);
      trailGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.strokeStyle = trailGrad;
      ctx.lineWidth = Math.max(2, p.radius * 0.9);
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;

      switch (p.weaponId) {
        case 'bow': {
          // Arrow: a thin elongated shape pointing the way it's travelling.
          ctx.rotate(travelAngle);
          ctx.beginPath();
          ctx.moveTo(p.radius * 2.2, 0);
          ctx.lineTo(-p.radius * 1.2, p.radius * 0.6);
          ctx.lineTo(-p.radius * 0.4, 0);
          ctx.lineTo(-p.radius * 1.2, -p.radius * 0.6);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'crossbow': {
          // Bolt: a fast, thin streak with a short trailing tail.
          ctx.rotate(travelAngle);
          ctx.lineWidth = p.radius * 0.7;
          ctx.beginPath();
          ctx.moveTo(-p.radius * 3, 0);
          ctx.lineTo(p.radius * 1.5, 0);
          ctx.stroke();
          break;
        }
        case 'chakram': {
          // A spinning ring — hollow circle with a rotating inner spoke.
          const spin = (p.life * 0.4) % (Math.PI * 2);
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.rotate(spin);
          ctx.beginPath();
          ctx.moveTo(-p.radius, 0);
          ctx.lineTo(p.radius, 0);
          ctx.stroke();
          break;
        }
        case 'staff': {
          // A pulsing magic orb with an outer glow ring.
          const pulse = 1 + Math.sin(p.life * 0.3) * 0.15;
          ctx.globalAlpha = 0.35;
          ctx.beginPath();
          ctx.arc(0, 0, p.radius * 1.8 * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(0, 0, p.radius * pulse, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        default: {
          // Fallback: plain circle, for anything without a custom shape.
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Particles (hit sparks, death debris) — additive blending so
    // overlapping particles glow brighter instead of just looking flat.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const pt of state.particles) {
      const t = pt.life / pt.maxLife;
      ctx.globalAlpha = Math.max(0, t);
      ctx.fillStyle = pt.color;
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (0.4 + t * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

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

    ctx.restore(); // matches the shake-transform save() at the top
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
        <div className="flex flex-wrap items-center gap-2">
          {realtimeEnabled && (
            <div className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${hud.isTrainingRoom ? 'border-zinc-700 bg-zinc-900/60 text-zinc-400' : 'border-emerald-700 bg-emerald-950/40 text-emerald-400'}`}>
              {hud.isTrainingRoom ? '🎯 Training Room' : `⚔ Live — ${onlineCount} online`}
            </div>
          )}
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

        {/* Death screen */}
        {hud.players[0]?.respawning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/30 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0 shadow-[inset_0_0_150px_40px_rgba(220,38,38,0.35)]" />
            <div className="relative text-center">
              <div className="text-6xl font-black tracking-wider text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]">
                YOU DIED
              </div>
              {hud.players[0]?.killedByName && (
                <div className="mt-3 text-sm text-zinc-400">
                  Killed by{' '}
                  <span className="font-semibold" style={{ color: hud.players[0].killedByColor }}>
                    {hud.players[0].killedByName}
                  </span>
                </div>
              )}
              <div className="mt-6 text-xs uppercase tracking-widest text-zinc-500">Respawning in</div>
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