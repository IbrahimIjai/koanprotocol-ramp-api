export const ProviderConfig = {
  PAYCREST: 'paycrest',
  DEXPAY: 'dexpay',
} as const;

export type ProviderType = typeof ProviderConfig[keyof typeof ProviderConfig];

export const isValidProvider = (provider: string): provider is ProviderType => {
  return Object.values(ProviderConfig).includes(provider as ProviderType);
};
