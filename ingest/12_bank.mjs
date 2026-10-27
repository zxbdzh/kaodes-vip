import fs from "node:fs/promises";
import path from "node:path";

const OUT = "F:/github/kaodes_vip/data";
const store = JSON.parse(await fs.readFile(path.join(OUT, "chapter_questions.json"), "utf8"));
const paperBank = JSON.parse(await fs.readFile(path.join(OUT, "question_bank.json"), "utf8"));
const library = JSON.parse(await fs.readFile(path.join(OUT, "library.json"), "utf8"));

// 合并所有题目
const all = [];
const seen = new Set();

for (const q of store.questions || []) {
  const k = `${q.subjectCode}|${q.exerID}|${q.chapter}`;
  if (seen.has(k)) continue;
  seen.add(k);
  all.push({
    id: q.exerID, code: q.subjectCode, subject: q.subjectName,
    kind: "chapter", paper: null, chapter: q.chapter,
    type: q.type, title: q.title, options: q.options,
    answer: q.answer, analysis: q.analysis,
    sonExer: q.sonExer || [],
  });
}

for (const c of Object.values(paperBank.courses || {})) {
  for (const q of c.questions || []) {
    const k = `${c.code}|${q.exerID}|${q.paperName}`;
    if (seen.has(k)) continue;
    seen.add(k);
    all.push({
      id: q.exerID, code: c.code, subject: c.name,
      kind: "paper", paper: q.paperName, chapter: null,
      type: q.type, title: q.title, options: q.options,
      answer: q.answer, analysis: q.analysis,
      sonExer: [],
    });
  }
}

// 按科目分组
const bySubject = {};
for (const q of all) {
  if (!bySubject[q.code]) bySubject[q.code] = { code: q.code, name: q.subject, questions: [], papers: new Map(), chapters: new Set() };
  const s = bySubject[q.code];
  s.questions.push(q);
  if (q.paper) s.papers.set(q.paper, (s.papers.get(q.paper) || 0) + 1);
  if (q.chapter) s.chapters.add(q.chapter);
}

// 章节目录（用于本地练习分组）
const chaptersByCode = {};
for (const sub of library) {
  if (!sub.ok) continue;
  chaptersByCode[sub.code] = { courseId: String(sub.courseId), cstId: sub.cstId, name: sub.courseName };
}

const output = {
  generatedAt: new Date().toISOString(),
  total: all.length,
  subjects: Object.values(bySubject).map((s) => ({
    code: s.code, name: s.name,
    total: s.questions.length,
    chapterCount: s.chapters.size,
    paperCount: s.papers.size,
    papers: [...s.papers.entries()].map(([name, n]) => ({ name, count: n })),
    questions: s.questions,
  })),
};

await fs.writeFile(path.join(OUT, "bank.json"), JSON.stringify(output, null, 1), "utf8");
const size = (await fs.stat(path.join(OUT, "bank.json"))).size;

console.log(`bank.json: ${all.length} 题 | ${(size / 1024 / 1024).toFixed(2)} MB`);
for (const s of output.subjects) {
  console.log(`  ${s.code} ${s.name}: ${s.total} 题 | ${s.chapterCount} 章 | ${s.paperCount} 卷`);
}

// 题型统计
const types = {};
for (const q of all) types[q.type] = (types[q.type] || 0) + 1;
console.log("\n题型:", JSON.stringify(types, null, 0));
