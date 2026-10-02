import { DarkTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { FeedbackProvider } from '@/components/feedback';
import { LanguageProvider, useLanguage } from '@/lib/language';
import { SessionProvider, useSession } from '@/lib/session';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 300 });

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
  const { language } = useLanguage();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack key={language} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="welcome" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      <Stack.Screen name="post/new" options={modal} />
      <Stack.Screen name="equivalence/new" options={modal} />
      <Stack.Screen name="rate/[id]" options={modal} />
      <Stack.Screen name="club/new" options={modal} />
      <Stack.Screen name="partner/new" options={modal} />
      <Stack.Screen name="group/new" options={modal} />
      <Stack.Screen name="group/join" options={modal} />
      <Stack.Screen name="opportunity/new" options={modal} />
      <Stack.Screen name="moment/new" options={modal} />
      <Stack.Screen name="plan/new" options={modal} />
      <Stack.Screen name="moment/[id]" options={{ animation: 'fade' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <LanguageProvider>
        <SessionProvider>
          <FeedbackProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </FeedbackProvider>
        </SessionProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
