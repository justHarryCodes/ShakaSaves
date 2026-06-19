import sharp from "sharp";
import type { SavingsCard } from "@/types";

const W = 900;
const H = 560;
const NAVY = "#0F172A";
const EMERALD = "#10B981";
const AMBER = "#F59E0B";
const SLATE_DARK = "#1E293B";
const SLATE_MID = "#334155";
const WHITE = "#FFFFFF";
const GRID_LINE = "rgba(255,255,255,0.04)";

function naira(amount: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount);
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function buildDailyGrid(
  year: number,
  month: number,
  tickedPeriods: string[],
  pendingPeriods: string[]
): string {
  const days = getDaysInMonth(year, month);
  const ticked = new Set(tickedPeriods);
  const pending = new Set(pendingPeriods);

  const cols = 7;
  const cellW = 96;
  const cellH = 54;
  const startX = 60;
  const startY = 230;
  const r = 8;

  let cells = "";
  for (let day = 1; day <= 35; day++) {
    const col = (day - 1) % cols;
    const row = Math.floor((day - 1) / cols);
    const x = startX + col * (cellW + 8);
    const y = startY + row * (cellH + 8);

    const dateStr = day <= days
      ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      : "";

    let fill = SLATE_MID;
    let stroke = "none";
    let textColor = "#94A3B8";
    const label = day <= days ? String(day) : "";

    if (dateStr && ticked.has(dateStr)) {
      fill = EMERALD;
      textColor = WHITE;
    } else if (dateStr && pending.has(dateStr)) {
      fill = "none";
      stroke = AMBER;
      textColor = AMBER;
    } else if (day > days) {
      fill = "#0F172A";
      textColor = "transparent";
    }

    const checkmark = (dateStr && ticked.has(dateStr))
      ? `<text x="${x + cellW / 2}" y="${y + cellH / 2 + 6}" text-anchor="middle" font-family="Arial" font-size="16" fill="${WHITE}">✓</text>`
      : `<text x="${x + cellW / 2}" y="${y + cellH / 2 + 6}" text-anchor="middle" font-family="Arial" font-size="14" font-weight="600" fill="${textColor}">${label}</text>`;

    cells += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
${checkmark}`;
  }
  return cells;
}

function buildWeeklyGrid(year: number, month: number, tickedPeriods: string[], pendingPeriods: string[]): string {
  const ticked = new Set(tickedPeriods);
  const pending = new Set(pendingPeriods);
  const startX = 60;
  const startY = 250;
  const cellW = 180;
  const cellH = 70;

  let cells = "";
  for (let w = 1; w <= 5; w++) {
    const x = startX + (w - 1) * (cellW + 16);
    const y = startY;
    const weekStr = `${year}-W${String(w).padStart(2, "0")}`;
    let fill = SLATE_MID;
    let stroke = "none";
    let textColor = "#94A3B8";

    if (ticked.has(weekStr)) { fill = EMERALD; textColor = WHITE; }
    else if (pending.has(weekStr)) { fill = "none"; stroke = AMBER; textColor = AMBER; }

    const check = ticked.has(weekStr) ? " ✓" : "";
    cells += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
<text x="${x + cellW / 2}" y="${y + cellH / 2 + 6}" text-anchor="middle" font-family="Arial" font-size="15" font-weight="600" fill="${textColor}">Week ${w}${check}</text>`;
  }
  return cells;
}

function buildMonthlyGrid(year: number, tickedPeriods: string[], pendingPeriods: string[]): string {
  const ticked = new Set(tickedPeriods);
  const pending = new Set(pendingPeriods);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const startX = 40;
  const startY = 250;
  const cellW = 64;
  const cellH = 60;

  let cells = "";
  for (let m = 1; m <= 12; m++) {
    const col = (m - 1) % 6;
    const row = Math.floor((m - 1) / 6);
    const x = startX + col * (cellW + 10);
    const y = startY + row * (cellH + 10);
    const monthStr = `${year}-M${String(m).padStart(2, "0")}`;
    let fill = SLATE_MID;
    let stroke = "none";
    let textColor = "#94A3B8";

    if (ticked.has(monthStr)) { fill = EMERALD; textColor = WHITE; }
    else if (pending.has(monthStr)) { fill = "none"; stroke = AMBER; textColor = AMBER; }

    cells += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
<text x="${x + cellW / 2}" y="${y + cellH / 2 + 5}" text-anchor="middle" font-family="Arial" font-size="12" font-weight="600" fill="${textColor}">${months[m - 1]}</text>`;
  }
  return cells;
}

function buildGridLines(): string {
  let lines = "";
  for (let x = 0; x < W; x += 40) {
    lines += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${GRID_LINE}" stroke-width="1"/>`;
  }
  for (let y = 0; y < H; y += 40) {
    lines += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${GRID_LINE}" stroke-width="1"/>`;
  }
  return lines;
}

