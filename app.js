// ═══════════════════════════════════════════════════════════════════
//  WBBL 2026-27 FRIENDS AUCTION — SERVER
//  Settings: config.js   •   Player pool: data/players.js
// ═══════════════════════════════════════════════════════════════════
const express = require("express")
const session = require("express-session")
const http = require("http")
const https = require("https")
const fs = require("fs")
const path = require("path")
const { Server } = require("socket.io")

const CONFIG = require("./config")
const { SET_NAMES, players: POOL } = require("./data/players")

const teams = CONFIG.teams
const clubs = CONFIG.clubs
const PORT = process.env.PORT || 3000
const DATA_FILE = path.join(__dirname, "auction_data.json")
const STATE_ID = "wbbl-2026-27"

POOL.forEach(function (p) {
  p.base = p.baseLakhs ? Math.round(p.baseLakhs * 100000) : CONFIG.DEFAULT_BASE_PRICE
})

// Safe-to-share info for browsers (never send passwords)
const publicTeams = {}
Object.keys(teams).forEach(function (id) {
  publicTeams[id] = { name: teams[id].name, short: teams[id].short, color: teams[id].color }
})
const publicConfig = {
  title: CONFIG.TITLE,
  subtitle: CONFIG.SUBTITLE,
  purse: CONFIG.TEAM_PURSE,
  maxPlayers: CONFIG.MAX_PLAYERS,
  maxOverseas: CONFIG.MAX_OVERSEAS,
  bidSteps: CONFIG.BID_STEPS,
  timer: CONFIG.TIMER_SECONDS
}

// ─── APP SETUP ───────────────────────────────────────────────────────
const app = express()
const server = http.createServer(app)
const io = new Server(server)

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "wbbl-2026-friends-auction",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 30, httpOnly: true, sameSite: "lax" }
})

app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"))
app.set("trust proxy", 1)
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))
app.use(sessionMiddleware)
io.engine.use(sessionMiddleware) // lets sockets know which team is logged in

app.use(function (req, res, next) {
  res.locals.config = publicConfig
  res.locals.clubs = clubs
  res.locals.publicTeams = publicTeams
  res.locals.fmt = fmt
  next()
})

// ─── HELPERS ─────────────────────────────────────────────────────────
function fmt(n) {
  n = Number(n) || 0
  if (Math.abs(n) >= 10000000) return "₹" + parseFloat((n / 10000000).toFixed(2)) + " Cr"
  if (Math.abs(n) >= 100000) return "₹" + parseFloat((n / 100000).toFixed(1)) + " L"
  return "₹" + n.toLocaleString("en-IN")
}
function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function key(name) { return String(name || "").toLowerCase().trim() }
function findPoolPlayer(name) { const k = key(name); return POOL.find(function (p) { return key(p.name) === k }) || null }
function findOwner(name) {
  const k = key(name)
  return Object.keys(teamState).find(function (id) {
    return teamState[id].players.some(function (p) { return key(p.name) === k })
  }) || null
}
function recount(ts) { ts.overseas = ts.players.filter(function (p) { return p.nationality === "Overseas" }).length }
function squadEntry(p, amount) {
  return { name: p.name, role: p.role, country: p.country, nationality: p.nationality, club: p.club, soldFor: amount }
}

// ─── STATE ───────────────────────────────────────────────────────────
let teamState = {}
let sets = {}
let soldHistory = []
let tradeNominations = {}
let unsoldNames = []          // unsold players are permanently out of the auction
let currentSet = null
let currentPlayerIndex = -1
let auction = blankAuction()
let timer = 0
let interval = null

function blankAuction() {
  return { status: "waiting", player: null, bid: 0, bidTeam: null, bidTeamName: null, result: null, setName: null, timerMax: CONFIG.TIMER_SECONDS }
}

function initTeamState() {
  teamState = {}
  Object.keys(teams).forEach(function (id) {
    teamState[id] = { name: teams[id].name, short: teams[id].short, color: teams[id].color, purse: CONFIG.TEAM_PURSE, players: [], overseas: 0 }
  })
}

