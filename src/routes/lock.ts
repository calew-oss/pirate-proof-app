import { Router } from "express";
import { db } from "@workspace/db";
import { lockStatusTable, lockEventsTable, notificationsTable, usersTable, pinsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ToggleLockBody, SetDeliveryModeBody, SetLockPinBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { sendPushNotification } from "../lib/push";

const router = Router();

async function getOrCreateLockStatus(userId: number) {
  const [existing] = await db
    .select()
    .from(lockStatusTable)
    .where(eq(lockStatusTable.userId, userId));

  if (existing) return existing;

  const [created] = await db
    .insert(lockStatusTable)
    .values({ userId, isLocked: true, lastAction: "locked", batteryLevel: 85, deliveryModeTimeout: 30 })
    .returning();
  return created;
}

function formatLock(lock: typeof lockStatusTable.$inferSelect) {
  return {
    id: lock.id,
    isLocked: lock.isLocked,
    lastAction: lock.lastAction,
    lastActionAt: lock.lastActionAt.toISOString(),
    deliveryModeEnabled: lock.deliveryModeEnabled,
    deliveryModeTimeout: lock.deliveryModeTimeout,
    batteryLevel: lock.batteryLevel,
  };
}

function formatEvent(e: typeof lockEventsTable.$inferSelect) {
  return {
    id: e.id,
    action: e.action,
    triggeredBy: e.triggeredBy,
    pinLabel: e.pinLabel ?? null,
    codeUsed: e.codeUsed ?? null,
    deliveryId: e.deliveryId ?? null,
    occurredAt: e.occurredAt.toISOString(),
  };
}

async function applyLockAction(
  userId: number,
  isLocked: boolean,
  triggeredBy: string,
  pushToken?: string | null,
) {
  const action = isLocked ? "locked" : "unlocked";
  const [updated] = await db
    .update(lockStatusTable)
    .set({ isLocked, lastAction: action, lastActionAt: new Date() })
    .where(eq(lockStatusTable.userId, userId))
    .returning();

  await db.insert(lockEventsTable).values({ userId, action, triggeredBy });

  await db.insert(notificationsTable).values({
    userId,
    title: isLocked ? "Lock Secured" : "Lock Opened",
    body: `Your delivery box was ${action} (${triggeredBy}).`,
    type: "lock_event",
  });

  if (pushToken !== undefined) {
    await sendPushNotification(pushToken, {
      title: isLocked ? "🔒 Box Secured" : "🔓 Box Unlocked",
      body: `Your Pirate Proof box was ${action}.`,
      data: { screen: "lock" },
    });
  }

  return updated;
}

// GET /lock/status
router.get("/lock/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const lock = await getOrCreateLockStatus(req.user!.id);
  res.json(formatLock(lock));
});

// POST /lock/toggle (original - kept for compatibility)
router.post("/lock/toggle", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = ToggleLockBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user!.id;
  await getOrCreateLockStatus(userId);

  const [user] = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, userId));
  const updated = await applyLockAction(userId, parsed.data.action === "lock", "user", user?.pushToken);
  res.json(formatLock(updated));
});

// POST /lock/lock — IoT endpoint
router.post("/lock/lock", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.id;
  await getOrCreateLockStatus(userId);
  const [user] = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, userId));
  const updated = await applyLockAction(userId, true, "user", user?.pushToken);
  res.json(formatLock(updated));
});

// POST /lock/unlock — IoT endpoint
router.post("/lock/unlock", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.id;
  await getOrCreateLockStatus(userId);
  const [user] = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, userId));
  const updated = await applyLockAction(userId, false, "user", user?.pushToken);
  res.json(formatLock(updated));
});

// POST /lock/set-pin — IoT endpoint to set PIN
router.post("/lock/set-pin", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = SetLockPinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user!.id;
  const { label, pinCode, type } = parsed.data;

  const [pin] = await db
    .insert(pinsTable)
    .values({ userId, label, pinCode, type })
    .returning();

  await db.insert(lockEventsTable).values({
    userId,
    action: "pin_used",
    triggeredBy: "user",
    pinLabel: label,
  });

  res.status(201).json({
    id: pin.id,
    label: pin.label,
    pinCode: pin.pinCode,
    type: pin.type,
    isActive: pin.isActive,
    usageCount: pin.usageCount,
    expiresAt: pin.expiresAt?.toISOString() ?? null,
    validFrom: pin.validFrom?.toISOString() ?? null,
    validUntil: pin.validUntil?.toISOString() ?? null,
    createdAt: pin.createdAt.toISOString(),
  });
});

// POST /lock/delivery-mode — toggle delivery mode auto-unlock
router.post("/lock/delivery-mode", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = SetDeliveryModeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user!.id;
  await getOrCreateLockStatus(userId);

  const { enabled, timeoutMinutes } = parsed.data;
  const [updated] = await db
    .update(lockStatusTable)
    .set({
      deliveryModeEnabled: enabled,
      ...(timeoutMinutes !== undefined ? { deliveryModeTimeout: timeoutMinutes } : {}),
    })
    .where(eq(lockStatusTable.userId, userId))
    .returning();

  const eventAction = enabled ? "delivery_mode_enabled" : "delivery_mode_disabled";
  await db.insert(lockEventsTable).values({ userId, action: eventAction, triggeredBy: "user" });

  await db.insert(notificationsTable).values({
    userId,
    title: enabled ? "🚚 Delivery Mode On" : "Delivery Mode Off",
    body: enabled
      ? `Box will auto-unlock when packages are out for delivery, then re-lock after ${updated.deliveryModeTimeout} min.`
      : "Delivery mode auto-unlock is now disabled.",
    type: "lock_event",
  });

  res.json(formatLock(updated));
});

// GET /lock/history
router.get("/lock/history", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const events = await db
    .select()
    .from(lockEventsTable)
    .where(eq(lockEventsTable.userId, req.user!.id))
    .orderBy(lockEventsTable.occurredAt);

  res.json(events.map(formatEvent).reverse());
});

// GET /lock/logs — detailed access log with delivery associations
router.get("/lock/logs", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const events = await db
    .select()
    .from(lockEventsTable)
    .where(eq(lockEventsTable.userId, req.user!.id))
    .orderBy(lockEventsTable.occurredAt);

  res.json(events.map(formatEvent).reverse());
});

export default router;
