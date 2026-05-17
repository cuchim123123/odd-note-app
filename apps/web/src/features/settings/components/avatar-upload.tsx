import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { useUploadAvatar, useUpdateProfile } from '../../auth/api/profile.api';
import { Button } from '../../../components/ui/button';
import { useAuthStore } from '../../auth/stores/auth.store';

export function AvatarUpload() {
  const user = useAuthStore((state) => state.user);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = useUploadAvatar();
  const updateProfileMutation = useUpdateProfile();

  const isPending = uploadMutation.isPending || updateProfileMutation.isPending;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setError('File size must be under 2MB.');
      return;
    }

    // Validate type
    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed.');
      return;
    }

    setError(null);

    try {
      // 1. Upload to S3/MinIO
      const uploadResult = await uploadMutation.mutateAsync(file);
      // 2. Save avatarUrl in profile
      await updateProfileMutation.mutateAsync({ avatarUrl: uploadResult.url });
    } catch (err) {
      console.error('Failed to upload avatar:', err);
      setError('Failed to upload avatar. Please try again.');
    }
  };

  const handleRemoveAvatar = async () => {
    setError(null);
    try {
      await updateProfileMutation.mutateAsync({ avatarUrl: null });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Failed to remove avatar:', err);
      setError('Failed to remove avatar.');
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    const first = parts[0] || '';
    const last = parts[parts.length - 1] || '';
    if (parts.length === 1) return first.charAt(0).toUpperCase();
    return (first.charAt(0) + last.charAt(0)).toUpperCase();
  };

  const initials = user ? getInitials(user.displayName) : 'U';

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div className="relative group h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-border/80 bg-muted shadow-sm transition-all hover:border-primary/60">
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/5 text-2xl font-bold text-primary">
            {initials}
          </div>
        )}

        {/* Overlay trigger */}
        <button
          type="button"
          disabled={isPending}
          onClick={() => fileInputRef.current?.click()}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Upload profile avatar"
        >
          {isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Camera className="h-5 w-5" />
              <span className="mt-1 text-[10px] font-medium uppercase">Change</span>
            </>
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={isPending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
            className="rounded-full shadow-sm"
          >
            Upload image
          </Button>
          {user?.avatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveAvatar}
              disabled={isPending}
              className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Allowed JPEG, PNG or GIF. Max size 2MB.
        </p>
        {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      </div>
    </div>
  );
}