function buildSets() {
  sets = {}
  SET_NAMES.forEach(function (name) {
    sets[name] = shuffle(POOL.filter(function (p) { return p.set === name }).map(function (p) {
      return Object.assign({}, p, { sold: false, unsold: false, soldTo: null, soldFor: null })
    }))
  })
}

// Re-derive sold/unsold flags in the queue from squads + unsold list
function syncSetStatus() {
  const owners = {}
  Object.keys(teamState).forEach(function (id) {
    teamState[id].players.forEach(function (p) { owners[key(p.name)] = { teamId: id, soldFor: p.soldFor } })
  })
  const uns = new Set(unsoldNames.map(key))
  Object.values(sets).forEach(function (list) {
    list.forEach(function (p) {
      const o = owners[key(p.name)]
      p.sold = !!o
      p.soldTo = o ? o.teamId : null
      p.soldFor = o ? o.soldFor : null
      p.unsold = !o && uns.has(key(p.name))
    })
  })
}
function setUnsold(name, flag) {
  unsoldNames = unsoldNames.filter(function (n) { return key(n) !== key(name) })
  if (flag) unsoldNames.push(name)
}

// ─── PERSISTENCE (local file + optional MongoDB) ─────────────────────
let db = null
async function initDb() {
  if (!process.env.MONGO_URL) { console.log("💾 Storage: local file (auction_data.json)"); return }
  try {
    const { MongoClient } = require("mongodb")
    const client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.MONGO_DB || "wbbl_auction").collection("state")
    console.log("💾 Storage: MongoDB + local file")
  } catch (e) {
    console.log("⚠ MongoDB connection failed, using local file only:", e.message)
  }
}
function snapshot() {
  return {
    season: STATE_ID,
    teamState: teamState,
    soldHistory: soldHistory,
    tradeNominations: tradeNominations,
    unsoldNames: unsoldNames,
    savedAt: new Date().toISOString()
  }
}
function saveData() {
  const data = snapshot()
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)) } catch (e) { console.log("File save error:", e.message) }
  if (db) {
    db.replaceOne({ _id: STATE_ID }, Object.assign({ _id: STATE_ID }, data), { upsert: true })
      .catch(function (e) { console.log("DB save error:", e.message) })
  }
}
async function loadData() {
  let data = null
  try { if (db) data = await db.findOne({ _id: STATE_ID }) } catch (e) { console.log("DB load error:", e.message) }
  if (!data && fs.existsSync(DATA_FILE)) {
    try { data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) } catch (e) { console.log("File load error:", e.message) }
  }
  if (data && data.season !== STATE_ID) {
    console.log("⚠ Ignoring saved data from a different season (old IPL file?)")
    data = null
  }
  if (!data) { console.log("🆕 No saved data — starting a fresh auction"); return }
  Object.keys(teamState).forEach(function (id) {
    const s = data.teamState && data.teamState[id]
    if (!s) return
    teamState[id].purse = typeof s.purse === "number" ? s.purse : CONFIG.TEAM_PURSE
    teamState[id].players = s.players || []
    recount(teamState[id])
  })
  soldHistory = data.soldHistory || []
  tradeNominations = data.tradeNominations || {}
  unsoldNames = data.unsoldNames || []
  console.log("✅ Loaded saved auction (" + soldHistory.length + " sales, " + unsoldNames.length + " unsold)")
}

