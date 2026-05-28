import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetLockStatusQueryKey,
  getListDeliveriesQueryKey,
  getListPinsQueryKey,
  useDeletePin,
  useGetLockStatus,
  useGetLockLogs,
  useListDeliveries,
  useListPins,
  useRevokeAccessCode,
  useSetDeliveryMode,
  useToggleLock,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddPinSheet } from "@/components/AddPinSheet";
import { useColors } from "@/hooks/useColors";

const CARRIER_ICONS: Record<string, { icon: keyof typeof Feather.glyphMap; color: string; label: string }> = {
  amazon: { icon: "shopping-bag", color: "#FF9900", label: "Amazon" },
  ups:    { icon: "truck",        color: "#C8873A", label: "UPS" },
  fedex:  { icon: "zap",          color: "#7C3AED", label: "FedEx" },
  usps:   { icon: "mail",         color: "#2563eb", label: "USPS" },
  dhl:    { icon: "package",      color: "#FFCC00", label: "DHL" },
  other:  { icon: "box",          color: "#7a8899", label: "Other" },
};

const PIN_TYPE_COLORS: Record<string, string> = {
  permanent: "#3b82f6",
  one_time: "#a855f7",
  time_restricted: "#f59e0b",
  delivery: "#22c55e",
};

const PIN_TYPE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  permanent: "key",
  one_time: "zap",
  time_restricted: "clock",
  delivery: "truck",
};

const EVENT_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; color: string; label: string }> = {
  locked:                  { icon: "lock",     color: "#22c55e", label: "Locked" },
  unlocked:                { icon: "unlock",   color: "#f59e0b", label: "Unlocked" },
  pin_used:                { icon: "key",      color: "#3b82f6", label: "PIN Used" },
  access_code_used:        { icon: "key",      color: "#f5a623", label: "Access Code" },
  delivery_mode_enabled:   { icon: "truck",    color: "#3b82f6", label: "Delivery Mode On" },
  delivery_mode_disabled:  { icon: "truck",    color: "#7a8899", label: "Delivery Mode Off" },
};

function LockHeroIcon({ isLocked, toggling }: { isLocked: boolean; toggling: boolean }) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(isLocked ? 1 : 1.05, { damping: 10, stiffness: 120 });
    if (!isLocked) {
      glow.value = withRepeat(
        withSequence(withTiming(1, { duration: 1200 }), withTiming(0.3, { duration: 1200 })),
        -1,
      );
    } else {
      glow.value = withTiming(0, { duration: 300 });
    }
  }, [isLocked]);

  const containerStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const color = isLocked ? colors.success : colors.warning;

  return (
    <Animated.View style={[styles.heroIconWrap, containerStyle]}>
      {!isLocked && (
        <Animated.View style={[styles.glowRing, { borderColor: color, borderRadius: 50 }, glowStyle]} />
      )}
      <View style={[styles.heroIconInner, { backgroundColor: `${color}20`, borderRadius: 40 }]}>
        {toggling ? (
          <ActivityIndicator color={color} size="large" />
        ) : (
          <Feather name={isLocked ? "lock" : "unlock"} size={52} color={color} />
        )}
      </View>
    </Animated.View>
  );
}

