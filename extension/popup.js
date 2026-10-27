(async function () {
  const $ = (id) => document.getElementById(id);

  // 题库统计
  try {
    const r = await fetch(chrome.runtime.getURL("bank.json"));
    const bank = await r.json();
    $("qbank").textContent = `${bank.total} 题`;
    const rows = bank.subjects
      .map((s) => `<div class="stat"><span>${s.code} ${s.name.slice(0, 12)}</span><b>${s.total}</b></div>`)
      .join("");
    $("stats").innerHTML = rows || '<div class="stat">暂无题库</div>';
  } catch (e) {
    $("qbank").textContent = "未加载";
    $("stats").innerHTML = '<div class="stat">题库读取失败</div>';
  }

  // 登录态检测
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && /kaodes\.com/.test(tab.url || "")) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const m = document.cookie.match(/token=([^;]+)/);
          const u = document.cookie.match(/user=([^;]+)/);
          let name = "";
          try { name = JSON.parse(decodeURIComponent(u[1])).userName || ""; } catch (e) { }
          return { hasToken: !!(m && m[1]), name };
        },
      });
      const r = results && results[0] && results[0].result;
      if (r && r.hasToken) {
        $("login").textContent = r.name ? r.name.slice(0, 14) : "已登录";
      } else {
        $("login").textContent = "未登录";
        $("login").className = "v warn";
      }
    } else {
      $("login").textContent = "非考得尚页面";
      $("login").className = "v warn";
    }
  } catch (e) {
    $("login").textContent = "无法检测";
    $("login").className = "v warn";
  }
})();
