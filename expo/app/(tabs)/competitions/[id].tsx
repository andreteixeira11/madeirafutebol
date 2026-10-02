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
import { APIMatch, StandingRow } from '@/types/football';
import {
  extractScore,
  fetchCompetitionDetail,
  getMatchTimestamp,
  isMatchFinished,
  isMatchLive,
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

interface RoundOption {
  value: number;
  label: string;
}

export default function CompetitionDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; title?: string }>();
  const competitionId = Number(params.id);

  const [activeTab, setActiveTab] = useState<TabType>('matches');
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);
  const [showRoundDropdown, setShowRoundDropdown] = useState<boolean>(false);
  const hasInitializedRound = selectedRoundId !== null;

  const { data: detail, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['competition-detail', competitionId],
    queryFn: () => fetchCompetitionDetail(competitionId),
    enabled: !!competitionId,
    staleTime: 30 * 1000,
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasLive = (data?.rounds ?? []).some((round) =>
        (round.matches ?? []).some((match) => isMatchLive(match)),
      );
      return hasLive ? 15 * 1000 : 60 * 1000;
    },
    refetchIntervalInBackground: true,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  const fallbackTitle = params.title || 'Competição';
  const compTitle = detail?.competition.name ?? fallbackTitle;
  const compLogo = detail?.competition.logo;
  const isCupFormat = detail?.competition.format === 'cup';

  const rounds = useMemo(() => detail?.rounds ?? [], [detail]);

  const roundOptions = useMemo((): RoundOption[] => {
    return rounds.map((round) => ({
      value: round.id,
      label: round.label,
    }));
  }, [rounds]);

  // Jornada/eliminatória atual: ronda com jogos ao vivo → primeira ronda ainda
  // não terminada (em curso ou a seguir) → última ronda (época terminada)
  const currentRoundId = useMemo(() => {
    if (rounds.length === 0) return 0;

    const liveRound = rounds.find((round) => (round.matches ?? []).some((match) => isMatchLive(match)));
    if (liveRound) return liveRound.id;

    const now = Date.now();

    const datedRounds = rounds
      .map((round) => {
        const timestamps = (round.matches ?? [])
          .map((match) => getMatchTimestamp(match.date))
          .filter((value) => value > 0);

        if (timestamps.length === 0) return null;

        return {
          id: round.id,
          minTime: Math.min(...timestamps),
          maxTime: Math.max(...timestamps),
        };
      })
      .filter((round): round is { id: number; minTime: number; maxTime: number } => !!round)
      .sort((a, b) => a.id - b.id);

    if (datedRounds.length === 0) {
      return roundOptions[roundOptions.length - 1]?.value ?? 0;
    }

    // Em curso (contém agora) ou a próxima — cobre os dias entre jornadas
    const ongoingOrNext = datedRounds.find((round) => round.maxTime >= now);
    if (ongoingOrNext) return ongoingOrNext.id;

    return datedRounds[datedRounds.length - 1].id;
  }, [rounds, roundOptions]);

  // Nova competição: repor a seleção para abrir na jornada atual
  useEffect(() => {
    setSelectedRoundId(null);
  }, [competitionId]);

  useEffect(() => {
    if (hasInitializedRound) {
      return;
    }

    const fallbackRound = currentRoundId > 0 ? currentRoundId : roundOptions[0]?.value ?? 0;
    if (fallbackRound > 0) {
      setSelectedRoundId(fallbackRound);
    }
  }, [competitionId, currentRoundId, hasInitializedRound, roundOptions]);

  const resolvedRoundId = selectedRoundId ?? currentRoundId;

  const selectedRound = useMemo(() => {
    return rounds.find((round) => round.id === resolvedRoundId) ?? null;
  }, [rounds, resolvedRoundId]);

  const selectedRoundLabel = useMemo(() => {
    return (
      roundOptions.find((option) => option.value === resolvedRoundId)?.label ??
      (isCupFormat ? 'Escolher eliminatória' : 'Escolher jornada')
    );
  }, [roundOptions, resolvedRoundId, isCupFormat]);

  const standings = useMemo((): StandingRow[] => detail?.standings ?? [], [detail]);

  // Jogos da ronda selecionada, agrupados por dia
  const dateGroups = useMemo((): DateMatchGroup[] => {
    const matches = [...(selectedRound?.matches ?? [])].sort(
      (a, b) => getMatchTimestamp(a.date) - getMatchTimestamp(b.date),
    );

    const groups = new Map<string, DateMatchGroup>();

    matches.forEach((match) => {
      const parsed = parseMatchDate(match.date);
      const key = parsed
        ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
        : 'unknown';
      const label = parsed ? formatGroupDateLabel(parsed) : 'Data por definir';
      const existing = groups.get(key);

      if (existing) {
        existing.matches.push(match);
        return;
      }

      groups.set(key, { key, label, matches: [match] });
    });

    return Array.from(groups.values());
  }, [selectedRound]);

  const roundMatches = selectedRound?.matches ?? [];

  const goBack = useCallback(() => router.back(), []);

  const handleSelectRound = useCallback((value: number) => {
    setSelectedRoundId(value);
    setShowRoundDropdown(false);
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
          isCup: isCupFormat ? '1' : '0',
        },
      });
    },
    [compLogo, compTitle, competitionId, isCupFormat],
  );

  const renderRoundChips = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.roundsList}
    >
      {roundOptions.map((option) => {
        const selected = option.value === resolvedRoundId;
        return (
          <Pressable
            key={option.value}
            style={[styles.roundChip, selected && styles.roundChipActive]}
            onPress={() => handleSelectRound(option.value)}
            testID={`round-option-${option.value}`}
          >
            <Text style={[styles.roundChipText, selected && styles.roundChipTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const renderRoundDropdown = () => (
    <Pressable
      style={styles.dropdownTrigger}
      onPress={() => setShowRoundDropdown(true)}
      testID="round-dropdown-trigger"
    >
      <Text style={styles.dropdownTriggerText}>{selectedRoundLabel}</Text>
      <ChevronDown size={18} color={Colors.primary} />
    </Pressable>
  );

  const renderMatchCard = (match: APIMatch, roundLabel: string, mIdx: number, totalInGroup: number) => {
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
          onPress={() => handleMatchPress(match, roundLabel)}
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
        {mIdx < totalInGroup - 1 ? <View style={styles.matchDivider} /> : null}
      </View>
    );
  };

  const renderMatches = () => {
    if (rounds.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⚽</Text>
          <Text style={styles.emptyTitle}>Sem jogos</Text>
          <Text style={styles.emptySubtitle}>Nenhum jogo registado nesta competição</Text>
        </View>
      );
    }

    if (roundOptions.length > 0) {
      return (
        <View style={styles.roundPickerSection}>
          <Text style={styles.roundPickerLabel}>
            {isCupFormat ? 'Escolhe a eliminatória' : 'Jornada'}
          </Text>
          {isCupFormat ? renderRoundChips() : renderRoundDropdown()}
        </View>
      );
    }

    return null;
  };

  const renderRoundMatches = () => {
    if (roundMatches.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⚽</Text>
          <Text style={styles.emptyTitle}>
            {isCupFormat ? 'Sem jogos nesta eliminatória' : 'Sem jogos nesta jornada'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {isCupFormat
              ? 'Esta eliminatória ainda não tem jogos disponíveis'
              : 'Esta jornada ainda não tem jogos disponíveis'}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.roundCard}>
        <View style={styles.roundHeader}>
          <Text style={styles.roundTitle}>{selectedRoundLabel}</Text>
        </View>

        {dateGroups.map((dateGroup) => (
          <View key={dateGroup.key}>
            <View style={styles.dateGroupHeader}>
              <Text style={styles.dateGroupTitle}>{dateGroup.label}</Text>
            </View>

            {dateGroup.matches.map((match, mIdx) =>
              renderMatchCard(match, selectedRoundLabel, mIdx, dateGroup.matches.length),
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderStandings = () => {
    if (standings.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>Sem classificação</Text>
          <Text style={styles.emptySubtitle}>Ainda não existem dados de classificação</Text>
        </View>
      );
    }

    return (
      <View style={styles.standingsCard}>
        <View style={styles.standingsHeaderRow}>
          <Text style={[styles.stHeaderText, { width: 28, textAlign: 'center' as const }]}>#</Text>
          <Text style={[styles.stHeaderText, { flex: 1 }]}>Equipa</Text>
          <Text style={[styles.stHeaderText, styles.stCol]}>JGS</Text>
          <Text style={[styles.stHeaderText, styles.stCol]}>V</Text>
          <Text style={[styles.stHeaderText, styles.stCol]}>E</Text>
          <Text style={[styles.stHeaderText, styles.stCol]}>D</Text>
          <Text style={[styles.stHeaderText, styles.stCol]}>GM</Text>
          <Text style={[styles.stHeaderText, styles.stCol]}>GS</Text>
          <Text style={[styles.stHeaderText, styles.stCol]}>DG</Text>
          <Text style={[styles.stHeaderText, styles.stColPts]}>PTS</Text>
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
    );
  };

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

      {!isCupFormat ? (
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
      ) : null}

      {isLoading ? (
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
            {isCupFormat || activeTab === 'matches' ? (
              <>
                {renderMatches()}
                {renderRoundMatches()}
              </>
            ) : (
              renderStandings()
            )}

            <View style={{ height: 40 }} />
          </ScrollView>

          <Modal
            visible={!isCupFormat && showRoundDropdown}
            transparent
            animationType="fade"
            onRequestClose={() => setShowRoundDropdown(false)}
          >
            <View style={styles.dropdownOverlay}>
              <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowRoundDropdown(false)} />
              <View style={[styles.dropdownSheet, { paddingBottom: insets.bottom + 16 }]}>
                <View style={styles.dropdownHandle} />
                <Text style={styles.dropdownTitle}>Escolher jornada</Text>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.dropdownOptions}>
                  {roundOptions.map((option) => {
                    const selected = option.value === resolvedRoundId;
                    return (
                      <Pressable
                        key={option.value}
                        style={[styles.dropdownOption, selected && styles.dropdownOptionActive]}
                        onPress={() => handleSelectRound(option.value)}
                        testID={`round-option-${option.value}`}
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
  roundPickerSection: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  roundPickerLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  dropdownTrigger: {
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
  dropdownTriggerText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  roundsList: {
    gap: 8,
    paddingRight: 12,
  },
  roundChip: {
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roundChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roundChipText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: Colors.textSecondary,
  },
  roundChipTextActive: {
    color: '#FFFFFF',
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
  roundCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginHorizontal: 12,
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
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    lineHeight: 18,
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
