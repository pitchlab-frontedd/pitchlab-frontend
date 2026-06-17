import { useState, useMemo } from 'react'
import { Typography } from 'antd'

const { Text } = Typography

const CELL = 62
const GRID = 5
const SIZE = CELL * GRID
const RING = CELL
const STRIKE_START = RING
const STRIKE_SIZE = CELL * 3
const MID = SIZE / 2
const STRIKE_END = STRIKE_START + STRIKE_SIZE

// X bounds are fixed (plate width doesn't vary by batter)
const STRIKE_X_MIN = -0.83
const STRIKE_X_MAX = 0.83
const STRIKE_WIDTH = STRIKE_X_MAX - STRIKE_X_MIN
const X_MIN = STRIKE_X_MIN - STRIKE_WIDTH / 3
const X_MAX = STRIKE_X_MAX + STRIKE_WIDTH / 3

// Z bounds are computed dynamically from zone data (see useMemo below).
// Fallback values for when sample is too small.
const SZ_TOP_DEFAULT = 3.4
const SZ_BOT_DEFAULT = 1.6
const MIN_ZONE_SAMPLE = 5

const PITCH_TYPE_COLORS = {
  FF: '#58a6ff',
  SI: '#3fb950',
  FC: '#d29922',
  SL: '#f85149',
  CU: '#a371f7',
  KC: '#a371f7',
  CH: '#ff7b72',
  FS: '#db6d28',
  ST: '#f0883e',
  SV: '#bc8cff',
  KN: '#8b949e',
  EP: '#8b949e',
  FO: '#8b949e',
  CS: '#a371f7',
}
const FALLBACK_COLOR = '#8b949e'

