import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, List, BarChart3 } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { APIMatch } from '@/types/football';
import { extractScore, isMatchFinished, isMatchLive, fetchCompetitionDetail, mapStandingsPayload } from '@/utils/scores';

function TeamLogo({ uri, fallback, size = 20 }: { uri?: string; fallback: string; size?: number }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 3 }} resizeMode="contain" />;
  }
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: Colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.45, fontWeight: '700' as const, color: Colors.primary }}>
        {fallback.charAt(0)}
      </Text>
    </View>
  );
}

type TabType = 'matches' | 'standings';

export default function CompetitionDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; title?: string }>();
  const competitionId = Number(params.id);

  const [activeTab, setActiveTab] = useState<TabType>('matches');
  const [selectedMatchday, setSelectedMatchday] = useState<number | null>(null);
  const hasInitializedMatchday = selectedMatchday !== null;

  const { data: competitionDetail, isLoading: matchesLoading, refetch, isRefetching } = useQuery({
    queryKey: ['competition-detail', competitionId],
    queryFn: () => fetchCompetitionDetail(competitionId),
    enabled: !!competitionId,
    staleTime: 60 * 1000,
  });

  const fallbackTitle = params.title || 'Competição';
  const compTitle = competitionDetail?.competition.name ?? fallbackTitle;
  const compLogo = competitionDetail?.competition.logo;

  const matchdays = useMemo(() => {
    const available = (competitionDetail?.matchdays ?? [])
      .map((item) => Number(item.matchday ?? 0))
      .filter((item, index, array) => item > 0 && array.indexOf(item) === index)
      .sort((a, b) => a - b);
    console.log(`[Competition Detail] Available matchdays for ${competitionId}: ${available.join(', ')}`);
    return available;
  }, [competitionDetail, competitionId]);

  const currentMatchday = useMemo(() => {
    const allMatchdays = competitionDetail?.matchdays ?? [];
    if (allMatchdays.length === 0) {
      return 0;
    }

    const liveGroup = allMatchdays.find((group) =>
      (group.matches ?? []).some((match) => isMatchLive(match)),
    );
    if (liveGroup && Number(liveGroup.matchday ?? 0) > 0) {
      return Number(liveGroup.matchday ?? 0);
    }

    const now = Date.now();
    const datedGroups = allMatchdays
      .map((group) => {
        const timestamps = (group.matches ?? [])
          .map((match) => new Date(match.date).getTime())
          .filter((value) => !Number.isNaN(value));

        if (timestamps.length === 0) {
          return null;
        }

        return {
          matchday: Number(group.matchday ?? 0),
          referenceTime: Math.min(...timestamps),
        };
      })
      .filter((group): group is { matchday: number; referenceTime: number } => {
        return !!group && group.matchday > 0;
      })
      .sort((a, b) => a.matchday - b.matchday);

    const upcomingGroup = datedGroups.find((group) => group.referenceTime >= now);
    if (upcomingGroup) {
      return upcomingGroup.matchday;
    }

    return datedGroups[datedGroups.length - 1]?.matchday ?? matchdays[matchdays.length - 1] ?? 0;
  }, [competitionDetail, matchdays]);

  useEffect(() => {
    if (hasInitializedMatchday) {
      return;
    }

    const fallbackMatchday = currentMatchday > 0 ? currentMatchday : matchdays[0] ?? 0;
    if (fallbackMatchday > 0) {
      console.log(`[Competition Detail] Defaulting to current matchday ${fallbackMatchday} for ${competitionId}`);
      setSelectedMatchday(fallbackMatchday);
    }
  }, [competitionId, currentMatchday, hasInitializedMatchday, matchdays]);

  const resolvedMatchday = selectedMatchday ?? currentMatchday;

  const filteredMatchdays = useMemo(() => {
    const allMatchdays = competitionDetail?.matchdays ?? [];

    if (resolvedMatchday > 0) {
      return allMatchdays.filter((item) => Number(item.matchday ?? 0) === resolvedMatchday);
    }

    return allMatchdays;
  }, [competitionDetail, resolvedMatchday]);

  const compMatches = useMemo(() => filteredMatchdays.flatMap((m) => m.matches ?? []), [filteredMatchdays]);

  const standings = useMemo(() => mapStandingsPayload(competitionDetail?.standings ?? []), [competitionDetail]);

  const matchesByRound = useMemo(() => {
    return filteredMatchdays
      .map((group) => ({
        roundLabel: group.matchday > 0 ? `Jornada ${group.matchday}` : 'Sem Jornada',
        matches: [...(group.matches ?? [])].sort((a, b) => {
          const aTime = new Date(a.date).getTime();
          const bTime = new Date(b.date).getTime();
          return aTime - bTime;
        }),
      }))
      .sort((a, b) => {
        const aNum = Number((a.roundLabel.match(/\d+/) ?? ['9999'])[0]);
        const bNum = Number((b.roundLabel.match(/\d+/) ?? ['9999'])[0]);
        return aNum - bNum;
      });
  }, [filteredMatchdays]);

  const goBack = useCallback(() => router.back(), []);

  const handleMatchPress = useCallback((match: APIMatch) => {
    router.push({
      pathname: '/results/[id]',
      params: {
        id: String(match.id),
        matchData: JSON.stringify(match),
        compName: compTitle,
        competitionId: String(match.competition_id ?? competitionId),
        compLogo,
      },
    });
  }, [compLogo, compTitle, competitionId]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <View style={styles.topBar}>
        <Pressable onPress={goBack} style={styles.backBtn} testID="back-btn">
          <ArrowLeft size={22} color={Colors.text} />
        </Pressable>
        {compLogo ? (
          <Image source={{ uri: compLogo }} style={styles.topBarLogo} resizeMode="contain" />
        ) : null}
        <Text style={styles.topBarTitle} numberOfLines={1}>{compTitle}</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'matches' && styles.tabActive]}
          onPress={() => setActiveTab('matches')}
        >
          <List size={15} color={activeTab === 'matches' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'matches' && styles.tabTextActive]}>Jogos</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'standings' && styles.tabActive]}
          onPress={() => setActiveTab('standings')}
        >
          <BarChart3 size={15} color={activeTab === 'standings' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'standings' && styles.tabTextActive]}>Classificação</Text>
        </Pressable>
      </View>

      {matchesLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>A carregar...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          {activeTab === 'matches' ? (
            !compMatches || compMatches.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>⚽</Text>
                <Text style={styles.emptyTitle}>Sem jogos</Text>
                <Text style={styles.emptySubtitle}>Nenhum jogo registado nesta competição</Text>
              </View>
            ) : (
              <>
                <View style={styles.matchdayPickerSection}>
                  <Text style={styles.matchdayPickerLabel}>Jornada</Text>
                  <View style={styles.matchdayPickerWrap} testID="matchday-picker-wrap">
                    <Picker
                      selectedValue={resolvedMatchday > 0 ? resolvedMatchday : undefined}
                      onValueChange={(value: number) => setSelectedMatchday(value)}
                      style={styles.matchdayPicker}
                      dropdownIconColor={Colors.primary}
                      testID="matchday-picker"
                    >
                      {matchdays.map((matchday) => (
                        <Picker.Item key={matchday} label={`Jornada ${matchday}`} value={matchday} />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View style={styles.roundsContainer}>
                  {matchesByRound.map((group) => (
                    <View key={group.roundLabel} style={styles.roundCard}>
                      <View style={styles.roundHeader}>
                        <Text style={styles.roundTitle}>{group.roundLabel}</Text>
                      </View>
                      {group.matches.map((match, mIdx) => {
                        const score = extractScore(match);
                        const finished = isMatchFinished(match);
                        const isLive = isMatchLive(match);
                        const homeWin = score ? score.home > score.away : match.winner_team_id === match.team1_id;
                        const awayWin = score ? score.away > score.home : match.winner_team_id === match.team2_id;

                        return (
                          <View key={match.id}>
                            <Pressable
                              style={styles.matchRow}
                              onPress={() => handleMatchPress(match)}
                              testID={`match-${match.id}`}
                            >
                              <View style={styles.matchTeamsCol}>
                                <View style={styles.matchTeamRow}>
                                  <TeamLogo uri={match.team1_logo} fallback={match.team1} size={20} />
                                  <Text
                                    style={[styles.matchTeamName, homeWin && finished && styles.winnerName]}
                                    numberOfLines={1}
                                  >
                                    {match.team1}
                                  </Text>
                                </View>
                                <View style={styles.matchTeamRow}>
                                  <TeamLogo uri={match.team2_logo} fallback={match.team2} size={20} />
                                  <Text
                                    style={[styles.matchTeamName, awayWin && finished && styles.winnerName]}
                                    numberOfLines={1}
                                  >
                                    {match.team2}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.matchScoreCol}>
                                {isLive ? (
                                  <View style={styles.liveBadge}>
                                    <View style={styles.liveDot} />
                                    <Text style={styles.liveText}>LIVE</Text>
                                  </View>
                                ) : score ? (
                                  <>
                                    <Text style={[styles.scoreNum, homeWin && styles.winnerScore]}>{score.home}</Text>
                                    <Text style={[styles.scoreNum, awayWin && styles.winnerScore]}>{score.away}</Text>
                                  </>
                                ) : finished ? (
                                  <Text style={styles.ftText}>FT</Text>
                                ) : (
                                  <Text style={styles.vsLabel}>vs</Text>
                                )}
                              </View>
                            </Pressable>
                            {mIdx < group.matches.length - 1 && <View style={styles.matchDivider} />}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </>
            )
          ) : standings.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyTitle}>Sem classificação</Text>
              <Text style={styles.emptySubtitle}>Ainda não existem dados de classificação</Text>
            </View>
          ) : (
            <View style={styles.standingsCard}>
              <View style={styles.standingsHeaderRow}>
                <Text style={[styles.stHeaderText, { width: 28, textAlign: 'center' as const }]}>#</Text>
                <Text style={[styles.stHeaderText, { flex: 1 }]}>Equipa</Text>
                <Text style={[styles.stHeaderText, styles.stCol]}>J</Text>
                <Text style={[styles.stHeaderText, styles.stCol]}>V</Text>
                <Text style={[styles.stHeaderText, styles.stCol]}>E</Text>
                <Text style={[styles.stHeaderText, styles.stCol]}>D</Text>
                <Text style={[styles.stHeaderText, styles.stCol]}>GM</Text>
                <Text style={[styles.stHeaderText, styles.stCol]}>GS</Text>
                <Text style={[styles.stHeaderText, styles.stCol]}>DG</Text>
                <Text style={[styles.stHeaderText, styles.stColPts]}>Pts</Text>
              </View>
              {standings.map((row, idx) => (
                <View key={row.teamId} style={[styles.stRow, idx % 2 === 0 && styles.stRowAlt]}>
                  <Text style={[styles.stPos, idx < 3 && styles.stPosTop]}>{idx + 1}</Text>
                  <View style={styles.stTeam}>
                    <TeamLogo uri={row.teamLogo} fallback={row.teamName} size={18} />
                    <Text style={styles.stTeamName} numberOfLines={1}>{row.teamName}</Text>
                  </View>
                  <Text style={[styles.stStat, styles.stCol]}>{row.played}</Text>
                  <Text style={[styles.stStat, styles.stCol]}>{row.won}</Text>
                  <Text style={[styles.stStat, styles.stCol]}>{row.drawn}</Text>
                  <Text style={[styles.stStat, styles.stCol]}>{row.lost}</Text>
                  <Text style={[styles.stStat, styles.stCol]}>{row.goalsFor}</Text>
                  <Text style={[styles.stStat, styles.stCol]}>{row.goalsAgainst}</Text>
                  <Text style={[
                    styles.stStat,
                    styles.stCol,
                    row.goalDifference > 0 && styles.stPositive,
                    row.goalDifference < 0 && styles.stNegative,
                  ]}>
                    {row.goalDifference > 0 ? '+' : ''}{row.goalDifference}
                  </Text>
                  <Text style={[styles.stPts, styles.stColPts]}>{row.points}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarLogo: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  topBarTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  matchdayPickerSection: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  matchdayPickerLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  matchdayPickerWrap: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  matchdayPicker: {
    color: Colors.text,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  scrollContent: {
    paddingTop: 4,
    paddingBottom: 30,
  },
  roundsContainer: {
    gap: 12,
    marginHorizontal: 12,
  },
  roundCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  roundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  roundTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  matchTeamsCol: {
    flex: 1,
    gap: 4,
  },
  matchTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchTeamName: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
    flex: 1,
  },
  winnerName: {
    fontWeight: '700' as const,
  },
  matchScoreCol: {
    minWidth: 32,
    alignItems: 'center',
    gap: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#EF4444',
  },
  scoreNum: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  winnerScore: {
    color: Colors.text,
    fontWeight: '800' as const,
  },
  ftText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  vsLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  matchDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 40,
    marginRight: 12,
  },
  standingsCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
  standingsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stHeaderText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
  },
  stRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  stRowAlt: {
    backgroundColor: '#FAFCFA',
  },
  stPos: {
    width: 28,
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  stPosTop: {
    color: Colors.primary,
  },
  stTeam: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stTeamName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  stCol: {
    width: 26,
    textAlign: 'center' as const,
  },
  stColPts: {
    width: 34,
    textAlign: 'center' as const,
  },
  stStat: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  stPts: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '800' as const,
  },
  stPositive: {
    color: Colors.win,
  },
  stNegative: {
    color: Colors.loss,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
});
