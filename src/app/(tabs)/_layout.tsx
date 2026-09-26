import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/tab-bar';
import { useSession } from '@/lib/session';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  const { signedIn, guest, profileComplete } = useSession();
  // Students sign in with a university email; guests can browse the catalogue.
  if (!signedIn && !guest) return <Redirect href="/welcome" />;
  if (signedIn && !profileComplete) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="research" />
      <Tabs.Screen name="community" />
      <Tabs.Screen name="groups" />
    </Tabs>
  );
}
