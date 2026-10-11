/* הממשק של הבוט: שאלות בסגנון צ'אט, בחירת נושאים חשובים, ותוצאות.
   כל החישוב נמצא ב-score.js. כאן רק מציגים. התשובות לא נשמרות ולא נשלחות. */
(async function () {
  const S = window.Score;
  const load = f => fetch(f, { cache: 'no-cache' }).then(r => r.json()); // תמיד בודקים שהנתונים עדכניים
  const [qData, votes, parties, stData, coreData] = await Promise.all([
    load('data/questions.json'), load('data/votes.json'), load('data/parties.json'),
    load('data/statements.json').catch(() => null), load('data/core.json').catch(() => null)]);

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const both = (real, blind) => `<span class="real">${real}</span><span class="blindtxt">${blind}</span>`;
  const Q = qData.votes;
  const topicTitle = id => qData.topics.find(t => t.id === id).title;
  const voteById = Object.fromEntries(votes.map(v => [v.id, v]));
  const LABEL = { for: 'בעד', against: 'נגד', skip: 'לא יודע/ת' };
  // שלב 2: שאלות עמדה ששוברות שוויון בין מפלגות צמודות
  const ST = stData ? stData.statements : [];
  const stById = Object.fromEntries(ST.map(x => [x.id, x]));
  // לכל שאלת עמדה שלוש תשובות משלה (כן / באמצע / לא). אותו נוסח מתאר גם את התשובה שלך וגם את עמדת המפלגה
  const optLabel = (x, v) => (x.options && x.options[v]) || (v === 'none' ? 'לא פרסמה עמדה' : LABEL[v] || 'לא ענית');
  const STEPS = { agree: 1, middle: 0, disagree: -1 };
  // שאלת הבסיס (מדינת הלאום): נשאלת ראשונה, ונספרת בחישוב. ארבע תשובות, גם למשתמש וגם למפלגה
  const CORE = coreData ? coreData.question : null;
  const CORE_N = CORE ? 1 : 0;
  const CORE_ORDER = ['agree', 'neutral', 'disagree', 'strongly_disagree'];

  // אייקונים קטנים, מצוירים כאן בקוד, בלי טעינה מאתר חיצוני
  const svg = d => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const THUMB = '<path d="M7 11v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3a4 4 0 0 0 4-4V6a2 2 0 0 1 4 0v5h3a2 2 0 0 1 2 2l-1 5a2 3 0 0 1-2 2h-7a3 3 0 0 1-3-3"/>';
  const ICON = {
    up: svg(THUMB),
    down: svg(`<g transform="rotate(180 12 12)">${THUMB}</g>`),
    eye: svg('<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0-4 0"/><path d="M21 12c-2.4 4-5.4 6-9 6s-6.6-2-9-6c2.4-4 5.4-6 9-6s6.6 2 9 6"/>'),
    service: svg('<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>'),
    courts: svg('<path d="M12 4v16M7 20h10M5 8h14M5 8l-3 6a3 3 0 0 0 6 0zM19 8l-3 6a3 3 0 0 0 6 0z"/>'),
    inquiry: svg('<circle cx="10" cy="10" r="6"/><path d="M20 20l-5.5-5.5"/>'),
    security: svg('<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>'),
    police: svg('<path d="M12 3l2.5 5 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8z"/>'),
    economy: svg('<path d="M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5h4v5"/>'),
    religion: svg('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7"/>'),
    identity: svg('<path d="M12 3l9 5v2H3V8zM5 12v6M10 12v6M14 12v6M19 12v6M3 21h18"/>'),
    education: svg('<path d="M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6"/>'),
  };
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // שמות למצב עיוור: אותיות בסדר אקראי בכל כניסה, כדי שלא יהיה אפשר ללמוד אותן בעל פה
  const letters = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ', 'ל', 'מ'];
  for (let i = letters.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [letters[i], letters[j]] = [letters[j], letters[i]]; }

  const P = parties.map((p, i) => {
    const pos = {}, raw = {};
    for (const q of Q) {
      raw[q.id] = voteById[q.id].parties[p.name];
      pos[q.id] = S.partyPosition(raw[q.id]);
    }
    const stmt = {}; // העמדה של המפלגה בכל שאלת עמדה, והמקור
    for (const x of ST) stmt[x.id] = (stData.positions[p.name] || {})[x.id] || { position: 'none' };
    const stPos = Object.fromEntries(ST.map(x => [x.id, stmt[x.id].position]));
    const coreEntry = CORE ? coreData.positions[p.name] || null : null;
    return { ...p, ballotIndex: i, blindName: 'מפלגה ' + letters[i], isNew: raw[Q[0].id] === null, pos, raw, stmt, stPos,
      coreEntry, corePos: coreEntry ? coreEntry.position : null };
  });

  /* ---------- מצב ---------- */
  let answers = {}, queue = [], history = [], important = [], log = [], askLogLen = 0;
  let retry = false; // true = סבב שני, על ההצבעות שדילגו עליהן
  let swipeHintShown = false; // הרמז על ההחלקה מופיע פעם אחת בכל סבב
  let phase = 'votes'; // 'core' = שאלת הבסיס, 'votes' = הצבעות מהכנסת, 'stmts' = שאלות עמדה
  const chat = document.getElementById('chat'), actions = document.getElementById('actions');
  const dock = document.getElementById('dock'), resultsEl = document.getElementById('results');
  // הרווח בתחתית השיחה תמיד בגובה אזור הכפתורים, כדי שהכפתורים לא יסתירו את ההודעה האחרונה
  new ResizeObserver(() => { chat.style.paddingBottom = `${dock.offsetHeight + 24}px`; }).observe(dock);

  /* הכפתור שנלחץ אחרון: ממנו עולה בועת התשובה. כך רואים שהתשובה "יצאה" מהכפתור שלחצת עליו */
  let pressedFrom = null;
  const SPRING = 'linear(0,.34 8%,.8 20%,1.04 32%,1.07 40%,1.02 56%,.995 72%,1)';
  function flyFromButton(el) {
    const from = pressedFrom, to = el.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    el.animate([{ opacity: 0, transform: `translate(${dx}px,${dy}px) scale(.5)` }, { opacity: 1, transform: 'none' }],
      { duration: 600, easing: SPRING });
  }

  /* מוסיפים לשיחה רק את ההודעות החדשות. ההודעות הקודמות נשארות במקום ולא מהבהבות מחדש */
  function trimChat(animateOut = false) {
    while (chat.children.length > log.length) {
      const el = chat.lastElementChild;
      if (animateOut && !reduceMotion()) exitChat(el);
      el.remove();
    }
  }
  /* ב"חזרה" ההודעה לא נעלמת בבת אחת: היא יוצאת באותה דרך שבה נכנסה, רק לאחור.
     בועת תשובה חוזרת אל אזור הכפתורים שממנו יצאה, והודעת שאלה שוקעת ונמסה.
     היא יוצאת כעותק צף, כדי שהמסך יהיה מיד מוכן לשאלה הבאה ולא יחכה לאנימציה */
  function exitChat(el) {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return; // מחוץ למסך, אין מה להראות
    const ghost = el.cloneNode(true);
    Object.assign(ghost.style, { position: 'fixed', top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', margin: 0,
      pointerEvents: 'none', zIndex: 4, animation: 'none' });
    document.body.appendChild(ghost);
    let frames, ms = 260;
    if (el.classList.contains('user')) {
      const d = dock.getBoundingClientRect();
      const dx = d.left + d.width / 2 - (r.left + r.width / 2), dy = d.top + d.height / 2 - (r.top + r.height / 2);
      frames = [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translate(${dx}px,${dy}px) scale(.5)` }];
      ms = 360;
    } else frames = [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(12px) scale(.97)' }];
    ghost.animate(frames, { duration: ms, easing: 'cubic-bezier(.4,0,.8,.4)' }).finished.then(() => ghost.remove(), () => ghost.remove());
  }
  function render() {
    trimChat();
    let firstNew = null;
    log.slice(chat.children.length).forEach((m, i) => {
      const el = document.createElement('div');
      // בועת תשובה שנולדה מלחיצה על כפתור עולה מהכפתור עצמו, ולכן לא מקבלת את הכניסה הרגילה
      const fly = m.who === 'user' && pressedFrom && !reduceMotion();
      el.className = `msg ${m.who}${fly ? '' : ' enter'}`;
      el.style.animationDelay = `${i * 0.12}s`; // ההודעה השנייה מופיעה רגע אחרי הראשונה
      el.innerHTML = m.html;
      chat.appendChild(el);
      if (fly) flyFromButton(el);
      firstNew = firstNew || el;
    });
    pressedFrom = null;
    drawProgress();
    // גוללים בעדינות להודעה החדשה. הגלילה מחושבת רגע אחרי, כשהכפתורים כבר במקומם (בשלב השני הם גבוהים יותר)
    if (firstNew && chat.children.length > 1) { scrollTarget = { first: firstNew, last: chat.lastElementChild }; requestAnimationFrame(settleScroll); }
  }
  /* גוללים כך שההודעה החדשה תתחיל מתחת לפס העליון, ואם היא ארוכה: עד שהשאלה כולה נראית מעל אזור הכפתורים.
     משתמשים במיקום בדף ולא במיקום על המסך, כי הודעה בתנועת כניסה "זזה" לרגע */
  let scrollTarget = null;
  function settleScroll() {
    if (!scrollTarget) return;
    const { first, last } = scrollTarget; scrollTarget = null;
    if (!first.isConnected || !last.isConnected || chat.hidden) return;
    chat.style.paddingBottom = `${dock.offsetHeight + 24}px`; // קודם מרחיבים את הדף לפי גובה הכפתורים, אחרת אי אפשר לגלול מספיק
    const toTop = first.offsetTop - 100;
    const toQuestion = last.offsetTop + last.offsetHeight - (window.innerHeight - dock.offsetHeight - 16);
    window.scrollTo({ top: Math.max(toTop, toQuestion), behavior: reduceMotion() ? 'auto' : 'smooth' });
  }
  /* כשפותחים את ההסבר מתחת לשאלה, גוללים מעט כדי שהוא לא יוסתר מאחורי הכפתורים שלמטה.
     אבל לא יותר מדי: ראש הכרטיס נשאר תמיד מתחת לפס העליון */
  chat.addEventListener('toggle', e => {
    const d = e.target;
    if (!d.matches('details.explain') || !d.open) return;
    const card = d.closest('.msg'), p = d.querySelector('p');
    const bottom = p.getBoundingClientRect().bottom + window.scrollY + 8; // הגובה המלא של ההסבר, גם בזמן שהוא עוד נפתח
    const need = bottom - (window.innerHeight - dock.offsetHeight - 16);
    const top = Math.min(need, card.offsetTop - 100);
    if (top <= window.scrollY) return;
    if (reduceMotion()) return window.scrollTo(0, top);
    // ההסבר נפתח בהדרגה, והדף מתארך יחד איתו. לכן גוללים יחד עם הפתיחה, ולא בבת אחת בהתחלה (אז עוד אין לאן לגלול)
    const t0 = performance.now();
    (function step(now) {
      const want = Math.min(top, document.documentElement.scrollHeight - window.innerHeight);
      if (want > window.scrollY) window.scrollTo(0, window.scrollY + Math.max(1, (want - window.scrollY) * 0.2));
      if (now - t0 < 800 && window.scrollY < top - 1) requestAnimationFrame(step);
    })(t0);
  }, true);
  /* פס ההתקדמות בראש הדף. הודעה קצרה מופיעה ליד המספר רק ברגעים מיוחדים */
  function drawProgress() {
    const seen = Object.keys(answers).length, n = S.countAnswered(answers);
    const total = CORE_N + Q.length + ST.length;
    const special = n === S.MIN_USER_ANSWERS && phase === 'votes' ? 'יש מספיק לתוצאה!'
      : seen === Math.floor(total / 2) ? 'חצי דרך!' : '';
    document.getElementById('count').innerHTML =
      (special ? `<b class="special">${special}</b> · ` : '') + `${seen} מתוך ${total}`;
    document.getElementById('pfill').style.width = `${Math.round(seen / total * 100)}%`;
  }
  const bot = html => log.push({ who: 'bot', html });
  const user = text => log.push({ who: 'user', html: esc(text) });
  function setActions(html, animate = true) {
    actions.innerHTML = html;
    if (!animate) return; // למשל כשבוחרים נושא: רק מעדכנים, בלי להבהב
    actions.classList.remove('enter');
    void actions.offsetWidth; // מאפס את האנימציה כדי שתרוץ שוב
    actions.classList.add('enter');
  }

  /* ---------- פתיחה ---------- */
  function start() {
    answers = {}; history = []; important = []; log = []; retry = false;
    swipeHintShown = false;
    phase = CORE ? 'core' : 'votes';
    queue = CORE ? ['core'] : Q.map(q => q.id);
    resultsEl.hidden = true; chat.hidden = false; dock.hidden = false;
    document.getElementById('topProgress').hidden = false;
    chat.innerHTML = '';
    bot(`<p>${CORE ? 'שאלה אחת על זהות המדינה, ' : ''}${Q.length} הצבעות אמיתיות מהכנסת${ST.length ? ` ועוד ${ST.length} שאלות קצרות` : ''}. הצביעו בעצמכם, ובסוף תגלו אילו מפלגות הכי דומות לכם.</p>
         <p class="small">🔒 שום דבר לא נשמר ולא נשלח.</p>`);
    render();
    setActions(`<button class="btn primary" data-go="begin">יאללה, מתחילים</button>`);
  }

  /* ---------- שאלות ---------- */
  function askNext() {
    markSwipeable(null); // ברירת מחדל: אין כרטיס להחלקה. רק שאלת הצבעה רגילה מסמנת את הכרטיס שלה למטה
    if (phase === 'core') return askCore();
    if (!queue.length) return phase === 'stmts' ? askTopics() : afterPass();
    if (phase === 'stmts') return askStatement();
    const q = Q.find(x => x.id === queue[0]);
    askLogLen = log.length;
    // בכוונה בלי "מה יצא בכנסת": התוצאה רומזת מי הצביע בעד ומי נגד. היא מופיעה רק בפירוט שבדף התוצאות
    bot(`<span class="topic" data-t="${q.topic}">${ICON[q.topic] || ''}${esc(topicTitle(q.topic))}</span>
         <h3>${esc(q.title)}</h3>
         <details class="how explain"><summary>הסבר</summary><p>${esc(q.explain)}</p></details>${swipeHintShown ? '' : '<p class="small swipe-hint">אפשר גם להחליק את הכרטיס: ימינה = בעד, שמאלה = נגד.</p>'}`);
    swipeHintShown = true; // הרמז מופיע רק בשאלה הראשונה
    render();
    markSwipeable(chat.lastElementChild);
    // "בעד" ו"נגד" באותו צבע בדיוק, כדי שאף כפתור לא ייראה "נכון" יותר.
    // בין שאלה לשאלה הכפתורים נשארים במקום בלי אנימציה. אנימציה רק כשמגיעים מהפתיחה או מהנושאים
    const fresh = !actions.querySelector('[data-ans]');
    setActions(`<div class="answers"><button class="btn ans" data-ans="for">${ICON.up}בעד</button>
      <button class="btn ans" data-ans="against">${ICON.down}נגד</button>
      <button class="btn soft" data-ans="skip">לא יודע/ת</button></div>
      ${history.length ? '<button class="btn ghost" data-go="undo">↩ חזרה</button>' : ''}`, fresh);
  }

  /* שאלת הבסיס: משפט אחד וארבעה כפתורים באותו צבע, כדי שאף כפתור לא ייראה "נכון" יותר */
  function askCore() {
    askLogLen = log.length;
    bot(`<span class="topic" data-t="identity">${ICON.identity}זהות המדינה</span>
         <h3>${esc(CORE.text)}</h3>`);
    render();
    const fresh = !actions.querySelector('[data-ans="neutral"]');
    setActions(`<div class="answers stack">${CORE_ORDER.map(v =>
        `<button class="btn ans" data-ans="${v}">${esc(CORE.options[v])}</button>`).join('')}
      <button class="btn soft" data-ans="skip">לא יודע/ת</button></div>`, fresh);
  }

  /* שאלת עמדה: משפט קצר, ושלושה כפתורים באותו צבע */
  function askStatement() {
    const x = stById[queue[0]];
    askLogLen = log.length;
    bot(`<span class="topic" data-t="${x.topic}">${ICON[x.topic] || ''}${esc(topicTitle(x.topic))}</span>
         <h3>${esc(x.text)}</h3>`);
    render();
    const fresh = !actions.querySelector('[data-ans="middle"]');
    setActions(`<div class="answers stack">${['agree', 'middle', 'disagree'].map(v =>
        `<button class="btn ans" data-ans="${v}">${esc(x.options[v])}</button>`).join('')}
      <button class="btn soft" data-ans="skip">לא יודע/ת</button></div>
      <button class="btn ghost" data-go="undo">↩ חזרה</button>`, fresh);
  }

  function startStatements() {
    phase = 'stmts';
    queue = ST.map(x => x.id);
    bot(`<p>עוד ${ST.length} שאלות קצרות על מה שאתם חושבים. הן עוזרות להבדיל בין מפלגות שהצביעו כמעט אותו דבר.</p>`);
    askNext();
  }

  function answer(val) {
    const id = queue[0];
    history.push({ id, queue: [...queue], logLen: askLogLen, prev: answers[id], retry, phase });
    answers[id] = val;
    user(phase === 'core' ? (CORE.options[val] || LABEL[val]) : phase === 'stmts' ? optLabel(stById[id], val) : LABEL[val]);
    if (phase === 'core') { phase = 'votes'; queue = Q.map(q => q.id); } else queue.shift();
    // בסבב השני: ברגע שיש מספיק תשובות, עוברים לשלב הבא
    if (phase === 'votes' && retry && S.countAnswered(answers) >= S.MIN_USER_ANSWERS) queue = [];
    askNext();
  }

  function undo() {
    const h = history.pop();
    if (!h) return;
    queue = h.queue;
    retry = h.retry;
    phase = h.phase;
    if (h.prev === undefined) delete answers[h.id]; else answers[h.id] = h.prev;
    log.length = h.logLen;
    trimChat(true);
    askNext();
  }

  function afterPass() {
    const n = S.countAnswered(answers);
    if (n >= S.MIN_USER_ANSWERS) return ST.length ? startStatements() : askTopics();
    const missing = S.MIN_USER_ANSWERS - n;
    bot(`<p>ענית "בעד" או "נגד" על ${n} הצבעות. כדי לקבל תוצאה צריך לפחות ${S.MIN_USER_ANSWERS}, כלומר עוד ${missing}.</p>
         <p>בוא/י נחזור להצבעות שדילגת עליהן.</p>`);
    retry = true;
    queue = Q.map(q => q.id).filter(id => answers[id] !== 'for' && answers[id] !== 'against');
    askNext();
  }

  /* ---------- נושאים חשובים ---------- */
  function askTopics() {
    important = [];
    askLogLen = log.length;
    bot(`<p>אילו נושאים הכי חשובים לך? <span class="small">(עד 3, הם ייספרו פעמיים)</span></p>`);
    render();
    drawTopics();
  }
  function drawTopics(animate = true) {
    setActions(`<div class="chips">${qData.topics.map(t =>
      `<button class="chip" data-t="${t.id}" data-topic="${t.id}" aria-pressed="${important.includes(t.id)}"
        ${!important.includes(t.id) && important.length >= 3 ? 'disabled' : ''}>${esc(t.title)}</button>`).join('')}</div>
      <button class="btn primary" data-go="results">${important.length ? 'הצג תוצאות' : 'דלג והצג תוצאות'}</button>
      <button class="btn ghost" data-go="undo">↩ חזרה</button>`, animate);
  }

  /* ---------- תוצאות ---------- */
  /* השיחה והכפתורים מתעממים רגע, ורק אז מופיעות התוצאות (בלי "קפיצה" פתאומית בין המסכים) */
  let leaving = false;
  function showResults() {
    if (leaving) return;
    if (reduceMotion()) return buildResults();
    leaving = true;
    chat.classList.add('leaving'); dock.classList.add('leaving');
    setTimeout(() => {
      buildResults();
      chat.classList.remove('leaving'); dock.classList.remove('leaving');
      leaving = false;
    }, 240);
  }
  const TOP_N = 5; // כמה מפלגות מציגים בתוצאות
  function buildResults() {
    user(important.length ? 'חשוב לי: ' + important.map(topicTitle).join(', ') : 'בלי נושאים חשובים');
    const results = P.map(p => {
      const stmt = S.scoreStatements(ST, answers, p.stPos);
      if (p.isNew) return { party: p, ballotIndex: p.ballotIndex, percent: null, count: 0, reason: 'new', stmt };
      const r = S.applyCore(S.scoreParty(Q, answers, p.pos, important), answers.core, p.corePos);
      return { party: p, ballotIndex: p.ballotIndex, ...r, reason: r.percent === null ? 'few' : null, stmt };
    });
    const { clusters, unscored } = S.rankWithStatements(results, S.oneAnswerPercent(results));
    const newParties = unscored.filter(r => r.reason === 'new'), few = unscored.filter(r => r.reason !== 'new');
    const shown = S.topClusters(clusters, TOP_N); // מראים רק את חמש המפלגות הראשונות
    chat.hidden = true; dock.hidden = true; resultsEl.hidden = false;
    document.getElementById('topProgress').hidden = true;
    document.getElementById('count').textContent = '';

    resultsEl.innerHTML = `
      <div class="res-head">
        <h2>המפלגות שהצביעו הכי דומה לך</h2>
      </div>
      <div class="bar-top">
        <button class="btn primary" data-go="reveal">${revealLabel()}</button>
        <button class="btn" data-go="restart">להתחיל מחדש</button>
      </div>
      <div class="note">מפלגות מאותו מחנה מצביעות כמעט תמיד יחד.${ST.length ? ' כשהן צמודות, הסדר ביניהן נקבע לפי שאלות העמדה.' : ''}</div>
      ${shown.map((c, i) => clusterHtml(c, i)).join('')}
      ${newParties.length ? `<section class="group newbox"><h3>מפלגות חדשות</h3>
        <p class="small">לא היו בכנסת ה-25, ולכן אין להן הצבעות ואין להן אחוז.${ST.length ? ' זה מה שהן אומרות:' : ''}</p>
        ${newParties.map(r => `<div class="party">
          <div class="party-row"><span class="pname">${both(esc(r.party.name), r.party.blindName)}</span></div>
          ${coreLine(r.party) ? `<div class="stmtline">${coreLine(r.party)}</div>` : ''}
          ${ST.length ? `<div class="stmtline">${stmtLine(r.stmt, true)}</div>` : ''}
          ${ST.length || CORE ? detailButton(r.party, () => `${coreDetailHtml(r.party)}${ST.length ? stmtDetailHtml(r.party) : ''}`) : ''}
        </div>`).join('')}</section>` : ''}
      ${few.length ? `<div class="unscored group"><h3>מפלגות בלי תוצאה</h3><ul>${few.map(r => `<li><b>${both(esc(r.party.name), r.party.blindName)}</b>:
        אין מספיק הצבעות להשוואה (המפלגה הייתה בכנסת רק ב-${r.count} מההצבעות שענית עליהן, וצריך ${S.MIN_COMMON}).</li>`).join('')}</ul></div>` : ''}
      ${howHtml()}
      <footer>כל המספרים מהמאגר הרשמי של הכנסת. 🔒 שום דבר לא נשמר.</footer>`;
    window.scrollTo({ top: 0 });
    riseResults();
    animateResults();
  }

  /* כל חלק בדף התוצאות עולה מעט מלמטה, בהפרש קטן מהקודם. אחרי העשירי כולם עולים יחד */
  function riseResults() {
    if (reduceMotion()) return;
    [...resultsEl.children].forEach((el, i) => {
      if (el.hidden) return;
      el.classList.add('rise');
      el.style.animationDelay = `${Math.min(i, 9) * 70}ms`;
    });
  }

  /* אותה עקומה בדיוק של פס המילוי (cubic-bezier(.22,1,.36,1)), כדי שהמספר והפס יאטו ויעצרו יחד.
     מחשבים אותה בקוד כי מספר שמשתנה בטקסט לא יכול להשתמש בעקומה של CSS */
  function bezierEase(x1, y1, x2, y2) {
    const ax = 3 * x1 - 3 * x2 + 1, bx = 3 * x2 - 6 * x1, cx = 3 * x1;
    const ay = 3 * y1 - 3 * y2 + 1, by = 3 * y2 - 6 * y1, cy = 3 * y1;
    const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t;
    const dX = t => (3 * ax * t + 2 * bx) * t + cx;
    return x => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) { const e = X(t) - x; if (Math.abs(e) < 1e-5) break; const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
      let lo = 0, hi = 1; // מגן למקרה שנוטון לא התכנס
      if (t < 0 || t > 1 || Math.abs(X(t) - x) > 1e-3) { t = x; for (let i = 0; i < 24; i++) { if (X(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; } }
      return Y(t);
    };
  }
  const barEase = bezierEase(.22, 1, .36, 1);

  /* האחוזים "רצים" מ-0 עד המספר הסופי, והפסים מתמלאים, אחד אחרי השני */
  function animateResults() {
    if (reduceMotion()) return; // המספרים הסופיים כבר כתובים בדף
    resultsEl.querySelectorAll('.party.scored').forEach((sec, i) => {
      const pct = sec.querySelector('.pct'), bar = sec.querySelector('.meter i');
      const v = +pct.dataset.v, delay = i * 160, dur = 1100;
      bar.style.transition = 'none'; bar.style.width = '0';
      pct.textContent = '0%';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        bar.style.transition = `width ${dur}ms cubic-bezier(.22,1,.36,1) ${delay}ms`;
        bar.style.width = v + '%';
      }));
      const t0 = performance.now() + delay;
      (function tick(t) {
        const x = Math.min(Math.max((t - t0) / dur, 0), 1);
        pct.textContent = Math.round(v * barEase(x)) + '%';
        if (x < 1) requestAnimationFrame(tick);
      })(performance.now());
    });
  }

  /* חשיפה או הסתרה של שמות המפלגות. כל שם "מתהפך" רגע אחרי הקודם */
  const revealLabel = () => ICON.eye + (document.body.classList.contains('blind') ? 'חשוף שמות' : 'הסתר שמות');
  function toggleReveal(btn) {
    document.body.classList.toggle('blind');
    btn.innerHTML = revealLabel();
    if (reduceMotion()) return;
    resultsEl.querySelectorAll('.pname').forEach((el, i) => {
      el.classList.remove('flip');
      void el.offsetWidth; // מאפס את האנימציה כדי שתרוץ שוב
      el.style.animationDelay = `${i * 90}ms`;
      el.classList.add('flip');
    });
  }

  /* כרטיס לכל קבוצה. קבוצה של כמה מפלגות = מפלגות שהצביעו כמעט אותו דבר (הפרש קטן מתשובה אחת) */
  function clusterHtml(c, i) {
    const many = c.parties.length > 1;
    return `<section class="group${i === 0 ? ' lead' : ''}">
      <div class="group-head"><span class="rankno">${i + 1}</span>
        ${many ? `<span class="tie">${c.parties.length} מפלגות צמודות</span>` : ''}</div>
      ${many ? `<p class="small cluster-note">הצביעו כמעט כמוך באותה מידה.${!ST.length ? ''
        : c.byStatements ? ' הסדר ביניהן נקבע לפי שאלות העמדה.' : ' שאלות העמדה לא הכריעו ביניהן.'}</p>` : ''}
      ${c.parties.map(r => `<div class="party scored">
        <div class="party-row"><span class="pname">${both(esc(r.party.name), r.party.blindName)}</span>
          <span class="pct" data-v="${r.percent}">${r.percent}%</span></div>
        <div class="meter"><i style="width:${r.percent}%"></i></div>
        ${many && ST.length ? `<div class="stmtline">${stmtLine(r.stmt, false)}</div>` : ''}
        ${r.decided * 2 < r.count ? `<div class="pnote">⚠️ לא בחרה צד ברוב ההצבעות, אז יש עליה פחות מידע</div>` : ''}
        ${r.party.people ? `<div class="pnote blindtxt">⚠️ מבוססת על הצבעות של 3 עד 5 חברי כנסת בלבד, שישבו בכנסת בסיעות אחרות</div>` : ''}
        ${r.party.note ? `<div class="pnote real">${esc(r.party.note)}</div>` : ''}
        ${detailButton(r.party, () => `<div class="based">בחרה צד ב-${r.decided} מתוך ${r.count} ההצבעות שענית עליהן</div>${coreDetailHtml(r.party)}${detailHtml(r.party)}
          ${ST.length ? `<h4>שאלות העמדה</h4>${stmtDetailHtml(r.party)}` : ''}`)}
      </div>`).join('')}
    </section>`;
  }

  /* שאלת הבסיס: כמה רחוקה התשובה של המפלגה משלך (בדרגות). null אם לא ענית */
  const coreGap = p => answers.core in S.CORE_RANK && p.corePos in S.CORE_RANK
    ? Math.abs(S.CORE_RANK[answers.core] - S.CORE_RANK[p.corePos]) : null;
  function coreLine(p) {
    const g = coreGap(p);
    return g === null ? '' : `בשאלת זהות המדינה: ${g === 0 ? 'אותה תשובה כמוך' : g === 1 ? 'תשובה קרובה לשלך' : 'תשובה רחוקה משלך'}`;
  }
  /* הפירוט של שאלת הבסיס: מה ענית, מה המפלגה אומרת, וציטוט עם קישור (רק אחרי חשיפת השמות) */
  function coreDetailHtml(p) {
    const e = p.coreEntry;
    if (!CORE || !e) return '';
    const g = coreGap(p);
    const mark = g === null ? '<span class="mark skip">– לא נספר</span>'
      : g === 0 ? '<span class="mark same">✓ אותו דבר</span>'
      : g === 1 ? '<span class="mark skip">≈ קרוב (פער של דרגה אחת)</span>' : '<span class="mark diff">✗ רחוק</span>';
    return `<h4>שאלת זהות המדינה</h4><div class="dq"><div class="t">${esc(CORE.text)}</div>
      <div class="row"><span>את/ה: <b>${esc(CORE.options[answers.core] || 'לא ענית')}</b></span><span>המפלגה: <b>${esc(CORE.options[e.position])}</b></span>${mark}</div>
      <div class="counts real">"${esc(e.quote)}" (${esc(e.speaker)}, ${esc(e.date)}) ·
        <a href="${esc(e.url)}" target="_blank" rel="noopener">המקור</a>${e.note ? `<br>${esc(e.note)}` : ''}</div>
      <div class="counts blindtxt">הציטוט והמקור יופיעו אחרי חשיפת השמות.</div></div>`;
  }

  /* שורה קצרה: עד כמה המפלגה אומרת כמוך בשאלות העמדה */
  function stmtLine(st, isNew) {
    if (!st.answered) return 'לא ענית על שאלות העמדה';
    if (!st.count) return 'לא פרסמה עמדה באף אחת מהשאלות שענית עליהן';
    const near = st.near ? ` (ועוד ${st.near} קרובה)` : '';
    const base = `${isNew ? 'אותה תשובה כמוך' : 'בשאלות העמדה: אותה תשובה כמוך'} ב-${st.same} מתוך ${st.count}${near}`;
    return st.share === null && !isNew ? base + '. לא מספיק כדי לקבוע את הסדר' : base;
  }

  /* הפירוט של שאלות העמדה: מה ענית, מה המפלגה אומרת, וציטוט עם קישור (רק אחרי חשיפת השמות, כי הציטוט מגלה מי אמר) */
  function stmtDetailHtml(p) {
    return ST.map(x => {
      const u = answers[x.id], e = p.stmt[x.id], pos = e.position;
      const counted = u in STEPS && pos in STEPS;
      const steps = counted ? Math.abs(STEPS[u] - STEPS[pos]) : null;
      const mark = !counted ? '<span class="mark skip">– לא נספר</span>'
        : steps === 0 ? '<span class="mark same">✓ אותו דבר</span>'
        : steps === 1 ? '<span class="mark skip">½ קרוב (חצי נקודה)</span>' : '<span class="mark diff">✗ הפוך</span>';
      return `<div class="dq"><div class="t">${esc(x.text)}</div>
        <div class="row"><span>את/ה: <b>${esc(optLabel(x, u))}</b></span><span>המפלגה: <b>${esc(optLabel(x, pos))}</b></span>${mark}</div>
        ${pos !== 'none' ? `<div class="counts real">"${esc(e.quote)}" (${esc(e.speaker)}, ${esc(e.date)}) ·
          <a href="${esc(e.url)}" target="_blank" rel="noopener">המקור</a></div>
          <div class="counts blindtxt">הציטוט והמקור יופיעו אחרי חשיפת השמות.</div>` : ''}</div>`;
    }).join('');
  }

  function sumCounts(comps) {
    const t = { for: 0, against: 0, other: 0 };
    for (const c of Object.values(comps || {})) {
      t.for += c.for || 0; t.against += c.against || 0;
      t.other += (c.abstain || 0) + (c.present || 0) + (c.absent || 0);
    }
    return t;
  }

  function detailHtml(p) {
    return Q.map(q => {
      const u = answers[q.id], pos = p.pos[q.id], v = voteById[q.id];
      const t = sumCounts(p.raw[q.id]);
      const total = t.for + t.against + t.other;
      const posText = pos === 'for' || pos === 'against' ? LABEL[pos]
        : !pos ? 'לא הייתה קיימת' : (t.for + t.against) * 2 < total ? 'לא בחרה צד (רוב חבריה לא הצביעו)' : 'לא בחרה צד (שוויון)';
      const counted = (u === 'for' || u === 'against') && pos;
      const mark = !counted ? '<span class="mark skip">– לא נספר</span>'
        : pos === 'none' ? '<span class="mark skip">½ חצי נקודה</span>'
        : u === pos ? '<span class="mark same">✓ אותו דבר</span>' : '<span class="mark diff">✗ שונה</span>';
      return `<div class="dq"><div class="t">${esc(q.title)}</div>
        <div class="row"><span>את/ה: <b>${LABEL[u] || 'לא ענית'}</b></span><span>המפלגה: <b>${posText}</b></span>${mark}
          ${counted && important.includes(q.topic) ? '<span class="small" title="נושא חשוב, נספר פעמיים">×2</span>' : ''}</div>
        <div class="counts">מה יצא בכנסת: ${esc(q.result)}</div>
        ${total ? `<div class="counts">${p.people ? 'המועמדים שלה שכיהנו אז בכנסת' : 'חברי הכנסת של המפלגה'}: ${t.for} בעד · ${t.against} נגד · ${t.other} לא הצביעו ·
          <a href="${v.link}" target="_blank" rel="noopener">מקור באתר הכנסת</a></div>` : ''}</div>`;
    }).join('');
  }

  function howHtml() {
    return `<details class="how"><summary>איך זה מחושב?</summary><ol>
      <li><b>העמדה של כל מפלגה בכל הצבעה:</b> הצד שבחר רוב חברי הכנסת שלה שהצביעו. מפלגה שהיא איחוד: סופרים את כל המרכיבים יחד. אם רוב חברי המפלגה לא הצביעו (או שהיה שוויון), המפלגה "לא בחרה צד".</li>
      <li><b>ההשוואה:</b> בכל הצבעה שענית עליה: אם המפלגה באותו צד כמוך, היא מקבלת נקודה. אם בצד השני, 0. אם היא לא בחרה צד, חצי נקודה. "לא יודע/ת" שלך לא נספר.</li>
      <li><b>למה חצי נקודה?</b> כדי שכל המפלגות יימדדו על אותן הצבעות בדיוק. בלי זה, מפלגה שלא הצביעה ברוב הנושאים יכלה לקבל 100% רק בגלל כמה הצבעות בודדות שבהן הסכימה איתך.</li>
      <li><b>נושא חשוב</b> נספר פעמיים, גם כשאתם מסכימים וגם כשלא.</li>
      ${CORE ? `<li><b>שאלת זהות המדינה</b> (השאלה הראשונה) שווה חמישית מהתוצאה אצל כולם, גם אם סימנת נושאים חשובים. לכל מפלגה יש תשובה אחת מבין ארבע האפשרויות, ממקור רשמי עם ציטוט וקישור. אותה תשובה כמוך = כל הנקודות של השאלה. הבדל של דרגה אחת = שני שלישים מהן. הבדל של שתי דרגות ויותר = 0. אם ענית "לא יודע/ת", השאלה לא נספרת.</li>` : ''}
      <li><b>האחוז:</b> הנקודות שהמפלגה קיבלה, חלקי המקסימום שהיה אפשר, מעוגל למספר שלם.</li>
      <li><b>מינימום:</b> צריך לענות "בעד" או "נגד" על לפחות ${S.MIN_USER_ANSWERS} הצבעות. בפירוט של כל מפלגה כתוב בכמה מההצבעות האלה היא בחרה צד. אם לא בחרה צד ברובן, מופיעה אזהרה.</li>
      <li><b>מפלגות צמודות:</b> מפלגות שההפרש ביניהן קטן ממה שתשובה אחת עושה מופיעות יחד, באותו כרטיס.</li>
      <li><b>למה רק חמש?</b> מראים את חמש המפלגות הכי קרובות אליך. אם הגבול נופל באמצע קבוצה של מפלגות צמודות, מוצגות רק הראשונות בה, לפי הסדר שתואר כאן.</li>
      ${ST.length ? `<li><b>שאלות העמדה רק שוברות שוויון:</b> הן מסדרות מפלגות בתוך כרטיס של מפלגות צמודות, ולא יותר. בכל שאלה יש שלוש תשובות: כן, באמצע ולא. אותה תשובה כמו המפלגה = נקודה, צעד אחד הבדל (למשל "כן" מול "באמצע") = חצי נקודה, הפוך = 0. מפלגה שלא פרסמה עמדה בשאלה, לא נספרת בה. מפלגה שאין לה עמדה בלפחות ${S.STMT_MIN} מהשאלות שענית עליהן (וגם בחצי מהן) נשארת במקום שלה לפי ההצבעות.</li>
      <li><b>העמדות</b> לקוחות רק ממקורות רשמיים: מצע, נאום בכנסת, הודעה רשמית או ציטוט ישיר של היו"ר. בפירוט יש ציטוט וקישור לכל עמדה.</li>` : ''}
      <li><b>מפלגה חדשה שמועמדים שלה כיהנו בכנסת ה-25 בסיעות אחרות:</b> נספרות ההצבעות של המועמדים האלה, רק בימים שבהם היו חברי כנסת. כרגע זה חל רק על מפלגה אחת, וליד התוצאה שלה כתוב על כמה אנשים היא מבוססת.</li>
      <li><b>מפלגה חדשה</b> (שלא הייתה בכנסת ה-25) לא מקבלת אחוז, כי אין לה הצבעות.${ST.length ? ' היא מופיעה בנפרד, עם מה שהיא אומרת בשאלות העמדה.' : ''}</li>
      <li><b>בלי בינה מלאכותית ובלי תיקונים ידניים.</b> אותן תשובות נותנות תמיד אותה תוצאה.</li>
    </ol></details>`;
  }

  /* רטט קצרצר בטלפון, רק ברגעים משמעותיים (תשובה, ומעבר לתוצאות). בלי רטט למי שביקש "פחות תנועה".
     נתמך באנדרואיד. באייפון הדפדפן לא מאפשר, ופשוט לא קורה כלום */
  const buzz = ms => { try { if (!reduceMotion() && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };

  /* ---------- החלקת הכרטיס ----------
     כרטיס שאלת ההצבעה נגרר באצבע (או בעכבר): ימינה = בעד, שמאלה = נגד. הכפתורים נשארים כרגיל.
     העקרונות: הכרטיס זז אחד-לאחד עם האצבע (בלי "קפיצה" כשהגרירה מתחילה); בשחרור מחשבים לאן התנופה הייתה מגיעה
     ולא רק איפה הכרטיס עומד; התנועה ממשיכה במהירות שבה שחררת; ואפשר לתפוס את הכרטיס שוב באמצע החזרה. */
  const SWIPE = { start: 10, commit: 130, deceleration: 0.99 };
  let swipeEl = null;
  function markSwipeable(el) {
    document.querySelectorAll('.msg.swipeable').forEach(x => x.classList.remove('swipeable'));
    swipeEl = el;
    if (el) el.classList.add('swipeable');
  }
  // לאן התנופה הייתה מגיעה (פיקסלים) אם המהירות הייתה דועכת בהדרגה
  const projectDrag = v => (v / 1000) * SWIPE.deceleration / (1 - SWIPE.deceleration);

  /* קפיץ קטן: זז אל היעד תוך שהוא ממשיך במהירות ההתחלתית. response = כמה מהר, damping = כמה "קופץ" (1 = בלי קפיצה) */
  function spring(el, state, target, { response = 0.35, damping = 1, onTick, onDone }) {
    const w = 2 * Math.PI / response, k = w * w, c = 2 * damping * w;
    let last = performance.now(), t0 = last;
    const frame = now => {
      state.raf = null;
      const dt = Math.min((now - last) / 1000, 1 / 30); last = now;
      state.v += (-k * (state.x - target) - c * state.v) * dt;
      state.x += state.v * dt;
      const done = (Math.abs(state.x - target) < 0.4 && Math.abs(state.v) < 8) || now - t0 > 1400;
      if (done) state.x = target;
      onTick(state.x);
      if (done) { if (onDone) onDone(); } else state.raf = requestAnimationFrame(frame);
    };
    state.raf = requestAnimationFrame(frame);
  }

  chat.addEventListener('pointerdown', e => {
    const el = e.target.closest('.msg.swipeable');
    if (!el || el !== swipeEl || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const st = el._swipe || (el._swipe = { x: 0, v: 0, raf: null });
    // תפסו את הכרטיס באמצע חזרה: מפסיקים את הקפיץ וממשיכים מהמקום שבו הוא נמצא עכשיו
    if (st.raf) { cancelAnimationFrame(st.raf); st.raf = null; }
    const g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, base: st.x, on: false, armed: false, pts: [{ t: e.timeStamp, x: e.clientX }] };
    let label = null;
    const paint = x => {
      st.x = x;
      el.style.transform = x ? `translateX(${x}px) rotate(${reduceMotion() ? 0 : Math.max(-8, Math.min(8, x * 0.015))}deg)` : '';
      if (label) label.style.opacity = Math.max(0, Math.min(1, (Math.abs(x) - 24) / 90)) * 0.96;
    };
    const cleanup = () => {
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', cancel);
      el.classList.remove('dragging');
    };
    const removeLabel = () => { if (label) { label.remove(); label = null; } };
    const move = ev => {
      if (ev.pointerId !== g.id) return;
      const dx = ev.clientX - g.x0, dy = ev.clientY - g.y0;
      if (!g.on) {
        if (Math.hypot(dx, dy) < SWIPE.start) return;
        if (Math.abs(dy) > Math.abs(dx)) return cancelNoMove(); // תנועה אנכית = גלילה של הדף, לא החלקה
        g.on = true; el.style.animation = 'none'; el.classList.add('dragging');
        try { el.setPointerCapture(g.id); } catch (_) {}
        label = document.createElement('div'); label.className = 'swipe-label'; el.appendChild(label);
        g.x0 += Math.sign(dx) * SWIPE.start; // מתחילים מ-0 בלי קפיצה של הסף
      }
      const x = g.base + (ev.clientX - g.x0);
      g.pts.push({ t: ev.timeStamp, x: ev.clientX });
      while (g.pts.length > 2 && ev.timeStamp - g.pts[0].t > 100) g.pts.shift();
      if (label) label.innerHTML = x > 0 ? ICON.up + LABEL.for : ICON.down + LABEL.against;
      paint(x);
      const past = Math.abs(x) >= SWIPE.commit;
      if (past && !g.armed) buzz(6); // רטט קצר ברגע שחוצים את קו ההחלטה
      g.armed = past;
    };
    const cancelNoMove = () => { cleanup(); };
    const release = ev => {
      const a = g.pts[0], b = g.pts[g.pts.length - 1];
      const v = b.t > a.t ? (b.x - a.x) / (b.t - a.t) * 1000 : 0; // פיקסלים לשנייה
      const x = st.x, proj = x + projectDrag(v);
      const commit = Math.abs(x) > 24 && Math.abs(proj) >= SWIPE.commit && Math.sign(proj) === Math.sign(x);
      st.v = v;
      if (commit) {
        const dir = Math.sign(proj), W = window.innerWidth;
        buzz(8);
        pressedFrom = el.getBoundingClientRect(); // בועת התשובה "יוצאת" מהכרטיס
        markSwipeable(null);
        answer(dir > 0 ? 'for' : 'against');
        if (reduceMotion()) { paint(0); removeLabel(); return; }
        // הכרטיס עף הצידה בתנופה, ואז חוזר בעדינות למקומו בהיסטוריה
        spring(el, st, dir * (W + 80), { response: 0.32, damping: 1, onTick: paint, onDone: () => {
          removeLabel(); st.x = 0; st.v = 0; el.style.transform = ''; el.style.animation = '';
          el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: 'ease-out' });
        } });
      } else if (reduceMotion()) { paint(0); removeLabel(); }
      else spring(el, st, 0, { response: 0.4, damping: 0.78, onTick: paint, onDone: () => { removeLabel(); el.style.transform = ''; el.style.animation = ''; } });
    };
    const up = ev => { if (ev.pointerId !== g.id) return; cleanup(); if (g.on) release(ev); };
    const cancel = ev => { if (ev.pointerId !== g.id) return; cleanup(); if (g.on) { g.pts = [{ t: 0, x: 0 }]; release(ev); } else if (st.x) release(ev); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', cancel);
    // אם תפסו כרטיס באמצע חזרה, הוא ממשיך להיות "נתפס" גם לפני שעברו את סף הגרירה
    if (st.x) { g.on = true; el.classList.add('dragging'); el.style.animation = 'none';
      label = el.querySelector('.swipe-label') || Object.assign(el.appendChild(document.createElement('div')), { className: 'swipe-label' });
      try { el.setPointerCapture(g.id); } catch (_) {} }
  });

  /* ---------- חלון הפירוט ----------
     "פירוט" של מפלגה נפתח כחלון שעולה מלמטה (ולא מרחיב את הכרטיס), כי הפירוט ארוך. סוגרים אותו בכפתור, ב-Esc,
     בלחיצה על הרקע, או בגרירה כלפי מטה. בזמן שהוא פתוח, שאר הדף "מושבת" כדי שהמקלדת והקורא המסך לא יברחו אליו. */
  const CHEV = '<span class="chev" aria-hidden="true"></span>';
  const sheetBodies = new Map();
  function detailButton(p, build) {
    sheetBodies.set(p.ballotIndex, { p, build });
    return `<button class="detail-btn" data-detail="${p.ballotIndex}">פירוט${CHEV}</button>`;
  }
  const sheet = { el: null, scrim: null, body: null, title: null, closeBtn: null, opener: null, open: false, st: { x: 0, v: 0, raf: null } };
  function ensureSheet() {
    if (sheet.el) return;
    sheet.scrim = document.createElement('div'); sheet.scrim.className = 'sheet-scrim'; sheet.scrim.hidden = true;
    sheet.el = document.createElement('section'); sheet.el.className = 'sheet'; sheet.el.hidden = true;
    sheet.el.setAttribute('role', 'dialog'); sheet.el.setAttribute('aria-modal', 'true'); sheet.el.setAttribute('aria-labelledby', 'sheetTitle');
    sheet.el.innerHTML = `<div class="sheet-head"><div class="sheet-grab" aria-hidden="true"></div>
        <div class="sheet-bar"><h3 class="sheet-title" id="sheetTitle"></h3>
          <button class="sheet-close" data-go="sheetclose" aria-label="סגירה"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>
      <div class="sheet-body" tabindex="0"></div>`;
    document.body.append(sheet.scrim, sheet.el);
    sheet.body = sheet.el.querySelector('.sheet-body'); sheet.title = sheet.el.querySelector('.sheet-title'); sheet.closeBtn = sheet.el.querySelector('.sheet-close');
    sheet.scrim.addEventListener('click', () => closeSheet());
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheet.open) closeSheet(); });
    sheet.el.querySelector('.sheet-head').addEventListener('pointerdown', startSheetDrag);
  }
  /* התנגדות רכה: ככל שמושכים את החלון למעלה מעבר למקומו, הוא "מציית" פחות (כמו גומייה), ולא נעצר בבת אחת */
  const rubberband = (over, dim) => (over * dim * 0.55) / (dim + 0.55 * Math.abs(over));
  /* גרירת החלון באמצעות הידית והכותרת. אותם עקרונות כמו בהחלקת הכרטיס: זז אחד-לאחד עם האצבע, בשחרור מחשבים לאן התנופה
     הייתה מגיעה, והתנועה ממשיכה במהירות ששחררת. אפשר גם לתפוס את החלון באמצע עלייה או ירידה. */
  function startSheetDrag(e) {
    if (!sheet.open || (e.pointerType === 'mouse' && e.button !== 0) || e.target.closest('.sheet-close')) return;
    const st = sheet.st, head = e.currentTarget;
    stopSheetSpring(); // תפסו אותו באמצע תנועה: ממשיכים מהמקום שבו הוא נמצא עכשיו
    const g = { id: e.pointerId, y0: e.clientY, base: st.x, pts: [{ t: e.timeStamp, y: e.clientY }] };
    try { head.setPointerCapture(g.id); } catch (_) {}
    head.classList.add('dragging');
    const move = ev => {
      if (ev.pointerId !== g.id) return;
      const raw = g.base + (ev.clientY - g.y0);
      paintSheet(raw < 0 ? -rubberband(-raw, sheet.el.offsetHeight) : raw);
      g.pts.push({ t: ev.timeStamp, y: ev.clientY });
      while (g.pts.length > 2 && ev.timeStamp - g.pts[0].t > 100) g.pts.shift();
    };
    const end = ev => {
      if (ev.pointerId !== g.id) return;
      head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', end); head.removeEventListener('pointercancel', end);
      head.classList.remove('dragging');
      const a = g.pts[0], b = g.pts[g.pts.length - 1];
      const v = ev.type === 'pointercancel' || b.t <= a.t ? 0 : (b.y - a.y) / (b.t - a.t) * 1000; // פיקסלים לשנייה
      const h = sheet.el.offsetHeight, proj = st.x + (v / 1000) * 0.99 / 0.01; // לאן התנופה הייתה מגיעה
      if (proj > h * 0.35) closeSheet(v);
      else if (reduceMotion()) paintSheet(0);
      else { st.v = v; spring(sheet.el, st, 0, { response: 0.4, damping: 0.8, onTick: paintSheet }); } // חוזר למקומו, בקפיצה קטנה כי היתה תנופה
    };
    head.addEventListener('pointermove', move); head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
  }
  // מיקום החלון (פיקסלים מהמקום הסופי שלו, כלפי מטה). הרקע המעומעם מתבהר ככל שהחלון עולה
  function paintSheet(y) {
    sheet.st.x = y;
    sheet.el.style.transform = y ? `translateY(${y}px)` : '';
    sheet.scrim.style.opacity = Math.max(0, Math.min(1, 1 - y / (sheet.el.offsetHeight || 1)));
  }
  const stopSheetSpring = () => { if (sheet.st.raf) { cancelAnimationFrame(sheet.st.raf); sheet.st.raf = null; } };
  function setInert(on) { [document.querySelector('.top'), resultsEl].forEach(el => { if (el) el.inert = on; }); }
  function openSheet(btn) {
    const d = sheetBodies.get(+btn.dataset.detail);
    if (!d || sheet.open) return;
    ensureSheet();
    sheet.opener = btn;
    sheet.title.innerHTML = both(esc(d.p.name), d.p.blindName);
    sheet.body.innerHTML = d.build();
    sheet.body.scrollTop = 0;
    sheet.scrim.hidden = false; sheet.el.hidden = false; sheet.open = true;
    document.documentElement.classList.add('sheet-open');
    setInert(true);
    stopSheetSpring();
    const h = sheet.el.offsetHeight;
    if (reduceMotion()) paintSheet(0);
    else { sheet.st.v = 0; paintSheet(h + 20); spring(sheet.el, sheet.st, 0, { response: 0.42, damping: 1, onTick: paintSheet }); }
    sheet.closeBtn.focus({ preventScroll: true });
  }
  function closeSheet(v = 0) {
    if (!sheet.open) return;
    sheet.open = false;
    stopSheetSpring();
    const h = sheet.el.offsetHeight;
    const done = () => {
      sheet.el.hidden = true; sheet.scrim.hidden = true; paintSheet(0);
      document.documentElement.classList.remove('sheet-open');
      setInert(false);
      if (sheet.opener && sheet.opener.isConnected) sheet.opener.focus({ preventScroll: true });
    };
    if (reduceMotion()) { paintSheet(h); done(); return; }
    sheet.st.v = v;
    spring(sheet.el, sheet.st, h + 30, { response: 0.34, damping: 1, onTick: paintSheet, onDone: done });
  }

  /* ---------- לחיצות ---------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.ans) { buzz(8); pressedFrom = b.getBoundingClientRect(); answer(b.dataset.ans); }
    else if (b.dataset.topic) {
      const t = b.dataset.topic;
      important = important.includes(t) ? important.filter(x => x !== t) : [...important, t];
      drawTopics(false);
      // הכפתורים נבנים מחדש בכל לחיצה, לכן מוסיפים את הקפיצה לנושא שנבחר עכשיו
      if (important.includes(t)) actions.querySelector(`[data-topic="${t}"]`).classList.add('pop');
    }
    else if (b.dataset.go === 'begin') askNext();
    else if (b.dataset.go === 'undo') undo();
    else if (b.dataset.go === 'results') { buzz([10, 40, 14]); showResults(); }
    else if (b.dataset.go === 'restart') { document.body.classList.add('blind'); start(); }
    else if (b.dataset.go === 'reveal') toggleReveal(b);
    else if (b.dataset.detail !== undefined) openSheet(b);
    else if (b.dataset.go === 'sheetclose') closeSheet();
  });

  // מסמנים את הפס העליון כשהדף גולל, כדי שהקו הדק יוחלף בטשטוש הדרגתי
  const topBar = document.querySelector('.top');
  const markScroll = () => topBar.classList.toggle('scrolled', window.scrollY > 4);
  window.addEventListener('scroll', markScroll, { passive: true });

  start();
})();
