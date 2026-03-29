'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  CameraOff,
  Camera as CameraIcon,
  Trash2,
  Download,
  Palette,
  Hand,
  Eraser,
  PenTool,
  Sparkles,
  Info,
  Loader2
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// Color palette for drawing
const COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Cyan', value: '#06b6d4' },
]

// Landmark indices for finger tips and other key points
const FINGER_TIPS = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 }
const FINGER_PIPS = { thumb: 3, index: 6, middle: 10, ring: 14, pinky: 18 }
const FINGER_MCPS = { thumb: 2, index: 5, middle: 9, ring: 13, pinky: 17 }

interface LandmarkPoint {
  x: number
  y: number
  z: number
}

interface HandResults {
  multiHandLandmarks?: LandmarkPoint[][]
}

interface HandsInterface {
  setOptions: (options: Record<string, unknown>) => void
  onResults: (callback: (results: HandResults) => void) => void
  send: (input: { image: HTMLVideoElement }) => Promise<void>
  close: () => void
}

interface HandsConstructor {
  new (config: { locateFile: (file: string) => string }): HandsInterface
}

interface CameraInterface {
  start: () => Promise<void>
  stop: () => void
}

export default function AirCanvas() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null)
  const handsRef = useRef<HandsInterface | null>(null)
  const cameraRef = useRef<CameraInterface | null>(null)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const clearCounterRef = useRef(0)
  
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [brushColor, setBrushColor] = useState('#ef4444')
  const [brushSize, setBrushSize] = useState(8)
  const [isEraser, setIsEraser] = useState(false)
  const [handDetected, setHandDetected] = useState(false)
  const [gestureStatus, setGestureStatus] = useState('Waiting for hand...')
  const [mediaPipeLoaded, setMediaPipeLoaded] = useState(false)

  // Load MediaPipe scripts
  useEffect(() => {
    const handsScript = document.createElement('script')
    handsScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js'
    handsScript.crossOrigin = 'anonymous'
    
    const cameraScript = document.createElement('script')
    cameraScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'
    cameraScript.crossOrigin = 'anonymous'

    handsScript.onload = () => {
      cameraScript.onload = () => setMediaPipeLoaded(true)
      document.head.appendChild(cameraScript)
    }
    document.head.appendChild(handsScript)
  }, [])

  // Check if finger is extended
  const isFingerExtended = (landmarks: LandmarkPoint[], tip: number, pip: number, mcp: number) => {
    return landmarks[tip].y < landmarks[pip].y && landmarks[tip].y < landmarks[mcp].y
  }

  // Count extended fingers
  const countExtendedFingers = (landmarks: LandmarkPoint[]) => {
    let count = 0
    // Thumb - check x distance
    if (Math.abs(landmarks[4].x - landmarks[2].x) > 0.05) count++
    if (isFingerExtended(landmarks, 8, 6, 5)) count++
    if (isFingerExtended(landmarks, 12, 10, 9)) count++
    if (isFingerExtended(landmarks, 16, 14, 13)) count++
    if (isFingerExtended(landmarks, 20, 18, 17)) count++
    return count
  }

  // Draw line on canvas
  const drawLine = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = drawingCanvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
      ctx.lineWidth = brushSize * 3
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = brushColor
      ctx.lineWidth = brushSize
    }
    
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }, [brushColor, brushSize, isEraser])

  // Clear canvas
  const clearCanvas = useCallback(() => {
    const canvas = drawingCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    lastPointRef.current = null
  }, [])

  // Export canvas
  const exportCanvas = useCallback(() => {
    const video = videoRef.current
    const drawCanvas = drawingCanvasRef.current
    if (!video || !drawCanvas) return
    
    const exportEl = document.createElement('canvas')
    exportEl.width = drawCanvas.width
    exportEl.height = drawCanvas.height
    const ctx = exportEl.getContext('2d')
    if (!ctx) return
    
    // Mirror and draw video
    ctx.translate(exportEl.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, exportEl.width, exportEl.height)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    
    // Mirror and draw the drawing layer too (to match the mirrored video)
    ctx.translate(exportEl.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(drawCanvas, 0, 0)
    
    const link = document.createElement('a')
    link.download = `air-canvas-${Date.now()}.png`
    link.href = exportEl.toDataURL('image/png')
    link.click()
  }, [])

  // Handle MediaPipe results
  const onResults = useCallback((results: HandResults) => {
    const canvas = canvasRef.current
    const drawCanvas = drawingCanvasRef.current
    const video = videoRef.current
    
    if (!canvas || !drawCanvas || !video) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear and draw video
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      setHandDetected(true)
      const landmarks = results.multiHandLandmarks[0]
      
      // Use raw coordinates - both canvases are mirrored with CSS
      const indexTip = landmarks[FINGER_TIPS.index]
      const rawX = indexTip.x * drawCanvas.width
      const y = indexTip.y * drawCanvas.height
      
      const extendedCount = countExtendedFingers(landmarks)
      const indexExtended = isFingerExtended(landmarks, 8, 6, 5)
      const middleExtended = isFingerExtended(landmarks, 12, 10, 9)
      const ringExtended = isFingerExtended(landmarks, 16, 14, 13)
      const pinkyExtended = isFingerExtended(landmarks, 20, 18, 17)
      
      // Draw mode: ONLY index finger extended (no other fingers)
      const isDrawMode = indexExtended && !middleExtended && !ringExtended && !pinkyExtended
      // Clear mode: closed fist (NO fingers extended)
      const isClearMode = !indexExtended && !middleExtended && !ringExtended && !pinkyExtended
      
      // Debug log
      console.log('Fingers:', { indexExtended, middleExtended, ringExtended, pinkyExtended, isDrawMode, isClearMode })
      
      if (isClearMode) {
        clearCounterRef.current++
        if (clearCounterRef.current >= 20) {
          clearCanvas()
          setGestureStatus('Canvas cleared!')
          clearCounterRef.current = 0
        } else {
          setGestureStatus(`Fist detected - clearing in ${20 - clearCounterRef.current}...`)
        }
        lastPointRef.current = null
      } else if (isDrawMode) {
        clearCounterRef.current = 0
        if (lastPointRef.current) {
          console.log('DRAWING:', lastPointRef.current, '->', { x: rawX, y })
          drawLine(lastPointRef.current, { x: rawX, y })
          setGestureStatus(isEraser ? 'Erasing...' : 'DRAWING!')
        } else {
          setGestureStatus('Draw mode - move to draw')
        }
        lastPointRef.current = { x: rawX, y }
      } else {
        clearCounterRef.current = 0
        lastPointRef.current = null
        setGestureStatus(`${extendedCount} fingers - raise ONLY index to draw`)
      }
      
      // Draw finger indicator on video canvas (for visual feedback)
      const visualX = indexTip.x * canvas.width
      const visualY = indexTip.y * canvas.height
      
      // Draw finger indicator - BIGGER and with mode color
      ctx.beginPath()
      ctx.arc(visualX, visualY, isDrawMode ? 25 : 15, 0, 2 * Math.PI)
      if (isDrawMode) {
        ctx.fillStyle = brushColor
        ctx.strokeStyle = '#00ff00'
        ctx.lineWidth = 4
      } else if (isClearMode) {
        ctx.fillStyle = 'rgba(255,0,0,0.5)'
        ctx.strokeStyle = '#ff0000'
        ctx.lineWidth = 3
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
      }
      ctx.fill()
      ctx.stroke()
      
      // Draw hand skeleton
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)'
      ctx.lineWidth = 2
      const connections = [
        [0,1],[1,2],[2,3],[3,4],
        [0,5],[5,6],[6,7],[7,8],
        [0,9],[9,10],[10,11],[11,12],
        [0,13],[13,14],[14,15],[15,16],
        [0,17],[17,18],[18,19],[19,20],
        [5,9],[9,13],[13,17]
      ]
      for (const [a, b] of connections) {
        ctx.beginPath()
        ctx.moveTo(landmarks[a].x * canvas.width, landmarks[a].y * canvas.height)
        ctx.lineTo(landmarks[b].x * canvas.width, landmarks[b].y * canvas.height)
        ctx.stroke()
      }
    } else {
      setHandDetected(false)
      setGestureStatus('Show your hand to start')
      lastPointRef.current = null
      clearCounterRef.current = 0
    }
  }, [brushColor, isEraser, drawLine, clearCanvas])

  // Start camera
  const startCamera = useCallback(async () => {
    if (!videoRef.current || !mediaPipeLoaded) return
    setIsLoading(true)
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported in this browser. If you opened this link from Instagram or LinkedIn, please click the menu and select "Open in System Browser" (Chrome/Safari).')
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      })
      
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      
      const HandsClass = (window as unknown as { Hands: HandsConstructor }).Hands
      const CameraClass = (window as unknown as { Camera: new (...args: unknown[]) => CameraInterface }).Camera
      
      const hands = new HandsClass({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      })
      
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
      })
      
      hands.onResults(onResults)
      handsRef.current = hands
      
      const camera = new CameraClass(videoRef.current, {
        onFrame: async () => {
          if (handsRef.current && videoRef.current) {
            await handsRef.current.send({ image: videoRef.current })
          }
        },
        width: 1280,
        height: 720
      })
      
      await camera.start()
      cameraRef.current = camera
      
      // Set canvas sizes
      if (canvasRef.current && drawingCanvasRef.current) {
        canvasRef.current.width = 1280
        canvasRef.current.height = 720
        drawingCanvasRef.current.width = 1280
        drawingCanvasRef.current.height = 720
        
        console.log('Canvas sizes set:', {
          videoCanvas: { width: canvasRef.current.width, height: canvasRef.current.height },
          drawCanvas: { width: drawingCanvasRef.current.width, height: drawingCanvasRef.current.height }
        })
        
        // Draw test marker - BIG and VISIBLE
        const testCtx = drawingCanvasRef.current.getContext('2d')
        if (testCtx) {
          // Red circle top-left
          testCtx.fillStyle = '#ef4444'
          testCtx.beginPath()
          testCtx.arc(50, 50, 30, 0, Math.PI * 2)
          testCtx.fill()
          
          // Blue circle top-right
          testCtx.fillStyle = '#3b82f6'
          testCtx.beginPath()
          testCtx.arc(1230, 50, 30, 0, Math.PI * 2)
          testCtx.fill()
          
          // Green circle bottom-left
          testCtx.fillStyle = '#22c55e'
          testCtx.beginPath()
          testCtx.arc(50, 670, 30, 0, Math.PI * 2)
          testCtx.fill()
          
          // Yellow circle bottom-right
          testCtx.fillStyle = '#eab308'
          testCtx.beginPath()
          testCtx.arc(1230, 670, 30, 0, Math.PI * 2)
          testCtx.fill()
          
          console.log('Test circles drawn on drawing canvas')
        }
      }
      
      setIsStreaming(true)
    } catch (error: any) {
      console.error('Camera error:', error)
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(errorMessage.includes('Camera not supported') ? errorMessage : 'Failed to access camera. Please grant camera permissions and ensure you are using Chrome or Safari.')
    } finally {
      setIsLoading(false)
    }
  }, [onResults, mediaPipeLoaded])

  // Stop camera
  const stopCamera = useCallback(() => {
    cameraRef.current?.stop()
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      videoRef.current.srcObject = null
    }
    handsRef.current?.close()
    setIsStreaming(false)
    setHandDetected(false)
    setGestureStatus('Camera stopped')
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-lg">
                <PenTool className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Air Canvas</h1>
                <p className="text-xs text-slate-400">Draw with your finger in mid-air</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={handDetected ? "default" : "secondary"} className={handDetected ? "bg-green-500" : ""}>
                <Hand className="w-3 h-3 mr-1" />
                {handDetected ? 'Hand Detected' : 'No Hand'}
              </Badge>
              <Badge variant="outline" className="text-slate-300 border-slate-600 hidden sm:inline-flex">
                {gestureStatus}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Canvas Area */}
          <div className="lg:col-span-3">
            <Card className="bg-slate-800/50 border-slate-700 overflow-hidden">
              <CardContent className="p-0 relative">
                <video ref={videoRef} className="hidden" playsInline muted />
                
                <div className="relative w-full aspect-video bg-slate-900 flex items-center justify-center">
                  {!isStreaming ? (
                    <div className="text-center p-8">
                      {!mediaPipeLoaded ? (
                        <>
                          <Loader2 className="w-16 h-16 text-cyan-500 mx-auto mb-4 animate-spin" />
                          <h3 className="text-xl font-semibold text-white mb-2">Loading MediaPipe...</h3>
                        </>
                      ) : (
                        <>
                          <CameraOff className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                          <h3 className="text-xl font-semibold text-white mb-2">Camera Not Active</h3>
                          <p className="text-slate-400 mb-4">Click below to start drawing</p>
                          <Button
                            onClick={startCamera}
                            disabled={isLoading}
                            size="lg"
                            className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700"
                          >
                            {isLoading ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting...</>
                            ) : (
                              <><CameraIcon className="w-4 h-4 mr-2" />Start Camera</>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="relative w-full h-full bg-black">
                      {/* Video canvas - shows webcam + hand overlay (mirrored) */}
                      <canvas
                        ref={canvasRef}
                        className="absolute top-0 left-0 w-full h-full object-fill"
                        style={{ zIndex: 1, transform: 'scaleX(-1)' }}
                      />
                      {/* Drawing canvas - also mirrored to match */}
                      <canvas
                        ref={drawingCanvasRef}
                        className="absolute top-0 left-0 w-full h-full object-fill pointer-events-none"
                        style={{ zIndex: 20, transform: 'scaleX(-1)' }}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Mobile Status */}
            <div className="sm:hidden mt-4">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="py-3">
                  <div className="flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm text-slate-300">{gestureStatus}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Instructions */}
            <Card className="mt-4 bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2 text-base">
                  <Info className="w-4 h-4 text-cyan-400" />
                  How to Use
                </CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-3 gap-4 text-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-cyan-500/20 rounded-lg shrink-0">
                    <span className="text-2xl">☝️</span>
                  </div>
                  <div>
                    <p className="font-medium text-white">Draw</p>
                    <p className="text-slate-400">Raise only index finger</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-500/20 rounded-lg shrink-0">
                    <span className="text-2xl">✊</span>
                  </div>
                  <div>
                    <p className="font-medium text-white">Clear</p>
                    <p className="text-slate-400">Make a fist to clear</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg shrink-0">
                    <span className="text-2xl">✋</span>
                  </div>
                  <div>
                    <p className="font-medium text-white">Pause</p>
                    <p className="text-slate-400">Open hand to stop</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Controls Panel */}
          <div className="lg:col-span-1">
            <Card className="bg-slate-800/50 border-slate-700 lg:sticky lg:top-24">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Palette className="w-5 h-5 text-cyan-400" />
                  Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Camera Toggle */}
                <div className="space-y-2">
                  <Label className="text-slate-300">Camera</Label>
                  <Button
                    onClick={isStreaming ? stopCamera : startCamera}
                    disabled={isLoading || !mediaPipeLoaded}
                    className="w-full"
                    variant={isStreaming ? "destructive" : "default"}
                  >
                    {isLoading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading...</>
                    ) : isStreaming ? (
                      <><CameraOff className="w-4 h-4 mr-2" />Stop</>
                    ) : (
                      <><CameraIcon className="w-4 h-4 mr-2" />Start</>
                    )}
                  </Button>
                </div>

                <Separator className="bg-slate-700" />

                {/* Colors */}
                <div className="space-y-3">
                  <Label className="text-slate-300">Brush Color</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {COLORS.map((color) => (
                      <TooltipProvider key={color.value}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => { setBrushColor(color.value); setIsEraser(false) }}
                              className={`w-8 h-8 rounded-lg border-2 transition-all ${
                                brushColor === color.value && !isEraser ? 'border-white scale-110' : 'border-transparent'
                              }`}
                              style={{ backgroundColor: color.value }}
                            />
                          </TooltipTrigger>
                          <TooltipContent><p>{color.name}</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                </div>

                <Separator className="bg-slate-700" />

                {/* Brush Size */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-slate-300">Brush Size</Label>
                    <Badge variant="outline" className="text-slate-400">{brushSize}px</Badge>
                  </div>
                  <Slider
                    value={[brushSize]}
                    onValueChange={(v) => setBrushSize(v[0])}
                    min={2} max={30} step={1}
                  />
                </div>

                <Separator className="bg-slate-700" />

                {/* Tools */}
                <div className="space-y-3">
                  <Label className="text-slate-300">Tool</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={!isEraser ? "default" : "outline"}
                      size="sm"
                      onClick={() => setIsEraser(false)}
                      className="flex-1"
                    >
                      <PenTool className="w-4 h-4 mr-1" />Pen
                    </Button>
                    <Button
                      variant={isEraser ? "default" : "outline"}
                      size="sm"
                      onClick={() => setIsEraser(true)}
                      className="flex-1"
                    >
                      <Eraser className="w-4 h-4 mr-1" />Eraser
                    </Button>
                  </div>
                </div>

                <Separator className="bg-slate-700" />

                {/* Actions */}
                <div className="space-y-3">
                  <Label className="text-slate-300">Actions</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={clearCanvas} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                      <Trash2 className="w-4 h-4 mr-1" />Clear
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportCanvas} disabled={!isStreaming} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                      <Download className="w-4 h-4 mr-1" />Save
                    </Button>
                  </div>
                </div>

                <Separator className="bg-slate-700" />

                {/* Status */}
                <div className="p-3 bg-slate-900/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-medium text-white">Status</span>
                  </div>
                  <div className="text-xs text-slate-400 space-y-1">
                    <p>Camera: <span className={isStreaming ? "text-green-400" : "text-red-400"}>{isStreaming ? 'Active' : 'Inactive'}</span></p>
                    <p>Hand: <span className={handDetected ? "text-green-400" : "text-red-400"}>{handDetected ? 'Detected' : 'Not detected'}</span></p>
                    <p>Tool: <span className="text-cyan-400">{isEraser ? 'Eraser' : 'Pen'}</span></p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 bg-slate-900/80 backdrop-blur-sm mt-auto">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-400">
            <p>Air Canvas - Draw in mid-air with your finger</p>
            <p>Powered by MediaPipe Hand Tracking</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
