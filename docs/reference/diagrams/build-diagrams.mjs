#!/usr/bin/env node
/**
 * Generates the reference diagrams twice:
 *   - <name>.excalidraw  editable source
 *   - <name>.svg         rendered image embedded by the Markdown docs
 *
 * Run from anywhere:
 *   node docs/reference/diagrams/build-diagrams.mjs
 *
 * No dependencies. Counts and paths in the specs are a snapshot; update the
 * spec values and re-run when the repository changes materially.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const OUT = dirname(fileURLToPath(import.meta.url))
const STAMP = "2026-10-24"
const COMMIT = "b306db3"
const FONT = "Segoe UI, Helvetica, Arial, sans-serif"

const C = {
  paper: "#fbfaf7",
  ink: "#1e1e1e",
  muted: "#5f646b",
  line: "#343a40",
  blue: "#d0ebff",
  blueStroke: "#1971c2",
  green: "#d3f9d8",
  greenStroke: "#2f9e44",
  orange: "#ffe8cc",
  orangeStroke: "#e8590c",
  purple: "#e5dbff",
  purpleStroke: "#6741d9",
  red: "#ffe3e3",
  redStroke: "#c92a2a",
  gray: "#f1f3f5",
  grayStroke: "#868e96",
  teal: "#c3fae8",
  tealStroke: "#0c8599",
  white: "#ffffff",
  yellow: "#fff3bf",
  yellowStroke: "#e67700",
}

let sequence = 0
let seed = 101
const nextId = (prefix) => `${prefix}-${++sequence}`
const nextSeed = () => ++seed
const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")

function wrapLine(line, maxChars) {
  if (line.length <= maxChars) return [line]
  const words = line.split(/\s+/)
  const result = []
  let current = ""
  for (const word of words) {
    if (!current) {
      current = word
    } else if (`${current} ${word}`.length <= maxChars) {
      current += ` ${word}`
    } else {
      result.push(current)
      current = word
    }
  }
  if (current) result.push(current)
  return result
}

function wrapText(text, maxChars) {
  return String(text)
    .split("\n")
    .flatMap((line) => (line.trim() ? wrapLine(line, maxChars) : [""]))
}

function makeDiagram({ name, width, height, title, subtitle }) {
  const elements = []
  const svg = []
  const boxes = new Map()

  const headerSvg = `
  <text x="64" y="58" font-family="${FONT}" font-size="32" font-weight="700" fill="${C.ink}">${esc(title)}</text>
  <text x="66" y="90" font-family="${FONT}" font-size="15" fill="${C.muted}">${esc(subtitle)}</text>
  <line x1="64" y1="110" x2="${width - 64}" y2="110" stroke="${C.ink}" stroke-width="1.5" opacity="0.18" />`

  elements.push({
    id: nextId("title"),
    type: "text",
    x: 64,
    y: 30,
    width: width - 128,
    height: 44,
    angle: 0,
    strokeColor: C.ink,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: nextSeed(),
    version: 1,
    versionNonce: nextSeed(),
    isDeleted: false,
    boundElements: null,
    updated: 1761264000000,
    link: null,
    locked: false,
    text: title,
    fontSize: 32,
    fontFamily: 2,
    textAlign: "left",
    verticalAlign: "top",
    containerId: null,
    originalText: title,
    lineHeight: 1.2,
    autoResize: true,
  })
  elements.push({
    id: nextId("subtitle"),
    type: "text",
    x: 66,
    y: 78,
    width: width - 132,
    height: 26,
    angle: 0,
    strokeColor: C.muted,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: nextSeed(),
    version: 1,
    versionNonce: nextSeed(),
    isDeleted: false,
    boundElements: null,
    updated: 1761264000000,
    link: null,
    locked: false,
    text: subtitle,
    fontSize: 15,
    fontFamily: 2,
    textAlign: "left",
    verticalAlign: "top",
    containerId: null,
    originalText: subtitle,
    lineHeight: 1.25,
    autoResize: true,
  })

  function textBlock({ x, y, width, text, size, color, weight, align, lineHeight = 1.25 }) {
    const maxChars = Math.max(8, Math.floor((width - 8) / (size * 0.56)))
    const lines = wrapText(text, maxChars)
    const height = Math.max(size * 1.25, lines.length * size * lineHeight)
    const id = nextId("text")
    elements.push({
      id,
      type: "text",
      x,
      y,
      width,
      height,
      angle: 0,
      strokeColor: color,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: nextSeed(),
      version: 1,
      versionNonce: nextSeed(),
      isDeleted: false,
      boundElements: null,
      updated: 1761264000000,
      link: null,
      locked: false,
      text: lines.join("\n"),
      fontSize: size,
      fontFamily: 2,
      textAlign: align,
      verticalAlign: "top",
      containerId: null,
      originalText: lines.join("\n"),
      lineHeight,
      autoResize: false,
    })
    return { id, lines, height }
  }

  function box({
    id: boxId,
    x,
    y,
    w,
    h,
    title: boxTitle,
    detail = "",
    fill = C.white,
    stroke = C.line,
    titleColor = C.ink,
    detailColor = C.muted,
    titleSize = 18,
    detailSize = 13.5,
    align = "center",
    tiny = false,
    opacity = 100,
  }) {
    const id = boxId ?? nextId("box")
    const textId = nextId("box-text")
    const pad = tiny ? 8 : 14
    const maxChars = Math.max(8, Math.floor((w - pad * 2) / (detailSize * 0.56)))
    const titleLines = wrapText(boxTitle, Math.max(8, Math.floor((w - pad * 2) / (titleSize * 0.54))))
    const detailLines = detail ? wrapText(detail, maxChars) : []
    const gap = detail ? 7 : 0
    const totalHeight = titleLines.length * titleSize * 1.2 + gap + detailLines.length * detailSize * 1.28
    const startY = y + h / 2 - totalHeight / 2
    const text = [...titleLines, ...(detail ? [""] : []), ...detailLines].join("\n")

    elements.push({
      id,
      type: "rectangle",
      x,
      y,
      width: w,
      height: h,
      angle: 0,
      strokeColor: stroke,
      backgroundColor: fill,
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 1,
      opacity,
      groupIds: [],
      frameId: null,
      roundness: { type: 3 },
      seed: nextSeed(),
      version: 1,
      versionNonce: nextSeed(),
      isDeleted: false,
      boundElements: [{ type: "text", id: textId }],
      updated: 1761264000000,
      link: null,
      locked: false,
    })

    elements.push({
      id: textId,
      type: "text",
      x: x + pad,
      y: startY,
      width: w - pad * 2,
      height: Math.max(20, totalHeight),
      angle: 0,
      strokeColor: titleColor,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: nextSeed(),
      version: 1,
      versionNonce: nextSeed(),
      isDeleted: false,
      boundElements: null,
      updated: 1761264000000,
      link: null,
      locked: false,
      text,
      fontSize: detailSize,
      fontFamily: 2,
      textAlign: align,
      verticalAlign: "top",
      containerId: id,
      originalText: text,
      lineHeight: 1.28,
      autoResize: false,
    })

    boxes.set(id, { x, y, w, h, title: boxTitle })

    const anchor = align === "left" ? "start" : "middle"
    const tx = align === "left" ? x + pad : x + w / 2
    let cursorY = startY + titleSize
    const titleSvg = titleLines
      .map(
        (line, index) =>
          `<text x="${tx}" y="${cursorY + index * titleSize * 1.2}" text-anchor="${anchor}" font-family="${FONT}" font-size="${titleSize}" font-weight="650" fill="${titleColor}">${esc(line)}</text>`,
      )
      .join("")
    cursorY += titleLines.length * titleSize * 1.2 + gap
    const detailSvg = detailLines
      .map(
        (line, index) =>
          `<text x="${tx}" y="${cursorY + index * detailSize * 1.28}" text-anchor="${anchor}" font-family="${FONT}" font-size="${detailSize}" fill="${detailColor}">${esc(line)}</text>`,
      )
      .join("")
    svg.push(`
  <g>
    <rect x="${x + 3}" y="${y + 4}" width="${w}" height="${h}" rx="14" fill="#1e1e1e" opacity="0.06" />
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${fill}" stroke="${stroke}" stroke-width="2" />
    ${titleSvg}
    ${detailSvg}
  </g>`)

    return id
  }

  function label({ x, y, text, size = 14, color = C.muted, weight = 400, align = "left", width }) {
    const id = nextId("label")
    const maxWidth = width ?? 400
    const lines = wrapText(text, Math.max(8, Math.floor(maxWidth / (size * 0.56))))
    elements.push({
      id,
      type: "text",
      x,
      y,
      width: maxWidth,
      height: lines.length * size * 1.25,
      angle: 0,
      strokeColor: color,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: nextSeed(),
      version: 1,
      versionNonce: nextSeed(),
      isDeleted: false,
      boundElements: null,
      updated: 1761264000000,
      link: null,
      locked: false,
      text: lines.join("\n"),
      fontSize: size,
      fontFamily: 2,
      textAlign: align,
      verticalAlign: "top",
      containerId: null,
      originalText: lines.join("\n"),
      lineHeight: 1.25,
      autoResize: false,
    })
    const anchor = align === "center" ? "middle" : align === "right" ? "end" : "start"
    svg.push(
      lines
        .map(
          (line, index) =>
            `<text x="${x}" y="${y + size + index * size * 1.25}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(line)}</text>`,
        )
        .join(""),
    )
    return id
  }

  function arrow({ from, to, points, label: arrowLabel, color = C.line, dashed = false, labelDx = 0, labelDy = -9, width = 2.25, endArrow = "arrow" }) {
    const pts =
      points ??
      (() => {
        const a = boxes.get(from)
        const b = boxes.get(to)
        if (!a || !b) throw new Error(`Missing box for arrow: ${from} -> ${to}`)
        const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }
        const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
        const dx = bc.x - ac.x
        const dy = bc.y - ac.y
        if (Math.abs(dx) > Math.abs(dy)) {
          return dx > 0
            ? [{ x: a.x + a.w, y: ac.y }, { x: b.x, y: bc.y }]
            : [{ x: a.x, y: ac.y }, { x: b.x + b.w, y: bc.y }]
        }
        return dy > 0
          ? [{ x: ac.x, y: a.y + a.h }, { x: bc.x, y: b.y }]
          : [{ x: ac.x, y: a.y }, { x: bc.x, y: b.y + b.h }]
      })()

    const p0 = pts[0]
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const id = nextId("arrow")
    elements.push({
      id,
      type: "arrow",
      x: p0.x,
      y: p0.y,
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
      angle: 0,
      strokeColor: color,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: width,
      strokeStyle: dashed ? "dashed" : "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: { type: 2 },
      seed: nextSeed(),
      version: 1,
      versionNonce: nextSeed(),
      isDeleted: false,
      boundElements: null,
      updated: 1761264000000,
      link: null,
      locked: false,
      points: pts.map((p) => [p.x - p0.x, p.y - p0.y]),
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: endArrow,
      elbowed: false,
    })

    const path = pts.map((p, index) => `${index === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
    svg.push(
      `<path d="${path}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${dashed ? 'stroke-dasharray="9 7"' : ""} marker-end="url(#arrowhead-${color.replace("#", "")})" />`,
    )
    if (arrowLabel) {
      const mid = pts[Math.floor((pts.length - 1) / 2)]
      const next = pts[Math.min(pts.length - 1, Math.floor((pts.length - 1) / 2) + 1)]
      const lx = (mid.x + next.x) / 2 + labelDx
      const ly = (mid.y + next.y) / 2 + labelDy
      label({ x: lx, y: ly - 14, text: arrowLabel, size: 12.5, color: C.muted, align: "center", width: 140 })
    }
    return id
  }

  function chip({ x, y, text, fill = C.gray, stroke = C.grayStroke, color = C.ink, w }) {
    const width = w ?? Math.max(80, text.length * 7.2 + 24)
    box({
      x,
      y,
      w: width,
      h: 30,
      title: text,
      fill,
      stroke,
      titleColor: color,
      titleSize: 12,
      detailSize: 12,
      tiny: true,
    })
  }

  function finish() {
    const defs = `
  <defs>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.9" fill="${C.ink}" opacity="0.09" />
    </pattern>
    ${Object.values(C)
      .filter((value) => value.startsWith("#") && value.length === 7)
      .map(
        (color) => `<marker id="arrowhead-${color.replace("#", "")}" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth"><path d="M 0 0 L 10 5 L 0 10 z" fill="${color}" /></marker>`,
      )
      .join("\n    ")}
  </defs>`
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">
  ${defs}
  <rect width="${width}" height="${height}" fill="${C.paper}" />
  <rect width="${width}" height="${height}" fill="url(#grid)" />
  ${headerSvg}
  ${svg.join("\n")}
  <text x="64" y="${height - 26}" font-family="${FONT}" font-size="12" fill="${C.muted}">Sanad ERP · docs/reference/diagrams · snapshot ${COMMIT} · ${STAMP}</text>
  <text x="${width - 64}" y="${height - 26}" text-anchor="end" font-family="${FONT}" font-size="12" fill="${C.muted}">Source: ${name}.excalidraw</text>
</svg>`

    const file = {
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements,
      appState: {
        gridSize: 20,
        gridStep: 5,
        gridModeEnabled: false,
        viewBackgroundColor: C.paper,
        currentItemStrokeColor: C.ink,
        currentItemBackgroundColor: "transparent",
        currentItemFillStyle: "solid",
        currentItemStrokeWidth: 2,
        currentItemRoughness: 1,
        currentItemFontFamily: 2,
        currentItemFontSize: 18,
        currentItemTextAlign: "left",
      },
      files: {},
    }

    writeFileSync(join(OUT, `${name}.excalidraw`), `${JSON.stringify(file, null, 2)}\n`)
    writeFileSync(join(OUT, `${name}.svg`), body)
    console.log(`wrote ${name}.excalidraw + .svg (${elements.length} elements)`)
  }

  return { box, label, arrow, chip, finish }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 1. System context
 * ──────────────────────────────────────────────────────────────────────────── */
{
  const d = makeDiagram({
    name: "system-context",
    width: 1600,
    height: 940,
    title: "Sanad ERP — system context",
    subtitle: "Apps, shared packages, persistence and external boundaries · monorepo snapshot",
  })

  d.label({ x: 70, y: 126, text: "CLIENTS & AUTOMATION", size: 12, color: C.blueStroke, weight: 700 })
  d.box({
    x: 70,
    y: 158,
    w: 250,
    h: 122,
    title: "Browser",
    detail: "Arabic-first dashboard\nRTL · ar / en / tr",
    fill: C.blue,
    stroke: C.blueStroke,
  })
  d.box({
    x: 70,
    y: 308,
    w: 250,
    h: 112,
    title: "Desktop shell",
    detail: "apps/desktop\nElectron loads the dashboard URL",
    fill: C.gray,
    stroke: C.grayStroke,
  })
  d.box({
    x: 70,
    y: 448,
    w: 250,
    h: 112,
    title: "n8n automation",
    detail: "apps/n8n · Docker Compose\noptional local workflows",
    fill: C.gray,
    stroke: C.grayStroke,
  })
  d.label({
    x: 70,
    y: 586,
    width: 250,
    text: "n8n is an isolated service with its own PostgreSQL; it is not a workspace dependency.",
    size: 12.5,
    color: C.muted,
  })

  d.label({ x: 430, y: 126, text: "APPLICATIONS", size: 12, color: C.greenStroke, weight: 700 })
  d.box({
    x: 430,
    y: 158,
    w: 310,
    h: 180,
    title: "Next.js dashboard",
    detail: "apps/dashboard · Next.js 16 App Router\nReact 19 · TanStack Query · RHF + Zod\nnext-intl · Tailwind v4",
    fill: C.green,
    stroke: C.greenStroke,
  })
  d.box({
    x: 430,
    y: 388,
    w: 310,
    h: 172,
    title: "NestJS API",
    detail: "apps/api · 13 domain modules\nJWT · permissions · Swagger\nValidationPipe · domain registry",
    fill: C.green,
    stroke: C.greenStroke,
  })
  d.box({
    x: 430,
    y: 612,
    w: 310,
    h: 112,
    title: "Outbox worker",
    detail: "apps/api/src/outbox\n5 s poll · retry · dead-letter",
    fill: C.orange,
    stroke: C.orangeStroke,
  })
  d.label({
    x: 430,
    y: 742,
    width: 310,
    text: "OUTBOX_ENABLED is off by default: the synchronous posting path stays authoritative.",
    size: 12.5,
    color: C.orangeStroke,
  })

  d.label({ x: 880, y: 126, text: "DATA & EXTERNAL SERVICES", size: 12, color: C.purpleStroke, weight: 700 })
  d.box({
    x: 880,
    y: 158,
    w: 290,
    h: 124,
    title: "PostgreSQL 16",
    detail: "Prisma 7 · 56 models\n39 migrations · tenant-scoped",
    fill: C.purple,
    stroke: C.purpleStroke,
  })
  d.box({
    x: 880,
    y: 326,
    w: 290,
    h: 110,
    title: "Object storage",
    detail: "S3 or local uploads/\nSTORAGE_TYPE",
    fill: C.purple,
    stroke: C.purpleStroke,
  })
  d.box({
    x: 880,
    y: 480,
    w: 290,
    h: 128,
    title: "OpenAI-compatible model",
    detail: "AI agent · LangGraph\nSSE UI message stream",
    fill: C.purple,
    stroke: C.purpleStroke,
  })
  d.box({
    x: 880,
    y: 652,
    w: 290,
    h: 92,
    title: "S3 / SMTP / Twilio",
    detail: "S3 is wired for files.\nSMTP + Twilio are declared,\nnot wired in current src.",
    fill: C.gray,
    stroke: C.grayStroke,
    detailSize: 12,
  })

  d.label({ x: 70, y: 792, text: "SHARED WORKSPACE PACKAGES", size: 12, color: C.tealStroke, weight: 700 })
  const packageY = 820
  const packageItems = [
    ["db-prisma", "schema · migrations · client"],
    ["api-contracts", "resources · DTOs · types"],
    ["backend-core", "CRUD base · query helpers"],
    ["api-client", "typed HTTP clients"],
    ["i18n", "ar · en · tr messages"],
    ["ui", "starter components"],
  ]
  packageItems.forEach(([name, role], index) => {
    d.box({
      x: 70 + index * 242,
      y: packageY,
      w: 222,
      h: 74,
      title: name,
      detail: role,
      fill: C.teal,
      stroke: C.tealStroke,
      titleSize: 15,
      detailSize: 11.5,
    })
  })

  d.arrow({ points: [{ x: 320, y: 219 }, { x: 430, y: 219 }], label: "HTTPS", labelDy: -10 })
  d.arrow({ points: [{ x: 320, y: 364 }, { x: 430, y: 290 }], label: "loads URL", labelDx: 10 })
  d.arrow({ points: [{ x: 320, y: 504 }, { x: 430, y: 520 }], dashed: true, label: "webhooks", labelDy: -8 })
  d.arrow({ points: [{ x: 585, y: 338 }, { x: 585, y: 388 }], label: "REST / SSE", labelDx: 78, labelDy: 0 })
  d.arrow({ points: [{ x: 740, y: 430 }, { x: 880, y: 220 }], label: "Prisma SQL", labelDx: 18 })
  d.arrow({ points: [{ x: 740, y: 490 }, { x: 880, y: 380 }], label: "files", labelDx: 8 })
  d.arrow({ points: [{ x: 740, y: 545 }, { x: 880, y: 545 }], label: "AI", labelDy: -8 })
  d.arrow({ points: [{ x: 585, y: 560 }, { x: 585, y: 612 }], label: "schedule", labelDx: 62, labelDy: 0 })

  d.finish()
}