function mean(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function mapToSvgX(plateX) {
  const ratio = (plateX - X_MIN) / (X_MAX - X_MIN)
  return Math.max(0, Math.min(SIZE, ratio * SIZE))
}

function getPitchColor(pitchType) {
  return PITCH_TYPE_COLORS[pitchType] || FALLBACK_COLOR
}

export default function ActualNextPitchLocations({ nextPitchLocations = [], selectedCount = 0, setName, setColor }) {
  const [tooltip, setTooltip] = useState(null)

  const validNextCount = nextPitchLocations.length
  const excludedCount = Math.max(0, selectedCount - validNextCount)

  const pitchTypeCounts = useMemo(() => {
    const counts = {}
    nextPitchLocations.forEach(p => {
      const pt = p.next_pitch_type || 'Unknown'
      counts[pt] = (counts[pt] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [nextPitchLocations])

  // Derive sz_top / sz_bot from zone data so the overlay aligns with the actual
  // batter's strike zone (e.g. Aaron Judge's sz_top is ~4.1, not the average 3.4).
  // Top-row zones 1-3 anchor sz_top; bottom-row zones 7-9 anchor sz_bot.
  const { zMin, zMax, dataDriven } = useMemo(() => {
    const zv = (p) => p.plate_z != null ? Number(p.plate_z) : NaN

    const topZ = nextPitchLocations
      .filter(p => [1, 2, 3].includes(Number(p.next_zone)))
      .map(zv).filter(v => !isNaN(v))

    const botZ = nextPitchLocations
      .filter(p => [7, 8, 9].includes(Number(p.next_zone)))
      .map(zv).filter(v => !isNaN(v))

    const szTop = topZ.length >= MIN_ZONE_SAMPLE ? mean(topZ) : SZ_TOP_DEFAULT
    const szBot = botZ.length >= MIN_ZONE_SAMPLE ? mean(botZ) : SZ_BOT_DEFAULT
    const strikeHeight = szTop - szBot

    return {
      zMin: szBot - strikeHeight / 3,
      zMax: szTop + strikeHeight / 3,
      dataDriven: topZ.length >= MIN_ZONE_SAMPLE && botZ.length >= MIN_ZONE_SAMPLE,
    }
  }, [nextPitchLocations])

  const mapToSvgY = (plateZ) => {
    const ratio = (plateZ - zMin) / (zMax - zMin)
    return Math.max(0, Math.min(SIZE, SIZE - ratio * SIZE))
  }

  const isEmpty = validNextCount === 0

  return (
    <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {setName && setColor && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: setColor }} />
        )}
        <Text style={{
          color: '#e6edf3', fontSize: 13, fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          fontFamily: "'Barlow Condensed', sans-serif",
        }}>
          Actual Next Pitch Locations {setName ? `· ${setName}` : ''}
        </Text>
      </div>

      {/* Sample size summary */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 11, color: '#484f58', fontFamily: 'JetBrains Mono, monospace' }}>
          Selected: <span style={{ color: '#e6edf3' }}>{selectedCount}</span>
        </Text>
        <Text style={{ fontSize: 11, color: '#484f58', fontFamily: 'JetBrains Mono, monospace' }}>
          Next: <span style={{ color: '#58a6ff' }}>{validNextCount}</span>
        </Text>
        <Text style={{ fontSize: 11, color: '#484f58', fontFamily: 'JetBrains Mono, monospace' }}>
          Terminal: <span style={{ color: '#484f58' }}>{excludedCount}</span>
        </Text>
        <Text style={{ fontSize: 11, color: dataDriven ? '#3fb950' : '#484f58', fontFamily: 'JetBrains Mono, monospace' }}>
          {dataDriven ? 'sz: data-driven' : 'sz: avg'}
        </Text>
      </div>

      {/* SVG */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {isEmpty ? (
          <div style={{
            width: SIZE, height: SIZE,
            background: '#0d1117', borderRadius: 4,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
            border: '1px solid #21262d',
          }}>
            <Text style={{ color: '#484f58', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', textAlign: 'center', padding: '0 24px' }}>
              No valid same-at-bat next pitches found.
            </Text>
            <Text style={{ color: '#30363d', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', textAlign: 'center', padding: '0 24px' }}>
              Selected pitches may be terminal pitches that ended the plate appearance.
            </Text>
          </div>
        ) : (
          <svg
            width={SIZE} height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            style={{ borderRadius: 4, overflow: 'visible' }}
            onMouseLeave={() => setTooltip(null)}
          >
            <rect width={SIZE} height={SIZE} fill="#0d1117" />

            {/* Outer bounding box */}
            <rect x={0} y={0} width={SIZE} height={SIZE} fill="none" stroke="#21262d" strokeWidth={1} />

            {/* Chase zone midlines */}
            <line x1={MID} y1={0} x2={MID} y2={STRIKE_START} stroke="#21262d" strokeWidth={1} />
            <line x1={MID} y1={STRIKE_END} x2={MID} y2={SIZE} stroke="#21262d" strokeWidth={1} />
            <line x1={0} y1={MID} x2={STRIKE_START} y2={MID} stroke="#21262d" strokeWidth={1} />
            <line x1={STRIKE_END} y1={MID} x2={SIZE} y2={MID} stroke="#21262d" strokeWidth={1} />

            {/* Strike zone outer border */}
            <rect x={STRIKE_START} y={STRIKE_START}
              width={STRIKE_SIZE} height={STRIKE_SIZE}
              fill="none" stroke="#30363d" strokeWidth={2} />

            {/* Strike zone 3x3 grid */}
            <line x1={STRIKE_START + CELL} y1={STRIKE_START} x2={STRIKE_START + CELL} y2={STRIKE_END} stroke="#21262d" strokeWidth={1.5} />
            <line x1={STRIKE_START + CELL * 2} y1={STRIKE_START} x2={STRIKE_START + CELL * 2} y2={STRIKE_END} stroke="#21262d" strokeWidth={1.5} />
            <line x1={STRIKE_START} y1={STRIKE_START + CELL} x2={STRIKE_END} y2={STRIKE_START + CELL} stroke="#21262d" strokeWidth={1.5} />
            <line x1={STRIKE_START} y1={STRIKE_START + CELL * 2} x2={STRIKE_END} y2={STRIKE_START + CELL * 2} stroke="#21262d" strokeWidth={1.5} />

            {/* Scatter points */}
            {nextPitchLocations.map((p, i) => {
              const x = mapToSvgX(Number(p.plate_x))
              const y = mapToSvgY(Number(p.plate_z))
              const color = getPitchColor(p.next_pitch_type)
              return (
                <circle
                  key={i}
                  cx={x} cy={y} r={4}
                  fill={color}
                  fillOpacity={0.6}
                  style={{ cursor: 'crosshair' }}
                  onMouseMove={(e) => setTooltip({ data: p, x: e.clientX, y: e.clientY })}
                />
              )
            })}
          </svg>
        )}
      </div>

      {/* Legend */}
      {!isEmpty && pitchTypeCounts.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 10px', marginTop: 10 }}>
          {pitchTypeCounts.map(([pt, count]) => (
            <div key={pt} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: getPitchColor(pt), flexShrink: 0 }} />
              <Text style={{ fontSize: 10, color: '#8b949e', fontFamily: 'JetBrains Mono, monospace' }}>
                {pt} <span style={{ color: '#484f58' }}>({count})</span>
              </Text>
            </div>
          ))}
        </div>
      )}

      <Text style={{
        display: 'block', textAlign: 'center',
        fontSize: 10, color: '#30363d', marginTop: 5,
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        Each dot is one historical next pitch · sequence visualization, not prediction
      </Text>

      {/* Tooltip */}
      {tooltip && (() => {
        const { data, x, y } = tooltip
        return (
          <div style={{
            position: 'fixed', left: x + 14, top: y - 20,
            background: '#1f2937', border: '1px solid #374151', borderRadius: 6,
            padding: '8px 12px', fontSize: 11, color: '#e6edf3',
            pointerEvents: 'none', zIndex: 9999,
            fontFamily: 'JetBrains Mono, monospace',
            whiteSpace: 'nowrap', lineHeight: 1.9,
          }}>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{data.game_date}</div>
            {data.player_name && <div style={{ color: '#8b949e', marginBottom: 4 }}>{data.player_name}</div>}
            <div style={{ borderTop: '1px solid #374151', paddingTop: 4 }}>
              <div style={{ color: '#484f58', fontSize: 10, marginBottom: 2 }}>PREVIOUS PITCH</div>
              <div>Type: <span style={{ color: getPitchColor(data.prev_pitch_type) }}>{data.prev_pitch_type || '—'}</span></div>
              {data.prev_zone != null && <div>Zone: {data.prev_zone}</div>}
              <div>Count: {data.balls}-{data.strikes}</div>
              {data.prev_description && <div>Result: {data.prev_description}</div>}
            </div>
            <div style={{ marginTop: 4, borderTop: '1px solid #374151', paddingTop: 4 }}>
              <div style={{ color: '#484f58', fontSize: 10, marginBottom: 2 }}>NEXT PITCH</div>
              <div>Type: <span style={{ color: getPitchColor(data.next_pitch_type) }}>{data.next_pitch_type || '—'}</span></div>
              {data.next_zone != null && <div>Zone: {data.next_zone}</div>}
              {data.next_speed != null && <div>Velo: {Number(data.next_speed).toFixed(1)} mph</div>}
              {data.next_description && <div>Result: {data.next_description}</div>}
              <div style={{ color: '#484f58' }}>
                plate_x: {Number(data.plate_x).toFixed(2)} · plate_z: {Number(data.plate_z).toFixed(2)}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
