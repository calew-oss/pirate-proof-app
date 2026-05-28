import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useGetDelivery,
  useGenerateAccessCode,
  useGetDeliveryInstructions,
  getGetDeliveryQueryKey,
} from "@workspace/api-client-react";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBadge } from "@/components/StatusBadge";
import { useColors } from "@/hooks/useColors";
import { useQueryClient } from "@tanstack/react-query";

const CARRIER_INFO: Record<string, { label: string; color: string }> = {
  amazon: { label: "Amazon", color: "#f59e0b" },
  ups: { label: "UPS", color: "#8B4513" },
  fedex: { label: "FedEx", color: "#4b0082" },
  usps: { label: "USPS", color: "#2563eb" },
  dhl: { label: "DHL", color: "#f59e0b" },
  other: { label: "Other", color: "#7a8899" },
};

const STATUS_STEPS = [
  { key: "pending", label: "Order Placed" },
  { key: "in_transit", label: "In Transit" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
];

const CODE_STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  active:  { color: "#22c55e", bg: "#22c55e18", label: "Active" },
  used:    { color: "#7a8899", bg: "#7a889920", label: "Used" },
  expired: { color: "#ef4444", bg: "#ef444415", label: "Expired" },
  none:    { color: "#7a8899", bg: "#7a889918", label: "None" },
};

