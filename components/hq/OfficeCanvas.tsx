"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { HQData } from "@/lib/ai/hqData";

// ─── CANVAS DIMENSIONS ───────────────────────────────────────────────────────
const CW   = 1200;   // canvas logical width
const CH   = 680;    // canvas logical height
const M    = 10;     // margin
const G    = 20;     // gap between rooms
const RW   = 380;    // room width  (1200 - 20 - 40) / 3
const RH   = 206;    // room height (680  - 20 - 40) / 3
const PS   = 3;      // pixel art scale (each art pixel = 3 canvas pixels)
const SPD  = 95;     // agent walk speed (canvas px / s)
const FPS  = 0.12;   // seconds per walk-frame

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface Vec2 { x: number; y: number }

interface RoomDef {
  id: string; name: string; shortName: string;
  col: number; row: number;
  bg: string; border: string;
  deskCount: number;
}

interface AgentDef {
  id: string; name: string;
  agentKey: string | null;   // matches HQAgent.name
  roomId: string;            // home room
  deskSlot: number;
  color: string;
  bodyColor: string;
}

interface SimState {
  pos: Vec2;
  path: Vec2[];
  state: "idle" | "walking" | "working" | "returning";
  frame: number;
  frameT: number;
  dir: "left" | "right";
  speech: string | null;
  speechT: number;
  workT: number;
  taskRoomId: string | null;
  idleT: number;   // countdown before next random task
}

interface BubbleData {
  id: string; x: number; y: number;
  text: string; color: string;
}

// ─── ROOMS ───────────────────────────────────────────────────────────────────
const ROOMS: RoomDef[] = [
  { id:"ceo",       name:"CEO War Room",       shortName:"CEO",       col:0,row:0, bg:"#100a02", border:"#c9a84c", deskCount:2 },
  { id:"booking",   name:"Booking Center",      shortName:"Booking",   col:1,row:0, bg:"#020a14", border:"#3b82f6", deskCount:3 },
  { id:"operations",name:"Operations HQ",       shortName:"Ops",       col:2,row:0, bg:"#08021a", border:"#8b5cf6", deskCount:3 },
  { id:"seo",       name:"SEO Laboratory",      shortName:"SEO",       col:0,row:1, bg:"#060014", border:"#a855f7", deskCount:2 },
  { id:"analytics", name:"Analytics Center",    shortName:"Analytics", col:1,row:1, bg:"#120900", border:"#f59e0b", deskCount:2 },
  { id:"support",   name:"Support Center",       shortName:"Support",   col:2,row:1, bg:"#021008", border:"#10b981", deskCount:3 },
  { id:"marketing", name:"Marketing & Growth",  shortName:"Marketing", col:0,row:2, bg:"#120004", border:"#ef4444", deskCount:2 },
  { id:"knowledge", name:"Knowledge Library",   shortName:"Knowledge", col:1,row:2, bg:"#0c0800", border:"#c9a84c", deskCount:2 },
  { id:"health",    name:"Health Monitor",      shortName:"Health",    col:2,row:2, bg:"#000e12", border:"#06b6d4", deskCount:2 },
];

// ─── AGENTS ──────────────────────────────────────────────────────────────────
const AGENT_DEFS: AgentDef[] = [
  { id:"ceo",       name:"AI CEO",          agentKey:"orchestrator", roomId:"ceo",        deskSlot:0, color:"#c9a84c", bodyColor:"#8b6914" },
  { id:"booking",   name:"Booking AI",       agentKey:"booking",      roomId:"booking",    deskSlot:0, color:"#3b82f6", bodyColor:"#1d4ed8" },
  { id:"ops",       name:"Ops Manager",      agentKey:null,           roomId:"operations", deskSlot:0, color:"#8b5cf6", bodyColor:"#5b21b6" },
  { id:"seo",       name:"SEO Specialist",   agentKey:"seo",          roomId:"seo",        deskSlot:0, color:"#a855f7", bodyColor:"#6d28d9" },
  { id:"analytics", name:"Analytics AI",     agentKey:"analytics",    roomId:"analytics",  deskSlot:0, color:"#f59e0b", bodyColor:"#92400e" },
  { id:"support",   name:"Support AI",       agentKey:"support",      roomId:"support",    deskSlot:0, color:"#10b981", bodyColor:"#065f46" },
  { id:"marketing", name:"Marketing AI",     agentKey:null,           roomId:"marketing",  deskSlot:0, color:"#ef4444", bodyColor:"#991b1b" },
  { id:"knowledge", name:"Knowledge AI",     agentKey:null,           roomId:"knowledge",  deskSlot:0, color:"#c9a84c", bodyColor:"#78350f" },
  { id:"health",    name:"Health Monitor",   agentKey:"health",       roomId:"health",     deskSlot:0, color:"#06b6d4", bodyColor:"#164e63" },
];