/* ────────────────────────────────────────────────────────────────────────────
 * 2. Feature slice
 * ──────────────────────────────────────────────────────────────────────────── */
{
  const d = makeDiagram({
    name: "feature-slice",
    width: 1600,
    height: 1000,
    title: "One feature, six layers",
    subtitle: "The units vertical slice — copy this shape when adding a CRUD entity",
  })

  const cards = [
    {
      n: "1",
      title: "Prisma schema",
      path: "packages/db-prisma/src/schema/unit.prisma",
      detail: "Model + tenantId + @@map\nMigration in schema/migrations\nGenerated client in generated/client",
      fill: C.purple,
      stroke: C.purpleStroke,
    },
    {
      n: "2",
      title: "API contract",
      path: "packages/api-contracts/src/resources/unit.resource.ts",
      detail: "defineCrudResource({ key, routes })\nGenerated types:\npackages/api-contracts/types/index.ts\nNever hand-edit generated types",
      fill: C.blue,
      stroke: C.blueStroke,
    },
    {
      n: "3",
      title: "NestJS module",
      path: "apps/api/src/modules/catalog/units/",
      detail: "repository → service → presenter → controller\nDTOs · events · module · import/export\nRegistered by CatalogModule",
      fill: C.green,
      stroke: C.greenStroke,
    },
    {
      n: "4",
      title: "HTTP client",
      path: "packages/api-client/src/clients/units.client.ts",
      detail: "class UnitsClient extends CrudClient\nRegister in createApi() in src/api.ts\nExpose as api.units",
      fill: C.yellow,
      stroke: C.yellowStroke,
    },
    {
      n: "5",
      title: "Dashboard module",
      path: "apps/dashboard/modules/units/",
      detail: "units.resource.ts · units.config.ts\nunits-form.tsx · units-columns.tsx\nunits-page.tsx · hooks/",
      fill: C.orange,
      stroke: C.orangeStroke,
    },
    {
      n: "6",
      title: "Route + navigation",
      path: "apps/dashboard/app/[locale]/(authenticated)/catalog/units/page.tsx",
      detail: "Thin server/client route\nAdd navGroups entry + permission\nAdd ar/en/tr messages",
      fill: C.red,
      stroke: C.redStroke,
    },
  ]

  const cardIds = cards.map((card, index) => {
    const col = index % 3
    const row = Math.floor(index / 3)
    const x = 70 + col * 500
    const y = 160 + row * 330
    d.label({ x, y, text: card.n, size: 34, color: card.stroke, weight: 700 })
    return d.box({
      x: x + 46,
      y,
      w: 424,
      h: 268,
      title: card.title,
      detail: `${card.path}\n\n${card.detail}`,
      fill: card.fill,
      stroke: card.stroke,
      titleSize: 21,
      detailSize: 13.5,
      align: "left",
    })
  })

  d.arrow({ from: cardIds[3], to: cardIds[4], label: "typed route", labelDy: -12 })
  d.arrow({ from: cardIds[4], to: cardIds[5], label: "imports", labelDy: -12 })
  d.arrow({ points: [{ x: 340, y: 430 }, { x: 340, y: 488 }], label: "migrate + generate", labelDx: 110, labelDy: 0 })
  d.arrow({ points: [{ x: 840, y: 430 }, { x: 840, y: 488 }], label: "API boot regenerates", labelDx: 112, labelDy: 0 })
  d.arrow({ points: [{ x: 1340, y: 430 }, { x: 1340, y: 488 }], label: "register", labelDx: 45, labelDy: 0 })

  d.label({
    x: 70,
    y: 822,
    width: 1460,
    text: "Golden rule: a resource is complete only when all six locations agree. The schema is the data source of truth; apps/api/openapi.yaml is the HTTP source of truth; packages/api-contracts/types/index.ts is generated from it.",
    size: 15,
    color: C.ink,
    weight: 600,
  })
  d.label({
    x: 70,
    y: 872,
    width: 1460,
    text: "The dashboard never calls fetch directly for CRUD. It goes through Modules → generated Resource → typed client → ApiClient → NestJS controller.",
    size: 13,
    color: C.muted,
  })

  d.finish()
}

