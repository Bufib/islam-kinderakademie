import { AcademyData, MessageRow } from '@/types/database';

export function accessibleFamilyMessages(
  data: AcademyData,
  profileId: number | null | undefined,
  now = Date.now()
): MessageRow[] {
  if (!profileId) return [];

  const ownChildIds = new Set(
    data.children
      .filter((child) => child.parent_profile_id === profileId)
      .map((child) => child.id)
  );
  const ownApprovedGroupIds = new Set(
    data.groupMembers
      .filter(
        (membership) =>
          ownChildIds.has(membership.child_id) &&
          membership.membership_status === 'approved'
      )
      .map((membership) => membership.group_id)
  );

  return data.messages.filter(
    (message) =>
      Boolean(message.published_at) &&
      new Date(message.published_at!).getTime() <= now &&
      (message.audience === 'all' ||
        (message.audience === 'profile' &&
          message.recipient_profile_id === profileId) ||
        (message.audience === 'group' &&
          Boolean(message.group_id) &&
          ownApprovedGroupIds.has(message.group_id!)))
  );
}

export function unreadFamilyMessageIds(
  data: AcademyData,
  profileId: number | null | undefined,
  now = Date.now()
) {
  if (!profileId) return new Set<number>();

  const readMessageIds = new Set(
    data.messageReads
      .filter((entry) => entry.profile_id === profileId)
      .map((entry) => entry.message_id)
  );

  return new Set(
    accessibleFamilyMessages(data, profileId, now)
      .filter((message) => !readMessageIds.has(message.id))
      .map((message) => message.id)
  );
}
