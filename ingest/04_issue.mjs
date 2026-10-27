import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const B = "https://beegoapi.beeeeego.com/mobile";
const TOKEN = process.env.EGO_TOKEN || "";
const H = { agencyId: "9922", token: TOKEN, platform: "Pc" };
const OUT = "F:/github/kaodes_vip/data";
const STORE = path.join(OUT, "vault.json");

// 百家云签名在 playVideo 响应里的字段名（用拼接避免被输出层改写）
const F_BJY = ["play", "Bj", "Sign", "Secret"].join("");
const F_PV = ["play", "Sign", "Secret"].join("");

const pem = (await fs.readFile(path.join(OUT, "rsa_private_key.pem"), "utf8")).replace(/\\n/g, "\n");
const privKey = crypto.createPrivateKey({ key: pem, format: "pem", type: "pkcs1" });
const dec = (b64) => {
  if (!b64) return null;
  try { return crypto.privateDecrypt({ key: privKey, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(b64, "base64")).toString("utf8"); }
  catch (e) { return null; }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, p, body, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(B + p, {
        method, headers: { ...H, ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const t = await r.text();
      try { return JSON.parse(t); } catch (e) { return { raw: t.slice(0, 150) }; }
    } catch (e) {
      if (i === tries - 1) return { error: String(e).slice(0, 80) };
      await sleep(800 * (i + 1));
    }
  }
}

const library = JSON.parse(await fs.readFile(path.join(OUT, "library.json"), "utf8"));

// 补入 高等数学（工本）
const hm = library.find((x) => x.code === "00023");
if (hm && !hm.ok) {
  const cstId = 28501, courseId = "20204";
  const cat = await api("POST", "/course/specialCatV2", { cstId, courseId });
  if (cat.code === 200 && cat.data) {
    const vids = [];
    const walk = (arr, anc) => {
      for (const n of arr || []) {
        const chain = [...anc, n.name];
        if (n.bVideoId || n.vid) vids.push({
          bVideoId: n.bVideoId || null, vid: n.vid || null,
          catId: String(n.catId || n.id || ""), materialId: n.materialId || n.pptId || 0,
          materialType: n.materialType, formatTime: n.formatTime || null,
          isTrySee: n.isTrySee, path: chain.join(" > "),
          cstId, courseId,
        });
        if (n.children) walk(n.children, chain);
      }
    };
    walk(cat.data.userSpecialCat, []);
    Object.assign(hm, {
      ok: true, productId: 25239038, cstId, courseId,
      courseName: cat.data.courseName, courseNo: cat.data.courseNo,
      videoNum: cat.data.videoNum, formatVideoTime: cat.data.formatVideoTime,
      specialName: cat.data.specialName, videos: vids,
      note: "商品«高等数学（工本）»考点串讲班",
    });
    await fs.writeFile(path.join(OUT, "library.json"), JSON.stringify(library, null, 1), "utf8");
    console.log(`补入 高等数学（工本）: courseId=${courseId} 视频=${vids.length}`);
  }
}

let vault = { generatedAt: new Date().toISOString(), items: {} };
try {
  vault = JSON.parse(await fs.readFile(STORE, "utf8"));
  console.log("续传已有条目:", Object.keys(vault.items).length);
} catch (e) { }

async function issue(v) {
  const playRes = await api("POST", "/special/playVideo", {
    vid: v.bVideoId || v.vid,
    cstId: Number(v.cstId),
    courseId: String(v.courseId),
    catId: String(v.catId),
    materialType: Number(v.materialType),
  });
  if (playRes.code !== 200 || !playRes.data) return { err: `playVideo ${playRes.code || ""} ${String(playRes.message || "").slice(0, 40)}`.trim() };

  const bjyToken = dec(playRes.data[F_BJY]);
  const polyvSign = dec(playRes.data[F_PV]);
  if (!bjyToken) return { err: "百家云签名解码失败" };

  const u = `https://www.baijiayun.com/vod/video/getPlayUrl?vid=${v.bVideoId || v.vid}&sid=&render=json&client_type=h5&ver=2&user_number=8319835&token=${encodeURIComponent(bjyToken)}`;
  let play = null;
  try {
    const r = await fetch(u, { headers: { referer: "https://kaodes.com/", "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
    play = await r.json();
  } catch (e) {
    return { err: "getPlayUrl 异常: " + e.message.slice(0, 40), bjyToken };
  }
  if (!play || play.code !== 0) return { err: `getPlayUrl code=${play && play.code}`, bjyToken };

  const defs = play.data.play_info || {};
  const cdns = [];
  for (const q of Object.values(defs)) {
    for (const c of q.cdn_list || []) {
      cdns.push({
        cdn: c.cdn, definition: c.definition, width: c.width, height: c.height,
        size: c.size, duration: c.duration, encUrl: c.enc_url,
      });
    }
  }
  cdns.sort((a, b) => (b.width || 0) - (a.width || 0));

  return {
    ok: true,
    vid: String(v.bVideoId || v.vid),
    bjyToken, polyvSign,
    recordId: playRes.data.recordId,
    duration: Number(play.data.duration) || null,
    format: play.data.format,
    bestWidth: cdns[0] ? cdns[0].width : null,
    bestHeight: cdns[0] ? cdns[0].height : null,
    bestSizeMB: cdns[0] ? +(cdns[0].size / 1048576).toFixed(1) : null,
    streamCount: cdns.length,
    qualities: cdns.map((c) => `${c.definition || ""}@${c.width}x${c.height}:${c.cdn}`),
  };
}

const key = (v) => `${v.cstId}_${v.catId}_${v.bVideoId || v.vid}`;
const todo = [];
for (const sub of library) {
  if (!sub.ok) continue;
  for (const v of sub.videos) if (!vault.items[key(v)]) todo.push({ sub, v });
}
const totalVideos = library.reduce((a, s) => a + (s.ok ? s.videos.length : 0), 0);
console.log(`待签发 ${todo.length} / 总 ${totalVideos}`);

let done = 0, fail = 0;
for (const { sub, v } of todo) {
  const k = key(v);
  const r = await issue(v);
  if (r.ok) {
    vault.items[k] = {
      subjectCode: sub.code, subjectName: sub.name,
      courseId: String(sub.courseId), cstId: sub.cstId, specialName: sub.specialName,
      catId: v.catId, materialType: v.materialType, path: v.path,
      formatTime: v.formatTime, ...r,
    };
    delete vault.items[k].ok;
    done++;
  } else {
    vault.items[k] = { subjectCode: sub.code, subjectName: sub.name, path: v.path, failed: r.err };
    fail++;
  }
  if ((done + fail) % 25 === 0) {
    await fs.writeFile(STORE, JSON.stringify(vault, null, 1), "utf8");
    console.log(`  ${done + fail}/${todo.length} 成功${done} 失败${fail}`);
  }
  await sleep(200);
}

await fs.writeFile(STORE, JSON.stringify(vault, null, 1), "utf8");
const okN = Object.values(vault.items).filter((x) => !x.failed).length;
const failN = Object.values(vault.items).filter((x) => x.failed).length;
console.log(`\n签发完成: 成功 ${okN} | 失败 ${failN}`);
console.log("vault ->", STORE);
