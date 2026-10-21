#!/bin/bash
FILE="/home/wazuh/ipl-auction/views/dashboard.ejs"

echo "Checking current state..."
grep -c "iplTeam" $FILE && echo "iplTeam already present" || echo "iplTeam NOT found - patching..."

# Check if already patched
if grep -q "iplTeam" $FILE; then
  echo "File already has iplTeam - checking display logic..."
  grep -n "iplTeam\|iplBadge" $FILE
else
  echo "File needs patching"
fi

# Regardless - do a Python patch to ensure correct state
python3 << 'PYEOF'
content = open("/home/wazuh/ipl-auction/views/dashboard.ejs").read()

# Check if old broken version
if 'iplTeamBadge' not in content:
    print("OLD VERSION - needs full patch")
    # Find player card section and patch it
    old = '''      <div class="p-label">Current Player</div>
      <div class="player-wrap">
        <div class="p-avatar" id="pAvatar">🏏</div>
        <div>
          <div class="p-name" id="pName">Waiting for auction...</div>
          <div class="p-tags">
            <span class="tag" id="pRole">—</span>
            <span class="tag" id="pNat" style="display:none">—</span>
            <span class="tag tag-base">Base: <span id="pBase">—</span></span>
          </div>
        </div>
      </div>'''
    new = '''      <div class="p-label">Current Player</div>
      <div style="display:flex;align-items:center;gap:14px">
        <div class="p-avatar" id="pAvatar">🏏</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">
            <div class="p-name" id="pName">Waiting for auction...</div>
            <div id="iplTeamBadge" style="display:none;background:rgba(167,139,250,0.15);border:2px solid #a78bfa;border-radius:10px;padding:4px 14px;text-align:center">
              <div style="font-size:8px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase">IPL</div>
              <div id="pIplTeam" style="font-family:'Rajdhani',sans-serif;font-size:20px;font-weight:700;color:#a78bfa;line-height:1">—</div>
            </div>
          </div>
          <div class="p-tags">
            <span class="tag" id="pRole">—</span>
            <span class="tag" id="pNat" style="display:none">—</span>
            <span class="tag tag-base">Base: <span id="pBase">—</span></span>
          </div>
        </div>
      </div>'''
    if old in content:
        content = content.replace(old, new)
        print("HTML patched")
    else:
        print("HTML pattern not found - manual fix needed")
else:
    print("HTML already patched")

# Fix JS regardless
if 'iplBadge.style.display = "inline-block"' not in content:
    # Remove any old iplTeam JS
    import re
    content = re.sub(r'const iplEl = .*?iplBadge\.style\.display = "none"\n    \}', '', content, flags=re.DOTALL)
    
    # Add after pBase line
    old_js = '    document.getElementById("pBase").textContent = fmt(d.player.base)'
    new_js = '''    document.getElementById("pBase").textContent = fmt(d.player.base)
    var iplEl2 = document.getElementById("pIplTeam")
    var iplBadge2 = document.getElementById("iplTeamBadge")
    if (iplEl2 && iplBadge2) {
      if (d.player.iplTeam && d.player.iplTeam.trim() !== "") {
        iplEl2.textContent = d.player.iplTeam.trim()
        iplBadge2.style.display = "inline-block"
      } else {
        iplBadge2.style.display = "none"
      }
    }'''
    if old_js in content:
        content = content.replace(old_js, new_js, 1)
        print("JS patched")
    else:
        print("JS pattern not found")
else:
    print("JS already patched")

open("/home/wazuh/ipl-auction/views/dashboard.ejs", "w").write(content)
print("File saved")
PYEOF

echo "Restarting pm2..."
pm2 restart ipl-auction
echo "Done! Open browser with Ctrl+Shift+R to hard refresh"
