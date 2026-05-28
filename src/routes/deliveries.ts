import { Router } from "express";
import { db } from "@workspace/db";
import { deliveriesTable, lockStatusTable, lockEventsTable, pinsTable, notificationsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateDeliveryBody, TrackPackageBody, GenerateAccessCodeBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { getTrackingStatus } from "../lib/easypost";
import { sendPushNotification } from "../lib/push";

const router = Router();

// Per-user auto-relock timers for delivery mode
const relockTimers = new Map<number, ReturnType<typeof setTimeout>>();

function formatDelivery(d: typeof deliveriesTable.$inferSelect) {
  return {
    ...d,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    estimatedDelivery: d.estimatedDelivery ?? null,
    lastLocation: d.lastLocation ?? null,
    description: d.description ?? null,
    accessCode: d.accessCode ?? null,
    codeStatus: d.codeStatus,
    codeExpires: d.codeExpires?.toISOString() ?? null,
    codeSingleUse: d.codeSingleUse,
  };
}

async function getUserPushToken(userId: number): Promise<string | null> {
  const [user] = await db
    .select({ pushToken: usersTable.pushToken })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return user?.pushToken ?? null;
}

function generateCode(): string {
  const digits = 4 + Math.floor(Math.random() * 3); // 4, 5, or 6 digits
  return String(Math.floor(Math.random() * Math.pow(10, digits))).padStart(digits, "0");
}

function endOfDay(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

async function autoAssignAccessCode(
  userId: number,
  delivery: typeof deliveriesTable.$inferSelect,
  pushToken: string | null,
): Promise<string> {
  const code = generateCode();
  const expires = endOfDay();

  // Register PIN on lock
  await db.insert(pinsTable).values({
    userId,
    label: `Delivery ${delivery.trackingNumber.slice(-6)}`,
    pinCode: code,
    type: "delivery",
    validFrom: new Date(),
    validUntil: expires,
  });

  // Update delivery record
  await db
    .update(deliveriesTable)
    .set({ accessCode: code, codeStatus: "active", codeExpires: expires, codeSingleUse: false })
    .where(eq(deliveriesTable.id, delivery.id));

  // Log access code creation
  await db.insert(lockEventsTable).values({
    userId,
    action: "access_code_used",
    triggeredBy: "system",
    codeUsed: code,
    deliveryId: delivery.id,
    pinLabel: `Auto-generated for delivery ${delivery.trackingNumber.slice(-6)}`,
  });

  await db.insert(notificationsTable).values({
    userId,
    title: "🔑 Smart Access Code Ready",
    body: "An access code is active for your delivery. Open the delivery details to view and share it with your courier.",
    type: "delivery_update",
    deliveryId: delivery.id,
  });

  await sendPushNotification(pushToken, {
    title: "🔑 Smart Access Code Ready",
    body: "An access code is ready for your delivery. Tap to view it in the app.",
    data: { screen: "delivery", deliveryId: delivery.id },
  });

  return code;
}

async function expireDeliveryCodes(userId: number, deliveryIds: number[]) {
  for (const id of deliveryIds) {
    await db
      .update(deliveriesTable)
      .set({ codeStatus: "expired" })
      .where(and(eq(deliveriesTable.id, id), eq(deliveriesTable.userId, userId)));
  }
}

async function triggerDeliveryModeUnlock(userId: number, pushToken: string | null) {
  const [lock] = await db
    .select()
    .from(lockStatusTable)
    .where(eq(lockStatusTable.userId, userId));

  if (!lock || !lock.deliveryModeEnabled || !lock.isLocked) return;

  await db
    .update(lockStatusTable)
    .set({ isLocked: false, lastAction: "unlocked", lastActionAt: new Date() })
    .where(eq(lockStatusTable.userId, userId));

  await db.insert(lockEventsTable).values({
    userId,
    action: "unlocked",
    triggeredBy: "delivery_mode",
    pinLabel: "Delivery Mode Auto-Unlock",
  });

  await db.insert(notificationsTable).values({
    userId,
    title: "📦 Box Auto-Unlocked",
    body: "Delivery mode unlocked your box. It will re-lock automatically.",
    type: "lock_event",
  });

  await sendPushNotification(pushToken, {
    title: "📦 Box Auto-Unlocked",
    body: `Delivery mode unlocked your box. It will re-lock in ${lock.deliveryModeTimeout} min.`,
    data: { screen: "lock" },
  });

  // Clear any existing timer and set a new re-lock timer
  const existing = relockTimers.get(userId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    relockTimers.delete(userId);
    await db
      .update(lockStatusTable)
      .set({ isLocked: true, lastAction: "locked", lastActionAt: new Date() })
      .where(eq(lockStatusTable.userId, userId));

    await db.insert(lockEventsTable).values({
      userId,
      action: "locked",
      triggeredBy: "system",
      pinLabel: "Delivery Mode Auto-Relock",
    });

    await db.insert(notificationsTable).values({
      userId,
      title: "🔒 Box Auto-Relocked",
      body: "Your delivery box has been automatically re-secured.",
      type: "lock_event",
    });

    await sendPushNotification(pushToken, {
      title: "🔒 Box Auto-Relocked",
      body: "Your Pirate Proof box has been automatically re-secured.",
      data: { screen: "lock" },
    });
  }, lock.deliveryModeTimeout * 60 * 1000);

  relockTimers.set(userId, timer);
}

// GET /deliveries
router.get("/deliveries", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.id;
  const deliveries = await db
    .select()
    .from(deliveriesTable)
    .where(eq(deliveriesTable.userId, userId))
    .orderBy(deliveriesTable.createdAt);

  res.json(deliveries.map(formatDelivery));
});

