import { DarkTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { FeedbackProvider } from '@/components/feedback';
import { SessionProvider, useSession } from '@/lib/session';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

const theme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primaryLight,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
  },
};

const modal = { presentation: 'modal' } as const;

function RootNavigator() {
  const { ready } = useSession();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="welcome" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      <Stack.Screen name="post/new" options={modal} />
      <Stack.Screen name="equivalence/new" options={modal} />
      <Stack.Screen name="rate/[id]" options={modal} />
      <Stack.Screen name="club/new" options={modal} />
      <Stack.Screen name="group/new" options={modal} />
      <Stack.Screen name="group/join" options={modal} />
      <Stack.Screen name="career-links" options={modal} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <SessionProvider>
        <FeedbackProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </FeedbackProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
