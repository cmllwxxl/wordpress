import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from './supabase';

export interface Site {
  id: string;
  name: string;
  url: string;
  username?: string;
  appPassword?: string;
  status: 'unknown' | 'online' | 'offline';
  lastChecked?: string;
  wpVersion?: string;
  postCount?: number;
  commentCount?: number;
  orderIndex?: number;
  tags?: string[];
  type?: 'wordpress' | 'custom';
}

interface Settings {
  webhookUrl: string;
  enableNotifications: boolean;
  notifyEmail: string;
  enableEmailNotification: boolean;
}

interface SiteStore {
  sites: Site[];
  settings: Settings;
  isLoading: boolean;
  error: string | null;
  user: any | null;
  fetchSites: () => Promise<void>;
  addSite: (site: Omit<Site, 'id' | 'status'>) => Promise<void>;
  addSites: (sites: Omit<Site, 'id' | 'status'>[]) => Promise<void>;
  removeSite: (id: string) => Promise<void>;
  updateSite: (id: string, data: Partial<Site>) => Promise<void>;
  getSite: (id: string) => Site | undefined;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
  setUser: (user: any) => void;
  reorderSites: (sites: Site[]) => Promise<void>;
}

export const useSiteStore = create<SiteStore>()(
  persist(
    (set, get) => ({
      sites: [],
      settings: {
        webhookUrl: '',
        enableNotifications: false,
        notifyEmail: '',
        enableEmailNotification: false,
      },
      isLoading: false,
      error: null,
      user: null,

      setUser: (user) => set({ user, error: null }),

      fetchSites: async () => {
        if (!isSupabaseConfigured()) return;
        set({ isLoading: true, error: null });

        try {
          const { data: sitesData, error: sitesError } = await supabase
            .from('sites')
            .select('*')
            .order('order_index', { ascending: true });

          if (sitesError) throw sitesError;

          const { data: settingsData, error: settingsError } = await supabase
            .from('settings')
            .select('*')
            .single();

          if (sitesData) {
            // Map snake_case to camelCase
            const mappedSites = sitesData.map((s: any) => ({
              id: s.id,
              name: s.name,
              url: s.url,
              username: s.username,
              appPassword: s.app_password,
              status: s.status || 'unknown',
              lastChecked: s.last_checked,
              wpVersion: s.wp_version,
              postCount: s.post_count,
              commentCount: s.comment_count,
              orderIndex: s.order_index || 0,
              tags: s.tags || [],
              type: s.type || ((s.tags || []).includes('自建站') ? 'custom' : 'wordpress')
            }));
            set({ sites: mappedSites });
          }

          if (settingsData) {
            set({
              settings: {
                webhookUrl: settingsData.webhook_url || '',
                enableNotifications: settingsData.enable_notifications || false,
                notifyEmail: settingsData.notify_email || '',
                enableEmailNotification: settingsData.enable_email_notification || false
              }
            });
          }
        } catch (error: any) {
          console.error('Error fetching data from Supabase:', error);
          set({ error: error.message || '同步数据失败' });
        } finally {
          set({ isLoading: false });
        }
      },

      addSite: async (siteData) => {
        const currentSites = get().sites;
        const maxOrder = currentSites.length > 0 ? Math.max(...currentSites.map(s => s.orderIndex || 0)) : -1;

        const newSite = {
          ...siteData,
          id: crypto.randomUUID(),
          status: 'unknown' as const,
          orderIndex: maxOrder + 1,
          tags: siteData.tags || [],
          type: siteData.type || 'wordpress'
        };

        // Optimistic update
        set((state) => ({
          sites: [...state.sites, newSite],
        }));

        if (isSupabaseConfigured()) {
          try {
            const siteToInsert: any = {
              id: newSite.id,
              name: newSite.name,
              url: newSite.url,
              status: newSite.status,
              order_index: newSite.orderIndex,
              tags: newSite.tags,
              type: newSite.type
            };

            const { error } = await supabase.from('sites').insert(siteToInsert);

            if (error) {
              // Fallback: try inserting without 'type' column if it fails (likely due to missing schema)
              if (error.message?.includes('type') || error.code === '42703') {
                console.warn('Type column missing in DB, retrying without it...');
                delete siteToInsert.type;
                await supabase.from('sites').insert(siteToInsert);
              } else {
                throw error;
              }
            }
          } catch (error) {
            console.error('Error adding site to Supabase:', error);
          }
        }
      },

      addSites: async (sitesData) => {
        const currentSites = get().sites;
        let maxOrder = currentSites.length > 0 ? Math.max(...currentSites.map(s => s.orderIndex || 0)) : -1;

        const newSites = sitesData.map(site => {
          maxOrder++;
          return {
            ...site,
            id: crypto.randomUUID(),
            status: 'unknown' as const,
            orderIndex: maxOrder,
            tags: site.tags || [],
            type: site.type || 'wordpress'
          };
        });

        set((state) => ({
          sites: [...state.sites, ...newSites],
        }));

        if (isSupabaseConfigured()) {
          try {
            await supabase.from('sites').insert(
              newSites.map(s => ({
                id: s.id,
                name: s.name,
                url: s.url,
                status: s.status,
                order_index: s.orderIndex,
                tags: s.tags,
                type: s.type
              }))
            );
          } catch (error) {
            console.error('Error adding sites to Supabase:', error);
          }
        }
      },

      removeSite: async (id) => {
        set((state) => ({
          sites: state.sites.filter((site) => site.id !== id),
        }));

        if (isSupabaseConfigured()) {
          try {
            await supabase.from('sites').delete().eq('id', id);
          } catch (error) {
            console.error('Error removing site from Supabase:', error);
          }
        }
      },

      updateSite: async (id, data) => {
        set((state) => ({
          sites: state.sites.map((site) =>
            site.id === id ? { ...site, ...data } : site
          ),
        }));

        if (isSupabaseConfigured()) {
          try {
            const updateData: any = {};
            if (data.name) updateData.name = data.name;
            if (data.status) updateData.status = data.status;
            if (data.lastChecked) updateData.last_checked = data.lastChecked;
            if (data.wpVersion) updateData.wp_version = data.wpVersion;
            if (data.postCount !== undefined) updateData.post_count = data.postCount;
            if (data.commentCount !== undefined) updateData.comment_count = data.commentCount;
            if (data.username !== undefined) updateData.username = data.username;
            if (data.appPassword !== undefined) updateData.app_password = data.appPassword;
            if (data.orderIndex !== undefined) updateData.order_index = data.orderIndex;
            if (data.tags !== undefined) updateData.tags = data.tags;
            if (data.type) updateData.type = data.type;

            if (Object.keys(updateData).length > 0) {
              const { error } = await supabase.from('sites').update(updateData).eq('id', id);
              if (error) {
                // Fallback: try updating without 'type' column if it fails
                if ((error.message?.includes('type') || error.code === '42703') && updateData.type) {
                  console.warn('Type column missing in DB, retrying update without it...');
                  delete updateData.type;
                  await supabase.from('sites').update(updateData).eq('id', id);
                } else {
                  throw error;
                }
              }
            }
          } catch (error) {
            console.error('Error updating site in Supabase:', error);
          }
        }
      },

      reorderSites: async (newSites) => {
        // Update local state with new order indexes
        const updatedSites = newSites.map((site, index) => ({
          ...site,
          orderIndex: index
        }));

        set({ sites: updatedSites });

        if (isSupabaseConfigured()) {
          try {
            // Upsert all with new order_index
            const updates = updatedSites.map(s => ({
              id: s.id,
              name: s.name, // Required for upsert if not partial, but we usually update by ID
              url: s.url,
              order_index: s.orderIndex,
              // Include other fields to avoid clearing them if upsert replaces row, 
              // but Supabase update is safer. 
              // Batch update is tricky in Supabase without RPC.
              // Let's loop for now or use upsert if we include all fields.
              // Better to loop update for simplicity or create a RPC function.
              // For small number of sites, loop is fine.
            }));

            // Using a loop for now as it's safer without defining complex Types/RPC
            // In production with many sites, this should be optimized.
            for (const site of updates) {
              await supabase.from('sites').update({ order_index: site.order_index }).eq('id', site.id);
            }
          } catch (error) {
            console.error('Error reordering sites in Supabase:', error);
          }
        }
      },

      getSite: (id) => get().sites.find((s) => s.id === id),

      updateSettings: async (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));

        if (isSupabaseConfigured()) {
          try {
            const { data: existing } = await supabase.from('settings').select('id').single();

            const settingsPayload: any = {};
            if (newSettings.webhookUrl !== undefined) settingsPayload.webhook_url = newSettings.webhookUrl;
            if (newSettings.enableNotifications !== undefined) settingsPayload.enable_notifications = newSettings.enableNotifications;
            if (newSettings.notifyEmail !== undefined) settingsPayload.notify_email = newSettings.notifyEmail;
            if (newSettings.enableEmailNotification !== undefined) settingsPayload.enable_email_notification = newSettings.enableEmailNotification;

            if (existing) {
              await supabase.from('settings').update(settingsPayload).eq('id', existing.id);
            } else {
              await supabase.from('settings').insert(settingsPayload);
            }
          } catch (error) {
            console.error('Error updating settings in Supabase:', error);
          }
        }
      },
    }),
    {
      name: 'wordpress-sites-storage',
      partialize: (state) => ({
        sites: state.sites,
        settings: state.settings
      }),
    }
  )
);
