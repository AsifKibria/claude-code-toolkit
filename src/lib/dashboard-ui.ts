export function generateDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Claude Code Toolkit</title>
<style>
:root {
  --bg: #0a0e14; --bg2: #12171f; --bg3: #1a2030; --bg4: #222d3d;
  --border: #2a3545; --border-light: #354560;
  --text: #e8edf5; --text2: #a0aec0; --text3: #6b7a90;
  --accent: #60a5fa; --accent2: #3b82f6; --accent-glow: rgba(96,165,250,0.15);
  --green: #34d399; --green-bg: rgba(52,211,153,0.1);
  --yellow: #fbbf24; --yellow-bg: rgba(251,191,36,0.1);
  --red: #f87171; --red-bg: rgba(248,113,113,0.1);
  --orange: #fb923c; --orange-bg: rgba(251,146,60,0.1);
  --purple: #a78bfa; --purple-bg: rgba(167,139,250,0.1);
  --radius: 12px; --radius-sm: 8px;
  --shadow: 0 4px 24px rgba(0,0,0,0.3);
  --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --mono: 'SF Mono', 'Fira Code', 'JetBrains Mono', Consolas, monospace;
  --transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
@media (prefers-color-scheme: light) {
  html:not(.dark) {
    --bg: #f8fafc; --bg2: #ffffff; --bg3: #f1f5f9; --bg4: #e2e8f0;
    --border: #e2e8f0; --border-light: #cbd5e1;
    --text: #0f172a; --text2: #475569; --text3: #6b7280;
    --accent: #3b82f6; --accent2: #2563eb; --accent-glow: rgba(59,130,246,0.08);
    --green: #059669; --green-bg: rgba(5,150,105,0.06);
    --yellow: #d97706; --yellow-bg: rgba(217,119,6,0.06);
    --red: #dc2626; --red-bg: rgba(220,38,38,0.06);
    --orange: #ea580c; --orange-bg: rgba(234,88,12,0.06);
    --purple: #7c3aed; --purple-bg: rgba(124,58,237,0.06);
    --shadow: 0 4px 24px rgba(0,0,0,0.06);
  }
}
html.light {
  --bg: #f8fafc; --bg2: #ffffff; --bg3: #f1f5f9; --bg4: #e2e8f0;
  --border: #e2e8f0; --border-light: #cbd5e1;
  --text: #0f172a; --text2: #475569; --text3: #6b7280;
  --accent: #3b82f6; --accent2: #2563eb; --accent-glow: rgba(59,130,246,0.08);
  --green: #059669; --green-bg: rgba(5,150,105,0.06);
  --yellow: #d97706; --yellow-bg: rgba(217,119,6,0.06);
  --red: #dc2626; --red-bg: rgba(220,38,38,0.06);
  --orange: #ea580c; --orange-bg: rgba(234,88,12,0.06);
  --purple: #7c3aed; --purple-bg: rgba(124,58,237,0.06);
  --shadow: 0 4px 24px rgba(0,0,0,0.06);
}
.theme-btn { display:flex; align-items:center; justify-content:center; width:32px; height:32px; background:var(--bg3); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text2); cursor:pointer; transition:var(--transition); }
.theme-btn:hover { color:var(--accent); border-color:var(--accent); background:var(--accent-glow); }
.theme-btn svg { width:16px; height:16px; }
.theme-btn .sun { display:none; }
.theme-btn .moon { display:block; }
html.light .theme-btn .sun { display:block; }
html.light .theme-btn .moon { display:none; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: var(--font); background: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; }
.header { display: flex; align-items: center; justify-content: space-between; padding: 16px 28px; background: linear-gradient(135deg, var(--bg2) 0%, var(--bg3) 100%); border-bottom: 1px solid var(--border); }
.logo { display: flex; align-items: center; gap: 12px; }
.logo-icon { width: 32px; height: 32px; background: linear-gradient(135deg, var(--accent), var(--purple)); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: #fff; box-shadow: 0 2px 10px rgba(96,165,250,0.25); }
.header-dot { width: 8px; height: 8px; border-radius: 50%; display: none; flex-shrink: 0; }
.header-dot.visible { display: inline-block; }
.logo h1 { font-size: 16px; font-weight: 600; letter-spacing: -0.3px; }
.logo h1 span { color: var(--text3); font-weight: 400; margin-left: 6px; font-size: 12px; }
.header-right { display: flex; align-items: center; gap: 12px; }
.auto-refresh { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text3); }
.auto-refresh label { cursor: pointer; }
.toggle { width: 36px; height: 20px; background: var(--bg4); border-radius: 10px; position: relative; cursor: pointer; transition: var(--transition); border: none; }
.toggle.on { background: var(--accent); }
.toggle::after { content: ''; width: 16px; height: 16px; background: #fff; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: var(--transition); }
.toggle.on::after { left: 18px; }
.refresh-time { font-size: 11px; color: var(--text3); min-width: 100px; text-align: right; }
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg3); color: var(--text); cursor: pointer; font-size: 13px; font-weight: 500; transition: var(--transition); font-family: var(--font); }
.btn:hover { background: var(--bg4); border-color: var(--border-light); }
.btn:active { transform: scale(0.97); }
.btn-primary { background: var(--accent2); color: #fff; border-color: transparent; }
.btn-primary:hover { background: var(--accent); }
.btn-danger { color: var(--red); border-color: rgba(248,113,113,0.3); }
.btn-danger:hover { background: var(--red-bg); }
.btn-success { color: var(--green); border-color: rgba(52,211,153,0.3); }
.btn-success:hover { background: var(--green-bg); }
.btn-warn { color: var(--yellow); border-color: rgba(251,191,36,0.3); }
.btn-warn:hover { background: var(--yellow-bg); }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-icon { padding: 6px 8px; }
.nav { display: flex; gap: 0; background: var(--bg2); border-bottom: 1px solid var(--border); padding: 0 28px; overflow-x: auto; scrollbar-width: none; }
.nav::-webkit-scrollbar { display: none; }
.nav-item { padding: 12px 18px; cursor: pointer; font-size: 13px; font-weight: 500; color: var(--text3); border-bottom: 2px solid transparent; transition: var(--transition); white-space: nowrap; user-select: none; }
.nav-item:hover { color: var(--text2); background: var(--accent-glow); }
.nav-item.active { color: var(--accent); border-bottom-color: var(--accent); }
.nav-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; padding: 0 5px; border-radius: 8px; font-size: 10px; font-weight: 700; margin-left: 6px; line-height: 1; }
.nav-badge-red { background: var(--red); color: #fff; }
.nav-badge-yellow { background: var(--yellow); color: #000; }
.nav-badge-green { background: var(--green); color: #fff; }
.nav-badge-blue { background: var(--accent2); color: #fff; }
.content { padding: 24px 28px; max-width: 1280px; margin: 0 auto; width: 100%; flex: 1; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
.card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition); }
.card:hover { border-color: var(--border-light); transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.card h3 { font-size: 11px; color: var(--text3); font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; }
.card .value { font-size: 32px; font-weight: 700; letter-spacing: -1px; line-height: 1.1; }
.card .sub { font-size: 12px; color: var(--text3); margin-top: 6px; }
.card-glow { border-color: rgba(96,165,250,0.2); box-shadow: 0 0 20px var(--accent-glow); }
.stat-icon { font-size: 20px; line-height: 1; opacity: 0.85; float: right; margin-top: -2px; }
.mt { margin-top: 16px; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
.dot-green { background: var(--green); box-shadow: 0 0 6px var(--green); }
.dot-yellow { background: var(--yellow); box-shadow: 0 0 6px var(--yellow); }
.dot-red { background: var(--red); box-shadow: 0 0 6px var(--red); }
@keyframes dotPulseGreen { 0%,100%{opacity:1} 50%{opacity:0.6} }
@keyframes dotPulseYellow { 0%,100%{opacity:1} 50%{opacity:0.5} }
@keyframes dotPulseRed { 0%,100%{opacity:1} 50%{opacity:0.4} }
.dot-green { animation: dotPulseGreen 2.5s ease-in-out infinite; }
.dot-yellow { animation: dotPulseYellow 1.8s ease-in-out infinite; }
.dot-red { animation: dotPulseRed 1s ease-in-out infinite; }
.c-green { color: var(--green); } .c-yellow { color: var(--yellow); } .c-red { color: var(--red); } .c-orange { color: var(--orange); } .c-accent { color: var(--accent); } .c-purple { color: var(--purple); }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text3); border-bottom: 1px solid var(--border); }
td { padding: 10px 14px; border-bottom: 1px solid var(--border); }
tr:hover td { background: var(--accent-glow); }
th.sort-header { cursor: pointer; user-select: none; transition: var(--transition); }
th.sort-header:hover { color: var(--accent); }
th.sort-header::after { content: ''; display: inline-block; margin-left: 4px; opacity: 0.3; }
th.sort-header.asc::after { content: '\\2191'; opacity: 1; color: var(--accent); }
th.sort-header.desc::after { content: '\\2193'; opacity: 1; color: var(--accent); }
.mono { font-family: var(--mono); font-size: 12px; }
.badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.3px; }
.b-green { background: var(--green-bg); color: var(--green); }
.b-yellow { background: var(--yellow-bg); color: var(--yellow); }
.b-red { background: var(--red-bg); color: var(--red); }
.b-blue { background: var(--accent-glow); color: var(--accent); }
.b-orange { background: var(--orange-bg); color: var(--orange); }
.bars { display: flex; flex-direction: column; gap: 12px; }
.bar-row { display: flex; align-items: center; gap: 12px; }
.bar-label { width: 130px; font-size: 12px; flex-shrink: 0; color: var(--text2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar-track { flex: 1; height: 24px; background: var(--bg); border-radius: 6px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 6px; transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1); min-width: 3px; }
.bar-val { width: 90px; font-size: 12px; text-align: right; color: var(--text3); flex-shrink: 0; font-family: var(--mono); }
.spark { display: flex; align-items: flex-end; gap: 2px; height: 80px; padding: 4px 0; }
.spark-bar { flex: 1; min-width: 4px; border-radius: 3px 3px 0 0; background: var(--accent); opacity: 0.7; transition: opacity 0.15s, height 0.5s cubic-bezier(0.22, 1, 0.36, 1); }
.spark-bar:hover { opacity: 1; }
.spark-tooltip { position: fixed; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 6px 10px; font-size: 12px; pointer-events: none; z-index: 50; box-shadow: var(--shadow); white-space: nowrap; transform: translate(-50%, -100%); margin-top: -8px; }
.spark-tooltip .st-date { color: var(--text3); font-size: 11px; }
.spark-tooltip .st-val { color: var(--accent); font-weight: 600; margin-left: 6px; }
.section { display: none; }
.section.active { display: block; animation: fadeIn 0.25s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes cardIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
.card.stagger { opacity: 0; animation: cardIn 0.35s ease forwards; }
.section h2 { font-size: 20px; font-weight: 700; margin-bottom: 20px; letter-spacing: -0.3px; }
.loading { text-align: center; padding: 80px 20px; color: var(--text3); }
.spinner { display: inline-block; width: 24px; height: 24px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; margin-bottom: 12px; }
@keyframes spin { to { transform: rotate(360deg); } }
.empty { text-align: center; padding: 60px; color: var(--text3); }
.empty-state { text-align: center; padding: 60px 24px; }
.empty-state .es-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.5; }
.empty-state .es-title { font-size: 16px; font-weight: 600; color: var(--text2); margin-bottom: 6px; }
.empty-state .es-sub { font-size: 13px; color: var(--text3); max-width: 400px; margin: 0 auto 16px; line-height: 1.5; }
.clickable-card { cursor: pointer; }
.clickable-card:hover { border-color: var(--accent); box-shadow: 0 8px 25px rgba(96,165,250,0.12); }
.modal-overlay { display: none; position: fixed; inset: 0; background: linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.45) 100%); backdrop-filter: blur(8px) saturate(180%); z-index: 100; align-items: center; justify-content: center; animation: fadeIn 0.15s; }
.modal-overlay.active { display: flex; }
.modal { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 28px; max-width: 680px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05); max-height: 80vh; overflow-y: auto; position: relative; }
.modal h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; padding-right: 32px; }
.modal p { font-size: 14px; color: var(--text2); margin-bottom: 20px; line-height: 1.5; }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
.modal-close { position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--text3); font-size: 20px; cursor: pointer; line-height: 1; padding: 4px 8px; border-radius: var(--radius-sm); transition: var(--transition); }
.modal-close:hover { color: var(--text); background: var(--bg4); }
.modal pre { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px; font-family: var(--mono); font-size: 12px; white-space: pre-wrap; word-break: break-all; max-height: 300px; overflow-y: auto; margin-bottom: 16px; color: var(--text2); }
.toast-container { position: fixed; top: 20px; right: 20px; z-index: 200; display: flex; flex-direction: column; gap: 8px; }
.toast { padding: 12px 20px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; animation: slideIn 0.3s ease; box-shadow: var(--shadow); }
.toast-success { background: var(--green); color: #fff; }
.toast-error { background: var(--red); color: #fff; }
.toast-info { background: var(--accent2); color: #fff; }
@keyframes slideIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
.action-bar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
.detail-panel { background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; margin-top: 16px; animation: fadeIn 0.2s; }
.detail-panel h4 { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.detail-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid var(--border); }
.detail-row:last-child { border-bottom: none; }
.detail-key { color: var(--text3); }
.detail-val { font-weight: 500; }
.tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.tag { padding: 2px 8px; border-radius: 4px; font-size: 11px; background: var(--bg4); color: var(--text2); }
.progress-bar { position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 300; pointer-events: none; opacity: 0; transition: opacity 0.2s; }
.progress-bar.active { opacity: 1; }
.progress-bar .track { height: 100%; background: linear-gradient(90deg, var(--accent), var(--purple)); border-radius: 0 2px 2px 0; animation: progressPulse 2s ease-in-out infinite; width: 30%; }
@keyframes progressPulse { 0%{width:5%;margin-left:0} 50%{width:45%;margin-left:30%} 100%{width:5%;margin-left:95%} }
.action-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.3); backdrop-filter: blur(2px); z-index: 250; align-items: center; justify-content: center; }
.action-overlay.active { display: flex; }
.action-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 32px 40px; text-align: center; box-shadow: var(--shadow); min-width: 300px; animation: fadeIn 0.2s; }
.action-card .spinner { width: 32px; height: 32px; }
.action-card .action-label { font-size: 14px; font-weight: 500; margin-top: 4px; color: var(--text2); }
.result-banner { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 20px; margin-bottom: 20px; animation: fadeIn 0.25s; display: flex; align-items: flex-start; gap: 14px; }
.result-banner.success { border-color: rgba(52,211,153,0.3); background: var(--green-bg); }
.result-banner.error { border-color: rgba(248,113,113,0.3); background: var(--red-bg); }
.result-icon { font-size: 20px; flex-shrink: 0; line-height: 1; margin-top: 2px; }
.result-body { flex: 1; }
.result-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.result-details { font-size: 12px; color: var(--text2); line-height: 1.6; }
.result-details span { display: inline-block; margin-right: 16px; }
.result-close { background: none; border: none; color: var(--text3); cursor: pointer; font-size: 16px; padding: 4px; line-height: 1; }
.health-ring { position: relative; width: 110px; height: 110px; margin: 0 auto 8px; }
.health-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.health-ring circle { fill: none; stroke-width: 8; stroke-linecap: round; }
.health-ring .ring-bg { stroke: var(--bg4); }
.health-ring .ring-fg { transition: stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1); }
.health-ring .score { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; }
.health-ring .score-val { font-size: 26px; font-weight: 800; letter-spacing: -1px; }
.health-ring .score-lbl { font-size: 9px; color: var(--text3); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
.audit-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); margin: 16px 0; overflow-x: auto; }
.audit-tab { padding: 8px 16px; cursor: pointer; font-size: 12px; font-weight: 500; color: var(--text3); border-bottom: 2px solid transparent; transition: var(--transition); white-space: nowrap; }
.audit-tab:hover { color: var(--text2); }
.audit-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.audit-pane { display: none; animation: fadeIn 0.2s; }
.audit-pane.active { display: block; }
.search-bar { margin-bottom: 16px; }
.search-input { width: 100%; max-width: 400px; padding: 8px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg); color: var(--text); font-family: var(--font); font-size: 13px; outline: none; transition: var(--transition); }
.search-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
.search-input::placeholder { color: var(--text3); }
.session-row-active td { background: var(--accent-glow) !important; }
.project-cell { display: flex; flex-direction: column; gap: 2px; }
.project-name { font-weight: 500; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
.project-path { font-size: 11px; color: var(--text3); font-family: var(--mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
.code-editor { width: 100%; min-height: 500px; padding: 16px; font-family: var(--mono); font-size: 13px; line-height: 1.5; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg3); color: var(--text); resize: vertical; tab-size: 2; outline: none; transition: border-color var(--transition); }
.code-editor:focus { border-color: var(--accent); }
.about-hero { text-align: center; padding: 48px 24px 40px; background: linear-gradient(135deg, rgba(96,165,250,0.06) 0%, rgba(167,139,250,0.06) 50%, rgba(52,211,153,0.04) 100%); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 24px; position: relative; overflow: hidden; }
.about-hero::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle at 30% 40%, rgba(96,165,250,0.04) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(167,139,250,0.04) 0%, transparent 50%); pointer-events: none; }
.about-logo { width: 56px; height: 56px; background: linear-gradient(135deg, var(--accent), var(--purple)); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; color: #fff; margin: 0 auto 16px; box-shadow: 0 4px 20px rgba(96,165,250,0.3); position: relative; }
.about-hero h2 { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 8px; background: linear-gradient(135deg, var(--accent), var(--purple)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; position: relative; }
.about-desc { color: var(--text2); font-size: 14px; max-width: 500px; margin: 0 auto; line-height: 1.6; position: relative; }
.about-meta { display: flex; gap: 20px; justify-content: center; margin-top: 16px; font-size: 12px; color: var(--text3); position: relative; }
.about-meta span { display: flex; align-items: center; gap: 4px; }
.feature-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; margin-bottom: 24px; }
.feature-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; transition: transform var(--transition), border-color var(--transition), box-shadow var(--transition); }
.feature-card:hover { transform: translateY(-2px); border-color: var(--border-light); box-shadow: 0 6px 20px rgba(0,0,0,0.08); }
.feature-card .fc-icon { font-size: 22px; margin-bottom: 8px; }
.feature-card h4 { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
.feature-card p { font-size: 12px; color: var(--text3); line-height: 1.5; }
.link-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.link-card { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-sm); transition: var(--transition); cursor: pointer; text-decoration: none; color: var(--text); }
.link-card:hover { border-color: var(--accent); background: var(--accent-glow); transform: translateY(-1px); }
.link-card .lc-icon { font-size: 20px; flex-shrink: 0; }
.link-card .lc-title { font-size: 13px; font-weight: 600; }
.link-card .lc-sub { font-size: 11px; color: var(--text3); }
.footer { padding: 20px 28px; text-align: center; border-top: 1px solid var(--border); }
.footer-inner { max-width: 1280px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--text3); flex-wrap: wrap; gap: 8px; }
.btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.btn { position: relative; overflow: hidden; }
.btn::after { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at var(--x,50%) var(--y,50%), rgba(255,255,255,0.15), transparent 60%); opacity: 0; transition: opacity 0.3s; pointer-events: none; }
.btn:active::after { opacity: 1; }
table tbody tr { transition: all var(--transition); border-left: 3px solid transparent; }
table tbody tr:hover { border-left-color: var(--accent); }
table tbody tr:hover td { background: var(--accent-glow); }
.kbd-help { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(6px); z-index: 150; display: none; align-items: center; justify-content: center; }
.kbd-help.active { display: flex; }
.kbd-help-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px 32px; min-width: 320px; box-shadow: var(--shadow); animation: fadeIn 0.2s; }
.kbd-help-card h3 { font-size: 15px; font-weight: 600; margin-bottom: 16px; }
.kbd-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 13px; }
.kbd-key { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 24px; padding: 0 8px; background: var(--bg4); border: 1px solid var(--border); border-radius: 5px; font-size: 12px; font-weight: 600; font-family: var(--mono); color: var(--text); }
.kbd-desc { color: var(--text2); }
@media (max-width: 768px) {
  .header { padding: 12px 16px; flex-wrap: wrap; gap: 12px; }
  .nav { padding: 0 8px; }
  .nav-item { padding: 10px 12px; font-size: 12px; }
  .content { padding: 16px; }
  .grid { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
  .card { padding: 16px; }
  .card .value { font-size: 26px; }
  .modal { width: 95%; padding: 20px; max-height: 85vh; }
  .btn { min-height: 40px; padding: 8px 14px; }
  table { font-size: 12px; }
  td, th { padding: 8px 10px; }
  .section h2 { font-size: 18px; }
}
@media (max-width: 480px) {
  .grid { grid-template-columns: 1fr; }
  .header-right { width: 100%; justify-content: flex-end; }
  .refresh-time { display: none; }
  .bar-label { width: 90px; }
  .bar-val { width: 70px; }
}
.footer-links { display: flex; gap: 16px; }
.footer-links a { color: var(--text3); text-decoration: none; transition: var(--transition); }
.footer-links a:hover { color: var(--accent); }
</style>
</head>
<body>
<div class="progress-bar" id="progressBar"><div class="track"></div></div>
<div class="action-overlay" id="actionOverlay"><div class="action-card"><div class="spinner"></div><div class="action-label" id="actionLabel">Processing...</div></div></div>
<div class="toast-container" id="toasts"></div>
<div class="modal-overlay" id="settingsModal"><div class="modal">
  <div class="card-header"><h3>Scanner Settings</h3><button class="modal-close" onclick="$('#settingsModal').classList.remove('active')">&#10005;</button></div>
  <p>Configure thresholds for problematic content detection.</p>
  <div style="display:grid;gap:16px;margin-bottom:24px">
    <div>
      <label style="display:block;margin-bottom:6px;font-size:13px;font-weight:500">Min Text Size (chars)</label>
      <input type="number" id="setConfigMinText" class="search-input" placeholder="500000">
      <div style="font-size:11px;color:var(--text3);margin-top:4px">Content larger than this will be flagged/removed. Default: 500000</div>
    </div>
    <div>
      <label style="display:block;margin-bottom:6px;font-size:13px;font-weight:500">Min Base64 Size (chars)</label>
      <input type="number" id="setConfigMinBase64" class="search-input" placeholder="100000">
      <div style="font-size:11px;color:var(--text3);margin-top:4px">Base64 data larger than this will be flagged/removed. Default: 100000</div>
    </div>
  </div>
  <div class="modal-actions">
    <button class="btn" onclick="$('#settingsModal').classList.remove('active')">Cancel</button>
    <button class="btn btn-primary" onclick="saveSettings()">Save Changes</button>
  </div>
</div></div>
<div class="spark-tooltip" id="sparkTip" style="display:none"><span class="st-date" id="stDate"></span><span class="st-val" id="stVal"></span></div>
<div class="header">
  <div class="logo">
    <div class="logo-icon">C</div>
    <span class="header-dot" id="headerDot"></span>
    <h1>Claude Code Toolkit <span>v1.2.0</span></h1>
  </div>
  <div class="header-stats" id="headerStats" style="display:flex;gap:16px;align-items:center;margin-left:24px;padding-left:24px;border-left:1px solid var(--border)">
    <div class="hstat" style="text-align:center" title="Total sessions"><div style="font-size:16px;font-weight:700;color:var(--accent)" id="hsSessions">-</div><div style="font-size:9px;color:var(--text3);text-transform:uppercase">Sessions</div></div>
    <div class="hstat" style="text-align:center" title="Unique projects"><div style="font-size:16px;font-weight:700;color:var(--green)" id="hsProjects">-</div><div style="font-size:9px;color:var(--text3);text-transform:uppercase">Projects</div></div>
    <div class="hstat" style="text-align:center" title="Total storage used"><div style="font-size:16px;font-weight:700;color:var(--yellow)" id="hsStorage">-</div><div style="font-size:9px;color:var(--text3);text-transform:uppercase">Storage</div></div>
    <div class="hstat" style="text-align:center" title="Issues found"><div style="font-size:16px;font-weight:700" id="hsIssues">-</div><div style="font-size:9px;color:var(--text3);text-transform:uppercase">Issues</div></div>
  </div>
  <div class="header-right">
    <div class="search-bar" style="margin:0 16px 0 0;position:relative;display:flex;align-items:center;background:var(--card);border:2px solid var(--accent);border-radius:var(--radius);padding:2px">
      <span style="padding:0 8px;color:var(--accent);font-size:16px">🔍</span>
      <input type="text" id="globalSearch" class="search-input" placeholder="Search all conversations..." style="width:280px;padding:8px 12px;font-size:13px;border:none;background:transparent" onkeyup="if(event.key==='Enter') doGlobalSearch(this.value)">
      <button class="btn" style="margin:2px;padding:6px 12px;font-size:12px" onclick="doGlobalSearch(document.getElementById('globalSearch').value)">Search</button>
    </div>
    <div class="auto-refresh">
      <label>Auto-refresh</label>
      <button class="toggle" id="autoToggle" onclick="toggleAutoRefresh()"></button>
    </div>
    <button class="theme-btn" id="themeBtn" onclick="toggleTheme()" title="Toggle light/dark theme">
      <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    </button>
    <button class="btn" style="margin-right:8px" onclick="showSettings()">Settings</button>
    <span class="refresh-time" id="lastRefresh"></span>
    <button class="btn" onclick="refreshCurrent()">Refresh</button>
  </div>
</div>
<div class="nav" id="nav">
  <div class="nav-item active" data-tab="overview">Overview</div>
  <div class="nav-item" data-tab="search" style="background:var(--accent);color:white;font-weight:600">🔍 Search</div>
  <div class="nav-item" data-tab="storage">Storage</div>
  <div class="nav-item" data-tab="sessions">Sessions</div>
  <div class="nav-item" data-tab="security">Security</div>
  <div class="nav-item" data-tab="traces">Traces</div>
  <div class="nav-item" data-tab="mcp">MCP</div>
  <div class="nav-item" data-tab="logs">Logs</div>
  <div class="nav-item" data-tab="config">Config</div>
  <div class="nav-item" data-tab="analytics">Analytics</div>
  <div class="nav-item" data-tab="backups">Backups</div>
  <div class="nav-item" data-tab="context">Context</div>
  <div class="nav-item" data-tab="maintenance">Maintenance</div>
  <div class="nav-item" data-tab="snapshots">Snapshots</div>
  <div class="nav-item" data-tab="about">About</div>
</div>
<div class="content">
  <div class="section active" id="sec-overview"><div class="loading"><div class="spinner"></div><div>Loading overview...</div></div></div>
  <div class="section" id="sec-storage"><div class="loading"><div class="spinner"></div><div>Loading...</div></div></div>
  <div class="section" id="sec-sessions"><div class="loading"><div class="spinner"></div><div>Loading...</div></div></div>
  <div class="section" id="sec-security"><div class="loading"><div class="spinner"></div><div>Loading...</div></div></div>
  <div class="section" id="sec-traces"><div class="loading"><div class="spinner"></div><div>Loading...</div></div></div>
  <div class="section" id="sec-mcp"><div class="loading"><div class="spinner"></div><div>Loading...</div></div></div>
  <div class="section" id="sec-logs"><div class="loading"><div class="spinner"></div><div>Loading...</div></div></div>
  <div class="section" id="sec-config"><div class="loading"><div class="spinner"></div><div>Loading...</div></div></div>
  <div class="section" id="sec-analytics"><div class="loading"><div class="spinner"></div><div>Loading...</div></div></div>
  <div class="section" id="sec-backups"><div class="loading"><div class="spinner"></div><div>Loading...</div></div></div>
  <div class="section" id="sec-context"><div class="loading"><div class="spinner"></div><div>Loading...</div></div></div>
  <div class="section" id="sec-maintenance"><div class="loading"><div class="spinner"></div><div>Loading...</div></div></div>
  <div class="section" id="sec-snapshots">
    <div class="card-header">
      <h3>Storage Snapshots</h3>
      <button class="btn" onclick="doTakeSnapshot()">+ Take Snapshot</button>
    </div>
    <p>Track storage usage over time. Compare snapshots to see what changed.</p>
    <div class="table-container">
      <table class="data-table">
        <thead><tr><th>Date</th><th>Label</th><th>Total Size</th><th>ID</th><th>Actions</th></tr></thead>
        <tbody id="snapshotTableBody"></tbody>
      </table>
    </div>
  </div>
  <div class="section" id="sec-about"><div class="loading"><div class="spinner"></div><div>Loading...</div></div></div>
  <div class="section" id="sec-search"><div class="loading"><div class="spinner"></div><div>Searching...</div></div></div>
</div>
<div class="footer">
  <div class="footer-inner">
    <span>Claude Code Toolkit v1.2.0 &mdash; MIT License</span>
    <div class="footer-links">
      <a href="https://github.com/asifkibria/claude-code-toolkit" target="_blank">GitHub</a>
      <a href="https://github.com/asifkibria/claude-code-toolkit/issues" target="_blank">Issues</a>
      <a href="https://www.npmjs.com/package/@asifkibria/claude-code-toolkit" target="_blank">npm</a>
    </div>
  </div>
</div>
<div class="modal-overlay" id="modal" onclick="if(event.target===this)closeModal()">
  <div class="modal">
    <button class="modal-close" onclick="closeModal()" aria-label="Close">&times;</button>
    <h3 id="mTitle"></h3>
    <div id="mBodyWrap"><p id="mBody"></p></div>
    <div class="modal-actions">
      <button class="btn" id="mCancel" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="mConfirm">Confirm</button>
    </div>
  </div>
</div>
<div class="kbd-help" id="kbdHelp" onclick="if(event.target===this)this.classList.remove('active')">
  <div class="kbd-help-card">
    <h3>Keyboard Shortcuts</h3>
    <div class="kbd-row"><span class="kbd-desc">Switch tabs</span><span><span class="kbd-key">1</span> &ndash; <span class="kbd-key">0</span></span></div>
    <div class="kbd-row"><span class="kbd-desc">Refresh current tab</span><span class="kbd-key">R</span></div>
    <div class="kbd-row"><span class="kbd-desc">Close modal / overlay</span><span class="kbd-key">Esc</span></div>
    <div class="kbd-row"><span class="kbd-desc">Show this help</span><span class="kbd-key">?</span></div>
    <div style="margin-top:14px;text-align:center;font-size:12px;color:var(--text3)">Press any key to dismiss</div>
  </div>
</div>
<script>
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function esc(s) { if (s == null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtB(b) { if(b<1024)return b+' B'; if(b<1048576)return(b/1024).toFixed(1)+' KB'; if(b<1073741824)return(b/1048576).toFixed(1)+' MB'; return(b/1073741824).toFixed(1)+' GB'; }
function fmtK(n) { if(n>1e6)return(n/1e6).toFixed(1)+'M'; if(n>1e3)return(n/1e3).toFixed(1)+'K'; return String(n); }
function badge(t,c) { return '<span class="badge b-'+c+'">'+esc(t)+'</span>'; }
function set(el,h) { if(typeof el==='string') el=$(el); el.innerHTML=h; }
function ago(d) { const ms=Date.now()-new Date(d).getTime(); const m=Math.floor(ms/60000); if(m<60)return m+'m ago'; const hr=Math.floor(m/60); if(hr<24)return hr+'h ago'; return Math.floor(hr/24)+'d ago'; }

function toast(msg, type) {
  const d = document.createElement('div');
  d.className = 'toast toast-' + (type||'info');
  d.textContent = msg;
  $('#toasts').appendChild(d);
  setTimeout(() => d.remove(), 4000);
}

function emptyState(icon, title, sub, btnText, btnAction) {
  let h='<div class="empty-state"><div class="es-icon">'+icon+'</div><div class="es-title">'+esc(title)+'</div><div class="es-sub">'+esc(sub)+'</div>';
  if(btnText&&btnAction) h+='<button class="btn btn-primary" onclick="'+btnAction+'">'+esc(btnText)+'</button>';
  return h+'</div>';
}
function staggerCards(el) {
  if(typeof el==='string') el=$(el);
  if(!el) return;
  el.querySelectorAll('.card').forEach((c,i)=>{c.classList.add('stagger');c.style.animationDelay=(i*50)+'ms';});
}
function updateNavBadges(data) {
  $$('.nav-item .nav-badge').forEach(b=>b.remove());
  if(!data) return;
  const addBadge=(tab,count,cls)=>{
    if(count<=0) return;
    const el=document.querySelector('.nav-item[data-tab="'+tab+'"]');
    if(!el) return;
    const b=document.createElement('span');
    b.className='nav-badge '+cls;
    b.textContent=count>99?'99+':String(count);
    el.appendChild(b);
  };
  addBadge('security',data.secFindings||0,'nav-badge-red');
  addBadge('sessions',data.corrupted||0,'nav-badge-yellow');
  addBadge('maintenance',data.maintenanceActions||0,'nav-badge-blue');
  addBadge('traces',data.criticalTraces||0,'nav-badge-red');
}

const TOKEN_STORAGE_KEY = 'cct_dashboard_token';

function getStoredToken() {
  try { return localStorage.getItem(TOKEN_STORAGE_KEY) || ''; } catch { return ''; }
}
function setStoredToken(value) {
  try {
    if (value) localStorage.setItem(TOKEN_STORAGE_KEY, value);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch { /* ignore */ }
}

async function promptForToken(message) {
  const token = window.prompt(message || 'Enter dashboard access token');
  if (token && token.trim()) {
    setStoredToken(token.trim());
    return token.trim();
  }
  return null;
}

async function fetchWithAuth(path, options, retry = true) {
  const headers = Object.assign({}, options?.headers || {});
  const token = getStoredToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const response = await fetch(path, { ...(options || {}), headers });
  if (response.status === 401 && retry) {
    const provided = await promptForToken('Dashboard token required');
    if (!provided) throw new Error('Unauthorized');
    headers['Authorization'] = 'Bearer ' + provided;
    return fetchWithAuth(path, { ...(options || {}), headers }, false);
  }
  return response;
}

const cache = {};
async function api(ep) {
  try {
    const r = await fetchWithAuth('/api/'+ep);
    if(!r.ok) throw new Error(r.statusText);
    const d = await r.json();
    cache[ep]=d;
    return d;
  }
  catch(e) { console.error('API:',ep,e); return cache[ep]||null; }
}
async function post(ep, body) {
  try {
    const r = await fetchWithAuth('/api/action/'+ep, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body||{}) });
    if (!r.ok) { console.error('API error:', r.status, r.statusText); return { success: false, error: 'HTTP ' + r.status }; }
    return r.json();
  } catch (e) { console.error('Post error:', e); return { success: false, error: e.message }; }
}

let modalCb = null;
function showModal(title, body, btnText, cb, isHtml) {
  $('#mTitle').textContent = title;
  if(isHtml) { set('#mBodyWrap', body); }
  else { set('#mBodyWrap', '<p id="mBody"></p>'); $('#mBody').textContent = body; }
  const btn = $('#mConfirm');
  btn.textContent = btnText || 'Confirm';
  btn.className = 'btn ' + (/Delete|Wipe|Redact/.test(btnText) ? 'btn-danger' : 'btn-primary');
  modalCb = cb;
  btn.onclick = async () => { const fn = modalCb; closeModal(); if(fn) await fn(); };
  $('#mCancel').style.display = cb ? '' : 'none';
  $('#modal').classList.add('active');
}
function closeModal() { $('#modal').classList.remove('active'); modalCb=null; }

// ===== Exclusion Management (localStorage) =====
const EXCLUSION_KEY = 'cct_trace_exclusions';
const DEFAULT_EXCLUSIONS = [
  { id: 'default-file-history', type: 'category', value: 'file-history', description: 'Preserve file edit history for reverting changes' },
  { id: 'default-conversations', type: 'category', value: 'conversations', description: 'Preserve conversation history' }
];

function loadExclusions() {
  try {
    const raw = localStorage.getItem(EXCLUSION_KEY);
    if (!raw) {
      const config = { version: 1, exclusions: DEFAULT_EXCLUSIONS, lastUpdated: new Date().toISOString() };
      saveExclusions(config);
      return config;
    }
    return JSON.parse(raw);
  } catch { return { version: 1, exclusions: DEFAULT_EXCLUSIONS, lastUpdated: new Date().toISOString() }; }
}

function saveExclusions(config) {
  config.lastUpdated = new Date().toISOString();
  localStorage.setItem(EXCLUSION_KEY, JSON.stringify(config));
}

function addExclusion(type, value, description) {
  const config = loadExclusions();
  config.exclusions.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type, value, description,
    createdAt: new Date().toISOString()
  });
  saveExclusions(config);
}

