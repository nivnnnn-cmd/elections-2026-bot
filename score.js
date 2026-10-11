/* ============================================================
   החישוב של הבוט. כל הכללים נמצאים כאן, ורק כאן.
   ההסבר במילים פשוטות מופיע באתר ("איך זה מחושב") ובתוכנית.
   ============================================================ */
(function (root) {
  const MIN_USER_ANSWERS = 14; // צריך לפחות 14 תשובות "בעד" או "נגד" (מתוך 18 הצבעות) כדי לקבל תוצאה
  const MIN_COMMON = 8;        // מפלגה שהייתה קיימת בפחות מ-8 מההצבעות שענית עליהן לא מקבלת אחוז
  const IMPORTANT_WEIGHT = 2;  // שאלה בנושא שסומן כחשוב נספרת פעמיים
  const NEUTRAL_CREDIT = 0.5;  // המפלגה הייתה בכנסת אבל לא בחרה צד: חצי נקודה (לא הסכימה ולא התנגדה)

  const isAnswer = x => x === 'for' || x === 'against';

  /* שלב א: העמדה של מפלגה בהצבעה.
     comps = {שם סיעה: {for, against, abstain, present, absent}}.
     מחזיר: 'for' / 'against' / 'none' (הייתה בכנסת ולא בחרה צד) / null (לא הייתה קיימת). */
  function partyPosition(comps) {
    if (!comps) return null;
    let f = 0, a = 0, members = 0;
    for (const c of Object.values(comps)) {
      f += c.for || 0;
      a += c.against || 0;
      members += (c.for || 0) + (c.against || 0) + (c.abstain || 0) + (c.present || 0) + (c.absent || 0);
    }
    if (members === 0) return null;
    if ((f + a) * 2 < members) return 'none'; // רוב חברי המפלגה לא בחרו צד
    if (f > a) return 'for';
    if (a > f) return 'against';
    return 'none'; // שוויון
  }

  function countAnswered(answers) {
    return Object.values(answers).filter(isAnswer).length;
  }

  /* שלבים ג ו-ד: ההשוואה והאחוז למפלגה אחת.
     כל הצבעה שענית עליה ושהמפלגה הייתה בה בכנסת נספרת במכנה – גם אם המפלגה לא בחרה צד.
     כך לכל המפלגות יש אותו מכנה, ומפלגה לא יכולה להגיע ל-100% רק כי השתתפה בפחות הצבעות. */
  function scoreParty(questions, answers, positions, importantTopics) {
    let points = 0, max = 0, count = 0, decided = 0, same = 0;
    for (const q of questions) {
      const u = answers[q.id], p = positions[q.id];
      if (!isAnswer(u) || !p) continue; // לא ענית, או שהמפלגה לא הייתה קיימת
      const w = importantTopics.includes(q.topic) ? IMPORTANT_WEIGHT : 1;
      max += w;
      count += 1;
      if (p === 'none') { points += w * NEUTRAL_CREDIT; continue; }
      decided += 1;
      if (u === p) { points += w; same += 1; }
    }
    const percent = count >= MIN_COMMON ? Math.floor(points / max * 100 + 0.5) : null;
    return { points, max, count, decided, same, percent };
  }

  /* ============================================================
     שאלת הבסיס: "ישראל צריכה להישאר מדינת הלאום של העם היהודי".
     4 דרגות, גם למשתמש וגם למפלגה. השאלה שווה חמישית מהתוצאה (רבע ממקסימום ההצבעות),
     אצל כל משתמש, גם אם סימן נושאים חשובים.
     אין פער = כל הנקודות. פער של דרגה אחת = שני שלישים (4 מתוך 6). פער של שתי דרגות ומעלה = 0.
     "שתי דרגות ומעלה = 0" נועד לכך שמחלוקת אמיתית אף פעם לא תעלה את ההתאמה (בגלל הממוצע זה קרה למפלגות בתחתית).
     פער של דרגה אחת הוא הסכמה חלקית, ולכן הוא כן יכול להעלות מפלגה שההצבעות שלה נמוכות מ-67%.
     ============================================================ */
  const CORE_RANK = { agree: 3, neutral: 2, disagree: 1, strongly_disagree: 0 };
  const CORE_SHARE = 0.25; // המקסימום של השאלה, כחלק ממקסימום ההצבעות (למשל 4.5 מתוך 18, כלומר חמישית מהסך הכול)
  const CORE_ONE_STEP = 2 / 3;
  const isCore = x => x in CORE_RANK;

  function coreCredit(userAns, partyPos) {
    const gap = Math.abs(CORE_RANK[userAns] - CORE_RANK[partyPos]);
    return gap === 0 ? 1 : gap === 1 ? CORE_ONE_STEP : 0;
  }

  /* מוסיף את שאלת הבסיס לתוצאה של מפלגה (תוצאה מ-scoreParty). בלי תשובה, או בלי עמדה למפלגה: לא משנה כלום */
  function applyCore(result, userAns, partyPos) {
    if (result.percent === null || !isCore(userAns) || !isCore(partyPos)) return { ...result, core: null };
    const coreMax = result.max * CORE_SHARE, got = coreMax * coreCredit(userAns, partyPos);
    const points = result.points + got, max = result.max + coreMax;
    return { ...result, points, max, percent: Math.floor(points / max * 100 + 0.5),
      core: { gap: Math.abs(CORE_RANK[userAns] - CORE_RANK[partyPos]), points: got, max: coreMax } };
  }

  /* שלב ה: הסדר. מפלגות עם אותו אחוז (כמו שהוא מוצג, מעוגל) נמצאות באותה קבוצה – "תיקו". */
  function rank(results) {
    const scored = results.filter(r => r.percent !== null)
      .sort((x, y) => y.percent - x.percent || x.ballotIndex - y.ballotIndex);
    const groups = [];
    for (const r of scored) {
      const last = groups[groups.length - 1];
      if (last && last.percent === r.percent) last.parties.push(r);
      else groups.push({ percent: r.percent, parties: [r] });
    }
    const unscored = results.filter(r => r.percent === null).sort((x, y) => x.ballotIndex - y.ballotIndex);
    return { groups, unscored };
  }

  /* כמה אחוזים שווה תשובה אחת (בלי משקל). משמש כדי להגיד למשתמש כשההפרש בין מקומות קטן מתשובה אחת. */
  function oneAnswerPercent(results) {
    const r = results.find(x => x.percent !== null);
    return r ? 100 / r.max : null;
  }

  /* ============================================================
     שלב 2: שאלות עמדה. הן רק שוברות שוויון בין מפלגות שהצביעו כמעט אותו דבר.
     ============================================================ */
  const STMT_MIN = 2; // מפלגה צריכה עמדה לפחות ב-2 שאלות שענית עליהן (וגם בחצי מהן), כדי שהשאלות יסדרו אותה
  // שלוש תשובות על סרגל אחד: כן, באמצע, לא. גם המשתמש וגם המפלגה
  const STEP = { agree: 1, middle: 0, disagree: -1 };
  const isStmtAnswer = x => x in STEP;

  /* ההשוואה בשאלות העמדה למפלגה אחת. העמדה של המפלגה: agree / middle / disagree / none.
     אותה תשובה = נקודה. צעד אחד הבדל (למשל "כן" מול "באמצע") = חצי נקודה. הפוך ("כן" מול "לא") = 0.
     "לא פרסמה עמדה" (none) לא נספר.
     share = הנקודות חלקי מספר השאלות שנספרו, או null אם אין מספיק עמדות. */
  function scoreStatements(statements, answers, positions) {
    let points = 0, count = 0, same = 0, near = 0, answered = 0;
    for (const s of statements) {
      const u = answers[s.id];
      if (!isStmtAnswer(u)) continue;
      answered += 1;
      const p = positions && positions[s.id];
      if (!isStmtAnswer(p)) continue; // לא פרסמה עמדה
      count += 1;
      const steps = Math.abs(STEP[u] - STEP[p]);
      if (steps === 0) { points += 1; same += 1; }
      else if (steps === 1) { points += NEUTRAL_CREDIT; near += 1; }
    }
    const share = count >= STMT_MIN && count * 2 >= answered ? points / count : null;
    return { points, count, same, near, answered, share };
  }

  /* הסדר הסופי. results = כמו ב-rank, ולכל מפלגה גם stmt (התוצאה של scoreStatements).
     1. מסדרים לפי ההצבעות.
     2. קבוצה "צמודה" מתחילה במפלגה הגבוהה בה, וכל מפלגה שרחוקה ממנה בפחות מתשובה אחת (onePct) מצטרפת אליה.
     3. בתוך הקבוצה: מפלגות שיש להן מספיק עמדות מסודרות לפי שאלות העמדה, אבל רק במקומות שהיו של מפלגות כאלה.
        מפלגה בלי מספיק עמדות נשארת בדיוק במקום שלה לפי ההצבעות: לא נענשת ולא מרוויחה.
     כך שאלות העמדה אף פעם לא מקפיצות מפלגה מעל מפלגה שהצביעה כמוך ביותר מתשובה אחת. */
  function rankWithStatements(results, onePct) {
    const scored = results.filter(r => r.percent !== null)
      .sort((x, y) => y.percent - x.percent || x.ballotIndex - y.ballotIndex);
    const clusters = [];
    for (const r of scored) {
      const c = clusters[clusters.length - 1];
      if (c && onePct !== null && c.parties[0].percent - r.percent < onePct) c.parties.push(r);
      else clusters.push({ parties: [r] });
    }
    const hasShare = r => r.stmt && r.stmt.share !== null;
    for (const c of clusters) {
      const slots = c.parties.map((r, i) => (hasShare(r) ? i : -1)).filter(i => i >= 0);
      const sorted = slots.map(i => c.parties[i])
        .sort((x, y) => y.stmt.share - x.stmt.share || y.percent - x.percent || x.ballotIndex - y.ballotIndex);
      slots.forEach((slot, k) => { c.parties[slot] = sorted[k]; });
      // האם שאלות העמדה שינו משהו או הבדילו בין מפלגות בקבוצה (בשביל ההסבר בתוצאות)
      c.byStatements = sorted.length >= 2 && new Set(sorted.map(r => r.stmt.share)).size > 1;
    }
    const unscored = results.filter(r => r.percent === null).sort((x, y) => x.ballotIndex - y.ballotIndex);
    return { clusters, unscored };
  }

  /* מראים רק את n המפלגות הכי קרובות. אם הגבול נופל באמצע קבוצה של מפלגות צמודות, חותכים אותה שם:
     הסדר בתוכה כבר נקבע (לפי שאלות העמדה, ואם אין הכרעה, לפי סדר הפתק) */
  function topClusters(clusters, n) {
    const out = []; let left = n;
    for (const c of clusters) {
      if (left <= 0) break;
      out.push(c.parties.length <= left ? c : { ...c, parties: c.parties.slice(0, left) });
      left -= c.parties.length;
    }
    return out;
  }

  root.Score = { MIN_USER_ANSWERS, MIN_COMMON, IMPORTANT_WEIGHT, NEUTRAL_CREDIT, STMT_MIN,
    CORE_RANK, partyPosition, countAnswered, scoreParty, coreCredit, applyCore, rank, oneAnswerPercent, scoreStatements, rankWithStatements, topClusters };
})(typeof window !== 'undefined' ? window : globalThis);
