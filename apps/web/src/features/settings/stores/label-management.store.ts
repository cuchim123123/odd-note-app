import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { renameLabelInNotes } from '../../notes/api/notes.api';

type LabelManagementState = {
  labels: string[];
  syncLabels: (labels: string[]) => void;
  addLabel: (label: string) => void;
  renameLabel: (oldLabel: string, newLabel: string) => void;
  deleteLabel: (label: string) => void;
};

const normalizeLabels = (labels: string[]) => Array.from(new Set(labels.map((label) => label.trim()).filter(Boolean))).sort();

export const useLabelManagementStore = create<LabelManagementState>()(
  persist(
    (set, get) => ({
      labels: [],
      syncLabels: (labels) => set({ labels: normalizeLabels(labels) }),
      addLabel: (label) => {
        const nextLabel = label.trim();

        if (!nextLabel) {
          return;
        }

        set({ labels: normalizeLabels([...get().labels, nextLabel]) });
      },
      renameLabel: (oldLabel, newLabel) => {
        const trimmedOldLabel = oldLabel.trim();
        const trimmedNewLabel = newLabel.trim();

        if (!trimmedOldLabel || !trimmedNewLabel || trimmedOldLabel === trimmedNewLabel) {
          return;
        }

        set({
          labels: normalizeLabels(get().labels.map((label) => (label === trimmedOldLabel ? trimmedNewLabel : label))),
        });

        try {
          renameLabelInNotes(trimmedOldLabel, trimmedNewLabel);
        } catch {
          // ignore in case of loading order issues
        }
      },
      deleteLabel: (label) => {
        const trimmedLabel = label.trim();

        if (!trimmedLabel) {
          return;
        }

        set({ labels: get().labels.filter((entry) => entry !== trimmedLabel) });
      },
    }),
    {
      name: 'odd-note-labels',
    },
  ),
);
