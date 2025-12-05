import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WebmasterStore {
  googleJson: string;
  bingApiKey: string;
  googleProxy: string;
  setGoogleJson: (json: string) => void;
  setBingApiKey: (key: string) => void;
  setGoogleProxy: (proxy: string) => void;
}

export const useWebmasterStore = create<WebmasterStore>()(
  persist(
    (set) => ({
      googleJson: '',
      bingApiKey: '',
      googleProxy: '',
      setGoogleJson: (json) => set({ googleJson: json }),
      setBingApiKey: (key) => set({ bingApiKey: key }),
      setGoogleProxy: (proxy) => set({ googleProxy: proxy }),
    }),
    {
      name: 'webmaster-storage',
    }
  )
);