function removeExclusion(id) {
  const config = loadExclusions();
  config.exclusions = config.exclusions.filter(e => e.id !== id);
  saveExclusions(config);
}

function showExclusionManager() {
  const config = loadExclusions();
  let body = '<div class="detail-panel">';
  body += '<div style="font-size:14px;font-weight:600;margin-bottom:12px">Protected from cleanup/wipe operations:</div>';
  if (config.exclusions.length === 0) {
    body += '<div style="text-align:center;color:var(--text3);padding:20px">No exclusions configured</div>';
  } else {
    body += '<div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm)">';
    config.exclusions.forEach(exc => {
      const typeCol = exc.type === 'category' ? 'var(--blue)' : exc.type === 'project' ? 'var(--green)' : 'var(--orange)';
      body += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--border)">';
      body += '<div><span style="background:'+typeCol+';color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;margin-right:8px">'+esc(exc.type)+'</span>' + esc(exc.value);
      if (exc.description) body += '<span style="color:var(--text3);font-size:11px;margin-left:8px">' + esc(exc.description) + '</span>';
      body += '</div>';
      body += '<button class="btn btn-sm" onclick="removeExclusionAndRefresh(\\''+exc.id+'\\')" style="padding:2px 8px">×</button>';
      body += '</div>';
    });
    body += '</div>';
  }
  body += '<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:16px">';
  body += '<div style="font-size:13px;font-weight:600;margin-bottom:8px">Add Exclusion:</div>';
  body += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
  body += '<select id="excType" class="search-input" style="width:120px"><option value="category">Category</option><option value="project">Project</option><option value="path">Path</option></select>';
  body += '<input type="text" id="excValue" class="search-input" style="flex:1;min-width:200px" placeholder="Value (e.g., file-history, my-project, projects/work/*)">';
  body += '<button class="btn btn-primary btn-sm" onclick="addExclusionFromForm()">Add</button>';
  body += '</div></div></div>';
  showModal('Manage Exclusions', body, 'Done', null, true);
}

function addExclusionFromForm() {
  const type = $('#excType').value;
  const value = $('#excValue').value.trim();
  if (!value) { toast('Please enter a value', 'error'); return; }
  addExclusion(type, value);
  showExclusionManager();
  toast('Exclusion added', 'success');
}

function removeExclusionAndRefresh(id) {
  removeExclusion(id);
  showExclusionManager();
  toast('Exclusion removed', 'info');
}

// ===== Multi-Step Wipe Confirmation =====
let wipeState = { step: 1, preview: null, confirmPhrase: 'WIPE ALL', userInput: '' };

