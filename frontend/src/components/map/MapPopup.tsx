import React from 'react'
import Point from '@arcgis/core/geometry/Point'
import * as Popover from '@radix-ui/react-popover'
import type { PriceItem } from '../../store/priceStore'
import type { RiskItem } from '../../store/riskStore'
import type { JPMorganOffice } from '../../store/jpmorganStore'
import type { TravelAdvisoryItem } from '../../store/travelAdvisoryStore'

export type MapPopupPayload =
  | { type: 'price'; item: PriceItem }
  | { type: 'risk'; item: RiskItem }
  | { type: 'jpmorgan'; office: JPMorganOffice }
  | { type: 'travel_advisory'; item: TravelAdvisoryItem }

export type MapPopupSelection = {
  x: number
  y: number
  position?: Point
  payload: MapPopupPayload
}

type MapPopupProps = {
  x: number
  y: number
  payload: MapPopupPayload
  onClose: () => void
}

const PricePopupContent = ({ item }: { item: PriceItem }) => {
  const goldUsd =
    typeof item.gold_usd === 'number' ? `$${item.gold_usd.toFixed(2)}` : 'N/A'
  const silverUsd =
    typeof item.silver_usd === 'number'
      ? `$${item.silver_usd.toFixed(2)}`
      : 'N/A'
  const goldUnit = item.gold_unit ?? item.unit ?? 'unit'
  const silverUnit = item.silver_unit ?? item.unit ?? 'unit'
  const localCode = item.currency ?? 'LOCAL'
  const goldLocal =
    typeof item.gold_local === 'number'
      ? `${localCode} ${item.gold_local.toFixed(2)}`
      : 'N/A'
  const silverLocal =
    typeof item.silver_local === 'number'
      ? `${localCode} ${item.silver_local.toFixed(2)}`
      : 'N/A'

  return (
    <div className="space-y-2">
      <div className="text-lg font-bold">{item.country}</div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Gold (USD / {goldUnit})</span>
          <span className="font-mono">{goldUsd}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">
            Gold ({localCode} / {goldUnit})
          </span>
          <span className="font-mono text-gray-300">{goldLocal}</span>
        </div>
        <div className="my-1 h-px bg-gray-700" />
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Silver (USD / {silverUnit})</span>
          <span className="font-mono">{silverUsd}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">
            Silver ({localCode} / {silverUnit})
          </span>
          <span className="font-mono text-gray-300">{silverLocal}</span>
        </div>
      </div>
      {item.retrieved_at && (
        <div className="mt-2 text-xs text-gray-500">
          Updated: {new Date(item.retrieved_at).toLocaleString()}
        </div>
      )}
    </div>
  )
}

const RiskPopupContent = ({ item }: { item: RiskItem }) => {
  const risk = Number(item.risk_level ?? 0)
  return (
    <div className="space-y-2">
      <div className="text-lg font-bold">Risk Assessment</div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Location</span>
          <span className="font-mono text-gray-200">
            {item.country ?? 'Unknown'} {item.city ? `(${item.city})` : ''}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Risk Level</span>
          <span
            className="font-mono font-bold"
            style={{
              color: risk > 50 ? '#ef4444' : risk > 20 ? '#eab308' : '#22c55e',
            }}
          >
            {Math.round(risk)}/100
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Coordinates</span>
          <span className="font-mono text-xs text-gray-400">
            {item.latitude.toFixed(2)}, {item.longitude.toFixed(2)}
          </span>
        </div>
      </div>
      {item.updated_at && (
        <div className="mt-2 text-xs text-gray-500">
          Updated: {new Date(item.updated_at).toLocaleString()}
        </div>
      )}
    </div>
  )
}

const JPMorganPopupContent = ({ office }: { office: JPMorganOffice }) => {
  return (
    <div className="space-y-2">
      <div className="text-lg font-bold">JP Morgan Office</div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">City</span>
          <span className="font-mono text-gray-200">{office.city}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Country</span>
          <span className="font-mono text-gray-200">{office.country}</span>
        </div>
        <div className="my-1 h-px bg-gray-700" />
        <div className="space-y-1">
          <span className="text-gray-400 text-xs">Address</span>
          <div className="font-mono text-xs text-gray-300">
            {office.address}
          </div>
        </div>
        {office.office_type && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Type</span>
            <span className="font-mono text-gray-200">
              {office.office_type}
            </span>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Coordinates</span>
          <span className="font-mono text-xs text-gray-400">
            {office.latitude.toFixed(4)}, {office.longitude.toFixed(4)}
          </span>
        </div>
      </div>
    </div>
  )
}

const TravelAdvisoryPopupContent = ({ item }: { item: TravelAdvisoryItem }) => {
  const level = item.level
  const levelDescriptions: Record<number, string> = {
    1: 'Exercise Normal Precautions',
    2: 'Exercise Increased Caution',
    3: 'Reconsider Travel',
    4: 'Do Not Travel',
  }
  const levelDescription = level ? levelDescriptions[level] : 'No Data'
  const levelColor =
    level === 1
      ? '#22c55e'
      : level === 2
        ? '#eab308'
        : level === 3
          ? '#f97316'
          : level === 4
            ? '#ef4444'
            : '#6b7280'

  return (
    <div className="space-y-2">
      <div className="text-lg font-bold">Travel Advisory</div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Country</span>
          <span className="font-mono text-gray-200">{item.country}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Advisory Level</span>
          <span className="font-mono font-bold" style={{ color: levelColor }}>
            {level ? `Level ${level}` : 'N/A'}
          </span>
        </div>
        {level && (
          <div className="text-xs text-gray-400 italic">{levelDescription}</div>
        )}
        {item.error && (
          <div className="text-xs text-yellow-400">{item.error}</div>
        )}
      </div>
      {item.retrieved_at && (
        <div className="mt-2 text-xs text-gray-500">
          Updated: {new Date(item.retrieved_at).toLocaleString()}
        </div>
      )}
    </div>
  )
}

export default function MapPopup({ x, y, payload, onClose }: MapPopupProps) {
  const content =
    payload.type === 'price' ? (
      <PricePopupContent item={payload.item} />
    ) : payload.type === 'risk' ? (
      <RiskPopupContent item={payload.item} />
    ) : payload.type === 'jpmorgan' ? (
      <JPMorganPopupContent office={payload.office} />
    ) : (
      <TravelAdvisoryPopupContent item={payload.item} />
    )

  return (
    <Popover.Root open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <Popover.Anchor asChild>
        <div
          className="pointer-events-none fixed z-50 h-2 w-2"
          style={{
            left: x,
            top: y,
            transform: 'translate(-50%, -50%)',
          }}
        />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="center"
          sideOffset={12}
          className="z-50 min-w-[300px] max-w-sm rounded-lg border border-white/10 bg-gray-900/95 p-4 text-white shadow-xl backdrop-blur-md"
        >
          <button
            onClick={onClose}
            className="absolute right-2 top-2 rounded-full p-1 text-gray-400 hover:bg-white/10 hover:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          {content}
          <Popover.Arrow className="fill-gray-900/95" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
