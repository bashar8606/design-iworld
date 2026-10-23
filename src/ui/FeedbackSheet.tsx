import { useState } from 'react'
import links from '../content/links.json'
import { trackUi } from '../store/tracking.ts'
import { useUi } from '../store/uiStore.ts'
import { Sheet } from './Sheet.tsx'

/** A short feedback form; answers go to analytics as a "feedback" event. */
export function FeedbackSheet() {
  const open = useUi((s) => s.open)
  const [rating, setRating] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  return (
    <Sheet title="Send feedback" onClose={() => open('settings')}>
      {sent ? (
        <p>Thanks! Every note gets read.</p>
      ) : (
        <form
          className="feedback"
          onSubmit={(e) => {
            e.preventDefault()
            trackUi('feedback', { rating, text: text.slice(0, 2000) })
            setSent(true)
          }}
        >
          <p>How much fun are you having?</p>
          <div className="feedback-rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                className={rating === n ? 'active' : ''}
                onClick={() => setRating(n)}
                aria-label={`${n} of 5`}
              >
                {'★'}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What confused you? What would you change?"
            rows={4}
          />
          <button className="btn btn-primary" type="submit" disabled={!rating && !text.trim()}>
            Send
          </button>
          <a className="sheet-note" href={links.feedbackForm} target="_blank" rel="noreferrer">
            Or use the longer form
          </a>
        </form>
      )}
    </Sheet>
  )
}
