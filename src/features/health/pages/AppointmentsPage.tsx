import { useMemo, useState } from 'react'
import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import PersonOffRoundedIcon from '@mui/icons-material/PersonOffRounded'
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded'
import PaidRoundedIcon from '@mui/icons-material/PaidRounded'
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  createAppointment,
  deleteAppointment,
  getHealthAgenda,
  listAppointments,
  listExamRequests,
  listFamilyMembers,
  listHealthPlans,
  listLabs,
  noShowAppointment,
  updateAppointment,
  type Appointment,
  type AppointmentInput,
  type AppointmentKind,
  type AppointmentStatus,
} from '../api'
import {
  APPOINTMENT_KIND_LABEL,
  APPOINTMENT_KIND_OPTIONS,
  APPOINTMENT_STATUS_META,
  APPOINTMENT_STATUS_OPTIONS,
  errorMessage,
  formatCents,
  healthKeys,
  SPECIALTY_LABEL,
  SPECIALTY_OPTIONS,
  toCents,
} from '../constants'
import { PageHeader } from '../components/PageHeader'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews'
import { useToast } from '@/providers/ToastProvider'
import { AutocompleteField } from '@/components/fields/AutocompleteField'

// Lê a data/hora ISO (armazenada em UTC) preservando o horário informado.
function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Valor para <input type="datetime-local"> (YYYY-MM-DDTHH:mm).
function toInputValue(iso?: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 16)
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: number | string
  icon: typeof EventAvailableRoundedIcon
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

function StatusChip({ status }: { status: AppointmentStatus }) {
  const meta = APPOINTMENT_STATUS_META[status]
  return <Chip size="small" label={meta?.label ?? status} color={meta?.color ?? 'default'} />
}

type AppointmentFormValues = {
  family_member_id: string
  kind: AppointmentKind
  specialty: string
  professional_name: string
  lab_id: string
  plan_id: string
  price: string
  scheduled_at: string
  reason: string
  exam_request_id: string
}

function emptyForm(): AppointmentFormValues {
  return {
    family_member_id: '',
    kind: 'consulta',
    specialty: '',
    professional_name: '',
    lab_id: '',
    plan_id: '',
    price: '',
    scheduled_at: '',
    reason: '',
    exam_request_id: '',
  }
}