// ─── GOOGLE SHEETS (optional) ────────────────────────────────────────
let appsScriptUrl = CONFIG.APPS_SCRIPT_URL
function callScript(action, data) {
  if (!appsScriptUrl || appsScriptUrl.indexOf("https://") !== 0 || appsScriptUrl.indexOf("PASTE") !== -1) {
    console.log("📄 Sheet sync skipped — APPS_SCRIPT_URL is not set in config.js")
    return
  }
  try {
    const body = JSON.stringify(Object.assign({ action: action, token: CONFIG.SCRIPT_TOKEN }, data || {}))
    const u = new URL(appsScriptUrl)
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, function (res) {
      // Google runs the script, then redirects to the result — follow it to read the reply
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        https.get(res.headers.location, function (r2) { readScriptReply(action, r2) })
          .on("error", function (e) { console.log("📄 Sheet sync error:", e.message) })
      } else readScriptReply(action, res)
    })
    req.on("error", function (e) { console.log("📄 Sheet sync error:", e.message) })
    req.end(body)
  } catch (e) { console.log("📄 Sheet sync error:", e.message) }
}

function readScriptReply(action, res) {
  let txt = ""
  res.setEncoding("utf8")
  res.on("data", function (c) { if (txt.length < 3000) txt += c })
  res.on("end", function () {
    if (txt.indexOf('"ok":true') !== -1) console.log("📄 Sheet sync OK → " + action)
    else console.log("📄 Sheet sync FAILED (" + action + ", HTTP " + res.statusCode + "): " + txt.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 300))
  })
}

function summaryPayload() {
  return {
    teams: Object.keys(teams).map(function (id) {
      const ts = teamState[id]
      return {
        name: teams[id].name, players: ts.players.length, overseas: ts.overseas, purse: ts.purse,
        spent: ts.players.reduce(function (s, p) { return s + (p.soldFor || 0) }, 0),
        squad: ts.players.map(function (p) { return { name: p.name, role: p.role, club: p.club, price: p.soldFor || 0 } })
      }
    })
  }
}

let summaryTimer = null
function syncSummary() {
  clearTimeout(summaryTimer)
  summaryTimer = setTimeout(function () { callScript("updateSummary", summaryPayload()) }, 800)
}

// status: "sold" | "unsold" | "available"
function syncSheet(name, teamId, amount, status) {
  callScript("updatePlayer", { name: name, soldTo: teamId && teams[teamId] ? teams[teamId].name : "", amount: amount || 0, status: status })
  syncSummary()
}

function fetchCSV(sheetId, gid) {
  return new Promise(function (resolve) {
    function get(u, hops) {
      if (hops > 8) return resolve("")
      try {
        const lib = u.indexOf("https") === 0 ? https : http
        lib.get(u, { headers: { "User-Agent": "Mozilla/5.0 (WBBL-Auction)" } }, function (res) {
          if ([301, 302, 303, 307, 308].indexOf(res.statusCode) !== -1 && res.headers.location) {
            res.resume()
            return get(res.headers.location, hops + 1)
          }
          let body = ""
          res.setEncoding("utf8")
          res.on("data", function (c) { body += c })
          res.on("end", function () { resolve(res.statusCode === 200 ? body : "") })
        }).on("error", function () { resolve("") })
      } catch (e) { resolve("") }
    }
    get("https://docs.google.com/spreadsheets/d/" + sheetId + "/export?format=csv&gid=" + gid, 0)
  })
}
function parseCSVRow(row) {
  const out = []
  let cur = "", q = false
  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (ch === '"') { if (q && row[i + 1] === '"') { cur += '"'; i++ } else q = !q }
    else if (ch === "," && !q) { out.push(cur.trim()); cur = "" }
    else cur += ch
  }
  out.push(cur.trim())
  return out
}

let pointsCache = { at: 0, points: {} }
async function getPlayerPoints() {
  const P = CONFIG.POINTS
  if (!P.SHEET_ID || !P.GID) return {}
  if (Date.now() - pointsCache.at < P.CACHE_SECONDS * 1000) return pointsCache.points
  const csv = await fetchCSV(P.SHEET_ID, P.GID)
  if (!csv) return pointsCache.points
  const points = {}
  csv.split("\n").forEach(function (row) {
    const c = parseCSVRow(row)
    const name = (c[P.NAME_COL] || "").trim()
    const val = parseFloat(c[P.POINTS_COL])
    if (!name || isNaN(val) || clubs[name.toUpperCase()]) return
    points[key(name)] = val
  })
  pointsCache = { at: Date.now(), points: points }
  return points
}

