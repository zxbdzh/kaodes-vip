// 考得尚解锁器 - 内容脚本
// 功能：内置课程库播放器（758 讲）+ 题库练习（1903 题）
(function () {
  "use strict";

  const log = (...a) => console.log("[KDS]", ...a);

  const S = {
    catalog: null, bank: null, cur: null, player: null,
    tab: "video", subject: null, mode: "chapter",
    chapter: null, paper: null, random: false, limit: 20,
  };

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // 调用后台
  function bg(cmd, extra) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(Object.assign({ cmd }, extra || {}), (r) => {
        if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
        else resolve(r || { ok: false, error: "无响应" });
      });
    });
  }

  async function loadData() {
    if (!S.catalog) {
      try { S.catalog = await (await fetch(chrome.runtime.getURL("catalog.json"))).json(); log("课程库", S.catalog.subjects.length); }
      catch (e) { log("课程库失败", e.message); }
    }
    if (!S.bank) {
      try { S.bank = await (await fetch(chrome.runtime.getURL("bank.json"))).json(); log("题库", S.bank.total); }
      catch (e) { log("题库失败", e.message); }
    }
  }

  const CSS = `
    #kds-root{position:fixed;right:20px;bottom:86px;z-index:2147483000;font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
    #kds-fab{width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#2b5fd9,#4c8bf5);color:#fff;
      display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 22px rgba(43,95,217,.5);
      font-size:20px;font-weight:700;user-select:none;transition:transform .15s;position:relative}
    #kds-fab:hover{transform:scale(1.08)}
    #kds-fab i{position:absolute;top:7px;right:7px;width:8px;height:8px;border-radius:50%;background:#4ade80;border:2px solid #14161c}
    #kds-win{position:fixed;right:20px;bottom:152px;width:min(1120px,calc(100vw - 60px));height:min(720px,calc(100vh - 190px));
      background:#0f1115;border:1px solid #262b36;border-radius:14px;box-shadow:0 24px 70px rgba(0,0,0,.78);
      display:none;overflow:hidden;color:#e6e8ee;grid-template-columns:340px 1fr}
    #kds-win.on{display:grid}
    #kds-side{background:#14161c;border-right:1px solid #262b36;display:flex;flex-direction:column;min-width:0}
    #kds-side .top{padding:12px 14px;border-bottom:1px solid #262b36}
    #kds-side .top h3{margin:0 0 3px;font-size:13px;font-weight:600}
    #kds-side .top p{margin:0;font-size:10.5px;color:#6d7484}
    #kds-tabs{display:flex;gap:5px;margin-top:10px}
    #kds-tabs b{flex:1;text-align:center;padding:6px 0;border-radius:6px;background:#1c2029;color:#98a0b0;cursor:pointer;font-size:11.5px;font-weight:500}
    #kds-tabs b.on{background:#2b5fd9;color:#fff}
    #kds-search{width:100%;margin-top:9px;padding:6px 9px;border-radius:6px;border:1px solid #2b303c;background:#0e1016;color:#e6e8ee;font-size:12px;outline:none}
    #kds-list{flex:1;overflow-y:auto;padding:6px 0 30px}
    #kds-main{display:flex;flex-direction:column;min-width:0;background:#0f1115}
    #kds-bar{padding:10px 16px;border-bottom:1px solid #262b36;font-size:11.5px;color:#98a0b0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #kds-bar b{color:#e6e8ee}
    #kds-stage{flex:1;background:#000;position:relative;min-height:0;overflow:auto}
    #kds-player{width:100%;height:100%}
    #kds-player iframe{width:100%;height:100%;border:0}
    #kds-hint{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#4d5364;font-size:13px;line-height:2.1;text-align:center}
    #kds-foot{padding:9px 16px;border-top:1px solid #262b36;display:flex;gap:8px;align-items:center;font-size:11px}
    #kds-foot button{padding:6px 13px;border-radius:6px;border:1px solid #2f3542;background:#1c2029;color:#cfd4e0;cursor:pointer;font-size:11.5px}
    #kds-foot button:hover:not(:disabled){background:#252b36}
    #kds-foot button.pri{background:#2b5fd9;border-color:#2b5fd9;color:#fff}
    #kds-foot button:disabled{opacity:.35;cursor:not-allowed}
    #kds-st{margin-left:auto;color:#6d7484}
    .kds-sub{padding:8px 14px;cursor:pointer;font-size:12.5px;font-weight:600;color:#cbd0dc;border-left:3px solid transparent;
      user-select:none;display:flex;align-items:center;gap:6px}
    .kds-sub:hover{background:#1b1e26}
    .kds-sub.on{border-left-color:#4c8bf5;color:#8ab4f8;background:#191d26}
    .kds-sub small{margin-left:auto;color:#6d7484;font-weight:400;font-size:10.5px}
    .kds-vids{display:none;padding-left:4px}
    .kds-vids.on{display:block}
    .kds-vid{padding:5px 12px 5px 22px;font-size:11.5px;color:#98a0b0;cursor:pointer;line-height:1.55;
      border-left:2px solid transparent;display:flex;gap:7px}
    .kds-vid:hover{background:#1a1d25;color:#d5dae6}
    .kds-vid.on{border-left-color:#4c8bf5;color:#8ab4f8;background:#181c24}
    .kds-vid span:first-child{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .kds-vid em{color:#5d6375;font-style:normal;font-size:10.5px;flex-shrink:0}
    .kds-q{border:1px solid #252a36;border-radius:8px;padding:11px 13px;margin:0 14px 10px;background:#171a21}
    .kds-q .qt{font-size:12.5px;color:#dfe3ee;line-height:1.65;margin-bottom:8px}
    .kds-q .qo{padding:3px 0;color:#a8afc0;font-size:11.5px;line-height:1.55}
    .kds-q .qo.ok{color:#4ade80}
    .kds-q .qa{margin-top:8px;padding-top:8px;border-top:1px dashed #2b303c;font-size:11px;color:#7d8496;line-height:1.6}
    .kds-q .qa b{color:#4ade80}
    .kds-sel{width:calc(100% - 28px);margin:0 14px 8px;padding:6px 9px;border-radius:6px;border:1px solid #2b303c;
      background:#0e1016;color:#e6e8ee;font-size:11.5px;outline:none}
    .kds-empty{color:#5d6375;text-align:center;padding:40px 0;font-size:12px}
    .kds-meta{margin:0 14px 8px;font-size:10.5px;color:#636a7d}
    .kds-btn{flex:1;padding:6px 0;border-radius:6px;border:1px solid #2f3542;background:#1c2029;color:#cfd4e0;cursor:pointer;font-size:11px}
    .kds-btn:hover{background:#252b36}
  `;

  function mount() {
    if (document.getElementById("kds-root")) return;
    const root = document.createElement("div");
    root.id = "kds-root";
    root.innerHTML = `
      <style>${CSS}</style>
      <div id="kds-win">
        <div id="kds-side">
          <div class="top">
            <h3>考得尚解锁器</h3>
            <p>16 科目 · 758 讲 · 1903 题</p>
            <div id="kds-tabs"><b data-tab="video" class="on">课程视频</b><b data-tab="bank">题库练习</b></div>
            <input id="kds-search" placeholder="筛选科目 / 代码…">
          </div>
          <div id="kds-list"></div>
        </div>
        <div id="kds-main">
          <div id="kds-bar">选择左侧视频开始</div>
          <div id="kds-stage"><div id="kds-player"></div><div id="kds-hint">← 选择视频<br><span style="font-size:11px">点击「播放」加载</span></div></div>
          <div id="kds-foot">
            <button id="kds-play" class="pri" disabled>播放</button>
            <button id="kds-next" disabled>下一讲</button>
            <span id="kds-st">就绪</span>
          </div>
        </div>
      </div>
      <div id="kds-fab">K<i></i></div>`;
    document.documentElement.appendChild(root);

    const win = root.querySelector("#kds-win");
    root.querySelector("#kds-fab").onclick = async () => {
      win.classList.toggle("on");
      if (win.classList.contains("on")) { await loadData(); renderList(); }
    };
    root.querySelectorAll("#kds-tabs b").forEach((el) => {
      el.onclick = async () => {
        S.tab = el.dataset.tab;
        root.querySelectorAll("#kds-tabs b").forEach((x) => x.classList.toggle("on", x === el));
        await loadData();
        renderList();
        renderStage();
      };
    });
    root.querySelector("#kds-search").oninput = () => renderList();
    root.querySelector("#kds-play").onclick = () => playCurrent();
    root.querySelector("#kds-next").onclick = playNext;
  }

  // ============ 左侧列表 ============
  function renderList() {
    const box = document.querySelector("#kds-list");
    if (!box) return;
    const filter = (document.querySelector("#kds-search") || {}).value || "";
    box.innerHTML = "";

    if (S.tab === "video") {
      if (!S.catalog) { box.innerHTML = '<div class="kds-empty">加载中…</div>'; return; }
      const subs = S.catalog.subjects.filter((s) => !filter || s.name.includes(filter) || String(s.code).includes(filter));
      if (!subs.length) { box.innerHTML = '<div class="kds-empty">无匹配</div>'; return; }
      for (const s of subs) {
        const head = document.createElement("div");
        head.className = "kds-sub";
        head.innerHTML = `<span>${esc(s.code)} ${esc(s.name.length > 13 ? s.name.slice(0, 13) + "…" : s.name)}</span><small>${s.videoCount}讲</small>`;
        const vbox = document.createElement("div");
        vbox.className = "kds-vids";
        head.onclick = () => {
          const on = vbox.classList.toggle("on");
          box.querySelectorAll(".kds-sub").forEach((x) => x.classList.remove("on"));
          if (on) head.classList.add("on");
        };
        s.videos.forEach((v) => {
          const item = document.createElement("div");
          item.className = "kds-vid";
          const label = v.path.split(" > ").slice(-1)[0] || v.path;
          item.innerHTML = `<span title="${esc(v.path)}">${esc(label)}</span><em>${esc(v.duration || "")}</em>`;
          item._v = v; item._s = s;
          item.onclick = () => selectVideo(s, v, item);
          vbox.appendChild(item);
        });
        box.appendChild(head);
        box.appendChild(vbox);
      }
      return;
    }

    if (!S.bank) { box.innerHTML = '<div class="kds-empty">加载中…</div>'; return; }
    const subs = S.bank.subjects.filter((s) => !filter || s.name.includes(filter) || String(s.code).includes(filter));
    if (!subs.length) { box.innerHTML = '<div class="kds-empty">无匹配</div>'; return; }
    if (!S.subject || !subs.find((s) => s.code === S.subject)) S.subject = subs[0].code;
    const cur = subs.find((s) => s.code === S.subject) || subs[0];

    const sel = document.createElement("select");
    sel.className = "kds-sel";
    sel.innerHTML = subs.map((s) => `<option value="${s.code}" ${s.code === cur.code ? "selected" : ""}>${esc(s.code)} ${esc(s.name)}（${s.total}题）</option>`).join("");
    sel.onchange = (e) => { S.subject = e.target.value; S.chapter = null; S.paper = null; S.random = false; renderList(); renderStage(); };
    box.appendChild(sel);

    const modeBox = document.createElement("div");
    modeBox.style.cssText = "display:flex;gap:5px;margin:0 14px 8px";
    modeBox.innerHTML = `
      <b data-m="chapter" style="flex:1;text-align:center;padding:5px 0;border-radius:6px;cursor:pointer;font-size:11px;font-weight:500;
        background:${S.mode === "chapter" ? "#2b5fd9" : "#1c2029"};color:${S.mode === "chapter" ? "#fff" : "#98a0b0"}">章节练习</b>
      <b data-m="paper" style="flex:1;text-align:center;padding:5px 0;border-radius:6px;cursor:pointer;font-size:11px;font-weight:500;
        background:${S.mode === "paper" ? "#2b5fd9" : "#1c2029"};color:${S.mode === "paper" ? "#fff" : "#98a0b0"}">真题模拟</b>`;
    modeBox.querySelectorAll("b").forEach((el) => {
      el.onclick = () => { S.mode = el.dataset.m; S.random = false; renderList(); renderStage(); };
    });
    box.appendChild(modeBox);

    if (S.mode === "chapter") {
      const chapters = [...new Set(cur.questions.filter((q) => q.chapter).map((q) => q.chapter))];
      const cs = document.createElement("select");
      cs.className = "kds-sel";
      cs.innerHTML = `<option value="">全部章节（${chapters.length}）</option>` +
        chapters.map((c) => `<option value="${esc(c)}" ${S.chapter === c ? "selected" : ""}>${esc(c.split(" > ").slice(-1)[0])}</option>`).join("");
      cs.onchange = (e) => { S.chapter = e.target.value || null; S.random = false; renderStage(); };
      box.appendChild(cs);
    } else {
      const ps = document.createElement("select");
      ps.className = "kds-sel";
      ps.innerHTML = `<option value="">全部试卷（${cur.papers.length}）</option>` +
        cur.papers.map((p) => `<option value="${esc(p.name)}" ${S.paper === p.name ? "selected" : ""}>${esc(p.name)}（${p.count}）</option>`).join("");
      ps.onchange = (e) => { S.paper = e.target.value || null; S.random = false; renderStage(); };
      box.appendChild(ps);
    }

    const meta = document.createElement("div");
    meta.className = "kds-meta";
    meta.textContent = `共 ${cur.total} 题 · 单选 ${cur.questions.filter((q) => /单选/.test(q.type)).length} · 主观 ${cur.questions.filter((q) => !/单选/.test(q.type)).length}`;
    box.appendChild(meta);

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:6px;margin:0 14px 10px";
    btnRow.innerHTML = `<button class="kds-btn" id="kds-all">全部</button><button class="kds-btn" id="kds-rnd">随机 20 题</button>`;
    btnRow.querySelector("#kds-all").onclick = () => { S.random = false; S.limit = 99999; renderStage(); };
    btnRow.querySelector("#kds-rnd").onclick = () => { S.random = true; S.limit = 20; renderStage(); };
    box.appendChild(btnRow);
  }

  // ============ 右侧 ============
  function renderStage() {
    const stage = document.querySelector("#kds-stage");
    const bar = document.querySelector("#kds-bar");
    if (!stage) return;

    if (S.tab === "video") {
      stage.innerHTML = '<div id="kds-player"></div><div id="kds-hint">← 选择视频<br><span style="font-size:11px">点击「播放」加载</span></div>';
      if (S.cur) bar.innerHTML = `<b>${esc(S.cur.s.code)} ${esc(S.cur.s.name)}</b> · ${esc(S.cur.v.path)}`;
      return;
    }

    if (!S.bank) { stage.innerHTML = '<div class="kds-empty">加载中…</div>'; return; }
    const cur = S.bank.subjects.find((s) => s.code === S.subject) || S.bank.subjects[0];
    let list = cur.questions;
    if (S.mode === "chapter" && S.chapter) list = list.filter((q) => q.chapter === S.chapter);
    if (S.mode === "paper" && S.paper) list = list.filter((q) => q.paper === S.paper);
    list = S.random ? [...list].sort(() => Math.random() - 0.5).slice(0, S.limit) : list.slice(0, S.limit);

    bar.innerHTML = `<b>${esc(cur.code)} ${esc(cur.name)}</b> · ${list.length} 题`;

    stage.innerHTML = list.length
      ? list.map((q, i) => `
        <div class="kds-q">
          <div class="qt">${i + 1}. ${esc(q.title)}</div>
          ${q.options.map((o) => `<div class="qo ${q.answer && q.answer.includes(o.k) ? "ok" : ""}">${esc(o.k)}. ${esc(o.v)}</div>`).join("")}
          <div class="qa">答案 <b>${esc(q.answer || "（主观题，见解析）")}</b>${q.analysis ? "　" + esc(q.analysis.slice(0, 220)) : ""}</div>
          ${(q.sonExer || []).map((s, j) => `
            <div style="margin:9px 0 0 10px;padding-left:9px;border-left:2px solid #2b303c">
              <div class="qt" style="font-size:12px">(${j + 1}) ${esc(s.title)}</div>
              ${s.options.map((o) => `<div class="qo ${s.answer && s.answer.includes(o.k) ? "ok" : ""}">${esc(o.k)}. ${esc(o.v)}</div>`).join("")}
              <div class="qa">答案 <b>${esc(s.answer || "-")}</b></div>
            </div>`).join("")}
        </div>`).join("")
      : '<div class="kds-empty">该分组暂无题目</div>';
  }

  // ============ 播放 ============
  function selectVideo(s, v, el) {
    document.querySelectorAll(".kds-vid").forEach((x) => x.classList.remove("on"));
    el.classList.add("on");
    S.cur = { s, v };
    document.querySelector("#kds-bar").innerHTML = `<b>${esc(s.code)} ${esc(s.name)}</b> · ${esc(v.path)}`;
    document.querySelector("#kds-play").disabled = false;
    document.querySelector("#kds-next").disabled = false;
    document.querySelector("#kds-st").textContent = "已选择";
  }

  async function playCurrent() {
    if (!S.cur) return;
    const { s, v } = S.cur;
    const st = document.querySelector("#kds-st");
    const btn = document.querySelector("#kds-play");
    btn.disabled = true;
    st.textContent = "签发凭据中…";

    const r = await bg("sign", {
      payload: { vid: v.vid, cstId: s.cstId, courseId: s.courseId, catId: v.catId, materialType: v.materialType || 1 },
    });
    if (!r.ok) { st.textContent = "失败：" + (r.error || "未知"); btn.disabled = false; return; }

    const hint = document.querySelector("#kds-hint");
    if (hint) hint.style.display = "none";
    const holder = document.querySelector("#kds-player");
    if (holder) holder.innerHTML = "";

    try { if (S.player && S.player.destroy) S.player.destroy(); } catch (e) { }

    if (typeof window.BPlayer !== "function") {
      st.textContent = "播放器未加载，请刷新页面";
      btn.disabled = false;
      return;
    }

    const u = r.user || {};
    S.player = new window.BPlayer({
      container: holder,
      memory: true,
      vid: v.vid,
      token: r.token,
      autoplay: true,
      enableLoop: false,
      enableDrag: true,
      enableWaterMark: false,
      useFFplayerMSE: true,
      user: { name: u.name || "user", number: String(u.id || 0) },
    });

    st.textContent = "已加载" + (r.quality ? " · " + r.quality : "") + (r.duration ? " · " + Math.round(r.duration / 60) + " 分钟" : "");
    btn.disabled = false;
  }

  function playNext() {
    if (!S.cur || !S.catalog) return;
    const s = S.catalog.subjects.find((x) => x.code === S.cur.s.code);
    const idx = s.videos.findIndex((x) => x.vid === S.cur.v.vid);
    if (idx >= 0 && idx < s.videos.length - 1) {
      const nv = s.videos[idx + 1];
      const el = [...document.querySelectorAll(".kds-vid")].find((e) => e._v === nv);
      if (el) { selectVideo(s, nv, el); playCurrent(); }
    }
  }

  function boot() {
    mount();
    loadData();
    log("已加载");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
