import React, { useEffect, useRef, useState } from "react";

const PLAYER_START = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  bob: 0,
  hp: 100,
  maxHp: 100,
  level: 0,
  xp: 0,
  xpToNextLevel: 50,
  energy: 0,
  maxEnergy: 3,
  specialTimer: 0,
  paused: false,
  debugMode: false,
  humanoidForm: false,
  transforming: false,
  transformTimer: 0,
  cloudShotCooldown: 0,
  cloudShotFlash: 0,
  lastShotAngle: 0,
  lastShotSide: 1,
  shotHandSide: 1,
  shotAnimTimer: 0,
  shotAnimDuration: 0.18,
  shotWasBig: false,
  godMode: false,
  godModeUsed: false,
  waterDropAimTest: false,
  kills: 0,
  blinkTimer: 2 + Math.random() * 3,
  blinking: false,
  blinkDuration: 0,
  eyeOffsetX: 0,
  eyeOffsetY: 0,
  targetEyeOffsetX: 0,
  targetEyeOffsetY: 0,
  lockOnIntensity: 0,
  killStreak: 0,
  bestKillStreak: 0,
  killStreakTimer: 0,
  shownStreakMilestones: {},
  bestRunLevel: 0,
  enemySpawnMultiplier: 1,
  enemySpeedBonus: 0,
  levelDamageBonusSteps: 0,
  mudSpawnEscalations: 0,
  mudSpeedEscalations: 0,
  waterFireRateEscalations: 0,
  stormPhase: false,
  stormPhaseAnnounced: false,
  dead: false,
  deathTimer: 0,
  knockbackX: 0,
  knockbackY: 0,
  knockbackTimer: 0,
  scale: 0.7,
  inMainMenu: true,
};

const DEFAULT_UI = {
  hp: { x: 16, y: 16, w: 190, h: 20 },
  xp: { x: -206, y: 16, w: 190, h: 20, anchorRight: true },
  energy: { x: 16, y: -44, w: 190, h: 20, anchorBottom: true },
  pause: { x: -124, y: 90, w: 44, h: 44, anchorRight: true },
  transform: { x: -40, y: -40, w: 80, h: 80, anchorCenter: true },
  killStreak: { x: -70, y: 130, w: 140, h: 48, anchorCenter: true },
  bonBonSize: { x: -90, y: 190, w: 180, h: 42, anchorCenter: true },
};