// ─── AUCTION ENGINE ──────────────────────────────────────────────────
function clearTimer() { clearInterval(interval); interval = null }

function broadcastAll() {
  io.emit("auctionUpdate", auction)
  io.emit("teamUpdate", teamState)
  io.emit("historyUpdate", soldHistory.slice(-30).reverse())
}

function startTimer(seconds) {
  clearTimer()
  timer = seconds
  auction.status = "running"
  auction.timerMax = seconds
  io.emit("auctionUpdate", auction)
  io.emit("timerUpdate", timer)
  interval = setInterval(function () {
    timer--
    io.emit("timerUpdate", timer)
    if (timer <= 0) { clearTimer(); finishAuction() }
  }, 1000)
}

function finishAuction() {
  const p = auction.player
  if (!p) return
  const queued = sets[auction.setName] && sets[auction.setName][currentPlayerIndex]

  if (auction.bidTeam && teamState[auction.bidTeam]) {
    const ts = teamState[auction.bidTeam]
    ts.purse -= auction.bid
    ts.players.push(squadEntry(p, auction.bid))
    recount(ts)
    setUnsold(p.name, false)
    if (queued) { queued.sold = true; queued.soldTo = auction.bidTeam; queued.soldFor = auction.bid }
    soldHistory.push({
      player: p.name, role: p.role, club: p.club, set: auction.setName,
      team: auction.bidTeam, teamName: teams[auction.bidTeam].name,
      amount: auction.bid, amountStr: fmt(auction.bid), at: new Date().toISOString()
    })
    auction.status = "sold"
    auction.result = { status: "sold", player: p.name, team: auction.bidTeam, teamName: teams[auction.bidTeam].name, bid: auction.bid, bidStr: fmt(auction.bid) }
    syncSheet(p.name, auction.bidTeam, auction.bid, "sold")
  } else {
    setUnsold(p.name, true)
    if (queued) queued.unsold = true
    auction.status = "unsold"
    auction.result = { status: "unsold", player: p.name }
    syncSheet(p.name, null, 0, "unsold")
  }
  broadcastAll()
  io.emit("auctionResult", auction.result)
  saveData()
}

// ─── AUTH HELPERS ────────────────────────────────────────────────────
function requireTeam(req, res, next) {
  if (!req.session.teamId || !teams[req.session.teamId]) return res.redirect("/")
  req.teamId = req.session.teamId
  next()
}
function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) return res.status(403).json({ error: "Unauthorized" })
  next()
}

// ─── PUBLIC & TEAM PAGES ─────────────────────────────────────────────
app.get("/", function (req, res) {
  res.render("index", { teams: publicTeams, poolSize: POOL.length })
})

app.get("/team/:id", function (req, res) {
  const id = req.params.id
  if (!teams[id]) return res.redirect("/")
  res.render("team-login", { team: publicTeams[id], id: id, error: null })
})


app.post("/team/:id", function (req, res) {
  const id = req.params.id
  if (!teams[id]) return res.redirect("/")

  req.session.regenerate(function () {
    req.session.teamId = id
    req.session.isAdmin = false
    req.session.save(function () {
      res.redirect("/dashboard")
    })
  })
})


app.get("/dashboard", requireTeam, function (req, res) {
  res.render("dashboard", { team: publicTeams[req.teamId], teamId: req.teamId })
})

app.get("/myteam", requireTeam, function (req, res) {
  res.render("myteam", { team: publicTeams[req.teamId], teamId: req.teamId, myState: teamState[req.teamId] })
})

app.get("/allteams", requireTeam, function (req, res) {
  res.render("allteams", { team: publicTeams[req.teamId], teamId: req.teamId, allTeamState: teamState })
})

app.get("/trade", requireTeam, function (req, res) {
  res.render("trade", {
    team: publicTeams[req.teamId],
    teamId: req.teamId,
    myPlayers: teamState[req.teamId].players,
    nomination: tradeNominations[req.teamId] || null
  })
})