export async function generateSavingsCardImage(
  card: Pick<SavingsCard, "customerName" | "contributionAmount" | "frequency" | "monthlyTarget" | "cycleYear" | "cycleMonth" | "tickedPeriods" | "currentBalance">,
  customerId: string,
  pendingPeriods: string[] = []
): Promise<Buffer> {
  const { customerName, contributionAmount, frequency, monthlyTarget, cycleYear, cycleMonth, tickedPeriods, currentBalance } = card;
  const cardId = customerId.slice(-8).toUpperCase();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthLabel = frequency === "monthly" ? `${cycleYear}` : `${monthNames[cycleMonth - 1]} ${cycleYear}`;
  const freqLabel = frequency === "daily" ? "day" : frequency === "weekly" ? "week" : "month";

  let grid = "";
  if (frequency === "daily") grid = buildDailyGrid(cycleYear, cycleMonth, tickedPeriods, pendingPeriods);
  else if (frequency === "weekly") grid = buildWeeklyGrid(cycleYear, cycleMonth, tickedPeriods, pendingPeriods);
  else grid = buildMonthlyGrid(cycleYear, tickedPeriods, pendingPeriods);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${EMERALD};stop-opacity:0.9"/>
      <stop offset="100%" style="stop-color:#059669;stop-opacity:0.7"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="${NAVY}" rx="20"/>

  <!-- Grid pattern -->
  ${buildGridLines()}

  <!-- Top accent strip -->
  <rect x="0" y="0" width="${W}" height="4" fill="url(#accentGrad)" rx="20"/>

  <!-- App name -->
  <text x="40" y="50" font-family="Arial" font-size="14" font-weight="700" fill="${EMERALD}" letter-spacing="3">SHAKA SAVES</text>

  <!-- SAVINGS CARD label -->
  <text x="${W - 40}" y="50" font-family="Arial" font-size="12" font-weight="600" fill="#475569" text-anchor="end" letter-spacing="2">SAVINGS CARD</text>

  <!-- Divider -->
  <line x1="40" y1="65" x2="${W - 40}" y2="65" stroke="#1E293B" stroke-width="1"/>

  <!-- Customer name -->
  <text x="40" y="105" font-family="Arial" font-size="26" font-weight="700" fill="${WHITE}">${escapeXml(customerName)}</text>

  <!-- Plan info -->
  <text x="40" y="135" font-family="Arial" font-size="14" fill="#94A3B8">${naira(contributionAmount)} / ${freqLabel}  ·  Target: ${naira(monthlyTarget)} / month  ·  ${monthLabel}</text>

  <!-- Period grid -->
  ${grid}

  <!-- Bottom section background -->
  <rect x="0" y="${H - 80}" width="${W}" height="80" fill="${SLATE_DARK}" rx="0"/>
  <rect x="0" y="${H - 80}" width="${W}" height="80" fill="${SLATE_DARK}"/>
  <rect x="0" y="${H - 20}" width="${W}" height="20" fill="url(#accentGrad)"/>

  <!-- Balance -->
  <text x="40" y="${H - 42}" font-family="Courier New" font-size="22" font-weight="700" fill="${EMERALD}">Balance: ${naira(currentBalance)}</text>

  <!-- Card ID -->
  <text x="${W - 40}" y="${H - 42}" font-family="Courier New" font-size="12" fill="#475569" text-anchor="end">ID: ${cardId}</text>
</svg>`;

  const buffer = await sharp(Buffer.from(svg)).png({ quality: 95 }).toBuffer();
  return buffer;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
