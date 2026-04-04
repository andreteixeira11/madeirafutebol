import React, { useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Clock, ArrowLeft } from 'lucide-react-native';
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
    .replace(/&nbsp;/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

function htmlToBlocks(html: string): { type: 'text' | 'image'; content: string }[] {
  const blocks: { type: 'text' | 'image'; content: string }[] = [];
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
  let lastIndex = 0;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const before = html.substring(lastIndex, match.index);
    const cleaned = stripHtml(before);
    if (cleaned.length > 0) blocks.push({ type: 'text', content: cleaned });
    blocks.push({ type: 'image', content: match[1] });
    lastIndex = match.index + match[0].length;
  }
  const remaining = html.substring(lastIndex);
  const cleaned = stripHtml(remaining);
  if (cleaned.length > 0) blocks.push({ type: 'text', content: cleaned });
  return blocks;
}

function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getImageUrl(post: WPPost): string | null {
  return post._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? null;
}

function getSourceLabel(post: WPPost): string | null {
  const imageCaption = stripHtml(post._embedded?.['wp:featuredmedia']?.[0]?.caption?.rendered ?? '');
  if (imageCaption.length > 0) {
    return imageCaption;
  }

  const embeddedAuthor = post._embedded?.author?.[0]?.name?.trim();
  if (embeddedAuthor && embeddedAuthor.length > 0) {
    return embeddedAuthor;
  }

  const yoastAuthor = post.yoast_head_json?.author?.trim();
  if (yoastAuthor && yoastAuthor.length > 0) {
    return yoastAuthor;
  }

  return 'Madeirafutebol';
}

async function fetchPost(id: string): Promise<WPPost> {
  console.log('[Article] Fetching post:', id);
  const response = await fetch(
    `https://www.madeirafutebol.com/wp-json/wp/v2/posts/${id}?_embed`
  );
  if (!response.ok) throw new Error(`Failed to fetch post: ${response.status}`);
  return response.json();
}

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scrollY = useRef(new Animated.Value(0)).current;

  const { data: post, isLoading, error } = useQuery({
    queryKey: ['wp-post', id],
    queryFn: () => fetchPost(id!),
    enabled: !!id,
  });

  const title = useMemo(() => post ? stripHtml(post.title.rendered) : '', [post]);
  const imageUrl = useMemo(() => post ? getImageUrl(post) : null, [post]);
  const sourceLabel = useMemo(() => post ? getSourceLabel(post) : null, [post]);
  const contentBlocks = useMemo(
    () => post ? htmlToBlocks(post.content.rendered) : [],
    [post]
  );

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>A carregar artigo...</Text>
        </View>
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>📰</Text>
          <Text style={styles.errorTitle}>Erro ao carregar</Text>
          <Text style={styles.errorSubtitle}>Não foi possível carregar o artigo</Text>
          <Pressable style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryBtnText}>Voltar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <Animated.View style={[styles.floatingHeader, { opacity: headerOpacity }]}>
        <View style={styles.floatingHeaderInner}>
          <Text style={styles.floatingHeaderTitle} numberOfLines={1}>{title}</Text>
        </View>
      </Animated.View>

      <View style={styles.backButtonContainer}>
        <Pressable style={styles.backButton} onPress={() => router.back()} testID="back-button">
          <ArrowLeft size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {imageUrl ? (
          <View style={styles.heroContainer}>
            <Image source={{ uri: imageUrl }} style={styles.heroImage} contentFit="cover" />
            <View style={styles.heroOverlay} />
          </View>
        ) : (
          <View style={styles.heroPlaceholder} />
        )}

        <View style={styles.articleBody}>
          <Text style={styles.articleTitle}>{title}</Text>
          <View style={styles.metaRow}>
            <Clock size={14} color={Colors.textSecondary} />
            <Text style={styles.metaDate}>{formatFullDate(post.date)}</Text>
          </View>
          {sourceLabel ? (
            <View style={styles.sourceCard} testID="article-source">
              <Text style={styles.sourceLabel}>Fonte</Text>
              <Text style={styles.sourceValue}>{sourceLabel}</Text>
            </View>
          ) : null}
          <View style={styles.divider} />
          {contentBlocks.map((block, idx) => {
            if (block.type === 'image') {
              return (
                <Image
                  key={idx}
                  source={{ uri: block.content }}
                  style={styles.contentImage}
                  contentFit="cover"
                />
              );
            }
            return (
              <Text key={idx} style={styles.paragraph}>{block.content}</Text>
            );
          })}
          <View style={{ height: 60 }} />
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingTop: 54,
    paddingBottom: 12,
    paddingHorizontal: 60,
  },
  floatingHeaderInner: {
    alignItems: 'center',
  },
  floatingHeaderTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  backButtonContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContainer: {
    width: SCREEN_WIDTH,
    height: 280,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  heroPlaceholder: {
    height: 100,
    backgroundColor: Colors.primary,
  },
  articleBody: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    paddingHorizontal: 20,
    paddingTop: 24,
    minHeight: 400,
  },
  articleTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  metaDate: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  sourceCard: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  sourceLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  sourceValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 20,
  },
  paragraph: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 26,
    marginBottom: 16,
  },
  contentImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginVertical: 12,
  },
});
