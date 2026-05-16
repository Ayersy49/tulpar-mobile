import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  listFriendRequests,
  listFriends,
  rejectFriendRequest,
  unfriend,
  type Friend,
  type FriendRequest,
  type FriendSummaryUser,
} from '../../../src/api/friends';
import { tr } from '../../../src/i18n/tr';

const FRIENDS_KEY = ['friends'] as const;
const INCOMING_KEY = ['friend-requests', 'incoming'] as const;
const OUTGOING_KEY = ['friend-requests', 'outgoing'] as const;

function displayName(user: FriendSummaryUser) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.username ||
    tr.userProfile.unnamed
  );
}

export default function FriendsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const friendsQuery = useQuery<Friend[]>({
    queryKey: FRIENDS_KEY,
    queryFn: listFriends,
  });
  const incomingQuery = useQuery<FriendRequest[]>({
    queryKey: INCOMING_KEY,
    queryFn: () => listFriendRequests('incoming'),
  });
  const outgoingQuery = useQuery<FriendRequest[]>({
    queryKey: OUTGOING_KEY,
    queryFn: () => listFriendRequests('outgoing'),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: FRIENDS_KEY });
    queryClient.invalidateQueries({ queryKey: INCOMING_KEY });
    queryClient.invalidateQueries({ queryKey: OUTGOING_KEY });
  };

  const acceptMutation = useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: invalidateAll,
    onError: () => Alert.alert(tr.common.error, tr.friends.actionFailed),
  });
  const rejectMutation = useMutation({
    mutationFn: rejectFriendRequest,
    onSuccess: invalidateAll,
    onError: () => Alert.alert(tr.common.error, tr.friends.actionFailed),
  });
  const cancelMutation = useMutation({
    mutationFn: cancelFriendRequest,
    onSuccess: invalidateAll,
    onError: () => Alert.alert(tr.common.error, tr.friends.actionFailed),
  });
  const unfriendMutation = useMutation({
    mutationFn: unfriend,
    onSuccess: invalidateAll,
    onError: () => Alert.alert(tr.common.error, tr.friends.actionFailed),
  });

  const refreshing =
    friendsQuery.isFetching || incomingQuery.isFetching || outgoingQuery.isFetching;
  const hasError =
    friendsQuery.isError || incomingQuery.isError || outgoingQuery.isError;
  const isLoading =
    friendsQuery.isLoading || incomingQuery.isLoading || outgoingQuery.isLoading;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        contentContainerClassName="p-6 gap-5"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              friendsQuery.refetch();
              incomingQuery.refetch();
              outgoingQuery.refetch();
            }}
          />
        }>
        <Text className="text-3xl font-bold">{tr.friends.title}</Text>

        {isLoading ? (
          <View className="py-10 items-center">
            <ActivityIndicator />
          </View>
        ) : hasError ? (
          <View className="gap-3">
            <Text className="text-sm text-red-700">{tr.friends.loadFailed}</Text>
            <Pressable
              className="bg-blue-600 rounded-lg p-3 active:opacity-80"
              onPress={() => {
                friendsQuery.refetch();
                incomingQuery.refetch();
                outgoingQuery.refetch();
              }}>
              <Text className="text-white text-center font-semibold">
                {tr.common.retry}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Section title={tr.friends.incomingTitle}>
              {incomingQuery.data?.length ? (
                incomingQuery.data.map((request) => (
                  <RequestRow
                    key={request.id}
                    request={request}
                    onOpen={() =>
                      router.push(`/users/${request.otherUser.id}` as Href)
                    }
                    actions={
                      <>
                        <SmallButton
                          label={tr.friends.accept}
                          onPress={() => acceptMutation.mutate(request.id)}
                          disabled={acceptMutation.isPending}
                        />
                        <SmallButton
                          label={tr.friends.reject}
                          variant="muted"
                          onPress={() => rejectMutation.mutate(request.id)}
                          disabled={rejectMutation.isPending}
                        />
                      </>
                    }
                  />
                ))
              ) : (
                <EmptyText>{tr.friends.incomingEmpty}</EmptyText>
              )}
            </Section>

            <Section title={tr.friends.outgoingTitle}>
              {outgoingQuery.data?.length ? (
                outgoingQuery.data.map((request) => (
                  <RequestRow
                    key={request.id}
                    request={request}
                    onOpen={() =>
                      router.push(`/users/${request.otherUser.id}` as Href)
                    }
                    actions={
                      <SmallButton
                        label={tr.friends.cancel}
                        variant="muted"
                        onPress={() => cancelMutation.mutate(request.id)}
                        disabled={cancelMutation.isPending}
                      />
                    }
                  />
                ))
              ) : (
                <EmptyText>{tr.friends.outgoingEmpty}</EmptyText>
              )}
            </Section>

            <Section title={tr.friends.friendsTitle}>
              {friendsQuery.data?.length ? (
                friendsQuery.data.map((friend) => (
                  <FriendRow
                    key={friend.id}
                    friend={friend}
                    onOpen={() => router.push(`/users/${friend.user.id}` as Href)}
                    onRemove={() =>
                      Alert.alert(
                        tr.friends.removeTitle,
                        tr.friends.removeConfirm(displayName(friend.user)),
                        [
                          { text: tr.common.cancel, style: 'cancel' },
                          {
                            text: tr.friends.remove,
                            style: 'destructive',
                            onPress: () => unfriendMutation.mutate(friend.user.id),
                          },
                        ],
                      )
                    }
                  />
                ))
              ) : (
                <EmptyText>{tr.friends.friendsEmpty}</EmptyText>
              )}
            </Section>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text className="text-lg font-bold">{title}</Text>
      <View className="gap-2">{children}</View>
    </View>
  );
}

function RequestRow({
  request,
  onOpen,
  actions,
}: {
  request: FriendRequest;
  onOpen: () => void;
  actions: ReactNode;
}) {
  return (
    <View className="border border-gray-200 rounded-lg p-3 gap-2">
      <Pressable onPress={onOpen} className="active:opacity-70">
        <Text className="font-semibold">{displayName(request.otherUser)}</Text>
        {request.otherUser.username ? (
          <Text className="text-xs text-gray-500">@{request.otherUser.username}</Text>
        ) : null}
      </Pressable>
      <View className="flex-row gap-2">{actions}</View>
    </View>
  );
}

function FriendRow({
  friend,
  onOpen,
  onRemove,
}: {
  friend: Friend;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <View className="border border-gray-200 rounded-lg p-3 gap-2">
      <Pressable onPress={onOpen} className="active:opacity-70">
        <Text className="font-semibold">{displayName(friend.user)}</Text>
        {friend.user.username ? (
          <Text className="text-xs text-gray-500">@{friend.user.username}</Text>
        ) : null}
      </Pressable>
      <View className="flex-row">
        <SmallButton label={tr.friends.remove} variant="danger" onPress={onRemove} />
      </View>
    </View>
  );
}

function SmallButton({
  label,
  onPress,
  disabled,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'muted' | 'danger';
}) {
  const className =
    variant === 'danger'
      ? 'bg-red-600'
      : variant === 'muted'
        ? 'bg-gray-200'
        : 'bg-blue-600';
  const textClass = variant === 'muted' ? 'text-gray-900' : 'text-white';
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className={`${className} rounded-md px-3 py-2 active:opacity-80`}>
      <Text className={`${textClass} text-sm font-semibold`}>{label}</Text>
    </Pressable>
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  return <Text className="text-sm text-gray-500 italic">{children}</Text>;
}
