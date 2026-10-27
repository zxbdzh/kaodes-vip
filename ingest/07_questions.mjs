import fs from "node:fs/promises";
import path from "node:path";

const B = "https://beegoapi.beeeeego.com/mobile";
const TOKEN = process.env.EGO_TOKEN || "";
const H = { agencyId: "9922", token: TOKEN, platform: "Pc" };
const OUT = "F:/github/kaodes_vip/data";
const STORE = path.join(OUT, "question_bank.json");

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
      await sleep(700 * (i + 1));
    }
  }
}

const library = JSON.parse(await fs.readFile(path.join(OUT, "library.json"), "utf8"));
let bank = { generatedAt: new Date().toISOString(), courses: {} };
try { bank = JSON.parse(await fs.readFile(STORE, "utf8")); } catch (e) { }

// 规范化题目
function normQ(q, meta) {
  return {
    exerID: q.exerID,
    type: q.keyType || q.answerType || "",
    score: q.simExamScore ?? null,
    title: (q.title || "").trim(),
    options: ["a", "b", "c", "d", "e", "f", "g", "h"]
      .map((k) => ({ k: k.toUpperCase(), v: (q[k] || "").trim() }))
      .filter((o) => o.v),
    answer: q.rightKey || (Array.isArray(q.rightKeyList) ? q.rightKeyList.join("") : ""),
    analysis: (q.analyze || "").trim(),
    accuracy: q.accuracyAmount ?? null,
    practiceTimes: q.pracTimesAmount ?? null,
    source: meta.source,
    paperName: meta.paperName || null,
    chapter: meta.chapter || null,
  };
}

let totalPapers = 0, totalQuestions = 0;

for (const sub of library) {
  if (!sub.ok) continue;
  const key = String(sub.code);
  if (!bank.courses[key]) {
    bank.courses[key] = {
      code: sub.code, name: sub.courseName, courseId: String(sub.courseId),
      cstId: sub.cstId, productId: sub.productId,
      papers: [], questions: [], chapterTree: null, done: false,
    };
  }
  const c = bank.courses[key];
  if (c.done) { console.log(`skip ${key} ${c.name} (已完成 ${c.questions.length} 题)`); totalQuestions += c.questions.length; totalPapers += c.papers.length; continue; }

  console.log(`\n=== ${key} ${sub.courseName} ===`);

  // 1) 试卷列表
  const listRes = await api("GET", `/mockExam/getCourseOtherDate?courseId=${sub.courseId}&cstId=${sub.cstId}`);
  const sims = (listRes.data && listRes.data.simExams) || [];
  if (!c.papers.length) {
    c.papers = sims.map((s) => ({
      simID: s.simID, specialProjectId: s.specialProjectId,
      examName: s.examName, simType: s.simType, exerNum: s.exerNum,
      totalScore: s.totalScore, examDate: s.examDate,
    }));
  }
  console.log(`  试卷 ${sims.length} 份`);

  // 2) 逐份抓题
  const seen = new Set(c.questions.map((q) => `${q.exerID}|${q.paperName}`));
  for (const s of sims) {
    const res = await api("GET", `/mockExam/getMockExam?specialProjectId=${s.specialProjectId}&cstId=${sub.cstId}&courseId=${sub.courseId}&isRedo=0&simRecordType=1`);
    if (res.code !== 200 || !res.data || !res.data.exerList) {
      console.log(`    ✗ ${s.examName.slice(-24)} => ${res.code} ${String(res.message || "").slice(0, 30)}`);
      await sleep(250);
      continue;
    }
    let n = 0;
    for (const q of res.data.exerList) {
      const k = `${q.exerID}|${s.examName}`;
      if (seen.has(k)) continue;
      seen.add(k);
      c.questions.push(normQ(q, { source: s.simType, paperName: s.examName }));
      n++;
    }
    console.log(`    ✓ ${s.examName.slice(-26)} +${n} 题`);
    await sleep(280);
  }

  // 3) 章节练习树 + 统计
  const chRes = await api("POST", "/course/chapter", { courseId: sub.courseId, cstId: sub.cstId });
  if (chRes.code === 200 && chRes.data) {
    c.chapterTree = {
      exerNum: chRes.data.exerNum,
      finishExerNum: chRes.data.finishExerNum,
      correctRate: chRes.data.correctRate,
      practiceChapter: chRes.data.practiceChapter,
    };
    // 统计章节题量
    const leaves = [];
    const walk = (arr, anc) => {
      for (const n of arr || []) {
        const chain = [...anc, n.name];
        if (!n.children || !n.children.length) leaves.push({ name: chain.join(" > "), exerNum: n.exerNum || 0 });
        if (n.children) walk(n.children, chain);
      }
    };
    walk(chRes.data.practiceChapter, []);
    c.chapterStats = { totalChapters: leaves.length, totalExer: leaves.reduce((a, b) => a + b.exerNum, 0) };
    console.log(`  章练习 ${c.chapterStats.totalExer} 题 / ${c.chapterStats.totalChapters} 节`);
  }

  c.done = true;
  totalPapers += c.papers.length;
  totalQuestions += c.questions.length;
  await fs.writeFile(STORE, JSON.stringify(bank, null, 1), "utf8");
  console.log(`  累计: ${c.questions.length} 题`);
  await sleep(200);
}

await fs.writeFile(STORE, JSON.stringify(bank, null, 1), "utf8");
console.log(`\n========== 完成 ==========`);
console.log(`课程 ${Object.keys(bank.courses).length} | 试卷 ${totalPapers} | 题目 ${totalQuestions}`);
