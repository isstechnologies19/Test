# WBBL 2026-27 Friends Auction

Live player auction for 10 friend franchises using the 109-player WBBL|12 pool.

## Run locally
1. Install Node.js 18+ (https://nodejs.org)
2. In this folder: `npm install`
3. `npm start`
4. Open http://localhost:3000 (admin panel: /admin)

## Where to change things
- Teams, passwords, purse, limits, bid steps, timer → `config.js`
- Players and base prices → `data/players.js`
- Colours and fonts → `public/css/theme.css`

## Auction night (auctioneer)
1. Open /admin in a separate browser or incognito window.
2. Click a set (Batters, Wicket-Keepers, All-Rounders, Bowlers).
3. Press NEXT to bring up a player, then START to open bidding.
4. Every bid resets the timer. When it hits 0, the player is sold to the highest bidder (or marked unsold).
5. At the end of a set, "Requeue unsold" brings unsold players back for another round.

## Environment variables (for hosting)
PORT, ADMIN_PASSWORD, SESSION_SECRET, MONGO_URL, POINTS_SHEET_ID, POINTS_GID,
APPS_SCRIPT_URL, PASS_TEAM1 … PASS_TEAM10