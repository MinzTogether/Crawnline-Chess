import React, { useEffect, useRef, useState } from 'react';
import { Camera, ChevronRight, Trash2, Upload } from 'lucide-react';
import type { SavedMatch, UserProfile } from '../types/preferences';
import { useI18n } from '../i18n/LanguageContext';

const AVATAR_COLORS = ['#81B64C', '#5C9CE6', '#D99B3C', '#26C2A3', '#D96666', '#9C7EE6'];

/** Center-crops and compresses an uploaded image file to a 256x256 WebP data URL for localStorage. */
function processAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose a valid image file (PNG, JPG, WebP, or GIF).'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      if (!src) {
        reject(new Error('Empty image data.'));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported image format.'));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/webp', 0.88));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export interface ProfileStatsSummary {
  total: number;
  wins: number;
  draws: number;
  losses: number;
  avgAcc: number | null;
  bestElo: number | null;
}

interface ProfileSectionProps {
  profile: UserProfile;
  safeDisplayName: string;
  profileInitials: string;
  profileStats: ProfileStatsSummary;
  savedMatches: SavedMatch[];
  onUpdateProfile: (patch: Partial<UserProfile>) => void;
  onOpenMatchRating: (pgn?: string, title?: string) => void;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  profile,
  safeDisplayName,
  profileInitials,
  profileStats,
  savedMatches,
  onUpdateProfile,
  onOpenMatchRating,
}) => {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [profileSavedToast, setProfileSavedToast] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await processAvatarFile(file);
      onUpdateProfile({ avatarImage: dataUrl });
      setAvatarUploadError(null);
    } catch (err) {
      setAvatarUploadError(err instanceof Error ? err.message : 'Failed to upload image.');
    }
  };

  return (
    <div
      key="hub-profile"
      className="hub-content-pad max-w-[920px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 flex flex-col gap-6 anim-view-enter"
      data-testid="profile-view"
    >
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--app-text)]">
          {t('profileTitle')}
        </h1>
        <p className="text-sm text-[var(--app-text-muted)] mt-1">{t('profileSubtitle')}</p>
      </div>

      {/* Identity Editor Card */}
      <section className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 flex flex-col md:flex-row gap-6 items-start">
        <div className="flex flex-col items-center gap-3 shrink-0 w-full md:w-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            aria-label={t('uploadPhoto')}
            onChange={handleAvatarFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title={t('uploadPhoto')}
            className="relative group w-24 h-24 rounded-2xl overflow-hidden shadow-md border border-[var(--app-border-strong)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)] anim-interactive"
          >
            {profile.avatarImage ? (
              <img
                src={profile.avatarImage}
                alt={safeDisplayName}
                data-testid="profile-avatar-img"
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-2xl font-extrabold text-[#12160D]"
                style={{ backgroundColor: profile.avatarColor }}
              >
                {profileInitials}
              </div>
            )}
            <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white text-[11px] font-bold">
              <Camera className="w-5 h-5" />
              <span>{t('changePhoto')}</span>
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border-strong)] text-xs font-semibold text-[var(--app-text)] transition-colors cursor-pointer whitespace-nowrap anim-interactive"
            >
              <Upload className="w-3.5 h-3.5 text-[var(--app-accent)]" />
              <span>{t('uploadPhoto')}</span>
            </button>
            {profile.avatarImage && (
              <button
                type="button"
                aria-label={t('removePhoto')}
                title={t('removePhoto')}
                onClick={() => {
                  onUpdateProfile({ avatarImage: null });
                  setAvatarUploadError(null);
                }}
                className="p-1.5 rounded-lg bg-[var(--app-surface-2)] hover:bg-[#C94A4A]/20 border border-[var(--app-border-strong)] text-[var(--app-text-muted)] hover:text-[#E04F4F] transition-colors cursor-pointer anim-interactive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {avatarUploadError && (
            <p className="text-[11px] text-[#E04F4F] text-center max-w-[160px]">{avatarUploadError}</p>
          )}

          {!profile.avatarImage && (
            <div className="flex items-center gap-1.5">
              {AVATAR_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={`Select avatar color ${hex}`}
                  onClick={() => onUpdateProfile({ avatarColor: hex })}
                  className={`w-5 h-5 rounded-full cursor-pointer border-2 anim-interactive ${
                    profile.avatarColor === hex ? 'border-[var(--app-text)] scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onUpdateProfile({
              displayName: profile.displayName.trim() || 'Player',
              title: profile.title.trim() || 'Club Player',
            });
            setProfileSavedToast(true);
            if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
            toastTimerRef.current = window.setTimeout(() => {
              toastTimerRef.current = null;
              setProfileSavedToast(false);
            }, 1800);
          }}
          className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="profile-name" className="text-xs font-bold text-[var(--app-text-muted)]">
              {t('displayNameLabel')}
            </label>
            <input
              id="profile-name"
              type="text"
              maxLength={40}
              placeholder={t('displayNamePlaceholder')}
              value={profile.displayName}
              onChange={(e) => onUpdateProfile({ displayName: e.target.value })}
              onBlur={() => {
                if (!profile.displayName.trim()) {
                  onUpdateProfile({ displayName: 'Player' });
                }
              }}
              className="rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border-strong)] focus:border-[var(--app-accent)] focus:outline-none px-3 py-2 text-sm font-semibold text-[var(--app-text)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="profile-title" className="text-xs font-bold text-[var(--app-text-muted)]">
              {t('playerTitleLabel')}
            </label>
            <input
              id="profile-title"
              type="text"
              value={profile.title}
              onChange={(e) => onUpdateProfile({ title: e.target.value })}
              className="rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border-strong)] focus:border-[var(--app-accent)] focus:outline-none px-3 py-2 text-sm text-[var(--app-text)]"
            />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label htmlFor="profile-bio" className="text-xs font-bold text-[var(--app-text-muted)]">
              {t('bioLabel')}
            </label>
            <input
              id="profile-bio"
              type="text"
              value={profile.bio}
              onChange={(e) => onUpdateProfile({ bio: e.target.value })}
              className="rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border-strong)] focus:border-[var(--app-accent)] focus:outline-none px-3 py-2 text-sm text-[var(--app-text)]"
            />
          </div>

          <div className="sm:col-span-2 flex items-center justify-between">
            <span className="text-xs text-[var(--app-accent)] font-semibold">
              {profileSavedToast ? t('profileSavedLocally') : ''}
            </span>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] text-xs font-extrabold cursor-pointer anim-interactive"
            >
              {t('saveProfile')}
            </button>
          </div>
        </form>
      </section>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('matchesPlayed'), value: String(profileStats.total) },
          {
            label: t('recordWDL'),
            value: `${profileStats.wins}-${profileStats.draws}-${profileStats.losses}`,
          },
          {
            label: t('avgAccuracy'),
            value: profileStats.avgAcc !== null ? `${profileStats.avgAcc}%` : '—',
          },
          {
            label: t('peakGameElo'),
            value: profileStats.bestElo !== null ? String(profileStats.bestElo) : '—',
          },
        ].map((stat, idx) => (
          <div
            key={stat.label}
            style={{ '--stagger': idx } as React.CSSProperties}
            className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-4 anim-card-stagger"
          >
            <div className="text-xs text-[var(--app-text-muted)]">{stat.label}</div>
            <div className="text-2xl font-mono font-extrabold tabular-nums text-[var(--app-text)] mt-1">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Full Saved Match Archive */}
      <section className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[var(--app-text)]">{t('matchHistory')}</h2>
          <span className="text-xs text-[var(--app-text-muted)]">{t('clickToRateHint')}</span>
        </div>
        <div className="flex flex-col divide-y divide-[var(--app-border)]">
          {savedMatches.map((m) => (
            <div key={m.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-[var(--app-text)] truncate">
                  {m.whiteName} vs {m.blackName}
                </div>
                <div className="text-xs text-[var(--app-text-muted)] flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 font-mono tabular-nums">
                  <span className="font-bold text-[var(--app-text)]">{m.result}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-sans">{m.reason}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-sans">{m.openingName}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {m.movesCount} {t('movesUnit')}
                  </span>
                  {typeof m.whiteGameElo === 'number' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-[var(--app-accent)]">
                        {t('estEloPrefix')} {m.whiteGameElo} Elo
                      </span>
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenMatchRating(m.pgn, `${m.whiteName} vs ${m.blackName}`)}
                className="px-3.5 py-2 rounded-lg bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] text-xs font-extrabold transition-colors flex items-center justify-center gap-1 whitespace-nowrap shrink-0 cursor-pointer anim-interactive"
              >
                <span>{t('rateMatch')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
