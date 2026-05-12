import { z } from 'zod';

export const noteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, 'Title is required').max(255),
  content: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Note = z.infer<typeof noteSchema>;

export const createNoteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  content: z.string().optional(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = createNoteSchema.partial();

export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
