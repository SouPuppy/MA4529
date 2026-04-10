import { useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import './NotFoundPage.css'

const FORMULAS = [
  '\\Delta',
  '\\Gamma',
  '\\Theta',
  '\\nu',
  '\\sigma',
  '\\mu',
  '\\lambda',
  'S_t',
  'K',
  'r',
  '\\mathbb{E}',
  '\\mathbb{Q}',
  '\\frac{\\partial V}{\\partial S}',
  '\\frac{\\partial^2 V}{\\partial S^2}',
  'dS_t = \\mu S_t\\,dt + \\sigma S_t\\,dW_t',
  '\\Pi = V - \\Delta S',
  'C - P = S_0 - Ke^{-rT}',
  'V(S,t) = e^{-r(T-t)}\\mathbb{E}^{\\mathbb{Q}}[\\mathrm{Payoff}(S_T)]',
  '\\frac{\\partial V}{\\partial t} + \\frac{1}{2}\\sigma^2 S^2\\frac{\\partial^2 V}{\\partial S^2} + rS\\frac{\\partial V}{\\partial S} - rV = 0',
  'd\\Pi = -\\Theta\\,dt',
  '\\sigma_{\\text{impl}}',
  'dV = \\Delta\\,dS + \\frac{1}{2}\\Gamma\\,(dS)^2',
  '\\text{VaR}_\\alpha',
  'r_p = \\sum w_i r_i',
  '\\beta = \\frac{\\text{Cov}(R_i, R_m)}{\\text{Var}(R_m)}',
]

function FormulaParticle({ formula }: { formula: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(formula, ref.current, { throwOnError: false })
      } catch (e) {
        console.error('KaTeX render error:', e)
      }
    }
  }, [formula])

  return <span ref={ref} className="particle formula-particle" />
}

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="error-container">
      {FORMULAS.map((formula, i) => (
        <FormulaParticle key={`formula-${i}`} formula={formula} />
      ))}

      <article className="error-content">
        <div className="error-code">404</div>
        <p className="error-title">Page Not Found</p>
        <button onClick={() => navigate('/')}>Return to Home</button>
      </article>
    </div>
  )
}
