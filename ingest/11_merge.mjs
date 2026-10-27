import fs from "node:fs/promises";

// 汇总题库现状
const store = JSON.parse(await fs.readFile("F:/github/kaodes_vip/data/chapter_questions.json", "utf8"));
const paperBank = JSON.parse(await fs.readFile("F:/github/kaodes_vip/data/question_bank.json", "utf8"));

const chQs = store.questions || [];
const paperQs = [];
for (const c of Object.values(paperBank.courses || {})) {
  for (const q of c.questions || []) paperQs.push({ ...q, subjectCode: c.code, subjectName: c.name });
}

console.log("章节练习题:", chQs.length);
console.log("试卷题（真题/模拟）:", paperQs.length);

// 合并去重
const uniq = new Map();
for (const q of chQs) uniq.set(`${q.subjectCode}|${q.exerID}|${q.chapter}`, q);
for (const q of paperQs) uniq.set(`${q.subjectCode}|${q.exerID}|${q.paperName}`, q);
console.log("合并去重:", uniq.size);

const bySub = {};
for (const q of uniq.values()) {
  const k = q.subjectCode + " " + q.subjectName;
  bySub[k] = bySub[k] || { ch: 0, paper: 0, total: 0 };
  bySub[k].total++;
  if (q.paperName) bySub[k].paper++; else bySub[k].ch++;
}
Object.entries(bySub).sort((a, b) => b[1].total - a[1].total).forEach(([k, v]) => {
  console.log(`  ${k}: 共${v.total} (章练${v.ch} + 试卷${v.paper})`);
});
