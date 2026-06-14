"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { HQData } from "@/lib/ai/hqData";

// ═══════════════════════════════════════════════════════════════
// CANVAS CONFIG — resize the office by editing CW / CH / RW / RH
// ═══════════════════════════════════════════════════════════════
const CW   = 1200; // canvas logical width
const CH   = 968;  // canvas logical height — 4 rows × 221 + 3 gaps × 28
const RW   = 380;  // room width
const RH   = 221;  // room height
const HGAP = 30;   // hallway width between columns
const VGAP = 28;   // hallway height between rows
const WTH  = 9;    // wall thickness
const DOOR = 30;   // door opening size
const PS   = 3;    // pixel-art scale (1 art pixel = PS canvas px)
const SPD  = 86;   // agent walk speed (canvas px / s)
const FT   = 0.13; // seconds per walk frame

// room top-left from grid position
function rx(col: number) { return col * (RW + HGAP); }
function ry(row: number) { return row * (RH + VGAP); }

// ═══════════════════════════════════════════════════════════════
// ROOM CONFIG — edit accent colors and names here
// ═══════════════════════════════════════════════════════════════
interface RoomCfg {
  id: string; name: string; shortName: string;
  col: 0|1|2; row: 0|1|2|3;
  accent: string;   // neon glow color
  bg:     string;   // floor base (very dark)
  type:   "ceo"|"booking"|"ops"|"seo"|"analytics"|"support"|"marketing"|"knowledge"|"health"|"meeting"|"cafe";
}
const ROOMS: RoomCfg[] = [
  { id:"ceo",       name:"CEO War Room",       shortName:"CEO",       col:0,row:0, accent:"#c9a84c", bg:"#0e0800", type:"ceo"       },
  { id:"booking",   name:"Booking Center",      shortName:"Booking",   col:1,row:0, accent:"#3b82f6", bg:"#010810", type:"booking"   },
  { id:"operations",name:"Operations HQ",       shortName:"Ops",       col:2,row:0, accent:"#8b5cf6", bg:"#060014", type:"ops"       },
  { id:"seo",       name:"SEO Laboratory",      shortName:"SEO",       col:0,row:1, accent:"#a855f7", bg:"#04000f", type:"seo"       },
  { id:"analytics", name:"Analytics Center",    shortName:"Analytics", col:1,row:1, accent:"#f59e0b", bg:"#0d0600", type:"analytics" },
  { id:"support",   name:"Support Center",       shortName:"Support",   col:2,row:1, accent:"#10b981", bg:"#010d06", type:"support"   },
  { id:"marketing", name:"Marketing & Growth",  shortName:"Marketing", col:0,row:2, accent:"#ef4444", bg:"#0e0000", type:"marketing" },
  { id:"knowledge", name:"Knowledge Library",   shortName:"Knowledge", col:1,row:2, accent:"#c9a84c", bg:"#0d0800", type:"knowledge" },
  { id:"health",    name:"Health Monitor",      shortName:"Health",    col:2,row:2, accent:"#06b6d4", bg:"#000c10", type:"health"    },
  { id:"meeting",   name:"Meeting Room",        shortName:"Meeting",   col:0,row:3, accent:"#94a3b8", bg:"#06080a", type:"meeting"   },
  { id:"cafe",      name:"Café / Bar",          shortName:"Café",      col:1,row:3, accent:"#f97316", bg:"#0e0600", type:"cafe"      },
];

// ═══════════════════════════════════════════════════════════════
// AGENT CONFIG — edit names, phrases, colors here
// ═══════════════════════════════════════════════════════════════
interface AgentCfg {
  id: string; name: string; agentKey: string|null; roomId: string;
  hc: string; bc: string; // head color, body color
  phrases: string[];
}
const AGENTS: AgentCfg[] = [
  { id:"a-ceo", name:"AI CEO",         agentKey:"orchestrator", roomId:"ceo",        hc:"#c9a84c", bc:"#5a3800", phrases:["Reviewing KPIs","Board meeting","Revenue check","Approving plan","Strategy session"] },
  { id:"a-bk",  name:"Booking AI",      agentKey:"booking",      roomId:"booking",    hc:"#60a5fa", bc:"#1d3a5f", phrases:["Airport pickup","Hotel transfer","Confirming flight","Driver assigned","Route optimized"] },
  { id:"a-ops", name:"Ops Manager",     agentKey:null,           roomId:"operations", hc:"#a78bfa", bc:"#2e1065", phrases:["Fleet OK","Routing transfer","Schedule updated","Dispatch done","Workflow running"] },
  { id:"a-seo", name:"SEO Specialist",  agentKey:"seo",          roomId:"seo",        hc:"#c084fc", bc:"#3b0764", phrases:["Scanning meta","Keyword found","Core Vitals 98","Backlinks +3","Schema ready"] },
  { id:"a-ana", name:"Analytics AI",    agentKey:"analytics",    roomId:"analytics",  hc:"#fbbf24", bc:"#451a03", phrases:["Traffic +12%","Conversion up","Report ready","Funnel analysis","Dashboard live"] },
  { id:"a-sup", name:"Support AI",      agentKey:"support",      roomId:"support",    hc:"#34d399", bc:"#064e3b", phrases:["Chat resolved","New inquiry","FAQ sent","Escalating","CSAT 98%"] },
  { id:"a-mkt", name:"Marketing AI",    agentKey:null,           roomId:"marketing",  hc:"#f87171", bc:"#450a0a", phrases:["Blog drafted","Campaign live","Ad optimized","Content ready","Reach +18%"] },
  { id:"a-kb",  name:"Knowledge AI",    agentKey:null,           roomId:"knowledge",  hc:"#fcd34d", bc:"#451a03", phrases:["FAQ updated","Entry indexed","Search improved","Doc added","KB synced"] },
  { id:"a-hlt", name:"Health Monitor",  agentKey:"health",       roomId:"health",     hc:"#22d3ee", bc:"#0c4a6e", phrases:["Site OK","Page speed 94","Gateway OK","SSL valid","No errors"] },
];

// ═══════════════════════════════════════════════════════════════
// PIXEL-ART CHARACTER SPRITES — 8×12 art pixels, 4 walk frames
// ═══════════════════════════════════════════════════════════════
type Frame = number[][];
const W0: Frame = [
  [0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0],[0,1,0,1,1,0,1,0],[0,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,0],
  [0,1,1,0,0,1,1,0],[0,1,0,0,0,0,1,0],[0,1,0,0,0,0,1,0],[1,1,0,0,0,0,1,1],
];
const W1: Frame = [
  [0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0],[0,1,0,1,1,0,1,0],[0,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,0],
  [0,1,1,0,0,1,1,0],[1,1,0,0,0,0,1,0],[1,0,0,0,0,0,1,0],[0,0,0,0,0,0,1,1],
];
const W3: Frame = [
  [0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0],[0,1,0,1,1,0,1,0],[0,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,0],
  [0,1,1,0,0,1,1,0],[0,1,0,0,0,0,1,1],[0,1,0,0,0,0,0,1],[1,1,0,0,0,0,0,0],
];
const WK: Frame = [
  [0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0],[0,1,0,1,1,0,1,0],[0,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,0,0],[0,0,1,1,1,1,0,0],[0,1,1,1,1,0,0,0],[1,1,1,1,0,0,0,0],
  [0,1,1,0,0,0,0,0],[0,1,0,0,0,0,0,0],[0,1,0,0,0,0,0,0],[1,1,0,0,0,0,0,0],
];
const WALK_FRAMES = [W0, W1, W0, W3];

// ═══════════════════════════════════════════════════════════════
// SIMULATION TYPES
// ═══════════════════════════════════════════════════════════════
interface V2 { x: number; y: number }
type AgentState = "working"|"idle"|"walking"|"returning"|"visiting";

interface Sim {
  pos:      V2;
  path:     V2[];
  state:    AgentState;
  frame:    number;
  frameT:   number;
  dir:      "left"|"right";
  speech:   string|null;
  speechT:  number;
  workT:    number;
  idleT:    number;
  visitRoom: string|null;
}

interface Particle {
  path:     V2[];
  t:        number;   // 0–1 progress along full path
  speed:    number;   // 0–1 units per second
  color:    string;
  size:     number;
}

interface Bubble { id: string; x: number; y: number; text: string; color: string }

// ═══════════════════════════════════════════════════════════════
// GEOMETRY HELPERS
// ═══════════════════════════════════════════════════════════════
const HCORR_Y = [RH, RH + VGAP];          // y-start of h-corridors (not the gap center)
const VCORR_X = [RW, RW + HGAP];          // x-start of v-corridors

function roomCenter(roomId: string): V2 {
  const r = ROOMS.find(r => r.id === roomId)!;
  return { x: rx(r.col) + RW / 2, y: ry(r.row) + RH / 2 };
}

function deskPos(roomId: string): V2 {
  const r = ROOMS.find(r => r.id === roomId)!;
  return { x: rx(r.col) + RW * 0.42, y: ry(r.row) + RH * 0.62 };
}

function idleSpot(roomId: string, idx: number): V2 {
  const r = ROOMS.find(r => r.id === roomId)!;
  const bx = rx(r.col), by = ry(r.row);
  const spots: V2[] = [
    { x: bx + RW * 0.25, y: by + RH * 0.40 },
    { x: bx + RW * 0.70, y: by + RH * 0.35 },
    { x: bx + RW * 0.55, y: by + RH * 0.72 },
  ];
  return spots[idx % spots.length];
}

