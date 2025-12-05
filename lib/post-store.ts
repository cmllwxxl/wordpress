import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from './supabase';

export interface CachedPost {
    id: number;
    siteId: string;
    title: string;
    date: string;
    status: string;
    author_name: string;
    link: string;
    modified: string;
}

interface PostStore {
    posts: Record<string, CachedPost[]>; // key is siteId
    counts: Record<string, any>; // key is siteId
    lastSync: Record<string, number>; // key is siteId, value is timestamp
    setPosts: (siteId: string, posts: CachedPost[]) => void;
    setCounts: (siteId: string, counts: any) => void;
    getPosts: (siteId: string) => CachedPost[];
    getCounts: (siteId: string) => any;
    
    // Supabase Sync Actions
    uploadToSupabase: (siteId: string) => Promise<void>;
    downloadFromSupabase: (siteId: string) => Promise<boolean>;
}

export const usePostStore = create<PostStore>()(
    persist(
        (set, get) => ({
            posts: {},
            counts: {},
            lastSync: {},
            setPosts: (siteId, newPosts) => set((state) => ({
                posts: { ...state.posts, [siteId]: newPosts },
                lastSync: { ...state.lastSync, [siteId]: Date.now() }
            })),
            setCounts: (siteId, newCounts) => set((state) => ({
                counts: { ...state.counts, [siteId]: newCounts }
            })),
            getPosts: (siteId) => get().posts[siteId] || [],
            getCounts: (siteId) => get().counts[siteId] || { all: 0, publish: 0, draft: 0, pending: 0, private: 0, trash: 0 },
            
            uploadToSupabase: async (siteId: string) => {
                if (!isSupabaseConfigured()) return;
                const state = get();
                const posts = state.posts[siteId] || [];
                const counts = state.counts[siteId] || {};
                const lastSync = state.lastSync[siteId] || Date.now();

                try {
                    await supabase.from('posts_cache').upsert({
                        site_id: siteId,
                        posts: posts,
                        counts: counts,
                        last_sync: lastSync,
                        updated_at: new Date().toISOString()
                    });
                    console.log(`Uploaded posts cache for ${siteId} to Supabase`);
                } catch (error) {
                    console.error('Failed to upload posts cache to Supabase:', error);
                }
            },

            downloadFromSupabase: async (siteId: string) => {
                if (!isSupabaseConfigured()) return false;
                try {
                    const { data, error } = await supabase
                        .from('posts_cache')
                        .select('*')
                        .eq('site_id', siteId)
                        .single();
                    
                    if (error) throw error;
                    if (data) {
                        set((state) => ({
                            posts: { ...state.posts, [siteId]: data.posts },
                            counts: { ...state.counts, [siteId]: data.counts },
                            lastSync: { ...state.lastSync, [siteId]: data.last_sync }
                        }));
                        console.log(`Downloaded posts cache for ${siteId} from Supabase`);
                        return true;
                    }
                } catch (error) {
                    // It's okay if no data found (e.g. first time)
                    // console.error('Failed to download posts cache from Supabase:', error);
                }
                return false;
            }
        }),
        {
            name: 'post-cache-storage',
            partialize: (state) => ({
                posts: state.posts,
                counts: state.counts,
                lastSync: state.lastSync
            }),
        }
    )
);