/* ────────────────────────────────────────────────────────────────────────────
 * 3. Request lifecycle
 * ──────────────────────────────────────────────────────────────────────────── */
{
  const d = makeDiagram({
    name: "request-lifecycle",
    width: 1600,
    height: 980,
    title: "CRUD request lifecycle",
    subtitle: "From a dashboard click to a tenant-scoped PostgreSQL transaction and back",
  })

  const stages = [
    {
      title: "1 · Browser",
      detail: "User clicks Create / Save\nor changes table query.\n\nNo direct API fetch in\nthe feature component.",
      fill: C.blue,
      stroke: C.blueStroke,
    },
    {
      title: "2 · Next.js",
      detail: "Thin route renders a\nclient module component.\nuseApi() resolves the\nApiClient with JWT + locale.",
      fill: C.green,
      stroke: C.greenStroke,
    },
    {
      title: "3 · API edge",
      detail: "JwtAuthGuard validates token.\nPermissionsGuard checks key.\nDomainAvailabilityGuard\nchecks DISABLED_DOMAINS.",
      fill: C.orange,
      stroke: C.orangeStroke,
    },
    {
      title: "4 · Controller",
      detail: "ValidationPipe: whitelist +\ntransform. CRUD factory reads\n@CurrentUser().tenantId and\ncalls the service.",
      fill: C.yellow,
      stroke: C.yellowStroke,
    },
    {
      title: "5 · Domain",
      detail: "Service before* hooks enforce\nbusiness rules. Repository adds\ntenantId. Presenter maps the\nentity to response DTO.",
      fill: C.purple,
      stroke: C.purpleStroke,
    },
    {
      title: "6 · PostgreSQL",
      detail: "Prisma transaction commits.\nAuditLog / Outbox may share\nthe same tx. Envelope returns;\nReact Query invalidates.",
      fill: C.red,
      stroke: C.redStroke,
    },
  ]

  stages.forEach((stage, index) => {
    d.box({
      x: 36 + index * 258,
      y: 160,
      w: 234,
      h: 300,
      title: stage.title,
      detail: stage.detail,
      fill: stage.fill,
      stroke: stage.stroke,
      titleSize: 18,
      detailSize: 12.5,
      align: "left",
    })
  })

  for (let index = 0; index < 5; index += 1) {
    d.arrow({
      points: [
        { x: 270 + index * 258, y: 310 },
        { x: 294 + index * 258, y: 310 },
      ],
      width: 2.5,
    })
  }

  d.arrow({
    points: [
      { x: 1510, y: 500 },
      { x: 1510, y: 548 },
      { x: 80, y: 548 },
      { x: 80, y: 500 },
    ],
    dashed: true,
    color: C.greenStroke,
  })
  d.label({
    x: 540,
    y: 512,
    text: "success envelope → cache invalidation → render",
    size: 13,
    color: C.greenStroke,
    weight: 600,
    width: 520,
    align: "center",
  })

  d.label({ x: 70, y: 600, text: "WHERE IT BREAKS (most common in this repo)", size: 12, color: C.redStroke, weight: 700 })
  const failureCards = [
    ["401/403", "Token missing, expired, or permission key not granted to the role."],
    ["400 validation", "DTO shape and dashboard Zod schema drifted. Regenerate + align mappers."],
    ["404 tenant scope", "Row exists for another tenant, or route prefix / domain is disabled."],
    ["409 conflict", "Unique constraint (code/name) or FK still referenced by another row."],
    ["Posting 400", "GL mapping missing, fiscal period closed, or stock unavailable."],
    ["Preview/print 404", "ID belongs to another tenant; never query without tenantId."],
  ]
  failureCards.forEach(([title, detail], index) => {
    const col = index % 3
    const row = Math.floor(index / 3)
    d.box({
      x: 70 + col * 500,
      y: 630 + row * 132,
      w: 466,
      h: 108,
      title,
      detail,
      fill: C.gray,
      stroke: C.redStroke,
      titleSize: 16,
      detailSize: 12.5,
      align: "left",
    })
  })

  d.label({
    x: 70,
    y: 912,
    width: 1460,
    text: "The controller may add HTTP-level before/after hooks, but business rules belong in the service. A disabled domain is rejected before the controller is reached.",
    size: 13,
    color: C.muted,
  })

  d.finish()
}

