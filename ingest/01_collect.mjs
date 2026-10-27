import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const B = "https://beegoapi.beeeeego.com/mobile";
const TOKEN = process.env.EGO_TOKEN || "";
const H = { agencyId: "9922", token: TOKEN, platform: "Pc" };
const OUT = "F:/github/kaodes_vip/data";

const pem = (await fs.readFile(path.join(OUT, "rsa_private_key.pem"), "utf8")).replace(/\\n/g, "\n");
const privKey = crypto.createPrivateKey({ key: pem, format: "pem", type: "pkcs1" });
const dec = (b64) => {
  if (!b64) return null;
  try { return crypto.privateDecrypt({ key: privKey, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(b64, "base64")).toString("utf8"); }
  catch (e) { return null; }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(method, p, body) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(B + p, {
        method,
        headers: { ...H, ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const t = await r.text();
      try { return JSON.parse(t); } catch (e) { return { raw: t.slice(0, 200) }; }
    } catch (e) {
      if (i === 2) return { error: String(e).slice(0, 100) };
      await sleep(600);
    }
  }
}

// ===== 1. 两份专业计划的科目 =====
const PLANS = {
  "计算机科学与技术|080901|集美大学": [
    ["13000", "英语（专升本）"], ["00023", "高等数学(工本)"], ["02324", "离散数学"],
    ["15040", "习近平新时代中国特色社会主义思想概论"], ["15043", "中国近现代史纲要"],
    ["15044", "马克思主义基本原理"], ["13180", "操作系统"], ["13003", "数据结构与算法"],
    ["13013", "高级语言程序设计"], ["13015", "计算机系统原理"], ["13005", "软件工程"],
    ["13009", "数据库原理与技术"], ["13011", "人工智能与大数据"], ["02325", "计算机系统结构"],
    ["13017", "计算机网络与信息安全"],
  ],
  "软件工程|080902|华侨大学": [
    ["15040", "习近平新时代中国特色社会主义思想概论"], ["15043", "中国近现代史纲要"],
    ["15044", "马克思主义基本原理"], ["13000", "英语（专升本）"], ["00023", "高等数学(工本)"],
    ["02324", "离散数学"], ["13003", "数据结构与算法"], ["13005", "软件工程"],
    ["13013", "高级语言程序设计"], ["13180", "操作系统"], ["13008", "软件质量保证与测试"],
    ["13015", "计算机系统原理"], ["13011", "人工智能与大数据"], ["13007", "编译原理"],
    ["13009", "数据库原理与技术"],
  ],
};

const subjects = new Map();
for (const [plan, list] of Object.entries(PLANS)) {
  for (const [code, name] of list) {
    if (!subjects.has(code)) subjects.set(code, { code, name, plans: [] });
    subjects.get(code).plans.push(plan);
  }
}
console.log(`科目数: ${subjects.size}`);

// ===== 2. 精确解析 courseId（用 /course/list 按 courseNo 查） =====
const resolveCourse = async (code, name) => {
  const cands = [];
  for (const body of [
    { pageNum: 1, pageSize: 20, courseNo: code },
    { pageNum: 1, pageSize: 20, keywords: name },
    { pageNum: 1, pageSize: 20, courseName: name },
  ]) {
    const r = await api("POST", "/course/list", body);
    for (const row of ((r.data && r.data.rows) || [])) cands.push(row);
    if (cands.length >= 8) break;
  }
  // 精确匹配：courseNo 含 code，或名称去括号后相等
  const norm = (s) => String(s || "").replace(/[\s（）()\-—]/g, "");
  const target = norm(name);
  const scored = cands.map((c) => {
    let score = 0;
    if (String(c.courseNo || "").includes(code)) score += 100;
    const cn = norm(c.courseName);
    if (cn === target) score += 60;
    else if (cn.includes(target) || target.includes(cn)) score += 30;
    return { c, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((x) => ({
    courseID: String(x.c.courseID), courseNo: x.c.courseNo, courseName: x.c.courseName, score: x.score,
  }));
};

// ===== 3. 抓目录 + 视频清单 =====
const collectVideos = (tree, cstId, courseId) => {
  const out = [];
  const walk = (arr, ancestors) => {
    for (const n of arr || []) {
      const chain = [...ancestors, n.name];
      if (n.bVideoId || n.vid) {
        out.push({
          bVideoId: n.bVideoId || null,
          vid: n.vid || null,
          catId: String(n.catId || n.id || ""),
          materialId: n.materialId || n.pptId || 0,
          materialType: n.materialType,
          formatTime: n.formatTime || null,
          pptTime: n.pptTime || null,
          isTrailers: n.isTrailers,
          isTrySee: n.isTrySee,
          path: chain.join(" > "),
          cstId, courseId,
        });
      }
      if (n.children && n.children.length) walk(n.children, chain);
    }
  };
  walk(tree, []);
  return out;
};

const library = [];
for (const s of subjects.values()) {
  const entry = { ...s, resolved: [], cstList: [], videos: [], error: null };
  try {
    entry.resolved = await resolveCourse(s.code, s.name);
    if (!entry.resolved.length) { entry.error = "未解析到课程"; library.push(entry); continue; }
    const best = entry.resolved[0];
    const cstRes = await api("GET", `/course/getCstList?courseId=${best.courseID}`);
    entry.cstList = (cstRes.data || []).map((x) => ({ cstId: x.cstId, title: x.title }));

    for (const cst of entry.cstList) {
      const cat = await api("POST", "/course/specialCatV2", { cstId: cst.cstId, courseId: best.courseID });
      if (cat.code !== 200 || !cat.data) continue;
      entry.videos.push(...collectVideos(cat.data.userSpecialCat, cst.cstId, best.courseID));
      await sleep(120);
    }
    console.log(`${s.code} ${s.name} -> courseId=${best.courseID} 班型=${entry.cstList.length} 视频=${entry.videos.length}`);
  } catch (e) {
    entry.error = String(e).slice(0, 120);
    console.log(`${s.code} ${s.name} -> ERROR ${entry.error}`);
  }
  library.push(entry);
  await sleep(150);
}

await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(path.join(OUT, "library_raw.json"), JSON.stringify(library, null, 1), "utf8");
const totalV = library.reduce((a, b) => a + b.videos.length, 0);
console.log(`\n科目 ${library.length} | 视频总数 ${totalV}`);
console.log("已保存 library_raw.json");
