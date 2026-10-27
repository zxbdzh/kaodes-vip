import fs from "node:fs/promises";

const code = `// 考得尚解锁器 - 主世界脚本
// 负责：签发播放凭据 + 纯 JS RSA 解密（不依赖页面 JSEncrypt）
(function () {
  "use strict";

  const API = "https://beegoapi.beeeeego.com/mobile";
  const AGENCY = "9922";
  const K_BJ = ["play", "Bj", "Sign", "Secret"].join("");
  const K_PV = ["play", "Sign", "Secret"].join("");

  let decryptFn = null;

  async function initRsa() {
    if (decryptFn) return decryptFn;
    const paramsRes = await fetch(chrome.runtime.getURL("rsa.json"));
    const rsaRes = await fetch(chrome.runtime.getURL("rsa.js"));
    const params = await paramsRes.json();
    const src = await rsaRes.text();
    new Function(src)();
    if (typeof window.createKdsRsa !== "function") throw new Error("rsa.js 未挂载");
    decryptFn = window.createKdsRsa(params);
    console.log("[KDS] RSA 就绪");
    return decryptFn;
  }

  const getCookie = (n) => {
    const m = document.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  };

  async function sign(p) {
    const token = getCookie("token");
    if (!token) return { ok: false, error: "未登录考得尚" };

    const dec = await initRsa();

    const r = await fetch(API + "/special/playVideo", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", agencyId: AGENCY, platform: "Pc", token: token },
      body: JSON.stringify({
        vid: p.vid,
        cstId: Number(p.cstId),
        courseId: String(p.courseId),
        catId: String(p.catId),
        materialType: Number(p.materialType || 1),
      }),
    });
    const j = await r.json();
    if (j.code !== 200 || !j.data) return { ok: false, error: "playVideo " + j.code + " " + String(j.message || "").slice(0, 30) };

    let bjToken = null, pvSign = null;
    try { bjToken = dec(j.data[K_BJ]); } catch (e) { return { ok: false, error: "解密失败: " + e.message }; }
    try { pvSign = dec(j.data[K_PV]); } catch (e) { pvSign = null; }
    if (!bjToken) return { ok: false, error: "签名为空" };

    let quality = null, duration = null;
    try {
      let uid = 0;
      try { uid = JSON.parse(getCookie("user")).userId; } catch (e) { }
      const url = "https://www.baijiayun.com/vod/video/getPlayUrl?vid=" + p.vid +
        "&sid=&render=json&client_type=h5&ver=2&user_number=" + (uid || 8319835) +
        "&token=" + encodeURIComponent(bjToken);
      const resp = await fetch(url, { headers: { referer: "https://kaodes.com/" } });
      const info = await resp.json();
      if (info && info.code === 0) {
        const all = [];
        const pi = info.data.play_info || {};
        for (const k of Object.keys(pi)) {
          const list = pi[k].cdn_list || [];
          for (const c of list) all.push(c);
        }
        all.sort((a, b) => (b.width || 0) - (a.width || 0));
        if (all[0]) quality = all[0].definition + "@" + all[0].width + "x" + all[0].height;
        duration = Number(info.data.duration) || null;
      }
    } catch (e) { }

    return { ok: true, token: bjToken, pv: pvSign, quality: quality, duration: duration, recordId: j.data.recordId };
  }

  window.addEventListener("kds-sign", async (ev) => {
    const d = ev.detail || {};
    let res;
    try { res = await sign(d.payload || {}); }
    catch (e) { res = { ok: false, error: e.message }; }
    window.dispatchEvent(new CustomEvent("kds-sign-result", { detail: Object.assign({ id: d.id }, res) }));
  });

  initRsa().catch((e) => console.warn("[KDS] RSA 初始化失败", e.message));

  window.__KDS = { version: "1.1.0", sign: sign, getCookie: getCookie, ready: true };
  console.log("[KDS] 主世界就绪 v1.1.0");
})();
`;

await fs.writeFile("F:/github/kaodes_vip/extension/inject.js", code, "utf8");
console.log("inject.js 写入:", code.length, "字节");