// ─── PIXEL ART CHARACTER FRAMES (8×12) ───────────────────────────────────────
const FRAMES: number[][][] = [
  // Frame 0: Standing
  [
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [0,1,0,1,1,0,1,0],
    [0,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1],
    [0,1,1,1,1,1,1,0],
    [0,1,1,0,0,1,1,0],
    [0,1,0,0,0,0,1,0],
    [0,1,0,0,0,0,1,0],
    [1,1,0,0,0,0,1,1],
  ],
  // Frame 1: Walk step A
  [
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [0,1,0,1,1,0,1,0],
    [0,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1],
    [0,1,1,1,1,1,1,0],
    [0,1,1,0,0,1,1,0],
    [1,1,0,0,0,0,1,0],
    [1,0,0,0,0,0,1,0],
    [0,0,0,0,0,0,1,1],
  ],
  // Frame 2: Standing (same as 0)
  [
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [0,1,0,1,1,0,1,0],
    [0,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1],
    [0,1,1,1,1,1,1,0],
    [0,1,1,0,0,1,1,0],
    [0,1,0,0,0,0,1,0],
    [0,1,0,0,0,0,1,0],
    [1,1,0,0,0,0,1,1],
  ],
  // Frame 3: Walk step B
  [
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [0,1,0,1,1,0,1,0],
    [0,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1],
    [0,1,1,1,1,1,1,0],
    [0,1,1,0,0,1,1,0],
    [0,1,0,0,0,0,1,1],
    [0,1,0,0,0,0,0,1],
    [1,1,0,0,0,0,0,0],
  ],
];

