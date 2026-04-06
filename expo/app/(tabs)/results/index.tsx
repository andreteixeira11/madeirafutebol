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
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, X, ChevronLeft, ChevronRight, Search, Trophy } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { APP_LOGO_URL } from '@/constants/branding';
import { APIMatch } from '@/types/football';
import {
  extractScore,
  isMatchFinished,
  isMatchLive,
  fetchAllMatchesMerged,
  fetchCompetitionsLogos,
  parseMatchDate,
  getMatchTimestamp,
  CompetitionInfo,
  getCompetitionPopularityOrder,
} from '@/utils/scores';

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

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

function CompetitionLogo({ uri }: { uri?: string }) {
  if (uri) {
    return <Image source={{ uri }} style={styles.competitionLogo} resizeMode="contain" />;
  }
  return (
    <View style={styles.competitionLogoFallback}>
      <Trophy size={14} color={Colors.primary} />
    </View>
  );
}

const MatchRow = React.memo(function MatchRow({
  match,
  compName,
  competitionId,
  compLogo,
}: {
  match: APIMatch;
  compName: string;
  competitionId: number;
  compLogo?: string;
}) {
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
        competitionId: String(competitionId),
        compLogo,
      },
    });
  }, [match, compName, competitionId, compLogo]);

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

type DateFilter = 'today' | 'tomorrow' | 'custom';

