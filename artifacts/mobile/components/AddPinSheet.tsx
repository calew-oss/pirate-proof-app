import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreatePin,
  getListPinsQueryKey,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const PIN_TYPES = [
  { value: "permanent", label: "Permanent", desc: "Always active" },
  { value: "one_time", label: "One-Time", desc: "Expires after first use" },
  { value: "time_restricted", label: "Time Window", desc: "Valid during set hours" },
  { value: "delivery", label: "Delivery", desc: "Auto-enabled during delivery" },
] as const;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function AddPinSheet({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { mutate, isPending } = useCreatePin();

  const [label, setLabel] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [type, setType] = useState<string>("permanent");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!label.trim()) { setError("Label is required"); return; }
    if (pinCode.length < 4) { setError("PIN must be at least 4 digits"); return; }
    if (!/^\d+$/.test(pinCode)) { setError("PIN must contain only digits"); return; }
    setError("");
    mutate(
      { data: { label: label.trim(), pinCode, type: type as any } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          qc.invalidateQueries({ queryKey: getListPinsQueryKey() });
          setLabel(""); setPinCode(""); setType("permanent");
          onClose();
        },
        onError: () => setError("Failed to create PIN. Please try again."),
      },
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <Pressable style={styles.overlay} onPress={onClose} />
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
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>New Access PIN</Text>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: colors.mutedForeground }]}>PIN Type</Text>
          {PIN_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[
                styles.typeRow,
                {
                  backgroundColor: type === t.value ? `${colors.primary}18` : colors.secondary,
                  borderColor: type === t.value ? colors.primary : colors.border,
                  borderRadius: colors.radius,
                },
              ]}
              onPress={() => setType(t.value)}
            >
              <View
                style={[
                  styles.radio,
                  { borderColor: type === t.value ? colors.primary : colors.mutedForeground },
                ]}
              >
                {type === t.value && (
                  <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.typeLabel, { color: colors.foreground }]}>{t.label}</Text>
                <Text style={[styles.typeDesc, { color: colors.mutedForeground }]}>{t.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}

          <Text style={[styles.label, { color: colors.mutedForeground }]}>Label</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.input,
                color: colors.foreground,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
            placeholder="e.g. Delivery Driver, Family, Guest"
            placeholderTextColor={colors.mutedForeground}
            value={label}
            onChangeText={setLabel}
          />

          <Text style={[styles.label, { color: colors.mutedForeground }]}>PIN Code</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.input,
                color: colors.foreground,
                borderColor: error ? colors.destructive : colors.border,
                borderRadius: colors.radius,
                letterSpacing: 6,
                fontSize: 20,
              },
            ]}
            placeholder="4-8 digits"
            placeholderTextColor={colors.mutedForeground}
            value={pinCode}
            onChangeText={setPinCode}
            keyboardType="numeric"
            maxLength={8}
            secureTextEntry
          />
          {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: isPending ? colors.secondary : colors.primary, borderRadius: colors.radius },
            ]}
            onPress={handleSubmit}
            disabled={isPending}
            activeOpacity={0.8}
          >
            {isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.submitText, { color: colors.primaryForeground }]}>Create PIN</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingTop: 12, paddingHorizontal: 20, borderTopWidth: 1,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8, marginTop: 16 },
  typeRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginBottom: 8, borderWidth: 1 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  typeLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  typeDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  input: { height: 48, paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_400Regular", borderWidth: 1 },
  error: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  submitBtn: { height: 52, alignItems: "center", justifyContent: "center", marginTop: 24, marginBottom: 8 },
  submitText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