/* ────────────────────────────────────────────────────────────────────────────
 * 4. Domain map
 * ──────────────────────────────────────────────────────────────────────────── */
{
  const d = makeDiagram({
    name: "domain-map",
    width: 1600,
    height: 930,
    title: "API domain map",
    subtitle: "13 domains under apps/api/src/modules · main dependency spine; exact dependsOn lists in 02-api.md",
  })

  const domains = [
    { key: "platform", x: 70, y: 170, route: "/branches", optional: false, fill: C.blue, stroke: C.blueStroke },
    { key: "custom-fields", x: 360, y: 170, route: "/custom-fields", optional: true, fill: C.orange, stroke: C.orangeStroke },
    { key: "files", x: 650, y: 170, route: "/files", optional: true, fill: C.orange, stroke: C.orangeStroke },
    { key: "ai-agent", x: 940, y: 170, route: "/ai · /ai/conversations", optional: true, fill: C.orange, stroke: C.orangeStroke },
    { key: "audit", x: 1230, y: 170, route: "/audit-logs", optional: false, fill: C.blue, stroke: C.blueStroke },
    { key: "catalog", x: 70, y: 400, route: "/units · /items · /item-categories", optional: false, fill: C.blue, stroke: C.blueStroke },
    { key: "inventory", x: 360, y: 400, route: "/inventory · /warehouses · /stock-*", optional: false, fill: C.blue, stroke: C.blueStroke },
    { key: "accounting", x: 650, y: 400, route: "/accounting/* · /currencies · /fiscal-periods", optional: false, fill: C.blue, stroke: C.blueStroke },
    { key: "invoicing", x: 940, y: 400, route: "/invoices · /payments · /expenses", optional: false, fill: C.blue, stroke: C.blueStroke },
    { key: "pos", x: 1230, y: 400, route: "/pos/checkout · /pos/settings", optional: true, fill: C.orange, stroke: C.orangeStroke },
    { key: "parties", x: 360, y: 620, route: "/parties", optional: true, fill: C.orange, stroke: C.orangeStroke },
    { key: "reports", x: 650, y: 620, route: "/reports · /dashboard", optional: true, fill: C.orange, stroke: C.orangeStroke },
    { key: "identity", x: 940, y: 620, w: 520, route: "/auth · /users · /roles · /settings", optional: false, fill: C.blue, stroke: C.blueStroke },
  ]

  const ids = new Map()
  domains.forEach((item) => {
    const id = d.box({
      x: item.x,
      y: item.y,
      w: item.w ?? 260,
      h: 128,
      title: item.key,
      detail: `${item.route}\n${item.optional ? "optional" : "required"}`,
      fill: item.fill,
      stroke: item.stroke,
      titleSize: 20,
      detailSize: 12,
    })
    ids.set(item.key, id)
  })

  d.arrow({ points: [{ x: 200, y: 298 }, { x: 200, y: 400 }], width: 2 })
  d.arrow({ points: [{ x: 490, y: 298 }, { x: 200, y: 400 }], width: 2 })
  d.arrow({ points: [{ x: 330, y: 464 }, { x: 360, y: 464 }], width: 2 })
  d.arrow({ points: [{ x: 620, y: 464 }, { x: 650, y: 464 }], width: 2 })
  d.arrow({
    points: [
      { x: 780, y: 400 },
      { x: 780, y: 345 },
      { x: 1360, y: 345 },
      { x: 1360, y: 298 },
    ],
    width: 2,
  })
  d.arrow({ points: [{ x: 940, y: 430 }, { x: 910, y: 430 }], width: 2 })
  d.arrow({
    points: [
      { x: 1070, y: 528 },
      { x: 1070, y: 575 },
      { x: 490, y: 575 },
      { x: 490, y: 528 },
    ],
    width: 2,
  })
  d.arrow({ points: [{ x: 1230, y: 430 }, { x: 1200, y: 430 }], width: 2 })
  d.arrow({ points: [{ x: 1200, y: 234 }, { x: 1230, y: 234 }], width: 2 })

  d.label({
    x: 70,
    y: 792,
    width: 1460,
    text: "Arrow = “depends on”. The map shows the main runtime spine; exact dependsOn lists (including identity → accounting/catalog/invoicing/platform, reports → invoicing and POS → parties) are in 02-api.md. identity is the shared auth kernel: every domain may import JwtAuthGuard / @CurrentUser.",
    size: 12.5,
    color: C.muted,
  })
  d.chip({ x: 70, y: 846, text: "required", fill: C.blue, stroke: C.blueStroke })
  d.chip({ x: 180, y: 846, text: "optional", fill: C.orange, stroke: C.orangeStroke })
  d.label({
    x: 300,
    y: 850,
    width: 720,
    text: "DISABLED_DOMAINS accepts optional keys only, and refuses to disable a domain that an enabled domain still depends on.",
    size: 12,
    color: C.muted,
  })

  d.finish()
}

