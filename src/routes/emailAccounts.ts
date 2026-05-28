import { Router } from "express";
import { db } from "@workspace/db";
import {
  emailAccountsTable,
  deliveriesTable,
  notificationsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { ConnectEmailAccountBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { getMockTrackingStatus } from "../lib/mockTracking";

const router = Router();

const CARRIERS = ["ups", "fedex", "usps", "amazon", "dhl"] as const;
const MOCK_TRACKING_TEMPLATES = [
  "1Z999AA10123456784",
  "9400111899223456789012",
  "7749877654321098765",
  "402-5555543-8765432",
];

function formatAccount(a: typeof emailAccountsTable.$inferSelect) {
  return {
    id: a.id,
    email: a.email,
    provider: a.provider,
    isActive: a.isActive,
    lastSyncAt: a.lastSyncAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

router.get("/email-accounts", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const accounts = await db
    .select()
    .from(emailAccountsTable)
    .where(eq(emailAccountsTable.userId, req.user!.id));
  res.json(accounts.map(formatAccount));
});

router.post("/email-accounts", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = ConnectEmailAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user!.id;
  const [account] = await db
    .insert(emailAccountsTable)
    .values({ userId, ...parsed.data })
    .returning();
  res.status(201).json(formatAccount(account));
});

router.delete("/email-accounts/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.id;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [deleted] = await db
    .delete(emailAccountsTable)
    .where(
      and(eq(emailAccountsTable.id, id), eq(emailAccountsTable.userId, userId)),
    )
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/email-accounts/:id/sync", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.id;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [account] = await db
    .select()
    .from(emailAccountsTable)
    .where(
      and(eq(emailAccountsTable.id, id), eq(emailAccountsTable.userId, userId)),
    );

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  await db
    .update(emailAccountsTable)
    .set({ lastSyncAt: new Date() })
    .where(eq(emailAccountsTable.id, id));

  const foundCount = Math.floor(Math.random() * 3) + 1;
  const importedDeliveries = [];

  for (let i = 0; i < foundCount; i++) {
    const carrier = CARRIERS[i % CARRIERS.length];
    const trackingNumber = MOCK_TRACKING_TEMPLATES[i % MOCK_TRACKING_TEMPLATES.length] + i;
    const mock = getMockTrackingStatus(carrier, trackingNumber);

    const [delivery] = await db
      .insert(deliveriesTable)
      .values({
        userId,
        carrier,
        trackingNumber,
        description: `Parsed from ${account.email}`,
        status: mock.status,
        estimatedDelivery: mock.estimatedDelivery,
        lastLocation: mock.lastLocation,
      })
      .returning();

    importedDeliveries.push({
      ...delivery,
      createdAt: delivery.createdAt.toISOString(),
      updatedAt: delivery.updatedAt.toISOString(),
      estimatedDelivery: delivery.estimatedDelivery ?? null,
      lastLocation: delivery.lastLocation ?? null,
      description: delivery.description ?? null,
    });
  }

  await db.insert(notificationsTable).values({
    userId,
    title: "Email Scan Complete",
    body: `Found ${foundCount} tracking number${foundCount > 1 ? "s" : ""} in ${account.email}`,
    type: "email_sync",
  });

  res.json({
    found: foundCount,
    imported: importedDeliveries.length,
    deliveries: importedDeliveries,
  });
});

export default router;
