import { z } from 'zod';

export const noteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, 'Title is required').max(255),
  content: z.string().optional(),
  isPinned: z.boolean().default(false),
  isProtected: z.boolean().default(false),
  isShared: z.boolean().default(false),
  labels: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Note = z.infer<typeof noteSchema>;

export const createNoteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  content: z.string().optional(),
  labels: z.array(z.string()).optional(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255).optional(),
  content: z.string().optional(),
  isPinned: z.boolean().optional(),
  labels: z.array(z.string()).optional(),
  isProtected: z.boolean().optional(),
});

export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