/* ────────────────────────────────────────────────────────────────────────────
 * 5. Core data model
 * ──────────────────────────────────────────────────────────────────────────── */
{
  const d = makeDiagram({
    name: "core-data-model",
    width: 1600,
    height: 980,
    title: "Core posting spine",
    subtitle: "Not a full ER diagram — the entities that explain invoices, stock and the general ledger",
  })

  const modelIds = new Map()
  const b = (key, x, y, w, h, title, detail, fill, stroke) => {
    const id = d.box({ x, y, w, h, title, detail, fill, stroke, titleSize: 17, detailSize: 12 })
    modelIds.set(key, id)
    return id
  }

  const tenant = b("tenant", 590, 145, 360, 92, "Tenant", "tenantId scopes every tenant-owned row below", C.gray, C.grayStroke)
  const party = b("party", 70, 300, 230, 100, "Party", "customer / supplier", C.blue, C.blueStroke)
  const invoice = b("invoice", 360, 300, 250, 118, "Invoice", "DRAFT → POSTED → CANCELLED\nbranch · currency · period", C.blue, C.blueStroke)
  const item = b("item", 680, 300, 230, 100, "Item", "product / service", C.green, C.greenStroke)
  const warehouse = b("warehouse", 970, 300, 230, 100, "Warehouse", "stock location", C.green, C.greenStroke)
  const journal = b("journal", 1260, 300, 260, 118, "JournalEntry", "balanced GL document\nposted / reversal", C.purple, C.purpleStroke)

  const payment = b("payment", 70, 500, 230, 100, "Payment", "receipt / disbursement", C.blue, C.blueStroke)
  const line = b("line", 360, 500, 250, 110, "InvoiceLine", "item · unit · qty · price", C.blue, C.blueStroke)
  const movement = b("movement", 680, 500, 230, 120, "StockMovement", "immutable ledger\nsigned quantity", C.green, C.greenStroke)
  const balance = b("balance", 970, 500, 230, 110, "StockBalance", "projection\nqty + average cost", C.green, C.greenStroke)
  const journalLine = b("journalLine", 1260, 500, 260, 100, "JournalLine", "debit / credit", C.purple, C.purpleStroke)

  const cashbox = b("cashbox", 70, 700, 230, 92, "Cashbox", "cash account", C.orange, C.orangeStroke)
  const allocation = b("allocation", 360, 700, 250, 100, "PaymentAllocation", "payment ↔ invoice", C.orange, C.orangeStroke)
  const account = b("account", 1260, 700, 260, 100, "ChartOfAccount", "GL account tree", C.purple, C.purpleStroke)
  const sidecars = b("sidecars", 680, 700, 520, 100, "AuditLog + OutboxEvent", "written in the same transaction as GL postings\noutbox is opt-in (OUTBOX_ENABLED)", C.red, C.redStroke)

  const link = (from, to, label, dashed = false, color = C.line) =>
    d.arrow({
      from: modelIds.get(from) ?? from,
      to: modelIds.get(to) ?? to,
      label,
      dashed,
      color,
      width: 2,
      labelDy: -9,
    })

  link("party", "invoice")
  link("invoice", "line", "1..n")
  link("item", "line", "item")
  link("warehouse", "movement", "warehouse")
  link("item", "movement", "item")
  link("movement", "balance", "computes")
  d.arrow({
    points: [
      { x: 485, y: 300 },
      { x: 485, y: 265 },
      { x: 1390, y: 265 },
      { x: 1390, y: 300 },
    ],
    label: "posts",
    width: 2,
  })
  link("journal", "journalLine", "1..n")
  link("journalLine", "account", "account")
  d.arrow({
    points: [
      { x: 360, y: 380 },
      { x: 330, y: 380 },
      { x: 330, y: 660 },
      { x: 440, y: 660 },
      { x: 440, y: 700 },
    ],
    width: 2,
  })
  d.arrow({
    points: [
      { x: 300, y: 550 },
      { x: 310, y: 550 },
      { x: 310, y: 680 },
      { x: 400, y: 680 },
      { x: 400, y: 700 },
    ],
    width: 2,
  })
  link("cashbox", "payment", "1..n")
  d.arrow({ from: journal, to: sidecars, dashed: true, color: C.redStroke, width: 2 })

  d.label({
    x: 70,
    y: 842,
    width: 1460,
    text: "Invoice posting is one transaction: stock movement + average-cost update + GL journal + audit/outbox + status flip. Cancellation is a reversal, never a delete.",
    size: 14,
    color: C.ink,
    weight: 600,
  })
  d.label({
    x: 70,
    y: 884,
    width: 1460,
    text: "FiscalPeriod and Currency also attach to Invoice, JournalEntry and StockMovement. Full column-by-column detail lives in docs/database.md and docs/DATABASE_SCHEMA.md; the schema files are authoritative.",
    size: 12.5,
    color: C.muted,
  })

  d.finish()
}

