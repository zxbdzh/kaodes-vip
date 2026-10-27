import fs from "node:fs/promises";
import path from "node:path";

const ROOT = "F:/github/kaodes_vip";
const DATA = path.join(ROOT, "data");

const catalog = JSON.parse(await fs.readFile(path.join(DATA, "catalog.json"), "utf8"));

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>自考计算机课程库</title>
<script src="https://live-cdn.baijiayun.com/bplayer/1.10.52/bplayer.js"></script>
<script src="https://live-cdn.baijiayun.com/bplayer/1.10.52/dep/ffplayer.js"></script>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;background:#0f1115;color:#e6e8ee;height:100vh;display:flex;overflow:hidden}
  #side{width:390px;border-right:1px solid #23262f;display:flex;flex-direction:column;background:#14161c;flex-shrink:0}
  #head{padding:14px 16px;border-bottom:1px solid #23262f}
  #head h1{margin:0 0 4px;font-size:15px;font-weight:600}
  #head p{margin:0;font-size:11px;color:#6f7585}
  #search{margin-top:10px;width:100%;padding:7px 10px;border-radius:6px;border:1px solid #2b2f3a;background:#0e1016;color:#e6e8ee;font-size:13px;outline:none}
  #search:focus{border-color:#3d6fd4}
  #tree{flex:1;overflow-y:auto;padding:6px 0 40px}
  .sub{padding:9px 16px;cursor:pointer;font-size:13px;font-weight:600;color:#cfd4e0;border-left:3px solid transparent;user-select:none}
  .sub:hover{background:#1b1e26}
  .sub.active{border-left-color:#4c8bf5;color:#8ab4f8;background:#191d26}
  .sub small{float:right;color:#6b7183;font-weight:400;font-size:11px}
  .vids{display:none;padding-left:6px}
  .vids.open{display:block}
  .vid{padding:6px 14px 6px 22px;font-size:12px;color:#9aa1b2;cursor:pointer;line-height:1.5;border-left:2px solid transparent}
  .vid:hover{background:#1a1d25;color:#d5dae6}
  .vid.active{border-left-color:#4c8bf5;color:#8ab4f8;background:#181c24}
  .vid .t{color:#5d6375;font-size:11px;margin-left:6px;float:right}
  #main{flex:1;display:flex;flex-direction:column;min-width:0}
  #topbar{padding:11px 18px;border-bottom:1px solid #23262f;font-size:12px;color:#aab0be;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #topbar b{color:#e6e8ee;font-weight:600}
  #stage{flex:1;background:#000;position:relative;min-height:0}
  #playerPreview{width:100%;height:100%}
  #empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#4d5364;font-size:14px;line-height:2.2;text-align:center}
  #tools{padding:10px 18px;border-top:1px solid #23262f;display:flex;gap:9px;align-items:center;font-size:12px}
  button{padding:7px 14px;border-radius:6px;border:1px solid #2f3542;background:#1c2029;color:#cfd4e0;cursor:pointer;font-size:12px}
  button:hover:not(:disabled){background:#252b36;border-color:#3d4657}
  button:disabled{opacity:.35;cursor:not-allowed}
  button.primary{background:#2b5fd9;border-color:#2b5fd9;color:#fff}
  button.primary:hover:not(:disabled){background:#3468e2}
  #status{color:#7d8394;margin-left:auto}
  .kbd{padding:1px 6px;background:#232833;border-radius:4px;color:#8f96a8;font-size:11px}
</style>
</head>
<body>
<div id="side">
  <div id="head">
    <h1>自考计算机 · 课程库</h1>
    <p>集美大学 080901 · 华侨大学 080902</p>
    <input id="search" placeholder="筛选科目 / 课程代码…">
  </div>
  <div id="tree"></div>
</div>
<div id="main">
  <div id="topbar">选择左侧科目与视频</div>
  <div id="stage">
    <div id="playerPreview"></div>
    <div id="empty">← 选择视频<br><span style="font-size:12px">点击「播放」加载</span></div>
  </div>
  <div id="tools">
    <button id="loadBtn" class="primary" disabled>播放</button>
    <button id="nextBtn" disabled>下一讲</button>
    <span id="status">就绪 · 共 ${catalog.subjects.reduce((a, s) => a + s.videoCount, 0)} 讲</span>
  </div>
</div>
<script>
const CATALOG = ${JSON.stringify(catalog.subjects)};
const API = "http://127.0.0.1:8899";
let current = null, player = null;
const flat = [];

const tree = document.getElementById("tree");
const topbar = document.getElementById("topbar");
const statusEl = document.getElementById("status");
const loadBtn = document.getElementById("loadBtn");
const nextBtn = document.getElementById("nextBtn");
const emptyEl = document.getElementById("empty");

function render(filter) {
  tree.innerHTML = "";
  for (const s of CATALOG) {
    if (filter && !(s.name.includes(filter) || String(s.code).includes(filter))) continue;
    const head = document.createElement("div");
    head.className = "sub";
    head.innerHTML = s.code + " " + s.name + "<small>" + s.videoCount + "讲</small>";
    const box = document.createElement("div");
    box.className = "vids";
    head.onclick = () => {
      const open = box.classList.toggle("open");
      document.querySelectorAll(".sub").forEach((x) => x.classList.remove("active"));
      if (open) head.classList.add("active");
    };
    s.videos.forEach((v, i) => {
      const item = document.createElement("div");
      item.className = "vid";
      const label = v.path.split(" > ").slice(-1)[0] || v.path;
      item.innerHTML = "<span class='t'>" + (v.duration || "") + "</span>" + label;
      item.title = v.path;
      const entry = { s, v, item };
      flat.push(entry);
      item.onclick = (ev) => {
        ev.stopPropagation();
        select(entry, true);
      };
      box.appendChild(item);
    });
    tree.appendChild(head);
    tree.appendChild(box);
  }
}
render("");

function select(entry, autoLoad) {
  document.querySelectorAll(".vid").forEach((x) => x.classList.remove("active"));
  entry.item.classList.add("active");
  current = entry;
  const { s, v } = entry;
  topbar.innerHTML = "<b>" + s.code + " " + s.name + "</b> · " + v.path;
  loadBtn.disabled = false;
  const idx = flat.indexOf(entry);
  nextBtn.disabled = idx >= flat.length - 1;
  if (autoLoad) load();
}

async function load() {
  if (!current) return;
  const { s, v } = current;
  loadBtn.disabled = true;
  statusEl.textContent = "正在签发播放凭据…";
  try {
    const q = new URLSearchParams({
      vid: v.vid, cstId: s.cstId, courseId: s.courseId,
      catId: v.catId, materialType: v.materialType,
    });
    const r = await fetch(API + "/play?" + q);
    const j = await r.json();
    if (!j.ok) { statusEl.textContent = "失败：" + (j.error || "未知"); loadBtn.disabled = false; return; }

    emptyEl.style.display = "none";
    try { if (player && player.destroy) player.destroy(); } catch (e) {}
    document.getElementById("playerPreview").innerHTML = "";

    player = new window.BPlayer({
      container: document.getElementById("playerPreview"),
      memory: true,
      vid: v.vid,
      token: j.token,
      autoplay: true,
      enableLoop: false,
      enableDrag: true,
      enableWaterMark: false,
      useFFplayerMSE: true,
      user: { name: "a13159233471-7962", number: "8319835" },
    });

    statusEl.textContent = "已加载 · " + (j.quality || "") + (j.duration ? " · " + Math.round(j.duration / 60) + " 分钟" : "");
    loadBtn.disabled = false;
  } catch (e) {
    statusEl.textContent = "错误：" + e.message + "（确认已运行 serve.mjs）";
    loadBtn.disabled = false;
  }
}

loadBtn.onclick = load;
nextBtn.onclick = () => {
  const i = flat.indexOf(current);
  if (i >= 0 && i < flat.length - 1) select(flat[i + 1], true);
};
document.getElementById("search").oninput = (e) => render(e.target.value.trim());
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && current) load();
  if (e.key === "ArrowRight" && !nextBtn.disabled) nextBtn.click();
});
</script>
</body>
</html>`;

await fs.writeFile(path.join(ROOT, "player.html"), html, "utf8");
console.log("player.html 已更新，科目:", catalog.subjects.length, "视频:", catalog.subjects.reduce((a, s) => a + s.videoCount, 0));