app.get("/leaderboard", function (req, res) {
  const id = req.session.teamId
  res.render("leaderboard", { team: id && publicTeams[id] ? publicTeams[id] : null, teamId: id || null })
})

app.get("/logout", function (req, res) { req.session.destroy(function () { res.redirect("/") }) })

// ─── TRADES (team side) ──────────────────────────────────────────────
app.post("/trade/nominate", requireTeam, function (req, res) {
  const teamId = req.teamId
  const existing = tradeNominations[teamId]
  if (existing && existing.status === "pending") return res.json({ error: "You already have a pending nomination" })
  const p = teamState[teamId].players.find(function (x) { return key(x.name) === key(req.body.playerName) })
  if (!p) return res.json({ error: "Player not in your squad" })
  tradeNominations[teamId] = {
    teamId: teamId,
    teamName: teams[teamId].name,
    playerName: p.name,
    playerRole: p.role,
    playerClub: p.club,
    pricePaid: p.soldFor,
    askingPrice: String(req.body.askingPrice || "").slice(0, 60) || "Open",
    wantedPlayer: String(req.body.wantedPlayer || "").slice(0, 80),
    notes: String(req.body.notes || "").slice(0, 300),
    status: "pending",
    submittedAt: new Date().toISOString()
  }
  saveData()
  io.emit("tradesUpdate")
  io.emit("systemMessage", "🔄 Trade nomination: " + teams[teamId].name + " offers " + p.name)
  res.json({ success: true })
})

app.post("/trade/cancel", requireTeam, function (req, res) {
  const n = tradeNominations[req.teamId]
  if (n && n.status === "pending") { delete tradeNominations[req.teamId]; saveData(); io.emit("tradesUpdate") }
  res.json({ success: true })
})

// ─── ADMIN ───────────────────────────────────────────────────────────
app.get("/admin", function (req, res) {
  if (!req.session.isAdmin) return res.render("admin-login", { error: null })
  const viewSet = sets[req.query.set] ? req.query.set : (currentSet || SET_NAMES[0])
  const setsInfo = SET_NAMES.map(function (name) {
    const l = sets[name]
    return {
      name: name,
      total: l.length,
      sold: l.filter(function (p) { return p.sold }).length,
      unsold: l.filter(function (p) { return p.unsold }).length,
      remaining: l.filter(function (p) { return !p.sold && !p.unsold }).length
    }
  })
  res.render("admin", {
    teamState: teamState, sets: sets, setsInfo: setsInfo, currentSet: currentSet, viewSet: viewSet,
    currentPlayerIndex: currentPlayerIndex, soldHistory: soldHistory, appsScriptUrl: appsScriptUrl,
    poolList: POOL.map(function (p) { return { name: p.name, role: p.role, country: p.country, club: p.club } })
  })
})

app.post("/admin/login", function (req, res) {
  if ((req.body.password || "") !== CONFIG.ADMIN_PASSWORD) return res.render("admin-login", { error: "Wrong admin password" })
  req.session.regenerate(function () {
    req.session.isAdmin = true
    req.session.save(function () { res.redirect("/admin") })
  })
})

app.get("/admin/logout", function (req, res) { req.session.destroy(function () { res.redirect("/admin") }) })

app.post("/admin/start-set", requireAdmin, function (req, res) {
  const name = req.body.setName
  if (!sets[name]) return res.json({ error: "Invalid set" })
  if (auction.status === "running") return res.json({ error: "Finish the current player first" })
  currentSet = name
  currentPlayerIndex = -1
  io.emit("systemMessage", "🎯 Starting the " + name + " set!")
  res.json({ success: true })
})

