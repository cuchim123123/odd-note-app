export const NOTE_MAIL_SENDER = Symbol('NoteMailSender');

export interface INoteMailSender {
  sendNoteSharedEmail(params: {
    to: string;
    recipientName: string;
    senderName: string;
    noteTitle: string;
    noteId: string;
    permission: string;
  }): Promise<void>;
}
