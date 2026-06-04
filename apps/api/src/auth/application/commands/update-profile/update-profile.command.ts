export type UpdateProfileCommand = {
  userId: string;
  displayName?: string | undefined;
  avatarUrl?: string | null | undefined;
};