app.post("/admin/next-player", requireAdmin, function (req, res) {
  const name = req.body.setName || currentSet
  if (!sets[name]) return res.json({ error: "Select a set first" })
  if (auction.status === "running") return res.json({ error: "Timer is running — pause or let it finish" })
  if (auction.status === "paused" && auction.bidTeam) return res.json({ error: "This player has a live bid — press START to resume or RESTART BID" })
  clearTimer()
  if (name !== currentSet) { currentSet = name; currentPlayerIndex = -1 }
  const list = sets[name]
  let i = currentPlayerIndex + 1
  // Sold AND unsold players are always skipped — unsold never return
  while (i < list.length && (list[i].sold || list[i].unsold)) i++
  if (i >= list.length) {
    io.emit("systemMessage", "✅ All players in " + name + " are done!")
    return res.json({ done: true, setName: name })
  }
  currentPlayerIndex = i
  const p = list[i]
  auction = Object.assign(blankAuction(), { player: p, bid: p.base, setName: name, setIndex: i })
  io.emit("auctionUpdate", auction)
  io.emit("timerUpdate", 0)
  io.emit("systemMessage", "Next up: " + p.name + " (" + p.role + ") — Base " + fmt(p.base))
  res.json({ success: true, player: p.name, role: p.role })
})

app.post("/admin/start-timer", requireAdmin, function (req, res) {
  if (!auction.player) return res.json({ error: "No player selected — press NEXT" })
  if (auction.status === "sold" || auction.status === "unsold") return res.json({ error: "This player is finished — press NEXT" })
  startTimer(CONFIG.TIMER_SECONDS)
  res.json({ success: true })
})

app.post("/admin/pause", requireAdmin, function (req, res) {
  if (auction.status !== "running") return res.json({ error: "Nothing is running" })
  clearTimer()
  auction.status = "paused"
  io.emit("auctionUpdate", auction)
  io.emit("timerUpdate", timer)
  res.json({ success: true })
})

app.post("/admin/mark-unsold", requireAdmin, function (req, res) {
  if (!auction.player || auction.status === "sold" || auction.status === "unsold") return res.json({ error: "No active player" })
  clearTimer()
  const queued = sets[currentSet] && sets[currentSet][currentPlayerIndex]
  if (queued) queued.unsold = true
  setUnsold(auction.player.name, true)
  auction.status = "unsold"
  auction.result = { status: "unsold", player: auction.player.name }
  io.emit("auctionUpdate", auction)
  io.emit("auctionResult", auction.result)
  syncSheet(auction.player.name, null, 0, "unsold")
  saveData()
  res.json({ success: true })
})

app.post("/admin/restart-bid", requireAdmin, function (req, res) {
  if (!auction.player) return res.json({ error: "No player selected" })
  clearTimer()
  Object.assign(auction, { bid: auction.player.base, bidTeam: null, bidTeamName: null, status: "waiting", result: null })
  io.emit("auctionUpdate", auction)
  io.emit("timerUpdate", 0)
  io.emit("systemMessage", "🔄 Bidding restarted for " + auction.player.name)
  res.json({ success: true, player: auction.player.name })
})

app.post("/admin/reshuffle-set", requireAdmin, function (req, res) {
  const name = req.body.setName
  if (!sets[name]) return res.json({ error: "Set not found" })
  if (auction.status === "running") return res.json({ error: "Wait for the timer to finish" })
  sets[name] = shuffle(sets[name])   // unsold flags are kept, so they stay out
  if (name === currentSet) currentPlayerIndex = -1
  res.json({ success: true })
})

app.post("/admin/reset-auction", requireAdmin, function (req, res) {
  clearTimer()
  initTeamState()
  buildSets()
  soldHistory = []
  tradeNominations = {}
  unsoldNames = []
  currentSet = null
  currentPlayerIndex = -1
  auction = blankAuction()
  broadcastAll()
  io.emit("timerUpdate", 0)
  io.emit("tradesUpdate")
  io.emit("systemMessage", "Auction has been reset!")
  callScript("resetAll", {})
  syncSummary()
  saveData()
  res.json({ success: true })
})

app.post("/admin/set-apps-script", requireAdmin, function (req, res) {
  appsScriptUrl = String(req.body.url || "").trim()
  res.json({ success: true })
})

