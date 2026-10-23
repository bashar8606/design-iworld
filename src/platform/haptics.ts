import { Haptics as CapHaptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

export type ImpactStrength = 'light' | 'medium' | 'heavy'

export interface Haptics {
  impact(strength: ImpactStrength): Promise<void>
  success(): Promise<void>
}

export const webHaptics: Haptics = {
  async impact(strength) {
    console.info(`[haptics] impact ${strength} (web stub)`)
  },
  async success() {
    console.info('[haptics] success (web stub)')
  },
}

const impactStyles: Record<ImpactStrength, ImpactStyle> = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
}

export const nativeHaptics: Haptics = {
  async impact(strength) {
    await CapHaptics.impact({ style: impactStyles[strength] })
  },
  async success() {
    await CapHaptics.notification({ type: NotificationType.Success })
  },
}
