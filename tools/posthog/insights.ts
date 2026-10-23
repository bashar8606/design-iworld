// Creates the Solar Oasis dashboard in PostHog: day-1/7/30 retention, minutes played per day,
// rewarded ads per daily player, and the funnel from tutorial start to first technician.
//
//   POSTHOG_HOST=https://eu.posthog.com POSTHOG_PROJECT_ID=12345 \
//   POSTHOG_PERSONAL_API_KEY=phx_... npm run posthog:insights
//
// The personal API key needs insight and dashboard write access (Settings → Personal API keys).
const host = process.env.POSTHOG_HOST ?? 'https://eu.posthog.com'
const project = process.env.POSTHOG_PROJECT_ID
const key = process.env.POSTHOG_PERSONAL_API_KEY
if (!project || !key) {
  console.error(
    'Set POSTHOG_PROJECT_ID and POSTHOG_PERSONAL_API_KEY (and POSTHOG_HOST if not EU cloud).',
  )
  process.exit(1)
}

async function api<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${host}/api/projects/${project}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

const events = (event: string, extra: Record<string, unknown> = {}) => ({
  kind: 'EventsNode',
  event,
  name: event,
  ...extra,
})

const insights = [
  {
    name: 'Retention: day 1, 7 and 30',
    description:
      'Players who open the app again N days after their first app_open. Soft-launch gate: D1 ≥ 40%, D7 ≥ 12%.',
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'RetentionQuery',
        dateRange: { date_from: '-60d' },
        retentionFilter: {
          period: 'Day',
          totalIntervals: 31,
          retentionType: 'retention_first_time',
          targetEntity: { id: 'app_open', type: 'events' },
          returningEntity: { id: 'app_open', type: 'events' },
        },
      },
    },
  },
  {
    name: 'Minutes played per daily player',
    description: 'Sum of session_end.minutes divided by daily active players.',
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        interval: 'day',
        dateRange: { date_from: '-30d' },
        series: [
          events('session_end', { math: 'sum', math_property: 'minutes' }),
          events('app_open', { math: 'dau' }),
        ],
        trendsFilter: { formula: 'A / B', display: 'ActionsLineGraph' },
      },
    },
  },
  {
    name: 'Rewarded ads per daily player',
    description: 'ad_rewarded events divided by daily active players, by placement below.',
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        interval: 'day',
        dateRange: { date_from: '-30d' },
        series: [events('ad_rewarded'), events('app_open', { math: 'dau' })],
        trendsFilter: { formula: 'A / B', display: 'ActionsLineGraph' },
      },
    },
  },
  {
    name: 'Rewarded ads by placement',
    description: 'Which placements earn.',
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        interval: 'day',
        dateRange: { date_from: '-30d' },
        series: [events('ad_rewarded')],
        breakdownFilter: { breakdown: 'placement', breakdown_type: 'event' },
      },
    },
  },
  {
    name: 'Funnel: tutorial start → first technician',
    description: 'Where new players drop out of the first ten minutes.',
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'FunnelsQuery',
        dateRange: { date_from: '-30d' },
        series: [
          events('tutorial_start'),
          events('tutorial_step', {
            properties: [{ key: 'step', value: 'plug', operator: 'exact', type: 'event' }],
          }),
          events('tutorial_complete'),
          events('pad_built', {
            properties: [{ key: 'kind', value: 'battery', operator: 'exact', type: 'event' }],
          }),
          events('staff_hired', {
            properties: [{ key: 'kind', value: 'technician', operator: 'exact', type: 'event' }],
          }),
        ],
        funnelsFilter: { funnelWindowInterval: 14, funnelWindowIntervalUnit: 'day' },
      },
    },
  },
]

const dashboard = await api<{ id: number }>('/dashboards/', {
  name: 'Solar Oasis — soft launch',
  description:
    'Retention, play time, ads and the first-session funnel. Created by tools/posthog/insights.ts.',
})
for (const insight of insights) {
  const created = await api<{ short_id: string }>('/insights/', {
    ...insight,
    dashboards: [dashboard.id],
  })
  console.log(`${insight.name}: ${host}/project/${project}/insights/${created.short_id}`)
}
console.log(`Dashboard: ${host}/project/${project}/dashboard/${dashboard.id}`)
