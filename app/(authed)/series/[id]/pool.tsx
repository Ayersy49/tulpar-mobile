import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getSeries,
  type SeriesInviteSummary,
  type SeriesMemberSummary,
} from '../../../../src/api/series';
import {
  approveInvite,
  assignTeamMember,
  createInvite,
  rejectInvite,
  removeMember,
  unassignTeamMember,
} from '../../../../src/api/series-invites';
import { getMe } from '../../../../src/api/me';
import { tr } from '../../../../src/i18n/tr';

function displayName(profile: {
  username: string | null;
  firstName: string | null;
  lastName: string | null;
} | null): string {
  if (!profile) return '—';
  if (profile.username) return profile.username;
  const full = [profile.firstName, profile.lastName]
    .filter(Boolean)
    .join(' ');
  return full || '—';
}

function memberDisplayName(m: SeriesMemberSummary): string {
  return displayName(m.user.profile);
}

function inviteDisplayName(i: SeriesInviteSummary): string {
  return displayName(i.invitee.profile);
}

export default function SeriesPoolScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const meQuery = useQuery({ queryKey: ['me'], queryFn: getMe });
  const me = meQuery.data;
  const seriesQuery = useQuery({
    queryKey: ['series', id],
    queryFn: () => getSeries(id!),
    enabled: !!id,
  });

  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteNotes, setInviteNotes] = useState('');

  const invalidateSelf = () =>
    qc.invalidateQueries({ queryKey: ['series', id] });

  const mutInvite = useMutation({
    mutationFn: () => createInvite(id!, inviteUserId.trim(), inviteNotes || undefined),
    onSuccess: () => {
      Alert.alert('', tr.series.inviteSent);
      setInviteUserId('');
      setInviteNotes('');
      invalidateSelf();
    },
    onError: (e: Error) =>
      Alert.alert(tr.series.inviteFailed, e.message),
  });
  const mutApprove = useMutation({
    mutationFn: (inviteId: string) => approveInvite(inviteId),
    onSuccess: invalidateSelf,
    onError: (e: Error) => Alert.alert(tr.common.error, e.message),
  });
  const mutReject = useMutation({
    mutationFn: (inviteId: string) => rejectInvite(inviteId),
    onSuccess: invalidateSelf,
    onError: (e: Error) => Alert.alert(tr.common.error, e.message),
  });
  const mutKick = useMutation({
    mutationFn: (userId: string) => removeMember(id!, userId),
    onSuccess: invalidateSelf,
    onError: (e: Error) => Alert.alert(tr.common.error, e.message),
  });
  const mutAssign = useMutation({
    mutationFn: (vars: { teamId: string; userId: string }) =>
      assignTeamMember(id!, vars.teamId, vars.userId),
    onSuccess: invalidateSelf,
    onError: (e: Error) => Alert.alert(tr.common.error, e.message),
  });
  const mutUnassign = useMutation({
    mutationFn: (vars: { teamId: string; userId: string }) =>
      unassignTeamMember(id!, vars.teamId, vars.userId),
    onSuccess: invalidateSelf,
    onError: (e: Error) => Alert.alert(tr.common.error, e.message),
  });

  if (seriesQuery.isLoading || meQuery.isLoading || !seriesQuery.data || !me) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }
  const series = seriesQuery.data;
  const isAuthority =
    series.authorityAId === me.id || series.authorityBId === me.id;
  const pendingForAuthority = series.invites.filter(
    (i) => i.status === 'PENDING_AUTHORITY',
  );

  const teamAssignmentFor = (userId: string) => {
    for (const t of series.teams) {
      if (t.members.some((m) => m.userId === userId)) {
        return t;
      }
    }
    return null;
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Pending invites surfaced to the authority for approval. */}
        {isAuthority && pendingForAuthority.length > 0 ? (
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">
              {tr.series.invitePendingHeader}
            </Text>
            {pendingForAuthority.map((i) => (
              <View
                key={i.id}
                className="flex-row items-center justify-between py-2 border-b border-gray-100">
                <View className="flex-1">
                  <Text className="text-sm text-gray-900">
                    {inviteDisplayName(i)}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {displayName(i.invitedBy.profile)} önerdi
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => mutApprove.mutate(i.id)}
                    className="bg-green-600 px-3 py-1.5 rounded active:opacity-80">
                    <Text className="text-white text-xs font-medium">
                      {tr.series.inviteApprove}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => mutReject.mutate(i.id)}
                    className="bg-gray-200 px-3 py-1.5 rounded active:opacity-80">
                    <Text className="text-gray-800 text-xs font-medium">
                      {tr.series.inviteReject}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Roster */}
        <Text className="text-sm font-semibold text-gray-700 mb-2">
          {tr.series.poolHeader} ·{' '}
          {tr.series.poolMembersCount(series.members.length)}
        </Text>
        <Text className="text-xs text-gray-500 mb-2">
          {tr.series.poolCapHint}
        </Text>
        {series.members.map((m) => {
          const isA = series.authorityAId === m.userId;
          const isB = series.authorityBId === m.userId;
          const isMe = m.userId === me.id;
          const assignedTeam = teamAssignmentFor(m.userId);
          return (
            <View
              key={m.id}
              className="py-2 border-b border-gray-100">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-sm text-gray-900">
                    {memberDisplayName(m)}
                    {isMe ? ' (sen)' : ''}
                  </Text>
                  {isA || isB ? (
                    <Text className="text-xs text-indigo-700 mt-0.5">
                      {tr.series.authorityBadge}
                    </Text>
                  ) : null}
                </View>
                {isAuthority && !isMe && !(isA || isB) ? (
                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        '',
                        tr.series.kickConfirm(memberDisplayName(m)),
                        [
                          { text: tr.common.cancel, style: 'cancel' },
                          {
                            text: tr.series.kickCta,
                            style: 'destructive',
                            onPress: () => mutKick.mutate(m.userId),
                          },
                        ],
                      )
                    }
                    className="px-3 py-1 active:opacity-60">
                    <Text className="text-xs text-red-700">
                      {tr.series.kickCta}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {/* FIXED-mode team assignment toggles for authority */}
              {isAuthority && series.teamMode === 'FIXED' ? (
                <View className="flex-row flex-wrap gap-2 mt-2">
                  {series.teams.map((t) => {
                    const isAssigned = assignedTeam?.id === t.id;
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => {
                          if (isAssigned) {
                            mutUnassign.mutate({ teamId: t.id, userId: m.userId });
                          } else {
                            mutAssign.mutate({ teamId: t.id, userId: m.userId });
                          }
                        }}
                        style={{
                          borderColor: t.colorHex,
                          borderWidth: 1,
                          backgroundColor: isAssigned ? t.colorHex : '#fff',
                        }}
                        className="px-2 py-1 rounded active:opacity-70">
                        <Text
                          className="text-xs font-medium"
                          style={{ color: isAssigned ? '#fff' : t.colorHex }}>
                          {t.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}

        {/* Invite by ID. The user-search modal is deferred per the plan; v1
            takes a raw UUID. Member-suggested vs authority-direct is decided
            server-side from the caller's role. */}
        <View className="mt-6 border-t border-gray-100 pt-4">
          <Text className="text-sm font-semibold text-gray-700 mb-2">
            {isAuthority ? tr.series.inviteCta : tr.series.memberSuggestCta}
          </Text>
          <Text className="text-xs font-medium mb-1">
            {tr.series.inviteByIdLabel}
          </Text>
          <TextInput
            value={inviteUserId}
            onChangeText={setInviteUserId}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={tr.series.invitePlaceholder}
            className="border border-gray-200 rounded px-3 py-2 mb-2"
          />
          <Text className="text-xs font-medium mb-1">
            {tr.series.inviteNotesLabel}
          </Text>
          <TextInput
            value={inviteNotes}
            onChangeText={setInviteNotes}
            className="border border-gray-200 rounded px-3 py-2 mb-2"
          />
          <Pressable
            onPress={() => mutInvite.mutate()}
            disabled={mutInvite.isPending || !inviteUserId.trim()}
            className={`mt-2 py-2 rounded ${
              mutInvite.isPending || !inviteUserId.trim()
                ? 'bg-gray-300'
                : 'bg-blue-600'
            } active:opacity-80`}>
            <Text className="text-white text-center font-medium">
              {mutInvite.isPending ? tr.common.saving : tr.series.inviteSubmit}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
