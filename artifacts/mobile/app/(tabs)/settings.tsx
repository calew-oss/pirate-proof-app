import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetLockStatusQueryKey,
  getListEmailAccountsQueryKey,
  useConnectEmailAccount,
  useDeleteEmailAccount,
  useGetLockStatus,
  useListEmailAccounts,
  useSetDeliveryMode,
  useSyncEmailAccount,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const PROVIDERS = [
  { value: "gmail", label: "Gmail", icon: "mail" },
  { value: "outlook", label: "Outlook", icon: "mail" },
  { value: "other", label: "Other", icon: "inbox" },
] as const;

const TIMEOUT_OPTIONS = [
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hr", value: 60 },
];

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const qc = useQueryClient();

  const { data: emailAccounts, isLoading: loadingEmails } = useListEmailAccounts();
  const { data: lockStatus } = useGetLockStatus();
  const { mutate: connectEmail, isPending: connecting } = useConnectEmailAccount();
  const { mutate: disconnectEmail } = useDeleteEmailAccount();
  const { mutate: syncEmail, isPending: syncing } = useSyncEmailAccount();
  const { mutate: setDeliveryMode } = useSetDeliveryMode();

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [provider, setProvider] = useState<string>("gmail");
  const [emailError, setEmailError] = useState("");

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const handleConnect = () => {
    if (!emailInput.trim() || !emailInput.includes("@")) {
      setEmailError("Enter a valid email address");
      return;
    }
    connectEmail(
      { data: { email: emailInput.trim(), provider: provider as any } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListEmailAccountsQueryKey() });
          setEmailInput("");
          setProvider("gmail");
          setShowConnectModal(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onError: () => setEmailError("Failed to connect. Try again."),
      },
    );
  };

  const handleDisconnect = (id: number, email: string) => {
    Alert.alert("Disconnect", `Remove ${email}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          disconnectEmail({ id }, {
            onSuccess: () => qc.invalidateQueries({ queryKey: getListEmailAccountsQueryKey() }),
          }),
      },
    ]);
  };

  const handleSync = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    syncEmail({ id }, {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getListEmailAccountsQueryKey() });
        Alert.alert("Scan Complete", `Found ${data.found} tracking numbers, imported ${data.imported}.`);
      },
    });
  };

  const handleSetTimeout = (minutes: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDeliveryMode(
      { data: { enabled: lockStatus?.deliveryModeEnabled ?? false, timeoutMinutes: minutes } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetLockStatusQueryKey() }) },
    );
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  const currentTimeout = lockStatus?.deliveryModeTimeout ?? 30;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 16, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text entering={FadeInDown.duration(350)} style={[styles.title, { color: colors.foreground }]}>
          Settings
        </Animated.Text>

        {/* Profile card */}
        <Animated.View entering={FadeInDown.delay(60).duration(350)}>
          <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={[styles.avatar, { backgroundColor: `${colors.primary}30` }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {user?.name?.charAt(0).toUpperCase() ?? "?"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileName, { color: colors.foreground }]}>{user?.name}</Text>
              <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>{user?.email}</Text>
            </View>
            <View style={[styles.versionBadge, { backgroundColor: `${colors.primary}15` }]}>
              <Text style={[styles.versionBadgeText, { color: colors.primary }]}>v1.0</Text>
            </View>
          </View>
        </Animated.View>

        {/* Connected Emails */}
        <Animated.View entering={FadeInDown.delay(100).duration(350)} style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CONNECTED EMAILS</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            {loadingEmails ? (
              <ActivityIndicator color={colors.primary} style={{ padding: 16 }} />
            ) : (emailAccounts ?? []).length === 0 ? (
              <View style={styles.emptyRow}>
                <Feather name="mail" size={18} color={colors.mutedForeground} />
                <Text style={[styles.emptyRowText, { color: colors.mutedForeground }]}>No emails connected</Text>
              </View>
            ) : (
              (emailAccounts ?? []).map((acct, idx) => (
                <View key={acct.id}>
                  {idx > 0 && <View style={[styles.rowDiv, { backgroundColor: colors.border }]} />}
                  <View style={styles.emailRow}>
                    <View style={[styles.emailProviderDot, { backgroundColor: `${colors.primary}20` }]}>
                      <Feather name="mail" size={14} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.emailAddress, { color: colors.foreground }]}>{acct.email}</Text>
                      <Text style={[styles.emailMeta, { color: colors.mutedForeground }]}>
                        {acct.provider} · {acct.lastSyncAt ? `Synced ${new Date(acct.lastSyncAt).toLocaleDateString()}` : "Never synced"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.syncBtn, { borderColor: colors.border, borderRadius: 8 }]}
                      onPress={() => handleSync(acct.id)}
                      disabled={syncing}
                    >
                      {syncing ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Feather name="refresh-cw" size={14} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDisconnect(acct.id, acct.email)} style={{ padding: 4 }}>
                      <Feather name="x" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
            <View style={[styles.rowDiv, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.addEmailBtn} onPress={() => setShowConnectModal(true)}>
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={[styles.addEmailText, { color: colors.primary }]}>Connect Email</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
            We scan for shipping confirmation emails to auto-import tracking numbers.
          </Text>
        </Animated.View>

        {/* Delivery Mode */}
        <Animated.View entering={FadeInDown.delay(150).duration(350)} style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DELIVERY MODE</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            {/* Enable toggle */}
            <View style={styles.settingRow}>
              <View style={[styles.settingIconBox, { backgroundColor: `${colors.info}18`, borderRadius: 8 }]}>
                <Feather name="truck" size={15} color={colors.info} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: colors.foreground }]}>Auto-unlock on arrival</Text>
                <Text style={[styles.settingSubLabel, { color: colors.mutedForeground }]}>
                  Box unlocks when a package is out for delivery
                </Text>
              </View>
              <Switch
                value={lockStatus?.deliveryModeEnabled ?? false}
                onValueChange={(val) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setDeliveryMode(
                    { data: { enabled: val, timeoutMinutes: currentTimeout } },
                    { onSuccess: () => qc.invalidateQueries({ queryKey: getGetLockStatusQueryKey() }) },
                  );
                }}
                trackColor={{ true: colors.info, false: colors.border }}
                thumbColor="#fff"
              />
            </View>

            <View style={[styles.rowDiv, { backgroundColor: colors.border }]} />

            {/* Timeout selector */}
            <View style={styles.timeoutSection}>
              <View style={styles.timeoutHeader}>
                <View style={[styles.settingIconBox, { backgroundColor: "#f59e0b18", borderRadius: 8 }]}>
                  <Feather name="clock" size={15} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: colors.foreground }]}>Auto-relock after</Text>
                  <Text style={[styles.settingSubLabel, { color: colors.mutedForeground }]}>
                    Box re-locks automatically after delivery
                  </Text>
                </View>
              </View>
              <View style={styles.timeoutChips}>
                {TIMEOUT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.timeoutChip,
                      {
                        backgroundColor: currentTimeout === opt.value ? colors.primary : colors.secondary,
                        borderRadius: colors.radius,
                      },
                    ]}
                    onPress={() => handleSetTimeout(opt.value)}
                  >
                    <Text style={[
                      styles.timeoutChipText,
                      { color: currentTimeout === opt.value ? colors.primaryForeground : colors.mutedForeground },
                    ]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Notifications */}
        <Animated.View entering={FadeInDown.delay(200).duration(350)} style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>NOTIFICATIONS</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            {[
              { icon: "package" as const, color: "#3b82f6", label: "Delivery updates", sub: "Package status changes" },
              { icon: "lock" as const,    color: "#22c55e", label: "Lock events",       sub: "Box locked or unlocked" },
              { icon: "key" as const,     color: "#f5a623", label: "Access code use",   sub: "When a delivery code is entered" },
            ].map((item, idx) => (
              <View key={item.label}>
                {idx > 0 && <View style={[styles.rowDiv, { backgroundColor: colors.border }]} />}
                <View style={styles.settingRow}>
                  <View style={[styles.settingIconBox, { backgroundColor: `${item.color}18`, borderRadius: 8 }]}>
                    <Feather name={item.icon} size={15} color={item.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingLabel, { color: colors.foreground }]}>{item.label}</Text>
                    <Text style={[styles.settingSubLabel, { color: colors.mutedForeground }]}>{item.sub}</Text>
                  </View>
                  <Switch
                    value={true}
                    onValueChange={() => {}}
                    trackColor={{ true: item.color, false: colors.border }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            ))}
          </View>
          <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
            Manage notification permissions in your device settings.
          </Text>
        </Animated.View>

        {/* About */}
        <Animated.View entering={FadeInDown.delay(250).duration(350)} style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ABOUT</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            {[
              { label: "Version", value: "1.0.0", icon: "info" as const, color: colors.mutedForeground },
              { label: "Support", value: "support@pirateproof.app", icon: "help-circle" as const, color: colors.mutedForeground },
              { label: "Privacy Policy", value: "", icon: "shield" as const, color: colors.primary },
              { label: "Terms of Service", value: "", icon: "file-text" as const, color: colors.primary },
            ].map((item, idx, arr) => (
              <View key={item.label}>
                {idx > 0 && <View style={[styles.rowDiv, { backgroundColor: colors.border }]} />}
                <View style={styles.settingRow}>
                  <View style={[styles.settingIconBox, { backgroundColor: `${item.color}15`, borderRadius: 8 }]}>
                    <Feather name={item.icon} size={15} color={item.color} />
                  </View>
                  <Text style={[styles.settingLabelFull, { color: colors.foreground }]}>{item.label}</Text>
                  {item.value ? (
                    <Text style={[styles.settingValue, { color: colors.mutedForeground }]}>{item.value}</Text>
                  ) : (
                    <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
                  )}
                </View>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Sign out */}
        <Animated.View entering={FadeInDown.delay(300).duration(350)}>
          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: `${colors.destructive}18`, borderColor: `${colors.destructive}40`, borderRadius: colors.radius }]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Feather name="log-out" size={16} color={colors.destructive} />
            <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign Out</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* Connect Email Modal */}
      <Modal visible={showConnectModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <Pressable style={styles.overlay} onPress={() => setShowConnectModal(false)} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + 16,
              borderTopLeftRadius: colors.radius * 2,
              borderTopRightRadius: colors.radius * 2,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.modalTitleRow}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Connect Email</Text>
            <TouchableOpacity onPress={() => setShowConnectModal(false)}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
            We'll scan for shipping confirmation emails to auto-import tracking numbers.
          </Text>

          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Provider</Text>
          <View style={styles.providerRow}>
            {PROVIDERS.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.providerChip,
                  { backgroundColor: provider === p.value ? colors.primary : colors.secondary, borderRadius: colors.radius },
                ]}
                onPress={() => setProvider(p.value)}
              >
                <Text style={[styles.providerChipText, { color: provider === p.value ? colors.primaryForeground : colors.mutedForeground }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Email Address</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.input,
                color: colors.foreground,
                borderColor: emailError ? colors.destructive : colors.border,
                borderRadius: colors.radius,
              },
            ]}
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            value={emailInput}
            onChangeText={(t) => { setEmailInput(t); setEmailError(""); }}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {emailError ? <Text style={[styles.emailError, { color: colors.destructive }]}>{emailError}</Text> : null}

          <TouchableOpacity
            style={[styles.connectBtn, { backgroundColor: connecting ? colors.secondary : colors.primary, borderRadius: colors.radius }]}
            onPress={handleConnect}
            disabled={connecting}
          >
            {connecting ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.connectBtnText, { color: colors.primaryForeground }]}>Connect</Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 18, gap: 24 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },

  profileCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderWidth: 1 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontFamily: "Inter_700Bold" },
  profileName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  profileEmail: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  versionBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  versionBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  section: { gap: 8 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, textTransform: "uppercase", paddingHorizontal: 4 },
  sectionCard: { overflow: "hidden", borderWidth: 1 },
  sectionHint: { fontSize: 11, fontFamily: "Inter_400Regular", paddingHorizontal: 4, lineHeight: 16 },
  rowDiv: { height: 1 },

  emptyRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
  emptyRowText: { fontSize: 14, fontFamily: "Inter_400Regular" },

  emailProviderDot: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15 },
  emailRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  emailAddress: { fontSize: 14, fontFamily: "Inter_500Medium" },
  emailMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  syncBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  addEmailBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14 },
  addEmailText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  settingRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  settingIconBox: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  settingLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  settingSubLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  settingLabelFull: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  settingValue: { fontSize: 13, fontFamily: "Inter_400Regular" },

  timeoutSection: { padding: 14, gap: 12 },
  timeoutHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  timeoutChips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  timeoutChip: { paddingHorizontal: 14, paddingVertical: 8 },
  timeoutChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, borderWidth: 1 },
  logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, paddingTop: 12, paddingHorizontal: 20, borderTopWidth: 1 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 20, lineHeight: 18 },
  inputLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8, marginTop: 8 },
  providerRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  providerChip: { paddingHorizontal: 14, paddingVertical: 8 },
  providerChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  input: { height: 48, paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_400Regular", borderWidth: 1 },
  emailError: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  connectBtn: { height: 52, alignItems: "center", justifyContent: "center", marginTop: 20, marginBottom: 8 },
  connectBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
