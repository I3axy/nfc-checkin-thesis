import { useRef } from 'react'

// Vízszintes lapozás érintéssel. A telefonos használat elvárja, de a
// megvalósításnál két hibalehetőséget kell elkerülni:
//
//   1. A függőleges görgetés elrablása. A napló hosszú lista — ha minden
//      mozdulat lapozásnak számítana, használhatatlan lenne. Ezért a vízszintes
//      elmozdulásnak érdemben nagyobbnak kell lennie a függőlegesnél.
//   2. Véletlen lapozás. Egy koppintás közben a hüvelykujj néhány képpontot
//      elmozdul; ezért kell alsó küszöb.
//
// A `passive: true` alapértelmezés megmarad: nem hívunk preventDefault-ot, így
// a böngésző görgetése végig akadálytalan.

const MIN_DISTANCE = 60      // képpont — ennél kisebb mozdulat koppintás
const DIRECTION_RATIO = 1.5  // a vízszintes ennyivel múlja felül a függőlegest

export function useSwipe({ onLeft, onRight }) {
  const start = useRef(null)

  return {
    onTouchStart: (e) => {
      const t = e.touches[0]
      start.current = { x: t.clientX, y: t.clientY }
    },
    onTouchEnd: (e) => {
      if (!start.current) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.current.x
      const dy = t.clientY - start.current.y
      start.current = null

      if (Math.abs(dx) < MIN_DISTANCE) return
      if (Math.abs(dx) < Math.abs(dy) * DIRECTION_RATIO) return

      // Balra húzás = előre lapozás, ahogy a lapozható felületeknél megszokott
      if (dx < 0) onLeft?.()
      else onRight?.()
    },
    // Megszakított mozdulat (bejövő hívás, rendszergesztus) ne maradjon félben
    onTouchCancel: () => { start.current = null },
  }
}
