'use client'

import dynamic from 'next/dynamic'

const AirCanvas = dynamic(
  () => import('@/components/air-canvas/AirCanvas'),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading Air Canvas...</p>
        </div>
      </div>
    )
  }
)

export default function AirCanvasWrapper() {
  return <AirCanvas />
}
