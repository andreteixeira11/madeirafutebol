import React, { useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trophy, ChevronRight } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { FEATURED_COMPETITIONS } from '@/types/football';
import { fetchCompetitionsLogos, CompetitionInfo } from '@/utils/scores';

const FEATURED_MAP = new Map(FEATURED_COMPETITIONS.map(c => [c.id, c]));

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
  shortName,
}: {
  competition: CompetitionInfo;
  shortName: string;
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
          <Text style={styles.compName} numberOfLines={1}>{shortName}</Text>
          <Text style={styles.compFullName} numberOfLines={1}>{competition.title}</Text>
        </View>
        <ChevronRight size={18} color={Colors.textMuted} />
      </Animated.View>
    </Pressable>
  );
});

export default function CompetitionsScreen() {
  const insets = useSafeAreaInsets();

  const { data: competitions, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['api-competitions-logos'],
    queryFn: fetchCompetitionsLogos,
    staleTime: 30 * 60 * 1000,
  });

  const filteredCompetitions = useMemo(() => {
    if (!competitions) return [];
    return [...competitions].sort((a, b) => {
      const orderA = FEATURED_MAP.get(a.id)?.order ?? 999;
      const orderB = FEATURED_MAP.get(b.id)?.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title, 'pt');
    });
  }, [competitions]);

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Trophy size={22} color={Colors.primary} />
          <View>
            <Text style={styles.headerTitle}>Competições</Text>
            <Text style={styles.headerSubtitle}>Futebol da Madeira</Text>
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
          <Trophy size={22} color={Colors.primary} />
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
        <Trophy size={22} color={Colors.primary} />
        <View>
          <Text style={styles.headerTitle}>Competições</Text>
          <Text style={styles.headerSubtitle}>Futebol da Madeira</Text>
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
        {filteredCompetitions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏆</Text>
            <Text style={styles.emptyTitle}>Sem competições</Text>
            <Text style={styles.emptySubtitle}>Nenhuma competição encontrada</Text>
          </View>
        ) : (
          filteredCompetitions.map(comp => {
            const featured = FEATURED_MAP.get(comp.id);
            return (
              <CompetitionRow
                key={comp.id}
                competition={comp}
                shortName={featured?.shortName ?? comp.title}
              />
            );
          })
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
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
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
    textAlign: 'center',
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
  },
  compFullName: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: Colors.textSecondary,
    marginTop: 1,
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