app.post("/admin/manual-correction", requireAdmin, function (req, res) {
  const b = req.body
  const ts = teamState[b.teamId]
  if (!ts) return res.json({ error: "Team not found" })

  if (b.action === "set-purse") {
    const purse = parseInt(b.purse, 10)
    if (isNaN(purse) || purse < 0) return res.json({ error: "Enter a valid purse" })
    ts.purse = purse
  } else if (b.action === "remove-player") {
    const idx = ts.players.findIndex(function (p) { return key(p.name) === key(b.playerName) })
    if (idx === -1) return res.json({ error: "Player not in this team" })
    const p = ts.players.splice(idx, 1)[0]
    ts.purse += p.soldFor || 0
    setUnsold(p.name, false)
    syncSheet(p.name, null, 0, "available")
  } else if (b.action === "add-player") {
    const name = String(b.playerName || "").trim()
    if (!name) return res.json({ error: "Enter a player name" })
    const owner = findOwner(name)
    if (owner) return res.json({ error: name + " already belongs to " + teams[owner].name })
    const amt = Math.max(0, parseInt(b.playerAmt, 10) || 0)
    const pool = findPoolPlayer(name)
    let entry
    if (pool) entry = squadEntry(pool, amt)
    else {
      const country = String(b.playerCountry || "Australia").trim() || "Australia"
      entry = {
        name: name, role: b.playerRole || "Batter", country: country,
        nationality: country.toLowerCase() === "australia" ? "Australian" : "Overseas",
        club: clubs[b.playerClub] ? b.playerClub : "", soldFor: amt
      }
    }
    ts.players.push(entry)
    ts.purse -= amt
    setUnsold(entry.name, false)
    syncSheet(entry.name, b.teamId, amt, "sold")
  } else {
    return res.json({ error: "Unknown action" })
  }

  recount(ts)
  syncSetStatus()
  io.emit("teamUpdate", teamState)
  saveData()
  syncSummary()
  res.json({ success: true })
})

app.post("/admin/trade-player", requireAdmin, function (req, res) {
  const fromTeam = req.body.fromTeam, toTeam = req.body.toTeam
  const from = teamState[fromTeam], to = teamState[toTeam]
  if (!from || !to) return res.json({ error: "Pick both teams" })
  if (fromTeam === toTeam) return res.json({ error: "From and To must be different teams" })
  const idx = from.players.findIndex(function (p) { return key(p.name) === key(req.body.playerName) })
  if (idx === -1) return res.json({ error: "Player not found in " + teams[fromTeam].name })
  const amt = Math.max(0, parseInt(req.body.tradeAmt, 10) || 0)

  const p = from.players.splice(idx, 1)[0]
  from.purse += amt
  to.players.push(Object.assign({}, p, { soldFor: amt }))
  to.purse -= amt
  recount(from); recount(to); syncSetStatus()

  const nom = tradeNominations[fromTeam]
  if (nom && key(nom.playerName) === key(p.name)) {
    nom.status = "approved"
    nom.tradedTo = teams[toTeam].name
    nom.tradeAmount = amt
  }
  saveData()
  syncSheet(p.name, toTeam, amt, "sold")
  io.emit("teamUpdate", teamState)
  io.emit("tradesUpdate")
  io.emit("systemMessage", "🔄 TRADE: " + p.name + " → " + teams[toTeam].name + " for " + fmt(amt))
  res.json({ success: true, player: p.name, to: teams[toTeam].name })
})

app.get("/admin/trade-nominations", requireAdmin, function (req, res) {
  res.json({ nominations: tradeNominations })
})

app.post("/admin/trade-decision", requireAdmin, function (req, res) {
  const n = tradeNominations[req.body.teamId]
  if (!n) return res.json({ error: "Nomination not found" })
  if (req.body.decision === "reject") {
    n.status = "rejected"
    n.reason = String(req.body.reason || "").trim() || "Rejected by admin"
    saveData()
    io.emit("tradesUpdate")
    io.emit("systemMessage", "❌ Trade rejected: " + n.playerName)
  }
  res.json({ success: true })
})

