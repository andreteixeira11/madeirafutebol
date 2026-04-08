import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, List, BarChart3, ChevronDown, Check } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { APIMatch } from '@/types/football';
import {
  extractScore,
  fetchCompetitionDetail,
  getMatchTimestamp,
  isMatchFinished,
  isMatchLive,
  mapStandingsPayload,
  parseMatchDate,
} from '@/utils/scores';

function TeamLogo({ uri, fallback, size = 20 }: { uri?: string; fallback: string; size?: number }) {
  if (uri) {
    return (
      <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 3 }} resizeMode="contain" />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: Colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.45, fontWeight: '700' as const, color: Colors.primary }}>
        {fallback.charAt(0)}
      </Text>
    </View>
  );
}

function formatGroupDateLabel(date: Date): string {
  return date.toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatMatchTime(dateValue: string): string {
  const parsed = parseMatchDate(dateValue);
  if (!parsed) {
    return 'Hora por definir';
  }

  return parsed.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

type TabType = 'matches' | 'standings';

interface DateMatchGroup {
  key: string;
  label: string;
  matches: APIMatch[];
}

interface MatchdayOption {
  value: number;
  label: string;
}

export default function CompetitionDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; title?: string }>();
  const competitionId = Number(params.id);

  const [activeTab, setActiveTab] = useState<TabType>('matches');
  const [selectedMatchday, setSelectedMatchday] = useState<number | null>(null);
  const [showMatchdayDropdown, setShowMatchdayDropdown] = useState<boolean>(false);
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

  const matchdayOptions = useMemo((): MatchdayOption[] => {
    const available = (competitionDetail?.matchdays ?? [])
      .map((item) => Number(item.matchday ?? 0))
      .filter((item, index, array) => item > 0 && array.indexOf(item) === index)
      .sort((a, b) => a - b)
      .map((item) => ({ value: item, label: `Jornada ${item}` }));

    console.log(
      `[Competition Detail] Available matchdays for ${competitionId}: ${available.map((item) => item.value).join(', ')}`,
    );

    return available;
  }, [competitionDetail, competitionId]);

  const currentMatchday = useMemo(() => {
    const allMatchdays = competitionDetail?.matchdays ?? [];
    if (allMatchdays.length === 0) {
      return 0;
    }

    const liveGroup = allMatchdays.find((group) => (group.matches ?? []).some((match) => isMatchLive(match)));
    if (liveGroup && Number(liveGroup.matchday ?? 0) > 0) {
      return Number(liveGroup.matchday ?? 0);
    }

    const now = Date.now();
    const datedGroups = allMatchdays
      .map((group) => {
        const timestamps = (group.matches ?? [])
          .map((match) => getMatchTimestamp(match.date))
          .filter((value) => value > 0);

        if (timestamps.length === 0) {
          return null;
        }

        return {
          matchday: Number(group.matchday ?? 0),
          referenceTime: Math.min(...timestamps),
        };
      })
      .filter((group): group is { matchday: number; referenceTime: number } => !!group && group.matchday > 0)
      .sort((a, b) => a.matchday - b.matchday);

    const upcomingGroup = datedGroups.find((group) => group.referenceTime >= now);
    if (upcomingGroup) {
      return upcomingGroup.matchday;
    }

    return datedGroups[datedGroups.length - 1]?.matchday ?? matchdayOptions[matchdayOptions.length - 1]?.value ?? 0;
  }, [competitionDetail, matchdayOptions]);

  useEffect(() => {
    if (hasInitializedMatchday) {
      return;
    }

    const fallbackMatchday = currentMatchday > 0 ? currentMatchday : matchdayOptions[0]?.value ?? 0;
    if (fallbackMatchday > 0) {
      console.log(`[Competition Detail] Defaulting to current matchday ${fallbackMatchday} for ${competitionId}`);
      setSelectedMatchday(fallbackMatchday);
    }
  }, [competitionId, currentMatchday, hasInitializedMatchday, matchdayOptions]);

  const resolvedMatchday = selectedMatchday ?? currentMatchday;
  const selectedMatchdayLabel = useMemo(() => {
    return matchdayOptions.find((option) => option.value === resolvedMatchday)?.label ?? 'Escolher jornada';
  }, [matchdayOptions, resolvedMatchday]);

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
      .map((group) => {
        const matches = [...(group.matches ?? [])].sort((a, b) => getMatchTimestamp(a.date) - getMatchTimestamp(b.date));
        const dateGroups = new Map<string, DateMatchGroup>();

        matches.forEach((match) => {
          const parsed = parseMatchDate(match.date);
          const key = parsed
            ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
            : 'unknown';
          const label = parsed ? formatGroupDateLabel(parsed) : 'Data por definir';
          const existing = dateGroups.get(key);

          if (existing) {
            existing.matches.push(match);
            return;
          }

          dateGroups.set(key, {
            key,
            label,
            matches: [match],
          });
        });

        return {
          matchday: Number(group.matchday ?? 0),
          roundLabel: Number(group.matchday ?? 0) > 0 ? `Jornada ${group.matchday}` : 'Sem Jornada',
          dateGroups: Array.from(dateGroups.values()).sort((a, b) => {
            const aTime = getMatchTimestamp(a.matches[0]?.date);
            const bTime = getMatchTimestamp(b.matches[0]?.date);
            return aTime - bTime;
          }),
        };
      })
      .sort((a, b) => a.matchday - b.matchday);
  }, [filteredMatchdays]);

  const goBack = useCallback(() => router.back(), []);

  const handleSelectMatchday = useCallback((value: number) => {
    setSelectedMatchday(value);
    setShowMatchdayDropdown(false);
  }, []);

  const handleMatchPress = useCallback(
    (match: APIMatch, roundLabel: string) => {
      router.push({
        pathname: '/results/[id]',
        params: {
          id: String(match.id),
          matchData: JSON.stringify(match),
          compName: compTitle,
          competitionId: String(match.competition_id ?? competitionId),
          compLogo,
          matchdayLabel: roundLabel,
        },
      });
    },
    [compLogo, compTitle, competitionId],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <View style={styles.topBar}>
        <Pressable onPress={goBack} style={styles.backBtn} testID="back-btn">
          <ArrowLeft size={22} color={Colors.text} />
        </Pressable>
        {compLogo ? <Image source={{ uri: compLogo }} style={styles.topBarLogo} resizeMode="contain" /> : null}
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {compTitle}
        </Text>
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
        <>
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
                    <Pressable
                      style={styles.matchdayDropdownTrigger}
                      onPress={() => setShowMatchdayDropdown(true)}
                      testID="matchday-dropdown-trigger"
                    >
                      <Text style={styles.matchdayDropdownText}>{selectedMatchdayLabel}</Text>
                      <ChevronDown size={18} color={Colors.primary} />
                    </Pressable>
                  </View>

                  <View style={styles.roundsContainer}>
                    {matchesByRound.map((group) => (
                      <View key={group.roundLabel} style={styles.roundCard}>
                        <View style={styles.roundHeader}>
                          <Text style={styles.roundTitle}>{group.roundLabel}</Text>
                        </View>

                        {group.dateGroups.map((dateGroup) => (
                          <View key={`${group.roundLabel}-${dateGroup.key}`}>
                            <View style={styles.dateGroupHeader}>
                              <Text style={styles.dateGroupTitle}>{dateGroup.label}</Text>
                            </View>

                            {dateGroup.matches.map((match, mIdx) => {
                              const score = extractScore(match);
                              const finished = isMatchFinished(match);
                              const isLive = isMatchLive(match);
                              const homeWin = score
                                ? score.home > score.away
                                : match.winner_team_id === match.team1_id;
                              const awayWin = score
                                ? score.away > score.home
                                : match.winner_team_id === match.team2_id;

                              return (
                                <View key={match.id}>
                                  <Pressable
                                    style={styles.matchRow}
                                    onPress={() => handleMatchPress(match, group.roundLabel)}
                                    testID={`match-${match.id}`}
                                  >
                                    <View style={styles.matchTeamsCol}>
                                      <View style={styles.matchMetaRow}>
                                        <Text style={styles.matchTimeText}>{formatMatchTime(match.date)}</Text>
                                      </View>
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
                                          <Text style={styles.liveText}>{match.playtime || 'LIVE'}</Text>
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
                                  {mIdx < dateGroup.matches.length - 1 ? <View style={styles.matchDivider} /> : null}
                                </View>
                              );
                            })}
                          </View>
                        ))}
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
                      <Text style={styles.stTeamName} numberOfLines={1}>
                        {row.teamName}
                      </Text>
                    </View>
                    <Text style={[styles.stStat, styles.stCol]}>{row.played}</Text>
                    <Text style={[styles.stStat, styles.stCol]}>{row.won}</Text>
                    <Text style={[styles.stStat, styles.stCol]}>{row.drawn}</Text>
                    <Text style={[styles.stStat, styles.stCol]}>{row.lost}</Text>
                    <Text style={[styles.stStat, styles.stCol]}>{row.goalsFor}</Text>
                    <Text style={[styles.stStat, styles.stCol]}>{row.goalsAgainst}</Text>
                    <Text
                      style={[
                        styles.stStat,
                        styles.stCol,
                        row.goalDifference > 0 && styles.stPositive,
                        row.goalDifference < 0 && styles.stNegative,
                      ]}
                    >
                      {row.goalDifference > 0 ? '+' : ''}
                      {row.goalDifference}
                    </Text>
                    <Text style={[styles.stPts, styles.stColPts]}>{row.points}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>

          <Modal
            visible={showMatchdayDropdown}
            transparent
            animationType="fade"
            onRequestClose={() => setShowMatchdayDropdown(false)}
          >
            <View style={styles.dropdownOverlay}>
              <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowMatchdayDropdown(false)} />
              <View style={[styles.dropdownSheet, { paddingBottom: insets.bottom + 16 }]}>
                <View style={styles.dropdownHandle} />
                <Text style={styles.dropdownTitle}>Escolher jornada</Text>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.dropdownOptions}>
                  {matchdayOptions.map((option) => {
                    const selected = option.value === resolvedMatchday;
                    return (
                      <Pressable
                        key={option.value}
                        style={[styles.dropdownOption, selected && styles.dropdownOptionActive]}
                        onPress={() => handleSelectMatchday(option.value)}
                        testID={`matchday-option-${option.value}`}
                      >
                        <Text style={[styles.dropdownOptionText, selected && styles.dropdownOptionTextActive]}>
                          {option.label}
                        </Text>
                        {selected ? <Check size={18} color={Colors.primary} /> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </>
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
  matchdayDropdownTrigger: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchdayDropdownText: {
    fontSize: 15,
    fontWeight: '700' as const,
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
  dateGroupHeader: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dateGroupTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    textTransform: 'capitalize' as const,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  matchTeamsCol: {
    flex: 1,
    gap: 6,
  },
  matchMetaRow: {
    marginBottom: 2,
  },
  matchTimeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  matchTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchTeamName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  winnerName: {
    fontWeight: '800' as const,
  },
  matchScoreCol: {
    width: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  liveBadge: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#EF4444',
  },
  scoreNum: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  winnerScore: {
    color: Colors.text,
    fontWeight: '900' as const,
  },
  ftText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: Colors.textMuted,
  },
  vsLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  matchDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 72,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  standingsCard: {
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  standingsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stHeaderText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: Colors.textSecondary,
  },
  stRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  stRowAlt: {
    backgroundColor: '#FCFCFD',
  },
  stPos: {
    width: 28,
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textMuted,
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
    width: 28,
    textAlign: 'center' as const,
  },
  stColPts: {
    width: 34,
    textAlign: 'center' as const,
  },
  stStat: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  stPositive: {
    color: '#0F9D58',
  },
  stNegative: {
    color: '#D93025',
  },
  stPts: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.24)',
    justifyContent: 'flex-end',
  },
  dropdownSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 16,
    maxHeight: '68%',
  },
  dropdownHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  dropdownTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  dropdownOptions: {
    paddingBottom: 12,
  },
  dropdownOption: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dropdownOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  dropdownOptionText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  dropdownOptionTextActive: {
    color: Colors.primary,
  },
});
