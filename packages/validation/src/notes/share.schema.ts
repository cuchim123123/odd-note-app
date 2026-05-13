import { z } from 'zod';

export const sharePermissionSchema = z.enum(['READ', 'EDIT']);

export const createNoteShareSchema = z.object({
  recipientEmail: z.string().trim().email('Enter a valid email address'),
  permission: sharePermissionSchema.default('READ'),
});

export type CreateNoteShareInput = z.infer<typeof createNoteShareSchema>;

export const updateNoteShareSchema = z.object({
  permission: sharePermissionSchema,
});

export type UpdateNoteShareInput = z.infer<typeof updateNoteShareSchema>;

export const noteShareSchema = z.object({
  id: z.string().min(1),
  recipientEmail: z.string().email(),
  recipientDisplayName: z.string().optional(),
  permission: sharePermissionSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type NoteShare = z.infer<typeof noteShareSchema>;