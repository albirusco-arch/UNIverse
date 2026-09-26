import { router } from 'expo-router';
import { useCallback } from 'react';

import { useFeedback } from '@/components/feedback';
import { blockUser, deletePost, reportContent } from '@/data/api';
import type { Author, ReportReason, ReportTarget } from '@/data/types';
import { t } from '@/i18n';
import { useSession } from '@/lib/session';

const REASONS: ReportReason[] = ['spam', 'harassment', 'misinformation', 'inappropriate'];

/**
 * Report / block / delete actions for user-generated content, as required by
 * App Store Review Guideline 1.2.
 */
export function useModeration() {
  const { showSheet, toast } = useFeedback();
  const { signedIn, profile } = useSession();

  const ensureSignedIn = useCallback(() => {
    if (signedIn) return true;
    router.push('/welcome');
    return false;
  }, [signedIn]);

  const report = useCallback(
    (targetType: ReportTarget, targetId: string) => {
      if (!ensureSignedIn()) return;
      showSheet({
        title: t('community.reportTitle'),
        message: t('community.reportBody'),
        options: REASONS.map((reason) => ({
          label: t(`community.reportReasons.${reason}`),
          onPress: () => {
            reportContent(targetType, targetId, reason)
              .then(() => toast(t('community.reported')))
              .catch(() => toast(t('common.error')));
          },
        })),
      });
    },
    [ensureSignedIn, showSheet, toast],
  );

  const block = useCallback(
    (author: Author, onDone?: () => void) => {
      if (!ensureSignedIn()) return;
      showSheet({
        title: t('community.blockTitle', { name: author.displayName }),
        message: t('community.blockBody'),
        options: [
          {
            label: t('common.block'),
            destructive: true,
            onPress: () => {
              blockUser(author.id)
                .then(() => {
                  toast(t('community.blocked'));
                  onDone?.();
                })
                .catch(() => toast(t('common.error')));
            },
          },
        ],
      });
    },
    [ensureSignedIn, showSheet, toast],
  );

  /** Overflow menu for a post: delete when it is yours, report/block otherwise. */
  const postMenu = useCallback(
    (post: { id: string; author: Author }, onDeleted?: () => void) => {
      const mine = post.author.id === 'me' || post.author.id === profile.id;
      if (mine) {
        showSheet({
          title: t('community.deletePost'),
          message: t('community.deleteConfirm'),
          options: [
            {
              label: t('common.delete'),
              destructive: true,
              onPress: () => {
                deletePost(post.id)
                  .then(() => onDeleted?.())
                  .catch(() => toast(t('common.error')));
              },
            },
          ],
        });
        return;
      }
      showSheet({
        options: [
          { label: t('common.report'), onPress: () => report('post', post.id) },
          { label: t('common.block'), destructive: true, onPress: () => block(post.author, onDeleted) },
        ],
      });
    },
    [profile.id, showSheet, toast, report, block],
  );

  const commentMenu = useCallback(
    (comment: { id: string; author: Author }) => {
      showSheet({
        options: [
          { label: t('common.report'), onPress: () => report('comment', comment.id) },
          { label: t('common.block'), destructive: true, onPress: () => block(comment.author) },
        ],
      });
    },
    [showSheet, report, block],
  );

  const isMine = useCallback(
    (author: Author) => author.id === profile.id || author.id === 'me',
    [profile.id],
  );

  return { report, block, postMenu, commentMenu, isMine, ensureSignedIn };
}