function AppointmentFormDialog({
  open,
  appointment,
  onClose,
}: {
  open: boolean
  appointment: Appointment | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const isEdit = Boolean(appointment)

  const { data: members } = useQuery({
    queryKey: healthKeys.familyMembers(),
    queryFn: listFamilyMembers,
  })
  const { data: labs } = useQuery({ queryKey: healthKeys.labs(), queryFn: listLabs })
  const { data: plans } = useQuery({ queryKey: healthKeys.plans(), queryFn: listHealthPlans })
  const { data: examRequests } = useQuery({
    queryKey: [...healthKeys.all, 'exam-requests-list'],
    queryFn: listExamRequests,
  })

  const [form, setForm] = useState<AppointmentFormValues>(() => {
    if (!appointment) return emptyForm()
    return {
      family_member_id: appointment.family_member_id,
      kind: appointment.kind,
      specialty: appointment.specialty ?? '',
      professional_name: appointment.professional_name ?? '',
      lab_id: appointment.lab_id ?? '',
      plan_id: appointment.plan_id ?? '',
      price: appointment.price_cents ? (appointment.price_cents / 100).toString() : '',
      scheduled_at: toInputValue(appointment.scheduled_at),
      reason: appointment.reason ?? '',
      exam_request_id: appointment.exam_request_id ?? '',
    }
  })
  const [formError, setFormError] = useState<string | null>(null)

  // Planos disponíveis para o membro selecionado (+ vínculos).
  const memberPlans = useMemo(() => {
    if (!plans) return []
    if (!form.family_member_id) return plans
    return plans.filter((p) => p.members?.some((m) => m.member_id === form.family_member_id))
  }, [plans, form.family_member_id])

  const memberExamRequests = useMemo(() => {
    if (!examRequests) return []
    if (!form.family_member_id) return examRequests
    return examRequests.filter((r) => r.family_member_id === form.family_member_id)
  }, [examRequests, form.family_member_id])

  const patch = (p: Partial<AppointmentFormValues>) => setForm((prev) => ({ ...prev, ...p }))

  const mutation = useMutation({
    mutationFn: (input: AppointmentInput) =>
      isEdit ? updateAppointment(appointment!.id, input) : createAppointment(input),
    onSuccess: () => {
      show(isEdit ? 'Consulta atualizada.' : 'Consulta agendada.')
      qc.invalidateQueries({ queryKey: healthKeys.appointments() })
      qc.invalidateQueries({ queryKey: healthKeys.agenda() })
      onClose()
    },
  })

  const submit = () => {
    setFormError(null)
    if (!form.family_member_id) return setFormError('Selecione o membro da família.')
    if (!form.scheduled_at) return setFormError('Informe a data e hora.')

    const input: AppointmentInput = {
      family_member_id: form.family_member_id,
      kind: form.kind,
      specialty: form.specialty || null,
      professional_name: form.professional_name.trim() || null,
      lab_id: form.lab_id || null,
      plan_id: form.plan_id || null,
      exam_request_id: form.exam_request_id || null,
      scheduled_at: form.scheduled_at,
      reason: form.reason.trim() || null,
      price_cents: form.price ? toCents(form.price) : 0,
      covered_by_plan: Boolean(form.plan_id),
    }
    if (isEdit && appointment) input.status = appointment.status
    mutation.mutate(input)
  }

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{isEdit ? 'Editar consulta' : 'Nova consulta'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {formError && <ErrorState message={formError} />}
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <AutocompleteField
              label="Membro da família"
              value={form.family_member_id}
              onChange={(v) => patch({ family_member_id: v, plan_id: '', exam_request_id: '' })}
              options={(members ?? []).map((m) => ({ value: m.id, label: m.full_name }))}
              required
              disableClearable
            />
            <TextField
              type="datetime-local"
              label="Data e hora"
              value={form.scheduled_at}
              onChange={(e) => patch({ scheduled_at: e.target.value })}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <AutocompleteField
              label="Tipo"
              value={form.kind}
              onChange={(v) => patch({ kind: v as AppointmentKind })}
              options={APPOINTMENT_KIND_OPTIONS}
              disableClearable
            />
            <AutocompleteField
              label="Especialidade"
              emptyLabel="Não informada"
              value={form.specialty}
              onChange={(v) => patch({ specialty: v })}
              options={SPECIALTY_OPTIONS}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Profissional"
              value={form.professional_name}
              onChange={(e) => patch({ professional_name: e.target.value })}
              fullWidth
              placeholder="Nome do médico ou profissional"
            />
            <AutocompleteField
              label="Local"
              value={form.lab_id}
              onChange={(v) => patch({ lab_id: v })}
              options={(labs ?? []).map((l) => ({ value: l.id, label: l.name }))}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <AutocompleteField
              label="Cobertura"
              emptyLabel="Particular"
              value={form.plan_id}
              onChange={(v) => patch({ plan_id: v })}
              options={memberPlans.map((p) => ({
                value: p.id,
                label: p.operator ? `${p.name} · ${p.operator}` : p.name,
              }))}
              helperText={form.plan_id ? 'Coberto por plano (valor = coparticipação)' : 'Particular'}
            />
            <TextField
              label="Valor (R$)"
              value={form.price}
              onChange={(e) => patch({ price: e.target.value })}
              fullWidth
              placeholder="0,00"
              inputMode="decimal"
            />
          </Stack>

          <AutocompleteField
            label="Vincular a pedido de exame (opcional)"
            emptyLabel="Nenhum"
            value={form.exam_request_id}
            onChange={(v) => patch({ exam_request_id: v })}
            options={memberExamRequests.map((r) => ({
              value: r.id,
              label: `Pedido de ${r.request_date} · ${r.items?.length ?? 0} exame(s)`,
            }))}
          />

          <TextField
            label="Motivo / sintomas"
            value={form.reason}
            onChange={(e) => patch({ reason: e.target.value })}
            fullWidth
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button onClick={submit} variant="contained" disabled={mutation.isPending}>
          {isEdit ? 'Salvar' : 'Agendar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function CompleteDialog({
  open,
  appointment,
  onClose,
}: {
  open: boolean
  appointment: Appointment | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const [outcome, setOutcome] = useState(appointment?.outcome ?? '')
  const [price, setPrice] = useState(
    appointment?.price_cents ? (appointment.price_cents / 100).toString() : ''
  )

  const mutation = useMutation({
    mutationFn: () =>
      completeAppointment(appointment!.id, {
        outcome: outcome.trim() || null,
        price_cents: price ? toCents(price) : null,
      }),
    onSuccess: () => {
      show('Consulta marcada como realizada.')
      qc.invalidateQueries({ queryKey: healthKeys.appointments() })
      qc.invalidateQueries({ queryKey: healthKeys.agenda() })
      onClose()
    },
  })

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Marcar como realizada</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
          <TextField
            label="Conduta / diagnóstico"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            placeholder="Registre o que foi conduzido na consulta."
          />
          <TextField
            label="Valor pago (R$)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            fullWidth
            placeholder="0,00"
            inputMode="decimal"
            helperText="Coparticipação ou custo particular efetivamente pago."
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button onClick={() => mutation.mutate()} variant="contained" disabled={mutation.isPending}>
          Confirmar realização
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function AppointmentsPage() {
  const qc = useQueryClient()
  const { show } = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [completing, setCompleting] = useState<Appointment | null>(null)
  const [toDelete, setToDelete] = useState<Appointment | null>(null)

  const [memberId, setMemberId] = useState('')
  const [status, setStatus] = useState<AppointmentStatus | ''>('')
  const [kind, setKind] = useState<AppointmentKind | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const { data: agenda } = useQuery({ queryKey: healthKeys.agenda(), queryFn: getHealthAgenda })
  const { data: members } = useQuery({
    queryKey: healthKeys.familyMembers(),
    queryFn: listFamilyMembers,
  })

  const filters = useMemo(
    () => ({
      family_member_id: memberId || undefined,
      status: status || undefined,
      kind: kind || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [memberId, status, kind, from, to]
  )

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [...healthKeys.appointments(), filters],
    queryFn: () => listAppointments(filters),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: healthKeys.appointments() })
    qc.invalidateQueries({ queryKey: healthKeys.agenda() })
  }

  const confirmMut = useMutation({
    mutationFn: (id: string) => confirmAppointment(id),
    onSuccess: () => {
      invalidate()
      show('Consulta confirmada.')
    },
    onError: (e) => show(errorMessage(e), 'error'),
  })
  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelAppointment(id),
    onSuccess: () => {
      invalidate()
      show('Consulta cancelada.')
    },
    onError: (e) => show(errorMessage(e), 'error'),
  })
  const noShowMut = useMutation({
    mutationFn: (id: string) => noShowAppointment(id),
    onSuccess: () => {
      invalidate()
      show('Consulta marcada como falta.')
    },
    onError: (e) => show(errorMessage(e), 'error'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAppointment(id),
    onSuccess: () => {
      invalidate()
      setToDelete(null)
      show('Consulta excluída.')
    },
  })

  const items = data?.items ?? []

  const statusCount = (s: AppointmentStatus) =>
    agenda?.status_counts.find((c) => c.status === s)?.count ?? 0

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (a: Appointment) => {
    setEditing(a)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Consultas & Agenda"
        subtitle="Agende consultas, exames e retornos e acompanhe os gastos com saúde da família."
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
            Nova consulta
          </Button>
        }
      />

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Próximos 7 dias" value={agenda?.next_7_count ?? 0} icon={EventAvailableRoundedIcon} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Agendadas no ano" value={statusCount('agendada')} icon={CalendarMonthRoundedIcon} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Realizadas no ano" value={statusCount('realizada')} icon={TaskAltRoundedIcon} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Gasto no ano"
            value={formatCents(agenda?.year_spend_cents ?? 0)}
            icon={PaidRoundedIcon}
          />
        </Grid>
      </Grid>

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
          <AutocompleteField
            label="Membro"
            size="small"
            fullWidth={false}
            sx={{ minWidth: { md: 180 } }}
            emptyLabel="Todos"
            value={memberId}
            onChange={setMemberId}
            options={(members ?? []).map((m) => ({ value: m.id, label: m.full_name }))}
          />
          <AutocompleteField
            label="Status"
            size="small"
            fullWidth={false}
            sx={{ minWidth: { md: 160 } }}
            emptyLabel="Todos"
            value={status}
            onChange={(v) => setStatus(v as AppointmentStatus | '')}
            options={APPOINTMENT_STATUS_OPTIONS}
          />
          <AutocompleteField
            label="Tipo"
            size="small"
            fullWidth={false}
            sx={{ minWidth: { md: 160 } }}
            emptyLabel="Todos"
            value={kind}
            onChange={(v) => setKind(v as AppointmentKind | '')}
            options={APPOINTMENT_KIND_OPTIONS}
          />
          <TextField
            type="date"
            label="De"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            type="date"
            label="Até"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </Stack>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<EventNoteRoundedIcon />}
          title="Nenhuma consulta encontrada"
          description={
            memberId || status || kind || from || to
              ? 'Ajuste os filtros para ver outras consultas.'
              : 'Agende a primeira consulta para começar a acompanhar a agenda da família.'
          }
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Nova consulta
            </Button>
          }
        />
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Data / hora</TableCell>
                  <TableCell>Membro</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Especialidade</TableCell>
                  <TableCell>Profissional / Local</TableCell>
                  <TableCell>Cobertura</TableCell>
                  <TableCell align="right">Valor</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((a) => {
                  const terminal =
                    a.status === 'realizada' || a.status === 'cancelada' || a.status === 'faltou'
                  return (
                    <TableRow key={a.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {fmtDateTime(a.scheduled_at)}
                      </TableCell>
                      <TableCell>{a.member_name ?? '—'}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={APPOINTMENT_KIND_LABEL[a.kind] ?? a.kind}
                        />
                      </TableCell>
                      <TableCell>{a.specialty ? SPECIALTY_LABEL[a.specialty] ?? a.specialty : '—'}</TableCell>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <span>{a.professional_name || '—'}</span>
                          {a.lab_name && (
                            <Typography variant="caption" color="text.secondary">
                              {a.lab_name}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {a.plan_id ? (
                          <Chip size="small" color="info" variant="outlined" label={a.plan_name ?? 'Plano'} />
                        ) : (
                          <Chip size="small" variant="outlined" label="Particular" />
                        )}
                      </TableCell>
                      <TableCell align="right">{a.price_cents ? formatCents(a.price_cents) : '—'}</TableCell>
                      <TableCell>
                        <StatusChip status={a.status} />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" justifyContent="flex-end">
                          {a.status === 'agendada' && (
                            <Tooltip title="Confirmar">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => confirmMut.mutate(a.id)}
                              >
                                <CheckCircleRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {!terminal && (
                            <Tooltip title="Marcar realizada">
                              <IconButton size="small" color="success" onClick={() => setCompleting(a)}>
                                <TaskAltRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {!terminal && (
                            <Tooltip title="Faltou">
                              <IconButton size="small" color="warning" onClick={() => noShowMut.mutate(a.id)}>
                                <PersonOffRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {!terminal && (
                            <Tooltip title="Cancelar">
                              <IconButton size="small" onClick={() => cancelMut.mutate(a.id)}>
                                <CancelRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => openEdit(a)}>
                              <EditRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Excluir">
                            <IconButton size="small" color="error" onClick={() => setToDelete(a)}>
                              <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {(agenda?.by_specialty.length || agenda?.by_member.length) ? (
        <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
          {agenda?.by_specialty.length ? (
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                  Consultas por especialidade ({agenda.year})
                </Typography>
                <Divider sx={{ mb: 1 }} />
                <Stack spacing={0.75}>
                  {agenda.by_specialty.map((s) => (
                    <Stack key={s.specialty} direction="row" justifyContent="space-between">
                      <Typography variant="body2">
                        {SPECIALTY_LABEL[s.specialty] ?? s.specialty}
                      </Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {s.count}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Card>
            </Grid>
          ) : null}
          {agenda?.by_member.length ? (
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                  Consultas por membro ({agenda.year})
                </Typography>
                <Divider sx={{ mb: 1 }} />
                <Stack spacing={0.75}>
                  {agenda.by_member.map((m) => (
                    <Stack key={m.member_id} direction="row" justifyContent="space-between">
                      <Typography variant="body2">{m.member_name}</Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {m.count}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Card>
            </Grid>
          ) : null}
        </Grid>
      ) : null}

      {formOpen && (
        <AppointmentFormDialog
          open={formOpen}
          appointment={editing}
          onClose={() => setFormOpen(false)}
        />
      )}
      {completing && (
        <CompleteDialog open={Boolean(completing)} appointment={completing} onClose={() => setCompleting(null)} />
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir consulta"
        description="Tem certeza que deseja excluir esta consulta? Esta ação não pode ser desfeita."
        loading={deleteMut.isPending}
        onConfirm={() => toDelete && deleteMut.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  )
}
