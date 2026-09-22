function clean(value) {
  return String(value ?? "").trim();
}

export function parseSimpleText(text) {
  const blocks = String(text)
    .replace(/\r/g, "")
    .split(/\n\s*\n+/)
    .map(block => block.trim())
    .filter(Boolean);

  const questions = [];

  for (const block of blocks) {
    const lines = block.split("\n").map(line => line.trim()).filter(Boolean);
    let question = "";
    let correct = "";
    const wrong = [];

    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (!match) continue;
      const label = match[1].trim().toLowerCase();
      const value = match[2].trim();

      if (["frage", "question", "q"].includes(label)) question = value;
      else if (["richtig", "korrekt", "correct", "lösung", "loesung"].includes(label)) correct = value;
      else if (label.startsWith("falsch") || label.startsWith("wrong")) wrong.push(value);
    }

    if (question || correct || wrong.length) {
      questions.push(normalizeQuestion({ question, correct, wrong }));
    }
  }

  return validateQuestions(questions);
}

export function parseCSV(text) {
  const source = String(text).replace(/\r/g, "").trim();
  if (!source) return [];

  const delimiter = source.includes("\t") ? "\t" : source.includes(";") ? ";" : ",";
  const rows = parseDelimited(source, delimiter);
  if (!rows.length) return [];

  const headers = rows[0].map(header => clean(header).toLowerCase());
  const hasHeader = headers.some(header => /frage|question/.test(header));
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const questions = dataRows
    .filter(row => row.some(cell => clean(cell)))
    .map(row => {
      if (hasHeader) {
        const obj = {};
        headers.forEach((header, index) => { obj[header] = row[index] ?? ""; });
        return normalizeQuestion({
          question: obj.frage ?? obj.question ?? obj.q,
          correct: obj.richtig ?? obj.korrekt ?? obj.correct ?? obj.lösung ?? obj.loesung,
          wrong: [
            obj["falsch 1"] ?? obj.falsch1 ?? obj.wrong1,
            obj["falsch 2"] ?? obj.falsch2 ?? obj.wrong2,
            obj["falsch 3"] ?? obj.falsch3 ?? obj.wrong3
          ]
        });
      }

      return normalizeQuestion({
        question: row[0],
        correct: row[1],
        wrong: [row[2], row[3], row[4]]
      });
    });

  return validateQuestions(questions);
}

export function parseJSON(text) {
  const raw = JSON.parse(String(text));
  const list = Array.isArray(raw) ? raw : Array.isArray(raw.questions) ? raw.questions : [];
  if (!list.length) throw new Error("Im JSON wurde keine Fragenliste gefunden.");
  return validateQuestions(list.map(normalizeQuestion));
}

export function normalizeQuestion(raw = {}) {
  if (raw.question || raw.correct || raw.wrong) {
    return {
      id: raw.id ?? crypto.randomUUID(),
      question: clean(raw.question),
      correct: clean(raw.correct),
      wrong: Array.isArray(raw.wrong) ? raw.wrong.map(clean).filter(Boolean).slice(0, 3) : []
    };
  }

  const lower = {};
  for (const [key, value] of Object.entries(raw)) lower[String(key).trim().toLowerCase()] = value;

  const question = clean(lower.frage ?? lower.question ?? lower.q);

  if (Array.isArray(lower.falsch) || Array.isArray(lower.wrong)) {
    return {
      id: raw.id ?? crypto.randomUUID(),
      question,
      correct: clean(lower.richtig ?? lower.correct ?? lower.korrekt ?? lower.lösung ?? lower.loesung),
      wrong: (lower.falsch ?? lower.wrong).map(clean).filter(Boolean).slice(0, 3)
    };
  }

  if (lower.a !== undefined && lower.b !== undefined && lower.c !== undefined && lower.d !== undefined) {
    const answers = { a: clean(lower.a), b: clean(lower.b), c: clean(lower.c), d: clean(lower.d) };
    const marker = clean(lower.richtig ?? lower.correct ?? lower.lösung ?? lower.loesung).toLowerCase();
    const correct = answers[marker] || clean(lower.richtige_antwort ?? lower.correct_answer);
    const wrong = Object.entries(answers)
      .filter(([key, value]) => value && value !== correct && key !== marker)
      .map(([, value]) => value)
      .slice(0, 3);
    return { id: raw.id ?? crypto.randomUUID(), question, correct, wrong };
  }

  return {
    id: raw.id ?? crypto.randomUUID(),
    question,
    correct: clean(lower.richtig ?? lower.correct ?? lower.korrekt),
    wrong: [lower.falsch1, lower.falsch2, lower.falsch3, lower["falsch 1"], lower["falsch 2"], lower["falsch 3"]]
      .map(clean)
      .filter(Boolean)
      .slice(0, 3)
  };
}

export function validateQuestions(questions, { allowIncomplete = false } = {}) {
  const cleaned = questions.map(normalizeQuestion);
  if (allowIncomplete) return cleaned;

  const invalid = cleaned.findIndex(q => !q.question || !q.correct || q.wrong.length !== 3 || q.wrong.some(answer => !answer));
  if (invalid >= 0) {
    throw new Error(`Frage ${invalid + 1} ist unvollständig. Jede Frage braucht eine richtige und genau drei falsche Antworten.`);
  }

  const duplicate = cleaned.findIndex(q => new Set([q.correct, ...q.wrong].map(x => x.toLowerCase())).size !== 4);
  if (duplicate >= 0) {
    throw new Error(`Frage ${duplicate + 1} enthält doppelte Antworten.`);
  }

  return cleaned;
}

export function shuffleAnswers(question) {
  const answers = [
    { text: question.correct, correct: true },
    ...question.wrong.map(text => ({ text, correct: false }))
  ];

  for (let i = answers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [answers[i], answers[j]] = [answers[j], answers[i]];
  }

  return answers.map((answer, index) => ({
    ...answer,
    key: ["a", "b", "c", "d"][index]
  }));
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" && !quoted) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}
