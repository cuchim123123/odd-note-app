/**
 * Presentation DTO for a revision entry in the note history list.
 * Content is intentionally excluded — fetching full content for every
 * revision in a list would be prohibitively expensive. Use the restore
 * endpoint to load and apply a specific revision's content.
 */
export interface NoteRevisionSummaryDto {
  id: string;
  revisionNumber: number;
  title: string;
  createdAt: string;   // ISO-8601
  createdBy: string;   // userId
  label: string | null;
}
