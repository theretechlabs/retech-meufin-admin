import { useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import BiotechRoundedIcon from '@mui/icons-material/BiotechRounded'
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import ShareRoundedIcon from '@mui/icons-material/ShareRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import { useQuery } from '@tanstack/react-query'
import {
  getDashboardPanels,
  getHealthDashboard,
  listFamilyMembers,
  type PanelMarker,
} from '../api'
import { errorMessage, healthKeys } from '../constants'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import {
  MarkerChartDialog,
  MiniMarkerCard,
  panelTitle,
} from '../components/panels'
import { ShareLinkDialog } from '../components/ShareLinkDialog'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { MultiAutocompleteField } from '@/components/fields/MultiAutocompleteField'

// ---------------------------------------------------------------------------
// Cards de contagem (mantidos da v1)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Preferências do usuário (ordem, colapsados, densidade) em localStorage
// ---------------------------------------------------------------------------

type Density = 'compact' | 'comfortable'
type PanelPrefs = { order: string[]; collapsed: string[]; density: Density }

const PREFS_KEY = 'meufin-health-panels-prefs'

function loadPrefs(): PanelPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) return { order: [], collapsed: [], density: 'compact', ...JSON.parse(raw) }
  } catch {
    // prefs corrompidas: recomeça do default
  }
  return { order: [], collapsed: [], density: 'compact' }
}

function savePrefs(p: PanelPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    // storage cheio/indisponível: preferências viram só de sessão
  }
}


