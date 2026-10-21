// ════════════════════════════════════════════════════════════════
//  WBBL 2026-27 AUCTION POOL — 109 players
//  Row: [ "Name", "Country", "Club code" ]  (optional 4th value = base price in Lakhs)
//  Club codes: ADS BRH HBH MLR MLS PRS SYS SYT  (see config.js)
//  Anyone whose country is not "Australia" counts as Overseas.
// ════════════════════════════════════════════════════════════════
const A = "Australia"

const POOL = {
  "Batters": {
    role: "Batter",
    rows: [
      ["Ellie Johnston", A, "ADS"],
      ["Georgia Voll", A, "SYT"],
      ["Rachel Trenaman", A, "HBH"],
      ["Elsa Hunter", A, "SYS"],
      ["Emma de Broughe", A, "ADS"],
      ["Indigo Noble", A, "MLS"],
      ["Laura Wolvaardt", "South Africa", "ADS"],
      ["Anika Learoyd", A, "SYT"],
      ["Phoebe Litchfield", A, "SYT"],
      ["Bridget Patterson", A, "ADS"],
      ["Courtney Webb", A, "MLR"],
      ["Katie Mack", A, "PRS"],
      ["Annie Wikman", A, "MLR"],
      ["Laura Harris", A, "SYT"],
      ["Danni Wyatt-Hodge", "England", "HBH"],
      ["Heather Knight", "England", "SYT"],
      ["Maia Bouchier", "England", "ADS"],
      ["Rhys McKenna", A, "MLS"],
      ["Maddie Penna", A, "ADS"],
      ["Meg Lanning", A, "MLS"],
      ["Sophia Dunkley", "England", "SYS"],
      ["Olivia Porter", A, "MLR"],
      ["Chloe Piparo", A, "PRS"]
    ]
  },
  "Wicket-Keepers": {
    role: "Wicket-Keeper",
    rows: [
      ["Maddy Darke", A, "SYS"],
      ["Tahlia Wilson", A, "SYT"],
      ["Lizelle Lee", "South Africa", "HBH"],
      ["Beth Mooney", A, "PRS"],
      ["Georgia Redmayne", A, "BRH"],
      ["Sophie Reid", A, "MLR"],
      ["Bonnie Berry", A, "BRH"],
      ["Nicole Faltum", A, "MLR"],
      ["Amy Jones", "England", "MLS"]
    ]
  },
  "All-Rounders": {
    role: "All-Rounder",
    rows: [
      ["Heather Graham", A, "HBH"],
      ["Fatima Sana", "Pakistan", "PRS"],
      ["Georgia Wareham", A, "MLR"],
      ["Dani Gibson", "England", "MLS"],
      ["Charlie Dean", "England", "MLS"],
      ["Tahlia McGrath", A, "ADS"],
      ["Amy Edgar", A, "PRS"],
      ["Hayley Matthews", "West Indies", "MLR"],
      ["Deandra Dottin", "West Indies", "MLR"],
      ["Nicola Carey", A, "HBH"],
      ["Hasrat Gill", A, "SYT"],
      ["Chloe Ainsworth", A, "PRS"],
      ["Maitlan Brown", A, "SYS"],
      ["Chinelle Henry", "West Indies", "HBH"],
      ["Mikayla Wrigley", A, "BRH"],
      ["Alice Capsey", "England", "SYS"],
      ["Lilly Mills", A, "PRS"],
      ["Georgia Prestwidge", A, "MLS"],
      ["Jemma Barsby", A, "SYT"],
      ["Hannah Darlington", A, "SYT"],
      ["Sophie Devine", "New Zealand", "PRS"],
      ["Carly Leeson", A, "MLS"],
      ["Ruth Johnston", A, "HBH"],
      ["Kim Garth", A, "MLS"],
      ["Charli Knott", A, "BRH"],
      ["Erin Burns", A, "SYS"],
      ["Annabel Sutherland", A, "MLS"],
      ["Ellyse Perry", A, "SYS"],
      ["Ashleigh Gardner", A, "SYS"],
      ["Sophie Molineux", A, "MLR"],
      ["Grace Harris", A, "BRH"],
      ["Chloe Tryon", "South Africa", "MLR"],
      ["Amelia Kerr", "New Zealand", "SYS"],
      ["Jess Jonassen", A, "BRH"],
      ["Lucinda Bourke", A, "BRH"],
      ["Orla Prendergast", "Ireland", "BRH"],
      ["Freya Kemp", "England", "PRS"]
    ]
  },
  "Bowlers": {
    role: "Bowler",
    rows: [
      ["Ruby Strange", A, "PRS"],
      ["Megan Schutt", A, "ADS"],
      ["Lucy Hamilton", A, "BRH"],
      ["Hayley Silver-Holmes", A, "HBH"],
      ["Linsey Smith", "England", "HBH"],
      ["Zoe Samuel", A, "MLS"],
      ["Ebony Hoskin", A, "PRS"],
      ["Eleanor Larosa", A, "ADS"],
      ["Sam Bates", A, "SYT"],
      ["Sianna Ginger", A, "BRH"],
      ["Sarah Coyte", A, "SYS"],
      ["Sarah Glenn", "England", "BRH"],
      ["Nicola Hancock", A, "SYT"],
      ["Anesu Mushangwe", "Zimbabwe", "ADS"],
      ["Ella Wilson", A, "ADS"],
      ["Tess Flintoff", A, "MLR"],
      ["Lauren Cheatle", A, "SYS"],
      ["Courtney Sippel", A, "SYS"],
      ["Caoimhe Bray", A, "SYS"],
      ["Mikayla Friday", A, "PRS"],
      ["Sophie Ecclestone", "England", "ADS"],
      ["Ella Hayward", A, "HBH"],
      ["Grace Parsons", A, "BRH"],
      ["Darcie Brown", A, "ADS"],
      ["Amanda-Jade Wellington", A, "ADS"],
      ["Alana King", A, "PRS"],
      ["Lauren Bell", "England", "SYT"],
      ["Maisy Gibson", A, "MLS"],
      ["Molly Strano", A, "HBH"],
      ["Frankie Nicklin", A, "SYS"],
      ["Annie O'Neil", A, "BRH"],
      ["Lucy Finn", A, "SYT"],
      ["Milly Illingworth", A, "MLR"],
      ["Amy Smith", A, "HBH"],
      ["Lauren Smith", A, "HBH"],
      ["Lily Bassingthwaighte", A, "BRH"],
      ["Callie Wilson", A, "HBH"],
      ["Sophie Day", A, "MLS"],
      ["Tayla Vlaeminck", A, "MLR"],
      ["Sara Kennedy", A, "MLR"]
    ]
  }
}

const SET_NAMES = Object.keys(POOL)
const players = []
SET_NAMES.forEach(function (set) {
  POOL[set].rows.forEach(function (r) {
    players.push({
      name: r[0],
      country: r[1],
      club: r[2],
      role: POOL[set].role,
      set: set,
      nationality: r[1] === A ? "Australian" : "Overseas",
      baseLakhs: r[3] || null
    })
  })
})

module.exports = { SET_NAMES: SET_NAMES, players: players }