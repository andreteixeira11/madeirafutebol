import React, { useMemo, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trophy, ChevronRight, Search } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { Image } from 'expo-image';
import { APP_LOGO_URL } from '@/constants/branding';
import { COMPETITION_CATEGORIES } from '@/types/football';
import {
  fetchCompetitionsLogos,
  CompetitionInfo,
  getCompetitionCategory,
  getCompetitionPopularityOrder,
  getCompetitionShortName,
} from '@/utils/scores';

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function CompLogo({ uri, size = 36 }: { uri?: string; size?: number }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 8 }} resizeMode="contain" />;
  }
  return (
    <View style={[styles.compIconFallback, { width: size, height: size, borderRadius: size * 0.3 }]}> 
      <Trophy size={size * 0.5} color={Colors.primary} />
    </View>
  );
}

const CompetitionRow = React.memo(function CompetitionRow({
  competition,
}: {
  competition: CompetitionInfo;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const onPressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    router.push({
      pathname: '/competitions/[id]',
      params: { id: String(competition.id), title: competition.title },
    });
  }, [competition.id, competition.title]);

  return (
    <Pressable onPress={handlePress} onPressIn={onPressIn} onPressOut={onPressOut} testID={`comp-${competition.id}`}>
      <Animated.View style={[styles.compCard, { transform: [{ scale: scaleAnim }] }]}> 
        <CompLogo uri={competition.logo} size={40} />
        <View style={styles.compInfo}>
          <Text style={styles.compName}>{competition.title}</Text>
        </View>
        <ChevronRight size={18} color={Colors.textMuted} />
      </Animated.View>
    </Pressable>
  );
});

interface CompetitionSection {
  key: string;
  title: string;
  items: CompetitionInfo[];
}

export default function CompetitionsScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState<string>('');

  const { data: competitions, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['api-competitions-logos'],
    queryFn: fetchCompetitionsLogos,
    staleTime: 30 * 60 * 1000,
  });

  const filteredCompetitions = useMemo(() => {
    if (!competitions) return [] as CompetitionInfo[];

    const normalizedSearch = normalizeText(search);

    return [...competitions]
      .filter((competition) => {
        if (!normalizedSearch) return true;
        const shortName = getCompetitionShortName(competition);
        const haystack = [competition.title, shortName].map(normalizeText).join(' ');
        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => {
        const orderA = getCompetitionPopularityOrder(a);
        const orderB = getCompetitionPopularityOrder(b);
        if (orderA !== orderB) return orderA - orderB;
        return a.title.localeCompare(b.title, 'pt');
      });
  }, [competitions, search]);

  const sections = useMemo(() => {
    const sectionMap = new Map<string, CompetitionInfo[]>();

    filteredCompetitions.forEach((competition) => {
      const category = getCompetitionCategory(competition);
      const bucket = sectionMap.get(category) ?? [];
      bucket.push(competition);
      sectionMap.set(category, bucket);
    });

    return COMPETITION_CATEGORIES.map((category): CompetitionSection => ({
      key: category.key,
      title: category.title,
      items: sectionMap.get(category.key) ?? [],
    })).filter((section) => section.items.length > 0);
  }, [filteredCompetitions]);

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}> 
        <View style={styles.header}>
          <Image source={{ uri: APP_LOGO_URL }} style={styles.headerLogo} contentFit="contain" />
          <View>
            <Text style={styles.headerTitle}>Competições</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>A carregar competições...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}> 
        <View style={styles.header}>
          <Image source={{ uri: APP_LOGO_URL }} style={styles.headerLogo} contentFit="contain" />
          <View>
            <Text style={styles.headerTitle}>Competições</Text>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>🏆</Text>
          <Text style={styles.errorTitle}>Erro ao carregar</Text>
          <Text style={styles.errorSubtitle}>Verifique a sua ligação à internet</Text>
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Image source={{ uri: APP_LOGO_URL }} style={styles.headerLogo} contentFit="contain" />
          <Text style={styles.headerTitle}>Competições</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Search size={18} color={Colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Pesquisar competição"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            testID="competition-search-input"
          />
        </View>
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
        {sections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏆</Text>
            <Text style={styles.emptyTitle}>Sem competições</Text>
            <Text style={styles.emptySubtitle}>Nenhuma competição encontrada para a sua pesquisa</Text>
          </View>
        ) : (
          sections.map((section) => (
            <View key={section.key} style={styles.section}>
              {section.key !== 'seniores' ? (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>
              ) : null}
              {section.items.map((comp) => (
                <CompetitionRow
                  key={comp.id}
                  competition={comp}
                />
              ))}
            </View>
          ))
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Dados de madeirafutebol.com</Text>
        </View>
        <View style={{ height: 30 }} />
      </ScrollView>
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  errorSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 30,
  },
  section: {
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  compCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 14,
  },
  compIconFallback: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compInfo: {
    flex: 1,
  },
  compName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    lineHeight: 21,
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
  footer: {
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
});
