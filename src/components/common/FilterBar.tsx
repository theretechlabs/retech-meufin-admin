import { useState, type ReactNode } from 'react'
import { Badge, Button, Card, CardContent, Collapse, Stack } from '@mui/material'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import { useIsMobile } from '@/hooks/useIsMobile'

type Props = {
  /** Os campos de filtro (normalmente um `<Grid container>`). Omita quando só há busca. */
  children?: ReactNode
  /** Campo que fica sempre visível no telefone, acima do botão (ex.: busca). */
  primary?: ReactNode
  /** Quantos filtros estão fora do padrão — vira badge no botão "Filtros". */
  activeCount?: number
  sx?: Parameters<typeof Card>[0]['sx']
}

/**
 * Card de filtros de uma listagem. No desktop renderiza os campos direto; no
 * telefone mostra só o `primary` (busca) e um botão "Filtros" que expande o
 * resto — a tela de lista começa pela lista, não por seis selects.
 */
export function FilterBar({ children, primary, activeCount = 0, sx }: Props) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  if (!isMobile) {
    return (
      <Card sx={{ mb: 3, ...(sx as object) }}>
        <CardContent>
          {primary ? (
            <Stack spacing={2}>
              {primary}
              {children}
            </Stack>
          ) : (
            children
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={{ mb: 2, ...(sx as object) }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack spacing={1.5}>
          {primary}
          {children && (
            <>
              <Button
                size="small"
                variant={open ? 'contained' : 'outlined'}
                color={open ? 'primary' : 'inherit'}
                onClick={() => setOpen((v) => !v)}
                startIcon={
                  <Badge badgeContent={activeCount} color="primary" overlap="circular">
                    <TuneRoundedIcon fontSize="small" />
                  </Badge>
                }
                endIcon={
                  <ExpandMoreRoundedIcon
                    sx={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}
                  />
                }
                sx={{ alignSelf: 'flex-start', minHeight: 40 }}
              >
                Filtros
              </Button>
              <Collapse in={open} unmountOnExit={false}>
                {children}
              </Collapse>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}