// POST /deliveries
router.post("/deliveries", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateDeliveryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user!.id;
  const { carrier, trackingNumber, description } = parsed.data;

  const tracking = await getTrackingStatus(carrier, trackingNumber);
  const [delivery] = await db
    .insert(deliveriesTable)
    .values({
      userId,
      carrier,
      trackingNumber,
      description: description ?? null,
      status: tracking.status,
      estimatedDelivery: tracking.estimatedDelivery,
      lastLocation: tracking.lastLocation,
    })
    .returning();

  await db.insert(notificationsTable).values({
    userId,
    title: "Package Added",
    body: `Tracking ${trackingNumber} via ${carrier.toUpperCase()} — ${tracking.status.replace(/_/g, " ")}`,
    type: "delivery_update",
    deliveryId: delivery.id,
  });

  const pushToken = await getUserPushToken(userId);
  if (tracking.status === "out_for_delivery" || tracking.status === "delivered") {
    await sendPushNotification(pushToken, {
      title: tracking.status === "out_for_delivery" ? "📦 Out for Delivery!" : "✅ Package Delivered!",
      body: `${carrier.toUpperCase()} package is ${tracking.status.replace(/_/g, " ")}.`,
      data: { screen: "delivery", deliveryId: delivery.id },
    });
  }
  if (tracking.status === "out_for_delivery") {
    await triggerDeliveryModeUnlock(userId, pushToken);
    await autoAssignAccessCode(userId, delivery, pushToken);
  }

  res.status(201).json(formatDelivery(delivery));
});

// POST /track — EasyPost real-time tracker
router.post("/track", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = TrackPackageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user!.id;
  const { carrier, trackingNumber } = parsed.data;

  const tracking = await getTrackingStatus(carrier, trackingNumber);

  // Upsert: update existing or create new
  const [existing] = await db
    .select()
    .from(deliveriesTable)
    .where(and(eq(deliveriesTable.userId, userId), eq(deliveriesTable.trackingNumber, trackingNumber)));

  let delivery: typeof deliveriesTable.$inferSelect;
  if (existing) {
    const [upd] = await db
      .update(deliveriesTable)
      .set({ status: tracking.status, lastLocation: tracking.lastLocation, estimatedDelivery: tracking.estimatedDelivery, updatedAt: new Date() })
      .where(eq(deliveriesTable.id, existing.id))
      .returning();
    delivery = upd;
  } else {
    const [created] = await db
      .insert(deliveriesTable)
      .values({ userId, carrier, trackingNumber, status: tracking.status, estimatedDelivery: tracking.estimatedDelivery, lastLocation: tracking.lastLocation })
      .returning();
    delivery = created;
  }

  res.json(formatDelivery(delivery));
});

// POST /deliveries/sync
router.post("/deliveries/sync", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.id;
  const deliveries = await db
    .select()
    .from(deliveriesTable)
    .where(eq(deliveriesTable.userId, userId));

  const pushToken = await getUserPushToken(userId);
  const outForDelivery: typeof deliveriesTable.$inferSelect[] = [];
  const newlyDelivered: typeof deliveriesTable.$inferSelect[] = [];

  const updated = await Promise.all(
    deliveries.map(async (d) => {
      const prevStatus = d.status;
      const tracking = await getTrackingStatus(d.carrier, d.trackingNumber);
      const [upd] = await db
        .update(deliveriesTable)
        .set({
          status: tracking.status,
          lastLocation: tracking.lastLocation,
          estimatedDelivery: tracking.estimatedDelivery,
          updatedAt: new Date(),
        })
        .where(eq(deliveriesTable.id, d.id))
        .returning();

      if (prevStatus !== tracking.status) {
        if (tracking.status === "out_for_delivery") outForDelivery.push(upd);
        if (tracking.status === "delivered") newlyDelivered.push(upd);
      }

      return formatDelivery(upd);
    }),
  );

  if (outForDelivery.length > 0) {
    await sendPushNotification(pushToken, {
      title: "📦 Out for Delivery!",
      body: `${outForDelivery.length} package${outForDelivery.length > 1 ? "s are" : " is"} out for delivery today.`,
      data: { screen: "deliveries" },
    });
    await triggerDeliveryModeUnlock(userId, pushToken);
    // Auto-assign access codes for newly out-for-delivery packages
    for (const d of outForDelivery) {
      if (!d.accessCode || d.codeStatus === "none") {
        await autoAssignAccessCode(userId, d, pushToken);
      }
    }
  }

  if (newlyDelivered.length > 0) {
    await sendPushNotification(pushToken, {
      title: "✅ Package Delivered!",
      body: `${newlyDelivered.length} package${newlyDelivered.length > 1 ? "s have" : " has"} been delivered.`,
      data: { screen: "deliveries" },
    });
    // Expire codes for delivered packages
    await expireDeliveryCodes(userId, newlyDelivered.map((d) => d.id));
  }

  res.json(updated);
});

