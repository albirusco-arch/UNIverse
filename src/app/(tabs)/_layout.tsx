import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/tab-bar';
import { useSession } from '@/lib/session';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  const { signedIn, profileComplete } = useSession();
  // UNIVERSE is for students only: sign in with a university email first.
  if (!signedIn) return <Redirect href="/welcome" />;
  if (!profileComplete) return <Redirect href="/onboarding" />;

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
