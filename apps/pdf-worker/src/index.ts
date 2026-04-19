import Fastify from "fastify";
import puppeteer, { Browser, Page } from "puppeteer";
import { z } from "zod";
import archiver from "archiver";

const singleSchema = z.object({
  svg: z.string().min(10),
  width: z.number().positive(),
  height: z.number().positive(),
  filename: z.string().default("poster"),
});

const batchSchema = z.object({
  items: z.array(singleSchema).min(1).max(500),
  zipName: z.string().default("posters"),
});

const PORT = Number(process.env.PORT ?? 4000);
const WORKER_SECRET = process.env.WORKER_SECRET ?? "";

let browserPromise: Promise<Browser> | null = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserPromise;
}

async function renderSvgToPdf(
  page: Page,
  svg: string,
  width: number,
  height: number,
): Promise<Buffer> {
  const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Oswald:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&family=Merriweather:wght@400;700&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;padding:0;background:#fff;font-family:Inter,system-ui,sans-serif;}
  svg{display:block;width:${width}px;height:${height}px;}
</style></head>
<body>${svg}</body></html>`;
  await page.setViewport({
    width: Math.ceil(width),
    height: Math.ceil(height),
    deviceScaleFactor: 2,
  });
  await page.setContent(html, { waitUntil: "networkidle0" });
  // Ensure custom fonts are actually loaded before printing.
  await page.evaluateHandle("document.fonts.ready");
  const pdf = await page.pdf({
    width: `${width}px`,
    height: `${height}px`,
    printBackground: true,
    pageRanges: "1",
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  return Buffer.from(pdf);
}

const app = Fastify({ logger: true, bodyLimit: 50 * 1024 * 1024 });

app.get("/health", async () => ({ ok: true }));

// Shared-secret gate for /render and /batch. /health stays open so Docker can health-check.
app.addHook("preHandler", async (req, reply) => {
  if (req.url === "/health") return;
  if (!WORKER_SECRET) return; // fail-open when not configured (dev convenience)
  const provided = req.headers["x-worker-secret"];
  if (provided !== WORKER_SECRET) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
});

app.post("/render", async (req, reply) => {
  const parsed = singleSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid input" });
  const { svg, width, height, filename } = parsed.data;

  if (!/<svg[\s>]/i.test(svg)) {
    return reply.code(400).send({ error: "Body is not an SVG" });
  }

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const pdf = await renderSvgToPdf(page, svg, width, height);
    reply
      .header("content-type", "application/pdf")
      .header("content-disposition", contentDisposition(`${filename}.pdf`))
      .send(pdf);
  } catch (err) {
    req.log.error({ err }, "PDF render failed");
    return reply.code(422).send({ error: (err as Error).message });
  } finally {
    await page.close();
  }
});

app.post("/batch", async (req, reply) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid input" });
  const { items, zipName } = parsed.data;

  const browser = await getBrowser();
  const page = await browser.newPage();

  const archive = archiver("zip", { zlib: { level: 9 } });
  reply.raw.writeHead(200, {
    "content-type": "application/zip",
    "content-disposition": contentDisposition(`${zipName}.zip`),
  });
  archive.pipe(reply.raw);

  archive.on("warning", (err) => app.log.warn(err));
  archive.on("error", (err) => {
    app.log.error(err);
    reply.raw.destroy(err);
  });

  const used = new Set<string>();
  try {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const pdf = await renderSvgToPdf(page, it.svg, it.width, it.height);
      let base = sanitize(it.filename) || `poster-${i + 1}`;
      let name = `${base}.pdf`;
      let n = 2;
      while (used.has(name)) name = `${base}-${n++}.pdf`;
      used.add(name);
      archive.append(pdf, { name });
    }
    await archive.finalize();
  } finally {
    await page.close();
  }

  return reply;
});

function sanitize(s: string) {
  return s.replace(/[^\w.-]+/g, "_").slice(0, 80);
}

/** Build a Content-Disposition that is safe in HTTP headers AND carries the
 *  original UTF-8 filename via RFC 5987 so downloaders see the right name. */
function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "_").slice(0, 100);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

app.listen({ port: PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

const shutdown = async () => {
  try { (await browserPromise)?.close(); } catch {}
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