// Typing animation frame (seated at desk, leaning forward)
const WORK_FRAME: number[][] = [
  [0,0,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,0],
  [0,1,0,1,1,0,1,0],
  [0,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,0,0],
  [1,1,1,1,1,0,0,0],
  [0,1,1,0,0,0,0,0],
  [0,1,1,0,0,0,0,0],
  [0,0,1,0,0,0,0,0],
  [0,0,1,1,0,0,0,0],
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function roomRect(col: number, row: number) {
  return { x: M + col * (RW + G), y: M + row * (RH + G), w: RW, h: RH };
}

function getDeskPos(roomId: string, slot: number): Vec2 {
  const room = ROOMS.find(r => r.id === roomId);
  if (!room) return { x: CW / 2, y: CH / 2 };
  const r = roomRect(room.col, room.row);
  const desks: Vec2[] = [
    { x: r.x + r.w * 0.22, y: r.y + r.h * 0.58 },
    { x: r.x + r.w * 0.58, y: r.y + r.h * 0.58 },
    { x: r.x + r.w * 0.40, y: r.y + r.h * 0.76 },
  ];
  return desks[Math.min(slot, desks.length - 1)];
}

function getRoomCenter(roomId: string): Vec2 {
  const room = ROOMS.find(r => r.id === roomId);
  if (!room) return { x: CW / 2, y: CH / 2 };
  const r = roomRect(room.col, room.row);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

// Corridor waypoint Y/X centers
const HY = [M + RH + G / 2, M + 2 * RH + G + G / 2]; // y=226, y=452
const VX = [M + RW + G / 2, M + 2 * RW + G + G / 2]; // x=400, x=800

function computePath(fromRoomId: string, toRoomId: string, fromPos: Vec2, toPos: Vec2): Vec2[] {
  if (fromRoomId === toRoomId) return [toPos];
  const from = ROOMS.find(r => r.id === fromRoomId)!;
  const to   = ROOMS.find(r => r.id === toRoomId)!;
  const path: Vec2[] = [];

  if (from.col === to.col) {
    // Same column → vertical only
    const cy = from.row < to.row ? HY[from.row] : HY[to.row];
    path.push({ x: fromPos.x, y: cy });
    path.push({ x: toPos.x,   y: cy });
  } else if (from.row === to.row) {
    // Same row → horizontal only
    const cx = from.col < to.col ? VX[from.col] : VX[to.col];
    path.push({ x: cx, y: fromPos.y });
    path.push({ x: cx, y: toPos.y  });
  } else {
    // Both differ → go to h-corridor, cross, then v-corridor
    const cy = from.row < to.row ? HY[from.row] : HY[to.row];
    const cx = from.col < to.col ? VX[from.col] : VX[to.col];
    path.push({ x: fromPos.x, y: cy });
    path.push({ x: cx,        y: cy });
    path.push({ x: cx,        y: toPos.y });
  }
  path.push(toPos);
  return path;
}

function dist(a: Vec2, b: Vec2) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ─── CANVAS DRAWING ──────────────────────────────────────────────────────────
function hexToRgb(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawRoom(ctx: CanvasRenderingContext2D, room: RoomDef) {
  const r = roomRect(room.col, room.row);

  // Background
  ctx.fillStyle = room.bg;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  // Grid lines
  ctx.strokeStyle = hexToRgb(room.border, 0.07);
  ctx.lineWidth = 1;
  for (let gx = r.x + 16; gx < r.x + r.w; gx += 16) {
    ctx.beginPath(); ctx.moveTo(gx, r.y); ctx.lineTo(gx, r.y + r.h); ctx.stroke();
  }
  for (let gy = r.y + 16; gy < r.y + r.h; gy += 16) {
    ctx.beginPath(); ctx.moveTo(r.x, gy); ctx.lineTo(r.x + r.w, gy); ctx.stroke();
  }

  // Border
  ctx.strokeStyle = room.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);

  // Inner accent line
  ctx.strokeStyle = hexToRgb(room.border, 0.25);
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10);

  // Desks
  for (let i = 0; i < room.deskCount; i++) {
    drawDesk(ctx, getDeskPos(room.id, i), room.border);
  }
}

function drawDesk(ctx: CanvasRenderingContext2D, pos: Vec2, color: string) {
  const dw = 32, dh = 18;
  const x = pos.x - dw / 2, y = pos.y - dh / 2;

  // Desk surface
  ctx.fillStyle = "#1a1205";
  ctx.fillRect(x, y, dw, dh);

  // Desk front edge
  ctx.fillStyle = hexToRgb(color, 0.5);
  ctx.fillRect(x, y + dh - 3, dw, 3);

  // Monitor base
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(x + dw / 2 - 2, y - 3, 4, 3);

  // Monitor
  ctx.fillStyle = "#050505";
  ctx.fillRect(x + dw / 2 - 8, y - 13, 16, 10);
  ctx.fillStyle = hexToRgb(color, 0.5);
  ctx.fillRect(x + dw / 2 - 7, y - 12, 14, 8);

  // Keyboard
  ctx.fillStyle = "#111";
  ctx.fillRect(x + 4, y + 3, 14, 6);
  ctx.fillStyle = "#222";
  ctx.fillRect(x + 5, y + 4, 12, 4);
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  pos: Vec2,
  frame: number[][],
  color: string,
  bodyColor: string,
  dir: "left" | "right",
  glow: boolean,
) {
  const cw = 8 * PS;
  const ch = 12 * PS;
  const ox = pos.x - cw / 2;
  const oy = pos.y - ch;

  if (glow) {
    ctx.shadowColor  = color;
    ctx.shadowBlur   = 12;
  }

  ctx.save();
  if (dir === "left") {
    ctx.translate(ox + cw, oy);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(ox, oy);
  }

  frame.forEach((row, ry) => {
    row.forEach((px, rx) => {
      if (!px) return;
      const isHead = ry < 5;
      ctx.fillStyle = isHead ? color : bodyColor;
      ctx.fillRect(rx * PS, ry * PS, PS, PS);
    });
  });

  ctx.restore();
  ctx.shadowBlur = 0;
}

function drawCorridor(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#030303";
  ctx.fillRect(0, 0, CW, CH);

  // Subtle corridor grid
  ctx.strokeStyle = "rgba(255,255,255,0.025)";
  ctx.lineWidth = 1;
  for (let gx = 0; gx < CW; gx += 16) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, CH); ctx.stroke();
  }
  for (let gy = 0; gy < CH; gy += 16) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(CW, gy); ctx.stroke();
  }
}