function showWipeStep1() {
  const p = wipeState.preview;
  let body = '<div class="detail-panel">';
  body += '<div style="margin-bottom:16px;font-size:14px;color:var(--text2)">This operation will permanently delete:</div>';
  body += '<div style="max-height:200px;overflow-y:auto;margin-bottom:16px">';
  body += '<table style="width:100%"><tr><th style="text-align:left">Category</th><th>Sensitivity</th><th>Files</th><th>Size</th></tr>';
  (p.byCategory || []).forEach(c => {
    const col = c.sensitivity === 'critical' ? 'var(--red)' : c.sensitivity === 'high' ? 'var(--orange)' : c.sensitivity === 'medium' ? 'var(--yellow)' : 'var(--green)';
    body += '<tr><td>' + esc(c.name) + '</td><td><span style="color:'+col+';font-weight:600">' + c.sensitivity.toUpperCase() + '</span></td><td style="text-align:center">' + c.fileCount + '</td><td style="text-align:right">' + fmtB(c.totalSize) + '</td></tr>';
  });
  body += '</table></div>';
  body += '<div style="font-size:14px;font-weight:600;margin-bottom:8px">Total: ' + p.summary.totalFiles + ' files (' + fmtB(p.summary.totalSize) + ')</div>';
  body += '<div style="font-size:12px;color:var(--text3);margin-bottom:16px">Critical: ' + p.summary.criticalFiles + ' | High: ' + p.summary.highFiles + '</div>';
  if (p.preserved && p.preserved.totalPreserved > 0) {
    body += '<div style="background:var(--green-bg);border:1px solid rgba(34,197,94,0.3);border-radius:var(--radius-sm);padding:12px;margin-bottom:16px">';
    body += '<div style="font-size:12px;font-weight:600;color:var(--green);margin-bottom:8px">✓ Protected by exclusions: ' + p.preserved.totalPreserved + ' files</div>';
    p.preserved.byExclusion.slice(0, 5).forEach(exc => {
      body += '<div style="font-size:11px;color:var(--text2)">• ' + esc(exc.exclusion.type) + ' "' + esc(exc.exclusion.value) + '": ' + exc.matchedFiles + ' files</div>';
    });
    body += '</div>';
  }
  body += '<div style="display:flex;gap:10px;margin-top:16px">';
  body += '<button class="btn btn-sm" onclick="closeModal();showExclusionManager()">Manage Exclusions</button>';
  body += '</div></div>';
  showModal('SECURE WIPE - Step 1 of 3', body, 'Next: Impact Review →', showWipeStep2, true);
}

function showWipeStep2() {
  const p = wipeState.preview;
  let body = '<div class="detail-panel" style="background:rgba(239,68,68,0.05);border-color:rgba(239,68,68,0.2)">';
  body += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;font-size:16px;font-weight:600;color:var(--red)">⚠ IMPACT WARNING</div>';
  body += '<div style="font-size:14px;color:var(--text);line-height:1.8">';
  body += '<p style="margin-bottom:12px"><strong>This action will:</strong></p>';
  body += '<ul style="padding-left:20px;margin-bottom:16px;list-style-type:disc">';
  (p.byCategory || []).filter(c => c.sensitivity === 'critical' || c.sensitivity === 'high').slice(0, 5).forEach(c => {
    body += '<li style="margin-bottom:8px">' + esc(c.impactWarning) + ' <span style="color:var(--text3)">(' + c.fileCount + ' files)</span></li>';
  });
  body += '</ul>';
  body += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;font-size:13px">';
  body += '<strong style="color:var(--red)">⚠ CANNOT BE UNDONE</strong><br>';
  body += 'Files are securely overwritten with zeros before deletion. No recovery is possible.';
  body += '</div></div></div>';
  body += '<div style="margin-top:16px"><button class="btn" onclick="showWipeStep1()">← Back to Preview</button></div>';
  showModal('SECURE WIPE - Step 2 of 3', body, 'Next: Confirm →', showWipeStep3, true);
}

function showWipeStep3() {
  let body = '<div class="detail-panel">';
  body += '<div style="margin-bottom:16px;font-size:14px;font-weight:600;color:var(--red)">⚠ FINAL CONFIRMATION</div>';
  body += '<p style="margin-bottom:12px;font-size:14px">Type "<strong style="color:var(--red)">' + wipeState.confirmPhrase + '</strong>" to confirm:</p>';
  body += '<input type="text" id="wipeConfirmInput" class="search-input" style="width:100%;max-width:100%;margin-bottom:16px" placeholder="Type confirmation phrase..." oninput="updateWipeButton(this.value)">';
  body += '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">';
  body += '<input type="checkbox" id="keepSettingsCheck" checked> Preserve settings.json and CLAUDE.md';
  body += '</label>';
  body += '</div>';
  body += '<div style="margin-top:16px"><button class="btn" onclick="showWipeStep2()">← Back to Impact</button></div>';
  showModal('SECURE WIPE - Step 3 of 3', body, 'Wipe All Traces', executeWipe, true);
  $('#mConfirm').disabled = true;
  $('#mConfirm').style.opacity = '0.5';
}

function updateWipeButton(value) {
  wipeState.userInput = value.toUpperCase().trim();
  const match = wipeState.userInput === wipeState.confirmPhrase;
  $('#mConfirm').disabled = !match;
  $('#mConfirm').style.opacity = match ? '1' : '0.5';
}

async function executeWipe() {
  if (wipeState.userInput !== wipeState.confirmPhrase) return;
  showProgress('Securely wiping all traces...');
  const keepSettings = $('#keepSettingsCheck')?.checked ?? true;
  const exclusions = loadExclusions().exclusions;
  const r = await post('wipe-traces', { confirm: true, keepSettings, exclusions });
  if (r.success) {
    showResult(true, 'Secure Wipe Complete',
      '<span>Files wiped: <strong>' + r.filesWiped + '</strong></span>' +
      '<span>Freed: <strong>' + fmtB(r.bytesFreed) + '</strong></span>' +
      '<span>Categories: ' + (r.categoriesWiped?.join(', ') || 'all') + '</span>' +
      (r.preserved?.length ? '<span class="c-green">Preserved: ' + r.preserved.join(', ') + '</span>' : ''),
      ['traces', 'overview'], r.categoriesWiped);
  } else {
    showResult(false, 'Wipe Failed', '<span>' + esc(r.error || 'Unknown error') + '</span>');
  }
}

let autoTimer = null;
function toggleAutoRefresh() {
  const btn = $('#autoToggle');
  if(autoTimer) { clearInterval(autoTimer); autoTimer=null; btn.classList.remove('on'); }
  else { btn.classList.add('on'); autoTimer=setInterval(refreshCurrent, 30000); }
}

function toggleTheme() {
  const html = document.documentElement;
  html.classList.toggle('light');
  html.classList.toggle('dark');
  const isLight = html.classList.contains('light');
  localStorage.setItem('cct-dashboard-theme', isLight ? 'light' : 'dark');
}

(function initTheme() {
  const saved = localStorage.getItem('cct-dashboard-theme');
  const html = document.documentElement;
  if(saved === 'light') { html.classList.add('light'); html.classList.remove('dark'); }
  else if(saved === 'dark') { html.classList.add('dark'); html.classList.remove('light'); }
})();

let currentTab = 'overview';
const tabOrder=['overview','search','storage','sessions','security','traces','mcp','logs','config','analytics','backups','context','maintenance','snapshots','about'];
$('#nav').addEventListener('click', e => {
  const t = e.target.dataset?.tab; if(!t) return;
  $$('.nav-item').forEach(n=>n.classList.remove('active'));
  e.target.classList.add('active');
  $$('.section').forEach(s=>s.classList.remove('active'));
  $('#sec-'+t).classList.add('active');
  currentTab = t;
  loadTab(t);
  window.scrollTo({top:0,behavior:'smooth'});
});
document.addEventListener('keydown', e => {
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
  const kbdHelp=$('#kbdHelp');
  if(kbdHelp.classList.contains('active')) { kbdHelp.classList.remove('active'); return; }
  if(e.key==='Escape') { closeModal(); hideProgress(); return; }
  if(e.key==='?'&&!e.metaKey&&!e.ctrlKey) { kbdHelp.classList.add('active'); return; }
  if(e.key.toLowerCase()==='r'&&!e.metaKey&&!e.ctrlKey) { refreshCurrent(); return; }
  const num=e.key==='0'?10:parseInt(e.key,10);
  if(num>=1&&num<=11&&!e.metaKey&&!e.ctrlKey&&!e.altKey) { const t=tabOrder[num-1]; if(t) switchTab(t); }
});

const loaded = {};
function loadTab(t) { if(loaded[t]) return; loaded[t]=true; loaders[t]?.(); }
function refreshCurrent() { loaded[currentTab]=false; loadTab(currentTab); }
function refreshTime() { $('#lastRefresh').textContent = new Date().toLocaleTimeString(); }
function esc(s) { return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }

let currentSearchQuery = '';
async function doGlobalSearch(q) {
  if(!q) return;
  currentSearchQuery = q;
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const sec = document.getElementById('sec-search');
  if(sec) sec.classList.add('active');
  loadSearch();
}

async function loadSearchTab() {
  const el = $('#sec-search');
  let h = '<h2>🔍 Search All Conversations</h2>';
  h += '<p style="color:var(--text2);margin-bottom:20px">Search across all your Claude Code conversations to find specific discussions, code snippets, errors, or any text.</p>';
  h += '<div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;align-items:center">';
  h += '<input type="text" id="searchTabInput" class="search-input" placeholder="Enter search term (e.g., API key, function name, error message...)" style="flex:1;min-width:300px;padding:12px 16px;font-size:14px" value="'+esc(currentSearchQuery)+'" onkeyup="if(event.key===\\'Enter\\') doSearchFromTab()">';
  h += '<select id="searchRole" style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text)"><option value="">All roles</option><option value="user">User only</option><option value="assistant">Assistant only</option></select>';
  h += '<input type="number" id="searchLimit" placeholder="Limit" value="50" min="10" max="500" style="width:80px;padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text)">';
  h += '<button class="btn btn-primary" style="padding:12px 24px;font-size:14px" onclick="doSearchFromTab()">🔍 Search</button>';
  h += '</div>';
  h += '<div id="searchResults">';
  if (currentSearchQuery) {
    h += '<div class="loading"><div class="spinner"></div><div>Searching...</div></div>';
  } else {
    h += '<div style="text-align:center;padding:60px;color:var(--text3)">';
    h += '<div style="font-size:64px;margin-bottom:16px">🔍</div>';
    h += '<div style="font-size:18px;font-weight:600;margin-bottom:8px">Start Searching</div>';
    h += '<div>Enter a search term above to find content across all your conversations</div>';
    h += '</div>';
  }
  h += '</div>';
  set(el, h);
  if (currentSearchQuery) { setTimeout(() => doSearchFromTab(), 100); }
}
async function doSearchFromTab() {
  const q = $('#searchTabInput')?.value || '';
  const role = $('#searchRole')?.value || '';
  const limit = $('#searchLimit')?.value || '50';
  if (!q || q.length < 2) { toast('Enter at least 2 characters', 'error'); return; }
  currentSearchQuery = q;
  const resultsEl = $('#searchResults');
  if (resultsEl) resultsEl.innerHTML = '<div class="loading"><div class="spinner"></div><div>Searching for "'+esc(q)+'"...</div></div>';
  try {
    let url = 'search?q='+encodeURIComponent(q)+'&limit='+limit;
    if (role) url += '&role='+role;
    const res = await api(url);
    if (!res || !res.results || res.results.length === 0) {
      resultsEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)"><div style="font-size:48px;margin-bottom:12px">😕</div><div style="font-size:16px">No results found for "'+esc(q)+'"</div><div style="margin-top:8px">Try different keywords or check spelling</div></div>';
      return;
    }
    let h = '<div style="margin-bottom:16px;padding:12px;background:var(--card);border-radius:var(--radius-sm);border-left:4px solid var(--accent)">';
    h += '<strong>'+res.results.length+' results</strong> found for "<em>'+esc(q)+'</em>"';
    h += '</div>';
    const grouped = {};
    res.results.forEach(r => {
      const projectMatch = r.file.match(/projects\\/([^\\/]+)/);
      const project = projectMatch ? projectMatch[1].replace(/-/g, '/') : 'Unknown';
      if (!grouped[project]) grouped[project] = [];
      grouped[project].push(r);
    });
    Object.entries(grouped).forEach(([project, results]) => {
      h += '<div class="card" style="margin-bottom:16px;padding:16px">';
      h += '<div style="font-weight:700;font-size:14px;color:var(--accent);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)">📁 '+esc(project)+' <span style="font-weight:400;color:var(--text3)">('+results.length+' matches)</span></div>';
      results.forEach(r => {
        const fileName = r.file.split('/').pop();
        const roleIcon = r.role === 'user' ? '👤' : r.role === 'assistant' ? '🤖' : '📝';
        h += '<div style="margin-bottom:12px;padding:10px;background:var(--bg);border-radius:var(--radius-sm);border-left:3px solid '+(r.role==='user'?'var(--yellow)':'var(--green)' )+'">';
        h += '<div style="font-size:11px;color:var(--text3);margin-bottom:6px">'+roleIcon+' <strong>'+esc(r.role||'unknown')+'</strong> • '+esc(fileName)+' • Line '+r.line+'</div>';
        h += '<div style="font-family:var(--mono);font-size:12px;color:var(--text);white-space:pre-wrap;word-break:break-word">'+highlightMatch(esc(r.preview), q)+'</div>';
        h += '</div>';
      });
      h += '</div>';
    });
    resultsEl.innerHTML = h;
  } catch(e) {
    resultsEl.innerHTML = '<div style="color:var(--red);padding:20px">Error: '+e.message+'</div>';
  }
}
function highlightMatch(text, query) {
  if (!query) return text;
  const parts = text.split(new RegExp('(' + query + ')', 'i'));
  return parts.map(p => p.toLowerCase() === query.toLowerCase() ? '<mark style="background:var(--yellow);color:var(--bg);padding:1px 3px;border-radius:2px">' + p + '</mark>' : p).join('');
}
async function loadSearch() {
  loadSearchTab();
}

function healthRing(pct, color) {
  const r=47, c=2*Math.PI*r, off=c-(pct/100)*c;
  return '<div class="health-ring"><svg viewBox="0 0 110 110"><circle class="ring-bg" cx="55" cy="55" r="'+r+'"/><circle class="ring-fg" cx="55" cy="55" r="'+r+'" stroke="'+color+'" stroke-dasharray="'+c+'" stroke-dashoffset="'+off+'"/></svg><div class="score"><div class="score-val" style="color:'+color+'">'+pct+'</div><div class="score-lbl">Health</div></div></div>';
}