const ONLINE_LEADERBOARD = {
  enabled: true,
  supabaseUrl: "https://lmwsutxcrgthaqpazada.supabase.co",
  anonKey: "sb_publishable_B4NhtRXeQcn2hucVqaxoOw_gVUsyeUy",
  table: "bonbon_scores",
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function BonBonGame() {
  const canvasRef = useRef(null);
  const [, forceRenderStick] = useState(0);

  const keys = useRef({});
  const player = useRef({ ...PLAYER_START });
  const camera = useRef({ x: 0, y: 0 });
  const enemies = useRef([]);
  const waterDrops = useRef([]);
  const waterProjectiles = useRef([]);
  const healthOrbs = useRef([]);
  const waterSplashes = useRef([]);
  const waterSpawnTimer = useRef(10);
  const waterDropQueue = useRef([]);
  const mudParticles = useRef([]);
  const deathPuffs = useRef([]);
  const energyOrbs = useRef([]);
  const windBursts = useRef([]);
  const cloudShots = useRef([]);
  const levelUpEffects = useRef([]);
  const damageTexts = useRef([]);
  const streakMessages = useRef([]);
  const stormMessages = useRef([]);
  const spawnTimer = useRef(0);
  const menuBonBons = useRef([]);
  const menuPuffs = useRef([]);
  const uiLayout = useRef(clone(DEFAULT_UI));
  const leaderboard = useRef([]);
  const leaderboardStatus = useRef("LOCAL");
  const menuState = useRef("main");
  const scoreEntry = useRef({ active: false, askSave: false, initials: ["A", "A", "A"] });
  const selectedUi = useRef(null);
  const editState = useRef({ active: false, mode: null, edge: null, startX: 0, startY: 0 });
  const scaleEditState = useRef({ active: false, startDistance: 0, startScale: 1 });
  const touchState = useRef({ active: false, id: null, startX: 0, startY: 0 });
  const stickRef = useRef({ active: false, dx: 0, dy: 0 });
  const godHoldRef = useRef({ type: null, timeout: null, interval: null });
  const menuKeyboard = useRef({ index: 0 });
  const deviceProfile = useRef({
    w: 0,
    h: 0,
    isTouch: false,
    isMobile: false,
    isTablet: false,
    isLandscape: false,
    isSmallScreen: false,
    pixelRatioCap: 2,
    uiScale: 1,
    effectQuality: 1,
  });
  const buttons = useRef({
    start: null,
    leaderboard: null,
    multiplayer: null,
    createRoom: null,
    joinRoom: null,
    back: null,
    pause: null,
    play: null,
    debug: null,
    godmode: null,
    waterAimTest: null,
    pauseLeaderboard: null,
    settings: null,
    debugTools: null,
    pauseMenu: null,
    accept: null,
    transform: null,
    gameOverSave: null,
    gameOverMenu: null,
    initialUp: [],
    initialDown: [],
    confirmScore: null,
    confirmMenuYes: null,
    confirmMenuNo: null,
  });

  const clearMovementInput = () => {
    keys.current = {};
    touchState.current = { active: false, id: null, startX: 0, startY: 0 };
    stickRef.current = { active: false, dx: 0, dy: 0 };
  };

  console.assert(typeof clearMovementInput === "function", "clearMovementInput should be callable without recursion.");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    let animationFrame = 0;
    let lastTime = performance.now();

    const pointInside = (x, y, rect) => !!rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
    const isMenuKey = (key) => ["ArrowUp", "ArrowDown", "w", "W", "s", "S", "Enter", " "].includes(key);

    const getDeviceProfile = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const shortSide = Math.min(w, h);
      const longSide = Math.max(w, h);
      const isTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
      const isLandscape = w > h;
      const isSmallScreen = shortSide < 430;
      const isMobile = isTouch && longSide < 950;
      const isTablet = isTouch && longSide >= 950;
      return {
        w,
        h,
        isTouch,
        isMobile,
        isTablet,
        isLandscape,
        isSmallScreen,
        pixelRatioCap: isMobile ? 1.75 : 2,
        uiScale: isSmallScreen ? 0.9 : isTablet ? 1.05 : 1,
        effectQuality: isSmallScreen ? 0.75 : 1,
      };
    };

    const refreshDeviceProfile = () => {
      deviceProfile.current = getDeviceProfile();
      return deviceProfile.current;
    };

    const getJoystickBase = () => {
      const profile = deviceProfile.current;
      if (!profile.isTouch) return { x: window.innerWidth / 2, y: window.innerHeight - 92, visible: false };
      if (profile.isLandscape) return { x: Math.max(92, window.innerWidth * 0.16), y: window.innerHeight - 86, visible: true };
      return { x: window.innerWidth / 2, y: window.innerHeight - 92, visible: true };
    };

    const roundedRect = (x, y, w, h, r) => {
      const radius = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    };

    const resolveRect = (rect) => ({
      x: rect.anchorCenter ? window.innerWidth / 2 + rect.x : rect.anchorRight ? window.innerWidth + rect.x : rect.x,
      y: rect.anchorCenter ? window.innerHeight / 2 + rect.y : rect.anchorBottom ? window.innerHeight + rect.y : rect.y,
      w: rect.w,
      h: rect.h,
    });

    const resizeCanvas = () => {
      const profile = refreshDeviceProfile();
      const ratio = Math.min(window.devicePixelRatio || 1, profile.pixelRatioCap);
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor(window.innerHeight * ratio);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const seedNoise = (x, y) => {
      const seed = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return seed - Math.floor(seed);
    };

    const isOnlineReady = () => ONLINE_LEADERBOARD.enabled && ONLINE_LEADERBOARD.supabaseUrl && ONLINE_LEADERBOARD.anonKey;
    const sortScores = (scores) => [...scores]
      .filter((s) => s && s.initials)
      .sort((a, b) => Number(b.level || 0) - Number(a.level || 0)
        || Number(b.kills || 0) - Number(a.kills || 0)
        || Number(b.bestStreak || b.best_streak || 0) - Number(a.bestStreak || a.best_streak || 0))
      .slice(0, 10);

    const getStormPhasePressure = () => Math.max(0, player.current.level - 50);
    const getWaterDropSpawnCount = () => {
      const level = player.current.level;
      const stormBonus = level >= 50 ? Math.floor(getStormPhasePressure() / 10) + 1 : 0;
      if (level >= 25) return 3 + stormBonus;
      if (level >= 15) return 2;
      if (level >= 5) return 1;
      return 0;
    };
    const getWaterDropSpawnDelay = () => {
      const level = player.current.level;
      const stormReduction = level >= 50 ? Math.min(4, getStormPhasePressure() * 0.12) : 0;
      if (level >= 31) return Math.max(4, 9 - stormReduction);
      if (level >= 25) return 12;
      if (level >= 20) return 8;
      if (level >= 15) return 11;
      if (level >= 10) return 7.5;
      return 10;
    };
    const getWaterDropHp = () => (player.current.level < 5 ? 35 : 35 + Math.floor((player.current.level - 5) / 5) * 5);
    const getWaterDropHealAmount = () => {
      const level = player.current.level;
      if (level >= 31) return 35;
      if (level >= 25) return 30;
      if (level >= 20) return 25;
      if (level >= 15) return 20;
      if (level >= 10) return 15;
      return 10;
    };
    const getLevelDamageMultiplier = () => 1 + Math.floor(player.current.level / 10) * 0.2;
    const scaleDamage = (amount) => Math.max(1, Math.round(amount * getLevelDamageMultiplier()));
    const getKnockbackTier = () => Math.floor((player.current.killStreak || 0) / 500);
    const getBonFistKnockbackChance = () => Math.min(0.95, 0.25 + getKnockbackTier() * 0.1);
    const getBonBallKnockbackChance = () => {
      const tier = getKnockbackTier();
      if (tier <= 0) return 0;
      return Math.min(0.9, tier * 0.1);
    };
    const getKnockbackStrengthMultiplier = () => 1 + getKnockbackTier() * 0.25;
    const applyEnemyKnockback = (target, originX, originY, baseStrength = 260) => {
      const dx = target.x - originX;
      const dy = target.y - originY;
      const distance = Math.hypot(dx, dy) || 1;
      const strength = baseStrength * getKnockbackStrengthMultiplier();
      target.vx = (target.vx || 0) + (dx / distance) * strength;
      target.vy = (target.vy || 0) + (dy / distance) * strength;
    };
    const getWaterShootDelay = () => Math.max(0.75, 3 - player.current.waterFireRateEscalations * 0.28 - Math.max(0, player.current.level - 50) * 0.025);

    const loadLocalScores = () => {
      try {
        leaderboard.current = sortScores(JSON.parse(window.localStorage.getItem("bonBonLeaderboard") || "[]"));
        leaderboardStatus.current = "LOCAL";
      } catch {
        leaderboard.current = [];
        leaderboardStatus.current = "LOCAL";
      }
    };
    const saveLocalScores = () => {
      try { window.localStorage.setItem("bonBonLeaderboard", JSON.stringify(sortScores(leaderboard.current))); } catch {}
    };
    const loadOnlineScores = async () => {
      if (!isOnlineReady()) { loadLocalScores(); return; }
      try {
        const url = `${ONLINE_LEADERBOARD.supabaseUrl}/rest/v1/${ONLINE_LEADERBOARD.table}?select=initials,level,kills,best_streak,created_at&order=level.desc,kills.desc,best_streak.desc&limit=10`;
        const response = await fetch(url, { headers: { apikey: ONLINE_LEADERBOARD.anonKey, Authorization: `Bearer ${ONLINE_LEADERBOARD.anonKey}` } });
        if (!response.ok) throw new Error("Failed to load online scores");
        const data = await response.json();
        leaderboard.current = sortScores(data.map((entry) => ({ initials: String(entry.initials || "AAA").slice(0, 3).toUpperCase(), level: Number(entry.level) || 0, kills: Number(entry.kills) || 0, bestStreak: Number(entry.best_streak || entry.bestStreak || 0), date: entry.created_at || "online" })));
        leaderboardStatus.current = "ONLINE";
      } catch (error) {
        console.warn("Leaderboard fallback to local", error);
        loadLocalScores();
      }
    };
    const uploadOnlineScore = async (entry) => {
      if (!isOnlineReady()) return false;
      try {
        const response = await fetch(`${ONLINE_LEADERBOARD.supabaseUrl}/rest/v1/${ONLINE_LEADERBOARD.table}`, {
          method: "POST",
          headers: { apikey: ONLINE_LEADERBOARD.anonKey, Authorization: `Bearer ${ONLINE_LEADERBOARD.anonKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ initials: entry.initials, level: entry.level, kills: entry.kills, best_streak: entry.bestStreak || 0 }),
        });
        if (!response.ok) throw new Error("Upload failed");
        leaderboardStatus.current = "ONLINE";
        await loadOnlineScores();
        return true;
      } catch (error) {
        console.warn("Online upload failed, saved locally", error);
        leaderboardStatus.current = "LOCAL";
        return false;
      }
    };
    const saveLeaderboardEntry = () => {
      if (player.current.godModeUsed) return;
      const entry = { initials: scoreEntry.current.initials.join(""), level: player.current.bestRunLevel, kills: player.current.kills, bestStreak: player.current.bestKillStreak, date: new Date().toLocaleDateString() };
      leaderboard.current = sortScores([...leaderboard.current, entry]);
      saveLocalScores();
      uploadOnlineScore(entry);
      scoreEntry.current = { active: false, askSave: false, initials: ["A", "A", "A"] };
    };

    const getDeviceSaveKey = () => {
      const profile = deviceProfile.current.w ? deviceProfile.current : refreshDeviceProfile();
      const type = profile.isMobile ? "phone" : profile.isTablet ? "tablet" : "desktop";
      const orientation = profile.isLandscape ? "landscape" : "portrait";
      return type === "desktop" ? "desktop" : `${type}_${orientation}`;
    };
    const getUiStorageKey = () => `bonBonUiLayout_${getDeviceSaveKey()}`;
    const getScaleStorageKey = () => `bonBonScale_${getDeviceSaveKey()}`;
    const saveUiLayout = () => {
      try {
        window.localStorage.setItem(getUiStorageKey(), JSON.stringify(uiLayout.current));
        window.localStorage.setItem(getScaleStorageKey(), JSON.stringify(player.current.scale || 0.7));
      } catch {}
    };
    const loadSavedUiLayout = () => {
      try {
        const savedScale = window.localStorage.getItem(getScaleStorageKey()) || window.localStorage.getItem("bonBonScale");
        if (savedScale) player.current.scale = clamp(Number(JSON.parse(savedScale)) || 0.7, 0.6, 1.2);
        const saved = window.localStorage.getItem(getUiStorageKey()) || window.localStorage.getItem("bonBonUiLayout");
        if (!saved) return;
        const parsed = JSON.parse(saved);
        uiLayout.current = {
          hp: { ...DEFAULT_UI.hp, ...parsed.hp },
          xp: { ...DEFAULT_UI.xp, ...parsed.xp },
          energy: { ...DEFAULT_UI.energy, ...parsed.energy },
          pause: { ...DEFAULT_UI.pause, ...parsed.pause },
          transform: { ...DEFAULT_UI.transform, ...parsed.transform },
          killStreak: { ...DEFAULT_UI.killStreak, ...parsed.killStreak },
          bonBonSize: { ...DEFAULT_UI.bonBonSize, ...parsed.bonBonSize },
        };
      } catch { uiLayout.current = clone(DEFAULT_UI); }
    };

    const resetRun = (showMenu = false) => {
      const savedScale = player.current.scale || 0.7;
      player.current = { ...PLAYER_START, inMainMenu: showMenu, scale: savedScale };
      camera.current = { x: 0, y: 0 };
      enemies.current = [];
      waterDrops.current = [];
      waterProjectiles.current = [];
      healthOrbs.current = [];
      waterSplashes.current = [];
      waterSpawnTimer.current = getWaterDropSpawnDelay();
      waterDropQueue.current = [];
      mudParticles.current = [];
      deathPuffs.current = [];
      energyOrbs.current = [];
      windBursts.current = [];
      cloudShots.current = [];
      levelUpEffects.current = [];
      damageTexts.current = [];
      streakMessages.current = [];
      stormMessages.current = [];
      spawnTimer.current = 0;
      scoreEntry.current = { active: false, askSave: false, initials: ["A", "A", "A"] };
      selectedUi.current = null;
      editState.current = { active: false, mode: null, edge: null, startX: 0, startY: 0 };
      clearMovementInput();
      if (showMenu) menuState.current = "main";
      forceRenderStick((value) => value + 1);
    };

    const getMudHpMultiplier = () => 1 + player.current.level * 0.08;
    const getBigMudHp = () => Math.floor(50 * getMudHpMultiplier());
    const getSmallMudHp = () => Math.floor(15 * (1 + player.current.level * 0.06));
    const createBigMudBall = (x, y) => ({ x, y, hp: getBigMudHp(), maxHp: getBigMudHp(), radius: 18, type: "big", hitCooldown: 0, flashTimer: 0, vx: 0, vy: 0, wobbleSeed: Math.random() * Math.PI * 2 });
    const createSmallMudBall = (x, y, angle) => ({ x, y, hp: getSmallMudHp(), maxHp: getSmallMudHp(), radius: 10, type: "small", hitCooldown: 0.2, flashTimer: 0, vx: Math.cos(angle) * 120, vy: Math.sin(angle) * 120, wobbleSeed: Math.random() * Math.PI * 2 });
    const createWaterDrop = (x, y) => {
      const hp = getWaterDropHp();
      return { x, y, targetY: y, startY: y - window.innerHeight * 0.65, fallTimer: 0, fallDuration: 0.7, formTimer: 0, formDuration: 0.45, state: "falling", hp, maxHp: hp, flashTimer: 0, radius: 14, shootTimer: 1 + Math.random() * 2, burstLeft: 0, burstCooldown: 0, bob: Math.random() * Math.PI * 2 };
    };

    const addDamageText = (x, y, amount, big = false) => {
      const maxTexts = deviceProfile.current.isSmallScreen ? 22 : 36;
      if (!big && damageTexts.current.length >= maxTexts) return;
      const nearby = damageTexts.current.find((text) => !text.big && !big && Math.hypot(text.x - x, text.y - y) < 24 && text.life > 0.2);
      if (nearby) { nearby.amount += amount; nearby.life = Math.min(nearby.maxLife, nearby.life + 0.12); return; }
      damageTexts.current.push({ x, y, amount, life: big ? 0.9 : 0.58, maxLife: big ? 0.9 : 0.58, vy: big ? -42 : -28, big });
    };
    const getStreakMilestoneLabel = (streak) => {
      const labels = {
        10: ["×10 STREAK!", "3 BON FISTS!"], 20: ["×20 STREAK!", "4 BON FISTS!"], 30: ["×30 STREAK!", "5 BON FISTS!"],
        40: ["×40 STREAK!", "DUAL BON BALLS!"], 50: ["×50 STREAK!", "BON BALLS FASTER!"], 60: ["×60 STREAK!", "BON BALLS FASTER!"],
        70: ["×70 STREAK!", "BON BALLS FASTER!"], 80: ["×80 STREAK!", "BIG BON BALLS!"], 100: ["×100 STREAK!", "BIG BON BALLS POWER UP!"],
        120: ["×120 STREAK!", "BIG BON BALLS POWER UP!"], 140: ["×140 STREAK!", "BIG BON BALLS POWER UP!"], 160: ["×160 STREAK!", "MAX BIG BON BALL POWER!"],
        200: ["×200 STREAK!", "BIG BON BALL EVOLUTION!"], 500: ["×500 STREAK!", "BON BALLS KNOCKBACK!"],
      };
      return labels[streak] || null;
    };
    const maybeShowStreakMilestone = () => {
      const streak = player.current.killStreak;
      const label = getStreakMilestoneLabel(streak);
      if (!label || player.current.shownStreakMilestones[streak]) return;
      player.current.shownStreakMilestones[streak] = true;
      streakMessages.current.push({ title: label[0], subtitle: label[1], life: 1.35, maxLife: 1.35 });
    };
    const addKillStreak = () => {
      player.current.killStreak += 1;
      player.current.bestKillStreak = Math.max(player.current.bestKillStreak, player.current.killStreak);
      player.current.killStreakTimer = 3.2;
      maybeShowStreakMilestone();
    };
    const resetKillStreak = () => { player.current.killStreak = 0; player.current.killStreakTimer = 0; };
    const getStreakTier = () => Math.max(0, Math.floor((player.current.killStreak || 0) / 10));
    const getCloudHandCount = () => {
      const streak = player.current.killStreak || 0;
      if (streak >= 30) return 5;
      if (streak >= 20) return 4;
      if (streak >= 10) return 3;
      return 2;
    };
    const getCloudSpinSpeed = () => 2.8 + Math.max(0, getStreakTier() - 3) * 0.18;
    const getCloudHandBonusSize = () => Math.min(7, Math.max(0, getStreakTier() - 3) * 1.2);
    const getHumanoidFireCooldown = () => {
      const streak = player.current.killStreak || 0;
      if (streak >= 200) return 0.48;
      if (streak >= 80) return 0.7;
      if (streak >= 70) return 0.17;
      if (streak >= 60) return 0.19;
      if (streak >= 50) return 0.21;
      if (streak >= 40) return 0.24;
      if (streak >= 30) return 0.26;
      if (streak >= 20) return 0.29;
      if (streak >= 10) return 0.32;
      return 0.35;
    };
    const isBigCloudBlastActive = () => (player.current.killStreak || 0) >= 80;
    const getBigBonBallTier = () => Math.min(4, Math.max(0, Math.floor(((player.current.killStreak || 0) - 80) / 20)));
    const isAlternatingBigBonBallsActive = () => (player.current.killStreak || 0) >= 200;
    const getBigBonBallDamage = () => 24 + getBigBonBallTier() * 8;
    const getBigBonBallRadius = () => 20 + getBigBonBallTier() * 3;
    const getBigBonBallAoeRadius = () => 82 + getBigBonBallTier() * 12;
    const getBigBonBallAoeHits = () => 5 + getBigBonBallTier();
    const getNextXpRequirement = (level) => (level < 5 ? 50 + level * 20 : level < 10 ? 150 + level * 35 : 300 + level * 60);

    console.assert(getNextXpRequirement(0) === 50, "Level 0 should need 50 XP.");
    console.assert(getWaterDropSpawnCount() === 0, "Water Drops should not spawn before level 5.");
    console.assert(getWaterDropHealAmount() === 10, "Early Water Drops should heal 10 HP.");
    console.assert(resolveRect({ x: 10, y: 20, w: 30, h: 40 }).w === 30, "UI rect width should resolve.");
    console.assert(sortScores([{ initials: "AAA", level: 1, kills: 1 }, { initials: "BBB", level: 2, kills: 0 }])[0].initials === "BBB", "Scores should sort by level.");
    console.assert(getCloudHandCount() === 2, "Default cloud hand count should be 2.");
    clearMovementInput();
    console.assert(Object.keys(keys.current).length === 0 && !touchState.current.active && !stickRef.current.active, "clearMovementInput should reset keyboard and joystick state.");

    const createLevelUpEffect = () => {
      levelUpEffects.current.push({ x: player.current.x, y: player.current.y, level: player.current.level, radius: 12, life: 1.15, maxLife: 1.15 });
      for (let i = 0; i < 18; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 45 + Math.random() * 150;
        levelUpEffects.current.push({ x: player.current.x, y: player.current.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 6 + Math.random() * 12, life: 0.65, maxLife: 0.65, particle: true });
      }
    };
    const applyTenLevelEscalation = () => {
      if (player.current.level <= 0 || player.current.level % 10 !== 0) return;
      player.current.levelDamageBonusSteps = Math.floor(player.current.level / 10);
      player.current.waterFireRateEscalations += 1;
      if (Math.random() < 0.5) { player.current.mudSpawnEscalations += 1; player.current.enemySpawnMultiplier *= 1.18; }
      else { player.current.mudSpeedEscalations += 1; player.current.enemySpeedBonus += 2.5; }
      if (player.current.level >= 50) {
        player.current.stormPhase = true;
        if (!player.current.stormPhaseAnnounced) {
          player.current.stormPhaseAnnounced = true;
          stormMessages.current.push({ title: "STORM PHASE!", subtitle: "WATER DROPS INTENSIFY!", life: 2.1, maxLife: 2.1 });
        }
      }
    };
    const levelUpOnce = () => {
      if (player.current.godMode) return;
      player.current.level += 1;
      player.current.bestRunLevel = Math.max(player.current.bestRunLevel, player.current.level);
      player.current.xpToNextLevel = getNextXpRequirement(player.current.level);
      player.current.enemySpawnMultiplier *= 1.5;
      player.current.enemySpeedBonus += 0.5;
      applyTenLevelEscalation();
      createLevelUpEffect();
    };
    const addXp = (amount) => {
      if (player.current.godMode) return;
      player.current.xp += amount;
      while (player.current.xp >= player.current.xpToNextLevel) { player.current.xp -= player.current.xpToNextLevel; levelUpOnce(); }
    };

    const triggerSpecialAttack = () => {
      player.current.energy = 0;
      player.current.specialTimer = 0.45;
      windBursts.current.push({ x: player.current.x, y: player.current.y, radius: 10, life: 1 });
      enemies.current.forEach((enemy) => {
        const dx = enemy.x - player.current.x;
        const dy = enemy.y - player.current.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance <= 145 * (player.current.scale || 1)) {
          const damage = scaleDamage(10);
          enemy.hp -= damage;
          enemy.flashTimer = 0.08;
          addDamageText(enemy.x, enemy.y - enemy.radius, damage);
          enemy.vx += (dx / distance) * 420;
          enemy.vy += (dy / distance) * 420;
        }
      });
      waterDrops.current.forEach((drop) => {
        const dx = drop.x - player.current.x;
        const dy = drop.y - player.current.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance <= 145 * (player.current.scale || 1)) {
          const damage = scaleDamage(10);
          drop.hp -= damage;
          drop.flashTimer = 0.08;
          addDamageText(drop.x, drop.y - drop.radius, damage);
        }
      });
    };
    const addEnergy = (amount) => { player.current.energy = Math.min(player.current.maxEnergy, player.current.energy + amount); if (player.current.energy >= player.current.maxEnergy) triggerSpecialAttack(); };
    const triggerTransformation = () => {
      if (player.current.level < 5 || player.current.transforming) return;
      if (player.current.humanoidForm) { player.current.humanoidForm = false; player.current.cloudShotCooldown = 0; return; }
      player.current.transforming = true;
      player.current.transformTimer = 0.9;
      player.current.cloudShotCooldown = 0;
      stickRef.current = { active: false, dx: 0, dy: 0 };
    };
    const triggerDeath = () => {
      if (player.current.dead) return;
      player.current.dead = true;
      player.current.deathTimer = 0;
      scoreEntry.current.askSave = !player.current.godModeUsed;
      enemies.current = [];
      clearMovementInput();
      for (let i = 0; i < 42; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 260;
        deathPuffs.current.push({ x: player.current.x, y: player.current.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 12 + Math.random() * 24, life: 1 });
      }
    };

    const spawnMudBall = () => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 500 + Math.min(180, player.current.level * 8);
      enemies.current.push(createBigMudBall(player.current.x + Math.cos(angle) * distance, player.current.y + Math.sin(angle) * distance));
    };
    const getMudBallCap = () => {
      const stormPressure = getStormPhasePressure();
      const normalCap = 24 + player.current.level * 3 + player.current.mudSpawnEscalations * 8;
      if (stormPressure <= 0) return Math.min(100, normalCap);
      return Math.max(18, Math.min(100, normalCap - stormPressure * 2));
    };
    const isOnScreen = (x, y, margin = 60) => {
      const screenX = x - camera.current.x + window.innerWidth / 2;
      const screenY = y - camera.current.y + window.innerHeight / 2;
      return screenX > -margin && screenX < window.innerWidth + margin && screenY > -margin && screenY < window.innerHeight + margin;
    };
    const getQueuedWaterDropPosition = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (player.current.godMode && player.current.waterDropAimTest) return { x: player.current.x, y: player.current.y };
      const screenX = 80 + Math.random() * Math.max(80, w - 160);
      const screenY = 120 + Math.random() * Math.max(80, h - 240);
      return { x: camera.current.x + screenX - w / 2, y: camera.current.y + screenY - h / 2 };
    };
    const getWaterDropWaveGap = () => (player.current.level >= 50 ? 0.32 : player.current.level >= 25 ? 0.52 : player.current.level >= 15 ? 0.68 : 0.75);
    const queueWaterDropWave = () => {
      const count = getWaterDropSpawnCount();
      if (count <= 0) return;
      const baseGap = getWaterDropWaveGap();
      for (let i = 0; i < count; i += 1) waterDropQueue.current.push({ delay: i * baseGap + (i === 0 ? 0 : Math.random() * 0.18), position: getQueuedWaterDropPosition() });
    };
    const updateWaterDropQueue = (dt) => {
      waterDropQueue.current = waterDropQueue.current.filter((queued) => {
        queued.delay -= dt;
        if (queued.delay <= 0) { waterDrops.current.push(createWaterDrop(queued.position.x, queued.position.y)); return false; }
        return true;
      });
    };
    const createWaterSplash = (x, y, radius = 46) => {
      waterSplashes.current.push({ x, y, radius: 8, maxRadius: radius, life: 0.45, maxLife: 0.45 });
      for (let i = 0; i < 10; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 45 + Math.random() * 120;
        waterSplashes.current.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 3 + Math.random() * 4, life: 0.5, maxLife: 0.5, particle: true });
      }
    };
    const applyWaterSplashKnockback = (x, y, radius = 46) => {
      const dx = player.current.x - x;
      const dy = player.current.y - y;
      const distance = Math.hypot(dx, dy);
      if (distance > radius) return;
      let pushX = dx;
      let pushY = dy;
      if (distance < 1) { const moveDistance = Math.hypot(player.current.vx, player.current.vy); if (moveDistance > 1) { pushX = -player.current.vx / moveDistance; pushY = -player.current.vy / moveDistance; } else { pushX = 0; pushY = -1; } }
      else { pushX = dx / distance; pushY = dy / distance; }
      const strength = 624 * (1 - Math.min(distance, radius) / radius) + 216;
      player.current.knockbackX = pushX * strength;
      player.current.knockbackY = pushY * strength;
      player.current.knockbackTimer = 0.28;
    };
    const splitMudBall = (enemy, newEnemies) => {
      for (let i = 0; i < 12; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 130;
        mudParticles.current.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 3 + Math.random() * 4, life: 1 });
      }
      if (enemy.type !== "big") return;
      for (let i = 0; i < 3; i += 1) { const angle = (Math.PI * 2 * i) / 3 + Math.random() * 0.8; newEnemies.push(createSmallMudBall(enemy.x + Math.cos(angle) * 18, enemy.y + Math.sin(angle) * 18, angle)); }
    };

    const updateTransformation = (dt) => {
      if (!player.current.transforming) return;
      player.current.transformTimer -= dt;
      if (player.current.transformTimer <= 0) { player.current.transforming = false; player.current.transformTimer = 0; player.current.humanoidForm = true; }
    };
    const updatePlayer = (dt) => {
      let inputX = 0;
      let inputY = 0;
      if (keys.current.ArrowLeft || keys.current.a || keys.current.A) inputX -= 1;
      if (keys.current.ArrowRight || keys.current.d || keys.current.D) inputX += 1;
      if (keys.current.ArrowUp || keys.current.w || keys.current.W) inputY -= 1;
      if (keys.current.ArrowDown || keys.current.s || keys.current.S) inputY += 1;
      if (touchState.current.active) { inputX += stickRef.current.dx / 56; inputY += stickRef.current.dy / 56; }
      const length = Math.hypot(inputX, inputY);
      const analogAmount = Math.min(1, length);
      if (length > 0) { inputX /= length; inputY /= length; }
      const maxSpeed = player.current.dead ? 0 : player.current.humanoidForm || player.current.transforming ? 150 : 300;
      player.current.vx = inputX * maxSpeed * analogAmount;
      player.current.vy = inputY * maxSpeed * analogAmount;
      let moveX = player.current.vx;
      let moveY = player.current.vy;
      if (player.current.knockbackTimer > 0) {
        moveX += player.current.knockbackX;
        moveY += player.current.knockbackY;
        player.current.knockbackTimer = Math.max(0, player.current.knockbackTimer - dt);
        player.current.knockbackX *= 0.86;
        player.current.knockbackY *= 0.86;
      }
      player.current.x += moveX * dt;
      player.current.y += moveY * dt;
      player.current.bob += dt * 4.5;
      if (player.current.dead) player.current.deathTimer += dt;
      camera.current.x = player.current.x;
      camera.current.y = player.current.y;
    };
    const updateMudBalls = (dt) => {
      spawnTimer.current -= dt;
      if (spawnTimer.current <= 0 && enemies.current.length < getMudBallCap()) { spawnMudBall(); spawnTimer.current = Math.max(0.18, 1.2 / player.current.enemySpawnMultiplier); }
      const handSpin = player.current.bob * getCloudSpinSpeed();
      const handDistance = 78 * 0.72 * (player.current.scale || 1);
      const handCount = getCloudHandCount();
      const cloudHands = [];
      for (let i = 0; i < handCount; i += 1) { const angle = handSpin + (Math.PI * 2 * i) / handCount; cloudHands.push({ x: player.current.x + Math.cos(angle) * handDistance, y: player.current.y + Math.sin(angle) * handDistance }); }
      const newEnemies = [];
      enemies.current = enemies.current.filter((enemy) => {
        const distanceFromPlayer = Math.hypot(enemy.x - player.current.x, enemy.y - player.current.y);
        if (distanceFromPlayer > 1150 && !isOnScreen(enemy.x, enemy.y, 120)) return false;
        enemy.hitCooldown = Math.max(0, enemy.hitCooldown - dt);
        enemy.flashTimer = Math.max(0, enemy.flashTimer - dt);
        const prediction = Math.min(0.55, player.current.level * 0.018);
        const targetX = player.current.x + player.current.vx * prediction;
        const targetY = player.current.y + player.current.vy * prediction;
        const dx = targetX - enemy.x;
        const dy = targetY - enemy.y;
        const distance = Math.hypot(dx, dy) || 1;
        const enemySpeed = (enemy.type === "small" ? 70 : 52) + player.current.enemySpeedBonus + player.current.level * 0.45 + player.current.mudSpeedEscalations * 3;
        enemy.vx += (dx / distance) * enemySpeed * dt;
        enemy.vy += (dy / distance) * enemySpeed * dt;
        enemy.vx *= 0.94;
        enemy.vy *= 0.94;
        const handHitRadius = enemy.radius + (15 + getCloudHandBonusSize()) * (player.current.scale || 1);
        const handHit = !player.current.humanoidForm && !player.current.transforming && cloudHands.some((hand) => Math.hypot(enemy.x - hand.x, enemy.y - hand.y) < handHitRadius);
        if (handHit && enemy.hitCooldown <= 0) {
          const damage = scaleDamage(5);
          enemy.hp -= damage;
          enemy.flashTimer = 0.08;
          addDamageText(enemy.x, enemy.y - enemy.radius, damage);
          enemy.hitCooldown = 0.25;
          if (Math.random() <= getBonFistKnockbackChance()) applyEnemyKnockback(enemy, player.current.x, player.current.y, 260);
        }
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
        if (!handHit && Math.hypot(enemy.x - player.current.x, enemy.y - player.current.y) < enemy.radius + 23 * (player.current.scale || 1)) {
          if (!player.current.godMode) { player.current.hp = Math.max(0, player.current.hp - 5); resetKillStreak(); if (player.current.hp <= 0) triggerDeath(); }
          splitMudBall(enemy, newEnemies);
          return false;
        }
        if (enemy.hp <= 0) {
          if (!player.current.godMode) { player.current.kills += 1; addKillStreak(); addXp(enemy.type === "big" ? 6 : 2); }
          splitMudBall(enemy, newEnemies);
          if (enemy.type === "small" && Math.random() < 1 / 3) energyOrbs.current.push({ x: enemy.x, y: enemy.y, radius: 8, bob: Math.random() * Math.PI * 2 });
          return false;
        }
        return true;
      });
      enemies.current.push(...newEnemies);
      waterDrops.current.forEach((drop) => {
        const handHitRadius = drop.radius + (15 + getCloudHandBonusSize()) * (player.current.scale || 1);
        const handHit = !player.current.humanoidForm && !player.current.transforming && cloudHands.some((hand) => Math.hypot(drop.x - hand.x, drop.y - hand.y) < handHitRadius);
        drop.handHitCooldown = Math.max(0, drop.handHitCooldown || 0);
        if (handHit && drop.handHitCooldown <= 0) { const damage = scaleDamage(5); drop.hp -= damage; drop.flashTimer = 0.08; addDamageText(drop.x, drop.y - drop.radius, damage); drop.handHitCooldown = 0.25; }
        drop.handHitCooldown = Math.max(0, drop.handHitCooldown - dt);
      });
    };
    const updateEnergyOrbs = (dt) => {
      energyOrbs.current = energyOrbs.current.filter((orb) => {
        orb.bob += dt * 4;
        const dx = player.current.x - orb.x;
        const dy = player.current.y - orb.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance < 34 * (player.current.scale || 1)) { addEnergy(1); return false; }
        if (distance < 130 * (player.current.scale || 1)) { orb.x += (dx / distance) * 120 * dt; orb.y += (dy / distance) * 120 * dt; }
        return true;
      });
      healthOrbs.current = healthOrbs.current.filter((orb) => {
        orb.bob += dt * 4;
        const dx = player.current.x - orb.x;
        const dy = player.current.y - orb.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance < 34 * (player.current.scale || 1)) { player.current.hp = Math.min(player.current.maxHp, player.current.hp + (orb.healAmount || 10)); return false; }
        if (distance < 130 * (player.current.scale || 1)) { orb.x += (dx / distance) * 120 * dt; orb.y += (dy / distance) * 120 * dt; }
        return true;
      });
    };
    const shootWaterProjectile = (drop) => {
      const dx = player.current.x - drop.x;
      const dy = player.current.y - drop.y;
      const distance = Math.hypot(dx, dy) || 1;
      waterProjectiles.current.push({ x: drop.x, y: drop.y, vx: (dx / distance) * 240, vy: (dy / distance) * 240, radius: 5, life: 2.5 });
    };
    const updateWaterDrops = (dt) => {
      if (player.current.level >= 5) { waterSpawnTimer.current -= dt; if (waterSpawnTimer.current <= 0) { queueWaterDropWave(); waterSpawnTimer.current = getWaterDropSpawnDelay(); } }
      updateWaterDropQueue(dt);
      waterDrops.current = waterDrops.current.filter((drop) => {
        drop.bob += dt * 3;
        drop.flashTimer = Math.max(0, drop.flashTimer - dt);
        if (drop.state === "falling") {
          drop.fallTimer += dt;
          const t = Math.min(1, drop.fallTimer / drop.fallDuration);
          const eased = t * t * (3 - 2 * t);
          drop.y = drop.startY + (drop.targetY - drop.startY) * eased;
          if (t >= 1) { drop.y = drop.targetY; drop.state = "forming"; drop.formTimer = 0; createWaterSplash(drop.x, drop.y); applyWaterSplashKnockback(drop.x, drop.y); }
          return true;
        }
        if (drop.state === "forming") { drop.formTimer += dt; if (drop.formTimer >= drop.formDuration) { drop.state = "active"; drop.shootTimer = 0.6 + Math.random() * Math.max(0.4, getWaterShootDelay() * 0.55); } return true; }
        if (drop.state === "active" && isOnScreen(drop.x, drop.y)) {
          if (drop.burstLeft > 0) { drop.burstCooldown -= dt; if (drop.burstCooldown <= 0) { shootWaterProjectile(drop); drop.burstLeft -= 1; drop.burstCooldown = 0.15; } }
          else { drop.shootTimer -= dt; if (drop.shootTimer <= 0) { drop.burstLeft = 3 + Math.floor(Math.random() * 3); drop.burstCooldown = 0; drop.shootTimer = getWaterShootDelay(); } }
        }
        if (drop.hp <= 0) { healthOrbs.current.push({ x: drop.x, y: drop.y, radius: 9, healAmount: getWaterDropHealAmount(), bob: Math.random() * Math.PI * 2 }); if (!player.current.godMode) { player.current.kills += 1; addKillStreak(); addXp(10); } return false; }
        return true;
      });
      waterProjectiles.current = waterProjectiles.current.map((waterShot) => ({ ...waterShot, x: waterShot.x + waterShot.vx * dt, y: waterShot.y + waterShot.vy * dt, life: waterShot.life - dt })).filter((waterShot) => {
        if (!player.current.godMode && Math.hypot(waterShot.x - player.current.x, waterShot.y - player.current.y) < waterShot.radius + 22 * (player.current.scale || 1)) { player.current.hp = Math.max(0, player.current.hp - 1); resetKillStreak(); if (player.current.hp <= 0) triggerDeath(); return false; }
        return waterShot.life > 0;
      });
      waterSplashes.current = waterSplashes.current.map((splash) => splash.particle ? { ...splash, x: splash.x + splash.vx * dt, y: splash.y + splash.vy * dt, vx: splash.vx * 0.92, vy: splash.vy * 0.92, life: splash.life - dt } : { ...splash, radius: Math.min(splash.maxRadius, splash.radius + dt * 160), life: splash.life - dt }).filter((splash) => splash.life > 0);
    };
    const updateCloudShots = (dt) => {
      if (player.current.cloudShotCooldown > 0) player.current.cloudShotCooldown -= dt;
      if (player.current.humanoidForm && !player.current.dead && player.current.cloudShotCooldown <= 0 && (enemies.current.length > 0 || waterDrops.current.length > 0)) {
        let closest = null;
        let closestDistance = Infinity;
        [...enemies.current, ...waterDrops.current].forEach((target) => { const distance = Math.hypot(target.x - player.current.x, target.y - player.current.y); if (distance < closestDistance) { closest = target; closestDistance = distance; } });
        if (closest) {
          const dx = closest.x - player.current.x;
          const dy = closest.y - player.current.y;
          const shotAngle = Math.atan2(dy, dx);
          const bigBlast = isBigCloudBlastActive();
          const alternatingBigBlast = isAlternatingBigBonBallsActive();
          let throwSide = Math.cos(shotAngle) >= 0 ? 1 : -1;
          if (((player.current.killStreak || 0) >= 40 && !bigBlast) || alternatingBigBlast) { player.current.lastShotSide = (player.current.lastShotSide || 1) * -1; throwSide = player.current.lastShotSide; }
          const visualScaleX = 0.72 * 0.82;
          const visualScaleY = 0.82 * 0.82;
          const handLocalX = bigBlast && !alternatingBigBlast ? Math.cos(shotAngle) * 42 : (throwSide > 0 ? 58 : -58) + Math.cos(shotAngle) * 34;
          const handLocalY = bigBlast && !alternatingBigBlast ? 24 + Math.sin(shotAngle) * 28 : 34 + Math.sin(shotAngle) * 26;
          const handX = player.current.x + handLocalX * visualScaleX;
          const handY = player.current.y + handLocalY * visualScaleY;
          const shotDx = closest.x - handX;
          const shotDy = closest.y - handY;
          const shotDistance = Math.hypot(shotDx, shotDy) || 1;
          cloudShots.current.push({ x: handX, y: handY, vx: (shotDx / shotDistance) * 360, vy: (shotDy / shotDistance) * 360, radius: bigBlast ? getBigBonBallRadius() : 10, life: bigBlast ? 2.1 : 1.6, damage: bigBlast ? getBigBonBallDamage() : 8, aoeRadius: bigBlast ? getBigBonBallAoeRadius() : 0, aoeHits: bigBlast ? getBigBonBallAoeHits() : 0, wobble: Math.random() * Math.PI * 2, spin: Math.random() * Math.PI * 2 });
          player.current.lastShotAngle = shotAngle;
          player.current.shotHandSide = throwSide;
          player.current.shotWasBig = bigBlast;
          player.current.shotAnimDuration = bigBlast ? 0.32 : 0.18;
          player.current.shotAnimTimer = player.current.shotAnimDuration;
          player.current.cloudShotFlash = bigBlast ? 0.28 : 0.18;
          player.current.cloudShotCooldown = player.current.godMode ? 0.035 : getHumanoidFireCooldown();
        }
      }
      cloudShots.current = cloudShots.current.map((shot) => ({ ...shot, x: shot.x + shot.vx * dt, y: shot.y + shot.vy * dt, life: shot.life - dt, wobble: shot.wobble + dt * 12 })).filter((shot) => {
        const damageArea = (hitX, hitY, primaryTarget = null) => {
          if (!shot.aoeRadius) return;
          let hits = 0;
          [...enemies.current, ...waterDrops.current].map((target) => ({ target, distance: Math.hypot(target.x - hitX, target.y - hitY) })).filter(({ target, distance }) => target !== primaryTarget && distance <= shot.aoeRadius).sort((a, b) => a.distance - b.distance).forEach(({ target }) => {
            if (hits >= shot.aoeHits) return;
            const splashDamage = scaleDamage(Math.max(10, Math.floor((shot.damage || 8) * 0.75)));
            target.hp -= splashDamage;
            target.flashTimer = 0.08;
            addDamageText(target.x, target.y - target.radius, splashDamage, !!shot.aoeRadius);
            if (Math.random() <= getBonBallKnockbackChance()) applyEnemyKnockback(target, hitX, hitY, 320);
            hits += 1;
          });
        };
        for (const enemy of enemies.current) {
          if (Math.hypot(enemy.x - shot.x, enemy.y - shot.y) < enemy.radius + shot.radius) { const shotDamage = scaleDamage(shot.damage || 8); enemy.hp -= shotDamage; enemy.flashTimer = 0.08; addDamageText(enemy.x, enemy.y - enemy.radius, shotDamage, !!shot.aoeRadius); if (Math.random() <= getBonBallKnockbackChance()) applyEnemyKnockback(enemy, shot.x, shot.y, shot.aoeRadius ? 430 : 240); damageArea(enemy.x, enemy.y, enemy); return false; }
        }
        for (const drop of waterDrops.current) {
          if (Math.hypot(drop.x - shot.x, drop.y - shot.y) < drop.radius + shot.radius) { const shotDamage = scaleDamage(shot.damage || 8); drop.hp -= shotDamage; drop.flashTimer = 0.08; addDamageText(drop.x, drop.y - drop.radius, shotDamage, !!shot.aoeRadius); damageArea(drop.x, drop.y, drop); return false; }
        }
        return shot.life > 0;
      });
    };
    const updateEyeGlance = (dt) => {
      if (player.current.dead) return;
      let closest = null;
      let closestDistance = Infinity;
      const lockRange = 245;
      [...enemies.current, ...waterDrops.current.filter((drop) => drop.state === "active")].forEach((target) => { const distance = Math.hypot(target.x - player.current.x, target.y - player.current.y); if (distance < closestDistance && distance <= lockRange) { closest = target; closestDistance = distance; } });
      const wantsLock = !!closest && !player.current.blinking && player.current.blinkTimer > 0.18;
      player.current.lockOnIntensity += ((wantsLock ? 1 : 0) - player.current.lockOnIntensity) * Math.min(1, dt * 5.5);
      if (player.current.blinking || player.current.blinkTimer < 0.16) { player.current.targetEyeOffsetX *= 0.65; player.current.targetEyeOffsetY *= 0.65; }
      else if (closest) { const dx = closest.x - player.current.x; const dy = closest.y - player.current.y; const distance = Math.hypot(dx, dy) || 1; const closeness = 1 - Math.min(1, closestDistance / lockRange); const trackStrength = 1.65 + closeness * 0.8; player.current.targetEyeOffsetX = clamp((dx / distance) * trackStrength, -2.4, 2.4); player.current.targetEyeOffsetY = clamp((dy / distance) * (trackStrength * 0.52), -1.35, 1.35); }
      else { player.current.targetEyeOffsetX = 0; player.current.targetEyeOffsetY = 0; }
      const ease = Math.min(1, dt * 3.6);
      player.current.eyeOffsetX += (player.current.targetEyeOffsetX - player.current.eyeOffsetX) * ease;
      player.current.eyeOffsetY += (player.current.targetEyeOffsetY - player.current.eyeOffsetY) * ease;
    };
    const updateParticles = (dt) => {
      mudParticles.current = mudParticles.current.map((p) => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vx: p.vx * 0.9, vy: p.vy * 0.9, life: p.life - dt * 2.5 })).filter((p) => p.life > 0);
      deathPuffs.current = deathPuffs.current.map((p) => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vx: p.vx * 0.985, vy: p.vy * 0.985, radius: p.radius + dt * 18, life: p.life - dt * 0.45 })).filter((p) => p.life > 0);
      windBursts.current = windBursts.current.map((b) => ({ ...b, radius: b.radius + dt * 420, life: b.life - dt * 2.2 })).filter((b) => b.life > 0);
      if (player.current.specialTimer > 0) player.current.specialTimer = Math.max(0, player.current.specialTimer - dt);
      if (player.current.cloudShotFlash > 0) player.current.cloudShotFlash = Math.max(0, player.current.cloudShotFlash - dt);
      if (player.current.shotAnimTimer > 0) player.current.shotAnimTimer = Math.max(0, player.current.shotAnimTimer - dt);
      updateEyeGlance(dt);
      if (player.current.killStreakTimer > 0) player.current.killStreakTimer = Math.max(0, player.current.killStreakTimer - dt);
      if (!player.current.dead) {
        if (player.current.blinking) { player.current.blinkDuration -= dt; if (player.current.blinkDuration <= 0) { player.current.blinking = false; player.current.blinkTimer = Math.random() < 0.22 ? 0.18 + Math.random() * 0.16 : 1.8 + Math.random() * 4.5; } }
        else { player.current.blinkTimer -= dt; if (player.current.blinkTimer <= 0) { player.current.blinking = true; player.current.blinkDuration = 0.08 + Math.random() * 0.06; } }
      }
    };

    const drawGrass = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const tile = 96;
      const camX = camera.current.x;
      const camY = camera.current.y;
      ctx.fillStyle = "#76b852";
      ctx.fillRect(0, 0, w, h);
      const startX = Math.floor((camX - w / 2) / tile) - 1;
      const endX = Math.floor((camX + w / 2) / tile) + 1;
      const startY = Math.floor((camY - h / 2) / tile) - 1;
      const endY = Math.floor((camY + h / 2) / tile) + 1;
      for (let gy = startY; gy <= endY; gy += 1) for (let gx = startX; gx <= endX; gx += 1) {
        const screenX = gx * tile - camX + w / 2;
        const screenY = gy * tile - camY + h / 2;
        const n = seedNoise(gx, gy);
        ctx.fillStyle = n > 0.5 ? "rgba(88,150,55,0.16)" : "rgba(180,225,105,0.13)";
        ctx.fillRect(screenX, screenY, tile, tile);
        for (let i = 0; i < 9; i += 1) { const px = screenX + seedNoise(gx * 13 + i, gy * 7 - i) * tile; const py = screenY + seedNoise(gx * 5 - i, gy * 11 + i) * tile; const blade = 4 + seedNoise(gx + i * 2, gy - i * 4) * 6; ctx.strokeStyle = n > 0.5 ? "rgba(47,112,38,0.28)" : "rgba(61,130,45,0.24)"; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 2, py - blade); ctx.stroke(); }
      }
    };
    const drawCloudBlob = (x, y, scale = 1, withStroke = true) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      const cloud = ctx.createRadialGradient(-12, -18, 8, 0, 0, 64);
      cloud.addColorStop(0, "#ffffff");
      cloud.addColorStop(0.58, "#ecfbff");
      cloud.addColorStop(1, "#a9dff5");
      ctx.fillStyle = cloud;
      ctx.strokeStyle = "rgba(84,151,180,0.45)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-48, 8);
      ctx.bezierCurveTo(-58, -10, -40, -27, -23, -23);
      ctx.bezierCurveTo(-17, -46, 18, -48, 25, -24);
      ctx.bezierCurveTo(48, -28, 61, -7, 49, 13);
      ctx.bezierCurveTo(55, 34, 25, 45, 5, 36);
      ctx.bezierCurveTo(-14, 47, -46, 36, -43, 16);
      ctx.closePath();
      ctx.fill();
      if (withStroke) ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.36)";
      [[-20, -16, 18], [13, -20, 20], [29, 2, 17], [-25, 11, 19], [4, 18, 24]].forEach(([px, py, r]) => { ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); });
      ctx.restore();
    };
    const drawFace = (sad = false) => {
      ctx.strokeStyle = "#27323a";
      ctx.fillStyle = "#27323a";
      ctx.lineCap = "round";
      const lock = player.current.lockOnIntensity || 0;
      const drawTickBrow = (side) => {
        const baseX = side * 12;
        const y = -15 + (-12.5 + 15) * lock;
        const innerX = baseX - side * (5 + lock * 2.5);
        const midX = baseX - side * (1 + lock * 1.5);
        const outerX = baseX + side * (6 + lock * 1.5);
        const innerY = y + lock * 4.2;
        const midY = y + lock * 1.2;
        const outerY = y - lock * 2.8;
        ctx.strokeStyle = "#27323a";
        ctx.lineWidth = 3.2 + lock * 1.8;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        if (lock < 0.2) ctx.arc(baseX, -15, 6, 1.08 * Math.PI, 1.92 * Math.PI);
        else { ctx.moveTo(innerX, innerY); ctx.quadraticCurveTo(midX, midY, outerX, outerY); }
        ctx.stroke();
      };
      drawTickBrow(-1);
      drawTickBrow(1);
      if (player.current.blinking && !sad) {
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.arc(-12, -5, 5, 0.08 * Math.PI, 0.92 * Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.arc(12, -5, 5, 0.08 * Math.PI, 0.92 * Math.PI); ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(-12 + player.current.eyeOffsetX, -5 + player.current.eyeOffsetY, 4, 5, 0, 0, Math.PI * 2);
        ctx.ellipse(12 + player.current.eyeOffsetX, -5 + player.current.eyeOffsetY, 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "#27323a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (sad) ctx.arc(0, 13, 11, 1.08 * Math.PI, 1.92 * Math.PI);
      else ctx.arc(0, 3, 11, 0.12 * Math.PI, 0.88 * Math.PI);
      ctx.stroke();
    };
    const drawBonBonCloudForm = () => {
      ctx.fillStyle = "rgba(25,55,25,0.16)";
      ctx.beginPath(); ctx.ellipse(0, 48, 34, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(235,248,255,0.54)";
      for (let i = 0; i < 6; i += 1) { const drift = Math.sin(player.current.bob * 1.4 + i) * 5; const fade = 1 - i / 6; ctx.globalAlpha = 0.22 + fade * 0.38; ctx.beginPath(); ctx.ellipse(-18 + i * 7 + drift, 31 + i * 6, 15 - i * 1.4, 9 - i * 0.7, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      if (!player.current.dead) {
        ctx.save(); ctx.rotate(player.current.bob * getCloudSpinSpeed()); ctx.fillStyle = "#eaf9ff"; ctx.strokeStyle = "rgba(84,151,180,0.35)"; ctx.lineWidth = 2;
        const handCount = getCloudHandCount();
        for (let i = 0; i < handCount; i += 1) { const angle = (Math.PI * 2 * i) / handCount; const hx = Math.cos(angle) * 76; const hy = Math.sin(angle) * 76; ctx.beginPath(); ctx.ellipse(hx, hy, 15 + getCloudHandBonusSize(), 11 + getCloudHandBonusSize() * 0.65, angle + 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        ctx.restore();
      }
      drawCloudBlob(0, 0, 1); drawFace(player.current.dead);
    };
    const drawBonBonHumanoidForm = (transformProgress) => {
      const moving = Math.hypot(player.current.vx, player.current.vy) > 8;
      const walk = moving ? Math.sin(player.current.bob * 4.5) : 0;
      const shotAnimProgress = player.current.shotAnimDuration > 0 ? 1 - player.current.shotAnimTimer / player.current.shotAnimDuration : 1;
      const throwFlash = player.current.shotAnimTimer > 0 ? 1 - shotAnimProgress : 0;
      const throwAngle = player.current.lastShotAngle;
      const throwSide = player.current.shotHandSide || (Math.cos(throwAngle) >= 0 ? 1 : -1);
      const shotWasBig = player.current.shotWasBig;
      const windup = shotAnimProgress < 0.35 ? shotAnimProgress / 0.35 : 0;
      const release = shotAnimProgress >= 0.35 && shotAnimProgress < 0.7 ? (shotAnimProgress - 0.35) / 0.35 : 0;
      const recover = shotAnimProgress >= 0.7 ? (shotAnimProgress - 0.7) / 0.3 : 0;
      const throwArc = player.current.shotAnimTimer > 0 ? Math.sin(Math.min(1, shotAnimProgress) * Math.PI) : 0;
      const throwReach = player.current.shotAnimTimer > 0 ? (-14 * windup + (shotWasBig ? 44 : 34) * Math.sin(release * Math.PI * 0.5)) * (1 - recover * 0.85) : 0;
      const recoil = player.current.shotAnimTimer > 0 ? Math.sin(shotAnimProgress * Math.PI * 2) * (shotWasBig ? 10 : 7) : 0;
      ctx.fillStyle = "rgba(25,55,25,0.16)";
      ctx.beginPath(); ctx.ellipse(0, 62, 32, 8, 0, 0, Math.PI * 2); ctx.fill();
      const leftLegSwing = walk * 6; const rightLegSwing = -walk * 6; const leftFootY = 52 + Math.max(0, -walk) * 2; const rightFootY = 52 + Math.max(0, walk) * 2;
      ctx.strokeStyle = "rgba(84,151,180,0.55)"; ctx.lineWidth = 10; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-10, 22); ctx.quadraticCurveTo(-13 + leftLegSwing * 0.3, 34, -18 + leftLegSwing * 0.75, leftFootY - 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10, 22); ctx.quadraticCurveTo(13 + rightLegSwing * 0.3, 34, 18 + rightLegSwing * 0.75, rightFootY - 6); ctx.stroke();
      ctx.fillStyle = "#eaf9ff"; ctx.beginPath(); ctx.ellipse(-19 + leftLegSwing * 0.75, leftFootY - 4, 11, 8, walk * 0.02, 0, Math.PI * 2); ctx.ellipse(19 + rightLegSwing * 0.75, rightFootY - 4, 11, 8, -walk * 0.02, 0, Math.PI * 2); ctx.fill();
      const leftIdleHand = { x: -52, y: 28 }; const rightIdleHand = { x: 52, y: 28 }; const dirX = Math.cos(throwAngle); const dirY = Math.sin(throwAngle); const activeIdleHand = throwSide > 0 ? rightIdleHand : leftIdleHand; const idleHand = throwSide > 0 ? leftIdleHand : rightIdleHand;
      const activeHand = { x: activeIdleHand.x + dirX * throwReach + dirX * recoil, y: activeIdleHand.y + dirY * throwReach * 0.75 + dirY * recoil };
      const inactiveBounce = Math.sin(player.current.bob * 2.2) * 1.5;
      ctx.fillStyle = "#eaf9ff"; ctx.beginPath(); ctx.ellipse(activeHand.x, activeHand.y, 11 + throwArc * (shotWasBig ? 8 : 4), 9 + throwArc * (shotWasBig ? 6 : 3), throwAngle * 0.2, 0, Math.PI * 2); ctx.ellipse(idleHand.x, idleHand.y + inactiveBounce, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
      if (throwFlash > 0) { const peelX = activeHand.x - dirX * 10; const peelY = activeHand.y - dirY * 8; ctx.fillStyle = `rgba(235,248,255,${throwFlash * (shotWasBig ? 0.85 : 0.6)})`; ctx.beginPath(); ctx.arc(peelX, peelY, (shotWasBig ? 12 : 8) + throwArc * (shotWasBig ? 11 : 7), 0, Math.PI * 2); ctx.arc(peelX - dirY * 5, peelY + dirX * 5, (shotWasBig ? 8 : 5) + throwArc * (shotWasBig ? 7 : 4), 0, Math.PI * 2); if (shotWasBig) ctx.arc(peelX - dirX * 9, peelY - dirY * 9, 6 + throwArc * 5, 0, Math.PI * 2); ctx.fill(); }
      drawCloudBlob(0, 0, 0.98); drawFace(player.current.dead);
      if (throwFlash > 0) { const muzzleX = activeHand.x + dirX * 12; const muzzleY = activeHand.y + dirY * 8; ctx.fillStyle = `rgba(235,248,255,${throwFlash})`; ctx.beginPath(); ctx.arc(muzzleX, muzzleY, (shotWasBig ? 13 : 9) + throwArc * (shotWasBig ? 14 : 9), 0, Math.PI * 2); ctx.arc(muzzleX - dirX * 7 - dirY * 3, muzzleY - dirY * 7 + dirX * 3, (shotWasBig ? 9 : 6) + throwArc * (shotWasBig ? 8 : 5), 0, Math.PI * 2); if (shotWasBig) ctx.arc(muzzleX - dirX * 15 + dirY * 4, muzzleY - dirY * 15 - dirX * 4, 7 + throwArc * 6, 0, Math.PI * 2); ctx.fill(); }
      if (player.current.transforming) { ctx.strokeStyle = `rgba(235,248,255,${0.9 - transformProgress * 0.4})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 10, 58 + transformProgress * 28, 0, Math.PI * 2); ctx.stroke(); }
    };
    const drawBonBon = () => {
      const w = window.innerWidth; const h = window.innerHeight; const transforming = player.current.transforming; const transformProgress = transforming ? 1 - player.current.transformTimer / 0.9 : player.current.humanoidForm ? 1 : 0; const inhalePulse = transforming ? 1 + Math.sin(transformProgress * Math.PI) * 0.32 : 1; const bobY = player.current.dead || player.current.humanoidForm || transforming ? 0 : Math.sin(player.current.bob) * 4; const deathScale = player.current.dead ? Math.max(0.2, 1 - player.current.deathTimer * 1.8) : 1;
      if (player.current.dead && player.current.deathTimer > 0.65) return;
      ctx.save(); ctx.translate(w / 2, h / 2 + bobY); const debugScale = player.current.scale || 0.7; const walkingFormSize = transformProgress > 0 ? 0.82 : 1; ctx.scale(0.72 * walkingFormSize * deathScale * inhalePulse * debugScale, 0.82 * walkingFormSize * deathScale * inhalePulse * debugScale); if (player.current.humanoidForm || player.current.transforming) drawBonBonHumanoidForm(transformProgress); else drawBonBonCloudForm(); ctx.restore();
    };

    const worldToScreen = (x, y) => ({ x: x - camera.current.x + window.innerWidth / 2, y: y - camera.current.y + window.innerHeight / 2 });
    const drawMudBalls = () => {
      mudParticles.current.forEach((p) => { const s = worldToScreen(p.x, p.y); ctx.fillStyle = `rgba(82,52,30,${Math.max(0, p.life)})`; ctx.beginPath(); ctx.arc(s.x, s.y, p.radius, 0, Math.PI * 2); ctx.fill(); });
      enemies.current.forEach((enemy) => { const s = worldToScreen(enemy.x, enemy.y); const movingAmount = Math.min(1, Math.hypot(enemy.vx, enemy.vy) / 40); const wobble = Math.sin(player.current.bob * 8 + enemy.wobbleSeed) * 2.2 * movingAmount; const squash = Math.cos(player.current.bob * 8 + enemy.wobbleSeed) * 0.08 * movingAmount; ctx.fillStyle = "rgba(25,20,12,0.16)"; ctx.beginPath(); ctx.ellipse(s.x, s.y + enemy.radius * 0.7, enemy.radius * 0.9, enemy.radius * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = enemy.flashTimer > 0 ? "#ffffff" : enemy.type === "small" ? "#7a5435" : "#6b4a2f"; ctx.strokeStyle = "#3e2819"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(s.x + wobble, s.y, enemy.radius * (1 + squash), enemy.radius * (1 - squash), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = enemy.flashTimer > 0 ? "#ffffff" : enemy.type === "small" ? "#9b724d" : "#8a6542"; ctx.beginPath(); ctx.arc(s.x - enemy.radius * 0.25 + wobble, s.y - enemy.radius * 0.22, enemy.radius * 0.28, 0, Math.PI * 2); ctx.arc(s.x + enemy.radius * 0.35 + wobble, s.y + enemy.radius * 0.16, enemy.radius * 0.22, 0, Math.PI * 2); ctx.fill(); const hpW = enemy.type === "small" ? 20 : 32; const hpFill = hpW * Math.max(0, enemy.hp / enemy.maxHp); ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(s.x - hpW / 2, s.y - enemy.radius - 12, hpW, 5); ctx.fillStyle = "#e44747"; ctx.fillRect(s.x - hpW / 2, s.y - enemy.radius - 12, hpFill, 5); });
    };
    const drawEnergyOrbs = () => {
      energyOrbs.current.forEach((orb) => { const s = worldToScreen(orb.x, orb.y); const y = s.y + Math.sin(orb.bob) * 4; ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.beginPath(); ctx.arc(s.x, y, orb.radius + 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#78e8ff"; ctx.beginPath(); ctx.arc(s.x, y, orb.radius, 0, Math.PI * 2); ctx.fill(); });
      healthOrbs.current.forEach((orb) => { const s = worldToScreen(orb.x, orb.y); const y = s.y + Math.sin(orb.bob) * 4; ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.beginPath(); ctx.arc(s.x, y, orb.radius + 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#1fa8ff"; ctx.beginPath(); ctx.arc(s.x, y, orb.radius, 0, Math.PI * 2); ctx.fill(); });
    };
    const drawWaterDrops = () => {
      waterSplashes.current.forEach((splash) => { const s = worldToScreen(splash.x, splash.y); const alpha = Math.max(0, splash.life / splash.maxLife); if (splash.particle) { ctx.fillStyle = `rgba(111,211,255,${alpha})`; ctx.beginPath(); ctx.arc(s.x, s.y, splash.radius, 0, Math.PI * 2); ctx.fill(); } else { ctx.strokeStyle = `rgba(223,248,255,${alpha})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(s.x, s.y, splash.radius, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = `rgba(42,168,255,${alpha * 0.25})`; ctx.beginPath(); ctx.ellipse(s.x, s.y + 3, splash.radius * 0.8, splash.radius * 0.28, 0, 0, Math.PI * 2); ctx.fill(); } });
      waterDrops.current.forEach((drop) => { const s = worldToScreen(drop.x, drop.y); const screenY = s.y + Math.sin(drop.bob) * (drop.state === "active" ? 3 : 0); const formProgress = drop.state === "forming" ? Math.min(1, drop.formTimer / drop.formDuration) : drop.state === "active" ? 1 : 0; const drawRadius = drop.state === "falling" ? drop.radius * 0.45 : drop.state === "forming" ? drop.radius * (0.35 + formProgress * 0.65) : drop.radius; ctx.fillStyle = "rgba(12,55,95,0.15)"; ctx.beginPath(); ctx.ellipse(s.x, drop.targetY - camera.current.y + window.innerHeight / 2 + drop.radius * 0.85, drop.radius * 0.78, drop.radius * 0.26, 0, 0, Math.PI * 2); ctx.fill(); if (drop.state === "falling") { ctx.strokeStyle = "rgba(111,211,255,0.5)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.x, screenY - 26); ctx.lineTo(s.x, screenY - 8); ctx.stroke(); } if (drop.state === "forming") { ctx.fillStyle = `rgba(42,168,255,${0.25 + formProgress * 0.35})`; ctx.beginPath(); ctx.ellipse(s.x, screenY + drop.radius * 0.55, drop.radius * (0.9 - formProgress * 0.25), drop.radius * (0.25 + formProgress * 0.15), 0, 0, Math.PI * 2); ctx.fill(); } const waterGradient = ctx.createRadialGradient(s.x - drawRadius * 0.35, screenY - drawRadius * 0.45, 2, s.x, screenY, drawRadius * 1.2); waterGradient.addColorStop(0, "#dff8ff"); waterGradient.addColorStop(0.35, "#6fd3ff"); waterGradient.addColorStop(1, "#1b8fe0"); ctx.fillStyle = drop.flashTimer > 0 ? "#ffffff" : waterGradient; ctx.strokeStyle = "#0c5f9d"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, screenY, drawRadius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "rgba(255,255,255,0.65)"; ctx.beginPath(); ctx.arc(s.x - drawRadius * 0.35, screenY - drawRadius * 0.35, drawRadius * 0.22, 0, Math.PI * 2); ctx.fill(); if (drop.state === "active") { const hpW = 28; const hpFill = hpW * Math.max(0, drop.hp / drop.maxHp); ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(s.x - hpW / 2, screenY - drop.radius - 14, hpW, 5); ctx.fillStyle = "#45c6ff"; ctx.fillRect(s.x - hpW / 2, screenY - drop.radius - 14, hpFill, 5); } });
      waterProjectiles.current.forEach((waterShot) => { const s = worldToScreen(waterShot.x, waterShot.y); ctx.fillStyle = "rgba(69,198,255,0.9)"; ctx.beginPath(); ctx.arc(s.x, s.y, waterShot.radius, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.beginPath(); ctx.arc(s.x - 2, s.y - 2, waterShot.radius * 0.35, 0, Math.PI * 2); ctx.fill(); });
    };
    const drawWindBursts = () => { windBursts.current.forEach((burst) => { const s = worldToScreen(burst.x, burst.y); ctx.strokeStyle = `rgba(230,248,255,${Math.max(0, burst.life)})`; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(s.x, s.y, burst.radius, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = `rgba(180,230,255,${Math.max(0, burst.life * 0.65)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(s.x, s.y, burst.radius * 0.68, 0, Math.PI * 2); ctx.stroke(); }); };
    const drawCloudShots = () => { cloudShots.current.forEach((shot) => { const s = worldToScreen(shot.x, shot.y); const wobbleA = Math.sin(shot.wobble) * 4; const wobbleB = Math.cos(shot.wobble * 1.4) * 4; const spinA = Math.sin((shot.spin || 0) + shot.wobble) * 2; ctx.fillStyle = shot.aoeRadius ? "rgba(235,248,255,0.96)" : "rgba(235,248,255,0.9)"; ctx.strokeStyle = "rgba(84,151,180,0.55)"; ctx.lineWidth = shot.aoeRadius ? 3 : 2; [[0, 0, shot.radius], [-7 + wobbleA, 3 + spinA, shot.radius * 0.68], [7, -3 + wobbleB, shot.radius * 0.6], [2 + wobbleB, 6, shot.radius * 0.42]].forEach(([ox, oy, r]) => { ctx.beginPath(); ctx.arc(s.x + ox, s.y + oy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }); }); };
    const drawDeathPuffs = () => { deathPuffs.current.forEach((p) => { const s = worldToScreen(p.x, p.y); ctx.fillStyle = `rgba(235,248,255,${Math.max(0, p.life * 0.8)})`; ctx.beginPath(); ctx.arc(s.x, s.y, p.radius, 0, Math.PI * 2); ctx.fill(); }); };

    const getPopupStyle = () => {
      const profile = deviceProfile.current;
      if (profile.isSmallScreen) return { levelTitle: 20, eventTitle: 21, streakTitle: 18, subtitle: 12, levelStroke: 3, eventStroke: 4, streakStroke: 3, spacing: 42, levelY: 0.22, eventY: 0.24, streakY: 0.38, pop: 0.045 };
      if (profile.isMobile || profile.isTablet) return { levelTitle: 25, eventTitle: 27, streakTitle: 23, subtitle: 15, levelStroke: 4, eventStroke: 5, streakStroke: 4, spacing: 52, levelY: 0.23, eventY: 0.25, streakY: 0.38, pop: 0.06 };
      return { levelTitle: 38, eventTitle: 42, streakTitle: 34, subtitle: 22, levelStroke: 6, eventStroke: 8, streakStroke: 7, spacing: 72, levelY: 0.26, eventY: 0.24, streakY: 0.36, pop: 0.08 };
    };
    const fitText = (text, maxChars) => (text.length > maxChars ? `${text.slice(0, Math.max(0, maxChars - 1))}…` : text);
    const drawLevelUpEffects = () => {
      const w = window.innerWidth; const h = window.innerHeight; const popup = getPopupStyle(); const compact = deviceProfile.current.isSmallScreen;
      levelUpEffects.current.forEach((effect) => { const alpha = Math.max(0, effect.life / effect.maxLife); if (effect.particle) { const s = worldToScreen(effect.x, effect.y); ctx.fillStyle = `rgba(235,248,255,${alpha * 0.82})`; ctx.beginPath(); ctx.arc(s.x, s.y, effect.radius, 0, Math.PI * 2); ctx.fill(); return; } const s = worldToScreen(effect.x, effect.y); ctx.strokeStyle = `rgba(235,248,255,${alpha})`; ctx.lineWidth = compact ? 4 : 8; ctx.beginPath(); ctx.arc(s.x, s.y, effect.radius, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = `rgba(95,168,255,${alpha * 0.7})`; ctx.lineWidth = compact ? 2 : 3; ctx.beginPath(); ctx.arc(s.x, s.y, effect.radius * 0.68, 0, Math.PI * 2); ctx.stroke(); const pop = 1 + Math.sin(alpha * Math.PI) * popup.pop; ctx.save(); ctx.translate(w / 2, h * popup.levelY); ctx.scale(pop, pop); ctx.textAlign = "center"; ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.strokeStyle = `rgba(80,150,220,${alpha * 0.75})`; ctx.lineWidth = popup.levelStroke; ctx.font = `bold ${popup.levelTitle}px sans-serif`; const label = effect.level === 5 ? "LEVEL 5! FORM UNLOCKED" : `LEVEL ${effect.level}!`; const safeLabel = fitText(label, compact ? 22 : 34); ctx.strokeText(safeLabel, 0, 0, w - 28); ctx.fillText(safeLabel, 0, 0, w - 28); ctx.restore(); });
      damageTexts.current.forEach((text) => { const alpha = Math.max(0, text.life / text.maxLife); const s = worldToScreen(text.x, text.y); ctx.save(); ctx.textAlign = "center"; ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.strokeStyle = `rgba(40,80,110,${alpha * 0.75})`; ctx.lineWidth = text.big ? (compact ? 4 : 5) : (compact ? 2 : 3); ctx.font = `bold ${text.big ? (compact ? 18 : 24) : (compact ? 12 : 17)}px sans-serif`; ctx.strokeText(`-${text.amount}`, s.x, s.y); ctx.fillText(`-${text.amount}`, s.x, s.y); ctx.restore(); });
      stormMessages.current.forEach((message) => { const alpha = Math.max(0, message.life / message.maxLife); const pop = 1 + Math.sin(alpha * Math.PI) * popup.pop; ctx.save(); ctx.translate(w / 2, h * popup.eventY); ctx.scale(pop, pop); ctx.textAlign = "center"; ctx.fillStyle = `rgba(235,248,255,${alpha})`; ctx.strokeStyle = `rgba(40,120,210,${alpha * 0.95})`; ctx.lineWidth = popup.eventStroke; ctx.font = `bold ${popup.eventTitle}px sans-serif`; const title = fitText(message.title, compact ? 18 : 28); ctx.strokeText(title, 0, 0, w - 28); ctx.fillText(title, 0, 0, w - 28); ctx.lineWidth = Math.max(2, popup.eventStroke - 2); ctx.font = `bold ${popup.subtitle}px sans-serif`; const subY = compact ? 19 : 32; const subtitle = fitText(message.subtitle, compact ? 25 : 38); ctx.strokeText(subtitle, 0, subY, w - 28); ctx.fillText(subtitle, 0, subY, w - 28); ctx.restore(); });
      streakMessages.current.forEach((message, index) => { const alpha = Math.max(0, message.life / message.maxLife); const pop = 1 + Math.sin(alpha * Math.PI) * popup.pop; ctx.save(); ctx.translate(w / 2, h * (stormMessages.current.length ? 0.48 : popup.streakY) + index * popup.spacing); ctx.scale(pop, pop); ctx.textAlign = "center"; ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.strokeStyle = `rgba(80,150,220,${alpha * 0.8})`; ctx.lineWidth = popup.streakStroke; ctx.font = `bold ${popup.streakTitle}px sans-serif`; const title = fitText(message.title, compact ? 18 : 28); ctx.strokeText(title, 0, 0, w - 28); ctx.fillText(title, 0, 0, w - 28); ctx.lineWidth = Math.max(2, popup.streakStroke - 2); ctx.font = `bold ${popup.subtitle}px sans-serif`; const subY = compact ? 18 : 30; const subtitle = fitText(message.subtitle, compact ? 25 : 38); ctx.strokeText(subtitle, 0, subY, w - 28); ctx.fillText(subtitle, 0, subY, w - 28); ctx.restore(); });
      ctx.textAlign = "left";
    };

    const getDebugRect = (name) => {
      const rect = name === "pause" ? buttons.current.pause : resolveRect(uiLayout.current[name]);
      const extraH = name === "xp" ? 55 : name === "pause" || name === "transform" || name === "bonBonSize" ? 12 : 38;
      return { x: rect.x - 6, y: rect.y - 6, w: rect.w + 12, h: rect.h + extraH };
    };
    const getHandleRects = (debugRect) => { const size = 24; return { left: { x: debugRect.x - size / 2, y: debugRect.y + debugRect.h / 2 - size / 2, w: size, h: size }, right: { x: debugRect.x + debugRect.w - size / 2, y: debugRect.y + debugRect.h / 2 - size / 2, w: size, h: size }, top: { x: debugRect.x + debugRect.w / 2 - size / 2, y: debugRect.y - size / 2, w: size, h: size }, bottom: { x: debugRect.x + debugRect.w / 2 - size / 2, y: debugRect.y + debugRect.h - size / 2, w: size, h: size } }; };
    const drawDebugOutline = (name, rect, extraH = 38) => { if (!player.current.debugMode) return; const debugRect = { x: rect.x - 6, y: rect.y - 6, w: rect.w + 12, h: rect.h + extraH }; ctx.strokeStyle = selectedUi.current === name ? "#ffe600" : "rgba(255,230,0,0.35)"; ctx.lineWidth = selectedUi.current === name ? 4 : 2; ctx.strokeRect(debugRect.x, debugRect.y, debugRect.w, debugRect.h); if (selectedUi.current === name) { ctx.fillStyle = "#ffe600"; Object.values(getHandleRects(debugRect)).forEach((handle) => ctx.fillRect(handle.x, handle.y, handle.w, handle.h)); } };
    const drawHud = () => {
      const hpRect = resolveRect(uiLayout.current.hp); const hpFillW = hpRect.w * (player.current.hp / player.current.maxHp); ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(hpRect.x - 4, hpRect.y - 4, hpRect.w + 8, hpRect.h + 25); ctx.fillStyle = "rgba(70,20,20,0.85)"; ctx.fillRect(hpRect.x, hpRect.y, hpRect.w, hpRect.h); ctx.fillStyle = "#e44747"; ctx.fillRect(hpRect.x, hpRect.y, hpFillW, hpRect.h); ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2; ctx.strokeRect(hpRect.x, hpRect.y, hpRect.w, hpRect.h); ctx.fillStyle = "white"; ctx.font = "13px sans-serif"; ctx.fillText(player.current.godMode ? "Bon Bon HP: GODMODE" : `Bon Bon HP: ${player.current.hp}/${player.current.maxHp}`, hpRect.x, hpRect.y + hpRect.h + 16); drawDebugOutline("hp", hpRect);
      const energyRect = resolveRect(uiLayout.current.energy); const energyFillW = energyRect.w * (player.current.energy / player.current.maxEnergy); ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(energyRect.x - 4, energyRect.y - 4, energyRect.w + 8, energyRect.h + 25); ctx.fillStyle = "rgba(20,60,80,0.85)"; ctx.fillRect(energyRect.x, energyRect.y, energyRect.w, energyRect.h); ctx.fillStyle = "#78e8ff"; ctx.fillRect(energyRect.x, energyRect.y, energyFillW, energyRect.h); ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.strokeRect(energyRect.x, energyRect.y, energyRect.w, energyRect.h); ctx.fillStyle = "white"; ctx.font = "13px sans-serif"; ctx.fillText(`Energy: ${player.current.energy}/${player.current.maxEnergy}`, energyRect.x, energyRect.y + energyRect.h + 16); drawDebugOutline("energy", energyRect);
      const xpRect = resolveRect(uiLayout.current.xp); const xpFillW = xpRect.w * Math.min(1, player.current.xp / player.current.xpToNextLevel); ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(xpRect.x - 4, xpRect.y - 4, xpRect.w + 8, xpRect.h + 42); ctx.fillStyle = "rgba(18,35,80,0.85)"; ctx.fillRect(xpRect.x, xpRect.y, xpRect.w, xpRect.h); ctx.fillStyle = "#5fa8ff"; ctx.fillRect(xpRect.x, xpRect.y, xpFillW, xpRect.h); ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.strokeRect(xpRect.x, xpRect.y, xpRect.w, xpRect.h); ctx.fillStyle = "white"; ctx.font = "13px sans-serif"; ctx.fillText(`Level ${player.current.level}`, xpRect.x, xpRect.y + xpRect.h + 16); ctx.fillText(`XP: ${player.current.xp}/${player.current.xpToNextLevel}`, xpRect.x + Math.min(82, xpRect.w * 0.43), xpRect.y + xpRect.h + 16); drawDebugOutline("xp", xpRect, 55);
      const pauseRect = resolveRect(uiLayout.current.pause); buttons.current.pause = pauseRect; ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(pauseRect.x, pauseRect.y, pauseRect.w, pauseRect.h); ctx.fillStyle = "white"; const lineW = Math.max(4, pauseRect.w * 0.14); const lineH = Math.max(16, pauseRect.h * 0.55); ctx.fillRect(pauseRect.x + pauseRect.w * 0.25, pauseRect.y + pauseRect.h * 0.22, lineW, lineH); ctx.fillRect(pauseRect.x + pauseRect.w * 0.62, pauseRect.y + pauseRect.h * 0.22, lineW, lineH); drawDebugOutline("pause", pauseRect, 12);
    };
    const drawKillStreakCounter = () => { const rect = resolveRect(uiLayout.current.killStreak); const visible = player.current.debugMode || player.current.godMode || player.current.killStreak >= 2; if (!visible || player.current.inMainMenu || player.current.dead) return; const label = player.current.debugMode && !player.current.godMode ? "×0" : `×${player.current.killStreak}`; const pulse = player.current.debugMode ? 1 : 1 + Math.sin(player.current.killStreakTimer * 10) * 0.04; ctx.save(); ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2); ctx.scale(pulse, pulse); ctx.fillStyle = "rgba(0,0,0,0.32)"; roundedRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h, 14); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `bold ${Math.max(18, rect.h * 0.62)}px sans-serif`; ctx.fillText(label, 0, 1); ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.restore(); drawDebugOutline("killStreak", rect, 12); };
    const drawBonBonSizeIndicator = () => { const rect = resolveRect(uiLayout.current.bonBonSize); if (!player.current.debugMode || player.current.inMainMenu || player.current.dead) return; ctx.fillStyle = "rgba(0,0,0,0.34)"; roundedRect(rect.x, rect.y, rect.w, rect.h, 12); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `bold ${Math.max(14, rect.h * 0.42)}px sans-serif`; ctx.fillText(`Bon Bon Size: ${Math.round((player.current.scale || 0.7) * 100)}%`, rect.x + rect.w / 2, rect.y + rect.h / 2); ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; drawDebugOutline("bonBonSize", rect, 12); };
    const drawTransformButton = () => {
      const rect = resolveRect(uiLayout.current.transform); buttons.current.transform = rect; if (!player.current.debugMode && (player.current.level < 5 || player.current.dead || player.current.inMainMenu)) return;
      const cx = rect.x + rect.w / 2; const cy = rect.y + rect.h / 2; const size = Math.min(rect.w, rect.h); const heartbeatTime = player.current.bob * 0.16; const heartbeatPhase = heartbeatTime % 1; const smoothPulse = (t) => { const eased = t * t * (3 - 2 * t); return Math.sin(eased * Math.PI); }; const heartbeatPulse = heartbeatPhase < 0.42 ? smoothPulse(heartbeatPhase / 0.42) * 0.72 : heartbeatPhase < 0.68 ? smoothPulse((heartbeatPhase - 0.42) / 0.26) * 0.34 : 0; const transformPulse = player.current.transforming ? Math.sin((1 - player.current.transformTimer / 0.9) * Math.PI) : 0; const pulse = Math.max(heartbeatPulse * 0.55, transformPulse); const isPcMode = !deviceProfile.current.isMobile && !deviceProfile.current.isTablet; const showQ = isPcMode && Math.floor(heartbeatTime) % 2 === 0 && heartbeatPhase < 0.68; const label = player.current.humanoidForm ? "CLOUD" : "WALK";
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1 + pulse * 0.08, 1 + pulse * 0.08); ctx.shadowColor = `rgba(95,168,255,${0.25 + pulse * 0.45})`; ctx.shadowBlur = 10 + pulse * 18; ctx.save(); ctx.scale(size / 92, size / 92); const cloud = ctx.createRadialGradient(-12, -14, 5, 0, 0, 50); cloud.addColorStop(0, "#ffffff"); cloud.addColorStop(0.62, "#ecfbff"); cloud.addColorStop(1, "#a9dff5"); ctx.fillStyle = cloud; ctx.strokeStyle = player.current.debugMode && selectedUi.current === "transform" ? "#ffe600" : "rgba(84,151,180,0.85)"; ctx.lineWidth = player.current.debugMode && selectedUi.current === "transform" ? 4 : 3; ctx.beginPath(); ctx.moveTo(-37, 7); ctx.bezierCurveTo(-45, -7, -30, -22, -17, -19); ctx.bezierCurveTo(-11, -38, 17, -39, 23, -20); ctx.bezierCurveTo(40, -22, 48, -5, 39, 10); ctx.bezierCurveTo(43, 27, 17, 35, 1, 28); ctx.bezierCurveTo(-14, 37, -40, 27, -36, 12); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.fillStyle = "rgba(255,255,255,0.34)"; [[-14, -13, 12], [10, -16, 14], [24, 2, 11], [-18, 8, 13], [2, 10, 16]].forEach(([px, py, r]) => { ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); }); if (showQ) { ctx.fillStyle = "#27323a"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 28px sans-serif"; ctx.fillText("Q", 0, -2); } else { ctx.fillStyle = "#27323a"; ctx.beginPath(); ctx.ellipse(-9, -5, 3.2, 4.2, 0, 0, Math.PI * 2); ctx.ellipse(9, -5, 3.2, 4.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#27323a"; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, 0, 7, 0.16 * Math.PI, 0.84 * Math.PI); ctx.stroke(); } if (player.current.humanoidForm) { ctx.fillStyle = "rgba(84,151,180,0.5)"; ctx.beginPath(); ctx.ellipse(-12, 30, 10, 5, 0.15, 0, Math.PI * 2); ctx.ellipse(4, 32, 13, 6, -0.1, 0, Math.PI * 2); ctx.ellipse(18, 29, 8, 4, -0.2, 0, Math.PI * 2); ctx.fill(); } ctx.fillStyle = "#2f7fb8"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 14px sans-serif"; ctx.fillText(label, 0, 43); ctx.restore(); ctx.restore(); ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; if (player.current.debugMode) drawDebugOutline("transform", rect, 12);
    };
    const drawJoystick = () => { const joystick = getJoystickBase(); if (!joystick.visible) return; const baseX = joystick.x; const baseY = joystick.y; ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(baseX, baseY, 56, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "rgba(255,255,255,0.48)"; ctx.beginPath(); ctx.arc(baseX + stickRef.current.dx, baseY + stickRef.current.dy, 25, 0, Math.PI * 2); ctx.fill(); };

    const isKeyboardSelected = (key) => {
      const options = getCurrentMenuKeyboardOptions().filter((option) => buttons.current[option]);
      if (!options.length) return false;
      return options[menuKeyboard.current.index % options.length] === key;
    };
    const drawLeaderboardScreen = () => { const w = window.innerWidth; const h = window.innerHeight; ctx.fillStyle = "#ffd84d"; ctx.fillRect(0, 0, w, h); ctx.textAlign = "center"; ctx.fillStyle = "white"; ctx.strokeStyle = "rgba(120,185,255,0.6)"; ctx.lineWidth = 8; ctx.font = "bold 50px sans-serif"; ctx.strokeText("LEADERBOARD", w / 2, 70); ctx.fillText("LEADERBOARD", w / 2, 70); ctx.fillStyle = "rgba(0,0,0,0.42)"; ctx.font = "bold 13px sans-serif"; ctx.fillText(`MODE: ${leaderboardStatus.current}`, w / 2, 94); ctx.fillStyle = "rgba(0,0,0,0.35)"; roundedRect(22, 110, w - 44, h - 225, 18); ctx.fill(); ctx.fillStyle = "white"; ctx.font = "bold 16px monospace"; ctx.fillText("RANK  TAG   LVL   KILLS  STREAK", w / 2, 150); ctx.font = "16px monospace"; if (leaderboard.current.length === 0) ctx.fillText("NO SAVED SCORES YET", w / 2, 205); leaderboard.current.forEach((entry, index) => { const streak = Number(entry.bestStreak || entry.best_streak || 0); const line = `${String(index + 1).padStart(2, "0")}    ${entry.initials.padEnd(3, " ")}   ${String(entry.level).padStart(3, " ")}   ${String(entry.kills).padStart(5, " ")}    ×${String(streak).padStart(2, " ")}`; ctx.fillText(line, w / 2, 190 + index * 28); }); const backW = 180; const backH = 54; const backX = w / 2 - backW / 2; const backY = h - 90; buttons.current.back = { x: backX, y: backY, w: backW, h: backH }; ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.strokeStyle = isKeyboardSelected("back") ? "#5fa8ff" : "rgba(80,80,80,0.35)"; ctx.lineWidth = 4; roundedRect(backX, backY, backW, backH, 16); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#333"; ctx.font = "bold 28px sans-serif"; ctx.fillText("BACK", w / 2, backY + 36); ctx.textAlign = "left"; };
    const drawSettingsScreen = () => { const w = window.innerWidth; const h = window.innerHeight; ctx.fillStyle = "#ffd84d"; ctx.fillRect(0, 0, w, h); ctx.textAlign = "center"; ctx.fillStyle = "white"; ctx.strokeStyle = "rgba(120,185,255,0.6)"; ctx.lineWidth = 8; ctx.font = "bold 56px sans-serif"; ctx.strokeText("SETTINGS", w / 2, 82); ctx.fillText("SETTINGS", w / 2, 82); ctx.fillStyle = "rgba(0,0,0,0.28)"; roundedRect(26, 122, w - 52, h - 238, 22); ctx.fill(); const buttonW = Math.min(260, w - 70); const buttonH = 58; const buttonX = w / 2 - buttonW / 2; const gap = 18; const startY = h * 0.36; buttons.current.debugTools = { x: buttonX, y: startY, w: buttonW, h: buttonH }; buttons.current.back = { x: buttonX, y: startY + buttonH + gap, w: buttonW, h: buttonH }; [["DEBUG TOOLS", buttons.current.debugTools], ["BACK", buttons.current.back]].forEach(([label, rect]) => { ctx.fillStyle = "rgba(255,255,255,0.94)"; ctx.strokeStyle = isKeyboardSelected(label === "DEBUG TOOLS" ? "debugTools" : "back") ? "#5fa8ff" : "rgba(80,80,80,0.28)"; ctx.lineWidth = 4; roundedRect(rect.x, rect.y, rect.w, rect.h, 18); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#333"; ctx.font = `bold ${label === "DEBUG TOOLS" ? 23 : 28}px sans-serif`; ctx.fillText(label, rect.x + rect.w / 2, rect.y + 38); }); ctx.textAlign = "left"; };
    const drawDebugToolsScreen = () => { const w = window.innerWidth; const h = window.innerHeight; ctx.fillStyle = "#ffd84d"; ctx.fillRect(0, 0, w, h); ctx.textAlign = "center"; ctx.fillStyle = "white"; ctx.strokeStyle = "rgba(120,185,255,0.6)"; ctx.lineWidth = 8; ctx.font = "bold 48px sans-serif"; ctx.strokeText("DEBUG TOOLS", w / 2, 82); ctx.fillText("DEBUG TOOLS", w / 2, 82); ctx.fillStyle = "rgba(0,0,0,0.28)"; roundedRect(26, 122, w - 52, h - 238, 22); ctx.fill(); const buttonW = Math.min(260, w - 70); const buttonH = 58; const buttonX = w / 2 - buttonW / 2; const gap = 16; const startY = h * 0.31; buttons.current.debug = { x: buttonX, y: startY, w: buttonW, h: buttonH }; buttons.current.godmode = { x: buttonX, y: startY + (buttonH + gap), w: buttonW, h: buttonH }; buttons.current.waterAimTest = player.current.godMode ? { x: buttonX, y: startY + (buttonH + gap) * 2, w: buttonW, h: buttonH } : null; buttons.current.back = { x: buttonX, y: h - 100, w: buttonW, h: buttonH }; const debugButtons = [["UI EDITOR", buttons.current.debug], [player.current.godMode ? "GOD OFF" : "GODMODE", buttons.current.godmode]]; if (player.current.godMode) debugButtons.push([player.current.waterDropAimTest ? "RAIN AIM ON" : "RAIN AIM OFF", buttons.current.waterAimTest]); debugButtons.push(["BACK", buttons.current.back]); debugButtons.forEach(([label, rect]) => { ctx.fillStyle = "rgba(255,255,255,0.94)"; const debugKey = label === "UI EDITOR" ? "debug" : label.includes("GOD") ? "godmode" : label.includes("RAIN") ? "waterAimTest" : "back"; ctx.strokeStyle = isKeyboardSelected(debugKey) ? "#5fa8ff" : label.includes("RAIN") && player.current.waterDropAimTest ? "#5fa8ff" : "rgba(80,80,80,0.28)"; ctx.lineWidth = 4; roundedRect(rect.x, rect.y, rect.w, rect.h, 18); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#333"; ctx.font = `bold ${label.length > 9 ? 22 : 26}px sans-serif`; ctx.fillText(label, rect.x + rect.w / 2, rect.y + 38); }); ctx.textAlign = "left"; };
    const drawConfirmMenuScreen = () => { const w = window.innerWidth; const h = window.innerHeight; ctx.fillStyle = "rgba(0,0,0,0.62)"; ctx.fillRect(0, 0, w, h); ctx.textAlign = "center"; ctx.fillStyle = "white"; ctx.font = "bold 28px sans-serif"; ctx.fillText("Return to main menu?", w / 2, h * 0.38); ctx.font = "16px sans-serif"; ctx.fillText("Your current run will be lost.", w / 2, h * 0.43); const btnW = 180; const btnH = 54; const gap = 16; const y = h * 0.54; buttons.current.confirmMenuYes = { x: w / 2 - btnW - gap / 2, y, w: btnW, h: btnH }; buttons.current.confirmMenuNo = { x: w / 2 + gap / 2, y, w: btnW, h: btnH }; [["YES", buttons.current.confirmMenuYes], ["NO", buttons.current.confirmMenuNo]].forEach(([label, rect]) => { ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.strokeStyle = isKeyboardSelected(label === "YES" ? "confirmMenuYes" : "confirmMenuNo") ? "#5fa8ff" : "rgba(80,80,80,0.35)"; ctx.lineWidth = 4; roundedRect(rect.x, rect.y, rect.w, rect.h, 16); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#333"; ctx.font = "bold 26px sans-serif"; ctx.fillText(label, rect.x + rect.w / 2, rect.y + 35); }); ctx.textAlign = "left"; };
    const drawPauseOverlay = () => { if (!player.current.paused || player.current.dead) return; if (menuState.current === "leaderboard") { drawLeaderboardScreen(); return; } if (menuState.current === "settings") { drawSettingsScreen(); return; } if (menuState.current === "debugTools") { drawDebugToolsScreen(); return; } if (menuState.current === "confirmMenu") { drawConfirmMenuScreen(); return; } const w = window.innerWidth; const h = window.innerHeight; ctx.fillStyle = player.current.debugMode ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, w, h); if (!player.current.debugMode) { const panelW = Math.min(320, w - 42); const panelH = Math.min(420, h - 80); const panelX = w / 2 - panelW / 2; const panelY = h / 2 - panelH / 2; ctx.fillStyle = "rgba(255,255,255,0.16)"; roundedRect(panelX, panelY, panelW, panelH, 28); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.32)"; ctx.lineWidth = 3; ctx.stroke(); ctx.textAlign = "center"; ctx.fillStyle = "white"; ctx.strokeStyle = "rgba(120,185,255,0.65)"; ctx.lineWidth = 7; ctx.font = "bold 44px sans-serif"; ctx.strokeText("PAUSED", w / 2, panelY + 64); ctx.fillText("PAUSED", w / 2, panelY + 64); const buttonW = panelW - 58; const buttonH = 54; const buttonX = w / 2 - buttonW / 2; const gap = 14; const startY = panelY + 104; [["RESUME", startY, "play"], ["SETTINGS", startY + (buttonH + gap), "settings"], ["LEADERS", startY + (buttonH + gap) * 2, "pauseLeaderboard"], ["MAIN MENU", startY + (buttonH + gap) * 3, "pauseMenu"]].forEach(([label, y, key]) => { buttons.current[key] = { x: buttonX, y, w: buttonW, h: buttonH }; const isMainMenu = key === "pauseMenu"; ctx.fillStyle = isMainMenu ? "rgba(255,244,244,0.94)" : "rgba(255,255,255,0.94)"; ctx.strokeStyle = isKeyboardSelected(key) ? "#5fa8ff" : isMainMenu ? "rgba(255,90,90,0.35)" : "rgba(80,80,80,0.25)"; ctx.lineWidth = 4; roundedRect(buttonX, y, buttonW, buttonH, 18); ctx.fill(); ctx.stroke(); ctx.fillStyle = isMainMenu ? "#8a3333" : "#333"; ctx.font = `bold ${label.length > 8 ? 23 : 28}px sans-serif`; ctx.fillText(label, w / 2, y + 36); }); ctx.textAlign = "left"; } else { const acceptW = 180; const acceptH = 54; const acceptX = w / 2 - acceptW / 2; const acceptY = h - 110; buttons.current.accept = { x: acceptX, y: acceptY, w: acceptW, h: acceptH }; ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.strokeStyle = "#ffe600"; ctx.lineWidth = 4; roundedRect(acceptX, acceptY, acceptW, acceptH, 16); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#333"; ctx.textAlign = "center"; ctx.font = "bold 28px sans-serif"; ctx.fillText("ACCEPT", w / 2, acceptY + 36); ctx.font = "14px sans-serif"; ctx.fillText("Tap UI to select. Drag middle to move. Drag yellow handles to resize.", w / 2, 70); ctx.textAlign = "left"; } };
    const drawScoreEntry = () => { const w = window.innerWidth; const h = window.innerHeight; ctx.fillStyle = "rgba(0,0,0,0.68)"; ctx.fillRect(0, 0, w, h); ctx.textAlign = "center"; ctx.fillStyle = "white"; ctx.font = "bold 24px sans-serif"; ctx.fillText("ENTER YOUR INITIALS", w / 2, h * 0.32); buttons.current.initialUp = []; buttons.current.initialDown = []; const startX = w / 2 - 90; for (let i = 0; i < 3; i += 1) { const x = startX + i * 90; const y = h * 0.43; ctx.fillStyle = "rgba(255,255,255,0.92)"; roundedRect(x - 30, y - 40, 60, 90, 12); ctx.fill(); ctx.fillStyle = "#333"; ctx.font = "bold 44px monospace"; ctx.fillText(scoreEntry.current.initials[i], x, y + 12); ctx.font = "bold 20px sans-serif"; ctx.fillText("▲", x, y - 58); ctx.fillText("▼", x, y + 78); buttons.current.initialUp[i] = { x: x - 35, y: y - 85, w: 70, h: 38 }; buttons.current.initialDown[i] = { x: x - 35, y: y + 50, w: 70, h: 38 }; } const confirmW = 180; const confirmH = 54; const confirmX = w / 2 - confirmW / 2; const confirmY = h - 115; buttons.current.confirmScore = { x: confirmX, y: confirmY, w: confirmW, h: confirmH }; ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.strokeStyle = "rgba(80,80,80,0.35)"; ctx.lineWidth = 4; roundedRect(confirmX, confirmY, confirmW, confirmH, 16); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#333"; ctx.font = "bold 28px sans-serif"; ctx.fillText("SAVE", w / 2, confirmY + 36); ctx.textAlign = "left"; };
    const drawGameOver = () => { if (!player.current.dead || player.current.deathTimer < 0.7) return; const w = window.innerWidth; const h = window.innerHeight; if (scoreEntry.current.active) { drawScoreEntry(); return; } ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, w, h); ctx.textAlign = "center"; ctx.fillStyle = "#ff1f1f"; ctx.strokeStyle = "rgba(0,0,0,0.8)"; ctx.lineWidth = 8; ctx.font = "bold 58px sans-serif"; ctx.strokeText("GAME OVER", w / 2, h * 0.24); ctx.fillText("GAME OVER", w / 2, h * 0.24); ctx.fillStyle = "white"; ctx.font = "bold 20px sans-serif"; ctx.fillText(`Highest Level This Run: ${player.current.bestRunLevel}`, w / 2, h * 0.34); ctx.fillText(`Kills This Run: ${player.current.kills}`, w / 2, h * 0.39); ctx.fillText(`Best Kill Streak: ×${player.current.bestKillStreak}`, w / 2, h * 0.44); const btnW = 220; const btnH = 54; const btnX = w / 2 - btnW / 2; const saveY = h * 0.52; const menuY = h * 0.64; if (scoreEntry.current.askSave && !player.current.godModeUsed) { buttons.current.gameOverSave = { x: btnX, y: saveY, w: btnW, h: btnH }; ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.strokeStyle = "rgba(80,80,80,0.35)"; ctx.lineWidth = 4; roundedRect(btnX, saveY, btnW, btnH, 16); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#333"; ctx.font = "bold 24px sans-serif"; ctx.fillText("SAVE SCORE", w / 2, saveY + 35); } buttons.current.gameOverMenu = { x: btnX, y: menuY, w: btnW, h: btnH }; ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.strokeStyle = "rgba(80,80,80,0.35)"; ctx.lineWidth = 4; roundedRect(btnX, menuY, btnW, btnH, 16); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#333"; ctx.font = "bold 24px sans-serif"; ctx.fillText("MAIN MENU", w / 2, menuY + 35); ctx.textAlign = "left"; };

    const createMenuPoof = (x, y, scale = 1) => { for (let i = 0; i < 14; i += 1) { const angle = Math.random() * Math.PI * 2; const speed = 35 + Math.random() * 95; menuPuffs.current.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: (8 + Math.random() * 18) * scale, life: 1 }); } };
    const drawMiniBonBon = (x, y, scale, bob) => { ctx.save(); ctx.translate(x + Math.sin(bob) * 14, y); ctx.scale(scale, scale); drawCloudBlob(0, 0, 1, true); ctx.restore(); };
    const updateMenuPuffs = (dt) => { menuPuffs.current = menuPuffs.current.map((puff) => ({ ...puff, x: puff.x + puff.vx * dt, y: puff.y + puff.vy * dt, vx: puff.vx * 0.97, vy: puff.vy * 0.97, radius: puff.radius + dt * 12, life: puff.life - dt * 0.8 })).filter((puff) => puff.life > 0); };
    const drawMenuPuffs = () => { menuPuffs.current.forEach((puff) => { ctx.fillStyle = `rgba(235,248,255,${Math.max(0, puff.life)})`; ctx.beginPath(); ctx.arc(puff.x, puff.y, puff.radius, 0, Math.PI * 2); ctx.fill(); }); };
    const tryPoofMenuBonBon = (x, y) => { const index = menuBonBons.current.findIndex((bon) => Math.hypot(x - (bon.x + Math.sin(bon.bob) * 14), y - bon.y) < 48 * bon.size); if (index === -1) return false; const [bon] = menuBonBons.current.splice(index, 1); createMenuPoof(bon.x + Math.sin(bon.bob) * 14, bon.y, bon.size); return true; };
    const ensureMenuBonBons = () => { if (menuBonBons.current.length > 0) return; for (let i = 0; i < 14; i += 1) menuBonBons.current.push({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, speed: 10 + Math.random() * 22, size: 0.35 + Math.random() * 0.5, bob: Math.random() * Math.PI * 2 }); };
    const getMenuLayout = () => {
      const profile = deviceProfile.current;
      if (profile.isSmallScreen) return { titleSize: 62, subTitleSize: 40, titleY: 0.24, subTitleY: 0.22, buttonW: Math.min(245, window.innerWidth - 64), buttonH: 56, gap: 14, startY: 0.42, subStartY: 0.38, buttonFont: 24 };
      if (profile.isMobile || profile.isTablet) return { titleSize: 76, subTitleSize: 52, titleY: 0.23, subTitleY: 0.22, buttonW: Math.min(270, window.innerWidth - 70), buttonH: 58, gap: 16, startY: 0.42, subStartY: 0.38, buttonFont: 26 };
      return { titleSize: 92, subTitleSize: 64, titleY: 0.20, subTitleY: 0.20, buttonW: 320, buttonH: 62, gap: 18, startY: 0.40, subStartY: 0.36, buttonFont: 28 };
    };

    const drawMultiplayerMenu = () => { const w = window.innerWidth; const h = window.innerHeight; const layout = getMenuLayout(); ctx.fillStyle = "#ffd84d"; ctx.fillRect(0, 0, w, h); drawMenuPuffs(); ctx.textAlign = "center"; ctx.lineWidth = 8; ctx.strokeStyle = "rgba(120,185,255,0.6)"; ctx.fillStyle = "white"; ctx.font = `bold ${layout.subTitleSize}px sans-serif`; ctx.strokeText("MULTIPLAYER", w / 2, h * layout.subTitleY); ctx.fillText("MULTIPLAYER", w / 2, h * layout.subTitleY); const buttonW = layout.buttonW; const buttonH = layout.buttonH; const buttonX = w / 2 - buttonW / 2; const gap = layout.gap; const startY = h * layout.subStartY; [["CREATE CO-OP ROOM", startY, "createRoom"], ["JOIN CO-OP ROOM", startY + buttonH + gap, "joinRoom"], ["BACK", startY + (buttonH + gap) * 2, "back"]].forEach(([label, y, key]) => { buttons.current[key] = { x: buttonX, y, w: buttonW, h: buttonH }; ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.strokeStyle = isKeyboardSelected(key) ? "#5fa8ff" : "rgba(80,80,80,0.35)"; ctx.lineWidth = 4; roundedRect(buttonX, y, buttonW, buttonH, 16); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#333"; ctx.font = `bold ${label.length > 12 ? Math.max(20, layout.buttonFont - 4) : layout.buttonFont}px sans-serif`; ctx.fillText(label, w / 2, y + 37); }); ctx.textAlign = "left"; };
    const drawMultiplayerPlaceholder = () => { const w = window.innerWidth; const h = window.innerHeight; const layout = getMenuLayout(); const isCreate = menuState.current === "createRoom"; ctx.fillStyle = "#ffd84d"; ctx.fillRect(0, 0, w, h); drawMenuPuffs(); ctx.textAlign = "center"; ctx.lineWidth = 8; ctx.strokeStyle = "rgba(120,185,255,0.6)"; ctx.fillStyle = "white"; ctx.font = `bold ${layout.subTitleSize}px sans-serif`; const title = isCreate ? "CREATE ROOM" : "JOIN ROOM"; ctx.strokeText(title, w / 2, h * layout.subTitleY); ctx.fillText(title, w / 2, h * layout.subTitleY); ctx.fillStyle = "rgba(0,0,0,0.42)"; ctx.font = `bold ${deviceProfile.current.isSmallScreen ? 16 : 20}px sans-serif`; ctx.fillText("Coming soon", w / 2, h * 0.36); ctx.font = `${deviceProfile.current.isSmallScreen ? 12 : 15}px sans-serif`; ctx.fillText("No rooms, codes, or syncing yet.", w / 2, h * 0.41); const buttonW = Math.min(deviceProfile.current.isMobile ? 220 : 260, w - 70); const buttonH = layout.buttonH; const buttonX = w / 2 - buttonW / 2; const buttonY = h * (deviceProfile.current.isMobile ? 0.58 : 0.54); buttons.current.back = { x: buttonX, y: buttonY, w: buttonW, h: buttonH }; ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.strokeStyle = isKeyboardSelected("back") ? "#5fa8ff" : "rgba(80,80,80,0.35)"; ctx.lineWidth = 4; roundedRect(buttonX, buttonY, buttonW, buttonH, 16); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#333"; ctx.font = "bold 28px sans-serif"; ctx.fillText("BACK", w / 2, buttonY + 37); ctx.textAlign = "left"; };
    const drawMainMenu = (dt) => { if (menuState.current === "leaderboard") { drawLeaderboardScreen(); return; } if (menuState.current === "multiplayer") { drawMultiplayerMenu(); return; } if (menuState.current === "createRoom" || menuState.current === "joinRoom") { drawMultiplayerPlaceholder(); return; } ensureMenuBonBons(); updateMenuPuffs(dt); const w = window.innerWidth; const h = window.innerHeight; const layout = getMenuLayout(); ctx.fillStyle = "#ffd84d"; ctx.fillRect(0, 0, w, h); menuBonBons.current.forEach((bon) => { bon.y -= bon.speed * dt; bon.bob += dt * 2; if (bon.y < -120) { bon.y = h + 120; bon.x = Math.random() * w; } drawMiniBonBon(bon.x, bon.y, bon.size, bon.bob); }); drawMenuPuffs(); ctx.textAlign = "center"; ctx.lineWidth = 11; ctx.strokeStyle = "rgba(120,185,255,0.6)"; ctx.fillStyle = "white"; ctx.font = `bold ${layout.titleSize}px sans-serif`; ctx.strokeText("BON-BON", w / 2, h * layout.titleY); ctx.fillText("BON-BON", w / 2, h * layout.titleY); const buttonW = layout.buttonW; const buttonH = layout.buttonH; const buttonX = w / 2 - buttonW / 2; const gap = layout.gap; const startY = h * layout.startY; [["START SOLO", startY, "start"], ["MULTIPLAYER", startY + buttonH + gap, "multiplayer"], ["LEADERBOARD", startY + (buttonH + gap) * 2, "leaderboard"]].forEach(([label, y, key]) => { buttons.current[key] = { x: buttonX, y, w: buttonW, h: buttonH }; ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.strokeStyle = isKeyboardSelected(key) ? "#5fa8ff" : "rgba(80,80,80,0.35)"; ctx.lineWidth = 4; roundedRect(buttonX, y, buttonW, buttonH, 16); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#333"; ctx.font = `bold ${label.length > 10 ? Math.max(22, layout.buttonFont - 2) : layout.buttonFont}px sans-serif`; ctx.fillText(label, w / 2, y + 38); }); ctx.textAlign = "left"; };

    const getUiElementAt = (x, y) => { for (const name of ["transform", "bonBonSize", "killStreak", "pause", "xp", "hp", "energy"]) { const debugRect = getDebugRect(name); if (pointInside(x, y, debugRect)) return name; } return null; };
    const getResizeEdgeAt = (name, x, y) => { const handles = getHandleRects(getDebugRect(name)); for (const edge of ["left", "right", "top", "bottom"]) if (pointInside(x, y, handles[edge])) return edge; return null; };
    const isPointOnBonBon = (x, y) => Math.hypot(x - window.innerWidth / 2, y - window.innerHeight / 2) <= 80 * (player.current.scale || 0.7);
    const selectUiElement = (x, y) => { const chosen = getUiElementAt(x, y); selectedUi.current = chosen; if (!chosen) { editState.current = { active: false, mode: null, edge: null, startX: 0, startY: 0 }; return false; } const edge = getResizeEdgeAt(chosen, x, y); editState.current = { active: true, mode: edge ? "resize" : "move", edge, startX: x, startY: y }; return true; };
    const resizeUiFromEdge = (x, y) => { if (!player.current.debugMode || !selectedUi.current || !editState.current.active || editState.current.mode !== "resize") return; const item = uiLayout.current[selectedUi.current]; const dx = x - editState.current.startX; const dy = y - editState.current.startY; const minW = selectedUi.current === "pause" ? 28 : 70; const minH = selectedUi.current === "pause" ? 28 : 14; if (editState.current.edge === "right") item.w = Math.max(minW, item.w + dx); if (editState.current.edge === "left") { const oldW = item.w; item.w = Math.max(minW, item.w - dx); item.x += oldW - item.w; } if (editState.current.edge === "bottom") item.h = Math.max(minH, item.h + dy); if (editState.current.edge === "top") { const oldH = item.h; item.h = Math.max(minH, item.h - dy); item.y += oldH - item.h; } editState.current.startX = x; editState.current.startY = y; };
    const moveSelectedUi = (x, y) => { if (!player.current.debugMode || !selectedUi.current || !editState.current.active || editState.current.mode !== "move") return; const dx = x - editState.current.startX; const dy = y - editState.current.startY; const item = uiLayout.current[selectedUi.current]; item.x += dx; item.y += dy; editState.current.startX = x; editState.current.startY = y; };
    const updateLevelUpEffects = (dt) => { levelUpEffects.current = levelUpEffects.current.map((effect) => effect.particle ? { ...effect, x: effect.x + effect.vx * dt, y: effect.y + effect.vy * dt, vx: effect.vx * 0.92, vy: effect.vy * 0.92, radius: effect.radius + dt * 8, life: effect.life - dt } : { ...effect, radius: effect.radius + dt * 260, life: effect.life - dt }).filter((effect) => effect.life > 0); damageTexts.current = damageTexts.current.map((text) => ({ ...text, y: text.y + text.vy * dt, vy: text.vy * 0.94, life: text.life - dt })).filter((text) => text.life > 0); streakMessages.current = streakMessages.current.map((message) => ({ ...message, life: message.life - dt })).filter((message) => message.life > 0); stormMessages.current = stormMessages.current.map((message) => ({ ...message, life: message.life - dt })).filter((message) => message.life > 0); };
    const updateFrame = (dt) => { if (player.current.inMainMenu) return; if (!player.current.paused) { updateTransformation(dt); updatePlayer(dt); } if (!player.current.dead && !player.current.paused) { updateMudBalls(dt); updateWaterDrops(dt); updateEnergyOrbs(dt); updateCloudShots(dt); } if (!player.current.paused) { updateParticles(dt); updateLevelUpEffects(dt); } };
    const drawFrame = (dt) => { ctx.shadowBlur = 0; ctx.shadowColor = "transparent"; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); if (player.current.inMainMenu) { drawMainMenu(dt); return; } drawGrass(); drawMudBalls(); drawWaterDrops(); drawEnergyOrbs(); drawWindBursts(); drawCloudShots(); drawDeathPuffs(); drawLevelUpEffects(); drawBonBon(); drawHud(); drawKillStreakCounter(); drawBonBonSizeIndicator(); drawTransformButton(); if (!player.current.dead && !player.current.paused) drawJoystick(); drawPauseOverlay(); drawGameOver(); };
    const loop = (now) => { const dt = Math.min((now - lastTime) / 1000, 0.033); lastTime = now; updateFrame(dt); drawFrame(dt); animationFrame = requestAnimationFrame(loop); };

    const stopGodHold = () => { if (godHoldRef.current.timeout) window.clearTimeout(godHoldRef.current.timeout); if (godHoldRef.current.interval) window.clearInterval(godHoldRef.current.interval); godHoldRef.current = { type: null, timeout: null, interval: null }; };
    const increaseGodLevel = () => { player.current.level += 1; player.current.xp = 0; player.current.xpToNextLevel = getNextXpRequirement(player.current.level); applyTenLevelEscalation(); createLevelUpEffect(); };
    const increaseGodStreak = () => addKillStreak();
    const startGodHold = (type) => { stopGodHold(); godHoldRef.current.type = type; const action = type === "level" ? increaseGodLevel : increaseGodStreak; godHoldRef.current.timeout = window.setTimeout(() => { action(); godHoldRef.current.interval = window.setInterval(action, type === "level" ? 140 : 70); }, 360); };
    const updateTouch = (touch) => { const max = 56; const dx = touch.clientX - touchState.current.startX; const dy = touch.clientY - touchState.current.startY; const distance = Math.hypot(dx, dy); const scale = distance > max ? max / distance : 1; stickRef.current = { active: true, dx: dx * scale, dy: dy * scale }; forceRenderStick((value) => value + 1); };
    const getCurrentMenuKeyboardOptions = () => { if (player.current.inMainMenu) { if (menuState.current === "leaderboard") return ["back"]; if (menuState.current === "multiplayer") return ["createRoom", "joinRoom", "back"]; if (menuState.current === "createRoom" || menuState.current === "joinRoom") return ["back"]; return ["start", "multiplayer", "leaderboard"]; } if (player.current.paused && !player.current.debugMode) { if (menuState.current === "leaderboard") return ["back"]; if (menuState.current === "settings") return ["debugTools", "back"]; if (menuState.current === "debugTools") { const options = ["debug", "godmode"]; if (player.current.godMode) options.push("waterAimTest"); options.push("back"); return options; } if (menuState.current === "confirmMenu") return ["confirmMenuYes", "confirmMenuNo"]; return ["play", "settings", "pauseLeaderboard", "pauseMenu"]; } if (player.current.dead && player.current.deathTimer > 0.7 && !scoreEntry.current.active) { const options = []; if (scoreEntry.current.askSave && !player.current.godModeUsed) options.push("gameOverSave"); options.push("gameOverMenu"); return options; } return []; };
    const activateMenuOption = (key) => { const rect = buttons.current[key]; if (!rect) return false; return handlePress(rect.x + rect.w / 2, rect.y + rect.h / 2); };
    const handleMenuKeyboard = (key) => { const options = getCurrentMenuKeyboardOptions().filter((option) => buttons.current[option]); if (!options.length) return false; if (key === "ArrowUp" || key === "w" || key === "W") { menuKeyboard.current.index = (menuKeyboard.current.index - 1 + options.length) % options.length; return true; } if (key === "ArrowDown" || key === "s" || key === "S") { menuKeyboard.current.index = (menuKeyboard.current.index + 1) % options.length; return true; } if (key === "Enter" || key === " ") { const selected = options[menuKeyboard.current.index % options.length]; return activateMenuOption(selected); } return false; };
    const handlePress = (x, y) => {
      if (!player.current.inMainMenu && !player.current.paused && !player.current.dead && player.current.godMode && pointInside(x, y, resolveRect(uiLayout.current.xp))) { increaseGodLevel(); startGodHold("level"); return true; }
      if (!player.current.inMainMenu && !player.current.paused && !player.current.dead && player.current.godMode && pointInside(x, y, resolveRect(uiLayout.current.killStreak))) { increaseGodStreak(); startGodHold("streak"); return true; }
      if (!player.current.inMainMenu && !player.current.paused && !player.current.dead && player.current.level >= 5 && pointInside(x, y, buttons.current.transform)) { triggerTransformation(); return true; }
      if (player.current.paused && player.current.debugMode) { if (pointInside(x, y, buttons.current.accept)) { player.current.debugMode = false; player.current.paused = false; selectedUi.current = null; editState.current = { active: false, mode: null, edge: null, startX: 0, startY: 0 }; saveUiLayout(); return true; } return selectUiElement(x, y) || true; }
      if (player.current.paused) {
        if (menuState.current === "leaderboard") { if (pointInside(x, y, buttons.current.back)) menuState.current = "main"; return true; }
        if (menuState.current === "confirmMenu") { if (pointInside(x, y, buttons.current.confirmMenuYes)) { resetRun(true); return true; } if (pointInside(x, y, buttons.current.confirmMenuNo)) { menuState.current = "main"; return true; } return true; }
        if (menuState.current === "settings") { if (pointInside(x, y, buttons.current.back)) { menuState.current = "main"; return true; } if (pointInside(x, y, buttons.current.debugTools)) { menuKeyboard.current.index = 0; menuState.current = "debugTools"; return true; } return true; }
        if (menuState.current === "debugTools") { if (pointInside(x, y, buttons.current.back)) { menuState.current = "settings"; return true; } if (pointInside(x, y, buttons.current.debug)) { menuState.current = "main"; player.current.debugMode = true; return true; } if (pointInside(x, y, buttons.current.godmode)) { player.current.godMode = !player.current.godMode; if (player.current.godMode) player.current.godModeUsed = true; if (!player.current.godMode) player.current.waterDropAimTest = false; return true; } if (buttons.current.waterAimTest && pointInside(x, y, buttons.current.waterAimTest)) { if (player.current.godMode) player.current.waterDropAimTest = !player.current.waterDropAimTest; return true; } return true; }
        if (pointInside(x, y, buttons.current.play)) { menuState.current = "main"; player.current.paused = false; return true; }
        if (pointInside(x, y, buttons.current.pauseLeaderboard)) { menuKeyboard.current.index = 0; loadOnlineScores(); menuState.current = "leaderboard"; return true; }
        if (pointInside(x, y, buttons.current.settings)) { menuKeyboard.current.index = 0; menuState.current = "settings"; return true; }
        if (pointInside(x, y, buttons.current.pauseMenu)) { menuState.current = "confirmMenu"; return true; }
        return true;
      }
      if (!player.current.dead && !player.current.inMainMenu && pointInside(x, y, buttons.current.pause)) { player.current.paused = true; clearMovementInput(); forceRenderStick((value) => value + 1); return true; }
      if (player.current.inMainMenu) {
        if (menuState.current === "main" && tryPoofMenuBonBon(x, y)) return true;
        if (menuState.current === "leaderboard") { if (pointInside(x, y, buttons.current.back)) menuState.current = "main"; return true; }
        if (menuState.current === "multiplayer") { if (pointInside(x, y, buttons.current.back)) { menuKeyboard.current.index = 0; menuState.current = "main"; } if (pointInside(x, y, buttons.current.createRoom)) { menuKeyboard.current.index = 0; menuState.current = "createRoom"; } if (pointInside(x, y, buttons.current.joinRoom)) { menuKeyboard.current.index = 0; menuState.current = "joinRoom"; } return true; }
        if (menuState.current === "createRoom" || menuState.current === "joinRoom") { if (pointInside(x, y, buttons.current.back)) { menuKeyboard.current.index = 0; menuState.current = "multiplayer"; } return true; }
        if (pointInside(x, y, buttons.current.start)) { menuKeyboard.current.index = 0; resetRun(false); }
        if (pointInside(x, y, buttons.current.multiplayer)) { menuKeyboard.current.index = 0; menuState.current = "multiplayer"; }
        if (pointInside(x, y, buttons.current.leaderboard)) { menuKeyboard.current.index = 0; loadOnlineScores(); menuState.current = "leaderboard"; }
        return true;
      }
      if (player.current.dead && player.current.deathTimer > 0.7) { if (scoreEntry.current.active) { const upIndex = buttons.current.initialUp.findIndex((button) => pointInside(x, y, button)); if (upIndex >= 0) { const code = scoreEntry.current.initials[upIndex].charCodeAt(0); scoreEntry.current.initials[upIndex] = String.fromCharCode(code >= 90 ? 65 : code + 1); return true; } const downIndex = buttons.current.initialDown.findIndex((button) => pointInside(x, y, button)); if (downIndex >= 0) { const code = scoreEntry.current.initials[downIndex].charCodeAt(0); scoreEntry.current.initials[downIndex] = String.fromCharCode(code <= 65 ? 90 : code - 1); return true; } if (pointInside(x, y, buttons.current.confirmScore)) { saveLeaderboardEntry(); resetRun(true); return true; } return true; } if (scoreEntry.current.askSave && pointInside(x, y, buttons.current.gameOverSave)) { scoreEntry.current.active = true; scoreEntry.current.askSave = false; return true; } if (pointInside(x, y, buttons.current.gameOverMenu)) { resetRun(true); return true; } return true; }
      return false;
    };

    const onTouchStart = (e) => { if (player.current.debugMode) { if (e.touches.length >= 2 && !selectedUi.current) { const a = e.touches[0]; const b = e.touches[1]; const midX = (a.clientX + b.clientX) / 2; const midY = (a.clientY + b.clientY) / 2; if (isPointOnBonBon(midX, midY)) scaleEditState.current = { active: true, startDistance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), startScale: player.current.scale || 0.7 }; } else { const touch = e.changedTouches[0]; if (touch) handlePress(touch.clientX, touch.clientY); } e.preventDefault(); return; } const firstTouch = e.changedTouches[0]; if (firstTouch && handlePress(firstTouch.clientX, firstTouch.clientY)) { e.preventDefault(); return; } for (const touch of e.changedTouches) { const joystick = getJoystickBase(); const touchDistance = Math.hypot(touch.clientX - joystick.x, touch.clientY - joystick.y); if (touchDistance <= 56) { touchState.current = { active: true, id: touch.identifier, startX: joystick.x, startY: joystick.y }; updateTouch(touch); e.preventDefault(); break; } } };
    const onTouchMove = (e) => { if (player.current.debugMode) { if (scaleEditState.current.active && e.touches.length >= 2 && !selectedUi.current) { const a = e.touches[0]; const b = e.touches[1]; const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1; const ratio = distance / Math.max(1, scaleEditState.current.startDistance); player.current.scale = clamp(scaleEditState.current.startScale * ratio, 0.6, 1.2); } else { const touch = e.touches[0]; if (touch) { if (editState.current.mode === "resize") resizeUiFromEdge(touch.clientX, touch.clientY); if (editState.current.mode === "move") moveSelectedUi(touch.clientX, touch.clientY); } } e.preventDefault(); return; } for (const touch of e.changedTouches) if (touch.identifier === touchState.current.id) { updateTouch(touch); e.preventDefault(); break; } };
    const onTouchEnd = (e) => { stopGodHold(); if (player.current.debugMode) { editState.current = { active: false, mode: null, edge: null, startX: 0, startY: 0 }; scaleEditState.current = { active: false, startDistance: 0, startScale: player.current.scale || 0.7 }; e.preventDefault(); return; } for (const touch of e.changedTouches) if (touch.identifier === touchState.current.id) { touchState.current.active = false; touchState.current.id = null; stickRef.current = { active: false, dx: 0, dy: 0 }; forceRenderStick((value) => value + 1); break; } };
    const onMouseDown = (e) => handlePress(e.clientX, e.clientY);
    const onMouseMove = (e) => { if (!player.current.debugMode) return; if (editState.current.mode === "resize") resizeUiFromEdge(e.clientX, e.clientY); if (editState.current.mode === "move") moveSelectedUi(e.clientX, e.clientY); };
    const onMouseUp = () => { stopGodHold(); editState.current = { active: false, mode: null, edge: null, startX: 0, startY: 0 }; };
    const onKeyDown = (e) => { const menuIsActive = player.current.inMainMenu || player.current.paused || player.current.dead; if (!menuIsActive) keys.current[e.key] = true; if (e.key === "q" || e.key === "Q") { if (!player.current.inMainMenu && !player.current.paused && !player.current.dead && player.current.level >= 5) { triggerTransformation(); e.preventDefault(); return; } } if (e.key === "Escape" || e.key === "p" || e.key === "P") { if (!player.current.inMainMenu && !player.current.dead) { if (player.current.paused && menuState.current !== "main") menuState.current = "main"; else { player.current.paused = !player.current.paused; menuKeyboard.current.index = 0; clearMovementInput(); if (!player.current.paused) player.current.debugMode = false; } e.preventDefault(); return; } } if (isMenuKey(e.key)) { if (handleMenuKeyboard(e.key)) { e.preventDefault(); return; } } if (player.current.inMainMenu && (e.key === "Enter" || e.key === " ")) resetRun(false); if (player.current.dead && player.current.deathTimer > 0.7 && (e.key === "Enter" || e.key === " ")) resetRun(true); };
    const onKeyUp = (e) => { keys.current[e.key] = false; if (typeof e.key === "string") keys.current[e.key.toLowerCase()] = false; };
    const onBlur = () => clearMovementInput();
    const onVisibilityChange = () => { if (document.hidden) clearMovementInput(); };

    loadSavedUiLayout(); loadOnlineScores(); resizeCanvas();
    window.addEventListener("resize", resizeCanvas); window.addEventListener("mousedown", onMouseDown); window.addEventListener("mousemove", onMouseMove); window.addEventListener("mouseup", onMouseUp); window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp); window.addEventListener("blur", onBlur); document.addEventListener("visibilitychange", onVisibilityChange); window.addEventListener("touchstart", onTouchStart, { passive: false }); window.addEventListener("touchmove", onTouchMove, { passive: false }); window.addEventListener("touchend", onTouchEnd); window.addEventListener("touchcancel", onTouchEnd);
    animationFrame = requestAnimationFrame(loop);
    return () => { stopGodHold(); cancelAnimationFrame(animationFrame); window.removeEventListener("resize", resizeCanvas); window.removeEventListener("mousedown", onMouseDown); window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("blur", onBlur); document.removeEventListener("visibilitychange", onVisibilityChange); window.removeEventListener("touchstart", onTouchStart); window.removeEventListener("touchmove", onTouchMove); window.removeEventListener("touchend", onTouchEnd); window.removeEventListener("touchcancel", onTouchEnd); };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-green-500 touch-none select-none">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}