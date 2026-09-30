/**
 * Ventisca decorativa: ráfagas de viento y copos que cruzan de izquierda a derecha.
 * Va posicionada absoluta dentro de un contenedor `relative overflow-hidden`; es puro CSS.
 */
const RAFAGAS = [
  { top: 14, ancho: 34, dur: 2.4, delay: 0 },
  { top: 27, ancho: 48, dur: 3.1, delay: -1.2 },
  { top: 41, ancho: 28, dur: 2.2, delay: -0.6 },
  { top: 55, ancho: 52, dur: 3.6, delay: -2.1 },
  { top: 68, ancho: 36, dur: 2.7, delay: -1.6 },
  { top: 82, ancho: 44, dur: 3.3, delay: -0.3 },
];

const COPOS = [
  { top: 10, size: 3, dur: 4.6, delay: 0 },
  { top: 22, size: 2, dur: 3.8, delay: -1.4 },
  { top: 34, size: 4, dur: 5.2, delay: -2.6 },
  { top: 47, size: 2, dur: 3.5, delay: -0.8 },
  { top: 58, size: 3, dur: 4.4, delay: -3.1 },
  { top: 70, size: 2, dur: 3.9, delay: -2 },
  { top: 78, size: 4, dur: 5, delay: -0.2 },
  { top: 90, size: 3, dur: 4.1, delay: -3.6 },
];

export function Ventisca({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {RAFAGAS.map((r, i) => (
        <span
          key={`r${i}`}
          className="ventisca-rafaga"
          style={
            { top: `${r.top}%`, width: `${r.ancho}%`, "--dur": `${r.dur}s`, "--delay": `${r.delay}s` } as React.CSSProperties
          }
        />
      ))}
      {COPOS.map((c, i) => (
        <span
          key={`c${i}`}
          className="ventisca-copo"
          style={
            {
              top: `${c.top}%`,
              width: c.size,
              height: c.size,
              "--dur": `${c.dur}s`,
              "--delay": `${c.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
