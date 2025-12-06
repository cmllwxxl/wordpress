import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WebmasterStore {
  googleJson: string;
  bingApiKey: string;
  googleProxy: string;
  pageSpeedApiKey: string;
  setGoogleJson: (json: string) => void;
  setBingApiKey: (key: string) => void;
  setGoogleProxy: (proxy: string) => void;
  setPageSpeedApiKey: (key: string) => void;
}

export const useWebmasterStore = create<WebmasterStore>()(
  persist(
    (set) => ({
      googleJson: '',
      bingApiKey: '',
      googleProxy: '',
      pageSpeedApiKey: '',
      setGoogleJson: (json) => set({ googleJson: json }),
      setBingApiKey: (key) => set({ bingApiKey: key }),
      setGoogleProxy: (proxy) => set({ googleProxy: proxy }),
      setPageSpeedApiKey: (key) => set({ pageSpeedApiKey: key }),
    }),
    {
      name: 'webmaster-storage',
    }
  )
);
