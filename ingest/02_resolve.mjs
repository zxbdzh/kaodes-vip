import fs from "node:fs/promises";

const B = "https://beegoapi.beeeeego.com/mobile";
const TOKEN = process.env.EGO_TOKEN || "";
const H = { agencyId: "9922", token: TOKEN, platform: "Pc" };
const OUT = "F:/github/kaodes_vip/data";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(method, p, body) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(B + p, {
        method, headers: { ...H, ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const t = await r.text();
      try { return JSON.parse(t); } catch (e) { return { raw: t.slice(0, 150) }; }
    } catch (e) { if (i === 2) return { error: String(e).slice(0, 80) }; await sleep(500); }
  }
}

const products = JSON.parse(await fs.readFile(`${OUT}/product_index.json`, "utf8"));

// 科目定义：代码 / 正式名称 / 用于商品匹配的强关键词（必须精确命中，避免"高等数学（一）"误配）
const SUBJECTS = [
  { code: "13000", name: "英语（专升本）", mustAll: ["英语"], mustNot: ["商务", "专业英语", "口语", "听力", "一)", "二)"] },
  { code: "00023", name: "高等数学(工本)", mustAll: ["高等数学"], mustNot: ["（一）", "(一)", "（二）", "(二)", "微积分"] },
  { code: "02324", name: "离散数学", mustAll: ["离散数学"], mustNot: [] },
  { code: "15040", name: "习近平新时代中国特色社会主义思想概论", mustAll: ["习近平"], mustNot: [] },
  { code: "15043", name: "中国近现代史纲要", mustAll: ["近现代史"], mustNot: [] },
  { code: "15044", name: "马克思主义基本原理", mustAll: ["马克思主义基本原理"], mustNot: [] },
  { code: "13180", name: "操作系统", mustAll: ["操作系统"], mustNot: ["概论", "Linux", "Windows"] },
  { code: "13003", name: "数据结构与算法", mustAll: ["数据结构"], mustNot: ["导论"] },
  { code: "13013", name: "高级语言程序设计", mustAll: ["高级语言程序设计"], mustNot: [] },
  { code: "13015", name: "计算机系统原理", mustAll: ["计算机系统"], mustNot: ["结构"] },
  { code: "13005", name: "软件工程", mustAll: ["软件工程"], mustNot: ["综合实践", "经济学", "项目管理", "（本科）"] },
  { code: "13009", name: "数据库原理与技术", mustAll: ["数据库"], mustNot: ["及其应用", "系统原理", "分布式"] },
  { code: "13011", name: "人工智能与大数据", mustAll: ["人工智能"], mustNot: [] },
  { code: "02325", name: "计算机系统结构", mustAll: ["计算机系统结构"], mustNot: [] },
  { code: "13017", name: "计算机网络与信息安全", mustAll: ["计算机网络"], mustNot: ["原理"] },
  { code: "13008", name: "软件质量保证与测试", mustAll: ["软件质量"], mustNot: [] },
  { code: "13007", name: "编译原理", mustAll: ["编译原理"], mustNot: [] },
];

function scoreProduct(p, s) {
  const n = p.name || "";
  if (/全科|专科|本科-|专升本（小自考）|组合/.test(n) && !/课程精讲班/.test(p.special || "")) return -1;
  for (const kw of s.mustNot) if (n.includes(kw)) return -1;
  if (!s.mustAll.every((kw) => n.includes(kw))) return -1;
  let sc = 0;
  if ((p.special || "").includes("课程精讲班")) sc += 50;
  else if ((p.special || "").includes("考点串讲")) sc += 20;
  const pn = n.replace(/（.*?）|\(.*?\)/g, "").trim();
  if (pn === s.name.replace(/（.*?）|\(.*?\)/g, "").trim()) sc += 40;
  return sc;
}

const result = [];
for (const s of SUBJECTS) {
  const entry = { ...s, productId: null, cstId: null, courseId: null, courseName: null, ok: false, videos: [], note: "" };
  const cands = products
    .map((p) => ({ p, sc: scoreProduct(p, s) }))
    .filter((x) => x.sc > 0)
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 6);

  if (!cands.length) { entry.note = "无匹配商品"; result.push(entry); console.log(`${s.code} ${s.name} => 无匹配商品`); continue; }

  for (const { p } of cands) {
    const d = await api("GET", `/product/productsDetail?productId=${p.productId}&agencyId=9922`);
    const pd = d.data && d.data.productDetail;
    if (!pd) continue;
    const cstIds = String(pd.cstIds || "").split(",").filter(Boolean);
    const courseSets = [pd.courseSet, pd.courseSet && String(pd.courseSet).replace(/^0+/, "")].filter(Boolean);
    for (const cstId of cstIds) {
      for (const courseId of courseSets) {
        const cat = await api("POST", "/course/specialCatV2", { cstId: Number(cstId), courseId });
        if (cat.code !== 200 || !cat.data || !cat.data.courseName) continue;
        // 校验课程名匹配
        const got = cat.data.courseName.replace(/\s/g, "");
        const want = s.name.replace(/[\s（）()]/g, "");
        const match = got === want || got.includes(want.slice(0, 6)) || want.includes(got.slice(0, 6));
        if (!match) continue;

        const vids = [];
        const walk = (arr, anc) => {
          for (const n of arr || []) {
            const chain = [...anc, n.name];
            if (n.bVideoId || n.vid) vids.push({
              bVideoId: n.bVideoId || null, vid: n.vid || null,
              catId: String(n.catId || n.id || ""),
              materialId: n.materialId || n.pptId || 0,
              materialType: n.materialType, formatTime: n.formatTime || null,
              isTrailers: n.isTrailers, isTrySee: n.isTrySee,
              path: chain.join(" > "),
            });
            if (n.children) walk(n.children, chain);
          }
        };
        walk(cat.data.userSpecialCat, []);

        entry.ok = true;
        entry.productId = p.productId;
        entry.cstId = Number(cstId);
        entry.courseId = courseId;
        entry.courseName = cat.data.courseName;
        entry.courseNo = cat.data.courseNo;
        entry.videoNum = cat.data.videoNum;
        entry.formatVideoTime = cat.data.formatVideoTime;
        entry.specialName = cat.data.specialName;
        entry.videos = vids.map((v) => ({ ...v, cstId: Number(cstId), courseId }));
        entry.note = `商品«${p.name}»`;
        break;
      }
      if (entry.ok) break;
    }
    if (entry.ok) break;
    await sleep(120);
  }

  console.log(`${entry.ok ? "OK  " : "FAIL"} ${s.code} ${s.name} => courseId=${entry.courseId} cstId=${entry.cstId} 视频=${entry.videos.length} | ${entry.note}`);
  result.push(entry);
  await sleep(150);
}

await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(`${OUT}/library.json`, JSON.stringify(result, null, 1), "utf8");
const ok = result.filter((r) => r.ok);
const total = ok.reduce((a, b) => a + b.videos.length, 0);
console.log(`\n成功 ${ok.length}/${result.length} 科目 | 视频总数 ${total}`);
