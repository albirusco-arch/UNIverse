import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { t } from '@/i18n';
import { colors, radius, spacing } from '@/theme/tokens';

export type SheetOption = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type SheetConfig = {
  title?: string;
  message?: string;
  options: SheetOption[];
  /** Label of the dismiss button (default "Cancel"). */
  cancelLabel?: string;
};

type Feedback = {
  /** Cross-platform action sheet (also used for confirmations). */
  showSheet: (config: SheetConfig) => void;
  toast: (message: string) => void;
};

const FeedbackContext = createContext<Feedback | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<SheetConfig | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!toastMessage) return;
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToastMessage(null));
    }, 2600);
    return () => clearTimeout(timer);
  }, [toastMessage, opacity]);

  const showSheet = useCallback((config: SheetConfig) => setSheet(config), []);
  const toast = useCallback((message: string) => setToastMessage(message), []);
  const value = useMemo(() => ({ showSheet, toast }), [showSheet, toast]);

  const choose = (option: SheetOption) => {
    setSheet(null);
    // Let the sheet close before a follow-up sheet or navigation opens.
    setTimeout(option.onPress, 250);
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <Modal visible={sheet !== null} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)} accessibilityLabel={t('common.close')}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            {sheet?.title ? (
              <Text variant="title3" align="center">
                {sheet.title}
              </Text>
            ) : null}
            {sheet?.message ? (
              <Text variant="callout" color="textSecondary" align="center" style={styles.message}>
                {sheet.message}
              </Text>
            ) : null}
            <View style={styles.options}>
              {sheet?.options.map((option) => (
                <Pressable
                  key={option.label}
                  onPress={() => choose(option)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surfacePressed }]}>
                  <Text variant="bodyStrong" align="center" style={{ color: option.destructive ? colors.red : colors.text }}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setSheet(null)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.option, styles.cancel, pressed && { opacity: 0.8 }]}>
                <Text variant="bodyStrong" align="center" color="textSecondary">
                  {sheet?.cancelLabel ?? t('common.cancel')}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {toastMessage ? (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[styles.toast, { top: insets.top + spacing.md, opacity }]}>
          <Text variant="callout" align="center">
            {toastMessage}
          </Text>
        </Animated.View>
      ) : null}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): Feedback {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback must be used inside FeedbackProvider');
  return context;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#141D33',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  message: {
    marginTop: spacing.sm,
  },
  options: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  option: {
    minHeight: 52,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: spacing.lg,
  },
  cancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  toast: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: '#1E293B',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.successBorder,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
