import { Feather } from "@expo/vector-icons";
import { useRegister } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setAuthData } = useAuth();
  const { mutate, isPending } = useRegister();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = () => {
    if (!name.trim() || !email.trim() || !password) {
      setError("All fields are required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setError("");
    mutate(
      { data: { name: name.trim(), email: email.trim().toLowerCase(), password } },
      {
        onSuccess: (data) => {
          setAuthData(data.token, data.user);
        },
        onError: (err: any) => {
          setError(err?.data?.error ?? "Registration failed. Try again.");
        },
      },
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + (Platform.OS === "web" ? 67 : 40),
              paddingBottom: insets.bottom + 32,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={[styles.logoWrap, { backgroundColor: `${colors.primary}20`, borderRadius: colors.radius * 2 }]}>
              <Text style={styles.logoIcon}>☠</Text>
            </View>
            <Text style={[styles.appName, { color: colors.foreground }]}>Create Account</Text>
            <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
              Join Pirate Proof today
            </Text>
          </View>

          <View style={styles.form}>
            {error ? (
              <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}18`, borderColor: colors.destructive, borderRadius: colors.radius }]}>
                <Feather name="alert-circle" size={14} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              </View>
            ) : null}

            {(["name", "email", "password"] as const).map((field) => (
              <View key={field}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                  {field === "name" ? "Full Name" : field === "email" ? "Email" : "Password"}
                </Text>
                <View style={field === "password" ? styles.passwordWrap : undefined}>
                  <TextInput
                    style={[
                      styles.input,
                      field === "password" && styles.passwordInput,
                      { backgroundColor: colors.input, color: colors.foreground, borderColor: colors.border, borderRadius: colors.radius },
                    ]}
                    placeholder={
                      field === "name" ? "Your full name" :
                      field === "email" ? "you@example.com" :
                      "Min. 6 characters"
                    }
                    placeholderTextColor={colors.mutedForeground}
                    value={field === "name" ? name : field === "email" ? email : password}
                    onChangeText={field === "name" ? setName : field === "email" ? setEmail : setPassword}
                    keyboardType={field === "email" ? "email-address" : "default"}
                    autoCapitalize={field === "name" ? "words" : "none"}
                    secureTextEntry={field === "password" && !showPassword}
                    autoCorrect={false}
                  />
                  {field === "password" && (
                    <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
                      <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[
                styles.btn,
                { backgroundColor: isPending ? colors.secondary : colors.primary, borderRadius: colors.radius },
              ]}
              onPress={handleRegister}
              disabled={isPending}
              activeOpacity={0.85}
            >
              {isPending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={[styles.footerLink, { color: colors.primary }]}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 32 },
  brand: { alignItems: "center", gap: 12 },
  logoWrap: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  logoIcon: { fontSize: 40 },
  appName: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  tagline: { fontSize: 14, fontFamily: "Inter_400Regular" },
  form: { gap: 16 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderWidth: 1 },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  inputLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 },
  input: { height: 52, paddingHorizontal: 16, fontSize: 15, fontFamily: "Inter_400Regular", borderWidth: 1 },
  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 48 },
  eyeBtn: { position: "absolute", right: 16, top: 17 },
  btn: { height: 56, alignItems: "center", justifyContent: "center", marginTop: 8 },
  btnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  footerLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
