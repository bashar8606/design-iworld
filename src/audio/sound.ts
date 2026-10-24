// Sound effects, night ambience and music with howler.js, driven by game events and settings.
import { Howl, Howler } from 'howler'
import { getContent } from '../game/content.ts'
import { isNight } from '../game/world.ts'
import { platform } from '../platform/index.ts'
import { onGameEvent } from '../store/events.ts'
import { useGame } from '../store/gameStore.ts'
import { useSettings } from '../store/settings.ts'

const url = (name: string) => `${import.meta.env.BASE_URL}audio/${name}.mp3`

/** Starts audio and haptic feedback; returns a cleanup. */
export function startFeedback(): () => void {
  const sfx = {
    cash: new Howl({ src: [url('cash')], volume: 0.5 }),
    build: new Howl({ src: [url('build')], volume: 0.6 }),
    carArrive: new Howl({ src: [url('car_arrive')], volume: 0.25 }),
    carAngry: new Howl({ src: [url('car_angry')], volume: 0.4 }),
  }
  const music = new Howl({ src: [url('music')], loop: true, volume: 0.22 })
  const night = new Howl({ src: [url('night')], loop: true, volume: 0 })
  let lastCash = 0

  const play = (sound: Howl) => {
    if (useSettings.getState().sound) sound.play()
  }
  const haptic = (fn: () => Promise<void>) => {
    if (useSettings.getState().haptics) void fn().catch(() => {})
  }

  const offEvents = onGameEvent((e) => {
    switch (e.type) {
      case 'cashCollected': {
        if (e.by !== 'player') break
        // Collecting several stacks at once plays one chime.
        const now = performance.now()
        if (now - lastCash > 90) play(sfx.cash)
        lastCash = now
        haptic(() => platform.haptics.impact('light'))
        break
      }
      case 'padBuilt':
      case 'upgradeDone':
        play(sfx.build)
        haptic(() => platform.haptics.success())
        break
      case 'carArrived':
        play(sfx.carArrive)
        break
      case 'blast':
        play(sfx.build)
        haptic(() => platform.haptics.impact('heavy'))
        break
      case 'carLost':
        play(sfx.carAngry)
        break
    }
  })

  // Music and the night ambience follow the settings, the clock and the app state.
  // Browsers (and iOS) only allow audio after the first tap or key press.
  let unlocked = false
  const unlock = () => {
    unlocked = true
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
    update()
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)

  const update = () => {
    if (!unlocked) return
    const { sound, music: musicOn } = useSettings.getState()
    const { state, paused } = useGame.getState()
    if (paused) {
      Howler.mute(true)
      return
    }
    Howler.mute(false)
    if (musicOn && !music.playing()) music.play()
    if (!musicOn && music.playing()) music.pause()
    const dark = isNight(state.dayTime, getContent(state.mapId).map)
    const target = sound && dark ? 0.35 : 0
    if (target > 0 && !night.playing()) night.play()
    if (Math.abs(night.volume() - target) > 0.01) night.fade(night.volume(), target, 1500)
  }
  const timer = setInterval(update, 1000)
  const offSettings = useSettings.subscribe(update)
  const offPause = useGame.subscribe((s, prev) => {
    if (s.paused !== prev.paused) update()
  })
  update()

  return () => {
    offEvents()
    offSettings()
    offPause()
    clearInterval(timer)
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
    for (const h of [...Object.values(sfx), music, night]) h.unload()
  }
}
