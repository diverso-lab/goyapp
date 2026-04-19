import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type FabricObject = Record<string, unknown>;

function scene(width: number, height: number, background: string, objects: FabricObject[]) {
  return { version: "6.0.0", background, objects } as const;
}

const templates = [
  {
    id: "tpl-goyapp-original",
    name: "Goyapp — Evento clásico",
    description: "Plantilla original Diverso Lab: título, fecha, lugar, ponente.",
    category: "goyapp",
    width: 1080,
    height: 1527,
    scene: scene(1080, 1527, "#0b1f3a", [
      { type: "Rect", left: 0, top: 0, width: 1080, height: 1527, fill: "#0b1f3a" },
      { type: "Rect", left: 0, top: 0, width: 1080, height: 18, fill: "#f97316" },
      { type: "Rect", left: 0, top: 1509, width: 1080, height: 18, fill: "#f97316" },
      {
        type: "IText", text: "EVENTO",
        left: 540, top: 120, originX: "center", originY: "center",
        fontFamily: "Oswald", fontSize: 40, fill: "#f97316", charSpacing: 800,
      },
      {
        type: "IText", text: "Título del evento",
        slot: "title",
        left: 540, top: 340, originX: "center", originY: "center",
        fontFamily: "Oswald", fontSize: 130, fill: "#ffffff",
        textAlign: "center", lineHeight: 0.95,
      },
      {
        type: "Rect",
        left: 540, top: 640, originX: "center", originY: "center",
        width: 140, height: 4, fill: "#f97316",
      },
      {
        type: "IText", text: "Ponente",
        slot: "speaker",
        left: 540, top: 780, originX: "center", originY: "center",
        fontFamily: "Inter", fontSize: 56, fontWeight: "bold", fill: "#ffffff",
        textAlign: "center", lineHeight: 1.1,
      },
      {
        type: "IText", text: "Fecha y hora",
        slot: "datetime",
        left: 540, top: 1080, originX: "center", originY: "center",
        fontFamily: "Inter", fontSize: 48, fill: "#f97316",
        textAlign: "center",
      },
      {
        type: "IText", text: "Lugar",
        slot: "location",
        left: 540, top: 1220, originX: "center", originY: "center",
        fontFamily: "Inter", fontSize: 36, fill: "#cbd5e1",
        textAlign: "center", lineHeight: 1.15,
      },
      {
        type: "IText", text: "Diverso Lab · Universidad de Sevilla",
        left: 540, top: 1430, originX: "center", originY: "center",
        fontFamily: "Inter", fontSize: 24, fill: "#94a3b8", textAlign: "center",
      },
    ]),
  },
  {
    id: "tpl-conference-portrait",
    name: "Conference — Portrait",
    description: "Clean, minimalist talk poster.",
    category: "conference",
    width: 1080,
    height: 1350,
    scene: scene(1080, 1350, "#0f172a", [
      {
        type: "Rect",
        left: 0, top: 0, width: 1080, height: 240,
        fill: "#2563eb", selectable: true,
      },
      {
        type: "IText",
        text: "Event Title",
        left: 540, top: 110, originX: "center", originY: "center",
        fontFamily: "Inter", fontSize: 72, fontWeight: "bold", fill: "#ffffff",
        textAlign: "center",
      },
      {
        type: "IText",
        text: "Speaker Name",
        left: 540, top: 560, originX: "center", originY: "center",
        fontFamily: "Inter", fontSize: 64, fontWeight: "bold", fill: "#ffffff",
        textAlign: "center",
      },
      {
        type: "IText",
        text: "Role · Company",
        left: 540, top: 640, originX: "center", originY: "center",
        fontFamily: "Inter", fontSize: 34, fill: "#94a3b8",
        textAlign: "center",
      },
      {
        type: "Rect",
        left: 540, top: 840, originX: "center", originY: "center",
        width: 640, height: 2, fill: "#334155",
      },
      {
        type: "IText",
        text: "March 7, 2026 · 10:30",
        left: 540, top: 920, originX: "center", originY: "center",
        fontFamily: "Inter", fontSize: 36, fill: "#e2e8f0",
        textAlign: "center",
      },
      {
        type: "IText",
        text: "Aula A2.11 · ETSI Informática",
        left: 540, top: 980, originX: "center", originY: "center",
        fontFamily: "Inter", fontSize: 28, fill: "#94a3b8",
        textAlign: "center",
      },
    ]),
  },
  {
    id: "tpl-workshop-landscape",
    name: "Workshop — Landscape 16:9",
    description: "Bold colors for hands-on sessions.",
    category: "workshop",
    width: 1920,
    height: 1080,
    scene: scene(1920, 1080, "#fef3c7", [
      {
        type: "Circle",
        left: 1650, top: -150, radius: 400, fill: "#f59e0b",
      },
      {
        type: "Circle",
        left: -180, top: 900, radius: 320, fill: "#ef4444",
      },
      {
        type: "IText",
        text: "WORKSHOP",
        left: 120, top: 180,
        fontFamily: "Oswald", fontSize: 64, fill: "#7c2d12", letterSpacing: 8,
      },
      {
        type: "IText",
        text: "Build it\nfrom scratch",
        left: 120, top: 280,
        fontFamily: "Oswald", fontSize: 180, fill: "#111827", lineHeight: 0.95,
      },
      {
        type: "Rect",
        left: 120, top: 720, width: 680, height: 4, fill: "#111827",
      },
      {
        type: "IText",
        text: "Saturday · April 25 · 10:00",
        left: 120, top: 760,
        fontFamily: "Inter", fontSize: 40, fontWeight: "bold", fill: "#111827",
      },
      {
        type: "IText",
        text: "Lab B1.09 · University of Seville",
        left: 120, top: 820,
        fontFamily: "Inter", fontSize: 30, fill: "#374151",
      },
      {
        type: "IText",
        text: "Register → goyapp.local",
        left: 120, top: 920,
        fontFamily: "Inter", fontSize: 28, fontStyle: "italic", fill: "#7c2d12",
      },
    ]),
  },
  {
    id: "tpl-meetup-square",
    name: "Meetup — Square",
    description: "Social-ready square format.",
    category: "meetup",
    width: 1080,
    height: 1080,
    scene: scene(1080, 1080, "#ffffff", [
      {
        type: "Rect",
        left: 0, top: 0, width: 1080, height: 1080, fill: "#ecfeff",
      },
      {
        type: "Rect",
        left: 60, top: 60, width: 960, height: 960, fill: "rgba(0,0,0,0)", stroke: "#0891b2", strokeWidth: 6,
      },
      {
        type: "IText",
        text: "MEETUP",
        left: 540, top: 200, originX: "center", originY: "center",
        fontFamily: "Inter", fontSize: 40, fill: "#0e7490", fontWeight: "bold", charSpacing: 600,
      },
      {
        type: "IText",
        text: "Open Source\nFriday",
        left: 540, top: 470, originX: "center", originY: "center",
        fontFamily: "Georgia", fontSize: 128, fill: "#083344", textAlign: "center", lineHeight: 1,
      },
      {
        type: "IText",
        text: "April 25 · 18:00 · Cafetería Central",
        left: 540, top: 780, originX: "center", originY: "center",
        fontFamily: "Inter", fontSize: 32, fill: "#0e7490", textAlign: "center",
      },
      {
        type: "IText",
        text: "All welcome — bring a laptop",
        left: 540, top: 860, originX: "center", originY: "center",
        fontFamily: "Inter", fontSize: 24, fontStyle: "italic", fill: "#0891b2", textAlign: "center",
      },
    ]),
  },
] as const;

async function main() {
  for (const t of templates) {
    await prisma.template.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        width: t.width,
        height: t.height,
        scene: t.scene as object,
      },
      update: {
        name: t.name,
        description: t.description,
        category: t.category,
        width: t.width,
        height: t.height,
        scene: t.scene as object,
      },
    });
  }

  const demoEmail = "demo@goyapp.local";
  const existing = await prisma.user.findUnique({ where: { email: demoEmail } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email: demoEmail,
        name: "Demo",
        passwordHash: await bcrypt.hash("demo1234", 12),
      },
    });
  }

  console.log(`Seeded ${templates.length} templates and demo user (${demoEmail} / demo1234)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
