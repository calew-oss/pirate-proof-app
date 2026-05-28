import { Router } from "express";
import { db } from "@workspace/db";
import { pinsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreatePinBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

function formatPin(p: typeof pinsTable.$inferSelect) {
  return {
    id: p.id,
    label: p.label,
    pinCode: p.pinCode,
    type: p.type,
    isActive: p.isActive,
    usageCount: p.usageCount,
    expiresAt: p.expiresAt?.toISOString() ?? null,
    validFrom: p.validFrom?.toISOString() ?? null,
    validUntil: p.validUntil?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/lock/pins", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const pins = await db
    .select()
    .from(pinsTable)
    .where(eq(pinsTable.userId, req.user!.id))
    .orderBy(pinsTable.createdAt);
  res.json(pins.map(formatPin));
});

router.post("/lock/pins", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreatePinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user!.id;
  const { label, pinCode, type, expiresAt, validFrom, validUntil } = parsed.data;

  const [pin] = await db
    .insert(pinsTable)
    .values({
      userId,
      label,
      pinCode,
      type,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
    })
    .returning();

  res.status(201).json(formatPin(pin));
});

router.delete("/lock/pins/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.id;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [deleted] = await db
    .delete(pinsTable)
    .where(and(eq(pinsTable.id, id), eq(pinsTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "PIN not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
