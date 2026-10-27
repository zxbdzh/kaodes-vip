(async function () {
  const $ = (id) => document.getElementById(id);

  try {
    const r = await fetch(chrome.runtime.getURL("bank.json"));
    const bank = await r.json();
    $("qbank").textContent = bank.total + " 题";
    $("stats").innerHTML = bank.subjects
      .map((s) => `<div class="stat"><span>${s.code} ${s.name.slice(0, 12)}</span><b>${s.total}</b></div>`)
      .join("") || '<div class="stat">暂无题库</div>';
  } catch (e) {
    $("qbank").textContent = "未加载";
    $("stats").innerHTML = '<div class="stat">题库读取失败</div>';
  }

  try {
    const r = await new Promise((res) => chrome.runtime.sendMessage({ cmd: "auth" }, res));
    if (r && r.ok) {
      $("login").textContent = r.name ? r.name.slice(0, 14) : "已登录";
    } else {
      $("login").textContent = "未登录";
      $("login").className = "v warn";
    }
  } catch (e) {
    $("login").textContent = "无法检测";
    $("login").className = "v warn";
  }
})();