// Exit point of a room toward a neighbor room
function exitPoint(fromRoom: RoomCfg, toRoom: RoomCfg): V2 {
  if (fromRoom.col !== toRoom.col) {
    const ex = fromRoom.col < toRoom.col ? rx(fromRoom.col) + RW - 1 : rx(fromRoom.col) + 1;
    return { x: ex, y: ry(fromRoom.row) + RH / 2 };
  }
  const ey = fromRoom.row < toRoom.row ? ry(fromRoom.row) + RH - 1 : ry(fromRoom.row) + 1;
  return { x: rx(fromRoom.col) + RW / 2, y: ey };
}

function computePath(fromId: string, toId: string, fromPos: V2, toPos: V2): V2[] {
  if (fromId === toId) return [toPos];
  const fr = ROOMS.find(r => r.id === fromId)!;
  const to = ROOMS.find(r => r.id === toId)!;
  const midH = [RH + VGAP / 2, (RH + VGAP) + RH + VGAP / 2, 2*(RH + VGAP) + RH + VGAP / 2]; // h-corridor center y per row pair
  const midV = [RW + HGAP / 2, RW + HGAP + RW + HGAP / 2]; // v-corridor center x
  const pts: V2[] = [];

  if (fr.col === to.col) {
    const cy = fr.row < to.row ? midH[fr.row] : midH[to.row];
    pts.push({ x: fromPos.x, y: cy });
  } else if (fr.row === to.row) {
    const cx = fr.col < to.col ? midV[fr.col] : midV[to.col];
    pts.push({ x: cx, y: fromPos.y });
    pts.push({ x: cx, y: toPos.y });
  } else {
    const cy = fr.row < to.row ? midH[fr.row] : midH[to.row];
    const cx = fr.col < to.col ? midV[fr.col] : midV[to.col];
    pts.push({ x: fromPos.x, y: cy });
    pts.push({ x: cx, y: cy });
    pts.push({ x: cx, y: toPos.y });
  }
  pts.push(toPos);
  return pts;
}

function vdist(a: V2, b: V2) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }

// Particle paths for data-flow animations
const PARTICLE_ROUTES: { path: V2[]; color: string; speed: number; size: number }[] = [
  // Booking → CEO (gold)
  { path:[{x:600,y:110},{x:395,y:110},{x:190,y:110}], color:"#c9a84c", speed:0.22, size:3 },
  // Support → Knowledge (green)
  { path:[{x:1010,y:360},{x:805,y:360},{x:805,y:484},{x:600,y:609}], color:"#10b981", speed:0.18, size:3 },
  // SEO → Analytics (violet)
  { path:[{x:190,y:360},{x:395,y:360},{x:600,y:360}], color:"#a855f7", speed:0.20, size:2 },
  // Analytics → CEO (amber)
  { path:[{x:600,y:235},{x:395,y:235},{x:190,y:235},{x:190,y:110}], color:"#f59e0b", speed:0.17, size:2 },
  // Health → Operations (cyan)
  { path:[{x:1010,y:609},{x:1010,y:484},{x:1010,y:360},{x:1010,y:110}], color:"#06b6d4", speed:0.25, size:2 },
  // Marketing → Booking (red)
  { path:[{x:190,y:609},{x:395,y:609},{x:395,y:484},{x:395,y:235},{x:600,y:235},{x:600,y:110}], color:"#ef4444", speed:0.15, size:2 },
  // All agents → Meeting Room (slate — standup data flow)
  { path:[{x:600,y:609},{x:395,y:609},{x:395,y:733},{x:190,y:858}], color:"#94a3b8", speed:0.14, size:2 },
  // Café → Knowledge (warm orange — insights from breaks)
  { path:[{x:600,y:858},{x:600,y:733},{x:600,y:609}], color:"#f97316", speed:0.12, size:2 },
];

// ═══════════════════════════════════════════════════════════════
// CANVAS DRAW HELPERS
// ═══════════════════════════════════════════════════════════════
function hexAlpha(hex: string, a: number): string {
  const byte = Math.round(a * 255).toString(16).padStart(2, "0");
  return hex.length === 7 ? hex + byte : hex;
}

function glowRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, blur = 8) {
  ctx.shadowColor = color;
  ctx.shadowBlur  = blur;
  ctx.fillRect(x, y, w, h);
  ctx.shadowBlur  = 0;
}

function drawMonitor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent: string, t: number, content?: string) {
  ctx.fillStyle = "#060606"; ctx.fillRect(x - 2, y + h, w + 4, 3);  // stand base
  ctx.fillStyle = "#111111"; ctx.fillRect(x + w/2 - 1, y + h - 2, 3, 3); // stand
  ctx.fillStyle = "#0a0a0a"; ctx.fillRect(x, y, w, h);               // bezel
  const glow = 0.25 + Math.sin(t * 1.3) * 0.04;
  ctx.fillStyle = hexAlpha(accent, glow); ctx.fillRect(x + 1, y + 1, w - 2, h - 2); // screen glow
  if (content) {
    ctx.fillStyle = hexAlpha(accent, 0.7);
    ctx.font = "5px monospace";
    ctx.fillText(content, x + 2, y + 8);
  }
}

function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent: string) {
  ctx.fillStyle = "#1a1005"; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = hexAlpha(accent, 0.45); ctx.fillRect(x, y + h - 2, w, 2);
  // drawer handles
  ctx.fillStyle = hexAlpha(accent, 0.6);
  ctx.fillRect(x + 4, y + h/2 - 1, 8, 3);
  ctx.fillRect(x + w - 13, y + h/2 - 1, 8, 3);
}

function drawBookshelf(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, accent: string) {
  ctx.fillStyle = "#120c02"; ctx.fillRect(x, y, 18, h);
  const bc = ["#c9a84c","#3b82f6","#ef4444","#10b981","#a855f7","#f59e0b","#8b5cf6","#06b6d4","#c9a84c","#ef4444"];
  let by2 = y + 3;
  bc.forEach((c, i) => {
    if (by2 + 10 > y + h) return;
    ctx.fillStyle = hexAlpha(c, 0.75); ctx.fillRect(x + 2, by2, 13, 9);
    ctx.fillStyle = "#201500"; ctx.fillRect(x, by2 + 9, 18, 2);
    by2 += 11;
  });
}

function drawServerRack(ctx: CanvasRenderingContext2D, x: number, y: number, accent: string, t: number) {
  ctx.fillStyle = "#070707"; ctx.fillRect(x, y, 20, 60);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = "#0f0f0f"; ctx.fillRect(x + 2, y + 3 + i * 12, 16, 9);
    const on = Math.sin(t * 2.5 + i * 1.1) > 0;
    ctx.fillStyle = on ? accent : "#2a2a2a";
    if (on) { ctx.shadowColor = accent; ctx.shadowBlur = 4; }
    ctx.fillRect(x + 14, y + 6 + i * 12, 3, 3);
    ctx.shadowBlur = 0;
  }
}

function drawBarChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent: string, t: number) {
  ctx.fillStyle = hexAlpha(accent, 0.12); ctx.fillRect(x, y, w, h);
  const bars = [0.4, 0.65, 0.55, 0.8, 0.7, 0.9, 0.6];
  const bw = Math.floor(w / (bars.length + 1));
  bars.forEach((v, i) => {
    const pulse = v + Math.sin(t * 0.8 + i * 0.5) * 0.03;
    const bh = (h - 6) * Math.min(pulse, 1);
    ctx.fillStyle = hexAlpha(accent, 0.6 + 0.2 * v);
    ctx.fillRect(x + 3 + i * (bw + 1), y + h - 3 - bh, bw, bh);
  });
  // x-axis
  ctx.fillStyle = hexAlpha(accent, 0.3); ctx.fillRect(x + 2, y + h - 3, w - 4, 1);
}

function drawLineChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent: string, t: number) {
  ctx.fillStyle = hexAlpha(accent, 0.10); ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
  ctx.beginPath();
  const pts = 12;
  for (let i = 0; i <= pts; i++) {
    const px2 = x + 3 + (i / pts) * (w - 6);
    const wave = Math.sin(t * 0.6 + i * 0.7) * 0.15 + 0.5;
    const py = y + h - 5 - (h - 10) * (0.3 + wave * 0.5);
    i === 0 ? ctx.moveTo(px2, py) : ctx.lineTo(px2, py);
  }
  ctx.stroke();
}

function drawVitals(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent: string, t: number) {
  ctx.fillStyle = "#040f08"; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = accent; ctx.lineWidth = 1;
  const phase = (t * 0.8) % 1;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const px2 = x + 3 + (i / 40) * (w - 6);
    const rel = ((i / 40) - phase + 1) % 1;
    let amp = 0;
    if (rel < 0.1) amp = Math.sin(rel * Math.PI / 0.1) * 0.8;
    else if (rel < 0.15) amp = Math.sin(rel * Math.PI / 0.15) * 0.4;
    const py = y + h / 2 - amp * (h / 2 - 4);
    i === 0 ? ctx.moveTo(px2, py) : ctx.lineTo(px2, py);
  }
  ctx.stroke();
}

