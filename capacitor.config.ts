import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.yourname.solaroasis',
  appName: 'Solar Oasis',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
  },
}

export default config