interface MatchesGroup {
  competitionId: number;
  competitionName: string;
  competitionLogo?: string;
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
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
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
    for (let i = 0; i < startOffset; i += 1) cells.push(null);
    for (let day = 1; day <= totalDays; day += 1) {
      cells.push(new Date(year, month, day));
    }
    return cells;
  }, [viewMonth]);

  const prevMonth = useCallback(() => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
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
            {weekDays.map((day) => (
              <Text key={day} style={styles.calWeekDay}>{day}</Text>
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
                  <Text
                    style={[
                      styles.calCellText,
                      isToday && styles.calCellTodayText,
                      isSelected && styles.calCellSelectedText,
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.quickDates}>
            <Pressable
              style={styles.quickDateBtn}
              onPress={() => {
                onSelect(today);
                onClose();
              }}
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
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const tomorrow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }, [today]);

  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customDate, setCustomDate] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState<boolean>(false);
  const [teamSearch, setTeamSearch] = useState<string>('');

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

  const competitionMaps = useMemo(() => {
  const nameMap: Record<number, string> = {};
  const logoMap: Record<number, string> = {};

  (competitions ?? []).forEach((competition) => {
    nameMap[competition.id] = competition.title;
    if (competition.logo) {
      logoMap[competition.id] = competition.logo;
    }
  });

  return { nameMap, logoMap };
  }, [competitions]);
  const competitionList = useMemo(() => competitions ?? ([] as CompetitionInfo[]), [competitions]);

  const filteredMatches = useMemo(() => {
    if (!allMatches || !Array.isArray(allMatches)) return [] as APIMatch[];

    const matchesByDate = allMatches.filter((match) => {
      const matchDate = parseMatchDate(match.date);
      if (!matchDate) return false;

      if (!selectedDate) return false;
      return isSameDay(matchDate, selectedDate);
    });

    const normalizedSearch = normalizeText(teamSearch);
    if (!normalizedSearch) {
      return matchesByDate;
    }

    return matchesByDate.filter((match) => {
      const haystack = `${match.team1} ${match.team2}`;
      return normalizeText(haystack).includes(normalizedSearch);
    });
  }, [allMatches, selectedDate, teamSearch]);

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
      const competitionLogo = competitionMaps.logoMap[competitionId];
      const sortedMatches = [...matches].sort((a, b) => getMatchTimestamp(a.date) - getMatchTimestamp(b.date));

      return {
        competitionId,
        competitionName,
        competitionLogo,
        matches: sortedMatches,
      };
    });

    return mapped.sort((a, b) => {
      const compA = competitionList.find((item) => item.id === a.competitionId);
      const compB = competitionList.find((item) => item.id === b.competitionId);
      const orderA = compA ? getCompetitionPopularityOrder(compA) : 999;
      const orderB = compB ? getCompetitionPopularityOrder(compB) : 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.competitionName.localeCompare(b.competitionName, 'pt');
    });
  }, [filteredMatches, competitionList, competitionMaps.logoMap, competitionMaps.nameMap]);

  const handleCalendarSelect = useCallback((date: Date) => {
    const isTodayDate = isSameDay(date, today);
    const isTomorrowDate = isSameDay(date, tomorrow);
    if (isTodayDate) {
      setDateFilter('today');
      setCustomDate(null);
    } else if (isTomorrowDate) {
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
        <View style={styles.competitionHeaderLeft}>
          <CompetitionLogo uri={item.competitionLogo} />
          <Text style={styles.competitionTitle}>{item.competitionName}</Text>
        </View>
      </View>

      <View style={styles.competitionCard}>
        {item.matches.map((match, index) => (
          <View key={match.id}>
            <MatchRow
              match={match}
              compName={item.competitionName}
              competitionId={item.competitionId}
              compLogo={item.competitionLogo}
            />
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
          </View>
        </View>
      </View>

      <View style={styles.filterBar}>
        <Pressable
          style={[styles.filterPill, dateFilter === 'today' && styles.filterPillActive]}
          onPress={() => {
            setDateFilter('today');
            setCustomDate(null);
          }}
          testID="filter-today"
        >
          <Text style={[styles.filterPillText, dateFilter === 'today' && styles.filterPillTextActive]}>Hoje</Text>
        </Pressable>

        <Pressable
          style={[styles.filterPill, dateFilter === 'tomorrow' && styles.filterPillActive]}
          onPress={() => {
            setDateFilter('tomorrow');
            setCustomDate(null);
          }}
          testID="filter-tomorrow"
        >
          <Text style={[styles.filterPillText, dateFilter === 'tomorrow' && styles.filterPillTextActive]}>Amanhã</Text>
        </Pressable>

        {dateFilter === 'custom' && customDateLabel ? (
          <Pressable
            style={[styles.filterPill, styles.filterPillActive]}
            onPress={() => setShowCalendar(true)}
            testID="filter-custom"
          >
            <Text style={[styles.filterPillText, styles.filterPillTextActive]}>{customDateLabel}</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={[styles.calBtn, dateFilter === 'custom' && styles.calBtnActive]}
          onPress={() => setShowCalendar(true)}
          testID="filter-calendar"
        >
          <Calendar size={18} color={dateFilter === 'custom' ? '#FFFFFF' : Colors.primary} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Search size={18} color={Colors.textMuted} />
          <TextInput
            value={teamSearch}
            onChangeText={setTeamSearch}
            placeholder="Pesquisar por equipa"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            testID="team-search-input"
          />
        </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
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
    width: 44,
    height: 44,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -0.5,
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
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
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
  competitionHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  competitionTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800' as const,
    color: Colors.text,
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
    textAlign: 'center' as const,
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
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  browseBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  browseBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(13,26,18,0.25)',
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
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceLight,
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  calMonthLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    textTransform: 'capitalize' as const,
  },
  calWeekDays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calWeekDay: {
    flex: 1,
    textAlign: 'center' as const,
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    marginHorizontal: -4,
  },
  calCell: {
    width: '14.2857%',
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calCellToday: {
    borderRadius: 14,
  },
  calCellSelected: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
  },
  calCellText: {
    width: 36,
    height: 36,
    lineHeight: 36,
    textAlign: 'center' as const,
    fontSize: 14,
    color: Colors.text,
  },
  calCellTodayText: {
    color: Colors.primary,
    fontWeight: '800' as const,
  },
  calCellSelectedText: {
    color: '#FFFFFF',
    fontWeight: '800' as const,
  },
  quickDates: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 18,
  },
  quickDateBtn: {
    flex: 1,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickDateText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
});
