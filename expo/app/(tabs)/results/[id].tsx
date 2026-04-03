import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Clock, MapPin } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { APIMatch } from '@/types/football';
import { extractScore, isMatchFinished, isMatchLive } from '@/utils/scores';

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

export default function MatchDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; matchData?: string; compName?: string }>();

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
  const goBack = useCallback(() => router.back(), []);

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.matchCard}>
          {isLive && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>{match.playtime || 'AO VIVO'}</Text>
            </View>
          )}
          {finished && !isLive && (
            <Text style={styles.statusLabel}>Resultado Final</Text>
          )}
          {!finished && !isLive && (
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
          </View>
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
    textAlign: 'center',
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
    textTransform: 'uppercase',
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
    textAlign: 'center',
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
    flexWrap: 'wrap',
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
});