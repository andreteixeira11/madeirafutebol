import React, { useState, useMemo, useCallback } from 'react';
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
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, List, BarChart3 } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { APIMatch, StandingRow } from '@/types/football';
import { extractScore, isMatchFinished, isMatchLive, fetchCompetitionDetail } from '@/utils/scores';

interface APIStandingItem {
  team_id?: string | number;
  team?: string;
  team_name?: string;
  team_logo?: string;
  played?: number;
  wins?: number;
  won?: number;
  draws?: number;
  drawn?: number;
  losses?: number;
  lost?: number;
  goals_for?: number;
  goals_against?: number;
  goal_difference?: number;
  points?: number;
  gf?: number;
  ga?: number;
  gd?: number;
}

function TeamLogo({ uri, fallback, size = 20 }: { uri?: string; fallback: string; size?: number }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 3 }} resizeMode="contain" />;
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.45, fontWeight: '700' as const, color: Colors.primary }}>
        {fallback.charAt(0)}
      </Text>
    </View>
  );
}

function normalizeRoundLabel(match: APIMatch): string {
  const matchday = Number(match.matchday ?? 0);
  if (!Number.isNaN(matchday) && matchday > 0) {
    return `Jornada ${matchday}`;
  }

  const roundId = String(match.round_id ?? '').trim();
  if (roundId.length > 0) {
    if (/^jornada\s+/i.test(roundId)) {
      return roundId;
    }
    if (/^\d+$/.test(roundId)) {
      return `Jornada ${roundId}`;
    }
    return roundId;
  }
  return 'Sem Jornada';
}

function mapStandingsPayload(raw: unknown): StandingRow[] {
  if (!Array.isArray(raw)) return [];

  const rows = raw.map((item, index) => {
    const row = item as APIStandingItem;
    const played = Number(row.played ?? 0);
    const won = Number(row.wins ?? row.won ?? 0);
    const drawn = Number(row.draws ?? row.drawn ?? (row as APIStandingItem & { draw?: number }).draw ?? 0);
    const lost = Number(row.losses ?? row.lost ?? 0);
    const goalsFor = Number(row.goals_for ?? row.gf ?? 0);
    const goalsAgainst = Number(row.goals_against ?? row.ga ?? 0);
    const goalDifference = Number(row.goal_difference ?? row.gd ?? (goalsFor - goalsAgainst));
    const points = Number(row.points ?? 0);
    const teamName = String(row.team_name ?? row.team ?? `Equipa ${index + 1}`);
    const teamId = String(row.team_id ?? teamName);

    return {
      teamId,
      teamName,
      teamLogo: String(row.team_logo ?? ''),
      played,
      won,
      drawn,
      lost,
      goalsFor,
      goalsAgainst,
      goalDifference,
      points,
    };
  });

  return rows.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
}


type TabType = 'matches' | 'standings';

export default function CompetitionDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; title?: string }>();
  const competitionId = Number(params.id);

  const [activeTab, setActiveTab] = useState<TabType>('matches');

  const { data: competitionDetail, isLoading: matchesLoading, refetch, isRefetching } = useQuery({
    queryKey: ['competition-detail', competitionId],
    queryFn: () => fetchCompetitionDetail(competitionId),
    enabled: !!competitionId,
    staleTime: 60 * 1000,
  });

  const fallbackTitle = params.title || 'Competição';
  const compTitle = competitionDetail?.competition.name ?? fallbackTitle;
  const compLogo = competitionDetail?.competition.logo;

  const compMatches = useMemo(() => {
    const matchdays = competitionDetail?.matchdays ?? [];
    return matchdays.flatMap((m) => m.matches ?? []);
  }, [competitionDetail]);

  const standings = useMemo(() => {
    const mapped = mapStandingsPayload(competitionDetail?.standings ?? []);
    if (mapped.length > 0) {
      return mapped;
    }
    return [];
  }, [competitionDetail]);

  const matchesByRound = useMemo(() => {
    const groups: Record<string, APIMatch[]> = {};
    if (!compMatches || !Array.isArray(compMatches)) {
      return [] as { roundLabel: string; matches: APIMatch[] }[];
    }

    compMatches.forEach((match) => {
      const roundLabel = normalizeRoundLabel(match);
      if (!groups[roundLabel]) {
        groups[roundLabel] = [];
      }
      groups[roundLabel].push(match);
    });

    return Object.entries(groups)
      .map(([roundLabel, matches]) => ({ roundLabel, matches }))
      .sort((a, b) => {
        const aNum = Number((a.roundLabel.match(/\d+/) ?? ['9999'])[0]);
        const bNum = Number((b.roundLabel.match(/\d+/) ?? ['9999'])[0]);
        return aNum - bNum;
      });
  }, [compMatches]);

  const goBack = useCallback(() => router.back(), []);

  const handleMatchPress = useCallback((match: APIMatch) => {
    router.push({
      pathname: '/results/[id]',
      params: {
        id: String(match.id),
        matchData: JSON.stringify(match),
        compName: compTitle,
      },
    });
  }, [compTitle]);

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
              <View style={styles.roundsContainer}>
                {matchesByRound.map((group) => (
                  <View key={group.roundLabel} style={styles.roundCard}>
                    <View style={styles.roundHeader}>
                      <Text style={styles.roundTitle}>{group.roundLabel}</Text>
                      <Text style={styles.roundCount}>{group.matches.length} jogos</Text>
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
                <View
                  key={row.teamId}
                  style={[styles.stRow, idx % 2 === 0 && styles.stRowAlt]}
                >
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
                    styles.stStat, styles.stCol,
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
    textAlign: 'center',
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
    paddingTop: 10,
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
    justifyContent: 'space-between',
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
  roundCount: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
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
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  matchDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 40,
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
    textAlign: 'center',
  },
  standingsCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 12,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
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
    fontWeight: '700' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  stRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  stRowAlt: {
    backgroundColor: Colors.surfaceLight,
  },
  stPos: {
    width: 28,
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  stPosTop: {
    color: Colors.primary,
    fontWeight: '800' as const,
  },
  stTeam: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stTeamName: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.text,
    flex: 1,
  },
  stCol: {
    width: 24,
    textAlign: 'center',
  },
  stColPts: {
    width: 28,
    textAlign: 'center',
  },
  stStat: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  stPositive: {
    color: Colors.win,
  },
  stNegative: {
    color: Colors.loss,
  },
  stPts: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: Colors.text,
  },
});
