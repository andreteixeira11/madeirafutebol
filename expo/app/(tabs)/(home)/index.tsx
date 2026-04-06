import React, { useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { APP_LOGO_URL, APP_NAME } from '@/constants/branding';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clock } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { WPPost } from '@/types/football';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '\u201C')
    .replace(/&#8221;/g, '\u201D')
    .replace(/&#8211;/g, '\u2013')
    .replace(/&hellip;/g, '\u2026')
    .replace(/&#8230;/g, '\u2026')
    .replace(/\n/g, ' ')
    .trim();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffHours < 1) return 'Agora';
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays} dias atrás`;
  return date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
}

function getImageUrl(post: WPPost): string {
  const media = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;
  if (media) return media;
  return 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&h=400&fit=crop';
}

async function fetchPosts(): Promise<WPPost[]> {
  console.log('[Home] Fetching posts...');
  const response = await fetch(
    'https://www.madeirafutebol.com/wp-json/wp/v2/posts?per_page=20&_embed'
  );
  if (!response.ok) throw new Error(`Failed to fetch posts: ${response.status}`);
  return response.json();
}

const FeaturedCard = React.memo(function FeaturedCard({ post, onPress }: { post: WPPost; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onPressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  }, [scaleAnim]);
  const onPressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  }, [scaleAnim]);
  const title = useMemo(() => stripHtml(post.title.rendered), [post.title.rendered]);
  const imageUrl = useMemo(() => getImageUrl(post), [post]);

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} testID="featured-card">
      <Animated.View style={[styles.featuredCard, { transform: [{ scale: scaleAnim }] }]}>
        <Image source={{ uri: imageUrl }} style={styles.featuredImage} contentFit="cover" />
        <View style={styles.featuredOverlay} />
        <View style={styles.featuredContent}>
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredBadgeText}>DESTAQUE</Text>
          </View>
          <Text style={styles.featuredTitle} numberOfLines={3}>{title}</Text>
          <View style={styles.featuredMeta}>
            <Clock size={12} color="rgba(255,255,255,0.7)" />
            <Text style={styles.featuredDate}>{formatDate(post.date)}</Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
});

const NewsCard = React.memo(function NewsCard({ post, onPress }: { post: WPPost; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onPressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start();
  }, [scaleAnim]);
  const onPressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  }, [scaleAnim]);
  const title = useMemo(() => stripHtml(post.title.rendered), [post.title.rendered]);
  const excerpt = useMemo(() => stripHtml(post.excerpt.rendered), [post.excerpt.rendered]);
  const imageUrl = useMemo(() => getImageUrl(post), [post]);

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} testID={`news-card-${post.id}`}>
      <Animated.View style={[styles.newsCard, { transform: [{ scale: scaleAnim }] }]}>
        <Image source={{ uri: imageUrl }} style={styles.newsImage} contentFit="cover" />
        <View style={styles.newsContent}>
          <Text style={styles.newsTitle} numberOfLines={2}>{title}</Text>
          <Text style={styles.newsExcerpt} numberOfLines={2}>{excerpt}</Text>
          <View style={styles.newsMeta}>
            <Clock size={11} color={Colors.textMuted} />
            <Text style={styles.newsDate}>{formatDate(post.date)}</Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
});

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const { data: posts, isLoading: newsLoading, refetch: refetchNews, isRefetching } = useQuery({
    queryKey: ['wp-posts'],
    queryFn: fetchPosts,
    staleTime: 5 * 60 * 1000,
  });

  const openPost = useCallback((postId: number) => {
    router.push(`/(home)/${postId}`);
  }, []);

  const featured = useMemo(() => posts?.[0] ?? null, [posts]);
  const otherNews = useMemo(() => posts?.slice(1) ?? [], [posts]);

  if (newsLoading) {
    return (
      <View style={styles.container}>
        <View style={[styles.headerBar, { paddingTop: insets.top + 12 }]}>
          <View style={styles.brandRow}>
            <Image source={{ uri: APP_LOGO_URL }} style={styles.headerLogo} contentFit="contain" />
            <View>
              <Text style={styles.appTitle}>{APP_NAME}</Text>
            </View>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>A carregar...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.brandRow}>
          <Image source={{ uri: APP_LOGO_URL }} style={styles.headerLogo} contentFit="contain" />
          <View>
            <Text style={styles.appTitle}>{APP_NAME}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetchNews}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {featured ? (
          <View style={styles.featuredSingleWrap}>
            <FeaturedCard post={featured} onPress={() => openPost(featured.id)} />
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Últimas Notícias</Text>
        </View>
        {otherNews.map(post => (
          <NewsCard key={post.id} post={post} onPress={() => openPost(post.id)} />
        ))}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 44,
    height: 44,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -0.5,
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
    paddingBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    flex: 1,
  },
  featuredSingleWrap: {
    paddingHorizontal: 12,
    marginTop: 16,
  },
  featuredCard: {
    width: SCREEN_WIDTH - 24,
    height: 210,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  featuredImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  featuredContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 18,
  },
  featuredBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 10,
  },
  featuredBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  featuredTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    lineHeight: 23,
    letterSpacing: -0.3,
  },
  featuredMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  featuredDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  newsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  newsImage: {
    width: 110,
    height: 110,
  },
  newsContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  newsTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    lineHeight: 19,
  },
  newsExcerpt: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginTop: 4,
  },
  newsMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  newsDate: {
    fontSize: 11,
    color: Colors.textMuted,
    flex: 1,
  },
});