function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: number | string
  icon: typeof GroupsRoundedIcon
}) {
  return (
    <Card>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              {title}
            </Typography>
            <Typography
              variant="h5"
              sx={{ fontFamily: (t) => t.typography.h5.fontFamily, fontWeight: 800, mt: 0.5 }}
            >
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.15 : 0.12),
              color: 'primary.main',
            }}
          >
            <Icon />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function HealthDashboardPage() {
  const markerCategory = useCatalog('health.marker_category')
  const [prefs, setPrefs] = useState<PanelPrefs>(loadPrefs)
  const [familyMemberId, setFamilyMemberId] = useState('')
  const [openMarker, setOpenMarker] = useState<PanelMarker | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  // Marcadores "nunca realizados" que o usuário pediu para ver, por categoria.
  const [peek, setPeek] = useState<Record<string, string[]>>({})

  const updatePrefs = (patch: Partial<PanelPrefs>) =>
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      savePrefs(next)
      return next
    })

  const counts = useQuery({ queryKey: healthKeys.dashboard(), queryFn: getHealthDashboard })
  const { data: members = [] } = useQuery({
    queryKey: healthKeys.familyMembers(),
    queryFn: listFamilyMembers,
  })
  const panelsQuery = useQuery({
    queryKey: [...healthKeys.dashboard(), 'panels', familyMemberId] as const,
    queryFn: () => getDashboardPanels({ family_member_id: familyMemberId || undefined }),
  })

  const allPanels = useMemo(() => panelsQuery.data?.panels ?? [], [panelsQuery.data])

  // Painéis com dados, na ordem da API reordenada pela preferência do usuário.
  const panels = useMemo(() => {
    const withData = allPanels.filter((p) => p.markers.length > 0)
    if (prefs.order.length === 0) return withData
    const rank = new Map(prefs.order.map((c, i) => [c, i]))
    return [...withData].sort((a, b) => {
      const ra = rank.has(a.category) ? (rank.get(a.category) as number) : Number.MAX_SAFE_INTEGER
      const rb = rank.has(b.category) ? (rank.get(b.category) as number) : Number.MAX_SAFE_INTEGER
      return ra - rb
    })
  }, [allPanels, prefs.order])

  const emptyPanels = useMemo(() => allPanels.filter((p) => p.markers.length === 0), [allPanels])

  const movePanel = (category: string, delta: -1 | 1) => {
    const order = panels.map((p) => p.category)
    const idx = order.indexOf(category)
    const target = idx + delta
    if (idx < 0 || target < 0 || target >= order.length) return
    ;[order[idx], order[target]] = [order[target], order[idx]]
    updatePrefs({ order })
  }

  const toggleCollapsed = (category: string) => {
    const set = new Set(prefs.collapsed)
    if (set.has(category)) set.delete(category)
    else set.add(category)
    updatePrefs({ collapsed: [...set] })
  }

  const gridSize =
    prefs.density === 'compact' ? { xs: 12, sm: 6, md: 4, lg: 3 } : { xs: 12, sm: 6, md: 6, lg: 4 }

  return (
    <>
      <PageHeader
        title="Dashboard Saúde"
        subtitle="Painéis por categoria com a evolução de todos os marcadores com resultado."
      />

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Membros" value={counts.data?.family_members ?? 0} icon={GroupsRoundedIcon} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Resultados" value={counts.data?.exam_results ?? 0} icon={DescriptionRoundedIcon} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Marcadores (tenant)"
            value={counts.data?.tenant_markers ?? 0}
            icon={BiotechRoundedIcon}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Documentos p/ revisar"
            value={counts.data?.documents_pending_review ?? 0}
            icon={PendingActionsRoundedIcon}
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            justifyContent="flex-end"
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <AutocompleteField
              label="Membro"
              size="small"
              fullWidth={false}
              sx={{ minWidth: 200 }}
              emptyLabel="Todos"
              value={familyMemberId}
              onChange={setFamilyMemberId}
              options={members.map((m) => ({ value: m.id, label: m.full_name }))}
            />
            <ToggleButtonGroup
              size="small"
              exclusive
              value={prefs.density}
              onChange={(_, v) => v && updatePrefs({ density: v })}
            >
              <ToggleButton value="compact">Compacto</ToggleButton>
              <ToggleButton value="comfortable">Confortável</ToggleButton>
            </ToggleButtonGroup>
            <Tooltip
              title={familyMemberId ? '' : 'Selecione um membro específico para compartilhar'}
            >
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ShareRoundedIcon />}
                  disabled={!familyMemberId}
                  onClick={() => setShareOpen(true)}
                >
                  Compartilhar com médico
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12 }}>
          {panelsQuery.isLoading ? (
            <LoadingState label="Montando painéis…" />
          ) : panelsQuery.isError ? (
            <ErrorState message={errorMessage(panelsQuery.error)} onRetry={panelsQuery.refetch} />
          ) : panels.length === 0 ? (
            <EmptyState
              icon={<BiotechRoundedIcon />}
              title="Nenhum resultado ainda"
              description="Importe ou lance resultados de exames para ver os painéis de evolução."
            />
          ) : (
            <Stack spacing={1.5}>
              {panels.map((panel, idx) => {
                const expanded = !prefs.collapsed.includes(panel.category)
                const peeked = panel.missing.filter((m) => (peek[panel.category] ?? []).includes(m.id))
                return (
                  <Accordion
                    key={panel.category}
                    expanded={expanded}
                    onChange={() => toggleCollapsed(panel.category)}
                    disableGutters
                  >
                    <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ flex: 1, pr: 1 }}
                      >
                        <Typography fontWeight={800}>
                          {panelTitle(panel.category, markerCategory.labelOf(panel.category))}{' '}
                          <Typography component="span" color="text.secondary">
                            ({panel.markers.length})
                          </Typography>
                        </Typography>
                        <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
                          <Tooltip title="Subir painel">
                            <span>
                              <IconButton size="small" disabled={idx === 0} onClick={() => movePanel(panel.category, -1)}>
                                <ArrowUpwardRoundedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Descer painel">
                            <span>
                              <IconButton
                                size="small"
                                disabled={idx === panels.length - 1}
                                onClick={() => movePanel(panel.category, 1)}
                              >
                                <ArrowDownwardRoundedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={1.5}>
                        {panel.markers.map((pm) => (
                          <Grid key={pm.marker.id} size={gridSize}>
                            <MiniMarkerCard pm={pm} density={prefs.density} onOpen={() => setOpenMarker(pm)} />
                          </Grid>
                        ))}
                        {peeked.map((m) => (
                          <Grid key={m.id} size={gridSize}>
                            <Card variant="outlined" sx={{ height: '100%', borderStyle: 'dashed' }}>
                              <CardContent sx={{ p: 1.5 }}>
                                <Typography variant="body2" fontWeight={700} noWrap>
                                  {m.canonical_name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Nunca realizado — nenhum resultado registrado para este marcador.
                                </Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                      {panel.missing.length > 0 && (
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1.5}
                          alignItems={{ xs: 'stretch', sm: 'center' }}
                          sx={{ mt: 2 }}
                        >
                          <MultiAutocompleteField
                            label="Ver marcadores sem resultado…"
                            size="small"
                            sx={{ minWidth: 280 }}
                            options={panel.missing.map((m) => ({ value: m.id, label: m.canonical_name }))}
                            value={peek[panel.category] ?? []}
                            onChange={(ids) => setPeek((prev) => ({ ...prev, [panel.category]: ids }))}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {panel.missing.length} marcador(es) deste painel nunca tiveram resultado.
                          </Typography>
                        </Stack>
                      )}
                    </AccordionDetails>
                  </Accordion>
                )
              })}
              {emptyPanels.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
                  Sem resultados ainda:{' '}
                  {emptyPanels.map((p) => panelTitle(p.category, markerCategory.labelOf(p.category))).join(', ')}.
                </Typography>
              )}
            </Stack>
          )}
        </Grid>
      </Grid>

      <MarkerChartDialog pm={openMarker} onClose={() => setOpenMarker(null)} />
      {shareOpen && familyMemberId && (
        <ShareLinkDialog
          open={shareOpen}
          memberId={familyMemberId}
          memberName={members.find((m) => m.id === familyMemberId)?.full_name ?? 'membro'}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  )
}
