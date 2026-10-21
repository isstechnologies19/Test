// Shared browser helpers for every page
function $(id) { return document.getElementById(id) }

function fmt(n) {
  n = Number(n) || 0
  if (Math.abs(n) >= 1e7) return "₹" + parseFloat((n / 1e7).toFixed(2)) + " Cr"
  if (Math.abs(n) >= 1e5) return "₹" + parseFloat((n / 1e5).toFixed(1)) + " L"
  return "₹" + n.toLocaleString("en-IN")
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  })
}

function clubBadge(code, full) {
  var c = (window.CLUBS || {})[code]
  if (!c) return '<span class="club-badge">' + esc(code || "—") + '</span>'
  return '<span class="club-badge" style="--cc:' + c.color + '" title="' + esc(c.name) + '">' + esc(full ? c.name : c.short) + '</span>'
}

var ROLE_CLASS = { "Batter": "role-bat", "Bowler": "role-bow", "All-Rounder": "role-alr", "Wicket-Keeper": "role-wk" }
function roleTag(role) { return '<span class="tag ' + (ROLE_CLASS[role] || "") + '">' + esc(role || "—") + '</span>' }

function natTag(p) {
  return p.nationality === "Overseas"
    ? '<span class="tag tag-os">✈ ' + esc(p.country || "Overseas") + '</span>'
    : '<span class="tag tag-local">' + esc(p.country || "Australia") + '</span>'
}

function showToast(msg, type) {
  var t = $("toast")
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t) }
  type = type || "info"
  t.textContent = msg
  t.className = "toast show " + type
  clearTimeout(t._h)
  t._h = setTimeout(function () { t.className = "toast " + type }, 3200)
}

function fetchPoints() {
  return fetch("/api/player-points").then(function (r) { return r.json() })
    .then(function (d) { return d.points || {} }).catch(function () { return {} })
}

function sumPoints(players, points) {
  return (players || []).reduce(function (s, p) {
    var v = points[String(p.name).toLowerCase().trim()]
    return s + (typeof v === "number" ? v : 0)
  }, 0)
}

// Squad table grouped by WBBL club (used by My Squad and All Teams)
function renderSquadTable(players, points) {
  players = players || []
  if (!players.length) return '<div class="empty">No players bought yet</div>'
  var sorted = players.slice().sort(function (a, b) {
    var ca = a.club || "ZZZ", cb = b.club || "ZZZ"
    if (ca !== cb) return ca < cb ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  var html = '<div class="tbl-head"><span>#</span><span>Player</span><span>Role</span><span class="hide-m">Paid</span><span class="r">Points</span></div>'
  var last = null
  sorted.forEach(function (p, i) {
    if (p.club !== last) {
      var c = (window.CLUBS || {})[p.club]
      html += '<div class="group-header" style="--cc:' + (c ? c.color : "#a78bfa") + '">' + clubBadge(p.club) + " " + esc(c ? c.name : (p.club || "No club")) + '</div>'
      last = p.club
    }
    var pts = points[String(p.name).toLowerCase().trim()]
    var has = typeof pts === "number"
    html += '<div class="tbl-row">' +
      '<div class="num">' + (i + 1) + '</div>' +
      '<div><div class="pname">' + esc(p.name) + '</div><div class="psub">' + natTag(p) + '</div></div>' +
      '<div>' + roleTag(p.role) + '</div>' +
      '<div class="hide-m money">' + fmt(p.soldFor) + '</div>' +
      '<div class="r pts ' + (has ? (pts > 0 ? "pos" : pts < 0 ? "neg" : "") : "") + '">' + (has ? pts.toFixed(1) : "—") + '</div>' +
      '</div>'
  })
  return html
}