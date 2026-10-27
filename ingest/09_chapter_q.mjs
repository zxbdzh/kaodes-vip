import fs from "node:fs/promises";
import path from "node:path";

const B = "https://beegoapi.beeeeego.com/mobile";
const TOKEN = process.env.EGO_TOKEN || "";
const H = { agencyId: "9922", token: TOKEN, platform: "Pc" };
const OUT = "F:/github/kaodes_vip/data";
const STORE = path.join(OUT, "chapter_questions.json");

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
      await sleep(600 * (i + 1));
    }
  }
}

function normQ(q, meta) {
  return {
    exerID: q.exerID,
    type: q.keyType || "",
    newKeyType: q.newKeyType ?? null,
    title: (q.title || "").trim(),
    options: ["a", "b", "c", "d", "e", "f", "g", "h"]
      .map((k) => ({ k: k.toUpperCase(), v: (q[k] || "").trim() }))
      .filter((o) => o.v),
    answer: q.rightKey || "",
    analysis: (q.analyze || "").trim(),
    optNum: q.optNum ?? null,
    sonExer: (q.sonExer || []).map((s) => ({
      exerID: s.exerID, title: (s.title || "").trim(),
      options: ["a", "b", "c", "d", "e", "f", "g", "h"].map((k) => ({ k: k.toUpperCase(), v: (s[k] || "").trim() })).filter((o) => o.v),
      answer: s.rightKey || "", analysis: (s.analyze || "").trim(),
    })),
    chapter: meta.chapter,
    subjectCode: meta.subjectCode,
    subjectName: meta.subjectName,
  };
}

const library = JSON.parse(await fs.readFile(path.join(OUT, "library.json"), "utf8"));

let store = { generatedAt: new Date().toISOString(), done: {}, questions: [] };
try {
  store = JSON.parse(await fs.readFile(STORE, "utf8"));
  console.log("续传:", store.questions.length, "题 |", Object.keys(store.done).length, "节已完成");
} catch (e) { }

// 收集所有叶子章节
const tasks = [];
for (const sub of library) {
  if (!sub.ok) continue;
  const chRes = await api("POST", "/course/chapter", { courseId: sub.courseId, cstId: sub.cstId });
  if (chRes.code !== 200 || !chRes.data) { console.log("章节树失败:", sub.code); continue; }
  const walk = (arr, anc) => {
    for (const n of arr || []) {
      const chain = [...anc, n.name];
      if (!n.children || !n.children.length) {
        if ((n.exerNum || 0) > 0) {
          tasks.push({
            subjectCode: sub.code, subjectName: sub.courseName,
            courseId: String(sub.courseId), cstId: sub.cstId,
            catId: String(n.catId || n.id), name: n.name,
            linkName: chain.join(">"), exerNum: n.exerNum,
            scoringMethod: n.scoringMethod ?? 1,
          });
        }
      }
      if (n.children) walk(n.children, chain);
    }
  };
  walk(chRes.data.practiceChapter, []);
  await sleep(150);
}
console.log("叶子章节总数:", tasks.length, "| 待抓:", tasks.filter((t) => !store.done[`${t.subjectCode}_${t.catId}`]).length);

const todo = tasks.filter((t) => !store.done[`${t.subjectCode}_${t.catId}`]);
let okN = 0, failN = 0;

// 限速 4 并发
const CONC = 4;
let idx = 0;
async function worker() {
  while (idx < todo.length) {
    const t = todo[idx++];
    const key = `${t.subjectCode}_${t.catId}`;
    const res = await api("POST", "/course/practice", {
      catId: t.catId, courseId: t.courseId, cstId: t.cstId,
      isRedo: 0, lastPosition: 0,
      linkName: t.linkName, name: t.name,
      scoringMethod: t.scoringMethod,
    });
    if (res.code === 200 && res.data && Array.isArray(res.data.exerList)) {
      const qs = res.data.exerList.map((q) => normQ(q, { chapter: t.linkName, subjectCode: t.subjectCode, subjectName: t.subjectName }));
      store.questions.push(...qs);
      store.done[key] = { n: qs.length, expect: t.exerNum, name: t.linkName };
      okN++;
    } else {
      store.done[key] = { err: `${res.code} ${String(res.message || "").slice(0, 30)}`, name: t.linkName };
      failN++;
    }
    if ((okN + failN) % 40 === 0) {
      await fs.writeFile(STORE, JSON.stringify(store), "utf8");
      console.log(`  ${okN + failN}/${todo.length} 成功${okN} 失败${failN} 累计${store.questions.length}题`);
    }
    await sleep(90);
  }
}

await Promise.all(Array.from({ length: CONC }, worker));
await fs.writeFile(STORE, JSON.stringify(store), "utf8");

// 去重
const uniq = new Map();
for (const q of store.questions) uniq.set(`${q.subjectCode}|${q.exerID}|${q.chapter}`, q);
store.questions = [...uniq.values()];
await fs.writeFile(STORE, JSON.stringify(store), "utf8");

console.log(`\n完成: 成功${okN} 失败${failN} | 去重后题目 ${store.questions.length}`);
const bySub = {};
for (const q of store.questions) bySub[q.subjectName] = (bySub[q.subjectName] || 0) + 1;
Object.entries(bySub).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