export default function DeliveryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deliveryId = parseInt(id ?? "0", 10);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const [singleUse, setSingleUse] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);

  const { data: delivery, isLoading } = useGetDelivery(deliveryId, {
    query: { enabled: !!deliveryId } as any,
  });
  const { data: instructions } = useGetDeliveryInstructions(deliveryId, {
    query: { enabled: !!deliveryId && !!delivery?.accessCode } as any,
  });
  const { mutateAsync: generateCode } = useGenerateAccessCode();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === delivery?.status);

  const codeStyle = delivery?.codeStatus
    ? (CODE_STATUS_STYLE[delivery.codeStatus] ?? CODE_STATUS_STYLE.none)
    : CODE_STATUS_STYLE.none;

  async function handleGenerateCode() {
    setGeneratingCode(true);
    try {
      await generateCode({
        id: deliveryId,
        data: { singleUse },
      });
      await qc.invalidateQueries({ queryKey: getGetDeliveryQueryKey(deliveryId) });
    } catch {
      Alert.alert("Error", "Failed to generate access code.");
    } finally {
      setGeneratingCode(false);
    }
  }

  function handleCopyCode() {
    if (!delivery?.accessCode) return;
    Clipboard.setString(delivery.accessCode);
    Alert.alert("Copied", `Code ${delivery.accessCode} copied to clipboard.`);
  }

  function handleCopyInstructions() {
    if (!instructions?.message) return;
    Clipboard.setString(instructions.message);
    Alert.alert("Copied", "Delivery instructions copied to clipboard.");
  }

  async function handleShareInstructions() {
    const msg = instructions?.message ?? (delivery?.accessCode ? `Place package in Pirate Proof box. Enter code: ${delivery.accessCode}` : "No code assigned yet.");
    try {
      await Share.share({ message: msg });
    } catch {
      // user dismissed
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.navBar, { paddingTop: topPad + 8, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Package Detail</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 60 }} />
      ) : !delivery ? (
        <View style={styles.notFound}>
          <Feather name="package" size={40} color={colors.mutedForeground} />
          <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>Package not found</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 32) }]}
          showsVerticalScrollIndicator={false}
        >
          {(() => {
            const cfg = CARRIER_INFO[delivery.carrier] ?? CARRIER_INFO.other;
            return (
              <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <View style={[styles.carrierBadge, { backgroundColor: `${cfg.color}22`, borderRadius: colors.radius }]}>
                  <Feather name="truck" size={28} color={cfg.color} />
                </View>
                <Text style={[styles.carrierName, { color: colors.foreground }]}>{cfg.label}</Text>
                <Text style={[styles.trackingNum, { color: colors.mutedForeground }]}>
                  {delivery.trackingNumber}
                </Text>
                {delivery.description && (
                  <Text style={[styles.description, { color: colors.mutedForeground }]}>
                    {delivery.description}
                  </Text>
                )}
                <StatusBadge status={delivery.status} />
              </View>
            );
          })()}

          {/* ── Smart Access Code Card ─────────────────────── */}
          <View style={[styles.codeCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={styles.codeCardHeader}>
              <View style={styles.codeCardTitleRow}>
                <View style={[styles.codeIconCircle, { backgroundColor: "#f5a62318" }]}>
                  <Feather name="key" size={16} color="#f5a623" />
                </View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Smart Access Code</Text>
              </View>
              {delivery.accessCode && delivery.codeStatus !== "none" ? (
                <View style={[styles.codeStatusBadge, { backgroundColor: codeStyle.bg, borderRadius: 12 }]}>
                  <View style={[styles.codeStatusDot, { backgroundColor: codeStyle.color }]} />
                  <Text style={[styles.codeStatusLabel, { color: codeStyle.color }]}>{codeStyle.label}</Text>
                </View>
              ) : null}
            </View>

            {delivery.accessCode && delivery.codeStatus !== "none" ? (
              <>
                {/* Big code display */}
                <View style={[styles.codeBigBox, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <Text style={[styles.codeBig, { color: colors.foreground }]}>{delivery.accessCode}</Text>
                  {delivery.codeExpires ? (
                    <Text style={[styles.codeExpiry, { color: colors.mutedForeground }]}>
                      Expires {new Date(delivery.codeExpires).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  ) : null}
                  {delivery.codeSingleUse ? (
                    <View style={[styles.singleUsePill, { backgroundColor: "#f59e0b18" }]}>
                      <Feather name="zap" size={10} color="#f59e0b" />
                      <Text style={[styles.singleUsePillText, { color: "#f59e0b" }]}>Single-use</Text>
                    </View>
                  ) : null}
                </View>

                {/* Action buttons */}
                <View style={styles.codeActions}>
                  <TouchableOpacity style={[styles.codeActionBtn, { backgroundColor: colors.secondary, borderRadius: colors.radius }]} onPress={handleCopyCode}>
                    <Feather name="copy" size={14} color={colors.foreground} />
                    <Text style={[styles.codeActionText, { color: colors.foreground }]}>Copy Code</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.codeActionBtn, { backgroundColor: colors.secondary, borderRadius: colors.radius }]} onPress={handleShareInstructions}>
                    <Feather name="share-2" size={14} color={colors.foreground} />
                    <Text style={[styles.codeActionText, { color: colors.foreground }]}>Share</Text>
                  </TouchableOpacity>
                </View>

                {/* Delivery instructions */}
                {instructions?.message ? (
                  <TouchableOpacity
                    style={[styles.instructionsBox, { backgroundColor: "#f5a62310", borderColor: "#f5a62330", borderRadius: colors.radius }]}
                    onPress={handleCopyInstructions}
                    activeOpacity={0.7}
                  >
                    <View style={styles.instructionsRow}>
                      <Feather name="message-square" size={13} color="#f5a623" />
                      <Text style={[styles.instructionsLabel, { color: "#f5a623" }]}>Delivery Instructions</Text>
                      <Feather name="copy" size={11} color="#f5a623" style={{ marginLeft: "auto" }} />
                    </View>
                    <Text style={[styles.instructionsText, { color: colors.foreground }]}>
                      {instructions.message}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {/* Regenerate */}
                <View style={styles.regenRow}>
                  <View style={styles.singleUseToggleRow}>
                    <Text style={[styles.singleUseLabel, { color: colors.mutedForeground }]}>Single-use on regen</Text>
                    <Switch
                      value={singleUse}
                      onValueChange={setSingleUse}
                      trackColor={{ false: colors.secondary, true: "#f5a62360" }}
                      thumbColor={singleUse ? "#f5a623" : colors.mutedForeground}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.regenBtn, { backgroundColor: colors.secondary, borderRadius: colors.radius }]}
                    onPress={handleGenerateCode}
                    disabled={generatingCode}
                  >
                    <Feather name="refresh-cw" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.regenBtnText, { color: colors.mutedForeground }]}>
                      {generatingCode ? "Generating…" : "Regenerate Code"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {/* No code yet */}
                <Text style={[styles.noCodeText, { color: colors.mutedForeground }]}>
                  No access code assigned. Generate one to share with your courier — it will be programmed into your Pirate Proof lock automatically.
                </Text>

                <View style={styles.singleUseToggleRow}>
                  <Text style={[styles.singleUseLabel, { color: colors.mutedForeground }]}>Single-use code</Text>
                  <Switch
                    value={singleUse}
                    onValueChange={setSingleUse}
                    trackColor={{ false: colors.secondary, true: "#f5a62360" }}
                    thumbColor={singleUse ? "#f5a623" : colors.mutedForeground}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.generateBtn, { backgroundColor: "#f5a623", borderRadius: colors.radius }]}
                  onPress={handleGenerateCode}
                  disabled={generatingCode}
                >
                  <Feather name="key" size={16} color="#000" />
                  <Text style={styles.generateBtnText}>
                    {generatingCode ? "Generating…" : "Generate Access Code"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ── Tracking Timeline ─────────────────────────── */}
          <View style={[styles.timelineCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Tracking Timeline</Text>
            {STATUS_STEPS.map((step, idx) => {
              const isCompleted = currentStepIndex >= idx;
              const isCurrent = currentStepIndex === idx;
              const isLast = idx === STATUS_STEPS.length - 1;
              return (
                <View key={step.key} style={styles.stepRow}>
                  <View style={styles.stepLeft}>
                    <View
                      style={[
                        styles.stepDot,
                        {
                          backgroundColor: isCompleted ? colors.primary : colors.border,
                          borderColor: isCurrent ? colors.primary : "transparent",
                          borderWidth: isCurrent ? 3 : 0,
                        },
                      ]}
                    />
                    {!isLast && (
                      <View style={[styles.stepLine, { backgroundColor: isCompleted && currentStepIndex > idx ? colors.primary : colors.border }]} />
                    )}
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={[styles.stepLabel, { color: isCompleted ? colors.foreground : colors.mutedForeground, fontFamily: isCurrent ? "Inter_700Bold" : "Inter_400Regular" }]}>
                      {step.label}
                    </Text>
                    {isCurrent && delivery.lastLocation && (
                      <View style={styles.locationRow}>
                        <Feather name="map-pin" size={11} color={colors.primary} />
                        <Text style={[styles.locationText, { color: colors.primary }]}>{delivery.lastLocation}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* ── Details ───────────────────────────────────── */}
          <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Details</Text>
            {[
              { label: "Carrier", value: (CARRIER_INFO[delivery.carrier] ?? CARRIER_INFO.other).label },
              { label: "Status", value: delivery.status.replace(/_/g, " ") },
              { label: "Est. Delivery", value: delivery.estimatedDelivery ?? "Unknown" },
              { label: "Last Location", value: delivery.lastLocation ?? "Unknown" },
              { label: "Added", value: new Date(delivery.createdAt).toLocaleDateString() },
              { label: "Updated", value: new Date(delivery.updatedAt).toLocaleDateString() },
            ].map((item, idx, arr) => (
              <View key={item.label}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                  <Text style={[styles.detailValue, { color: colors.foreground }]}>{item.value}</Text>
                </View>
                {idx < arr.length - 1 && <View style={[styles.rowDiv, { backgroundColor: colors.border }]} />}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  navTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  content: { padding: 18, gap: 16 },
  heroCard: { alignItems: "center", padding: 24, gap: 8, borderWidth: 1 },
  carrierBadge: { width: 64, height: 64, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  carrierName: { fontSize: 20, fontFamily: "Inter_700Bold" },
  trackingNum: { fontSize: 13, fontFamily: "Inter_400Regular" },
  description: { fontSize: 13, fontFamily: "Inter_400Regular" },

  // Access code card
  codeCard: { padding: 18, borderWidth: 1, gap: 14 },
  codeCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  codeCardTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  codeIconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  codeStatusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4 },
  codeStatusDot: { width: 6, height: 6, borderRadius: 3 },
  codeStatusLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  codeBigBox: { borderWidth: 1, borderRadius: 12, padding: 20, alignItems: "center", gap: 6 },
  codeBig: { fontSize: 38, fontFamily: "Inter_700Bold", letterSpacing: 8 },
  codeExpiry: { fontSize: 12, fontFamily: "Inter_400Regular" },
  singleUsePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginTop: 2 },
  singleUsePillText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  codeActions: { flexDirection: "row", gap: 10 },
  codeActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11 },
  codeActionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  instructionsBox: { borderWidth: 1, padding: 14, gap: 8 },
  instructionsRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  instructionsLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  instructionsText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  regenRow: { gap: 10 },
  singleUseToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  singleUseLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  regenBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11 },
  regenBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  noCodeText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14 },
  generateBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#000" },

  // Timeline
  timelineCard: { padding: 18, borderWidth: 1, gap: 0 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 16 },
  stepRow: { flexDirection: "row", gap: 14 },
  stepLeft: { alignItems: "center", width: 16 },
  stepDot: { width: 16, height: 16, borderRadius: 8, zIndex: 1 },
  stepLine: { width: 2, flex: 1, marginVertical: 4, marginBottom: -8 },
  stepContent: { flex: 1, paddingBottom: 20, paddingTop: 0 },
  stepLabel: { fontSize: 14, marginTop: -2 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  locationText: { fontSize: 11, fontFamily: "Inter_400Regular" },

  // Detail table
  detailCard: { padding: 18, borderWidth: 1 },
  detailRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  detailLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  detailValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right", flex: 1, marginLeft: 16, textTransform: "capitalize" },
  rowDiv: { height: 1 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  notFoundText: { fontSize: 16, fontFamily: "Inter_400Regular" },
});
