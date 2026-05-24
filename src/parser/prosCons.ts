// Pros/Cons block extraction + composition.
// Shared between the parser (markdown → Session) and the slide editor (which
// shows the combined body in its textarea so users can edit pros/cons inline).

const PROS_RE = /(?:^|\n)\*\*Pros\*\*\s*\n+([\s\S]*?)(?=\n\s*\*\*(?:Cons|Pros)\*\*|\s*$)/i;
const CONS_RE = /(?:^|\n)\*\*Cons\*\*\s*\n+([\s\S]*?)(?=\n\s*\*\*(?:Cons|Pros)\*\*|\s*$)/i;

function extractListItems(block: string): string[] {
  return block
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[-*+]\s/.test(l))
    .map((l) => l.replace(/^[-*+]\s+/, ""));
}

export function splitProsCons(body: string): {
  description: string;
  pros: string[];
  cons: string[];
} {
  const pros = body.match(PROS_RE);
  const cons = body.match(CONS_RE);
  const prosList = pros ? extractListItems(pros[1]) : [];
  const consList = cons ? extractListItems(cons[1]) : [];
  let description = body;
  if (pros) description = description.replace(PROS_RE, "");
  if (cons) description = description.replace(CONS_RE, "");
  return { description: description.trim(), pros: prosList, cons: consList };
}

export function combineProsCons(description: string, pros: string[], cons: string[]): string {
  let out = description.trim();
  if (pros.length > 0) {
    out += (out ? "\n\n" : "") + "**Pros**\n\n" + pros.map((p) => `- ${p}`).join("\n");
  }
  if (cons.length > 0) {
    out += (out ? "\n\n" : "") + "**Cons**\n\n" + cons.map((c) => `- ${c}`).join("\n");
  }
  return out;
}
