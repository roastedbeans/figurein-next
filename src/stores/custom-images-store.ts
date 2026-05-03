"use client";

import { create } from "zustand";
import {
  listCustomImages,
  type CustomImageRow,
} from "@/app/editor/custom-images";

type State = {
  images: CustomImageRow[];
  loaded: boolean;
  loading: boolean;
};

type Actions = {
  load: () => Promise<void>;
  addImage: (image: CustomImageRow) => void;
  removeImage: (id: string) => void;
  getById: (id: string) => CustomImageRow | undefined;
};

let inFlight: Promise<void> | null = null;

export const useCustomImagesStore = create<State & Actions>((set, get) => ({
  images: [],
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loaded) return;
    if (inFlight) return inFlight;
    set({ loading: true });
    inFlight = (async () => {
      try {
        const images = await listCustomImages();
        set({ images, loaded: true, loading: false });
      } catch {
        set({ loading: false });
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  },

  addImage: (image) =>
    set((s) => ({
      images: [image, ...s.images.filter((i) => i.id !== image.id)],
    })),

  removeImage: (id) =>
    set((s) => ({ images: s.images.filter((i) => i.id !== id) })),

  getById: (id) => get().images.find((i) => i.id === id),
}));
