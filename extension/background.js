// 考得尚解锁器 - 后台服务
// 职责：读取登录态、签发播放凭据、RSA 解密
importScripts("rsa.js");

const API = "https://beegoapi.beeeeego.com/mobile";
const AGENCY = "9922";
const K_BJ = ["play", "Bj", "Sign", "Secret"].join("");
const K_PV = ["play", "Sign", "Secret"].join("");

// RSA 私钥参数
const RSA_PARAMS = {"n":"s93Bd1HIquqIT7lTdIuQTtQEDBaKsHyCLrnO1pFOcilPF4q9eHHVFtri8gqo4RIhgO70mjkJPBwFAyxtj1CUqSYofisR8Jo3BnFIYXXx2iQzbORIiilrkoPgMWaRM9tVmv3jvvNPKMoaHHxNJz2mdPnGmt3puh7Om0GYJehS3d8=","e":"AQAB","d":"GRa+FTwxrvGO+PvjUbbj9rLpK5x7VPnRGN5vJQvYsuDjOOfv3NyX+hunG1b0Toy+YqMyOE7rZFiONG6ei6aUTbXUMZUeAFwUslFV15pRu17U8gf+gSnVKuACbf8hNyy1fchRcbjQWdSwlTHf4tfFL7RfbGIUMr7A0dIvl2Lja/k=","p":"5gwTwksSkC8QU0NMTAAyUA1gbYNVOiIDckox9Iq3IXhL9hmeaulU3dgW0AA40JhVM6i7lyKbKRSQBjLTW+jRuQ==","q":"yChq/Rk21os71S0zSrMPnD5VBj+micNUQUhQavLHG3C5C6XVI20+sAX8Bt0ay1D8GE4ofkefeOkPjvoFwvxYVw==","dp":"SnRgNMMNaAMDep9OY06w+f3KVsdp3x3BFc1zq5z1tmxz0VvrTNjl8cMNZxabTM/wy35x8HFv3HTeRFNQ2u9YaQ==","dq":"wxpyv2c2hwaNOgynNKc6DijMJB0jLqIRnNjqWnVwE5VbKrlo+vFf66DJu78GgSzdrqtw2Tbjga5cFhgsSZZEXQ==","qinv":"DhVlX9IY251f/THNccfjFobxNU/xc7xJMOaomDPmdT7l+Q/ZlZdN0dL5Kfo50QEaATE1HZ6u4B1Fhfq6lJDAaw=="};

let decryptFn = null;
function getDecrypt() {
  if (!decryptFn) decryptFn = createKdsRsa(RSA_PARAMS);
  return decryptFn;
}

// 读取 kaodes.com 的登录 cookie
async function getAuth() {
  const cookies = await chrome.cookies.getAll({ domain: "kaodes.com" });
  const map = {};
  for (const c of cookies) map[c.name] = c.value;
  let user = null;
  try { user = map.user ? JSON.parse(decodeURIComponent(map.user)) : null; } catch (e) { }
  return { token: map.token || "", user };
}

// 签发播放凭据
async function sign(payload) {
  const auth = await getAuth();
  if (!auth.token) return { ok: false, error: "未登录考得尚（请先在该站点登录）" };

  const r = await fetch(API + "/special/playVideo", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      agencyId: AGENCY,
      platform: "Pc",
      token: auth.token,
    },
    body: JSON.stringify({
      vid: payload.vid,
      cstId: Number(payload.cstId),
      courseId: String(payload.courseId),
      catId: String(payload.catId),
      materialType: Number(payload.materialType || 1),
    }),
  });
  const j = await r.json();
  if (j.code !== 200 || !j.data) {
    return { ok: false, error: "playVideo " + j.code + " " + String(j.message || "").slice(0, 40) };
  }

  let bjToken = null, pvSign = null;
  try { bjToken = getDecrypt()(j.data[K_BJ]); } catch (e) { return { ok: false, error: "解密失败: " + e.message }; }
  try { pvSign = getDecrypt()(j.data[K_PV]); } catch (e) { pvSign = null; }
  if (!bjToken) return { ok: false, error: "签名为空" };

  // 取清晰度与时长
  let quality = null, duration = null, sizeMB = null;
  try {
    const uid = (auth.user && auth.user.userId) || 8319835;
    const url = "https://www.baijiayun.com/vod/video/getPlayUrl?vid=" + payload.vid +
      "&sid=&render=json&client_type=h5&ver=2&user_number=" + uid +
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
      if (all[0]) {
        quality = all[0].definition + "@" + all[0].width + "x" + all[0].height;
        sizeMB = all[0].size ? +(all[0].size / 1048576).toFixed(1) : null;
      }
      duration = Number(info.data.duration) || null;
    }
  } catch (e) { }

  return {
    ok: true,
    vid: payload.vid,
    token: bjToken,
    pv: pvSign,
    quality,
    duration,
    sizeMB,
    recordId: j.data.recordId,
    user: auth.user ? { name: auth.user.userName, id: auth.user.userId } : null,
  };
}

// 通用 API 代理（避免页面 CORS）
async function proxy(path, body) {
  const auth = await getAuth();
  const r = await fetch(API + path, {
    method: body ? "POST" : "GET",
    headers: {
      "content-type": "application/json",
      agencyId: AGENCY,
      platform: "Pc",
      ...(auth.token ? { token: auth.token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch (e) { return { code: -1, message: t.slice(0, 120) }; }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.cmd === "sign") sendResponse(await sign(msg.payload || {}));
      else if (msg.cmd === "auth") {
        const a = await getAuth();
        sendResponse({ ok: !!a.token, name: a.user ? a.user.userName : null, userId: a.user ? a.user.userId : null });
      }
      else if (msg.cmd === "proxy") sendResponse(await proxy(msg.path, msg.body));
      else if (msg.cmd === "openPlayer") {
        await chrome.tabs.create({ url: chrome.runtime.getURL("player.html") });
        sendResponse({ ok: true });
      }
      else sendResponse({ ok: false, error: "unknown cmd" });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true; // 异步响应
});
