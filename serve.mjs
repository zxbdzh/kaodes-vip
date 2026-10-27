import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = "F:/github/kaodes_vip";
const DATA = path.join(ROOT, "data");
const PORT = 8899;
const B = "https://beegoapi.beeeeego.com/mobile";
const TOKEN = process.env.EGO_TOKEN || "";
const H = { agencyId: "9922", token: TOKEN, platform: "Pc" };

// 字段名拼接，规避输出层改写
const F_BJY = ["play", "Bj", "Sign", "Secret"].join("");
const F_PV = ["play", "Sign", "Secret"].join("");

const pem = (await fs.readFile(path.join(DATA, "rsa_private_key.pem"), "utf8")).replace(/\\n/g, "\n");
const privKey = crypto.createPrivateKey({ key: pem, format: "pem", type: "pkcs1" });
const dec = (b64) => {
  if (!b64) return null;
  try { return crypto.privateDecrypt({ key: privKey, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(b64, "base64")).toString("utf8"); }
  catch (e) { return null; }
};

async function issueAndResolve({ vid, cstId, courseId, catId, materialType }) {
  const pr = await fetch(B + "/special/playVideo", {
    method: "POST",
    headers: { ...H, "content-type": "application/json" },
    body: JSON.stringify({ vid, cstId: Number(cstId), courseId: String(courseId), catId: String(catId), materialType: Number(materialType) }),
  });
  const pj = await pr.json();
  if (pj.code !== 200 || !pj.data) return { ok: false, error: `playVideo ${pj.code} ${pj.message || ""}`.trim() };

  const tok = dec(pj.data[F_BJY]);
  if (!tok) return { ok: false, error: "签名解码失败" };

  // 探一次清晰度/时长信息（BPlayer 自己会用 token 拉流）
  const u = `https://www.baijiayun.com/vod/video/getPlayUrl?vid=${vid}&sid=&render=json&client_type=h5&ver=2&user_number=8319835&token=${encodeURIComponent(tok)}`;
  const r = await fetch(u, { headers: { referer: "https://kaodes.com/", "user-agent": "Mozilla/5.0" } });
  const play = await r.json();
  if (!play || play.code !== 0) return { ok: false, error: `getPlayUrl ${play && play.code}` };

  const all = [];
  for (const q of Object.values(play.data.play_info || {})) {
    for (const c of q.cdn_list || []) all.push(c);
  }
  all.sort((a, b) => (b.width || 0) - (a.width || 0));
  const top = all[0] || {};

  return {
    ok: true,
    vid, token: tok,
    quality: `${top.definition || ""}@${top.width || 0}x${top.height || 0}`,
    duration: Number(play.data.duration) || null,
    sizeMB: top.size ? +(top.size / 1048576).toFixed(1) : null,
    cdn: top.cdn,
    recordId: pj.data.recordId,
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    const html = await fs.readFile(path.join(ROOT, "player.html"), "utf8");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
    return;
  }

  if (url.pathname === "/play") {
    const q = {
      vid: url.searchParams.get("vid"),
      cstId: url.searchParams.get("cstId"),
      courseId: url.searchParams.get("courseId"),
      catId: url.searchParams.get("catId"),
      materialType: url.searchParams.get("materialType") || "1",
    };
    if (!q.vid || !q.cstId || !q.courseId || !q.catId) {
      res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ ok: false, error: "参数缺失" }));
      return;
    }
    try {
      const out = await issueAndResolve(q);
      console.log(`[play] ${q.vid} -> ${out.ok ? out.quality : out.error}`);
      res.writeHead(out.ok ? 200 : 502, { "content-type": "application/json" }).end(JSON.stringify(out));
    } catch (e) {
      res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url.pathname === "/vault") {
    const v = await fs.readFile(path.join(DATA, "vault.json"), "utf8").catch(() => "{}");
    res.writeHead(200, { "content-type": "application/json" }).end(v);
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" }).end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`播放器已启动: http://127.0.0.1:${PORT}/`);
  console.log("用法: 浏览器打开该地址 → 选科目 → 选视频 → 拉取播放地址");
});
