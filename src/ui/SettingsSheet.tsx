import credits from '../content/credits.json'
import links from '../content/links.json'
import { platform } from '../platform/index.ts'
import { useSettings } from '../store/settings.ts'
import { APP_VERSION } from '../store/tracking.ts'
import { useUi } from '../store/uiStore.ts'
import { Sheet, Toggle } from './Sheet.tsx'

export function SettingsSheet({ onRestore }: { onRestore?: () => void }) {
  const open = useUi((s) => s.open)
  const settings = useSettings()
  return (
    <Sheet title="Settings" onClose={() => open(null)}>
      <Toggle
        label="Sound effects"
        value={settings.sound}
        onChange={() => settings.toggle('sound')}
      />
      <Toggle label="Music" value={settings.music} onChange={() => settings.toggle('music')} />
      <Toggle
        label="Vibration"
        value={settings.haptics}
        onChange={() => settings.toggle('haptics')}
      />
      <div className="sheet-actions">
        <button
          className="btn"
          onClick={() => (onRestore ? onRestore() : void platform.purchases.restore())}
        >
          Restore purchases
        </button>
        <button className="btn" onClick={() => open('feedback')}>
          Send feedback
        </button>
        <a className="btn btn-link" href={links.privacyPolicy} target="_blank" rel="noreferrer">
          Privacy policy
        </a>
        <button className="btn" onClick={() => open('credits')}>
          Credits
        </button>
      </div>
      <p className="sheet-note">Version {APP_VERSION}</p>
    </Sheet>
  )
}

export function CreditsSheet() {
  const open = useUi((s) => s.open)
  return (
    <Sheet title="Credits" onClose={() => open('settings')}>
      {credits.lines.map((line) => (
        <p key={line} className="credits-line">
          {line}
        </p>
      ))}
    </Sheet>
  )
}