// POST /deliveries/:id/generate-code — manually generate/regenerate access code
router.post("/deliveries/:id/generate-code", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.id;
  const id = parseInt(req.params.id as string, 10);

  const [delivery] = await db
    .select()
    .from(deliveriesTable)
    .where(and(eq(deliveriesTable.id, id), eq(deliveriesTable.userId, userId)));

  if (!delivery) {
    res.status(404).json({ error: "Delivery not found" });
    return;
  }

  const body = GenerateAccessCodeBody.safeParse(req.body ?? {});
  const singleUse = body.success && body.data.singleUse === true;
  const expiresAt = body.success && body.data.expiresAt ? new Date(body.data.expiresAt) : endOfDay();

  const code = generateCode();

  // Register PIN on lock
  await db.insert(pinsTable).values({
    userId,
    label: `Delivery ${delivery.trackingNumber.slice(-6)}`,
    pinCode: code,
    type: singleUse ? "one_time" : "delivery",
    validFrom: new Date(),
    validUntil: expiresAt,
  });

  // Update delivery
  await db
    .update(deliveriesTable)
    .set({ accessCode: code, codeStatus: "active", codeExpires: expiresAt, codeSingleUse: singleUse })
    .where(eq(deliveriesTable.id, id));

  // Log
  await db.insert(lockEventsTable).values({
    userId,
    action: "access_code_used",
    triggeredBy: "user",
    codeUsed: code,
    deliveryId: id,
    pinLabel: `Manual code for delivery ${delivery.trackingNumber.slice(-6)}`,
  });

  const instructions = `Place package in Pirate Proof box. Enter code: ${code}`;

  res.json({
    code,
    codeStatus: "active",
    codeExpires: expiresAt.toISOString(),
    codeSingleUse: singleUse,
    instructions,
  });
});

// POST /deliveries/:id/revoke-code
router.post("/deliveries/:id/revoke-code", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.id;
  const id = parseInt(req.params.id as string, 10);

  const [delivery] = await db
    .select()
    .from(deliveriesTable)
    .where(and(eq(deliveriesTable.id, id), eq(deliveriesTable.userId, userId)));

  if (!delivery) {
    res.status(404).json({ error: "Delivery not found" });
    return;
  }

  // Delete associated delivery pins by matching the code
  if (delivery.accessCode) {
    await db
      .delete(pinsTable)
      .where(and(eq(pinsTable.userId, userId), eq(pinsTable.pinCode, delivery.accessCode)));
  }

  // Mark code as expired
  await db
    .update(deliveriesTable)
    .set({ codeStatus: "expired" })
    .where(eq(deliveriesTable.id, id));

  // Log the revocation
  await db.insert(lockEventsTable).values({
    userId,
    action: "access_code_used",
    triggeredBy: "user",
    codeUsed: delivery.accessCode ?? undefined,
    deliveryId: id,
    pinLabel: `Revoked code for delivery ${delivery.trackingNumber.slice(-6)}`,
  });

  res.json({ success: true });
});

// GET /deliveries/:id/instructions
router.get("/deliveries/:id/instructions", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.id;
  const id = parseInt(req.params.id as string, 10);

  const [delivery] = await db
    .select()
    .from(deliveriesTable)
    .where(and(eq(deliveriesTable.id, id), eq(deliveriesTable.userId, userId)));

  if (!delivery) {
    res.status(404).json({ error: "Delivery not found" });
    return;
  }

  if (!delivery.accessCode || delivery.codeStatus === "none") {
    res.json({
      message: "No access code assigned yet. Generate one to share with your courier.",
      code: null,
      expiresAt: null,
    });
    return;
  }

  const expiry = delivery.codeExpires
    ? new Date(delivery.codeExpires).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  const message = delivery.codeStatus === "active"
    ? `Place package in Pirate Proof box. Enter code: ${delivery.accessCode}${expiry ? ` — Valid until ${expiry}` : ""}`
    : `Access code ${delivery.accessCode} is ${delivery.codeStatus}. Generate a new one if needed.`;

  res.json({
    message,
    code: delivery.accessCode,
    expiresAt: delivery.codeExpires?.toISOString() ?? null,
  });
});

// GET /deliveries/:id
router.get("/deliveries/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.id;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [delivery] = await db
    .select()
    .from(deliveriesTable)
    .where(and(eq(deliveriesTable.id, id), eq(deliveriesTable.userId, userId)));

  if (!delivery) {
    res.status(404).json({ error: "Delivery not found" });
    return;
  }

  res.json(formatDelivery(delivery));
});

// DELETE /deliveries/:id
router.delete("/deliveries/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.id;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [deleted] = await db
    .delete(deliveriesTable)
    .where(and(eq(deliveriesTable.id, id), eq(deliveriesTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Delivery not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