// ═══════════════════════════════════════════════════════════════
// FLOOR DRAWING — textured tile pattern per room
// ═══════════════════════════════════════════════════════════════
function drawFloor(ctx: CanvasRenderingContext2D, room: RoomCfg, t: number) {
  const bx = rx(room.col), by = ry(room.row);
  const inner = WTH;
  // Base fill
  ctx.fillStyle = room.bg;
  ctx.fillRect(bx + inner, by + inner, RW - inner * 2, RH - inner * 2);
  // Tile pattern — checkerboard with accent tint
  const ts = 18;
  for (let tx = 0; tx < RW - inner * 2; tx += ts) {
    for (let ty2 = 0; ty2 < RH - inner * 2; ty2 += ts) {
      if ((Math.floor(tx / ts) + Math.floor(ty2 / ts)) % 2 === 0) {
        ctx.fillStyle = hexAlpha(room.accent, 0.028);
        ctx.fillRect(bx + inner + tx, by + inner + ty2, ts - 1, ts - 1);
      }
    }
  }
  // Corner accent marks
  ctx.fillStyle = hexAlpha(room.accent, 0.18);
  [[inner+2, inner+2],[RW-inner-6, inner+2],[inner+2, RH-inner-6],[RW-inner-6, RH-inner-6]].forEach(([cx2,cy]) => {
    ctx.fillRect(bx + cx2, by + cy, 4, 4);
  });
}

// ═══════════════════════════════════════════════════════════════
// WALL DRAWING — draws 4 walls with door gaps
// ═══════════════════════════════════════════════════════════════
function drawWalls(ctx: CanvasRenderingContext2D, room: RoomCfg, doorProg: Record<string,number>) {
  const bx = rx(room.col), by2 = ry(room.row);
  const ac = room.accent;
  const wallColor = hexAlpha(ac, 0.55);
  ctx.fillStyle = wallColor;
  ctx.shadowColor = ac;
  ctx.shadowBlur  = 10;

  const hasLeft   = room.col > 0;
  const hasRight  = room.col < 2;
  const hasTop    = room.row > 0;
  const hasBottom = room.row < 3;

  const dcy = by2 + (RH - DOOR) / 2;   // door start Y (left/right walls)
  const dcx = bx  + (RW - DOOR) / 2;   // door start X (top/bottom walls)
  const dp = (side: string) => (doorProg[room.id + "-" + side] ?? 0);

  // Helper: draw horizontal wall segment with optional door gap
  function hwall(y: number, hasDoor: boolean, side: string) {
    if (!hasDoor) { ctx.fillRect(bx, y, RW, WTH); return; }
    ctx.fillRect(bx, y, (RW - DOOR) / 2, WTH);
    ctx.fillRect(bx + (RW + DOOR) / 2, y, (RW - DOOR) / 2, WTH);
    // Door panel (slides horizontally as it opens)
    const prog = dp(side);
    const panW = DOOR * (1 - prog);
    if (panW > 0) { ctx.fillStyle = hexAlpha(ac, 0.30); ctx.fillRect(dcx, y, panW, WTH); ctx.fillStyle = wallColor; }
    // Door frame pillars
    ctx.fillStyle = ac;
    ctx.fillRect(dcx - 2, y - 2, 4, WTH + 4);
    ctx.fillRect(dcx + DOOR - 2, y - 2, 4, WTH + 4);
    ctx.fillStyle = wallColor;
  }

  // Helper: draw vertical wall segment with optional door gap
  function vwall(x2: number, hasDoor: boolean, side: string) {
    if (!hasDoor) { ctx.fillRect(x2, by2, WTH, RH); return; }
    ctx.fillRect(x2, by2, WTH, (RH - DOOR) / 2);
    ctx.fillRect(x2, by2 + (RH + DOOR) / 2, WTH, (RH - DOOR) / 2);
    const prog = dp(side);
    const panH = DOOR * (1 - prog);
    if (panH > 0) { ctx.fillStyle = hexAlpha(ac, 0.30); ctx.fillRect(x2, dcy, WTH, panH); ctx.fillStyle = wallColor; }
    ctx.fillStyle = ac;
    ctx.fillRect(x2 - 2, dcy - 2, WTH + 4, 4);
    ctx.fillRect(x2 - 2, dcy + DOOR - 2, WTH + 4, 4);
    ctx.fillStyle = wallColor;
  }

  hwall(by2,          hasTop,    "top");
  hwall(by2 + RH - WTH, hasBottom, "bottom");
  vwall(bx,           hasLeft,   "left");
  vwall(bx + RW - WTH, hasRight, "right");

  ctx.shadowBlur = 0;
}

