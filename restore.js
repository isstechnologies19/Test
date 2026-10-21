const https = require("https")
const fs = require("fs")

const SHEET_ID = "1qGSpuWqb-QSyhaDfQMPVIqfz577OGYZ_KvS_KS2Ykak"
const SHEETS = [
  { name: "Batters", gid: "1149144883", role: "Batter" },
  { name: "ALR",     gid: "74297333",   role: "All-Rounder" },
  { name: "WK",      gid: "673132887",  role: "Wicket-Keeper" },
  { name: "Bowlers", gid: "1742307950", role: "Bowler" }
]

const teams = {
  team1:  { name: "Blackcaps",         short: "T1",  color: "#3B82F6" },
  team2:  { name: "Knight Riders",     short: "T2",  color: "#EF4444" },
  team3:  { name: "11 Mates",          short: "T3",  color: "#F59E0B" },
  team4:  { name: "Relangi Mavayya",   short: "T4",  color: "#10B981" },
  team5:  { name: "11 Beasts",         short: "T5",  color: "#8B5CF6" },
  team6:  { name: "IPL ka Baap",       short: "T6",  color: "#F97316" },
  team7:  { name: "Team 7",            short: "T7",  color: "#EC4899" },
  team8:  { name: "Kanyarasi",         short: "T8",  color: "#14B8A6" },
  team9:  { name: "Anasuya Franchise", short: "T9",  color: "#06B6D4" },
  team10: { name: "Vattakay Warriors", short: "T10", color: "#84CC16" }
}

// Build name -> teamId map
const nameToId = {}
Object.keys(teams).forEach(id => nameToId[teams[id].name.toLowerCase()] = id)

function fetchCSV(gid) {
  return new Promise((resolve) => {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`
    function doGet(u, count) {
      if (!count) count = 0
      if (count > 10) return resolve("")
      https.get(u, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if ([301,302,303,307,308].includes(res.statusCode)) {
          res.resume(); return doGet(res.headers.location, count+1)
        }
        let body = ""
        res.on("data", c => body += c)
        res.on("end", () => resolve(body))
      }).on("error", () => resolve(""))
    }
    doGet(url, 0)
  })
}

function parseAmt(s) {
  if (!s) return 0
  s = s.toString().replace("₹","").replace("Rs.","").trim()
  if (s.includes("Cr")) return Math.round(parseFloat(s) * 10000000)
  if (s.includes("L"))  return Math.round(parseFloat(s) * 100000)
  return parseInt(s) || 0
}

async function restore() {
  // Init teamState
  const teamState = {}
  Object.keys(teams).forEach(id => {
    teamState[id] = { name: teams[id].name, short: teams[id].short, color: teams[id].color, purse: 1000000000, players: [], overseas: 0 }
  })

  let totalRestored = 0

  for (const s of SHEETS) {
    console.log(`Fetching ${s.name}...`)
    const csv = await fetchCSV(s.gid)
    if (!csv) { console.log(`  EMPTY!`); continue }
    const rows = csv.trim().split("\n").slice(1)
    for (const row of rows) {
      const cols = row.split(",")
      const c = cols.map(x => (x||"").replace(/^"|"$/g,"").trim())
      const name     = c[1] || ""
      const nat      = c[4] || "Indian"
      const soldTo   = c[6] || ""
      const amtStr   = c[7] || ""
      if (!name || !soldTo || soldTo === "Not Sold" || soldTo === "") continue
      const teamId = nameToId[soldTo.toLowerCase()]
      if (!teamId) { console.log(`  WARNING: Unknown team "${soldTo}" for ${name}`); continue }
      const amt = parseAmt(amtStr)
      teamState[teamId].players.push({ name, role: s.role, nationality: nat, soldFor: amt })
      if (nat === "Overseas") teamState[teamId].overseas++
      teamState[teamId].purse -= amt
      totalRestored++
    }
  }

  // Print summary
  console.log("\n=== RESTORE SUMMARY ===")
  Object.keys(teamState).forEach(id => {
    const t = teamState[id]
    console.log(`${t.name}: ${t.players.length} players, purse left: Rs.${(t.purse/10000000).toFixed(2)} Cr`)
  })
  console.log(`\nTotal players restored: ${totalRestored}`)

  // Save
  const data = { teamState, soldHistory: [], tradeNominations: {}, savedAt: new Date().toISOString() }
  fs.writeFileSync("/home/wazuh/ipl-auction/auction_data.json", JSON.stringify(data, null, 2))
  console.log("\n✅ auction_data.json restored! Now run: pm2 restart ipl-auction")
}

restore()
