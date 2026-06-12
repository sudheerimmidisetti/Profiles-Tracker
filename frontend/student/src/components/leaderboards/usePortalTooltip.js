// usePortalTooltip.js
// Renders tooltips into document.body via a React Portal.
// This completely eliminates overflow clipping from parent containers
// and guarantees the tooltip is always visible and opaque.
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

const OFFSET = 8 // px gap between row and tooltip

/**
 * @returns {{ ref, isVisible, setVisible, Portal }}
 *
 * Usage:
 *   const { ref, isVisible, setVisible, Portal } = usePortalTooltip()
 *   <div ref={ref} onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
 *     Row content
 *     <Portal>Tooltip content</Portal>
 *   </div>
 */
export function usePortalTooltip() {
  const [isVisible, setVisible] = useState(false)
  const [pos, setPos]           = useState({ top: 0, right: 0 })
  const anchorRef               = useRef(null)
  const tooltipRef              = useRef(null)

  const updatePos = useCallback(() => {
    if (!anchorRef.current || !isVisible) return
    const rect    = anchorRef.current.getBoundingClientRect()
    const vpW     = window.innerWidth
    const vpH     = window.innerHeight
    const tipH    = tooltipRef.current?.offsetHeight || 200
    const tipW    = tooltipRef.current?.offsetWidth  || 260

    // Default: below the row, aligned to the right
    let top   = rect.bottom + OFFSET + window.scrollY
    let right = vpW - rect.right

    // If the tooltip would go off the bottom, show above
    if (rect.bottom + OFFSET + tipH > vpH) {
      top = rect.top - OFFSET - tipH + window.scrollY
    }

    // Clamp right so it never goes off-screen left
    const leftEdge = vpW - right - tipW
    if (leftEdge < 8) right = vpW - tipW - 8

    setPos({ top, right })
  }, [isVisible])

  useEffect(() => {
    if (isVisible) {
      updatePos()
      window.addEventListener('scroll', updatePos, { passive: true })
      window.addEventListener('resize', updatePos, { passive: true })
    }
    return () => {
      window.removeEventListener('scroll', updatePos)
      window.removeEventListener('resize', updatePos)
    }
  }, [isVisible, updatePos])

  const Portal = useCallback(({ children }) => {
    if (!isVisible) return null
    return createPortal(
      <div
        ref={tooltipRef}
        className="lb-tip lb-tip-portal"
        style={{ top: pos.top, right: pos.right, position: 'fixed', left: 'auto' }}
      >
        {children}
      </div>,
      document.body
    )
  }, [isVisible, pos])

  return { ref: anchorRef, isVisible, setVisible, Portal }
}
