import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Clock, MapPin, Trophy } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { APIMatch } from '@/types/football';
import { extractScore, isMatchFinished, isMatchLive, fetchCompetitionStandings } from '@/utils/scores';

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function TeamLogo({ uri, fallback, size = 52 }: { uri?: string; fallback: string; size?: number }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 8 }} resizeMode="contain" />;
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
      <Text style={{ fontSize: size * 0.4, fontWeight: '700' as const, color: Colors.primary }}>
        {fallback.charAt(0)}
      </Text>
    </View>
  );
}

function CompetitionLogo({ uri }: { uri?: string }) {
  if (uri) {
    return <Image source={{ uri }} style={styles.competitionLogo} resizeMode="contain" />;
  }
  return (
    <View style={styles.competitionLogoFallback}>
      <Trophy size={16} color={Colors.primary} />
    </View>
  );
}

export default function MatchDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string;
    matchData?: string;
    compName?: string;
    competitionId?: string;
    compLogo?: string;
    matchdayLabel?: string;
  }>();

  const match: APIMatch | null = useMemo(() => {
    if (params.matchData) {
      try {
        return JSON.parse(params.matchData) as APIMatch;
      } catch {
        return null;
      }
    }
    return null;
  }, [params.matchData]);

  const compName = params.compName || '';
  const compLogo = params.compLogo;
  const competitionId = Number(params.competitionId ?? match?.competition_id ?? 0);
  const goBack = useCallback(() => router.back(), []);
  const matchdayLabel = useMemo(() => {
    if (typeof params.matchdayLabel === 'string' && params.matchdayLabel.trim().length > 0) {
      return params.matchdayLabel.trim();
    }

    const rawMatchday = Number(match?.matchday ?? 0);
    if (rawMatchday > 0) {
      return `Jornada ${rawMatchday}`;
    }

    return null;
  }, [match?.matchday, params.matchdayLabel]);

  const { data: standings, isLoading: standingsLoading, refetch, isRefetching } = useQuery({
    queryKey: ['competition-standings', competitionId],
    queryFn: () => fetchCompetitionStandings(competitionId),
    enabled: competitionId > 0,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: true,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  if (!match) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}> 
        <View style={styles.topBar}>
          <Pressable onPress={goBack} style={styles.backBtn}>
            <ArrowLeft size={22} color={Colors.text} />
          </Pressable>
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Jogo não encontrado</Text>
        </View>
      </View>
    );
  }

  const score = extractScore(match);
  const finished = isMatchFinished(match);
  const isLive = isMatchLive(match);
  const homeWin = score ? score.home > score.away : match.winner_team_id === match.team1_id;
  const awayWin = score ? score.away > score.home : match.winner_team_id === match.team2_id;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <View style={styles.topBar}>
        <Pressable onPress={goBack} style={styles.backBtn} testID="back-btn">
          <ArrowLeft size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>{compName || 'Detalhe do Jogo'}</Text>
        <View style={styles.backBtn} />
      </View>

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
        <View style={styles.matchCard}>
          <View style={styles.competitionBadge}>
            <CompetitionLogo uri={compLogo} />
            <Text style={styles.competitionBadgeText} numberOfLines={1}>{compName || 'Competição'}</Text>
          </View>

          {isLive ? (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>{match.playtime || 'AO VIVO'}</Text>
            </View>
          ) : finished ? (
            <Text style={styles.statusLabel}>Resultado Final</Text>
          ) : (
            <Text style={styles.statusLabel}>Por jogar</Text>
          )}

          <View style={styles.matchupRow}>
            <View style={styles.matchTeamCol}>
              <TeamLogo uri={match.team1_logo} fallback={match.team1} size={52} />
              <Text style={[styles.matchTeamName, homeWin && styles.winnerText]} numberOfLines={2}>
                {match.team1}
              </Text>
            </View>

            <View style={styles.scoreContainer}>
              {score ? (
                <View style={styles.scoreDisplay}>
                  <Text style={[styles.scoreBig, homeWin && styles.winnerScoreBig]}>{score.home}</Text>
                  <Text style={styles.scoreSeparator}>-</Text>
                  <Text style={[styles.scoreBig, awayWin && styles.winnerScoreBig]}>{score.away}</Text>
                </View>
              ) : (
                <Text style={styles.vsText}>vs</Text>
              )}
            </View>

            <View style={styles.matchTeamCol}>
              <TeamLogo uri={match.team2_logo} fallback={match.team2} size={52} />
              <Text style={[styles.matchTeamName, awayWin && styles.winnerText]} numberOfLines={2}>
                {match.team2}
              </Text>
            </View>
          </View>

          <View style={styles.matchInfoRow}>
            <View style={styles.infoChip}>
              <Clock size={13} color={Colors.textSecondary} />
              <Text style={styles.infoChipText}>{formatTime(match.date)}</Text>
            </View>
            <View style={styles.infoChip}>
              <MapPin size={13} color={Colors.textSecondary} />
              <Text style={styles.infoChipText}>{formatFullDate(match.date)}</Text>
            </View>
            {matchdayLabel ? (
              <View style={styles.infoChip}>
                <Trophy size={13} color={Colors.textSecondary} />
                <Text style={styles.infoChipText}>{matchdayLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.standingsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Classificação</Text>
          </View>

          {standingsLoading ? (
            <View style={styles.standingsLoading}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.standingsLoadingText}>A carregar classificação...</Text>
            </View>
          ) : !standings || standings.length === 0 ? (
            <View style={styles.standingsEmpty}>
              <Text style={styles.standingsEmptyText}>Classificação indisponível.</Text>
            </View>
          ) : (
            <View style={styles.standingsCard}>
              <View style={styles.standingsHeaderRow}>
                <Text style={[styles.stHeaderText, { width: 28, textAlign: 'center' as const }]}>#</Text>
                <Text style={[styles.stHeaderText, { flex: 1 }]}>Equipa</Text>
                <Text style={[styles.stHeaderText, styles.stCol]}>J</Text>
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
        </View>
      </ScrollView>
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
  topBarTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  matchCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  competitionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 16,
    maxWidth: '100%',
  },
  competitionLogo: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  competitionLogoFallback: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  competitionBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text,
    flexShrink: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 16,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  liveLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#EF4444',
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    marginBottom: 16,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    justifyContent: 'space-between',
  },
  matchTeamCol: {
    width: 90,
    alignItems: 'center',
    gap: 8,
  },
  matchTeamName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    lineHeight: 17,
  },
  winnerText: {
    fontWeight: '800' as const,
  },
  scoreContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreBig: {
    fontSize: 36,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
  },
  winnerScoreBig: {
    color: Colors.text,
    fontWeight: '900' as const,
  },
  scoreSeparator: {
    fontSize: 28,
    fontWeight: '300' as const,
    color: Colors.textMuted,
  },
  vsText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  matchInfoRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  infoChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  standingsSection: {
    marginTop: 16,
    marginHorizontal: 12,
  },
  sectionHeader: {
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  standingsLoading: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  standingsLoadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  standingsEmpty: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 18,
  },
  standingsEmptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  standingsCard: {
    backgroundColor: Colors.surface,
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
    width: 36,
    textAlign: 'center' as const,
  },
  stColPts: {
    width: 40,
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
});