/* ────────────────────────────────────────────────────────────────────────────
 * 6. Codebase composition chart
 * ──────────────────────────────────────────────────────────────────────────── */
{
  const d = makeDiagram({
    name: "codebase-composition",
    width: 1600,
    height: 980,
    title: "Codebase composition",
    subtitle: "Where the source volume sits · TS/TSX snapshot, excluding generated/build/vendor output",
  })

  const domains = [
    ["accounting", 5269],
    ["identity", 4682],
    ["invoicing", 3818],
    ["catalog", 3631],
    ["inventory", 1864],
    ["ai-agent", 1651],
    ["reports", 1056],
    ["files", 683],
    ["platform", 677],
    ["custom-fields", 566],
    ["pos", 505],
    ["parties", 379],
    ["audit", 375],
  ]

  const workspaces = [
    ["dashboard", 632, 16],
    ["api", 667, 139],
    ["api-contracts", 82, 3],
    ["api-client", 68, 5],
    ["backend-core", 63, 8],
    ["db-prisma", 33, 0],
  ]

  const title = (text, x, y, color = C.ink) =>
    d.label({ x, y, text, size: 13, color, weight: 700 })

  title("API DOMAIN SIZE — NON-TEST TS LINES", 70, 132, C.greenStroke)
  const maxLoc = 5500
  const barX = 250
  const barMax = 430
  domains.forEach(([name, loc], index) => {
    const y = 170 + index * 52
    const w = (loc / maxLoc) * barMax
    d.box({
      x: barX,
      y,
      w,
      h: 30,
      title: "",
      fill: C.green,
      stroke: C.greenStroke,
      titleSize: 1,
      detailSize: 1,
      tiny: true,
    })
    d.label({ x: 70, y: y + 5, text: name, size: 13, color: C.ink, width: 170 })
    d.label({ x: barX + w + 10, y: y + 4, text: String(loc), size: 12.5, color: C.muted, width: 70 })
  })
  d.label({ x: barX, y: 856, text: "0", size: 11, color: C.muted })
  d.label({ x: barX + barMax - 18, y: 856, text: "5.5k", size: 11, color: C.muted })

  title("WORKSPACE SOURCE FILES — TESTS HIGHLIGHTED", 850, 132, C.blueStroke)
  const maxFiles = 700
  const barX2 = 1060
  const barMax2 = 400
  workspaces.forEach(([name, files, tests], index) => {
    const y = 170 + index * 62
    const totalW = (files / maxFiles) * barMax2
    const testW = (tests / maxFiles) * barMax2
    d.box({
      x: barX2,
      y,
      w: totalW,
      h: 34,
      title: "",
      fill: C.blue,
      stroke: C.blueStroke,
      titleSize: 1,
      detailSize: 1,
      tiny: true,
    })
    if (tests > 0) {
      d.box({
        x: barX2,
        y,
        w: Math.max(3, testW),
        h: 34,
        title: "",
        fill: C.orange,
        stroke: C.orangeStroke,
        titleSize: 1,
        detailSize: 1,
        tiny: true,
      })
    }
    d.label({ x: 850, y: y + 6, text: name, size: 13, color: C.ink, width: 185 })
    d.label({
      x: barX2 + totalW + 10,
      y: y + 5,
      text: `${files}${tests ? ` · ${tests} tests` : ""}`,
      size: 12,
      color: C.muted,
      width: 120,
    })
  })

  title("SNAPSHOT TOTALS", 850, 570, C.purpleStroke)
  const stats = [
    ["13", "API domains"],
    ["38", "dashboard modules"],
    ["56", "Prisma models"],
    ["39", "migrations"],
    ["22", "Prisma enums"],
    ["1,545", "TS/TSX in six areas"],
  ]
  stats.forEach(([value, label], index) => {
    const col = index % 3
    const row = Math.floor(index / 3)
    const x = 850 + col * 230
    const y = 606 + row * 104
    d.box({
      x,
      y,
      w: 210,
      h: 86,
      title: value,
      detail: label,
      fill: C.purple,
      stroke: C.purpleStroke,
      titleSize: 24,
      detailSize: 12,
    })
  })

  d.label({
    x: 70,
    y: 900,
    width: 1460,
    text: "Volume is intentionally concentrated in the two applications (dashboard + API); shared packages stay small, which is the point of the vertical-slice architecture.",
    size: 13,
    color: C.muted,
  })

  d.finish()
}

console.log(`\nDiagrams written to ${OUT}`)