// ═══════════════════════════════════════════════════════════════
// FURNITURE — themed per room type
// ═══════════════════════════════════════════════════════════════
function drawFurniture(ctx: CanvasRenderingContext2D, room: RoomCfg, t: number) {
  const bx = rx(room.col), by2 = ry(room.row);
  const ac = room.accent;

  switch (room.type) {

    case "ceo": {
      // Bookshelf left
      drawBookshelf(ctx, bx + WTH + 4, by2 + WTH + 6, 120, ac);
      // Window (top wall area)
      const wx = bx + 180, wy = by2 + WTH + 4;
      ctx.fillStyle = "#010d1a"; ctx.fillRect(wx, wy, 80, 48);
      ctx.strokeStyle = hexAlpha(ac, 0.7); ctx.lineWidth = 2;
      ctx.strokeRect(wx, wy, 80, 48); ctx.strokeRect(wx + 39, wy, 1, 48);
      // city silhouette
      ctx.fillStyle = "#062040";
      [[0,30,12,18],[14,22,10,26],[26,36,8,12],[36,18,16,30],[54,28,10,20],[66,36,12,12]].forEach(([bx2,by3,bw,bh]) => ctx.fillRect(wx+bx2,wy+by3,bw,bh));
      ctx.fillStyle = "rgba(120,200,255,0.04)"; ctx.fillRect(wx+2,wy+2,37,44);
      // Plant corner
      ctx.fillStyle = "#1a0900"; ctx.fillRect(bx + WTH + 28, by2 + 30, 12, 14);
      ctx.fillStyle = "#0b420b"; ctx.fillRect(bx + WTH + 23, by2 + 16, 6, 28);
      ctx.fillStyle = "#0e600e"; ctx.fillRect(bx + WTH + 31, by2 + 22, 6, 20);
      ctx.fillStyle = "#0a500a"; ctx.fillRect(bx + WTH + 27, by2 + 10, 6, 32);
      // Executive desk
      const dx = bx + 130, dy = by2 + 130;
      drawDesk(ctx, dx, dy, 90, 30, ac);
      drawMonitor(ctx, dx + 32, dy - 20, 26, 16, ac, t);
      // name plate
      ctx.fillStyle = hexAlpha(ac, 0.8); ctx.fillRect(dx + 22, dy + 8, 32, 7);
      ctx.fillStyle = "#000"; ctx.font = "4px monospace"; ctx.fillText("CEO", dx + 28, dy + 14);
      // Chair
      ctx.fillStyle = "#1a0900"; ctx.fillRect(dx + 28, dy + 30, 26, 18);
      ctx.fillStyle = "#2a1200"; ctx.fillRect(dx + 26, dy + 34, 30, 14);
      break;
    }

    case "booking": {
      // Calendar wall (top-left)
      const calx = bx + WTH + 6, caly = by2 + WTH + 8;
      ctx.fillStyle = "#040c18"; ctx.fillRect(calx, caly, 64, 60);
      ctx.strokeStyle = hexAlpha(ac, 0.5); ctx.lineWidth = 1;
      ctx.strokeRect(calx, caly, 64, 60);
      ctx.fillStyle = hexAlpha(ac, 0.8); ctx.fillRect(calx, caly, 64, 10);
      ctx.fillStyle = "#fff"; ctx.font = "5px monospace"; ctx.fillText("JUNE 2025", calx + 8, caly + 8);
      for (let ci = 0; ci < 7; ci++) for (let ri = 0; ri < 5; ri++) {
        const booked = (ci * 5 + ri) % 4 === 0;
        ctx.fillStyle = booked ? hexAlpha(ac, 0.55) : hexAlpha(ac, 0.10);
        ctx.fillRect(calx + 2 + ci * 9, caly + 13 + ri * 9, 7, 7);
      }
      // Queue display (right wall)
      const qx = bx + RW - WTH - 50, qy = by2 + WTH + 10;
      ctx.fillStyle = "#010812"; ctx.fillRect(qx, qy, 44, 80);
      ctx.strokeStyle = hexAlpha(ac, 0.4); ctx.lineWidth = 1; ctx.strokeRect(qx, qy, 44, 80);
      ["#3b82f6","#10b981","#f59e0b","#ef4444","#a855f7"].forEach((c, i) => {
        ctx.fillStyle = hexAlpha(c, 0.6); ctx.fillRect(qx + 4, qy + 8 + i * 14, 36, 10);
        ctx.fillStyle = "#fff"; ctx.font = "4px monospace"; ctx.fillText(`BCN-${100+i}`, qx + 7, qy + 15 + i * 14);
      });
      // Desk + phone
      const bdx = bx + 100, bdy = by2 + 140;
      drawDesk(ctx, bdx, bdy, 80, 28, ac);
      drawMonitor(ctx, bdx + 26, bdy - 18, 22, 14, ac, t, "BOOKING");
      ctx.fillStyle = "#0a1a2a"; ctx.fillRect(bdx + 4, bdy + 4, 14, 18);
      ctx.fillStyle = hexAlpha(ac, 0.5); ctx.fillRect(bdx + 6, bdy + 6, 10, 6);
      break;
    }

    case "ops": {
      // Status whiteboard (left)
      const wb = bx + WTH + 4, wby = by2 + WTH + 10;
      ctx.fillStyle = "#0d0014"; ctx.fillRect(wb, wby, 58, 90);
      ctx.strokeStyle = hexAlpha(ac, 0.5); ctx.lineWidth = 1; ctx.strokeRect(wb, wby, 58, 90);
      ctx.fillStyle = hexAlpha(ac, 0.7); ctx.fillRect(wb, wby, 58, 9);
      ctx.fillStyle = "#fff"; ctx.font = "4px monospace"; ctx.fillText("WORKFLOW", wb + 6, wby + 7);
      ["INTAKE","ROUTING","DISPATCH","COMPLETE"].forEach((label, i) => {
        const active = i < 3;
        ctx.fillStyle = active ? hexAlpha(ac, 0.35) : hexAlpha("#10b981", 0.35);
        ctx.fillRect(wb + 4, wby + 13 + i * 19, 50, 14);
        ctx.fillStyle = active ? hexAlpha(ac, 0.9) : "#10b981";
        ctx.font = "4px monospace"; ctx.fillText(label, wb + 8, wby + 23 + i * 19);
      });
      // Two workstations
      [bx + 100, bx + 210].forEach(ddx => {
        drawDesk(ctx, ddx, by2 + 140, 68, 26, ac);
        drawMonitor(ctx, ddx + 22, by2 + 122, 22, 14, ac, t);
      });
      // Meeting table center
      ctx.fillStyle = "#0e0018"; ctx.fillRect(bx + 100, by2 + 60, 140, 45);
      ctx.strokeStyle = hexAlpha(ac, 0.3); ctx.lineWidth = 1; ctx.strokeRect(bx + 100, by2 + 60, 140, 45);
      break;
    }

    case "seo": {
      // Ranking whiteboard
      const swx = bx + WTH + 4, swy = by2 + WTH + 8;
      drawBarChart(ctx, swx, swy, 56, 90, ac, t);
      ctx.strokeStyle = hexAlpha(ac, 0.4); ctx.lineWidth = 1; ctx.strokeRect(swx, swy, 56, 90);
      ctx.fillStyle = hexAlpha(ac, 0.7); ctx.font = "4px monospace"; ctx.fillText("RANKINGS", swx + 4, swy + 8);
      // Keyword sticky notes (right side)
      const notes = ["schema","sitemap","h1 tag","alt txt","robots","speed"];
      const noteColors = ["#c9a84c","#3b82f6","#10b981","#f59e0b","#a855f7","#ef4444"];
      notes.forEach((n, i) => {
        const nx = bx + RW - WTH - 58 + (i % 2) * 29, ny2 = by2 + WTH + 10 + Math.floor(i / 2) * 28;
        ctx.fillStyle = hexAlpha(noteColors[i], 0.4); ctx.fillRect(nx, ny2, 26, 22);
        ctx.fillStyle = noteColors[i]; ctx.font = "4px monospace"; ctx.fillText(n, nx + 2, ny2 + 13);
      });
      // Main desk + dual monitor
      drawDesk(ctx, bx + 110, by2 + 140, 100, 28, ac);
      drawMonitor(ctx, bx + 120, by2 + 122, 24, 14, ac, t, "SERP");
      drawMonitor(ctx, bx + 158, by2 + 122, 24, 14, ac, t, "AUDIT");
      break;
    }

    case "analytics": {
      // Line chart (top-left wall)
      drawLineChart(ctx, bx + WTH + 4, by2 + WTH + 8, 80, 60, ac, t);
      // Label
      ctx.fillStyle = hexAlpha(ac, 0.7); ctx.font = "4px monospace"; ctx.fillText("TRAFFIC 7D", bx + WTH + 6, by2 + WTH + 78);
      // Dual monitors + desk
      const adx = bx + 100;
      drawDesk(ctx, adx, by2 + 140, 110, 28, ac);
      drawMonitor(ctx, adx + 8,  by2 + 118, 30, 18, ac, t, "REVENUE");
      drawMonitor(ctx, adx + 44, by2 + 118, 30, 18, ac, t, "FUNNEL");
      drawMonitor(ctx, adx + 78, by2 + 122, 22, 14, ac, t);
      // Server rack (right)
      drawServerRack(ctx, bx + RW - WTH - 26, by2 + WTH + 10, ac, t);
      break;
    }

    case "support": {
      // Chat notification board (top wall area)
      const cbx = bx + WTH + 6, cby = by2 + WTH + 8;
      ctx.fillStyle = "#010d06"; ctx.fillRect(cbx, cby, 80, 70);
      ctx.strokeStyle = hexAlpha(ac, 0.4); ctx.lineWidth = 1; ctx.strokeRect(cbx, cby, 80, 70);
      ["Hi! Can I book?","Airport ETA?","How much?","Need receipt","Great service!"].forEach((msg, i) => {
        const isRight = i % 2 === 0;
        ctx.fillStyle = hexAlpha(isRight ? ac : "#3b82f6", 0.35);
        ctx.fillRect(cbx + (isRight ? 4 : 24), cby + 6 + i * 13, 52, 10);
        ctx.fillStyle = "#fff"; ctx.font = "4px monospace";
        ctx.fillText(msg.slice(0,12), cbx + (isRight ? 6 : 26), cby + 13 + i * 13);
      });
      // Headset desk
      drawDesk(ctx, bx + 120, by2 + 140, 90, 28, ac);
      drawMonitor(ctx, bx + 148, by2 + 120, 26, 16, ac, t, "LIVE CHAT");
      // Status indicators
      ["ONLINE","QUEUE: 3","WAIT: 1m"].forEach((lbl, i) => {
        const on = i === 0 || Math.sin(t * 2 + i) > 0;
        ctx.fillStyle = on ? "#10b981" : "#2a2a2a";
        if (on) { ctx.shadowColor = "#10b981"; ctx.shadowBlur = 4; }
        ctx.fillRect(bx + RW - WTH - 50, by2 + WTH + 12 + i * 18, 8, 8);
        ctx.shadowBlur = 0;
        ctx.fillStyle = hexAlpha(ac, 0.6); ctx.font = "4px monospace";
        ctx.fillText(lbl, bx + RW - WTH - 40, by2 + WTH + 19 + i * 18);
      });
      break;
    }

    case "marketing": {
      // Pinboard (left) with sticky notes
      const pbx = bx + WTH + 4, pby = by2 + WTH + 6;
      ctx.fillStyle = "#1a0404"; ctx.fillRect(pbx, pby, 64, 90);
      ctx.strokeStyle = hexAlpha(ac, 0.4); ctx.lineWidth = 1; ctx.strokeRect(pbx, pby, 64, 90);
      ctx.fillStyle = hexAlpha(ac, 0.5); ctx.fillRect(pbx, pby, 64, 9);
      ctx.fillStyle = "#fff"; ctx.font = "4px monospace"; ctx.fillText("CAMPAIGNS", pbx + 6, pby + 7);
      const stickyColors = ["#ef4444","#f59e0b","#10b981","#3b82f6","#a855f7","#c9a84c"];
      [[4,13],[34,13],[4,39],[34,39],[4,65],[34,65]].forEach(([sx,sy], i) => {
        ctx.fillStyle = hexAlpha(stickyColors[i], 0.55); ctx.fillRect(pbx+sx, pby+sy, 26, 22);
        ctx.fillStyle = "#fff"; ctx.font = "4px monospace";
        ctx.fillText(["BCN ADS","SOCIAL","EMAIL","SEO","BLOG","REACH"][i], pbx+sx+2, pby+sy+13);
      });
      // Poster wall (right)
      [[bx+RW-WTH-36, by2+WTH+8, 30, 60, "#ef4444"],[bx+RW-WTH-70, by2+WTH+10, 28, 56, "#f59e0b"]].forEach(([px2,py,pw,ph,pc]) => {
        ctx.fillStyle = hexAlpha(pc as string, 0.20); ctx.fillRect(px2 as number,py as number,pw as number,ph as number);
        ctx.strokeStyle = hexAlpha(pc as string, 0.5); ctx.lineWidth = 1; ctx.strokeRect(px2 as number,py as number,pw as number,ph as number);
      });
      // Creative desk
      drawDesk(ctx, bx + 110, by2 + 142, 100, 28, ac);
      drawMonitor(ctx, bx + 140, by2 + 120, 30, 18, ac, t, "CANVA");
      break;
    }

    case "knowledge": {
      // Bookshelves left + right
      drawBookshelf(ctx, bx + WTH + 2, by2 + WTH + 4, 160, ac);
      drawBookshelf(ctx, bx + RW - WTH - 20, by2 + WTH + 4, 160, ac);
      // Reading desk center
      drawDesk(ctx, bx + 110, by2 + 145, 120, 28, ac);
      drawMonitor(ctx, bx + 150, by2 + 124, 28, 17, ac, t, "KB v3.2");
      // Filing cabinet
      ctx.fillStyle = "#0d0900"; ctx.fillRect(bx + 80, by2 + 145, 22, 40);
      for (let fi = 0; fi < 3; fi++) {
        ctx.fillStyle = hexAlpha(ac, 0.25); ctx.fillRect(bx + 82, by2 + 147 + fi * 13, 18, 10);
        ctx.fillStyle = hexAlpha(ac, 0.7); ctx.fillRect(bx + 86, by2 + 150 + fi * 13, 10, 3);
      }
      // "INDEXED" label
      ctx.fillStyle = hexAlpha(ac, 0.6); ctx.font = "4px monospace";
      ctx.fillText("KNOWLEDGE BASE", bx + 110, by2 + WTH + 12);
      break;
    }

    case "health": {
      // Vitals monitor (left wall)
      const vmx = bx + WTH + 4, vmy = by2 + WTH + 8;
      drawVitals(ctx, vmx, vmy, 70, 50, ac, t);
      ctx.strokeStyle = hexAlpha(ac, 0.5); ctx.lineWidth = 1; ctx.strokeRect(vmx, vmy, 70, 50);
      ctx.fillStyle = hexAlpha(ac, 0.7); ctx.font = "4px monospace"; ctx.fillText("VITALS", vmx + 22, vmy + 7);
      // Status indicators panel
      const spx = bx + WTH + 4, spy = vmy + 56;
      const checks = [["API","✓"],["DB","✓"],["CDN","✓"],["SSL","✓"],["SPEED","98"],["ERRORS","0"]];
      checks.forEach(([lbl, val], i) => {
        const col2 = i % 2, row2 = Math.floor(i / 2);
        const ok = val === "✓" || parseInt(val) > 90 || val === "0";
        ctx.fillStyle = hexAlpha(ok ? "#10b981" : "#ef4444", 0.25);
        ctx.fillRect(spx + col2 * 34, spy + row2 * 18, 30, 14);
        ctx.fillStyle = ok ? "#10b981" : "#ef4444";
        if (ok) { ctx.shadowColor = "#10b981"; ctx.shadowBlur = 3; }
        ctx.font = "4px monospace"; ctx.fillText(`${lbl}:${val}`, spx + col2 * 34 + 2, spy + row2 * 18 + 9);
        ctx.shadowBlur = 0;
      });
      // Server rack (right wall)
      drawServerRack(ctx, bx + RW - WTH - 26, by2 + WTH + 8, ac, t);
      // Monitoring desk
      drawDesk(ctx, bx + 110, by2 + 145, 100, 28, ac);
      drawMonitor(ctx, bx + 140, by2 + 123, 28, 18, ac, t, "UPTIME");
      break;
    }

    case "meeting": {
      // "DAILY STANDUP" label above table
      ctx.fillStyle = hexAlpha(ac, 0.55);
      ctx.font = "5px monospace";
      ctx.fillText("DAILY STANDUP", bx + RW/2 - 33, by2 + WTH + 14);

      // Whiteboard on left wall
      const mwx = bx + WTH + 4, mwy = by2 + WTH + 22;
      ctx.fillStyle = "#10131a"; ctx.fillRect(mwx, mwy, 52, 80);
      ctx.strokeStyle = hexAlpha(ac, 0.45); ctx.lineWidth = 1; ctx.strokeRect(mwx, mwy, 52, 80);
      ctx.fillStyle = hexAlpha(ac, 0.55); ctx.fillRect(mwx, mwy, 52, 9);
      ctx.fillStyle = "#fff"; ctx.font = "4px monospace"; ctx.fillText("AGENDA", mwx + 10, mwy + 7);
      ["1. Booking review","2. Alerts check","3. KB updates","4. SEO scan","5. Marketing"].forEach((line, i) => {
        ctx.fillStyle = hexAlpha(ac, 0.55); ctx.font = "4px monospace";
        ctx.fillText(line, mwx + 3, mwy + 18 + i * 12);
      });

      // Large oval conference table center
      const tx2 = bx + 100, ty = by2 + 80, tw = 180, th = 80;
      ctx.fillStyle = "#100d08"; ctx.fillRect(tx2, ty, tw, th);
      ctx.strokeStyle = hexAlpha(ac, 0.35); ctx.lineWidth = 2; ctx.strokeRect(tx2, ty, tw, th);
      // Table highlight edge
      ctx.fillStyle = hexAlpha(ac, 0.12); ctx.fillRect(tx2 + 2, ty + 2, tw - 4, 4);
      // Table nameplate strip
      ctx.fillStyle = hexAlpha(ac, 0.20); ctx.fillRect(tx2 + tw/2 - 28, ty + th/2 - 6, 56, 12);
      ctx.fillStyle = hexAlpha(ac, 0.7); ctx.font = "4px monospace";
      ctx.fillText("ÉLITE BCN HQ", tx2 + tw/2 - 24, ty + th/2 + 2);

      // Chairs around the table (6 chairs)
      const chairColor = "#0e0c0a";
      const chairAccent = hexAlpha(ac, 0.25);
      // Top row (3 chairs)
      [tx2 + 18, tx2 + 78, tx2 + 138].forEach(cx3 => {
        ctx.fillStyle = chairColor; ctx.fillRect(cx3, ty - 16, 20, 14);
        ctx.fillStyle = chairAccent; ctx.fillRect(cx3, ty - 16, 20, 4);
        ctx.fillStyle = "#060504"; ctx.fillRect(cx3 + 2, ty - 2, 4, 4); ctx.fillRect(cx3 + 14, ty - 2, 4, 4);
      });
      // Bottom row (3 chairs)
      [tx2 + 18, tx2 + 78, tx2 + 138].forEach(cx3 => {
        ctx.fillStyle = chairColor; ctx.fillRect(cx3, ty + th + 2, 20, 14);
        ctx.fillStyle = chairAccent; ctx.fillRect(cx3, ty + th + 12, 20, 4);
        ctx.fillStyle = "#060504"; ctx.fillRect(cx3 + 2, ty + th, 4, 4); ctx.fillRect(cx3 + 14, ty + th, 4, 4);
      });
      // Side chairs
      ctx.fillStyle = chairColor; ctx.fillRect(tx2 - 16, ty + th/2 - 10, 14, 20);
      ctx.fillStyle = chairAccent; ctx.fillRect(tx2 - 16, ty + th/2 - 10, 4, 20);
      ctx.fillStyle = chairColor; ctx.fillRect(tx2 + tw + 2, ty + th/2 - 10, 14, 20);
      ctx.fillStyle = chairAccent; ctx.fillRect(tx2 + tw + 12, ty + th/2 - 10, 4, 20);

      // Projector screen (right wall)
      const sx = bx + RW - WTH - 36, sy = by2 + WTH + 20;
      ctx.fillStyle = "#e8eaed"; ctx.fillRect(sx, sy, 30, 48);
      ctx.strokeStyle = hexAlpha(ac, 0.6); ctx.lineWidth = 1; ctx.strokeRect(sx, sy, 30, 48);
      // "screen content" — pie chart or bar
      ctx.fillStyle = "#1a1a2e"; ctx.fillRect(sx + 1, sy + 1, 28, 46);
      drawBarChart(ctx, sx + 2, sy + 4, 26, 36, ac, t);
      ctx.fillStyle = hexAlpha(ac, 0.5); ctx.font = "3px monospace"; ctx.fillText("KPI TODAY", sx + 3, sy + 45);

      // Projector device on ceiling (small box)
      ctx.fillStyle = "#0a0a0a"; ctx.fillRect(bx + RW/2 - 8, by2 + WTH + 1, 16, 8);
      ctx.fillStyle = hexAlpha(ac, 0.4); ctx.fillRect(bx + RW/2 - 4, by2 + WTH + 3, 8, 4);

      // Room accent corner marks
      ctx.fillStyle = hexAlpha(ac, 0.3);
      [WTH+2, RW-WTH-6].forEach(cx3 => [WTH+2, RH-WTH-6].forEach(cy3 => {
        ctx.fillRect(bx + cx3, by2 + cy3, 4, 4);
      }));
      break;
    }

    case "cafe": {
      // Bar counter along left wall
      const barx = bx + WTH + 4, bary = by2 + WTH + 6;
      ctx.fillStyle = "#1a0a00"; ctx.fillRect(barx, bary, 18, RH - WTH * 2 - 8);
      ctx.fillStyle = hexAlpha(ac, 0.5); ctx.fillRect(barx, bary, 18, 5);      // bar top edge
      ctx.fillStyle = hexAlpha(ac, 0.25); ctx.fillRect(barx + 14, bary, 4, RH - WTH * 2 - 8); // bar front
      ctx.fillStyle = "#251000"; ctx.font = "4px monospace"; ctx.fillText("BAR", barx + 2, bary + 20);

      // Coffee machine on bar (top)
      const cmx = barx + 1, cmy = bary + 6;
      ctx.fillStyle = "#0d0d0d"; ctx.fillRect(cmx, cmy, 14, 22);
      ctx.fillStyle = hexAlpha(ac, 0.6); ctx.fillRect(cmx + 1, cmy + 1, 12, 6);
      ctx.fillStyle = "#251000"; ctx.fillRect(cmx + 4, cmy + 10, 6, 6);
      // Steam animation
      const steamOpacity = 0.3 + Math.abs(Math.sin(t * 3)) * 0.3;
      ctx.fillStyle = `rgba(255,255,255,${steamOpacity})`;
      ctx.fillRect(cmx + 5, cmy - 3, 2, 3);
      ctx.fillRect(cmx + 8, cmy - 4, 2, 4);

      // Bottles on shelf above bar
      [[barx+2, bary+32, "#ef4444"], [barx+6, bary+30, "#10b981"], [barx+10, bary+34, "#f59e0b"]].forEach(([bx3, by3, bc]) => {
        ctx.fillStyle = hexAlpha(bc as string, 0.5); ctx.fillRect(bx3 as number, by3 as number, 3, 12);
        ctx.fillStyle = hexAlpha(bc as string, 0.8); ctx.fillRect(bx3 as number, by3 as number, 3, 3);
      });

      // High stools at bar (right side of bar)
      [by2 + 60, by2 + 95, by2 + 130].forEach(sy2 => {
        ctx.fillStyle = "#150a00"; ctx.fillRect(barx + 22, sy2, 12, 10);   // seat
        ctx.fillStyle = hexAlpha(ac, 0.3); ctx.fillRect(barx + 22, sy2, 12, 3); // seat top
        ctx.fillStyle = "#0a0600"; ctx.fillRect(barx + 26, sy2 + 10, 4, 16);   // leg
      });

      // Round café tables (center + right)
      [[bx + 120, by2 + 60], [bx + 200, by2 + 55], [bx + 160, by2 + 135]].forEach(([ctx2, cty], i) => {
        // Table
        ctx.fillStyle = "#1a0c00"; ctx.fillRect(ctx2 as number, cty as number, 30, 22);
        ctx.strokeStyle = hexAlpha(ac, 0.35); ctx.lineWidth = 1; ctx.strokeRect(ctx2 as number, cty as number, 30, 22);
        ctx.fillStyle = hexAlpha(ac, 0.15); ctx.fillRect((ctx2 as number) + 2, (cty as number) + 2, 26, 4);
        // Coffee cups on table
        if (i < 2) {
          ctx.fillStyle = "#2a1a00"; ctx.fillRect((ctx2 as number) + 8, (cty as number) + 8, 8, 6);
          ctx.fillStyle = "#3a2a00"; ctx.fillRect((ctx2 as number) + 10, (cty as number) + 6, 4, 4);
        }
        // Table leg
        ctx.fillStyle = "#0e0700"; ctx.fillRect((ctx2 as number) + 13, (cty as number) + 22, 4, 10);
        ctx.fillRect((ctx2 as number) + 9, (cty as number) + 30, 12, 3);
        // Chairs beside each table
        ctx.fillStyle = "#100800"; ctx.fillRect((ctx2 as number) - 10, (cty as number) + 2, 8, 14);
        ctx.fillStyle = hexAlpha(ac, 0.20); ctx.fillRect((ctx2 as number) - 10, (cty as number) + 2, 8, 3);
        ctx.fillStyle = "#100800"; ctx.fillRect((ctx2 as number) + 32, (cty as number) + 2, 8, 14);
        ctx.fillStyle = hexAlpha(ac, 0.20); ctx.fillRect((ctx2 as number) + 32, (cty as number) + 2, 8, 3);
      });

      // "CAFÉ" sign on top wall
      const sgx = bx + RW/2 - 16, sgy = by2 + WTH + 4;
      ctx.fillStyle = hexAlpha(ac, 0.4); ctx.fillRect(sgx, sgy, 32, 10);
      ctx.fillStyle = hexAlpha(ac, 0.9); ctx.font = "5px monospace"; ctx.fillText("☕ CAFÉ", sgx + 2, sgy + 8);

      // Warm ambient glow on floor
      const glowA = 0.04 + Math.sin(t * 0.5) * 0.01;
      ctx.fillStyle = `rgba(249,115,22,${glowA})`; ctx.fillRect(bx + WTH + 4, by2 + WTH + 4, RW - WTH * 2 - 8, RH - WTH * 2 - 8);
      break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// HALLWAY RENDERING
// ═══════════════════════════════════════════════════════════════
function drawHallways(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = "#050505";
  // Horizontal corridors (between each row pair)
  ctx.fillRect(0, RH,                     CW, VGAP);   // row 0-1
  ctx.fillRect(0, 2 * (RH + VGAP) - VGAP, CW, VGAP);  // row 1-2
  ctx.fillRect(0, 3 * (RH + VGAP) - VGAP, CW, VGAP);  // row 2-3 (NEW)
  // Vertical corridors (span all 4 rows)
  ctx.fillRect(RW, 0, HGAP, CH);
  ctx.fillRect(2 * (RW + HGAP) - HGAP, 0, HGAP, CH);

  // Subtle floor tiles in corridors
  ctx.strokeStyle = "rgba(255,255,255,0.025)"; ctx.lineWidth = 1;
  for (let gx = 0; gx < CW; gx += 16) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, CH); ctx.stroke(); }
  for (let gy2 = 0; gy2 < CH; gy2 += 16) { ctx.beginPath(); ctx.moveTo(0, gy2); ctx.lineTo(CW, gy2); ctx.stroke(); }

  // Emergency lighting strips along corridor edges
  const stripColor = (alpha: number) => `rgba(60,80,255,${alpha})`;
  const blink = 0.12 + Math.sin(t * 2.5) * 0.04;
  [[RW, RH, HGAP, 2],[RW, 2*RH+VGAP-2, HGAP, 2],[2*(RW+HGAP)-HGAP, RH, HGAP, 2],[2*(RW+HGAP)-HGAP, 2*RH+VGAP-2, HGAP, 2],
   // row 2-3 corridor v-strips (NEW)
   [RW, 3*(RH+VGAP)-VGAP, HGAP, 2],[2*(RW+HGAP)-HGAP, 3*(RH+VGAP)-VGAP, HGAP, 2],
  ].forEach(([ex,ey,ew,eh]) => {
    ctx.fillStyle = stripColor(blink); ctx.fillRect(ex, ey, ew, eh);
  });
  // H-corridor strips (top + bottom edge of each horizontal corridor)
  [[0, RH, RW, 2],[0, RH+VGAP-2, RW, 2],[RW+HGAP, RH, RW, 2],[RW+HGAP, RH+VGAP-2, RW, 2],
   [2*(RW+HGAP), RH, RW, 2],[2*(RW+HGAP), RH+VGAP-2, RW, 2],
   [0, 2*RH+VGAP, RW, 2],[0, 3*RH+2*VGAP-2, RW, 2],[RW+HGAP, 2*RH+VGAP, RW, 2],[RW+HGAP, 3*RH+2*VGAP-2, RW, 2],
   [2*(RW+HGAP), 2*RH+VGAP, RW, 2],[2*(RW+HGAP), 3*RH+2*VGAP-2, RW, 2],
   // row 2-3 h-corridor strips (NEW)
   [0, 3*(RH+VGAP)-VGAP, RW, 2],[0, 3*(RH+VGAP)-2, RW, 2],
   [RW+HGAP, 3*(RH+VGAP)-VGAP, RW, 2],[RW+HGAP, 3*(RH+VGAP)-2, RW, 2],
  ].forEach(([ex,ey,ew,eh]) => { ctx.fillStyle = stripColor(blink * 0.6); ctx.fillRect(ex, ey, ew, eh); });
}

// ═══════════════════════════════════════════════════════════════
// CHARACTER RENDERING
// ═══════════════════════════════════════════════════════════════
function drawAgent(ctx: CanvasRenderingContext2D, agent: AgentCfg, sim: Sim, t: number) {
  const frame = sim.state === "working" ? (sim.frame % 2 === 0 ? WK : W0) : WALK_FRAMES[sim.frame % 4];
  const cw = 8 * PS, ch = 12 * PS;
  const ox = sim.pos.x - cw / 2, oy = sim.pos.y - ch;

  // Drop shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath();
  ctx.ellipse(sim.pos.x, sim.pos.y + 1, cw / 2, 3, 0, 0, Math.PI * 2); ctx.fill();

  // Character pixels
  ctx.save();
  if (sim.dir === "left") { ctx.translate(ox + cw, oy); ctx.scale(-1, 1); }
  else ctx.translate(ox, oy);

  if (sim.state === "working") { ctx.shadowColor = agent.hc; ctx.shadowBlur = 8; }

  frame.forEach((row, ry2) => row.forEach((px, rx2) => {
    if (!px) return;
    ctx.fillStyle = ry2 < 5 ? agent.hc : agent.bc;
    ctx.fillRect(rx2 * PS, ry2 * PS, PS, PS);
  }));
  ctx.shadowBlur = 0;
  ctx.restore();

  // Idle bob (standing still)
  if (sim.state === "idle") {
    const bob = Math.floor(Math.sin(t * 2.5 + sim.pos.x * 0.01) * 1.5);
    if (bob !== 0) {
      ctx.save();
      if (sim.dir === "left") { ctx.translate(ox + cw, oy + bob); ctx.scale(-1, 1); }
      else ctx.translate(ox, oy + bob);
      ctx.clearRect(0, 0, 8 * PS, 12 * PS);
      W0.forEach((row, ry2) => row.forEach((px, rx2) => {
        if (!px) return;
        ctx.fillStyle = ry2 < 5 ? agent.hc : agent.bc;
        ctx.fillRect(rx2 * PS, ry2 * PS, PS, PS);
      }));
      ctx.restore();
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// PARTICLE SYSTEM — data flowing between departments
// ═══════════════════════════════════════════════════════════════
function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  particles.forEach(p => {
    // Interpolate position along path based on t
    const totalSegs = p.path.length - 1;
    if (totalSegs === 0) return;
    const seg  = Math.floor(p.t * totalSegs);
    const segT = (p.t * totalSegs) - seg;
    const a    = p.path[Math.min(seg, totalSegs - 1)];
    const b    = p.path[Math.min(seg + 1, totalSegs)];
    if (!a || !b) return;
    const px = a.x + (b.x - a.x) * segT;
    const py = a.y + (b.y - a.y) * segT;

    ctx.shadowColor = p.color; ctx.shadowBlur = 6;
    ctx.fillStyle   = p.color;
    ctx.fillRect(px - p.size / 2, py - p.size / 2, p.size, p.size);
    ctx.shadowBlur  = 0;
  });
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function OfficeCanvas({ initialData }: { initialData: HQData }) {
  const cvs       = useRef<HTMLCanvasElement>(null);
  const simRef    = useRef<Record<string, Sim>>({});
  const doorsRef  = useRef<Record<string, number>>({}); // door open progress 0–1
  const partRef   = useRef<Particle[]>([]);
  const hqRef     = useRef<HQData>(initialData);
  const rafRef    = useRef<number>(0);
  const tickRef   = useRef<NodeJS.Timeout | undefined>(undefined);

  const [bubbles,  setBubbles]  = useState<Bubble[]>([]);
  const [metrics,  setMetrics]  = useState(initialData.metrics);
  const [hovered,  setHovered]  = useState<string | null>(null);
  const [hoveredAgent, setHoveredAgent] = useState<{name:string;phrase:string;roomName:string;color:string} | null>(null);

  // ── Init ─────────────────────────────────────────────────────
  useEffect(() => {
    AGENTS.forEach(ag => {
      const home = deskPos(ag.roomId);
      simRef.current[ag.id] = {
        pos: { ...home }, path: [], state: "idle",
        frame: 0, frameT: 0, dir: "right",
        speech: null, speechT: 0, workT: 0,
        idleT: Math.random() * 4 + 1, visitRoom: null,
      };
    });
    // Init doors
    ROOMS.forEach(r => {
      if (r.col > 0) doorsRef.current[r.id + "-left"]   = 0;
      if (r.col < 2) doorsRef.current[r.id + "-right"]  = 0;
      if (r.row > 0) doorsRef.current[r.id + "-top"]    = 0;
      if (r.row < 3) doorsRef.current[r.id + "-bottom"] = 0;
    });
    // Init particles (offset each one along path)
    partRef.current = PARTICLE_ROUTES.flatMap((r, ri) => (
      Array.from({ length: 3 }, (_, i) => ({
        path:  r.path, t: (i / 3 + ri * 0.17) % 1,
        speed: r.speed * (0.85 + i * 0.1),
        color: r.color, size: r.size,
      }))
    ));
  }, []);

  // ── Data refresh every 15s ────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const r = await fetch("/api/ai/hq");
        if (r.ok) { const d: HQData = await r.json(); hqRef.current = d; setMetrics(d.metrics); }
      } catch {}
    }, 15_000);
    return () => clearInterval(iv);
  }, []);

  // ── Assign task to agent ──────────────────────────────────────
  const assignTask = useCallback((ag: AgentCfg, phrase: string, targetRoomId: string) => {
    const s = simRef.current[ag.id];
    if (!s || s.state !== "idle") return;
    const toPos = deskPos(targetRoomId);
    s.path     = computePath(ag.roomId, targetRoomId, s.pos, toPos);
    s.state    = "walking";
    s.speech   = phrase;
    s.speechT  = 14;
    s.visitRoom = targetRoomId;
    s.workT    = 8 + Math.random() * 10;
  }, []);

  // ── Simulation tick ───────────────────────────────────────────
  useEffect(() => {
    function tick() {
      const eligible = AGENTS.filter(a => simRef.current[a.id]?.state === "idle");
      if (!eligible.length) return;
      const ag   = eligible[Math.floor(Math.random() * eligible.length)];
      const room = ROOMS.find(r => r.id === ag.roomId)!;

      // 15% chance to visit café for a break
      if (Math.random() < 0.15) {
        assignTask(ag, "☕ Coffee break", "cafe");
        return;
      }

      // 20% chance to visit neighbor room
      const neighbors = ROOMS.filter(r => r.id !== room.id && r.id !== "meeting" && r.id !== "cafe" && (r.col === room.col || r.row === room.row));
      const goVisit   = Math.random() < 0.2 && neighbors.length > 0;
      const targetId  = goVisit ? neighbors[Math.floor(Math.random() * neighbors.length)].id : ag.roomId;
      const phrase    = ag.phrases[Math.floor(Math.random() * ag.phrases.length)];

      assignTask(ag, phrase, targetId);
    }
    tickRef.current = setInterval(tick, 3000 + Math.random() * 2000);
    tick();
    return () => clearInterval(tickRef.current);
  }, [assignTask]);

  // ── Daily standup animation (every 4 minutes real-time) ───────
  useEffect(() => {
    function triggerStandup() {
      const m = hqRef.current.metrics;
      const standupTopics = [
        `${m.bookingsToday} bookings today`,
        m.alertCount > 0 ? `${m.alertCount} alert${m.alertCount > 1 ? "s" : ""} pending` : "All systems clear",
        `${m.completedToday} tasks done`,
        m.agentsError > 0 ? `${m.agentsError} agent error${m.agentsError > 1 ? "s" : ""}` : "All agents healthy",
        `${m.avgSuccess}% success rate`,
        `${m.kbCount} KB entries`,
        `Budget ${m.budgetPct}% used`,
        `${m.conversations7d} chats this week`,
      ];
      const eligible = AGENTS.filter(a => simRef.current[a.id]?.state === "idle").slice(0, 3);
      eligible.forEach((ag, i) => {
        setTimeout(() => {
          const topic = standupTopics[i % standupTopics.length];
          assignTask(ag, topic, "meeting");
        }, i * 800); // stagger entries
      });
    }

    const iv = setInterval(triggerStandup, 4 * 60 * 1000); // every 4 minutes
    // First standup 30 seconds after load (let agents settle first)
    const initial = setTimeout(triggerStandup, 30_000);
    return () => { clearInterval(iv); clearTimeout(initial); };
  }, [assignTask]);

  // ── Animation loop ────────────────────────────────────────────
  useEffect(() => {
    const canvas = cvs.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) return;

    let lastT = performance.now();
    let elapsed = 0;

    function animate(now: number) {
      const dt  = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      elapsed += dt;
      const t = elapsed;

      // ── Update particles ──────────────────────────────────────
      partRef.current.forEach(p => {
        p.t = (p.t + p.speed * dt) % 1;
      });

      // ── Update doors ──────────────────────────────────────────
      Object.keys(doorsRef.current).forEach(key => {
        const [roomId, side] = key.split("-");
        const room = ROOMS.find(r => r.id === roomId);
        if (!room) return;
        const bx2 = rx(room.col), by2 = ry(room.row);
        const dcy  = by2 + (RH - DOOR) / 2;
        const dcx2 = bx2 + (RW - DOOR) / 2;
        // Check if any agent is near this door
        const near = AGENTS.some(ag => {
          const s = simRef.current[ag.id];
          if (!s) return false;
          if (side === "left")   return s.pos.x < bx2 + 25  && Math.abs(s.pos.y - (dcy + DOOR/2)) < 30;
          if (side === "right")  return s.pos.x > bx2 + RW - 25 && Math.abs(s.pos.y - (dcy + DOOR/2)) < 30;
          if (side === "top")    return s.pos.y < by2 + 25   && Math.abs(s.pos.x - (dcx2 + DOOR/2)) < 30;
          if (side === "bottom") return s.pos.y > by2 + RH - 25 && Math.abs(s.pos.x - (dcx2 + DOOR/2)) < 30;
          return false;
        });
        const target = near ? 1 : 0;
        const rate   = near ? 4 : 2.5;
        doorsRef.current[key] = Math.max(0, Math.min(1, doorsRef.current[key] + (target - doorsRef.current[key]) * rate * dt));
      });

      // ── Update agents ─────────────────────────────────────────
      const nextBubbles: Bubble[] = [];
      AGENTS.forEach(ag => {
        const s = simRef.current[ag.id];
        if (!s) return;

        if (s.speechT > 0) { s.speechT -= dt; if (s.speechT <= 0) s.speech = null; }

        if (s.state === "working") {
          s.workT -= dt;
          s.frameT += dt; if (s.frameT > 0.3) { s.frame = (s.frame + 1) % 2; s.frameT = 0; }
          if (s.workT <= 0) {
            const homePos = deskPos(ag.roomId);
            s.path    = computePath(s.visitRoom ?? ag.roomId, ag.roomId, s.pos, homePos);
            s.state   = s.visitRoom && s.visitRoom !== ag.roomId ? "returning" : "idle";
            s.visitRoom = null;
          }
        }

        if (s.state === "idle") {
          s.idleT -= dt;
          if (s.idleT <= 0) {
            const home = deskPos(ag.roomId);
            const d    = vdist(s.pos, home);
            if (d > 8) {
              s.path = [home]; s.state = "returning";
            } else {
              s.state = "working"; s.workT = 6 + Math.random() * 8;
              s.speech = ag.phrases[Math.floor(Math.random() * ag.phrases.length)]; s.speechT = 8;
              s.idleT  = 5 + Math.random() * 6;
            }
          }
        }

        if (s.state === "walking" || s.state === "returning") {
          if (s.path.length === 0) {
            s.state = s.state === "walking" ? "working" : "idle";
            s.idleT = 4 + Math.random() * 5;
          } else {
            const tgt  = s.path[0];
            const d    = vdist(s.pos, tgt);
            const step = SPD * dt;
            if (d <= step) {
              s.pos  = { ...tgt };
              s.path = s.path.slice(1);
            } else {
              const dx = (tgt.x - s.pos.x) / d, dy = (tgt.y - s.pos.y) / d;
              s.pos.x += dx * step; s.pos.y += dy * step;
              if (Math.abs(dx) > 0.2) s.dir = dx > 0 ? "right" : "left";
            }
            s.frameT += dt; if (s.frameT > FT) { s.frame = (s.frame + 1) % 4; s.frameT = 0; }
          }
        }

        if (s.speech) {
          nextBubbles.push({ id: ag.id, x: s.pos.x, y: s.pos.y - 12 * PS - 4, text: s.speech, color: ag.hc });
        }
      });

      setBubbles(prev => {
        const same = prev.length === nextBubbles.length && prev.every((b,i) => b.id===nextBubbles[i]?.id && b.text===nextBubbles[i]?.text);
        return same ? prev : nextBubbles;
      });

      // ── Draw ─────────────────────────────────────────────────
      ctx.clearRect(0, 0, CW, CH);
      ctx.fillStyle = "#030303"; ctx.fillRect(0, 0, CW, CH);

      drawHallways(ctx, t);

      ROOMS.forEach(room => {
        drawFloor(ctx, room, t);
        drawFurniture(ctx, room, t);
        drawWalls(ctx, room, doorsRef.current);
      });

      drawParticles(ctx, partRef.current);

      // Agents: seated first, walking on top
      const order = [...AGENTS].sort((a, b) => {
        const sa = simRef.current[a.id]; const sb = simRef.current[b.id];
        const aw = sa?.state==="walking"||sa?.state==="returning";
        const bw = sb?.state==="walking"||sb?.state==="returning";
        return (aw?1:0) - (bw?1:0);
      });
      order.forEach(ag => {
        const s = simRef.current[ag.id];
        if (s) drawAgent(ctx, ag, s, t);
      });

      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Hover detection ───────────────────────────────────────────
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect  = cvs.current!.getBoundingClientRect();
    const scaleX = CW / rect.width;
    const mx    = (e.clientX - rect.left) * scaleX;
    const my    = (e.clientY - rect.top)  * (CH / rect.height);
    const r = ROOMS.find(r => {
      const bx2 = rx(r.col), by2 = ry(r.row);
      return mx >= bx2 && mx <= bx2 + RW && my >= by2 && my <= by2 + RH;
    });
    if (!r) { setHovered(null); setHoveredAgent(null); return; }
    setHovered(r.id);
    const ag = AGENTS.find(a => a.roomId === r.id);
    const s  = ag ? simRef.current[ag.id] : null;
    if (ag && s) setHoveredAgent({ name: ag.name, phrase: s.speech ?? ag.phrases[0], roomName: r.name, color: ag.hc });
  }, []);

  const onMouseLeave = useCallback(() => { setHovered(null); setHoveredAgent(null); }, []);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{ position:"relative", width:"100%", background:"#030303", fontFamily:"monospace" }}>
      <style>{`
        .ob { position:absolute; transform:translateX(-50%) translateY(-100%); background:rgba(0,0,0,0.92);
          border:1px solid; padding:4px 8px; font-family:monospace; font-size:10px; white-space:nowrap;
          pointer-events:none; line-height:1.3; z-index:10; max-width:180px; text-align:center; }
        .ob::after { content:''; position:absolute; bottom:-5px; left:50%; transform:translateX(-50%);
          border:5px solid transparent; border-top-color:inherit; border-bottom:none; }
        .rl { position:absolute; transform:translateX(-50%); pointer-events:none; z-index:5;
          font-family:monospace; font-size:9px; letter-spacing:.25em; text-transform:uppercase; }
        .scan { position:absolute; inset:0; pointer-events:none;
          background:repeating-linear-gradient(0deg,rgba(0,0,0,0.04),rgba(0,0,0,0.04) 1px,transparent 1px,transparent 4px); z-index:20; }
        .hpanel { position:absolute; right:10px; bottom:10px; width:220px;
          background:rgba(0,0,0,0.92); border:1px solid; padding:12px; z-index:30;
          font-family:monospace; font-size:11px; pointer-events:none; }
        @keyframes hblink { 0%,100%{opacity:1} 50%{opacity:.4} }
        .live { animation:hblink 1.8s ease-in-out infinite; color:#10b981; }
        .sbar { display:flex; gap:16px; padding:8px 14px; background:rgba(0,0,0,0.7); border-top:1px solid rgba(255,255,255,.06);
          font-size:10px; color:rgba(255,255,255,.4); overflow-x:auto; }
        .sbar .s { display:flex; flex-direction:column; gap:2px; min-width:max-content; }
        .sbar .v { color:#c9a84c; font-size:13px; font-weight:bold; }
        .leg { display:flex; flex-wrap:wrap; gap:10px; padding:6px 14px; border-bottom:1px solid rgba(255,255,255,.06); font-size:10px; }
        .leg span { display:flex; align-items:center; color:rgba(255,255,255,.5); }
        .dot { width:7px; height:7px; border-radius:50%; display:inline-block; margin-right:4px; flex-shrink:0; }
      `}</style>

      {/* Top bar */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 14px", borderBottom:"1px solid rgba(201,168,76,.15)", background:"rgba(0,0,0,.85)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:7, height:7, background:"#c9a84c", transform:"rotate(45deg)" }} />
          <span style={{ color:"#c9a84c", fontSize:11, letterSpacing:".3em", textTransform:"uppercase" }}>ÉLITE BCN AI HEADQUARTERS</span>
          <span className="live" style={{ fontSize:9, marginLeft:4 }}>● LIVE</span>
        </div>
        <div style={{ display:"flex", gap:14, fontSize:10, color:"rgba(255,255,255,.4)" }}>
          <span>{metrics.agentCount} agents</span>
          <span style={{ color: metrics.agentsRunning > 0 ? "#10b981" : "rgba(255,255,255,.3)" }}>{metrics.agentsRunning} running</span>
          {metrics.agentsError > 0 && <span style={{ color:"#ef4444" }}>{metrics.agentsError} err</span>}
          <span>Budget {metrics.budgetPct}%</span>
        </div>
      </div>

      {/* Agent legend */}
      <div className="leg">
        {AGENTS.map(a => (
          <span key={a.id}><span className="dot" style={{ background:a.hc }} />{a.name}</span>
        ))}
      </div>

      {/* Canvas container */}
      <div style={{ position:"relative", width:"100%" }}>
        <canvas
          ref={cvs}
          width={CW}
          height={CH}
          style={{ width:"100%", height:"auto", display:"block", imageRendering:"pixelated", cursor:"crosshair" }}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        />

        {/* Scanline overlay */}
        <div className="scan" />

        {/* Room labels */}
        {ROOMS.map(room => (
          <div key={room.id} className="rl" style={{
            left:  `${((rx(room.col) + RW / 2) / CW) * 100}%`,
            top:   `${((ry(room.row) + 13) / CH) * 100}%`,
            color: room.accent,
            textShadow: `0 0 8px ${room.accent}`,
          }}>
            {room.shortName}
          </div>
        ))}

        {/* Speech bubbles */}
        {bubbles.map(b => (
          <div key={b.id} className="ob" style={{ left:`${(b.x/CW)*100}%`, top:`${(b.y/CH)*100}%`, borderColor:b.color, color:"#fff" }}>
            {b.text}
          </div>
        ))}

        {/* Hover detail panel */}
        {hoveredAgent && (
          <div className="hpanel" style={{ borderColor: ROOMS.find(r=>r.id===hovered)?.accent ?? "#c9a84c" }}>
            <div style={{ color: ROOMS.find(r=>r.id===hovered)?.accent, fontSize:9, letterSpacing:".2em", textTransform:"uppercase", marginBottom:6 }}>
              {hoveredAgent.roomName}
            </div>
            <div style={{ color:"#fff", fontWeight:"bold", marginBottom:4 }}>{hoveredAgent.name}</div>
            <div style={{ color:"rgba(255,255,255,.5)", fontSize:10, marginBottom:8 }}>"{hoveredAgent.phrase}"</div>
            {(() => {
              const ag  = AGENTS.find(a => a.name === hoveredAgent.name);
              const hqA = ag?.agentKey ? hqRef.current.agents.find(a => a.name === ag.agentKey) : null;
              if (!hqA) return <div style={{ color:"rgba(255,255,255,.3)", fontSize:10 }}>Virtual agent — no DB record</div>;
              return (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                  {[["Runs", hqA.totalRuns],["Success", `${Math.round(hqA.successRate)}%`],["Tasks ✓", hqA.tasksToday.completed],["Memories", hqA.memoryCount]].map(([k,v]) => (
                    <div key={k as string} style={{ background:"rgba(255,255,255,.04)", padding:"4px 6px" }}>
                      <div style={{ color: ROOMS.find(r=>r.id===hovered)?.accent, fontSize:12 }}>{v}</div>
                      <div style={{ color:"rgba(255,255,255,.4)", fontSize:9 }}>{k}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="sbar">
        {[
          ["Bookings Today", metrics.bookingsToday],
          ["Revenue Today", `€${metrics.revenueToday.toFixed(0)}`],
          ["Tasks Today", metrics.totalToday],
          ["Success Rate", `${metrics.avgSuccess}%`],
          ["AI Chats (7d)", metrics.conversations7d],
          ["Knowledge Base", `${metrics.kbCount} docs`],
          ["Alerts", metrics.alertCount],
          ["Budget Used", `€${(metrics.spentCents/100).toFixed(2)}`],
        ].map(([label, val]) => (
          <div key={label as string} className="s">
            <span className="v">{val}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