// ─── API ─────────────────────────────────────────────────────────────
app.get("/api/player-points", async function (req, res) {
  try {
    const points = await getPlayerPoints()
    res.json({ points: points, count: Object.keys(points).length })
  } catch (e) { res.json({ points: {}, error: e.message }) }
})

app.get("/api/team-state", function (req, res) {
  const state = {}
  Object.keys(teams).forEach(function (id) {
    state[id] = { name: teams[id].name, purse: teamState[id].purse, players: teamState[id].players, overseas: teamState[id].overseas }
  })
  res.json(state)
})

app.get("/api/leaderboard", async function (req, res) {
  let points = {}
  try { points = await getPlayerPoints() } catch (e) {}
  const hasPoints = Object.keys(points).length > 0
  const rows = Object.keys(teams).map(function (id) {
    const ts = teamState[id]
    const total = ts.players.reduce(function (s, p) { return s + (points[key(p.name)] || 0) }, 0)
    return {
      id: id, name: teams[id].name, short: teams[id].short, color: teams[id].color,
      points: Math.round(total * 100) / 100, purse: ts.purse, playerCount: ts.players.length, overseas: ts.overseas
    }
  }).sort(function (a, b) { return (b.points - a.points) || (b.playerCount - a.playerCount) || (b.purse - a.purse) })
  const top = rows.length ? rows[0].points : 0
  rows.forEach(function (r) { r.gap = Math.round((r.points - top) * 100) / 100 })
  res.json({ teams: rows, hasPoints: hasPoints })
})

// ─── LIVE BIDDING (Socket.io) ────────────────────────────────────────
io.on("connection", function (socket) {
  socket.emit("auctionUpdate", auction)
  socket.emit("teamUpdate", teamState)
  socket.emit("timerUpdate", timer)
  socket.emit("historyUpdate", soldHistory.slice(-30).reverse())

  socket.on("bid", function (data) {
    const sess = socket.request.session
    const teamId = sess && sess.teamId
    const ts = teamId && teamState[teamId]
    if (!ts) return socket.emit("bidError", "Please log in to your team first")
    if (auction.status !== "running" || !auction.player) return socket.emit("bidError", "Bidding is closed right now")
    const amount = parseInt(data && data.amount, 10)
    if (CONFIG.BID_STEPS.indexOf(amount) === -1) return socket.emit("bidError", "Invalid bid amount")
    if (auction.bidTeam === teamId) return socket.emit("bidError", "You already have the highest bid")
    if (ts.players.length >= CONFIG.MAX_PLAYERS) return socket.emit("bidError", "Squad full — max " + CONFIG.MAX_PLAYERS + " players")
    if (CONFIG.MAX_OVERSEAS > 0 && auction.player.nationality === "Overseas" && ts.overseas >= CONFIG.MAX_OVERSEAS) return socket.emit("bidError", "Overseas limit reached (" + CONFIG.MAX_OVERSEAS + ")")
    const newBid = auction.bid + amount
    if (newBid > ts.purse) return socket.emit("bidError", "Not enough purse — you have " + fmt(ts.purse))

    auction.bid = newBid
    auction.bidTeam = teamId
    auction.bidTeamName = teams[teamId].name
    io.emit("newBid", { team: teamId, teamName: teams[teamId].name, amount: newBid, amountStr: fmt(newBid) })
    startTimer(CONFIG.BID_TIMER_SECONDS)
  })
})

// ─── START ───────────────────────────────────────────────────────────
async function boot() {
  initTeamState()
  buildSets()
  await initDb()
  await loadData()
  syncSetStatus()
  server.listen(PORT, function () {
    console.log("🏏 " + CONFIG.TITLE + " Auction running on http://localhost:" + PORT)
    console.log("   " + POOL.length + " players in pool • Admin panel: /admin")
  })
}
boot()
