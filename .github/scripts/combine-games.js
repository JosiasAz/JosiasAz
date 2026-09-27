// Junta a animação da cobra (CSS) e a do Pac-Man (SMIL) num único SVG:
// a cobra toca inteira, depois o Pac-Man toca inteiro, e o ciclo se repete.
// Uso: node combine-games.js <snake.svg> <pacman.svg> <saida.svg>
const fs = require("fs");

const [snakeFile, pacmanFile, outFile] = process.argv.slice(2);
const snake = fs.readFileSync(snakeFile, "utf8");
const pacman = fs.readFileSync(pacmanFile, "utf8");

const fmt = (n) => String(Number(n.toFixed(5)));

function split(svg) {
  const open = svg.match(/<svg\b([^>]*)>/);
  const body = svg.slice(open.index + open[0].length, svg.lastIndexOf("</svg>"));
  const attr = (name) => (open[1].match(new RegExp(`\\b${name}="([^"]+)"`)) || [])[1];
  return { body, attr };
}

// Durações originais
const snakeMs = Number(snake.match(/animation:[^;}"]*?(\d+)ms/)[1]);
const pacmanMs = Number(pacman.match(/<durationMs>(\d+)<\/durationMs>/)[1]);
const totalMs = snakeMs + pacmanMs;
const cut = snakeMs / totalMs; // fração do ciclo em que a cobra termina

// Cobra: estica a duração para o ciclo todo e comprime os keyframes no início
const scalePct = (sel) =>
  sel
    .split(",")
    .map((s) => {
      s = s.trim();
      const p = s === "from" ? 0 : s === "to" ? 100 : parseFloat(s);
      return fmt(p * cut) + "%";
    })
    .join(",");

let snakeBody = split(snake).body
  .replace(new RegExp(`\\b${snakeMs}ms\\b`, "g"), `${totalMs}ms`)
  .replace(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g, (_, name, inner) =>
    `@keyframes ${name}{${inner.replace(/([^{}]+)\{/g, (m, sel) => scalePct(sel) + "{")}}`
  );

// Pac-Man: estica a duração e desloca os keyTimes para depois da cobra
const pacmanBody = split(pacman).body.replace(/<animate(Transform)?\b[^>]*\/?>/g, (tag) => {
  if (!new RegExp(`dur="${pacmanMs}ms"`).test(tag)) return tag;
  const values = tag.match(/values="([^"]*)"/)[1].trim().split(/\s*;\s*/);
  const discrete = /calcMode="discrete"/.test(tag);
  const kt = tag.match(/keyTimes="([^"]*)"/);
  const times = kt
    ? kt[1].trim().split(/\s*;\s*/).map(Number)
    : values.map((_, i) => (discrete ? i / values.length : i / (values.length - 1)));
  const newTimes = [0, ...times.map((k) => cut + k * (1 - cut))];
  const newValues = [values[0], ...values];
  let out = tag
    .replace(`dur="${pacmanMs}ms"`, `dur="${totalMs}ms"`)
    .replace(/values="[^"]*"/, `values="${newValues.join(";")}"`);
  const ktAttr = `keyTimes="${newTimes.map(fmt).join(";")}"`;
  out = kt ? out.replace(/keyTimes="[^"]*"/, ktAttr) : out.replace(/<animate(Transform)?\b/, (m) => `${m} ${ktAttr}`);
  return out;
});

const s = split(snake);
const p = split(pacman);
const pw = Number(p.attr("width"));
const ph = Number(p.attr("height"));
const [sx, sy, sw, sh] = s.attr("viewBox").split(/\s+/).map(Number);
const height = Math.max(sh, ph);

// Grupos com transform em vez de <svg> aninhado: a cobra centralizada, o Pac-Man ocupando a largura toda
const out = `<svg viewBox="0 0 ${pw} ${height}" width="${pw}" height="${height}" xmlns="http://www.w3.org/2000/svg">
<desc>Snake (Platane/snk) + Pac-Man (abozanona/pacman-contribution-graph), alternados</desc>
<style>.game-snake{animation:game-snake ${totalMs}ms step-end infinite}@keyframes game-snake{0%{opacity:1}${fmt(cut * 100)}%,100%{opacity:0}}</style>
<g class="game-snake" transform="translate(${(pw - sw) / 2 - sx} ${(height - sh) / 2 - sy})">${snakeBody}</g>
<g opacity="0" transform="translate(0 ${(height - ph) / 2})"><animate attributeName="opacity" dur="${totalMs}ms" repeatCount="indefinite" calcMode="discrete" values="0;1" keyTimes="0;${fmt(cut)}"/>
${pacmanBody}</g>
</svg>
`;

fs.writeFileSync(outFile, out);
console.log(`cobra ${snakeMs}ms + pac-man ${pacmanMs}ms = ciclo de ${totalMs}ms`);