function CodeDigit({ char }: { char: string }) {
  const colors = useColors();
  return (
    <View style={[styles.codeDigit, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Text style={[styles.codeDigitText, { color: colors.foreground }]}>{char}</Text>
    </View>
  );
}

export default function LockScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [showAddPin, setShowAddPin] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const { data: lockStatus, isLoading: loadingLock } = useGetLockStatus();
  const { data: pins, isLoading: loadingPins } = useListPins();
  const { data: logs } = useGetLockLogs();
  const { data: deliveries } = useListDeliveries();
  const { mutate: toggleLock, isPending: togglingLock } = useToggleLock();
  const { mutate: deletePin } = useDeletePin();
  const { mutate: setDeliveryMode } = useSetDeliveryMode();
  const { mutateAsync: revokeCode } = useRevokeAccessCode();

  const activeCodes = (deliveries ?? []).filter(
    (d) => d.codeStatus === "active" && d.accessCode,
  );

  const codeLogs = (logs ?? []).filter((e) => e.codeUsed);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: getGetLockStatusQueryKey() }),
      qc.invalidateQueries({ queryKey: getListPinsQueryKey() }),
      qc.invalidateQueries({ queryKey: getListDeliveriesQueryKey() }),
    ]);
    setRefreshing(false);
  }

  const handleToggle = () => {
    if (!lockStatus) return;
    const action = lockStatus.isLocked ? "unlock" : "lock";
    Haptics.impactAsync(action === "unlock" ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
    toggleLock(
      { data: { action } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetLockStatusQueryKey() }) },
    );
  };

  const handleDeliveryMode = (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDeliveryMode(
      { data: { enabled: val } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetLockStatusQueryKey() }) },
    );
  };

  const handleDeletePin = (id: number) => {
    Alert.alert("Remove PIN", "This PIN will no longer grant access to the box.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          deletePin({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListPinsQueryKey() }) });
        },
      },
    ]);
  };

  const handleRevokeCode = (deliveryId: number, code: string) => {
    Alert.alert(
      "Revoke Code",
      `Code ${code} will be deactivated immediately. Your courier won't be able to use it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            setRevokingId(deliveryId);
            try {
              await revokeCode({ id: deliveryId });
              await Promise.all([
                qc.invalidateQueries({ queryKey: getListDeliveriesQueryKey() }),
                qc.invalidateQueries({ queryKey: getListPinsQueryKey() }),
              ]);
            } catch {
              Alert.alert("Error", "Failed to revoke code. Try again.");
            } finally {
              setRevokingId(null);
            }
          },
        },
      ],
    );
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const isUnlocked = lockStatus && !lockStatus.isLocked;
  const batteryColor = (lockStatus?.batteryLevel ?? 100) > 20 ? colors.success : colors.destructive;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 16, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <Animated.Text entering={FadeInDown.duration(350)} style={[styles.title, { color: colors.foreground }]}>
          Lock Control
        </Animated.Text>

        {loadingLock ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 60 }} />
        ) : lockStatus ? (
          <>
            {/* ── Hero card ──────────────────────────────────── */}
            <Animated.View
              entering={FadeInDown.delay(60).springify().damping(14)}
              style={[
                styles.heroCard,
                {
                  backgroundColor: isUnlocked ? `${colors.warning}10` : colors.card,
                  borderColor: isUnlocked ? colors.warning : colors.border,
                  borderRadius: colors.radius * 1.5,
                },
              ]}
            >
              <LockHeroIcon isLocked={!isUnlocked} toggling={togglingLock} />
              <Text style={[styles.lockState, { color: colors.foreground }]}>
                {isUnlocked ? "Unlocked" : "Secured"}
              </Text>
              <Text style={[styles.lockTime, { color: colors.mutedForeground }]}>
                {new Date(lockStatus.lastActionAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </Text>

              <View style={styles.statsRow}>
                <View style={[styles.statPill, { backgroundColor: `${batteryColor}18`, borderRadius: 20 }]}>
                  <Feather name="battery" size={12} color={batteryColor} />
                  <Text style={[styles.statPillText, { color: batteryColor }]}>{lockStatus.batteryLevel}%</Text>
                </View>
                <View style={[styles.statPill, { backgroundColor: `${colors.info}18`, borderRadius: 20 }]}>
                  <Feather name="wifi" size={12} color={colors.info} />
                  <Text style={[styles.statPillText, { color: colors.info }]}>Connected</Text>
                </View>
                {activeCodes.length > 0 && (
                  <View style={[styles.statPill, { backgroundColor: "#22c55e15", borderRadius: 20 }]}>
                    <Feather name="key" size={12} color="#22c55e" />
                    <Text style={[styles.statPillText, { color: "#22c55e" }]}>
                      {activeCodes.length} active code{activeCodes.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.lockBtn,
                  {
                    backgroundColor: isUnlocked ? colors.success : colors.warning,
                    borderRadius: colors.radius,
                    opacity: togglingLock ? 0.6 : 1,
                  },
                ]}
                onPress={handleToggle}
                disabled={togglingLock}
                activeOpacity={0.8}
              >
                {togglingLock ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name={isUnlocked ? "lock" : "unlock"} size={18} color="#fff" />
                    <Text style={styles.lockBtnText}>{isUnlocked ? "Lock Box" : "Unlock Box"}</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* ── Delivery mode ──────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(120).duration(350)}>
              <View
                style={[
                  styles.delivModeCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: lockStatus.deliveryModeEnabled ? colors.info : colors.border,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <View
                  style={[
                    styles.delivModeIcon,
                    {
                      backgroundColor: lockStatus.deliveryModeEnabled ? `${colors.info}20` : `${colors.mutedForeground}15`,
                      borderRadius: 10,
                    },
                  ]}
                >
                  <Feather name="truck" size={18} color={lockStatus.deliveryModeEnabled ? colors.info : colors.mutedForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.delivModeTitle, { color: colors.foreground }]}>Delivery Mode</Text>
                  <Text style={[styles.delivModeSub, { color: colors.mutedForeground }]}>
                    {lockStatus.deliveryModeEnabled
                      ? `Auto-unlock on arrival · re-locks in ${lockStatus.deliveryModeTimeout} min`
                      : "Auto-unlock when packages arrive"}
                  </Text>
                </View>
                <Switch
                  value={lockStatus.deliveryModeEnabled}
                  onValueChange={handleDeliveryMode}
                  trackColor={{ true: colors.info, false: colors.border }}
                  thumbColor="#fff"
                />
              </View>
            </Animated.View>

            {/* ── Active Delivery Codes ──────────────────────── */}
            <Animated.View entering={FadeInDown.delay(180).duration(350)} style={styles.section}>
              <View style={styles.sectionRow}>
                <View style={styles.sectionTitleRow}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Delivery Codes</Text>
                  {activeCodes.length > 0 && (
                    <View style={[styles.countBadge, { backgroundColor: "#22c55e18" }]}>
                      <Text style={[styles.countBadgeText, { color: "#22c55e" }]}>{activeCodes.length} active</Text>
                    </View>
                  )}
                </View>
              </View>

              {activeCodes.length === 0 ? (
                <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <View style={[styles.emptyIcon, { backgroundColor: "#22c55e12", borderRadius: 20 }]}>
                    <Feather name="key" size={22} color="#22c55e" />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No active codes</Text>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    Codes are auto-generated when a package goes out for delivery. Tap any delivery to create one manually.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {activeCodes.map((d, i) => {
                    const carrier = CARRIER_ICONS[d.carrier] ?? CARRIER_ICONS.other;
                    const isRevoking = revokingId === d.id;
                    const digits = (d.accessCode ?? "").split("");
                    const expiry = d.codeExpires
                      ? new Date(d.codeExpires).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                      : null;
                    return (
                      <Animated.View key={d.id} entering={FadeInRight.delay(i * 60).springify().damping(14)}>
                        <View
                          style={[
                            styles.codeCard,
                            { backgroundColor: colors.card, borderColor: "#22c55e30", borderRadius: colors.radius },
                          ]}
                        >
                          {/* Header */}
                          <View style={styles.codeCardHeader}>
                            <View style={[styles.carrierIconBox, { backgroundColor: `${carrier.color}18`, borderRadius: 8 }]}>
                              <Feather name={carrier.icon} size={15} color={carrier.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.codeCardCarrier, { color: colors.foreground }]}>{carrier.label}</Text>
                              <Text style={[styles.codeCardTracking, { color: colors.mutedForeground }]}>
                                ···{d.trackingNumber.slice(-8)}
                              </Text>
                            </View>
                            <View style={[styles.activePill, { backgroundColor: "#22c55e15" }]}>
                              <View style={styles.activeDot} />
                              <Text style={styles.activePillText}>Active</Text>
                            </View>
                          </View>

                          {/* Code digits */}
                          <View style={styles.codeDigitsRow}>
                            {digits.map((ch, idx) => (
                              <CodeDigit key={idx} char={ch} />
                            ))}
                          </View>

                          {/* Expiry + revoke */}
                          <View style={styles.codeCardFooter}>
                            {expiry ? (
                              <View style={styles.expiryRow}>
                                <Feather name="clock" size={11} color={colors.mutedForeground} />
                                <Text style={[styles.expiryText, { color: colors.mutedForeground }]}>
                                  Expires {expiry}
                                </Text>
                              </View>
                            ) : <View />}
                            <TouchableOpacity
                              style={[styles.revokeBtn, { borderColor: `${colors.destructive}40`, opacity: isRevoking ? 0.5 : 1 }]}
                              onPress={() => handleRevokeCode(d.id, d.accessCode!)}
                              disabled={isRevoking}
                            >
                              {isRevoking ? (
                                <ActivityIndicator size="small" color={colors.destructive} />
                              ) : (
                                <>
                                  <Feather name="x-circle" size={12} color={colors.destructive} />
                                  <Text style={[styles.revokeBtnText, { color: colors.destructive }]}>Revoke</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      </Animated.View>
                    );
                  })}
                </View>
              )}
            </Animated.View>

            {/* ── Access PINs ────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(240).duration(350)} style={styles.section}>
              <View style={styles.sectionRow}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Access PINs</Text>
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: 8 }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowAddPin(true);
                  }}
                >
                  <Feather name="plus" size={13} color={colors.primaryForeground} />
                  <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>Add PIN</Text>
                </TouchableOpacity>
              </View>

              {loadingPins ? (
                <ActivityIndicator color={colors.primary} />
              ) : (pins ?? []).length === 0 ? (
                <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}12`, borderRadius: 20 }]}>
                    <Feather name="key" size={22} color={colors.primary} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No PINs configured</Text>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    Add permanent, one-time, or time-restricted PINs for family, guests, or couriers.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {(pins ?? []).map((pin, i) => {
                    const tc = PIN_TYPE_COLORS[pin.type] ?? colors.primary;
                    const ic = PIN_TYPE_ICONS[pin.type] ?? "key";
                    return (
                      <Animated.View key={pin.id} entering={FadeInDown.delay(i * 40).duration(280)}>
                        <View
                          style={[
                            styles.pinRow,
                            { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
                          ]}
                        >
                          <View style={[styles.pinIcon, { backgroundColor: `${tc}20`, borderRadius: 8 }]}>
                            <Feather name={ic} size={15} color={tc} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.pinLabel, { color: colors.foreground }]}>{pin.label}</Text>
                            <View style={styles.pinMeta}>
                              <View style={[styles.typeBadge, { backgroundColor: `${tc}18`, borderRadius: 4 }]}>
                                <Text style={[styles.typeBadgeText, { color: tc }]}>{pin.type.replace(/_/g, " ")}</Text>
                              </View>
                              <Text style={[styles.pinUse, { color: colors.mutedForeground }]}>
                                {pin.usageCount} use{pin.usageCount !== 1 ? "s" : ""}
                              </Text>
                            </View>
                          </View>
                          <Switch
                            value={pin.isActive}
                            onValueChange={() => {}}
                            trackColor={{ true: colors.primary, false: colors.border }}
                            thumbColor="#fff"
                          />
                          <TouchableOpacity onPress={() => handleDeletePin(pin.id)} style={styles.deleteBtn}>
                            <Feather name="trash-2" size={14} color={colors.destructive} />
                          </TouchableOpacity>
                        </View>
                      </Animated.View>
                    );
                  })}
                </View>
              )}
            </Animated.View>

            {/* ── Code Entry Log ─────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(300).duration(350)} style={styles.section}>
              <View style={styles.sectionRow}>
                <View style={styles.sectionTitleRow}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Access Log</Text>
                  {codeLogs.length > 0 && (
                    <View style={[styles.countBadge, { backgroundColor: "#f5a62318" }]}>
                      <Text style={[styles.countBadgeText, { color: "#f5a623" }]}>{codeLogs.length} code entr{codeLogs.length !== 1 ? "ies" : "y"}</Text>
                    </View>
                  )}
                </View>
              </View>

              {(logs ?? []).length === 0 ? (
                <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <View style={[styles.emptyIcon, { backgroundColor: `${colors.mutedForeground}12`, borderRadius: 20 }]}>
                    <Feather name="activity" size={22} color={colors.mutedForeground} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No activity yet</Text>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    Lock/unlock events, PIN uses, and delivery code entries will appear here.
                  </Text>
                </View>
              ) : (
                <View style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                  {(logs ?? []).slice(0, 20).map((evt, i, arr) => {
                    const ec = EVENT_CONFIG[evt.action] ?? { icon: "activity" as const, color: colors.mutedForeground, label: evt.action };
                    const isLast = i === Math.min(arr.length, 20) - 1;
                    const isCodeEntry = !!evt.codeUsed;
                    return (
                      <View
                        key={evt.id}
                        style={[
                          styles.eventRow,
                          !isLast && { borderBottomColor: colors.border, borderBottomWidth: 1 },
                          isCodeEntry && { backgroundColor: "#f5a62308" },
                        ]}
                      >
                        <View style={[styles.eventIcon, { backgroundColor: `${ec.color}20`, borderRadius: 8 }]}>
                          <Feather name={ec.icon} size={13} color={ec.color} />
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={[styles.eventAction, { color: colors.foreground }]}>
                            {ec.label}
                            {evt.pinLabel ? ` · ${evt.pinLabel}` : ""}
                          </Text>
                          {isCodeEntry && (
                            <View style={styles.codeEntryRow}>
                              <View style={[styles.codeEntryPill, { backgroundColor: "#f5a62318", borderColor: "#f5a62330" }]}>
                                <Feather name="key" size={9} color="#f5a623" />
                                <Text style={styles.codeEntryText}>{evt.codeUsed}</Text>
                              </View>
                              {evt.deliveryId && (
                                <Text style={[styles.deliveryRef, { color: colors.mutedForeground }]}>
                                  · Delivery #{evt.deliveryId}
                                </Text>
                              )}
                            </View>
                          )}
                          <Text style={[styles.eventTime, { color: colors.mutedForeground }]}>
                            {new Date(evt.occurredAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                          </Text>
                        </View>
                        <View style={[styles.sourceBadge, { backgroundColor: `${colors.mutedForeground}12`, borderRadius: 4 }]}>
                          <Text style={[styles.sourceText, { color: colors.mutedForeground }]}>{evt.triggeredBy}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </Animated.View>
          </>
        ) : (
          <View style={styles.offlineWrap}>
            <View style={[styles.offlineBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Feather name="wifi-off" size={36} color={colors.mutedForeground} />
              <Text style={[styles.offlineTitle, { color: colors.foreground }]}>Lock Offline</Text>
              <Text style={[styles.offlineText, { color: colors.mutedForeground }]}>
                Pull down to retry connection with your Pirate Proof box.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <AddPinSheet visible={showAddPin} onClose={() => setShowAddPin(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 18, gap: 20 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },

  // Hero
  heroCard: { alignItems: "center", padding: 28, gap: 10, borderWidth: 1 },
  heroIconWrap: { width: 120, height: 120, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  glowRing: { position: "absolute", width: 120, height: 120, borderRadius: 60, borderWidth: 2 },
  heroIconInner: { width: 100, height: 100, alignItems: "center", justifyContent: "center" },
  lockState: { fontSize: 30, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  lockTime: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statsRow: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap", justifyContent: "center" },
  statPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5 },
  statPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  lockBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 32, paddingVertical: 14, marginTop: 8,
    width: "100%", justifyContent: "center",
  },
  lockBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },

  // Delivery mode
  delivModeCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderWidth: 1 },
  delivModeIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  delivModeTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  delivModeSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },

  // Sections
  section: { gap: 12 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  countBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  countBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // Delivery code cards
  codeCard: { borderWidth: 1, padding: 16, gap: 14 },
  codeCardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  carrierIconBox: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  codeCardCarrier: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  codeCardTracking: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  activePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" },
  activePillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#22c55e" },
  codeDigitsRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  codeDigit: { width: 42, height: 52, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  codeDigitText: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: 0 },
  codeCardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  expiryRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  expiryText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  revokeBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1,
  },
  revokeBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // PINs
  pinRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1 },
  pinIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  pinLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  pinMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  pinUse: { fontSize: 11, fontFamily: "Inter_400Regular" },
  deleteBtn: { padding: 6 },

  // Empty states
  empty: { alignItems: "center", padding: 28, gap: 8, borderWidth: 1 },
  emptyIcon: { width: 52, height: 52, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18, maxWidth: 260 },

  // Access log
  activityCard: { borderWidth: 1, overflow: "hidden" },
  eventRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14 },
  eventIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", marginTop: 1 },
  eventAction: { fontSize: 13, fontFamily: "Inter_500Medium" },
  codeEntryRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  codeEntryPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  codeEntryText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#f5a623", letterSpacing: 1 },
  deliveryRef: { fontSize: 11, fontFamily: "Inter_400Regular" },
  eventTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  sourceBadge: { paddingHorizontal: 6, paddingVertical: 3, marginTop: 2 },
  sourceText: { fontSize: 10, fontFamily: "Inter_400Regular", textTransform: "capitalize" },

  // Offline
  offlineWrap: { flex: 1, paddingTop: 40 },
  offlineBox: { alignItems: "center", padding: 40, borderWidth: 1, gap: 12 },
  offlineTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  offlineText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
