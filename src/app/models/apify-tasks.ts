// src/app/models/apify-tasks.ts

export type MarketCountryCode = 'COL' | 'MX';
export type PlatformType = 'facebook' | 'tiktok' | 'youtube' | 'instagram';
export type ContentType = 'post' | 'profile' | 'videos' | 'shorts';

export interface ApifyTaskDefinition {
  taskName: string;
  apiTaskId: string;
  country: MarketCountryCode;
  platform: PlatformType;
  contentType: ContentType;
  description?: string;
}

/**
 * Catálogo Oficial de las 16 Actor Tasks en Apify API v2
 * Configuración estricta por mercado (Colombia COL / México MX)
 */
export const APIFY_TASKS_CATALOG: readonly ApifyTaskDefinition[] = [
  // ==========================================
  // TAREAS DE COLOMBIA (país: 'COL')
  // ==========================================
  {
    taskName: 'Tiktok_profile_COL',
    apiTaskId: 'suarezt~tiktok-profile-col',
    country: 'COL',
    platform: 'tiktok',
    contentType: 'profile',
    description: 'Perfiles de marcas competidoras en TikTok Colombia'
  },
  {
    taskName: 'Youtube_videos_COL',
    apiTaskId: 'suarezt~youtube-videos-col',
    country: 'COL',
    platform: 'youtube',
    contentType: 'videos',
    description: 'Videos de marcas competidoras en YouTube Colombia'
  },
  {
    taskName: 'Facebook_profile_COL',
    apiTaskId: 'suarezt~facebook-profile-col',
    country: 'COL',
    platform: 'facebook',
    contentType: 'profile',
    description: 'Páginas y perfiles en Facebook Colombia'
  },
  {
    taskName: 'Facebook_post_COL',
    apiTaskId: 'suarezt~facebook-post-col',
    country: 'COL',
    platform: 'facebook',
    contentType: 'post',
    description: 'Publicaciones y métricas en Facebook Colombia'
  },
  {
    taskName: 'Tiktok_post_COL',
    apiTaskId: 'suarezt~tiktok-post-col',
    country: 'COL',
    platform: 'tiktok',
    contentType: 'post',
    description: 'Posts y videos en TikTok Colombia'
  },
  {
    taskName: 'Instagram_post_COL',
    apiTaskId: 'suarezt~instagram-post-col',
    country: 'COL',
    platform: 'instagram',
    contentType: 'post',
    description: 'Publicaciones y reels en Instagram Colombia'
  },
  {
    taskName: 'Instagram_profile_COL',
    apiTaskId: 'suarezt~instagram-profile-col',
    country: 'COL',
    platform: 'instagram',
    contentType: 'profile',
    description: 'Perfiles y biografía en Instagram Colombia'
  },
  {
    taskName: 'Youtube_shorts_COL',
    apiTaskId: 'suarezt~youtube-shorts-col',
    country: 'COL',
    platform: 'youtube',
    contentType: 'shorts',
    description: 'YouTube Shorts en Colombia'
  },

  // ==========================================
  // TAREAS DE MÉXICO (país: 'MX')
  // ==========================================
  {
    taskName: 'Tiktok_profile_MX',
    apiTaskId: 'suarezt~tiktok-profile-mx',
    country: 'MX',
    platform: 'tiktok',
    contentType: 'profile',
    description: 'Perfiles de marcas competidoras en TikTok México'
  },
  {
    taskName: 'Youtube_videos_MX',
    apiTaskId: 'suarezt~youtube-videos-mx',
    country: 'MX',
    platform: 'youtube',
    contentType: 'videos',
    description: 'Videos de marcas competidoras en YouTube México'
  },
  {
    taskName: 'Facebook_post_MX',
    apiTaskId: 'suarezt~facebook-post-mx',
    country: 'MX',
    platform: 'facebook',
    contentType: 'post',
    description: 'Publicaciones y métricas en Facebook México'
  },
  {
    taskName: 'Facebook_profile_MX',
    apiTaskId: 'suarezt~facebook-profile-mx',
    country: 'MX',
    platform: 'facebook',
    contentType: 'profile',
    description: 'Páginas y perfiles en Facebook México'
  },
  {
    taskName: 'Tiktok_post_MX',
    apiTaskId: 'suarezt~tiktok-post-mx',
    country: 'MX',
    platform: 'tiktok',
    contentType: 'post',
    description: 'Posts y videos en TikTok México'
  },
  {
    taskName: 'Instagram_profile_MX',
    apiTaskId: 'suarezt~instagram-profile-mx',
    country: 'MX',
    platform: 'instagram',
    contentType: 'profile',
    description: 'Perfiles y biografía en Instagram México'
  },
  {
    taskName: 'Instagram_post_MX',
    apiTaskId: 'suarezt~instagram-post-mx',
    country: 'MX',
    platform: 'instagram',
    contentType: 'post',
    description: 'Publicaciones y reels en Instagram México'
  },
  {
    taskName: 'Youtube_shorts_MX',
    apiTaskId: 'suarezt~youtube-shorts-mx',
    country: 'MX',
    platform: 'youtube',
    contentType: 'shorts',
    description: 'YouTube Shorts en México'
  }
];

export function getTasksByCountry(country: MarketCountryCode): ApifyTaskDefinition[] {
  return APIFY_TASKS_CATALOG.filter(t => t.country === country);
}

export function findTaskByApiId(apiTaskId: string): ApifyTaskDefinition | undefined {
  const normalized = apiTaskId.toLowerCase().replace('/', '~');
  return APIFY_TASKS_CATALOG.find(t => t.apiTaskId.toLowerCase() === normalized);
}

export function findTaskByName(taskName: string): ApifyTaskDefinition | undefined {
  const normalized = taskName.toLowerCase();
  return APIFY_TASKS_CATALOG.find(t => t.taskName.toLowerCase() === normalized);
}

export const VALID_TASK_NAMES = new Set<string>(APIFY_TASKS_CATALOG.map(t => t.taskName));
export const VALID_API_TASK_IDS = new Set<string>(APIFY_TASKS_CATALOG.map(t => t.apiTaskId.toLowerCase()));

export function isValidTaskName(taskName?: string | null): boolean {
  if (!taskName) return false;
  return VALID_TASK_NAMES.has(taskName);
}

export function isValidApiTaskId(apiTaskId?: string | null): boolean {
  if (!apiTaskId) return false;
  const normalized = apiTaskId.toLowerCase().replace('/', '~');
  return VALID_API_TASK_IDS.has(normalized);
}

export function normalizeMarketCountry(country?: string | null): MarketCountryCode {
  if (!country) return 'COL';
  const c = country.trim().toUpperCase();
  if (c === 'MX' || c === 'MEXICO' || c === 'MÉXICO') return 'MX';
  return 'COL';
}

export function isValidTaskForMarket(taskName: string | undefined | null, market: MarketCountryCode): boolean {
  if (!taskName) return false;
  const task = APIFY_TASKS_CATALOG.find(t => t.taskName.toLowerCase() === taskName.toLowerCase());
  return task !== undefined && task.country === market;
}

export function getTasksByCountryAndPlatform(country: MarketCountryCode, platform: PlatformType): ApifyTaskDefinition[] {
  return APIFY_TASKS_CATALOG.filter(t => t.country === country && t.platform === platform);
}
