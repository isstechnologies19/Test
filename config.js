// ════════════════════════════════════════════════════════════════
//  WBBL 2026-27 FRIENDS AUCTION — SETTINGS
//  Change teams, passwords, purse and rules here.
// ════════════════════════════════════════════════════════════════

const CR = 10000000 // 1 Crore
const L = 100000    // 1 Lakh

// Passwords can be overridden on the host with env vars PASS_TEAM1 … PASS_TEAM10
function pass(id, fallback) { return process.env["PASS_" + id.toUpperCase()] || fallback }

module.exports = {
  TITLE: "WBBL 2026",
  SUBTITLE: "Women's Big Bash League • Friendly Auction",

  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "Strix123",

  // ── Auction rules (109 players ÷ 10 teams ≈ 11 each, 24 overseas in pool) ──
  TEAM_PURSE: 100 * CR,
  MIN_PLAYERS: 10,
  MAX_PLAYERS: 15,
  MAX_OVERSEAS: 0,
  DEFAULT_BASE_PRICE: 20 * L,               // per-player override in data/players.js
  BID_STEPS: [10 * L, 20 * L, 50 * L, 1 * CR],
  TIMER_SECONDS: 10,                        // when auctioneer presses START
  BID_TIMER_SECONDS: 10,                    // timer resets to this after every bid

  // ── Fantasy points (optional, connect later) ──
  // A Google Sheet tab shared as "Anyone with the link can view".
  // NAME_COL / POINTS_COL are 0-based column numbers (B = 1, U = 20).
  POINTS: {
    SHEET_ID: process.env.POINTS_SHEET_ID || "",
    GID: process.env.POINTS_GID || "",
    NAME_COL: 1,
    POINTS_COL: 20,
    CACHE_SECONDS: 60
  },

  // Optional Google Apps Script URL to write sold results back to a sheet
  APPS_SCRIPT_URL: process.env.APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbykK_we6ym_Y0KE1qxnn2X43ru9lc8l5WXZEWcwETUP2d5DtoxQVugqseI28eh1snWu/exec",
  SCRIPT_TOKEN: process.env.SCRIPT_TOKEN || "wbbl-secret-123",
  // ── Your friends' franchises ──
  teams: {
    team1:  { name: "Aunty Aaratam Uncle Poooratam", short: "T1",  color: "#3B82F6", password: pass("team1",  "team1") },
    team2:  { name: "Knight Riders",     short: "T2",  color: "#EF4444", password: pass("team2",  "team2") },
    team3:  { name: "11 Mates",          short: "T3",  color: "#F59E0B", password: pass("team3",  "team3") },
    team4:  { name: "Relangi Mavayya",   short: "T4",  color: "#10B981", password: pass("team4",  "team4") },
    team5:  { name: "11 Beasts",         short: "T5",  color: "#8B5CF6", password: pass("team5",  "team5") },
    team6:  { name: "Vattakay Warriors", short: "T6",  color: "#10B981", password: pass("team6",  "team6") },
    team7:  { name: "Sai Ba",            short: "T7",  color: "#8B5CF6", password: pass("team7",  "team7") }
  },

  // ── The 8 real WBBL clubs (shown as badges on players) ──
  clubs: {
    ADS: { name: "Adelaide Strikers",   short: "ADS", color: "#00A3E0" },
    BRH: { name: "Brisbane Heat",       short: "BRH", color: "#00B5AD" },
    HBH: { name: "Hobart Hurricanes",   short: "HBH", color: "#8E44C9" },
    MLR: { name: "Melbourne Renegades", short: "MLR", color: "#E4002B" },
    MLS: { name: "Melbourne Stars",     short: "MLS", color: "#00A651" },
    PRS: { name: "Perth Scorchers",     short: "PRS", color: "#F58220" },
    SYS: { name: "Sydney Sixers",       short: "SYS", color: "#E5007E" },
    SYT: { name: "Sydney Thunder",      short: "SYT", color: "#9BCB3B" }
  }
}