function sparklineSvg(data,width,height,color) {
  if(!data||data.length<2) return '';
  const max=Math.max(...data.map(d=>d.value));
  const min=0;
  const range=max-min||1;
  const step=width/(data.length-1);
  let path=\`M 0 \${ height - ((data[0].value - min) / range) * height } \`;
  data.forEach((d,i)=>{const x=i*step;const y=height-((d.value-min)/range)*height;path+=\` L \${ x } \${ y } \`;});
  const fillPath=\`\${ path } L \${ width } \${ height } L 0 \${ height } Z\`;
  return \`<svg width="100%" height="\${height}" viewBox="0 0 \${width} \${height}" preserveAspectRatio="none" style="overflow:visible"><defs><linearGradient id="g-\${color.replace(/[^a-z0-9]/gi,'')}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="\${color}" stop-opacity="0.2"/><stop offset="100%" stop-color="\${color}" stop-opacity="0"/></linearGradient></defs><path d="\${fillPath}" fill="url(#g-\${color.replace(/[^a-z0-9]/gi,'')})" stroke="none"/><path d="\${path}" fill="none" stroke="\${color}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>\`;
}


async function loadOverview() {
  const [ov, stor, sess, sec, tr] = await Promise.all([api('overview'), api('storage'), api('sessions'), api('security'), api('traces')]);
  const el = $('#sec-overview');
  if (!ov && !stor) { set(el, emptyState('&#128270;', 'Could not load data', 'Unable to fetch overview. Check that the .claude directory exists.', 'Retry', 'refreshCurrent()')); return; }
  const sz = stor?.totalSize || 0, sc = sess?.length || 0, hc = sess?.filter(s => s.status === 'healthy').length || 0;
  const cc = sess?.filter(s => s.status === 'corrupted').length || 0, sf = sec?.totalFindings || 0;
  const tsz = tr?.totalSize || 0, tf = tr?.totalFiles || 0, ic = ov?.issueCount || 0;
  const crit = tr?.criticalItems || 0;
  const problems = ic + cc + sf;
  const maxProblems = Math.max(sc, 10);
  const healthPct = Math.max(0, Math.min(100, Math.round(100 - (problems / maxProblems) * 100)));
  const hColor = healthPct >= 80 ? 'var(--green)' : healthPct >= 50 ? 'var(--yellow)' : 'var(--red)';
  const hDot = $('#headerDot'); if (hDot) { hDot.style.background = hColor; hDot.style.boxShadow = '0 0 6px ' + hColor; hDot.classList.add('visible'); }
  updateNavBadges({ secFindings: sf, corrupted: cc, maintenanceActions: ov?.maintenanceActions || 0, criticalTraces: crit });
  const sysInfo = ov?.systemInfo;
  const hsSessions = $('#hsSessions'); if (hsSessions) hsSessions.textContent = sc;
  const hsProjects = $('#hsProjects'); if (hsProjects) hsProjects.textContent = sysInfo?.uniqueProjects || new Set(sess?.map(s => s.project) || []).size;
  const hsStorage = $('#hsStorage'); if (hsStorage) hsStorage.textContent = fmtB(sz);
  const hsIssues = $('#hsIssues'); if (hsIssues) { hsIssues.textContent = problems; hsIssues.style.color = problems > 0 ? 'var(--red)' : 'var(--green)'; }

  let h = '<h2>Overview</h2>';
  h += '<div class="action-bar">';
  if (ic > 0) h += '<button class="btn btn-primary" onclick="doFixAll()">Fix All Issues (' + ic + ')</button>';
  h += '<button class="btn" onclick="doCleanPreview()">Clean Directory</button>';
  if (ov?.maintenanceActions > 0) h += '<button class="btn btn-warn" onclick="switchTab(\\'maintenance\\')">Maintenance (' + ov.maintenanceActions + ')</button>';
  h += '</div>';
  h += '<div class="grid">';
  h += '<div class="card card-glow" style="grid-row:span 2;display:flex;flex-direction:column;align-items:center;justify-content:center">' + healthRing(healthPct, hColor) + '<div class="sub" style="margin-top:4px;text-align:center">' + (problems === 0 ? 'All systems healthy' : problems + ' issue(s)') + '</div></div>';
  h += '<div class="card clickable-card" onclick="switchTab(\\'storage\\')"><div class="stat-icon">&#128230;</div><h3>Storage</h3><div class="value">' + fmtB(sz) + '</div><div class="sub">.claude directory</div></div>';
  h += '<div class="card clickable-card" onclick="switchTab(\\'sessions\\')"><div class="stat-icon">&#128172;</div><h3>Sessions</h3><div class="value">' + sc + '</div><div class="sub">' + hc + ' healthy, ' + cc + ' corrupted</div></div>';
  h += '<div class="card clickable-card" onclick="switchTab(\\'security\\')"><div class="stat-icon">&#128274;</div><h3>Secrets</h3><div class="value ' + (sf > 0 ? 'c-red' : 'c-green') + '">' + sf + '</div><div class="sub">in conversation data</div></div>';
  h += '<div class="card clickable-card" onclick="switchTab(\\'traces\\')"><div class="stat-icon">&#128065;</div><h3>Traces</h3><div class="value">' + tf + '</div><div class="sub">' + fmtB(tsz) + ' on disk</div></div>';
  h += '<div class="card clickable-card" onclick="switchTab(\\'backups\\')"><div class="stat-icon">&#128190;</div><h3>Backups</h3><div class="value">' + (ov?.backupCount || 0) + '</div><div class="sub">' + fmtB(ov?.backupSize || 0) + ' total</div></div>';
  h += '<div class="card clickable-card" onclick="switchTab(\\'maintenance\\')"><div class="stat-icon">&#128451;</div><h3>Archive Candidates</h3><div class="value c-accent">' + (ov?.archiveCandidates || 0) + '</div><div class="sub">inactive &gt;30 days</div></div>';
  h += '</div>';
  set(el, h); staggerCards(el); refreshTime();
}

async function loadStorage() {
  const [d, bk] = await Promise.all([api('storage'), api('backups')]);
  const el = $('#sec-storage');
  if (!d) { set(el, emptyState('&#128194;', 'Storage data unavailable', 'Could not analyze .claude directory storage.', 'Retry', 'refreshCurrent()')); return; }
  const mx = Math.max(...d.categories.map(c => c.totalSize), 1);
  const cols = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#fb923c', '#a78bfa', '#38bdf8', '#4ade80'];
  let h = '<h2>Storage</h2>';
  h += '<div class="action-bar"><button class="btn btn-success" onclick="doCleanPreview()">Preview Cleanup</button><button class="btn btn-danger" onclick="doCleanExecute()">Clean Now</button></div>';
  h += '<div class="grid"><div class="card"><div class="stat-icon">&#128194;</div><h3>Total Size</h3><div class="value">' + fmtB(d.totalSize) + '</div></div>';
  const cleanable = d.categories.reduce((s, c) => s + c.cleanableSize, 0);
  h += '<div class="card"><div class="stat-icon">&#9851;</div><h3>Cleanable</h3><div class="value c-green">' + fmtB(cleanable) + '</div><div class="sub">safe to remove</div></div>';
  if (bk) { h += '<div class="card"><div class="stat-icon">&#128190;</div><h3>Backups</h3><div class="value">' + (bk.totalBackups || 0) + '</div><div class="sub">' + fmtB(bk.totalSize || 0) + ' <button class="btn btn-sm btn-danger" onclick="doDeleteBackups()" style="margin-left:8px">Clean</button></div></div>'; }
  h += '</div>';
  h += '<div class="card mt"><h3>By Category</h3><div class="bars">';
  d.categories.filter(c => c.totalSize > 0).sort((a, b) => b.totalSize - a.totalSize).forEach((c, i) => {
    const p = Math.max((c.totalSize / mx) * 100, 2);
    h += '<div class="bar-row"><div class="bar-label">' + esc(c.name) + '</div><div class="bar-track"><div class="bar-fill" style="width:' + p + '%;background:' + cols[i % cols.length] + '"></div></div><div class="bar-val">' + fmtB(c.totalSize) + '</div></div>';
  });
  h += '</div></div>';
  if (d.largestFiles?.length) {
    h += '<div class="card mt"><h3>Largest Files</h3><table><tr><th>Project</th><th>File</th><th>Size</th></tr>';
    d.largestFiles.slice(0, 10).forEach(f => {
      const parts = f.path.split('/');
      const fileName = parts.pop() || '';
      const projPart = parts.find(p => p.startsWith('-')) || '';
      const projPath = projPart.replace(/^-/, '/').replace(/-/g, '/');
      const projParts = projPath.split('/').filter(Boolean);
      const projName = projParts.length >= 2 ? projParts.slice(-2).join('/') : projParts[projParts.length - 1] || 'Unknown';
      h += '<tr><td style="max-width:120px;overflow:hidden;text-overflow:ellipsis" title="' + esc(projPath) + '">' + esc(projName) + '</td><td class="mono" title="' + esc(f.path) + '" style="max-width:200px;overflow:hidden;text-overflow:ellipsis">' + esc(fileName) + '</td><td>' + fmtB(f.size) + '</td></tr>';
    });
    h += '</table></div>';
  }
  if (d.recommendations?.length) { h += '<div class="card mt"><h3>Recommendations</h3>'; d.recommendations.forEach(r => { h += '<div style="padding:6px 0;font-size:13px;color:var(--text2)">' + esc(r) + '</div>'; }); h += '</div>'; }
  set(el, h); staggerCards(el); refreshTime();
}

let allSessions = [];
let sessionSort = { col: 'modified', dir: 'desc' };
function filterSessions(q) {
  const el = $('#sessionTableBody');
  if (!el) return;
  const rows = el.querySelectorAll('tr[data-sid]');
  const lq = q.toLowerCase();
  rows.forEach(r => {
    const txt = (r.getAttribute('data-sid') + ' ' + r.getAttribute('data-proj') + ' ' + r.getAttribute('data-status')).toLowerCase();
    r.style.display = txt.includes(lq) ? '' : 'none';
  });
}
function sortSessions(col) {
  if (sessionSort.col === col) sessionSort.dir = sessionSort.dir === 'asc' ? 'desc' : 'asc';
  else { sessionSort.col = col; sessionSort.dir = 'desc'; }
  renderSessionTable();
}
function statusOrder(s) { return s === 'corrupted' ? 0 : s === 'orphaned' ? 1 : s === 'empty' ? 2 : 3; }
function parseProjectPath(rawPath) {
  if (!rawPath) return { name: 'Unknown', fullPath: '' };
  let fullPath = rawPath;
  if (rawPath.startsWith('-')) {
    fullPath = rawPath.replace(/^-/, '/').replace(/-/g, '/');
  }
  const parts = fullPath.split('/').filter(Boolean);
  const name = parts.length >= 2 ? parts.slice(-2).join('/') : parts[parts.length - 1] || 'Unknown';
  return { name, fullPath };
}
function renderSessionTable() {
  const d = [...allSessions];
  const { col, dir } = sessionSort;
  d.sort((a, b) => {
    let v;
    if (col === 'messages') v = (a.messageCount || 0) - (b.messageCount || 0);
    else if (col === 'size') v = (a.sizeBytes || 0) - (b.sizeBytes || 0);
    else if (col === 'status') v = statusOrder(a.status) - statusOrder(b.status);
    else if (col === 'modified') v = new Date(a.modified || 0).getTime() - new Date(b.modified || 0).getTime();
    else v = 0;
    return dir === 'asc' ? v : -v;
  });
  const sb = s => { if (s === 'healthy') return badge('healthy', 'green'); if (s === 'corrupted') return badge('corrupted', 'red'); if (s === 'empty') return badge('empty', 'yellow'); return badge(s, 'blue'); };
  const sc = (c) => c === col ? (dir === 'asc' ? ' asc' : ' desc') : '';
  let h = '<tr><th>ID</th><th class="sort-header' + sc('status') + '" onclick="sortSessions(\\'status\\')">Status</th><th class="sort-header' + sc('messages') + '" onclick="sortSessions(\\'messages\\')">Messages</th><th class="sort-header' + sc('size') + '" onclick="sortSessions(\\'size\\')">Size</th><th style="min-width:200px">Project</th><th class="sort-header' + sc('modified') + '" onclick="sortSessions(\\'modified\\')">Last Active</th><th>Actions</th></tr>';
  h += '<tbody id="sessionTableBody">';
  d.slice(0, 100).forEach(s => {
    const sid = esc(s.id.slice(0, 12));
    const proj = parseProjectPath(s.projectPath || s.project);
    const projDisplay = '<div class="project-cell" style="max-width:280px"><span class="project-name" style="font-weight:600;color:var(--accent)">' + esc(proj.name) + '</span>' + (proj.fullPath ? '<span class="project-path" style="display:block;font-size:10px;color:var(--text3);word-break:break-all;margin-top:2px" title="' + esc(proj.fullPath) + '">' + esc(proj.fullPath) + '</span>' : '') + '</div>';
    let acts = '';
    if (s.status === 'corrupted') acts += '<button class="btn btn-sm btn-danger" onclick="doRepair(\\''+esc(s.id)+'\\')">Repair</button> ';
    acts += '<button class="btn btn-sm" onclick="doExtract(\\''+esc(s.id)+'\\')">Extract</button> ';
    acts += '<button class="btn btn-sm btn-primary" onclick="doAudit(\\''+esc(s.id)+'\\')">Audit</button>';
    h += '<tr data-sid="' + esc(s.id) + '" data-proj="' + esc(s.project || '') + '" data-status="' + esc(s.status) + '"><td class="mono">' + sid + '</td><td>' + sb(s.status) + '</td><td>' + s.messageCount + '</td><td>' + fmtB(s.sizeBytes) + '</td><td>' + projDisplay + '</td><td>' + ago(s.modified) + '</td><td>' + acts + '</td></tr>';
  });
  if (d.length > 100) h += '<tr><td colspan="7" style="text-align:center;color:var(--text3)">...and ' + (d.length - 100) + ' more</td></tr>';
  h += '</tbody>';
  const tbl = $('#sessionTable'); if (tbl) set(tbl, h);
}
async function loadSessions() {
  const d = await api('sessions');
  const el = $('#sec-sessions');
  if (!d || !d.length) { set(el, emptyState('&#128172;', 'No sessions found', 'No Claude Code session files were found in the .claude directory.', 'Refresh', 'refreshCurrent()')); return; }
  allSessions = d;
  const sm = { healthy: 0, corrupted: 0, empty: 0, orphaned: 0 }; d.forEach(s => { sm[s.status] = (sm[s.status] || 0) + 1; });
  let h = '<h2>Sessions (' + d.length + ')</h2>';
  h += '<div class="grid"><div class="card"><div class="stat-icon">&#9989;</div><h3>Healthy</h3><div class="value c-green">' + sm.healthy + '</div></div>';
  h += '<div class="card"><div class="stat-icon">&#9888;</div><h3>Corrupted</h3><div class="value c-red">' + sm.corrupted + '</div></div>';
  h += '<div class="card"><div class="stat-icon">&#128196;</div><h3>Empty</h3><div class="value c-yellow">' + sm.empty + '</div></div>';
  h += '<div class="card"><div class="stat-icon">&#128279;</div><h3>Orphaned</h3><div class="value c-orange">' + sm.orphaned + '</div></div></div>';
  h += '<div class="search-bar"><input type="text" class="search-input" placeholder="Search sessions by ID, project, or status..." oninput="filterSessions(this.value)"></div>';
  h += '<div class="card mt"><table id="sessionTable"></table></div>';
  h += '<div id="sessionDetail"></div>';
  set(el, h); staggerCards(el); renderSessionTable(); refreshTime();
}

async function loadSecurity() {
  const [d, comp, pii] = await Promise.all([api('security'), api('compliance'), api('pii')]);
  const el = $('#sec-security');
  if (!d) { set(el, emptyState('&#128274;', 'Security scan unavailable', 'Could not scan for secrets.', 'Retry', 'refreshCurrent()')); return; }
  let h = '<h2>Security Scan</h2>';
  h += '<div class="action-bar">';
  if (d.totalFindings > 0) h += '<button class="btn btn-danger" onclick="doRedactAll()">Redact All Secrets (' + d.totalFindings + ')</button>';
  h += '</div>';
  h += '<div class="grid"><div class="card"><div class="stat-icon">&#128269;</div><h3>Files Scanned</h3><div class="value">' + d.filesScanned + '</div></div>';
  h += '<div class="card"><div class="stat-icon">&#128680;</div><h3>Findings</h3><div class="value ' + (d.totalFindings > 0 ? 'c-red' : 'c-green') + '">' + d.totalFindings + '</div></div>';
  if (comp) {
    h += '<div class="card"><div class="stat-icon">&#128172;</div><h3>Sessions</h3><div class="value c-accent">' + comp.sessionCount + '</div><div class="sub">' + fmtB(comp.totalSessionSize || 0) + ' total</div></div>';
    h += '<div class="card"><div class="stat-icon">&#128197;</div><h3>Oldest</h3><div class="value">' + (comp.oldestDays || 0) + 'd</div><div class="sub">Newest: ' + (comp.newestDays || 0) + 'd ago</div></div>';
  }
  h += '</div>';
  if (d.totalFindings > 0 && d.summary) {
    h += '<div class="card mt"><h3>By Type</h3><table><tr><th>Type</th><th>Count</th></tr>';
    Object.entries(d.summary).forEach(([t, c]) => { h += '<tr><td>' + esc(t) + '</td><td>' + c + '</td></tr>'; });
    h += '</table></div>';
  }
  if (d.findings?.length) {
    h += '<div class="card mt"><h3>Details</h3><table><tr><th>Severity</th><th>Pattern</th><th>Preview</th><th>Location</th><th>Actions</th></tr>';
    d.findings.slice(0, 100).forEach(f => {
      const sb = f.severity === 'critical' ? badge('critical', 'red') : f.severity === 'high' ? badge('high', 'orange') : badge('medium', 'yellow');
      const fp = esc(f.file); const ln = f.line;
      h += '<tr><td>' + sb + '</td><td>' + esc(f.pattern) + '</td><td class="mono">' + esc(f.maskedPreview) + '</td><td class="mono">' + esc(f.file.split('/').pop()) + ':' + ln + '</td>';
      h += '<td><button class="btn btn-sm" onclick="doPreviewFinding(\\''+fp+'\\',' + ln + ')">Preview</button> ';
      h += '<button class="btn btn-sm btn-danger" onclick="doRedact(\\''+fp+'\\',' + ln + ',\\''+esc(f.type||'')+'\\')">Redact</button></td></tr>';
    });
    h += '</table></div>';
  }
  if (comp) {
    h += '<div class="card mt"><h3>Compliance &amp; Retention Report</h3>';
    h += '<div class="detail-row"><span class="detail-key">Generated</span><span class="detail-val">' + esc(new Date(comp.generatedAt).toLocaleString()) + '</span></div>';
    h += '<div class="detail-row"><span class="detail-key">Total Sessions</span><span class="detail-val">' + comp.sessionCount + '</span></div>';
    h += '<div class="detail-row"><span class="detail-key">Total Session Storage</span><span class="detail-val">' + fmtB(comp.totalSessionSize || 0) + '</span></div>';
    h += '<div class="detail-row"><span class="detail-key">Oldest Session</span><span class="detail-val">' + (comp.oldestDays || 0) + ' days ago</span></div>';
    h += '<div class="detail-row"><span class="detail-key">Newest Session</span><span class="detail-val">' + (comp.newestDays || 0) + ' days ago</span></div>';
    h += '<div class="detail-row"><span class="detail-key">Status</span><span class="detail-val">' + esc(comp.retentionStatus || 'N/A') + '</span></div>';
    if (comp.ageBrackets) {
      const ab = comp.ageBrackets;
      h += '<div style="margin-top:16px"><h4 style="font-size:13px;font-weight:600;margin-bottom:10px">Session Age Distribution</h4>';
      h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">';
      h += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;text-align:center"><div style="font-size:11px;color:var(--text3);text-transform:uppercase;font-weight:600">Last 7d</div><div style="font-size:20px;font-weight:700;color:var(--green);margin-top:4px">' + (ab.week || 0) + '</div></div>';
      h += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;text-align:center"><div style="font-size:11px;color:var(--text3);text-transform:uppercase;font-weight:600">8-30d</div><div style="font-size:20px;font-weight:700;color:var(--accent);margin-top:4px">' + (ab.month || 0) + '</div></div>';
      h += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;text-align:center"><div style="font-size:11px;color:var(--text3);text-transform:uppercase;font-weight:600">31-90d</div><div style="font-size:20px;font-weight:700;color:var(--yellow);margin-top:4px">' + (ab.quarter || 0) + '</div></div>';
      h += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;text-align:center"><div style="font-size:11px;color:var(--text3);text-transform:uppercase;font-weight:600">90d+</div><div style="font-size:20px;font-weight:700;color:var(--red);margin-top:4px">' + (ab.older || 0) + '</div></div>';
      h += '</div></div>';
    }
    if (comp.secretsScan) {
      const ss = comp.secretsScan;
      h += '<div style="margin-top:16px"><div class="detail-row"><span class="detail-key">Files Scanned for Secrets</span><span class="detail-val">' + ss.filesScanned + '</span></div>';
      h += '<div class="detail-row"><span class="detail-key">Secret Findings</span><span class="detail-val ' + (ss.totalFindings > 0 ? 'c-red' : 'c-green') + '">' + (ss.totalFindings || 0) + '</span></div></div>';
    }
    h += '</div>';
  }
  if (pii) {
    h += '<div class="card mt"><h3>&#128100; PII Scan (Personal Identifiable Information)</h3>';
    h += '<p style="color:var(--text3);font-size:12px;margin:8px 0">Showing exact values and full file paths for all detected PII.</p>';
    if (pii.totalFindings > 0) {
      h += '<div class="action-bar" style="margin-top:12px">';
      h += '<button class="btn btn-danger" onclick="doRedactAllPII()">Redact All PII (' + pii.totalFindings + ')</button>';
      h += '</div>';
    }
    h += '<div class="grid" style="margin-top:12px">';
    h += '<div class="card"><div class="stat-icon">&#128269;</div><h4>Files Scanned</h4><div class="value">' + pii.filesScanned + '</div></div>';
    h += '<div class="card"><div class="stat-icon">&#128680;</div><h4>Total Findings</h4><div class="value ' + (pii.totalFindings > 0 ? 'c-orange' : 'c-green') + '">' + pii.totalFindings + '</div></div>';
    const highCount = pii.bySensitivity?.high || 0;
    const medCount = pii.bySensitivity?.medium || 0;
    const lowCount = pii.bySensitivity?.low || 0;
    h += '<div class="card"><div class="stat-icon">&#128308;</div><h4>High Severity</h4><div class="value ' + (highCount > 0 ? 'c-red' : 'c-green') + '">' + highCount + '</div></div>';
    h += '<div class="card"><div class="stat-icon">&#128993;</div><h4>Medium</h4><div class="value ' + (medCount > 0 ? 'c-orange' : 'c-green') + '">' + medCount + '</div></div>';
    h += '</div>';
    if (pii.byCategory && Object.keys(pii.byCategory).length > 0) {
      h += '<div style="margin-top:16px"><h4 style="font-size:13px;font-weight:600;margin-bottom:10px">By Category</h4>';
      h += '<table><tr><th>Category</th><th>Count</th></tr>';
      Object.entries(pii.byCategory).forEach(([cat, cnt]) => { h += '<tr><td>' + esc(cat) + '</td><td>' + cnt + '</td></tr>'; });
      h += '</table></div>';
    }
    if (pii.findings?.length) {
      const showing = pii.findings.length;
      const total = pii.totalFindings;
      h += '<div style="margin-top:16px"><h4 style="font-size:13px;font-weight:600;margin-bottom:10px">Findings (showing ' + showing + ' of ' + total + ')</h4>';
      h += '<div id="pii-findings-container">';
      h += renderPIITable(pii.findings, true);
      h += '</div>';
      if (pii.hasMore) {
        h += '<div style="margin-top:12px;display:flex;gap:8px">';
        h += '<button class="btn" onclick="loadMorePII(100)">Load 100 More</button>';
        h += '<button class="btn" onclick="loadMorePII(' + total + ')">Load All (' + total + ')</button>';
        h += '</div>';
      }
    }
    h += '</div>';
    window._piiState = { offset: pii.findings?.length || 0, total: pii.totalFindings };
  }
  set(el, h); staggerCards(el); refreshTime();
}

async function loadTraces() {
  const d = await api('traces');
  const el = $('#sec-traces');
  if (!d) { set(el, emptyState('&#128065;', 'Trace data unavailable', 'Could not inventory trace files.', 'Retry', 'refreshCurrent()')); return; }
  const mx = Math.max(...d.categories.map(c => c.totalSize), 1);
  const sc = { critical: 'var(--red)', high: 'var(--orange)', medium: 'var(--yellow)', low: 'var(--green)' };
  const sb = { critical: badge('critical', 'red'), high: badge('high', 'orange'), medium: badge('medium', 'yellow'), low: badge('low', 'green') };
  const exclusions = loadExclusions();
  let h = '<h2>Trace Inventory</h2>';
  h += '<div class="action-bar">';
  h += '<button class="btn btn-success" onclick="doCleanTracesPreview()">Preview Cleanup</button>';
  h += '<button class="btn btn-danger" onclick="doCleanTracesExecute()">Clean Traces</button>';
  h += '<button class="btn" onclick="showExclusionManager()" style="margin-left:8px" title="Manage protected files/categories">Exclusions (' + exclusions.exclusions.length + ')</button>';
  h += '<button class="btn btn-danger" onclick="doWipeTraces()" style="margin-left:auto">Secure Wipe All</button>';
  h += '</div>';
  h += '<div class="grid"><div class="card"><div class="stat-icon">&#128196;</div><h3>Total Files</h3><div class="value">' + d.totalFiles + '</div></div>';
  h += '<div class="card"><div class="stat-icon">&#128230;</div><h3>Total Size</h3><div class="value">' + fmtB(d.totalSize) + '</div></div>';
  h += '<div class="card"><div class="stat-icon">&#128308;</div><h3>Critical</h3><div class="value ' + (d.criticalItems > 0 ? 'c-red' : 'c-green') + '">' + d.criticalItems + '</div></div>';
  h += '<div class="card"><div class="stat-icon">&#128992;</div><h3>High</h3><div class="value ' + (d.highItems > 0 ? 'c-orange' : 'c-green') + '">' + d.highItems + '</div></div></div>';
  window._traceCategories = d.categories;
  h += '<div class="card mt"><h3>Category Details</h3>';
  h += '<table><tr><th>Category</th><th>Sensitivity</th><th>Files</th><th>Size</th><th>Age Range</th><th>Sample Files</th><th></th></tr>';
  d.categories.filter(c => c.fileCount > 0).sort((a, b) => b.totalSize - a.totalSize).forEach((c, idx) => {
    const oldest = c.oldestFile ? ago(c.oldestFile) : '-';
    const newest = c.newestFile ? ago(c.newestFile) : '-';
    const ageRange = oldest === newest ? oldest : newest + ' - ' + oldest;
    let samples = '-';
    if (c.sampleFiles?.length) {
      samples = '<div style="font-size:10px;line-height:1.4">';
      c.sampleFiles.slice(0, 3).forEach(f => {
        samples += '<div title="' + esc(f.fullPath) + '" style="color:var(--text2)">' + esc(f.projectName || f.path) + ' <span style="color:var(--text3)">(' + fmtB(f.size) + ')</span></div>';
      });
      if (c.fileCount > 3) samples += '<div style="color:var(--text3)">+' + (c.fileCount - 3) + ' more</div>';
      samples += '</div>';
    }
    h += '<tr>';
    h += '<td title="' + esc(c.description || '') + '"><strong>' + esc(c.name) + '</strong></td>';
    h += '<td>' + (sb[c.sensitivity] || c.sensitivity) + '</td>';
    h += '<td>' + c.fileCount + '</td>';
    h += '<td>' + fmtB(c.totalSize) + '</td>';
    h += '<td style="font-size:11px;color:var(--text3)">' + ageRange + '</td>';
    h += '<td>' + samples + '</td>';
    h += '<td><button class="btn btn-sm" onclick="showTraceCategoryFiles(\\'' + esc(c.name) + '\\')">View All</button></td>';
    h += '</tr>';
  });
  h += '</table></div>';
  h += '<div class="card mt"><h3>Size Distribution</h3><div class="bars">';
  d.categories.filter(c => c.fileCount > 0).sort((a, b) => b.totalSize - a.totalSize).forEach(c => {
    const p = Math.max((c.totalSize / mx) * 100, 2);
    const col = sc[c.sensitivity] || 'var(--accent)';
    h += '<div class="bar-row"><div class="bar-label" title="' + esc(c.description || '') + '">' + esc(c.name) + '</div><div class="bar-track"><div class="bar-fill" style="width:' + p + '%;background:' + col + '"></div></div><div class="bar-val">' + c.fileCount + ' / ' + fmtB(c.totalSize) + '</div></div>';
  });
  h += '</div></div>';
  set(el, h); staggerCards(el); refreshTime();
}

async function loadMcp() {
  const d = await api('mcp');
  const el = $('#sec-mcp');
  if (!d) { set(el, emptyState('&#9881;', 'MCP data unavailable', 'Could not diagnose MCP server configurations.', 'Retry', 'refreshCurrent()')); return; }
  let h = '<h2>MCP Servers</h2>';
  h += '<div class="action-bar"><button class="btn btn-primary" onclick="doTestMcp()">Test All Servers</button> <button class="btn btn-secondary" onclick="showAddMcpModal()">+ Add Server</button></div>';
  h += '<div class="grid">';
  h += '<div class="card"><div class="stat-icon">&#9881;</div><h3>Configs</h3><div class="value">' + d.configs.length + '</div></div>';
  h += '<div class="card"><div class="stat-icon">&#127760;</div><h3>Servers</h3><div class="value">' + d.totalServers + '</div></div>';
  h += '<div class="card"><div class="stat-icon">&#9989;</div><h3>Healthy</h3><div class="value c-green">' + d.healthyServers + '</div></div></div>';
  d.configs.forEach(cfg => {
    h += '<div class="card mt"><h3>' + esc(cfg.configPath.split('/').pop()) + '</h3>';
    h += '<div style="font-size:11px;color:var(--text3);margin-bottom:12px;word-break:break-all">' + esc(cfg.configPath) + '</div>';
    cfg.servers.forEach(srv => {
      const err = cfg.issues.some(i => i.server === srv.name && i.severity === 'error');
      const srvId = 'mcp-srv-' + esc(srv.name).replace(/[^a-zA-Z0-9]/g, '_');
      h += '<div class="mcp-server-card" style="border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;overflow:hidden">';
      h += '<div onclick="toggleMcpServer(\\''+srvId+'\\')" style="padding:12px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;background:var(--bg)">';
      h += '<div style="display:flex;align-items:center;gap:10px"><span id="' + srvId + '-arrow" style="font-size:10px;color:var(--text3)">&#9654;</span><strong>' + esc(srv.name) + '</strong>' + (err ? badge('error', 'red') : badge('ok', 'green')) + '</div>';
      h += '<div style="display:flex;align-items:center;gap:8px"><span id="' + srvId + '-badge" style="font-size:11px;color:var(--text3)">...</span><button class="btn btn-sm btn-primary" onclick="event.stopPropagation();probeMcpServer(\\''+esc(srv.name)+'\\')">Probe</button></div>';
      h += '</div>';
      h += '<div id="' + srvId + '" style="display:none;padding:12px;background:var(--bg2);border-top:1px solid var(--border)">';
      h += '<div style="font-size:12px;color:var(--text3);margin-bottom:8px">Command: <span class="mono">' + esc(srv.command) + (srv.args?.length ? ' ' + srv.args.map(a => esc(a)).join(' ') : '') + '</span></div>';
      if (srv.env && Object.keys(srv.env).length > 0) { h += '<div style="font-size:12px;color:var(--text3);margin-bottom:8px">Env: ' + Object.keys(srv.env).map(k => esc(k)).join(', ') + '</div>'; }
      h += '<div id="' + srvId + '-caps" style="margin-top:8px"><div style="color:var(--text3);font-size:11px">Click "Probe" to discover tools, resources, and prompts</div></div>';
      h += '</div></div>';
    });
    if (cfg.issues.length) {
      h += '<div style="margin-top:12px">'; cfg.issues.forEach(i => {
        const ib = i.severity === 'error' ? badge('error', 'red') : i.severity === 'warning' ? badge('warn', 'yellow') : badge('info', 'blue');
        h += '<div style="padding:4px 0;font-size:12px">' + ib + ' <strong>' + esc(i.server) + ':</strong> ' + esc(i.message);
        if (i.fix) h += '<br><span style="color:var(--text3);margin-left:12px">Fix: ' + esc(i.fix) + '</span>';
        h += '</div>';
      }); h += '</div>';
    }
    h += '</div>';
  });
  if (d.recommendations?.length) { h += '<div class="card mt"><h3>Recommendations</h3>'; d.recommendations.forEach(r => { h += '<div style="padding:4px 0;font-size:13px;color:var(--text2)">' + esc(r) + '</div>'; }); h += '</div>'; }
  h += '<div class="card mt"><h3>CCT CLI Commands</h3>';
  h += '<div style="font-size:12px;color:var(--text3);margin-bottom:12px">Available commands for MCP and server management</div>';
  const cmds = [
    ['cct mcp', 'Diagnose MCP server configurations and connectivity'],
    ['cct health', 'Quick health check of Claude Code installation'],
    ['cct scan', 'Scan conversations for oversized images and content'],
    ['cct fix', 'Fix oversized content with automatic backups'],
    ['cct security', 'Scan for exposed secrets and API keys'],
    ['cct traces', 'Inventory trace files (logs, telemetry, crash reports)'],
    ['cct stats', 'Show conversation statistics and file sizes'],
    ['cct context', 'Estimate token/context usage per conversation'],
    ['cct analytics', 'Usage analytics dashboard (sessions, tools, activity)'],
    ['cct duplicates', 'Find duplicate conversations and content'],
    ['cct archive --dry-run', 'Preview archiving inactive conversations'],
    ['cct maintenance', 'Run maintenance checks (dry-run by default)'],
    ['cct export &lt;file&gt;', 'Export a conversation to markdown or JSON'],
    ['cct dashboard', 'Launch this web dashboard'],
  ];
  h += '<table><tr><th>Command</th><th>Description</th></tr>';
  cmds.forEach(c => { h += '<tr><td class="mono" style="white-space:nowrap;color:var(--accent)">' + c[0] + '</td><td style="color:var(--text2)">' + c[1] + '</td></tr>'; });
  h += '</table></div>';
  h += '<div id="mcpTestResults"></div>';
  set(el, h); staggerCards(el); refreshTime();
}

let logsSearch = ''; let logsLevel = '';
async function loadLogs() {
  const params = new URLSearchParams();
  if (logsSearch) params.set('search', logsSearch);
  if (logsLevel) params.set('level', logsLevel);
  params.set('limit', '200');
  const d = await api('logs?' + params.toString());
  const el = $('#sec-logs');
  if (!d) { set(el, emptyState('&#128196;', 'Logs unavailable', 'Could not load debug logs.', 'Retry', 'refreshCurrent()')); return; }
  let h = '<h2>Debug Logs</h2>';
  h += '<div class="action-bar" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">';
  h += '<input id="logSearchInput" type="text" placeholder="Search logs..." value="' + esc(logsSearch) + '" style="flex:1;min-width:200px;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text)">';
  h += '<select id="logLevelFilter" style="padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text)">';
  h += '<option value="">All Levels</option>';
  h += '<option value="ERROR"' + (logsLevel === 'ERROR' ? ' selected' : '') + '>ERROR</option>';
  h += '<option value="WARN"' + (logsLevel === 'WARN' ? ' selected' : '') + '>WARN</option>';
  h += '<option value="INFO"' + (logsLevel === 'INFO' ? ' selected' : '') + '>INFO</option>';
  h += '<option value="DEBUG"' + (logsLevel === 'DEBUG' ? ' selected' : '') + '>DEBUG</option>';
  h += '</select>';
  h += '<button class="btn btn-primary" onclick="applyLogFilters()">Apply</button>';
  h += '<button class="btn" onclick="logsSearch=\\'\\';logsLevel=\\'\\';loadLogs()">Clear</button>';
  h += '</div>';
  h += '<div class="grid" style="margin-top:16px">';
  h += '<div class="card"><div class="stat-icon">&#128196;</div><h3>Log Files</h3><div class="value">' + (d.summary?.totalFiles || 0) + '</div></div>';
  h += '<div class="card"><div class="stat-icon">&#128230;</div><h3>Total Size</h3><div class="value">' + fmtB(d.summary?.totalSize || 0) + '</div></div>';
  const errCnt = (d.summary?.levelCounts?.ERROR || 0) + (d.summary?.levelCounts?.WARN || 0);
  h += '<div class="card"><div class="stat-icon">&#9888;</div><h3>Errors/Warnings</h3><div class="value ' + (errCnt > 0 ? 'c-orange' : 'c-green') + '">' + errCnt + '</div></div></div>';
  if (d.summary?.topComponents?.length) {
    h += '<div class="card mt"><h3>Top Components</h3><div class="bars">';
    const mx = Math.max(...d.summary.topComponents.map(c => c.count), 1);
    d.summary.topComponents.slice(0, 8).forEach(c => {
      const p = Math.max((c.count / mx) * 100, 2);
      h += '<div class="bar-row"><div class="bar-label" style="max-width:150px;overflow:hidden;text-overflow:ellipsis">' + esc(c.name) + '</div><div class="bar-track"><div class="bar-fill" style="width:' + p + '%;background:var(--accent)"></div></div><div class="bar-val">' + c.count + '</div></div>';
    });
    h += '</div></div>';
  }
  h += '<div class="card mt"><h3>Recent Log Entries' + (d.entries?.length ? ' (' + d.entries.length + ')' : '') + '</h3>';
  if (d.entries?.length) {
    h += '<div style="max-height:500px;overflow:auto;font-family:var(--font-mono);font-size:11px">';
    d.entries.forEach(e => {
      const lvlCol = e.level === 'ERROR' ? 'var(--red)' : e.level === 'WARN' ? 'var(--orange)' : e.level === 'INFO' ? 'var(--green)' : 'var(--text3)';
      const ts = new Date(e.timestamp).toLocaleTimeString();
      h += '<div style="padding:4px 0;border-bottom:1px solid var(--border);display:flex;gap:8px;align-items:flex-start">';
      h += '<span style="color:var(--text3);white-space:nowrap">' + ts + '</span>';
      h += '<span style="color:' + lvlCol + ';font-weight:600;min-width:50px">[' + e.level + ']</span>';
      if (e.component) h += '<span style="color:var(--accent);white-space:nowrap">[' + esc(e.component) + ']</span>';
      h += '<span style="color:var(--text2);word-break:break-word">' + esc(e.message.slice(0, 500)) + (e.message.length > 500 ? '...' : '') + '</span>';
      h += '</div>';
    });
    h += '</div>';
  } else { h += '<div style="color:var(--text3);padding:20px;text-align:center">No log entries match the current filters</div>'; }
  h += '</div>';
  if (d.files?.length) {
    h += '<div class="card mt"><h3>Log Files</h3><table><tr><th>Session</th><th>Project</th><th>Size</th><th>Modified</th><th>Status</th></tr>';
    d.files.forEach(f => {
      const sessionShort = f.sessionId ? f.sessionId.slice(0, 8) + '...' : f.name;
      const projectDisplay = f.projectName || '<span style="color:var(--text3)">Unknown</span>';
      h += '<tr>';
      h += '<td class="mono" title="' + esc(f.sessionId || f.name) + '">' + esc(sessionShort) + '</td>';
      h += '<td>' + (f.projectName ? '<span title="' + esc(f.projectPath || '') + '">' + esc(f.projectName) + '</span>' : '<span style="color:var(--text3)">—</span>') + '</td>';
      h += '<td>' + fmtB(f.size) + '</td>';
      h += '<td>' + ago(f.modified) + '</td>';
      h += '<td>' + (f.isLatest ? badge('current', 'green') : '') + '</td>';
      h += '</tr>';
    });
    h += '</table></div>';
  }
  set(el, h); staggerCards(el); refreshTime();
  const searchInput = $('#logSearchInput');
  if (searchInput) { searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') applyLogFilters(); }); }
}
function applyLogFilters() {
  const searchEl = $('#logSearchInput');
  const levelEl = $('#logLevelFilter');
  logsSearch = searchEl?.value || '';
  logsLevel = levelEl?.value || '';
  loadLogs();
}

let activeConfigTab = 'settings';
async function loadConfig() {
  const d = await api('config');
  const el = $('#sec-config');
  if (!d) { set(el, emptyState('&#9881;', 'Config unavailable', 'Could not load configuration files.', 'Retry', 'refreshCurrent()')); return; }
  let h = '<h2>Configuration</h2>';
  h += '<div class="config-tabs" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:16px">';
  const tabs = [
    { id: 'settings', label: 'Settings', icon: '&#9881;', exists: d.settings?.exists },
    { id: 'globalClaudeMd', label: 'Global CLAUDE.md', icon: '&#128196;', exists: d.globalClaudeMd?.exists },
    { id: 'globalMcp', label: 'Global MCP', icon: '&#127760;', exists: d.globalMcp?.exists },
    { id: 'projectClaudeMd', label: 'Project CLAUDE.md', icon: '&#128196;', exists: d.projectClaudeMd?.exists },
    { id: 'projectMcp', label: 'Project MCP', icon: '&#127760;', exists: d.projectMcp?.exists },
  ];
  tabs.forEach(t => {
    const active = activeConfigTab === t.id ? ' style="background:var(--accent);color:#fff"' : '';
    const existBadge = t.exists ? '' : '<span style="font-size:9px;color:var(--text3);margin-left:4px">(new)</span>';
    h += '<button class="btn btn-sm"' + active + ' onclick="switchConfigTab(\\''+t.id+'\\')">' + t.icon + ' ' + t.label + existBadge + '</button>';
  });
  h += '</div>';
  const cfg = d[activeConfigTab];
  h += '<div class="card">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h += '<h3>' + tabs.find(t => t.id === activeConfigTab)?.label || activeConfigTab + '</h3>';
  h += '<button class="btn btn-primary btn-sm" onclick="saveCurrentConfig()">Save Changes</button>';
  h += '</div>';
  if (cfg?.path) { h += '<div style="font-size:11px;color:var(--text3);margin-bottom:8px;word-break:break-all">' + esc(cfg.path) + '</div>'; }
  if (cfg?.exists && cfg?.modified) { h += '<div style="font-size:11px;color:var(--text3);margin-bottom:12px">Last modified: ' + ago(cfg.modified) + ' | Size: ' + fmtB(cfg.size || 0) + '</div>'; }
  const isJson = activeConfigTab === 'settings' || activeConfigTab.includes('Mcp');
  
  let editorContent = '';
  if (cfg?.content) {
    editorContent = esc(cfg.content);
    // Auto-format JSON if possible
    if(isJson) {
      try {
        const parsed = JSON.parse(cfg.content);
        editorContent = JSON.stringify(parsed, null, 2);
      } catch {}
    }
  } else if (!cfg?.exists) {
    if (isJson) { editorContent = '{\\n}'; }
    else { editorContent = '# ' + (tabs.find(t => t.id === activeConfigTab)?.label || 'Config') + '\\n'; }
  }

  h += '<textarea id="configEditor" class="code-editor" spellcheck="false">';
  h += editorContent;
  h += '</textarea>';
  if (isJson) { h += '<div style="margin-top:8px;font-size:11px;color:var(--text3)">JSON configuration file. Changes will be validated before saving.</div>'; }
  h += '</div>';
  h += '<div class="card mt"><h3>Configuration Files Summary</h3><table><tr><th>File</th><th>Path</th><th>Status</th><th>Size</th></tr>';
  tabs.forEach(t => {
    const c = d[t.id];
    h += '<tr><td>' + t.label + '</td><td class="mono" style="max-width:300px;overflow:hidden;text-overflow:ellipsis">' + esc(c?.path || '') + '</td>';
    h += '<td>' + (c?.exists ? badge('exists', 'green') : badge('missing', 'yellow')) + '</td>';
    h += '<td>' + (c?.exists ? fmtB(c.size || 0) : '-') + '</td></tr>';
  });
  h += '</table></div>';
  set(el, h); staggerCards(el); refreshTime();
}
function switchConfigTab(tab) { activeConfigTab = tab; loadConfig(); }
async function saveCurrentConfig() {
  const editor = $('#configEditor');
  if (!editor) { toast('Editor not found', 'error'); return; }
  const content = editor.value;
  showProgress('Saving configuration...');
  const r = await post('save-config', { type: activeConfigTab, content });
  hideProgress();
  if (r.success) { toast('Configuration saved', 'success'); loadConfig(); }
  else { toast('Failed: ' + (r.error || 'Unknown error'), 'error'); }
}

async function loadAnalytics() {
  const d = await api('analytics');
  const el = $('#sec-analytics');
  if (!d) { set(el, emptyState('&#128200;', 'Analytics unavailable', 'Could not generate usage analytics.', 'Retry', 'refreshCurrent()')); return; }
  let h = '<h2>Analytics</h2>';

  // Cost Estimator
  const cachedCost = localStorage.getItem('cct_cost_per_m') || '15.00';
  const totalTokensM = (d.totalTokens || 0) / 1000000;
  const estimatedCost = (parseFloat(cachedCost) * totalTokensM).toFixed(2);

  h += '<div class="card mb" style="margin-bottom:16px;background:var(--bg3);border-color:var(--border-light)">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">';
  h += '<div style="display:flex;align-items:center;gap:12px">';
  h += '<div class="stat-icon" style="float:none;font-size:18px">&#128178;</div>';
  h += '<div><div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase">Estimated Cost of History</div><div style="font-size:20px;font-weight:700;color:var(--green)">$' + estimatedCost + '</div></div>';
  h += '</div>';
  h += '<div style="display:flex;align-items:center;gap:8px;font-size:12px">';
  h += '<label style="color:var(--text3)">Avg Price ($/1M tokens):</label>';
  h += '<input type="number" id="costInput" value="' + cachedCost + '" step="0.01" style="width:70px;padding:4px 8px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font)" onchange="updateCost(this.value, ' + totalTokensM + ')">';
  h += '</div></div></div>';

  h += '<div class="grid">';
  h += '<div class="card"><div class="stat-icon">&#128172;</div><h3>Sessions</h3><div class="value">' + (d.totalSessions || 0) + '</div></div>';
  h += '<div class="card"><div class="stat-icon">&#128172;</div><h3>Messages</h3><div class="value">' + fmtK(d.totalMessages || 0) + '</div></div>';
  h += '<div class="card"><div class="stat-icon">&#129520;</div><h3>Tokens</h3><div class="value">' + fmtK(d.totalTokens || 0) + '</div></div>';
  h += '<div class="card"><div class="stat-icon">&#128197;</div><h3>Active Days</h3><div class="value">' + (d.activeDays || 0) + '</div></div>';
  h += '<div class="card"><div class="stat-icon">&#128200;</div><h3>Context Tokens</h3><div class="value">' + fmtK(d.contextTokens || 0) + '</div><div class="sub">avg ' + fmtK(d.avgTokensPerSession || 0) + '/session</div></div>';
  if (d.tokenWarnings > 0) h += '<div class="card"><div class="stat-icon">&#9888;</div><h3>Token Warnings</h3><div class="value c-orange">' + d.tokenWarnings + '</div><div class="sub">&gt;100K token sessions</div></div>';
  h += '</div>';
  if (d.dailyActivity?.length) {
    // SVG Chart
    const data = d.dailyActivity.slice(-30).map(day => ({ value: day.messages || 0, date: day.date }));
    const svg = sparklineSvg(data, 800, 100, '#60a5fa');

    h += '<div class="card mt"><h3>Activity (last 30 days)</h3>';
    h += '<div style="height:120px;position:relative;margin-top:12px" onmousemove="showChartTooltip(event)" onmouseleave="hideChartTooltip()">';
    h += svg;
    h += '<div id="chartTooltip" style="display:none;position:absolute;background:var(--bg2);border:1px solid var(--border);padding:4px 8px;border-radius:4px;font-size:11px;pointer-events:none;transform:translate(-50%, -100%);top:0;left:0;box-shadow:var(--shadow)"></div>';
    // Set data directly
    window.chartData = data;
    h += '</div></div>';
  }
  if (d.topProjects?.length) {
    h += '<div class="card mt"><h3>Top Projects</h3><table><tr><th>Project</th><th>Sessions</th><th>Messages</th></tr>';
    d.topProjects.slice(0, 10).forEach(p => {
      const nm = p.name.length > 40 ? '...' + p.name.slice(-37) : p.name;
      h += '<tr><td>' + esc(nm) + '</td><td>' + (p.sessions || 0) + '</td><td>' + (p.messages || 0) + '</td></tr>';
    });
    h += '</table></div>';
  }
  if (d.toolUsage && Object.keys(d.toolUsage).length) {
    const mx2 = Math.max(...Object.values(d.toolUsage));
    const cols = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#fb923c', '#a78bfa'];
    h += '<div class="card mt"><h3>Tool Usage</h3><div class="bars">';
    Object.entries(d.toolUsage).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([t, c], i) => {
      const p = Math.max((c / mx2) * 100, 2);
      h += '<div class="bar-row"><div class="bar-label">' + esc(t) + '</div><div class="bar-track"><div class="bar-fill" style="width:' + p + '%;background:' + cols[i % cols.length] + '"></div></div><div class="bar-val">' + c + '</div></div>';
    });
    h += '</div></div>';
  }
  set(el, h); staggerCards(el); refreshTime();
}

function updateCost(cost, totalM) {
  localStorage.setItem('cct_cost_per_m', cost);
  loadAnalytics(); // Refresh to recalculate
}

function showChartTooltip(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const width = rect.width;
  const data = window.chartData || [];
  if (!data.length) return;

  const index = Math.min(Math.max(0, Math.floor((x / width) * data.length)), data.length - 1);
  const item = data[index];
  const tip = document.getElementById('chartTooltip');
  if (tip && item) {
    tip.style.display = 'block';
    tip.style.left = x + 'px';
    tip.style.top = (rect.height / 2) + 'px'; // Center vertically relative to chart area
    tip.innerHTML = \`<div style="color:var(--text3)">\${item.date}</div><div style="font-weight:700;color:var(--accent)">\${item.value} msgs</div>\`;
  }
}

function hideChartTooltip() {
  const tip = document.getElementById('chartTooltip');
  if (tip) tip.style.display = 'none';
}

async function loadBackups() {
  const d = await api('backups');
  const el = $('#sec-backups');
  if (!d) { set(el, emptyState('&#128190;', 'Backup data unavailable', 'Could not scan for backup files.', 'Retry', 'refreshCurrent()')); return; }
  let h = '<h2>Backups</h2>';
  h += '<div class="action-bar"><button class="btn btn-danger" onclick="doDeleteBackups()">Delete Old Backups (&gt;7 days)</button></div>';
  h += '<div class="grid"><div class="card"><div class="stat-icon">&#128190;</div><h3>Total Backups</h3><div class="value">' + (d.totalBackups || 0) + '</div></div>';
  h += '<div class="card"><div class="stat-icon">&#128230;</div><h3>Total Size</h3><div class="value">' + fmtB(d.totalSize || 0) + '</div></div></div>';
  if (d.backups?.length) {
    h += '<div class="card mt"><table><tr><th>File</th><th>Directory</th><th>Size</th><th>Created</th><th>Actions</th></tr>';
    d.backups.slice(0, 100).forEach(b => {
      const bp = esc(b.path);
      h += '<tr><td class="mono">' + esc(b.file) + '</td><td class="mono" style="max-width:200px;overflow:hidden;text-overflow:ellipsis">' + esc(b.dir) + '</td><td>' + fmtB(b.size) + '</td><td>' + ago(b.created) + '</td>';
      h += '<td><button class="btn btn-sm btn-success" onclick="doRestore(\\''+bp+'\\')">Restore</button></td></tr>';
    });
    h += '</table></div>';
  } else { h += emptyState('&#128190;', 'No backups found', 'No backup files were found. Backups are created automatically when fixing issues or redacting secrets.'); }
  set(el, h); staggerCards(el); refreshTime();
}

async function loadContext() {
  const d = await api('context');
  const el = $('#sec-context');
  if (!d) { set(el, emptyState('&#129520;', 'Context data unavailable', 'Could not estimate token usage.', 'Retry', 'refreshCurrent()')); return; }
  let h = '<h2>Context Estimation</h2>';
  h += '<div class="grid"><div class="card"><div class="stat-icon">&#129520;</div><h3>Total Tokens</h3><div class="value">' + fmtK(d.totalTokens || 0) + '</div></div>';
  h += '<div class="card"><div class="stat-icon">&#128196;</div><h3>Sessions</h3><div class="value">' + (d.totalFiles || 0) + '</div></div>';
  h += '<div class="card"><div class="stat-icon">&#9888;</div><h3>Large Sessions</h3><div class="value ' + (d.warnings > 0 ? 'c-orange' : 'c-green') + '">' + (d.warnings || 0) + '</div><div class="sub">&gt;100K tokens</div></div></div>';
  if (d.estimates?.length) {
    h += '<div class="card mt"><h3>Sessions by Token Usage</h3>';
    h += '<div style="overflow-x:auto"><table><tr><th>Project</th><th>Session</th><th>Tokens</th><th>Msgs</th><th>Imgs</th><th>Tools</th><th>Status</th></tr>';
    d.estimates.forEach(e => {
      const warn = e.warnings?.length > 0;
      const tk = e.tokens || 0;
      const cls = tk > 100000 ? 'c-red' : tk > 50000 ? 'c-orange' : '';
      const shortId = (e.sessionId || '').slice(0, 8);
      const isAgent = e.sessionId?.startsWith('agent-');
      h += '<tr>';
      h += '<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis"><strong>' + esc(e.projectName || 'Unknown') + '</strong></td>';
      h += '<td style="max-width:200px">';
      h += '<span class="mono" style="font-size:10px;color:var(--text3)" title="' + esc(e.sessionId || '') + '">' + (isAgent ? '&#129302; ' : '') + (shortId || '?') + '</span>';
      if (e.firstPrompt) { h += '<div style="font-size:11px;color:var(--text2);margin-top:2px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(e.firstPrompt) + '">' + esc(e.firstPrompt) + '</div>'; }
      h += '</td>';
      h += '<td class="' + cls + '">' + fmtK(tk) + '</td>';
      h += '<td>' + (e.messages || 0) + '</td>';
      h += '<td>' + (e.images || 0) + '</td>';
      h += '<td>' + (e.tools || 0) + '</td>';
      h += '<td>' + (warn ? badge('warn', 'orange') : badge('ok', 'green')) + '</td>';
      h += '</tr>';
    });
    h += '</table></div></div>';
  }
  set(el, h); staggerCards(el); refreshTime();
}

async function loadMaintenance() {
  const [maint, arch] = await Promise.all([api('maintenance'), api('archive/candidates')]);
  const el = $('#sec-maintenance');
  if (!maint) { set(el, emptyState('&#128736;', 'Maintenance data unavailable', 'Could not run maintenance checks.', 'Retry', 'refreshCurrent()')); return; }
  let h = '<h2>Maintenance</h2>';
  h += '<div class="action-bar">';
  if (maint.totalActions > 0) h += '<button class="btn btn-primary" onclick="doMaintenance()">Run Maintenance (' + maint.totalActions + ' actions)</button>';
  if (arch?.totalCandidates > 0) h += '<button class="btn btn-warn" onclick="doArchive()">Archive ' + arch.totalCandidates + ' Conversations</button>';
  h += '</div>';
  h += '<div class="grid"><div class="card"><div class="stat-icon">&#128736;</div><h3>Status</h3><div class="value ' + (maint.status === 'clean' ? 'c-green' : 'c-yellow') + '">' + esc(maint.status || 'unknown') + '</div></div>';
  h += '<div class="card"><div class="stat-icon">&#128221;</div><h3>Pending Actions</h3><div class="value">' + (maint.totalActions || 0) + '</div></div>';
  h += '<div class="card"><div class="stat-icon">&#128190;</div><h3>Reclaimable Space</h3><div class="value">' + fmtB(maint.estimatedSpace || 0) + '</div></div>';
  if (arch) h += '<div class="card"><div class="stat-icon">&#128451;</div><h3>Archive Candidates</h3><div class="value c-accent">' + (arch.totalCandidates || 0) + '</div><div class="sub">' + fmtB(arch.totalSize || 0) + ' reclaimable</div></div>';
  h += '</div>';
  if (maint.actions?.length) {
    h += '<div class="card mt"><h3>Actions</h3><table><tr><th>Type</th><th>Description</th><th>Space</th><th>Count</th></tr>';
    maint.actions.forEach(a => {
      h += '<tr><td>' + badge(esc(a.type), 'blue') + '</td><td>' + esc(a.description) + '</td><td>' + fmtB(a.sizeBytes || 0) + '</td><td>' + (a.count || '-') + '</td></tr>';
    });
    h += '</table></div>';
  }
  if (arch?.candidates?.length) {
    h += '<div class="card mt"><h3>Archive Candidates (inactive &gt;30 days)</h3><table><tr><th>File</th><th>Size</th><th>Messages</th><th>Days Inactive</th></tr>';
    arch.candidates.slice(0, 30).forEach(c => {
      h += '<tr><td class="mono" style="max-width:300px;overflow:hidden;text-overflow:ellipsis" title="' + esc(c.file) + '">' + esc(c.file.split('/').pop()) + '</td>';
      h += '<td>' + fmtB(c.size) + '</td><td>' + (c.messageCount || 0) + '</td><td>' + c.daysInactive + 'd</td></tr>';
    });
    h += '</table></div>';
  }
  set(el, h); staggerCards(el); refreshTime();
}

function loadAbout() {
  const el = $('#sec-about');
  let h = '<div class="about-hero">';
  h += '<div class="about-logo">C</div>';
  h += '<h2>Claude Code Toolkit</h2>';
  h += '<p class="about-desc">MCP server and CLI toolkit for maintaining, optimizing, and troubleshooting Claude Code installations</p>';
  h += '<div class="about-meta"><span>v1.2.0</span><span>MIT License</span><span>by Asif Kibria</span></div>';
  h += '</div>';
  h += '<h3 style="font-size:16px;font-weight:700;margin-bottom:14px">Features</h3>';
  h += '<div class="feature-grid">';
  const features = [
    ['&#128269;', 'Health Check', 'Quick system diagnostics and status overview'],
    ['&#128230;', 'Storage Analysis', 'Analyze, visualize, and clean the .claude directory'],
    ['&#128736;', 'Session Recovery', 'Diagnose, repair, and extract data from sessions'],
    ['&#128274;', 'Security Scanning', 'Detect exposed secrets, API keys, and credentials'],
    ['&#128065;', 'Trace Management', 'Inventory, selective cleanup, and secure wipe of traces'],
    ['&#9881;', 'MCP Validation', 'Diagnose MCP server configurations and connectivity'],
    ['&#129520;', 'Context Estimation', 'Estimate token usage and context size per conversation'],
    ['&#128200;', 'Usage Analytics', 'Activity tracking, project rankings, and tool usage stats'],
    ['&#128270;', 'Duplicate Detection', 'Find redundant conversations and wasted storage'],
    ['&#128451;', 'Archive Management', 'Archive inactive conversations to free space'],
    ['&#128260;', 'Maintenance', 'Automated health checks with scheduling support'],
    ['&#128190;', 'Backup Management', 'Create, restore, and clean backup files'],
    ['&#128221;', 'Export', 'Export conversations to markdown or JSON format'],
    ['&#127760;', 'Web Dashboard', 'Real-time monitoring with 11 interactive tabs'],
  ];
  features.forEach(f => { h += '<div class="feature-card"><div class="fc-icon">' + f[0] + '</div><h4>' + f[1] + '</h4><p>' + f[2] + '</p></div>'; });
  h += '</div>';
  h += '<h3 style="font-size:16px;font-weight:700;margin-bottom:14px">Links</h3>';
  h += '<div class="link-grid">';
  h += '<a class="link-card" href="https://github.com/asifkibria/claude-code-toolkit" target="_blank"><div class="lc-icon">&#128187;</div><div><div class="lc-title">GitHub Repository</div><div class="lc-sub">Source code, README, and documentation</div></div></a>';
  h += '<a class="link-card" href="https://www.npmjs.com/package/@asifkibria/claude-code-toolkit" target="_blank"><div class="lc-icon">&#128230;</div><div><div class="lc-title">npm Package</div><div class="lc-sub">@asifkibria/claude-code-toolkit</div></div></a>';
  h += '<a class="link-card" href="https://github.com/asifkibria/claude-code-toolkit/issues" target="_blank"><div class="lc-icon">&#128030;</div><div><div class="lc-title">Issues &amp; Feedback</div><div class="lc-sub">Report bugs or request features</div></div></a>';
  h += '<a class="link-card" href="https://github.com/asifkibria/claude-code-toolkit#readme" target="_blank"><div class="lc-icon">&#128214;</div><div><div class="lc-title">Documentation</div><div class="lc-sub">Setup guide and API reference</div></div></a>';
  h += '</div>';
  h += '<div class="card mt"><h3>Quick Start</h3>';
  h += '<div style="font-family:var(--mono);font-size:12px;line-height:2;color:var(--text2)">';
  h += '<div><span style="color:var(--text3)"># Install globally</span></div>';
  h += '<div style="color:var(--accent)">npm install -g @asifkibria/claude-code-toolkit</div>';
  h += '<div style="margin-top:8px"><span style="color:var(--text3)"># Run health check</span></div>';
  h += '<div style="color:var(--accent)">cct health</div>';
  h += '<div style="margin-top:8px"><span style="color:var(--text3)"># Launch dashboard</span></div>';
  h += '<div style="color:var(--accent)">cct dashboard</div>';
  h += '<div style="margin-top:8px"><span style="color:var(--text3)"># Use as MCP server</span></div>';
  h += '<div style="color:var(--accent)">claude mcp add claude-code-toolkit -- npx @asifkibria/claude-code-toolkit</div>';
  h += '</div></div>';
  set(el, h); refreshTime();
}

function showProgress(label) {
  $('#actionLabel').textContent = label || 'Processing...';
  $('#progressBar').classList.add('active');
  $('#actionOverlay').classList.add('active');
}
function hideProgress() {
  $('#progressBar').classList.remove('active');
  $('#actionOverlay').classList.remove('active');
}
function showResult(ok, title, details, tabs, items) {
  hideProgress();
  let body = '<div class="detail-panel">';
  body += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px"><div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;background:' + (ok ? 'var(--green-bg)' : 'var(--red-bg)') + ';color:' + (ok ? 'var(--green)' : 'var(--red)') + '">' + (ok ? '&#10003;' : '&#10007;') + '</div><div style="font-size:15px;font-weight:600">' + esc(title) + '</div></div>';
  if (details) body += '<div class="result-details" style="display:flex;flex-wrap:wrap;gap:6px 20px;margin-bottom:16px;font-size:13px">' + details + '</div>';
  if (items && items.length) {
    body += '<div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px">Changes (' + items.length + ' item' + (items.length > 1 ? 's' : '') + ')</div>';
    body += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;max-height:300px;overflow-y:auto">';
    items.forEach(function (item, i) {
      const short = function (p) { const parts = p.split('/'); return parts.length > 3 ? '.../' + parts.slice(-3).join('/') : p; };
      body += '<div style="padding:7px 12px;font-family:var(--mono);font-size:12px;border-bottom:1px solid var(--border);color:var(--text2);display:flex;align-items:center;gap:8px">';
      body += '<span style="color:' + (ok ? 'var(--green)' : 'var(--red)') + ';font-size:10px;min-width:20px;text-align:right;opacity:0.6">' + (i + 1) + '</span>';
      body += '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(item) + '">' + esc(short(item)) + '</span></div>';
    });
    body += '</div>';
  }
  body += '</div>';
  showModal((ok ? 'Action Complete' : 'Action Failed'), body, 'Close', null, true);
  if (tabs) { tabs.forEach(t => { loaded[t] = false; }); reloadCurrent(); }
}
function reloadCurrent() { loaded[currentTab] = false; loadTab(currentTab); }
async function runAction(label, fn) {
  showProgress(label);
  try { return await fn(); } catch (e) { hideProgress(); toast('Action failed: ' + (e.message || 'unknown'), 'error'); return null; }
}
function switchTab(t) {
  $$('.nav-item').forEach(n => { n.classList.toggle('active', n.dataset.tab === t); });
  $$('.section').forEach(s => s.classList.remove('active'));
  $('#sec-' + t).classList.add('active');
  currentTab = t; loadTab(t);
}

async function doFixAll() {
  showModal('Fix All Issues', 'This will scan and fix all conversations with oversized content. Backups will be created automatically.', 'Fix All', async () => {
    showProgress('Fixing issues...');
    const r = await post('fix-all');
    if (r.success) { showResult(true, 'Fix All Complete', '<span>Fixed: <strong>' + r.fixed + '</strong> file(s)</span><span>Errors: ' + r.errors + '</span><span>Total scanned: ' + r.total + '</span>', ['overview', 'storage'], r.fixedFiles); }
    else { showResult(false, 'Fix Failed', '<span>' + esc(r.error || 'Unknown error') + '</span>', null, r.errorFiles); }
  });
}
async function doCleanPreview() {
  showProgress('Analyzing directory...');
  const r = await post('clean', { dryRun: true });
  hideProgress();
  if (r.deleted > 0) {
    showModal('Clean Directory', 'Found ' + r.deleted + ' items to clean (' + fmtB(r.freed) + ' freeable). Proceed with cleanup?', 'Clean', async () => {
      showProgress('Cleaning directory...');
      const r2 = await post('clean', { dryRun: false });
      showResult(true, 'Cleanup Complete', '<span>Deleted: <strong>' + r2.deleted + '</strong> items</span><span>Freed: <strong>' + fmtB(r2.freed) + '</strong></span>', ['storage', 'overview'], r2.items);
    });
  } else toast('Nothing to clean', 'info');
}
async function doCleanExecute() {
  showModal('Clean Directory', 'This will permanently delete cleanable items (debug logs, empty files, old snapshots). Continue?', 'Clean Now', async () => {
    showProgress('Cleaning directory...');
    const r = await post('clean', { dryRun: false });
    showResult(true, 'Cleanup Complete', '<span>Deleted: <strong>' + r.deleted + '</strong> items</span><span>Freed: <strong>' + fmtB(r.freed) + '</strong></span>', ['storage', 'overview'], r.items);
  });
}
async function doRepair(sid) {
  showModal('Repair Session', 'This will remove corrupted lines from session ' + sid.slice(0, 12) + '... A backup will be created.', 'Repair', async () => {
    showProgress('Repairing session...');
    const r = await post('repair', { sessionId: sid });
    if (r.success) { showResult(true, 'Session Repaired', '<span>Lines removed: <strong>' + r.linesRemoved + '</strong></span><span>Lines fixed: <strong>' + r.linesFixed + '</strong></span><span>Backup: ' + esc(r.backupPath?.split('/').pop() || 'created') + '</span>', ['sessions', 'overview'], r.backupPath ? [r.backupPath] : null); }
    else { showResult(false, 'Repair Failed', '<span>' + esc(r.error || 'Unknown error') + '</span>'); }
  });
}
async function doExtract(sid) {
  showProgress('Extracting session data...');
  try {
    const r = await post('extract', { sessionId: sid });
    hideProgress();
    if (!r.success) {
      showModal('Extract Failed', '<div class="empty-state"><div class="empty-icon">&#9888;</div><div class="empty-title">Extract Error</div><div class="empty-sub">' + esc(r.error || 'Could not extract session data. The session may be corrupted or inaccessible.') + '</div></div>', 'Close', null, true);
      return;
    }
    const isEmpty = !r.userMessages && !r.assistantMessages && !r.fileEdits && !r.commandsRun;
    let body = '<div class="detail-panel">';
    if (isEmpty) {
      body += '<div class="empty-state" style="padding:32px 16px"><div class="empty-icon">&#128196;</div><div class="empty-title">Empty Session</div><div class="empty-sub">This session has no messages, file edits, or commands recorded.</div></div>';
    } else {
      body += '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:12px">';
      const stats = [['User Messages', r.userMessages, 'var(--accent)'], ['Assistant Messages', r.assistantMessages, 'var(--green)'], ['File Edits', r.fileEdits, 'var(--yellow)'], ['Commands', r.commandsRun, 'var(--purple)']];
      stats.forEach(s => { body += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;text-align:center"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;font-weight:600;letter-spacing:0.5px;margin-bottom:2px">' + s[0] + '</div><div style="font-size:20px;font-weight:700;color:' + s[2] + '">' + s[1] + '</div></div>'; });
      body += '</div>';
      if (r.sampleMessages?.length) { body += '<div style="font-size:12px;font-weight:600;color:var(--accent);margin-bottom:8px">Sample Messages</div>'; body += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;max-height:250px;overflow-y:auto">'; r.sampleMessages.forEach(m => { body += '<div style="padding:7px 12px;font-family:var(--mono);font-size:12px;border-bottom:1px solid var(--border);color:var(--text2)">' + esc(m) + '</div>'; }); body += '</div>'; }
      if (r.editedFiles?.length) { body += '<div style="font-size:12px;font-weight:600;color:var(--green);margin:12px 0 8px">Edited Files</div>'; body += auditList(r.editedFiles, 'var(--green)'); }
    }
    body += '</div>';
    showModal('Session Extract: ' + sid.slice(0, 12), body, 'Close', null, true);
  } catch (e) { hideProgress(); showModal('Extract Failed', '<div class="empty-state"><div class="empty-icon">&#9888;</div><div class="empty-title">Extract Error</div><div class="empty-sub">Could not complete the extraction. The session file may be corrupted.</div></div>', 'Close', null, true); }
}
function switchAuditTab(btn, paneId) {
  const panel = btn.closest('.detail-panel');
  panel.querySelectorAll('.audit-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  panel.querySelectorAll('.audit-pane').forEach(p => p.classList.remove('active'));
  panel.querySelector('#' + paneId).classList.add('active');
}
function auditList(items, color) {
  if (!items || !items.length) return '<div style="padding:16px;color:var(--text3);text-align:center;font-size:13px">None</div>';
  const short = p => { const parts = p.split('/'); return parts.length > 3 ? '.../' + parts.slice(-2).join('/') : p; };
  let h = '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;max-height:400px;overflow-y:auto">';
  items.forEach((item, i) => {
    h += '<div style="padding:7px 12px;font-family:var(--mono);font-size:12px;border-bottom:1px solid var(--border);color:var(--text2);display:flex;align-items:center;gap:8px">';
    h += '<span style="color:' + color + ';font-size:10px;min-width:24px;text-align:right;opacity:0.6">' + (i + 1) + '</span>';
    h += '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(item) + '">' + esc(short(item)) + '</span></div>';
  });
  h += '</div>';
  return h;
}
async function doAudit(sid) {
  showProgress('Auditing session...');
  try {
    const r = await fetch('/api/session/' + encodeURIComponent(sid) + '/audit');
    hideProgress();
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      showModal('Audit Failed', '<div class="empty-state"><div class="empty-icon">&#9888;</div><div class="empty-title">' + (r.status === 404 ? 'Session Not Found' : 'Audit Error') + '</div><div class="empty-sub">' + (esc(err.error || 'Could not read session data. The session may be corrupted or inaccessible.')) + '</div></div>', 'Close', null, true);
      return;
    }
    const d = await r.json();
    const fr = Array.isArray(d.filesRead) ? d.filesRead : [];
    const fw = Array.isArray(d.filesWritten) ? d.filesWritten : [];
    const cr = Array.isArray(d.commandsRun) ? d.commandsRun : [];
    const mt = Array.isArray(d.mcpToolsUsed) ? d.mcpToolsUsed : [];
    const uf = Array.isArray(d.urlsFetched) ? d.urlsFetched : [];
    let body = '<div class="detail-panel">';
    if (d.project) body += '<div style="font-size:12px;color:var(--text3);margin-bottom:12px;font-family:var(--mono)">' + esc(d.project) + '</div>';
    if (d.totalActions === 0) {
      body += '<div class="empty-state" style="padding:32px 16px"><div class="empty-icon">&#128196;</div><div class="empty-title">No Activity Recorded</div><div class="empty-sub">This session has no file reads, writes, commands, or tool usage recorded.</div></div>';
    } else {
      body += '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:8px;margin-bottom:12px">';
      const mc = [['Total', d.totalActions, 'var(--text)'], ['Read', fr.length, 'var(--accent)'], ['Written', fw.length, 'var(--green)'], ['Commands', cr.length, 'var(--yellow)'], ['MCP', mt.length, 'var(--purple)'], ['URLs', uf.length, 'var(--orange)']];
      mc.forEach(m => { body += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px;text-align:center"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;font-weight:600;letter-spacing:0.5px;margin-bottom:2px">' + m[0] + '</div><div style="font-size:20px;font-weight:700;color:' + m[2] + '">' + m[1] + '</div></div>'; });
      body += '</div>';
      const tabs = [['files', 'Files (' + fr.length + '/' + fw.length + ')'], ['cmds', 'Commands (' + cr.length + ')'], ['mcp', 'MCP (' + mt.length + ')'], ['urls', 'URLs (' + uf.length + ')']];
      body += '<div class="audit-tabs">';
      tabs.forEach((t, i) => { body += '<div class="audit-tab' + (i === 0 ? ' active' : '') + '" onclick="switchAuditTab(this,\\'ap - '+t[0]+'\\')">' + t[1] + '</div>'; });
      body += '</div>';
      body += '<div class="audit-pane active" id="ap-files">';
      if (fr.length) { body += '<div style="font-size:12px;font-weight:600;color:var(--accent);margin-bottom:8px">Files Read (' + fr.length + ')</div>'; body += auditList(fr, 'var(--accent)'); }
      if (fw.length) { body += '<div style="font-size:12px;font-weight:600;color:var(--green);margin:' + (fr.length ? '12px' : '0') + ' 0 8px">Files Written (' + fw.length + ')</div>'; body += auditList(fw, 'var(--green)'); }
      if (!fr.length && !fw.length) body += '<div style="padding:24px;text-align:center;color:var(--text3)">No file operations</div>';
      body += '</div>';
      body += '<div class="audit-pane" id="ap-cmds">' + auditList(cr, 'var(--yellow)') + '</div>';
      body += '<div class="audit-pane" id="ap-mcp">' + auditList(mt, 'var(--purple)') + '</div>';
      body += '<div class="audit-pane" id="ap-urls">' + auditList(uf, 'var(--orange)') + '</div>';
    }
    body += '</div>';
    showModal('Session Audit: ' + sid.slice(0, 12), body, 'Close', null, true);
    $$('#sessionTableBody tr').forEach(r => r.classList.remove('session-row-active'));
    const row = $('#sessionTableBody tr[data-sid^="' + sid.slice(0, 12) + '"]') || $('#sessionTableBody tr[data-sid="' + sid + '"]');
    if (row) row.classList.add('session-row-active');
  } catch (e) { hideProgress(); showModal('Audit Failed', '<div class="empty-state"><div class="empty-icon">&#9888;</div><div class="empty-title">Audit Error</div><div class="empty-sub">Could not complete the audit. The session file may be corrupted.</div></div>', 'Close', null, true); }
}
function showTraceCategoryFiles(categoryName) {
  const categories = window._traceCategories || [];
  const cat = categories.find(c => c.name === categoryName);
  if (!cat || !cat.allFiles?.length) { toast('No files found for this category', 'info'); return; }
  let body = '<div style="max-height:500px;overflow-y:auto">';
  body += '<div style="font-size:12px;color:var(--text3);margin-bottom:12px">' + cat.fileCount + ' files, ' + fmtB(cat.totalSize) + ' total</div>';
  body += '<table style="width:100%"><tr><th style="text-align:left">Project/File</th><th>Size</th><th>Modified</th><th>Full Path</th></tr>';
  cat.allFiles.forEach(f => {
    body += '<tr>';
    body += '<td style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis" title="' + esc(f.fullPath) + '">' + esc(f.projectName || f.path) + '</td>';
    body += '<td style="font-size:11px;white-space:nowrap">' + fmtB(f.size) + '</td>';
    body += '<td style="font-size:11px;white-space:nowrap;color:var(--text3)">' + ago(f.modified) + '</td>';
    body += '<td style="font-size:9px;max-width:300px;word-break:break-all;color:var(--text3)">' + esc(f.fullPath) + '</td>';
    body += '</tr>';
  });
  body += '</table></div>';
  showModal('Files in ' + categoryName + ' (' + cat.fileCount + ')', body, 'Close', null, true);
}
async function doCleanTracesPreview() {
  showProgress('Analyzing traces...');
  let preview;
  const exclusions = loadExclusions().exclusions;
  try {
    preview = await post('preview-traces', { operation: 'clean', options: { exclusions } });
  } catch (e) { hideProgress(); toast('Error: ' + e.message, 'error'); return; }
  hideProgress();
  if (!preview.success) { toast('Error: ' + (preview.error || 'Preview failed'), 'error'); return; }
  if (!preview.summary || preview.summary.totalFiles === 0) { toast('Nothing to clean (exclusions may be protecting files)', 'info'); return; }
  let body = '<div class="detail-panel">';
  body += '<div style="font-size:14px;font-weight:600;margin-bottom:16px">Will delete ' + preview.summary.totalFiles + ' files (' + fmtB(preview.summary.totalSize) + '):</div>';
  body += '<div style="max-height:250px;overflow-y:auto;margin-bottom:16px">';
  (preview.byCategory || []).forEach(c => {
    if (c.fileCount === 0) return;
    const col = c.sensitivity === 'critical' ? 'var(--red)' : c.sensitivity === 'high' ? 'var(--orange)' : c.sensitivity === 'medium' ? 'var(--yellow)' : 'var(--green)';
    body += '<div style="margin-bottom:12px">';
    body += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">';
    body += '<span style="background:' + col + ';color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">' + c.sensitivity.toUpperCase() + '</span>';
    body += '<span style="font-weight:600">' + esc(c.name) + '</span>';
    body += '<span style="color:var(--text3);font-size:12px">(' + c.fileCount + ' files, ' + fmtB(c.totalSize) + ')</span>';
    body += '</div>';
    body += '<div style="font-size:12px;color:var(--text3);margin-bottom:4px">' + esc(c.description) + '</div>';
    if (c.samplePaths?.length) {
      body += '<div style="font-family:var(--mono);font-size:11px;color:var(--text3);padding-left:12px">';
      c.samplePaths.slice(0, 3).forEach(p => { body += '> ' + esc(p) + '<br>'; });
      if (c.fileCount > 3) body += '...and ' + (c.fileCount - 3) + ' more<br>';
      body += '</div>';
    }
    body += '</div>';
  });
  body += '</div>';
  if (preview.preserved && preview.preserved.totalPreserved > 0) {
    body += '<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px">';
    body += '<div style="font-size:13px;font-weight:600;color:var(--green);margin-bottom:8px">✓ Will PRESERVE (' + preview.preserved.byExclusion.length + ' exclusions):</div>';
    preview.preserved.byExclusion.forEach(exc => {
      body += '<div style="font-size:12px;color:var(--text2);margin-bottom:4px">• ' + esc(exc.exclusion.type) + ' "' + esc(exc.exclusion.value) + '": ' + exc.matchedFiles + ' files</div>';
    });
    body += '</div>';
  }
  body += '</div>';
  showModal('Clean Traces Preview', body, 'Clean ' + preview.summary.totalFiles + ' Files', async () => {
    showProgress('Cleaning traces...');
    const r = await post('clean-traces', { dryRun: false, exclusions });
    showResult(true, 'Traces Cleaned',
      '<span>Deleted: <strong>' + r.deleted + '</strong> files</span>' +
      '<span>Freed: <strong>' + fmtB(r.freed) + '</strong></span>' +
      '<span>Categories: ' + (r.categoriesAffected?.join(', ') || 'all') + '</span>',
      ['traces', 'overview'], r.items);
  }, true);
}
async function doCleanTracesExecute() {
  const exclusions = loadExclusions().exclusions;
  showModal('Clean All Traces', 'This will permanently delete trace files (respecting your exclusions). Continue?', 'Clean Now', async () => {
    showProgress('Cleaning traces...');
    const r = await post('clean-traces', { dryRun: false, exclusions });
    showResult(true, 'Traces Cleaned', '<span>Deleted: <strong>' + r.deleted + '</strong> files</span><span>Freed: <strong>' + fmtB(r.freed) + '</strong></span>', ['traces', 'overview'], r.items);
  });
}
async function doWipeTraces() {
  showProgress('Analyzing traces...');
  wipeState = { step: 1, preview: null, confirmPhrase: 'WIPE ALL', userInput: '' };
  const exclusions = loadExclusions().exclusions;
  const preview = await post('preview-traces', { operation: 'wipe', options: { exclusions } });
  hideProgress();
  if (!preview.success) {
    toast('Could not analyze traces', 'error');
    return;
  }
  if (preview.summary.totalFiles === 0) {
    toast('Nothing to wipe (exclusions may be protecting all files)', 'info');
    return;
  }
  wipeState.preview = preview;
  showWipeStep1();
}
async function doPreviewFinding(file, line) {
  showProgress('Loading preview...');
  try {
    const r = await fetch('/api/security/finding/' + encodeURIComponent(file) + '/' + line);
    hideProgress();
    if (!r.ok) { toast('Could not load preview', 'error'); return; }
    const d = await r.json();
    const body = '<p style="font-size:12px;color:var(--text3)">File: ' + esc(file.split('/').pop()) + ' | Line: ' + line + ' | Total lines: ' + (d.totalLines || '?') + '</p><pre>' + esc(d.preview || d.raw || 'No content') + '</pre>';
    showModal('Finding Preview', body, 'Close', () => { }, true);
  } catch (e) { hideProgress(); toast('Preview failed', 'error'); }
}
async function doRedact(file, line, pattern) {
  showModal('Redact Secret', 'This will replace the secret on line ' + line + ' with [REDACTED]. A backup of the file will be created first.', 'Redact', async () => {
    showProgress('Redacting secret...');
    const r = await post('redact', { file: file, line: line, pattern: pattern });
    if (r.success) { showResult(true, 'Secret Redacted', '<span>Secrets redacted: <strong>' + r.redactedCount + '</strong></span><span>Backup: ' + esc(r.backupPath?.split('/').pop() || 'created') + '</span>', ['security', 'overview'], r.backupPath ? [r.backupPath] : null); }
    else { showResult(false, 'Redaction Failed', '<span>' + esc(r.error || 'Unknown error') + '</span>'); }
  });
}
async function doRedactAll() {
  showModal('Redact ALL Secrets', 'This will redact ALL detected secrets across ALL conversation files. Backups will be created for each modified file. This action cannot be undone (except by restoring backups).', 'Redact All', async () => {
    showProgress('Redacting all secrets...');
    const r = await post('redact-all');
    if (r.success) { showResult(true, 'All Secrets Redacted', '<span>Files modified: <strong>' + r.filesModified + '</strong></span><span>Secrets redacted: <strong>' + r.secretsRedacted + '</strong></span>' + (r.errors?.length ? '<span class="c-orange">Errors: ' + r.errors.length + '</span>' : ''), ['security', 'overview', 'backups'], r.items); }
    else { showResult(false, 'Redaction Failed', '<span>' + esc(r.error || 'Unknown error') + '</span>'); }
  });
}
async function doRedactPII(file, line, piiType) {
  showModal('Redact PII', 'This will replace the PII on line ' + line + ' with [PII_REDACTED]. A backup of the file will be created first.', 'Redact', async () => {
    showProgress('Redacting PII...');
    const r = await post('redact-pii', { file: file, line: line, type: piiType });
    if (r.success) { showResult(true, 'PII Redacted', '<span>Items redacted: <strong>' + r.redactedCount + '</strong></span><span>Backup: ' + esc(r.backupPath?.split('/').pop() || 'created') + '</span>', ['security', 'overview'], r.backupPath ? [r.backupPath] : null); }
    else { showResult(false, 'Redaction Failed', '<span>' + esc(r.error || 'Unknown error') + '</span>'); }
  });
}
async function doRedactAllPII() {
  showModal('Redact ALL PII', 'This will redact ALL detected personal identifiable information (PII) across ALL conversation files. Backups will be created for each modified file. This action cannot be undone (except by restoring backups).', 'Redact All PII', async () => {
    showProgress('Redacting all PII...');
    const r = await post('redact-all-pii');
    if (r.success) { showResult(true, 'All PII Redacted', '<span>Files modified: <strong>' + r.filesModified + '</strong></span><span>PII items redacted: <strong>' + r.piiRedacted + '</strong></span>' + (r.errors?.length ? '<span class="c-orange">Errors: ' + r.errors.length + '</span>' : ''), ['security', 'overview', 'backups'], r.items); }
    else { showResult(false, 'Redaction Failed', '<span>' + esc(r.error || 'Unknown error') + '</span>'); }
  });
}
function renderPIITable(findings, showDetails) {
  let h = '<div style="overflow-x:auto"><table style="width:100%;min-width:900px">';
  h += '<tr><th style="width:80px">Severity</th><th style="width:100px">Type</th><th style="width:200px">Exact Value</th><th>Full Project Path</th><th style="width:320px">File Location</th><th style="width:80px">Actions</th></tr>';
  findings.forEach(f => {
    const sevBadge = f.sensitivity === 'high' ? badge('high', 'red') : f.sensitivity === 'medium' ? badge('medium', 'orange') : badge('low', 'green');
    const fullFilePath = f.file || '';
    const fileName = fullFilePath.split('/').pop() || '';
    const projectMatch = fullFilePath.match(/projects\\/([^\\/]+)/);
    const projectEncoded = projectMatch ? projectMatch[1] : '';
    const projectPath = projectEncoded.replace(/-/g, '/');
    const exactValue = f.fullValue || f.maskedValue || '';
    const fp = esc(f.file);
    h += '<tr>';
    h += '<td>' + sevBadge + '</td>';
    h += '<td style="font-size:12px">' + esc(f.type) + '</td>';
    h += '<td class="mono" style="color:var(--red);font-weight:600;word-break:break-all">' + esc(exactValue) + '</td>';
    h += '<td class="mono" style="word-break:break-all;font-size:11px;color:var(--text2)">' + esc(projectPath) + '</td>';
    h += '<td class="mono" style="font-size:11px"><div style="word-break:break-all;color:var(--accent)">' + esc(fileName) + '</div><div style="color:var(--text3)">Line <strong>' + f.line + '</strong> • <span style="font-size:10px;opacity:0.7">' + esc(fullFilePath) + '</span></div></td>';
    h += '<td><button class="btn btn-sm btn-danger" onclick="doRedactPII(\\''+fp+'\\',' + f.line + ',\\''+esc(f.type||'')+'\\')">Redact</button></td>';
    h += '</tr>';
  });
  h += '</table></div>';
  return h;
}
async function loadMorePII(count) {
  if (!window._piiState) return;
  showProgress('Loading more PII findings...');
  const pii = await api('pii?limit=' + count + '&offset=0');
  hideProgress();
  if (pii) {
    window._piiState.offset = pii.findings.length;
    const container = $('#pii-findings-container');
    if (container) {
      container.innerHTML = renderPIITable(pii.findings, true);
      const header = container.previousElementSibling;
      if (header) header.innerHTML = 'Findings (showing ' + pii.findings.length + ' of ' + pii.totalFindings + ')';
    }
  }
}
async function doTestMcp() {
  showProgress('Testing MCP servers...');
  const r = await post('test-mcp');
  hideProgress();
  let h = '<div class="detail-panel">';
  h += '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:16px">';
  h += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;text-align:center"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;font-weight:600;letter-spacing:0.5px;margin-bottom:2px">Total</div><div style="font-size:20px;font-weight:700">' + r.totalServers + '</div></div>';
  h += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;text-align:center"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;font-weight:600;letter-spacing:0.5px;margin-bottom:2px">Healthy</div><div style="font-size:20px;font-weight:700;color:var(--green)">' + r.healthyServers + '</div></div>';
  h += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;text-align:center"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;font-weight:600;letter-spacing:0.5px;margin-bottom:2px">Failed</div><div style="font-size:20px;font-weight:700;color:var(--red)">' + (r.totalServers - r.healthyServers) + '</div></div>';
  h += '</div>';
  if (r.configs) {
    h += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden">';
    r.configs.forEach(c => {
      c.servers.forEach(s => {
        const ok = !c.issues.some(i => i.server === s.name && i.severity === 'error');
        h += '<div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">';
        h += '<div style="display:flex;align-items:center;gap:8px"><span class="status-dot ' + (ok ? 'dot-green' : 'dot-red') + '"></span><span style="font-weight:500;font-size:13px">' + esc(s.name) + '</span></div>';
        h += '<span class="badge ' + (ok ? 'b-green' : 'b-red') + '">' + (ok ? 'Pass' : 'Fail') + '</span>';
        h += '</div>';
      });
    });
    h += '</div>';
  }
  if (r.recommendations?.length) {
    h += '<div style="margin-top:12px;font-size:12px;font-weight:600;color:var(--text2);margin-bottom:6px">Recommendations</div>';
    r.recommendations.forEach(rec => { h += '<div style="padding:4px 0;font-size:12px;color:var(--text3)">&#8226; ' + esc(rec) + '</div>'; });
  }
  h += '</div>';
  showModal('MCP Server Test Results', h, 'Close', null, true);
}
async function doDeleteBackups() {
  showModal('Delete Old Backups', 'This will delete all backup files older than 7 days. This cannot be undone.', 'Delete', async () => {
    showProgress('Deleting old backups...');
    const r = await post('delete-backups', { days: 7 });
    if (r.success) { showResult(true, 'Backups Cleaned', '<span>Deleted: <strong>' + r.deleted + '</strong> backup(s)</span>', ['backups', 'storage', 'overview'], r.items); }
    else { showResult(false, 'Delete Failed', '<span>' + esc(r.error || 'Unknown error') + '</span>'); }
  });
}
async function doRestore(backupPath) {
  showModal('Restore Backup', 'This will restore the conversation from this backup, replacing the current file. Continue?', 'Restore', async () => {
    showProgress('Restoring from backup...');
    const r = await post('restore', { backupPath: backupPath });
    if (r.success) { showResult(true, 'Backup Restored', '<span>Restored to: <strong>' + esc(r.originalPath?.split('/').pop() || 'original') + '</strong></span>', ['backups', 'sessions', 'overview'], r.originalPath ? [r.originalPath] : null); }
    else { showResult(false, 'Restore Failed', '<span>' + esc(r.error || 'Unknown error') + '</span>'); }
  });
}
async function doArchive() {
  showModal('Archive Conversations', 'This will archive conversations inactive for 30+ days. They can be restored later from backups.', 'Archive', async () => {
    showProgress('Archiving conversations...');
    const r = await post('archive', { dryRun: false, days: 30 });
    if (r.success) { showResult(true, 'Archive Complete', '<span>Archived: <strong>' + r.archived + '</strong> conversations</span><span>Space freed: <strong>' + fmtB(r.spaceFreed) + '</strong></span>', ['maintenance', 'overview', 'sessions'], r.items); }
    else { showResult(false, 'Archive Failed', '<span>' + esc(r.error || 'Unknown error') + '</span>'); }
  });
}
async function doMaintenance() {
  showModal('Run Maintenance', 'This will execute all pending maintenance actions (cleanup empty files, remove orphans, optimize storage). Continue?', 'Run Maintenance', async () => {
    showProgress('Running maintenance...');
    const r = await post('maintenance', { auto: true });
    if (r.success) {
      let det = '<span>Actions performed: <strong>' + r.actionsPerformed + '</strong></span>';
      const actionItems = r.actions?.map(a => a.type + ': ' + a.description) || [];
      showResult(true, 'Maintenance Complete', det, ['maintenance', 'overview', 'storage'], actionItems);
    } else { showResult(false, 'Maintenance Failed', '<span>' + esc(r.error || 'Unknown error') + '</span>'); }
  });
}

function toggleMcpServer(id) {
  const el = $('#' + id); const arrow = $('#' + id + '-arrow');
  if (!el) return;
  if (el.style.display === 'none') { el.style.display = 'block'; if (arrow) arrow.innerHTML = '&#9660;'; }
  else { el.style.display = 'none'; if (arrow) arrow.innerHTML = '&#9654;'; }
}
async function probeMcpServer(name) {
  const srvId = 'mcp-srv-' + name.replace(/[^a-zA-Z0-9]/g, '_');
  const capsEl = $('#' + srvId + '-caps'); const badgeEl = $('#' + srvId + '-badge');
  if (capsEl) capsEl.innerHTML = '<div style="color:var(--text3);font-size:11px">Probing server...</div>';
  try {
    const resp = await fetch('/api/mcp/server/' + encodeURIComponent(name) + '/capabilities');
    const data = await resp.json();
    if (!resp.ok || data.error) {
      if (capsEl) capsEl.innerHTML = '<div style="color:var(--red);font-size:11px">Error: ' + (data.error || 'Failed to probe') + '</div>';
      if (badgeEl) badgeEl.textContent = 'error';
      return;
    }
    let h = '';
    const toolCount = data.tools?.length || 0;
    const resCount = data.resources?.length || 0;
    const promptCount = data.prompts?.length || 0;
    if (badgeEl) badgeEl.textContent = toolCount + ' tools, ' + resCount + ' res';
    if (data.serverInfo?.name || data.serverInfo?.version) {
      h += '<div style="font-size:11px;color:var(--text2);margin-bottom:8px"><strong>Server:</strong> ' + (data.serverInfo.name || 'Unknown') + ' v' + (data.serverInfo.version || '?') + '</div>';
    }
    h += '<div style="font-size:11px;color:var(--text3);margin-bottom:4px">Probe time: ' + data.probeTime + 'ms</div>';
    if (toolCount > 0) {
      h += '<div style="margin-top:10px"><div style="font-size:11px;font-weight:600;color:var(--accent);margin-bottom:4px">Tools (' + toolCount + ')</div>';
      h += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
      data.tools.slice(0, 20).forEach(t => { h += '<span title="' + (t.description || 'No description').replace(/"/g, '&quot;') + '" style="background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:2px 6px;font-size:10px;cursor:help">' + esc(t.name) + '</span>'; });
      if (toolCount > 20) h += '<span style="font-size:10px;color:var(--text3)">+' + Math.max(toolCount - 20, 0) + ' more</span>';
      h += '</div></div>';
    }
    if (resCount > 0) {
      h += '<div style="margin-top:10px"><div style="font-size:11px;font-weight:600;color:var(--green);margin-bottom:4px">Resources (' + resCount + ')</div>';
      h += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
      data.resources.slice(0, 10).forEach(r => { h += '<span title="' + (r.description || r.uri || '').replace(/"/g, '&quot;') + '" style="background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:2px 6px;font-size:10px;cursor:help">' + (r.name || r.uri.split('/').pop() || r.uri) + '</span>'; });
      if (resCount > 10) h += '<span style="font-size:10px;color:var(--text3)">+' + Math.max(resCount - 10, 0) + ' more</span>';
      h += '</div></div>';
    }
    if (promptCount > 0) {
      h += '<div style="margin-top:10px"><div style="font-size:11px;font-weight:600;color:var(--orange);margin-bottom:4px">Prompts (' + promptCount + ')</div>';
      h += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
      data.prompts.slice(0, 10).forEach(p => { h += '<span title="' + (p.description || 'No description').replace(/"/g, '&quot;') + '" style="background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:2px 6px;font-size:10px;cursor:help">' + esc(p.name) + '</span>'; });
      if (promptCount > 10) h += '<span style="font-size:10px;color:var(--text3)">+' + Math.max(promptCount - 10, 0) + ' more</span>';
      h += '</div></div>';
    }
    if (toolCount === 0 && resCount === 0 && promptCount === 0) { h += '<div style="color:var(--text3);font-size:11px;margin-top:8px">No tools, resources, or prompts discovered</div>'; }
    if (capsEl) capsEl.innerHTML = h;
    const parentEl = $('#' + srvId);
    if (parentEl && parentEl.style.display === 'none') toggleMcpServer(srvId);
  } catch (e) {
    if (capsEl) capsEl.innerHTML = '<div style="color:var(--red);font-size:11px">Error: ' + e.message + '</div>';
    if (badgeEl) badgeEl.textContent = 'error';
  }
}
function showAddMcpModal() {
  let body = '<div style="text-align:left">';
  body += '<div style="margin-bottom:12px"><label style="display:block;font-size:12px;font-weight:500;margin-bottom:4px">Server Name *</label><input id="addMcpName" type="text" placeholder="my-server" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text)"></div>';
  body += '<div style="margin-bottom:12px"><label style="display:block;font-size:12px;font-weight:500;margin-bottom:4px">Command *</label><input id="addMcpCmd" type="text" placeholder="node, npx, python, etc." style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text)"></div>';
  body += '<div style="margin-bottom:12px"><label style="display:block;font-size:12px;font-weight:500;margin-bottom:4px">Arguments (space separated)</label><input id="addMcpArgs" type="text" placeholder="/path/to/server.js --port 3000" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text)"></div>';
  body += '<div style="margin-bottom:12px"><label style="display:block;font-size:12px;font-weight:500;margin-bottom:4px">Environment Variables (KEY=value, one per line)</label><textarea id="addMcpEnv" placeholder="API_KEY=xxx\\nDEBUG=true" rows="3" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-family:monospace"></textarea></div>';
  body += '<div style="margin-bottom:12px"><label style="display:block;font-size:12px;font-weight:500;margin-bottom:4px">Config Target</label><select id="addMcpTarget" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text)"><option value="global">Global (~/.claude.json)</option><option value="project">Project (.mcp.json)</option></select></div>';
  body += '<div style="font-size:11px;color:var(--text3);margin-top:8px">MCP servers extend Claude Code with custom tools and resources.</div>';
  body += '</div>';
  showModal('Add MCP Server', body, 'Add Server', async () => {
    const name = $('#addMcpName')?.value?.trim();
    const cmd = $('#addMcpCmd')?.value?.trim();
    const argsRaw = $('#addMcpArgs')?.value?.trim();
    const envRaw = $('#addMcpEnv')?.value?.trim();
    const target = $('#addMcpTarget')?.value || 'global';
    if (!name || !cmd) { toast('Name and command are required', 'error'); return; }
    const args = argsRaw ? argsRaw.split(/\\s+/).filter(a => a) : [];
    const env = {};
    if (envRaw) { envRaw.split('\\n').forEach(line => { const [k, ...v] = line.split('='); if (k) env[k.trim()] = v.join('=').trim(); }); }
    showProgress('Adding MCP server...');
    const r = await post('add-mcp-server', { name, command: cmd, args, env, target });
    hideProgress();
    if (r.success) { toast('MCP server added: ' + name, 'success'); loadTab('mcp'); }
    else { toast('Failed: ' + (r.error || 'Unknown error'), 'error'); }
  }, true);
}

function showSettings() {
  $('#settingsModal').classList.add('active');
  api('config').then(c => {
    if (c.settings && c.settings.content) {
      try {
        const s = JSON.parse(c.settings.content);
        if (s.scanner) {
          $('#setConfigMinText').value = s.scanner.minTextSize || '';
          $('#setConfigMinBase64').value = s.scanner.minBase64Size || '';
        }
      } catch { }
    }
  });
}

async function saveSettings() {
  const minText = parseInt($('#setConfigMinText').value, 10);
  const minBase64 = parseInt($('#setConfigMinBase64').value, 10);

  if (isNaN(minText) && isNaN(minBase64)) { toast('Please enter valid numbers', 'error'); return; }

  showProgress('Saving settings...');
  try {
    const c = await api('config');
    let settings = {};
    if (c.settings && c.settings.content) {
      try { settings = JSON.parse(c.settings.content); } catch { }
    }

    if (!settings.scanner) settings.scanner = {};
    if (!isNaN(minText)) settings.scanner.minTextSize = minText;
    if (!isNaN(minBase64)) settings.scanner.minBase64Size = minBase64;

    const r = await post('action/save-config', { type: 'settings', content: JSON.stringify(settings, null, 2) });
    hideProgress();
    if (r.success) {
      toast('Settings saved successfully', 'success');
      $('#settingsModal').classList.remove('active');
    } else {
      toast('Failed to save: ' + r.error, 'error');
    }
  } catch (e) {
    hideProgress();
    toast('Error: ' + e.message, 'error');
  }
}


async function loadSnapshots() {
  showProgress('Loading snapshots...');
  const r = await api('snapshots');
  hideProgress();
  const tbody = $('#snapshotTableBody');
  if(!tbody) return;
  tbody.innerHTML = '';
  
  if(!r.snapshots || r.snapshots.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3)">No snapshots found</td></tr>';
    return;
  }
  
  r.snapshots.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = \`
      <td>\${new Date(s.date).toLocaleString()}</td>
      <td>\${esc(s.label)}</td>
      <td>\${fmtB(s.size)}</td>
      <td style="font-family:var(--mono);font-size:12px">\${s.id}</td>
      <td>
        <button class="btn-small" onclick="doCompareSelection('\${s.id}')">Compare</button>
        <button class="btn-small btn-danger" onclick="doDeleteSnapshot('\${s.id}')">Delete</button>
      </td>
    \`;
    tbody.appendChild(tr);
  });
}

async function doTakeSnapshot() {
  showModal('Take Snapshot', 'Label for this snapshot:', 'Create', async () => {
    const label = $('#snapshotLabelInput')?.value || 'Manual Snapshot';
    showProgress('Taking snapshot...');
    const r = await post('snapshot', { label });
    hideProgress();
    if(r.success) { toast('Snapshot created', 'success'); loadSnapshots(); }
    else { toast('Failed: '+r.error, 'error'); }
  });
  // Inject input into modal body (hacky but works with current showModal)
  setTimeout(() => {
    const body = document.querySelector('.modal-body');
    if(body) body.innerHTML = '<input id="snapshotLabelInput" type="text" placeholder="e.g. Before cleanup" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);margin-top:8px">';
  }, 50);
}

async function doDeleteSnapshot(id) {
  if(!confirm('Delete this snapshot?')) return;
  showProgress('Deleting...');
  const r = await post('delete-snapshot', { id });
  hideProgress();
  if(r.success) { toast('Deleted', 'success'); loadSnapshots(); }
  else { toast('Failed: '+r.error, 'error'); }
}

let compareBase = null;
function doCompareSelection(id) {
  if(!compareBase) {
    compareBase = id;
    toast('Select another snapshot to compare with', 'info');
    // Visual feedback?
    $$('#snapshotTableBody tr').forEach(tr => {
       if(tr.innerHTML.includes(id)) tr.style.background = 'rgba(var(--accent-rgb), 0.1)';
    });
  } else {
    doCompareSnapshots(compareBase, id);
    compareBase = null;
    loadSnapshots(); // reset visual state
  }
}

async function doCompareSnapshots(id1, id2) {
  showProgress('Comparing...');
  const r = await fetch(\`/api/compare?base=\${id1}&current=\${id2}\`).then(res => res.json());
  hideProgress();
  
  if(!r.success) { toast('Comparison failed: '+r.error, 'error'); return; }
  
  const d = r.diff;
  let html = \`<div class="detail-panel">\`;
  html += \`<div style="display:flex;justify-content:space-between;margin-bottom:16px">
    <div><strong>Base:</strong> \${new Date(r.baseDate).toLocaleString()}</div>
    <div><strong>Current:</strong> \${new Date(r.currentDate).toLocaleString()}</div>
  </div>\`;
  
  const sizeDiffStr = (d.sizeDiff > 0 ? '+' : '') + fmtB(d.sizeDiff);
  const color = d.sizeDiff > 0 ? 'var(--red)' : (d.sizeDiff < 0 ? 'var(--green)' : 'var(--text)');
  
  html += \`<div style="text-align:center;margin-bottom:20px">
    <div style="font-size:12px;color:var(--text3)">Total Size Change</div>
    <div style="font-size:24px;font-weight:700;color:\${color}">\${sizeDiffStr}</div>
    <div style="font-size:12px;color:var(--text3)">\${d.fileCountDiff > 0 ? '+' : ''}\${d.fileCountDiff} files</div>
  </div>\`;
  
  html += \`<table class="data-table" style="font-size:13px"><thead><tr><th>Category</th><th>Size Diff</th><th>Files Diff</th></tr></thead><tbody>\`;
  d.categoryDiffs.forEach(c => {
    if(c.sizeDiff === 0 && c.fileDiff === 0) return;
    const sDiff = (c.sizeDiff > 0 ? '+' : '') + fmtB(c.sizeDiff);
    const fDiff = (c.fileDiff > 0 ? '+' : '') + c.fileDiff;
    const sColor = c.sizeDiff > 0 ? 'var(--red)' : (c.sizeDiff < 0 ? 'var(--green)' : 'var(--text2)');
    html += \`<tr><td>\${esc(c.name)}</td><td style="color:\${sColor}">\${sDiff}</td><td>\${fDiff}</td></tr>\`;
  });
  html += \`</tbody></table></div>\`;
  
  showModal('Snapshot Comparison', html, 'Close', null, true);
}

const loaders = { overview: loadOverview, search: loadSearchTab, storage: loadStorage, sessions: loadSessions, security: loadSecurity, traces: loadTraces, mcp: loadMcp, logs: loadLogs, config: loadConfig, analytics: loadAnalytics, backups: loadBackups, context: loadContext, maintenance: loadMaintenance, snapshots: loadSnapshots, about: loadAbout };
loadTab('overview');
</script>
  </body>
  </html>`;
}