// ─── VIRTUAL TASK POOLS ───────────────────────────────────────────────────────
const VIRTUAL_TASKS: Record<string, { text: string; targetRoom: string }[]> = {
  ceo:       [
    { text:"Reviewing KPI dashboard...",    targetRoom:"analytics" },
    { text:"Strategy session underway",      targetRoom:"ceo"       },
    { text:"Analyzing revenue forecasts",    targetRoom:"analytics" },
    { text:"Checking fleet performance",     targetRoom:"operations"},
    { text:"Reviewing agent metrics",        targetRoom:"ceo"       },
  ],
  booking:   [
    { text:"New airport transfer request",   targetRoom:"booking"   },
    { text:"Processing hotel pickup",        targetRoom:"booking"   },
    { text:"Verifying flight ETAs",          targetRoom:"booking"   },
    { text:"Confirming passenger count",     targetRoom:"booking"   },
    { text:"Coordinating driver assignment", targetRoom:"operations"},
  ],
  ops:       [
    { text:"Optimizing driver schedule",     targetRoom:"operations"},
    { text:"Reviewing workflow metrics",     targetRoom:"analytics" },
    { text:"Updating booking priorities",    targetRoom:"booking"   },
    { text:"Monitoring live transfers",      targetRoom:"operations"},
    { text:"Dispatching closest vehicle",    targetRoom:"operations"},
  ],
  seo:       [
    { text:"Scanning homepage metadata",     targetRoom:"seo"       },
    { text:"Analyzing competitor keywords",  targetRoom:"seo"       },
    { text:"Checking Core Web Vitals",       targetRoom:"health"    },
    { text:"Generating schema markup",       targetRoom:"knowledge" },
    { text:"Reviewing backlink profile",     targetRoom:"seo"       },
  ],
  analytics: [
    { text:"Processing booking data",        targetRoom:"analytics" },
    { text:"Generating revenue report",      targetRoom:"analytics" },
    { text:"Analyzing traffic patterns",     targetRoom:"analytics" },
    { text:"Forecasting peak demand",        targetRoom:"analytics" },
    { text:"Reporting to CEO suite",         targetRoom:"ceo"       },
  ],
  support:   [
    { text:"New customer inquiry detected",  targetRoom:"support"   },
    { text:"Answering pricing questions",    targetRoom:"support"   },
    { text:"Escalating complex booking",     targetRoom:"booking"   },
    { text:"Updating FAQ responses",         targetRoom:"knowledge" },
    { text:"Resolving service complaint",    targetRoom:"support"   },
  ],
  marketing: [
    { text:"Writing Barcelona transfer blog",targetRoom:"marketing" },
    { text:"Analyzing Facebook ad data",     targetRoom:"analytics" },
    { text:"Creating airport shuttle copy",  targetRoom:"marketing" },
    { text:"Researching competitor pricing", targetRoom:"marketing" },
    { text:"Planning summer campaign",       targetRoom:"marketing" },
  ],
  knowledge: [
    { text:"Indexing new vehicle data",      targetRoom:"knowledge" },
    { text:"Updating FAQ database",          targetRoom:"knowledge" },
    { text:"Adding driver onboarding docs",  targetRoom:"knowledge" },
    { text:"Syncing pricing information",    targetRoom:"booking"   },
    { text:"Improving AI search results",    targetRoom:"knowledge" },
  ],
  health:    [
    { text:"Running website health check",   targetRoom:"health"    },
    { text:"Checking payment gateway",       targetRoom:"health"    },
    { text:"Monitoring page load speed",     targetRoom:"health"    },
    { text:"Verifying booking form works",   targetRoom:"health"    },
    { text:"Scanning for broken links",      targetRoom:"seo"       },
  ],
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
interface Props {
  initialData: HQData;
}

export default function OfficeCanvas({ initialData }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const stateRef    = useRef<Record<string, SimState>>({});
  const hqRef       = useRef<HQData>(initialData);
  const rafRef      = useRef<number>(0);
  const simTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const [bubbles, setBubbles]   = useState<BubbleData[]>([]);
  const [metrics, setMetrics]   = useState(initialData.metrics);

  // ── Initialize agent states ──────────────────────────────────────────────
  useEffect(() => {
    AGENT_DEFS.forEach(def => {
      const homePos = getDeskPos(def.roomId, def.deskSlot);
      stateRef.current[def.id] = {
        pos:      { ...homePos },
        path:     [],
        state:    "idle",
        frame:    0,
        frameT:   0,
        dir:      "right",
        speech:   null,
        speechT:  0,
        workT:    0,
        taskRoomId: null,
        idleT:    Math.random() * 6 + 2,
      };
    });
  }, []);

  // ── Poll HQ data every 15s ────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const r = await fetch("/api/ai/hq");
        if (r.ok) {
          const d: HQData = await r.json();
          hqRef.current = d;
          setMetrics(d.metrics);
          // Trigger real-agent speech from logs
          d.agents.forEach(a => {
            if (a.status !== "RUNNING") return;
            const def = AGENT_DEFS.find(d => d.agentKey === a.name);
            if (!def) return;
            const s = stateRef.current[def.id];
            if (!s || s.state !== "idle") return;
            const logs = d.recentLogs.filter(l => l.agent?.name === a.name);
            if (!logs.length) return;
            const msg = logs[0].message.slice(0, 55);
            assignTask(def, msg, def.roomId);
          });
        }
      } catch {}
    }, 15_000);
    return () => clearInterval(iv);
  }, []);

  // ── Assign task to agent ─────────────────────────────────────────────────
  const assignTask = useCallback((def: AgentDef, text: string, targetRoomId: string) => {
    const s = stateRef.current[def.id];
    if (!s || s.state !== "idle") return;
    const toPos = getDeskPos(targetRoomId, Math.floor(Math.random() * ROOMS.find(r => r.id === targetRoomId)!.deskCount));
    s.path      = computePath(def.roomId, targetRoomId, s.pos, toPos);
    s.state     = "walking";
    s.speech    = text;
    s.speechT   = 14;
    s.taskRoomId = targetRoomId;
    s.workT     = 8 + Math.random() * 10;
  }, []);

  // ── Simulation tick: randomly activate idle agents ────────────────────────
  useEffect(() => {
    function tick() {
      const eligible = AGENT_DEFS.filter(def => stateRef.current[def.id]?.state === "idle");
      if (!eligible.length) return;
      const def = eligible[Math.floor(Math.random() * eligible.length)];
      const pool = VIRTUAL_TASKS[def.id] ?? VIRTUAL_TASKS["ops"];
      const task = pool[Math.floor(Math.random() * pool.length)];
      assignTask(def, task.text, task.targetRoom);
    }
    simTimerRef.current = setInterval(tick, 3500 + Math.random() * 3000);
    tick(); // fire immediately
    return () => clearInterval(simTimerRef.current);
  }, [assignTask]);

  // ── Canvas animation loop ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) return;

    let lastT = performance.now();

    function animate(now: number) {
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;

      // ── Update agents ──────────────────────────────────────────────────
      const nextBubbles: BubbleData[] = [];

      AGENT_DEFS.forEach(def => {
        const s = stateRef.current[def.id];
        if (!s) return;

        // Speech timer
        if (s.speechT > 0) {
          s.speechT -= dt;
          if (s.speechT <= 0) s.speech = null;
        }

        // Work timer
        if (s.state === "working") {
          s.workT -= dt;
          // Typing animation
          s.frameT += dt;
          if (s.frameT > 0.25) { s.frame = (s.frame + 1) % 2; s.frameT = 0; }
          if (s.workT <= 0) {
            // Return home
            const homePos = getDeskPos(def.roomId, def.deskSlot);
            s.path = computePath(s.taskRoomId ?? def.roomId, def.roomId, s.pos, homePos);
            s.state = "returning";
            s.taskRoomId = null;
          }
        }

        // Idle timer
        if (s.state === "idle") {
          s.frame = 0;
        }

        // Walking
        if (s.state === "walking" || s.state === "returning") {
          if (s.path.length === 0) {
            s.state = s.state === "walking" ? "working" : "idle";
            s.idleT = 4 + Math.random() * 8;
          } else {
            const target = s.path[0];
            const d = dist(s.pos, target);
            const step = SPD * dt;

            if (d <= step) {
              s.pos = { ...target };
              s.path = s.path.slice(1);
            } else {
              const ratio = step / d;
              const dx = (target.x - s.pos.x) * ratio;
              const dy = (target.y - s.pos.y) * ratio;
              s.pos.x += dx;
              s.pos.y += dy;
              s.dir = dx > 0 ? "right" : dx < 0 ? "left" : s.dir;
            }

            // Walk animation
            s.frameT += dt;
            if (s.frameT > FPS) {
              s.frame = (s.frame + 1) % 4;
              s.frameT = 0;
            }
          }
        }

        // Collect speech bubbles
        if (s.speech) {
          nextBubbles.push({ id: def.id, x: s.pos.x, y: s.pos.y - 12 * PS - 2, text: s.speech, color: def.color });
        }
      });

      // Update React state for speech bubbles (only if changed)
      setBubbles(prev => {
        const changed = prev.length !== nextBubbles.length ||
          prev.some((b, i) => b.id !== nextBubbles[i]?.id || b.text !== nextBubbles[i]?.text);
        return changed ? nextBubbles : prev;
      });

      // ── Draw ────────────────────────────────────────────────────────────
      drawCorridor(ctx);
      ROOMS.forEach(room => drawRoom(ctx, room));

      // Draw agents (workers first, walking on top)
      const idle    = AGENT_DEFS.filter(d => stateRef.current[d.id]?.state === "idle"    || stateRef.current[d.id]?.state === "working");
      const walking = AGENT_DEFS.filter(d => stateRef.current[d.id]?.state === "walking" || stateRef.current[d.id]?.state === "returning");

      [...idle, ...walking].forEach(def => {
        const s = stateRef.current[def.id];
        if (!s) return;
        const frame = s.state === "working" ? (s.frame % 2 === 0 ? WORK_FRAME : FRAMES[0]) : FRAMES[s.frame % 4];
        drawCharacter(ctx, s.pos, frame, def.color, def.bodyColor, s.dir, s.state === "working");
      });

      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", background: "#030303", fontFamily: "monospace" }}>
      <style>{`
        .hq-bubble {
          position: absolute;
          transform: translateX(-50%) translateY(-100%);
          background: rgba(0,0,0,0.92);
          border: 1px solid;
          padding: 4px 8px;
          font-family: monospace;
          font-size: 10px;
          white-space: nowrap;
          pointer-events: none;
          line-height: 1.3;
          max-width: 200px;
          white-space: normal;
          text-align: center;
          z-index: 10;
        }
        .hq-bubble::after {
          content: '';
          position: absolute;
          bottom: -5px;
          left: 50%;
          transform: translateX(-50%);
          border: 5px solid transparent;
          border-top-color: inherit;
          border-bottom: none;
        }
        .hq-room-label {
          position: absolute;
          transform: translateX(-50%);
          pointer-events: none;
          z-index: 5;
        }
        .hq-stats-bar {
          display: flex;
          gap: 16px;
          padding: 8px 16px;
          background: rgba(0,0,0,0.7);
          border-top: 1px solid rgba(255,255,255,0.06);
          font-family: monospace;
          font-size: 10px;
          color: rgba(255,255,255,0.4);
          overflow-x: auto;
        }
        .hq-stats-bar .stat { display: flex; flex-direction: column; gap: 2px; min-width: max-content; }
        .hq-stats-bar .val  { color: #c9a84c; font-size: 13px; font-weight: bold; }
        .hq-legend {
          display: flex; flex-wrap: wrap; gap: 10px;
          padding: 8px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          font-size: 10px;
          font-family: monospace;
        }
        .hq-legend .dot {
          width: 8px; height: 8px; border-radius: 50%;
          display: inline-block; margin-right: 4px; vertical-align: middle;
          flex-shrink: 0;
        }
        @keyframes hqScanline {
          0%   { background-position: 0 0; }
          100% { background-position: 0 4px; }
        }
        .hq-scanline {
          position: absolute; inset: 0; pointer-events: none;
          background: repeating-linear-gradient(0deg,rgba(0,0,0,0.04),rgba(0,0,0,0.04) 1px,transparent 1px,transparent 4px);
          animation: hqScanline 0.15s linear infinite;
          z-index: 20;
        }
        @keyframes hqBlink {
          0%,100% { opacity: 1; } 50% { opacity: 0.4; }
        }
        .hq-live { animation: hqBlink 1.5s ease-in-out infinite; color: #10b981; }
      `}</style>

      {/* Top bar */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 16px", borderBottom:"1px solid rgba(201,168,76,0.15)", background:"rgba(0,0,0,0.8)", backdropFilter:"blur(8px)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:8, height:8, background:"#c9a84c", transform:"rotate(45deg)" }} />
          <span style={{ color:"#c9a84c", fontSize:11, letterSpacing:"0.3em", textTransform:"uppercase" }}>
            ÉLITE BCN AI HEADQUARTERS
          </span>
          <span className="hq-live" style={{ fontSize:10, marginLeft:4 }}>● LIVE</span>
        </div>
        <div style={{ display:"flex", gap:16, fontSize:10, color:"rgba(255,255,255,0.4)" }}>
          <span>{metrics.agentCount} agents</span>
          <span style={{ color: metrics.agentsRunning > 0 ? "#10b981" : "rgba(255,255,255,0.3)" }}>
            {metrics.agentsRunning} running
          </span>
          {metrics.agentsError > 0 && <span style={{ color:"#ef4444" }}>{metrics.agentsError} errors</span>}
          <span>Budget {metrics.budgetPct}%</span>
        </div>
      </div>

      {/* Agent legend */}
      <div className="hq-legend">
        {AGENT_DEFS.map(def => (
          <span key={def.id} style={{ display:"flex", alignItems:"center", color:"rgba(255,255,255,0.5)" }}>
            <span className="dot" style={{ background: def.color }} />
            {def.name}
          </span>
        ))}
      </div>

      {/* Canvas container */}
      <div style={{ position:"relative", width:"100%" }}>
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          style={{ width:"100%", height:"auto", display:"block", imageRendering:"pixelated" }}
        />

        {/* Scanline overlay */}
        <div className="hq-scanline" />

        {/* Room labels (HTML for crispness) */}
        {ROOMS.map(room => {
          const r = roomRect(room.col, room.row);
          const leftPct  = ((r.x + r.w / 2) / CW) * 100;
          const topPct   = ((r.y + 12) / CH) * 100;
          return (
            <div
              key={room.id}
              className="hq-room-label"
              style={{ left:`${leftPct}%`, top:`${topPct}%`, color: room.border, fontSize:9, letterSpacing:"0.25em", textTransform:"uppercase", textShadow:`0 0 8px ${room.border}` }}
            >
              {room.shortName}
            </div>
          );
        })}

        {/* Speech bubbles */}
        {bubbles.map(b => (
          <div
            key={b.id}
            className="hq-bubble"
            style={{
              left:        `${(b.x / CW) * 100}%`,
              top:         `${(b.y / CH) * 100}%`,
              borderColor: b.color,
              color:       "#fff",
              textShadow:  "none",
            }}
          >
            {b.text}
          </div>
        ))}
      </div>

      {/* Stats bar */}
      <div className="hq-stats-bar">
        {[
          { label:"Bookings Today",  val: metrics.bookingsToday },
          { label:"Revenue Today",   val: `€${metrics.revenueToday.toFixed(0)}` },
          { label:"Tasks Today",     val: metrics.totalToday },
          { label:"Success Rate",    val: `${metrics.avgSuccess}%` },
          { label:"AI Chats (7d)",   val: metrics.conversations7d },
          { label:"Knowledge Base",  val: `${metrics.kbCount} docs` },
          { label:"Alerts",          val: metrics.alertCount },
          { label:"Budget Used",     val: `€${(metrics.spentCents/100).toFixed(2)}` },
        ].map(s => (
          <div key={s.label} className="stat">
            <span className="val">{s.val}</span>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
