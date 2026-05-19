/**
 * Renderer minimalista de markdown → HTML para artículos de Noticias.
 * Soporta: headers (## ###), párrafos, listas (- y 1.), bold (**), italics (*),
 * links [texto](url) y código inline (`code`). Escapa HTML para evitar XSS.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(s: string): string {
  let out = escapeHtml(s);
  // links: [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) =>
    `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`
  );
  // bold **text**
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // italic *text*
  out = out.replace(/(^|\W)\*([^*]+)\*/g, "$1<em>$2</em>");
  // code `code`
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  return out;
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const closeLists = () => {
    if (inUl) { out.push("</ul>"); inUl = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      closeLists();
      continue;
    }
    if (/^###\s+/.test(line)) {
      flushParagraph(); closeLists();
      out.push(`<h3>${renderInline(line.replace(/^###\s+/, ""))}</h3>`);
      continue;
    }
    if (/^##\s+/.test(line)) {
      flushParagraph(); closeLists();
      out.push(`<h2>${renderInline(line.replace(/^##\s+/, ""))}</h2>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      if (inOl) { out.push("</ol>"); inOl = false; }
      if (!inUl) { out.push("<ul>"); inUl = true; }
      out.push(`<li>${renderInline(line.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (!inOl) { out.push("<ol>"); inOl = true; }
      out.push(`<li>${renderInline(line.replace(/^\d+\.\s+/, ""))}</li>`);
      continue;
    }
    closeLists();
    paragraph.push(line);
  }
  flushParagraph();
  closeLists();
  return out.join("\n");
}
