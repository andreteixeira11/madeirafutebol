import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Animated,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { APP_LOGO_URL, APP_TAGLINE } from '@/constants/branding';
import { APIMatch } from '@/types/football';
import { extractScore, isMatchFinished, isMatchLive, fetchAllMatchesMerged, fetchCompetitionsLogos, buildCompMap, parseMatchDate, getMatchTimestamp } from '@/utils/scores';

function isSameDay(dateA: Date, dateB: Date): boolean {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' });
}

function TeamLogo({ uri, fallback, size = 24 }: { uri?: string; fallback: string; size?: number }) {
  if (uri) {
    return <Image source={{ uri }} style={[styles.teamLogo, { width: size, height: size }]} resizeMode="contain" />;
  }
  return (
    <View style={[styles.teamDot, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.teamDotText, { fontSize: size * 0.45 }]}>{fallback.charAt(0)}</Text>
    </View>
  );
}

const MatchRow = React.memo(function MatchRow({ match, compName }: { match: APIMatch; compName: string }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const score = useMemo(() => extractScore(match), [match]);
  const finished = useMemo(() => isMatchFinished(match), [match]);
  const isLive = isMatchLive(match);

  const homeWin = score ? score.home > score.away : match.winner_team_id === match.team1_id;
  const awayWin = score ? score.away > score.home : match.winner_team_id === match.team2_id;

  const onPressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const onPressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    router.push({
      pathname: '/results/[id]',
      params: {
        id: String(match.id),
        matchData: JSON.stringify(match),
        compName,
      },
    });
  }, [match, compName]);

  const matchTime = useMemo(() => {
    const parsed = parseMatchDate(match.date);
    if (!parsed) return '';
    return parsed.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  }, [match.date]);

  return (
    <Pressable onPress={handlePress} onPressIn={onPressIn} onPressOut={onPressOut} testID={`match-${match.id}`}>
      <Animated.View style={[styles.matchRow, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.matchTeams}>
          <View style={styles.teamRow}>
            <TeamLogo uri={match.team1_logo} fallback={match.team1} />
            <Text style={[styles.teamName, homeWin && finished && styles.winnerName]} numberOfLines={1}>
              {match.team1}
            </Text>
          </View>
          <View style={styles.teamRow}>
            <TeamLogo uri={match.team2_logo} fallback={match.team2} />
            <Text style={[styles.teamName, awayWin && finished && styles.winnerName]} numberOfLines={1}>
              {match.team2}
            </Text>
          </View>
        </View>

        <View style={styles.matchScoreSection}>
          {isLive ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{match.playtime || 'AO VIVO'}</Text>
            </View>
          ) : score ? (
            <View style={styles.finishedScores}>
              <Text style={[styles.scoreText, homeWin && styles.winnerScore]}>{score.home}</Text>
              <Text style={[styles.scoreText, awayWin && styles.winnerScore]}>{score.away}</Text>
            </View>
          ) : finished ? (
            <View style={styles.resultBadge}>
              <Text style={styles.resultBadgeText}>FT</Text>
            </View>
          ) : (
            <View style={styles.scheduledBadge}>
              <Text style={styles.scheduledText}>{matchTime || 'vs'}</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
});

type DateFilter = 'all' | 'today' | 'tomorrow' | 'custom';

interface MatchesGroup {
  competitionId: number;
  competitionName: string;
  matches: APIMatch[];
}

function DatePickerModal({
  visible,
  selectedDate,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedDate: Date | null;
  onSelect: (date: Date) => void;
  onClose: () => void;
}) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const insets = useSafeAreaInsets();

  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const daysInMonth = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    const startOffset = (firstDay + 6) % 7;
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      cells.push(new Date(year, month, d));
    }
    return cells;
  }, [viewMonth]);

  const prevMonth = useCallback(() => {
    setViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const monthLabel = viewMonth.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Escolher Data</Text>
            <Pressable onPress={onClose} style={styles.modalClose}>
              <X size={20} color={Colors.text} />
            </Pressable>
          </View>

          <View style={styles.calendarNav}>
            <Pressable onPress={prevMonth} style={styles.calNavBtn}>
              <ChevronLeft size={20} color={Colors.primary} />
            </Pressable>
            <Text style={styles.calMonthLabel}>{monthLabel}</Text>
            <Pressable onPress={nextMonth} style={styles.calNavBtn}>
              <ChevronRight size={20} color={Colors.primary} />
            </Pressable>
          </View>

          <View style={styles.calWeekDays}>
            {weekDays.map(d => (
              <Text key={d} style={styles.calWeekDay}>{d}</Text>
            ))}
          </View>

          <View style={styles.calGrid}>
            {daysInMonth.map((day, idx) => {
              if (!day) {
                return <View key={`empty-${idx}`} style={styles.calCell} />;
              }
              const isToday = isSameDay(day, today);
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
              return (
                <Pressable
                  key={day.toISOString()}
                  style={[
                    styles.calCell,
                    isToday && styles.calCellToday,
                    isSelected && styles.calCellSelected,
                  ]}
                  onPress={() => {
                    onSelect(day);
                    onClose();
                  }}
                >
                  <Text style={[
                    styles.calCellText,
                    isToday && styles.calCellTodayText,
                    isSelected && styles.calCellSelectedText,
                  ]}>
                    {day.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.quickDates}>
            <Pressable
              style={styles.quickDateBtn}
              onPress={() => { onSelect(today); onClose(); }}
            >
              <Text style={styles.quickDateText}>Hoje</Text>
            </Pressable>
            <Pressable
              style={styles.quickDateBtn}
              onPress={() => {
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);
                onSelect(tomorrow);
                onClose();
              }}
            >
              <Text style={styles.quickDateText}>Amanhã</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const tomorrow = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() + 1); return d; }, [today]);

  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customDate, setCustomDate] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  const selectedDate = useMemo(() => {
    if (dateFilter === 'today') return today;
    if (dateFilter === 'tomorrow') return tomorrow;
    if (dateFilter === 'custom') return customDate;
    return null;
  }, [dateFilter, today, tomorrow, customDate]);

  const { data: allMatches, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['api-matches-merged'],
    queryFn: fetchAllMatchesMerged,
    staleTime: 5 * 60 * 1000,
  });

  const { data: competitions } = useQuery({
    queryKey: ['api-competitions-logos'],
    queryFn: fetchCompetitionsLogos,
    staleTime: 30 * 60 * 1000,
  });

  const competitionMaps = useMemo(() => buildCompMap(competitions ?? []), [competitions]);

  const filteredMatches = useMemo(() => {
    if (!allMatches || !Array.isArray(allMatches)) return [];

    const onlyTodayAndTomorrow = allMatches.filter((m) => {
      const matchDate = parseMatchDate(m.date);
      if (!matchDate) return false;
      return isSameDay(matchDate, today) || isSameDay(matchDate, tomorrow);
    });

    if (dateFilter === 'all') {
      return onlyTodayAndTomorrow;
    }

    if (!selectedDate) return [];

    return allMatches.filter((m) => {
      const matchDate = parseMatchDate(m.date);
      if (!matchDate) return false;
      return isSameDay(matchDate, selectedDate);
    });
  }, [allMatches, selectedDate, dateFilter, today, tomorrow]);

  const groupedMatches = useMemo(() => {
    const groups: Record<string, APIMatch[]> = {};

    filteredMatches.forEach((match) => {
      const key = String(match.competition_id ?? 0);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(match);
    });

    const mapped = Object.entries(groups).map(([competitionIdRaw, matches]): MatchesGroup => {
      const competitionId = Number(competitionIdRaw);
      const competitionName = competitionMaps.nameMap[competitionId] ?? 'Competição';
      const sortedMatches = [...matches].sort((a, b) => {
        const aTime = getMatchTimestamp(a.date);
        const bTime = getMatchTimestamp(b.date);
        return aTime - bTime;
      });

      return {
        competitionId,
        competitionName,
        matches: sortedMatches,
      };
    });

    return mapped.sort((a, b) => a.competitionName.localeCompare(b.competitionName, 'pt'));
  }, [filteredMatches, competitionMaps.nameMap]);

  const handleCalendarSelect = useCallback((date: Date) => {
    const isToday = isSameDay(date, today);
    const isTomorrow = isSameDay(date, tomorrow);
    if (isToday) {
      setDateFilter('today');
      setCustomDate(null);
    } else if (isTomorrow) {
      setDateFilter('tomorrow');
      setCustomDate(null);
    } else {
      setDateFilter('custom');
      setCustomDate(date);
    }
  }, [today, tomorrow]);

  const customDateLabel = useMemo(() => {
    if (dateFilter === 'custom' && customDate) {
      return customDate.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
    }
    return null;
  }, [dateFilter, customDate]);

  const renderCompetitionGroup = useCallback(({ item }: { item: MatchesGroup }) => (
    <View style={styles.competitionSection}>
      <View style={styles.competitionHeader}>
        <Text style={styles.competitionTitle}>{item.competitionName}</Text>
        <Text style={styles.competitionCount}>{item.matches.length}</Text>
      </View>

      <View style={styles.competitionCard}>
        {item.matches.map((match, index) => (
          <View key={match.id}>
            <MatchRow match={match} compName={item.competitionName} />
            {index < item.matches.length - 1 && <View style={styles.matchDivider} />}
          </View>
        ))}
      </View>
    </View>
  ), []);

  const keyExtractor = useCallback((item: MatchesGroup) => `competition-${item.competitionId}`, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Image source={{ uri: APP_LOGO_URL }} style={styles.headerLogo} resizeMode="contain" />
          <View>
            <Text style={styles.headerTitle}>Resultados</Text>
            <Text style={styles.headerSubtitle}>{APP_TAGLINE}</Text>
          </View>
        </View>
      </View>

      <View style={styles.filterBar}>
        <Pressable
          style={[styles.filterPill, dateFilter === 'all' && styles.filterPillActive]}
          onPress={() => { setDateFilter('all'); setCustomDate(null); }}
          testID="filter-all"
        >
          <Text style={[styles.filterPillText, dateFilter === 'all' && styles.filterPillTextActive]}>
            Todos
          </Text>
        </Pressable>

        <Pressable
          style={[styles.filterPill, dateFilter === 'today' && styles.filterPillActive]}
          onPress={() => { setDateFilter('today'); setCustomDate(null); }}
          testID="filter-today"
        >
          <Text style={[styles.filterPillText, dateFilter === 'today' && styles.filterPillTextActive]}>
            Hoje
          </Text>
        </Pressable>

        <Pressable
          style={[styles.filterPill, dateFilter === 'tomorrow' && styles.filterPillActive]}
          onPress={() => { setDateFilter('tomorrow'); setCustomDate(null); }}
          testID="filter-tomorrow"
        >
          <Text style={[styles.filterPillText, dateFilter === 'tomorrow' && styles.filterPillTextActive]}>
            Amanhã
          </Text>
        </Pressable>

        {dateFilter === 'custom' && customDateLabel && (
          <Pressable
            style={[styles.filterPill, styles.filterPillActive]}
            onPress={() => setShowCalendar(true)}
            testID="filter-custom"
          >
            <Text style={[styles.filterPillText, styles.filterPillTextActive]}>
              {customDateLabel}
            </Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.calBtn, dateFilter === 'custom' && styles.calBtnActive]}
          onPress={() => setShowCalendar(true)}
          testID="filter-calendar"
        >
          <Calendar size={18} color={dateFilter === 'custom' ? '#FFFFFF' : Colors.primary} />
        </Pressable>
      </View>

      <View style={styles.dateLabelBar}>
        <Text style={styles.dateLabelText}>
          {dateFilter === 'all'
            ? 'Jogos de hoje e amanhã'
            : selectedDate
            ? dateFilter === 'today'
              ? 'Jogos de hoje'
              : dateFilter === 'tomorrow'
              ? 'Jogos de amanhã'
              : `Jogos de ${formatDisplayDate(selectedDate)}`
            : 'Jogos'}
        </Text>
        <Text style={styles.dateLabelCount}>{filteredMatches.length} jogos</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>A carregar jogos...</Text>
        </View>
      ) : (
        <FlatList
          data={groupedMatches}
          renderItem={renderCompetitionGroup}
          keyExtractor={keyExtractor}
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
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyTitle}>Sem jogos</Text>
              <Text style={styles.emptySubtitle}>
                {selectedDate
                  ? `Não há jogos para ${formatDisplayDate(selectedDate)}`
                  : 'Não há jogos disponíveis'}
              </Text>
              <Pressable style={styles.browseBtn} onPress={() => setShowCalendar(true)}>
                <Calendar size={14} color={Colors.primary} />
                <Text style={styles.browseBtnText}>Ver outro dia</Text>
              </Pressable>
            </View>
          }
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={8}
        />
      )}

      <DatePickerModal
        visible={showCalendar}
        selectedDate={selectedDate}
        onSelect={handleCalendarSelect}
        onClose={() => setShowCalendar(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 36,
    height: 36,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  calBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  calBtnActive: {
    backgroundColor: Colors.primary,
  },
  dateLabelBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dateLabelText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  dateLabelCount: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textMuted,
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
    paddingTop: 8,
    paddingBottom: 30,
    gap: 12,
  },
  competitionSection: {
    marginHorizontal: 12,
    gap: 6,
  },
  competitionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  competitionTitle: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  competitionCount: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  competitionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
  },
  matchTeams: {
    flex: 1,
    gap: 6,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamLogo: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  teamDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamDotText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#EF4444',
  },
  teamName: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    flex: 1,
  },
  winnerName: {
    color: Colors.text,
    fontWeight: '700' as const,
  },
  matchScoreSection: {
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishedScores: {
    gap: 4,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textAlign: 'center',
    minWidth: 20,
  },
  winnerScore: {
    color: Colors.text,
    fontWeight: '800' as const,
  },
  resultBadge: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  resultBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  scheduledBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scheduledText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  matchDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 52,
    marginRight: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  browseBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  calNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calMonthLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    textTransform: 'capitalize',
  },
  calWeekDays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calWeekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  calCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  calCellToday: {
    backgroundColor: Colors.primaryLight,
  },
  calCellSelected: {
    backgroundColor: Colors.primary,
  },
  calCellText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  calCellTodayText: {
    color: Colors.primary,
    fontWeight: '700' as const,
  },
  calCellSelectedText: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  quickDates: {
    flexDirection: 'row',
    gap: 10,
  },
  quickDateBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surfaceLight,
  },
  quickDateText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
});