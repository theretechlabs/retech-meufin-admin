import { useEffect, useState } from 'react'
import { useMediaQuery, useTheme } from '@mui/material'

/**
 * Telefone (< `sm`, 600px). É o gatilho de TODA adaptação "modo app":
 * largura, não `display-mode`. Quem abre no Safari sem instalar tem a mesma
 * tela; quem instala o PWA no desktop/iPad continua com o layout largo.
 */
export function useIsMobile(): boolean {
  const theme = useTheme()
  return useMediaQuery(theme.breakpoints.down('sm'))
}

const STANDALONE_QUERY = '(display-mode: standalone)'

/**
 * App instalado (PWA aberto da tela de início). Só para detalhes que não
 * fazem sentido dentro do app: prompt "instale", link "abrir no navegador".
 */
export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(() => readStandalone())
  useEffect(() => {
    const mq = window.matchMedia(STANDALONE_QUERY)
    const onChange = () => setStandalone(readStandalone())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return standalone
}

function readStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone
  return window.matchMedia(STANDALONE_QUERY).matches || iosStandalone === true
}
