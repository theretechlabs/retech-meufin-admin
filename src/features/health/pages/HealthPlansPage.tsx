import { useMemo, useState } from 'react'
import {
  Avatar,
  AvatarGroup,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
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
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createHealthPlan,
  deleteHealthPlan,
  listFamilyMembers,
  listHealthPlans,
  replacePlanMembers,
  updateHealthPlan,
  type HealthPlan,
  type HealthPlanInput,
  type PlanMemberInput,
  type PlanType,
} from '../api'
import {
  errorMessage,
  formatCents,
  healthKeys,
  toCents,
} from '../constants'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import { PageHeader } from '../components/PageHeader'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews'
import { PlanDocumentsDialog } from '../components/PlanDocumentsDialog'
import { useToast } from '@/providers/ToastProvider'
import { AutocompleteField } from '@/components/fields/AutocompleteField'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

type PlanFormValues = {
  name: string
  operator: string
  plan_type: PlanType
  ans_code: string
  monthly_fee: string
  coverage_notes: string
  active: boolean
}

function planToForm(p: HealthPlan | null): PlanFormValues {
  if (!p) {
    return {
      name: '',
      operator: '',
      plan_type: 'familiar',
      ans_code: '',
      monthly_fee: '',
      coverage_notes: '',
      active: true,
    }
  }
  return {
    name: p.name,
    operator: p.operator ?? '',
    plan_type: p.plan_type,
    ans_code: p.ans_code ?? '',
    monthly_fee: p.monthly_fee_cents ? (p.monthly_fee_cents / 100).toString() : '',
    coverage_notes: p.coverage_notes ?? '',
    active: p.active,
  }
}

function PlanFormDialog({
  open,
  plan,
  onClose,
}: {
  open: boolean
  plan: HealthPlan | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const isEdit = Boolean(plan)
  const planType = useCatalog('health.plan_type')
  const [form, setForm] = useState<PlanFormValues>(() => planToForm(plan))
  const [formError, setFormError] = useState<string | null>(null)

  const patch = (p: Partial<PlanFormValues>) => setForm((prev) => ({ ...prev, ...p }))

  const mutation = useMutation({
    mutationFn: (input: HealthPlanInput) =>
      isEdit ? updateHealthPlan(plan!.id, input) : createHealthPlan(input),
    onSuccess: () => {
      show(isEdit ? 'Plano atualizado.' : 'Plano criado.')
      qc.invalidateQueries({ queryKey: healthKeys.plans() })
      qc.invalidateQueries({ queryKey: healthKeys.agenda() })
      onClose()
    },
  })

  const submit = () => {
    setFormError(null)
    if (!form.name.trim()) return setFormError('Informe o nome do plano.')
    mutation.mutate({
      name: form.name.trim(),
      operator: form.operator.trim() || null,
      plan_type: form.plan_type,
      ans_code: form.ans_code.trim() || null,
      monthly_fee_cents: form.monthly_fee ? toCents(form.monthly_fee) : 0,
      coverage_notes: form.coverage_notes.trim() || null,
      active: form.active,
    })
  }

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{isEdit ? 'Editar plano' : 'Novo plano de saúde'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {formError && <ErrorState message={formError} />}
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
          <TextField
            label="Nome do plano"
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
            fullWidth
            required
            placeholder="Ex.: Unimed Nacional"
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Operadora"
              value={form.operator}
              onChange={(e) => patch({ operator: e.target.value })}
              fullWidth
              placeholder="Unimed, Amil, Bradesco…"
            />
            <AutocompleteField
              label="Modalidade"
              value={form.plan_type}
              onChange={(v) => patch({ plan_type: v as PlanType })}
              options={planType.options}
              loading={planType.isLoading}
              disableClearable
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Código ANS"
              value={form.ans_code}
              onChange={(e) => patch({ ans_code: e.target.value })}
              fullWidth
            />
            <TextField
              label="Mensalidade (R$)"
              value={form.monthly_fee}
              onChange={(e) => patch({ monthly_fee: e.target.value })}
              fullWidth
              placeholder="0,00"
              inputMode="decimal"
            />
          </Stack>
          <TextField
            label="Observações de cobertura"
            value={form.coverage_notes}
            onChange={(e) => patch({ coverage_notes: e.target.value })}
            fullWidth
            multiline
            minRows={2}
          />
          <FormControlLabel
            control={
              <Switch checked={form.active} onChange={(e) => patch({ active: e.target.checked })} />
            }
            label="Ativo"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button onClick={submit} variant="contained" disabled={mutation.isPending}>
          {isEdit ? 'Salvar' : 'Criar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

type MemberDraft = { selected: boolean; card_number: string; holder: boolean }

function MembersDialog({
  open,
  plan,
  onClose,
}: {
  open: boolean
  plan: HealthPlan
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const { data: members } = useQuery({
    queryKey: healthKeys.familyMembers(),
    queryFn: listFamilyMembers,
  })

  const [drafts, setDrafts] = useState<Record<string, MemberDraft>>(() => {
    const map: Record<string, MemberDraft> = {}
    for (const m of plan.members ?? []) {
      map[m.member_id] = { selected: true, card_number: m.card_number ?? '', holder: m.holder }
    }
    return map
  })

  const draftFor = (id: string): MemberDraft =>
    drafts[id] ?? { selected: false, card_number: '', holder: false }

  const setDraft = (id: string, patch: Partial<MemberDraft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...draftFor(id), ...patch } }))

  const mutation = useMutation({
    mutationFn: () => {
      const payload: PlanMemberInput[] = Object.entries(drafts)
        .filter(([, d]) => d.selected)
        .map(([member_id, d]) => ({
          member_id,
          card_number: d.card_number.trim() || null,
          holder: d.holder,
        }))
      return replacePlanMembers(plan.id, payload)
    },
    onSuccess: () => {
      show('Membros do plano atualizados.')
      qc.invalidateQueries({ queryKey: healthKeys.plans() })
      onClose()
    },
  })

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Membros cobertos — {plan.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
          {(members ?? []).length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Cadastre membros da família para vinculá-los ao plano.
            </Typography>
          )}
          {(members ?? []).map((m) => {
            const d = draftFor(m.id)
            return (
              <Card key={m.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={d.selected}
                          onChange={(e) => setDraft(m.id, { selected: e.target.checked })}
                        />
                      }
                      label={<Typography fontWeight={600}>{m.full_name}</Typography>}
                    />
                    {d.selected && (
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={d.holder}
                            onChange={(e) => setDraft(m.id, { holder: e.target.checked })}
                          />
                        }
                        label="Titular"
                      />
                    )}
                  </Stack>
                  {d.selected && (
                    <TextField
                      label="Número da carteirinha"
                      value={d.card_number}
                      onChange={(e) => setDraft(m.id, { card_number: e.target.value })}
                      size="small"
                      fullWidth
                    />
                  )}
                </Stack>
              </Card>
            )
          })}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button onClick={() => mutation.mutate()} variant="contained" disabled={mutation.isPending}>
          Salvar vínculos
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function HealthPlansPage() {
  const qc = useQueryClient()
  const { show } = useToast()
  const planType = useCatalog('health.plan_type')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<HealthPlan | null>(null)
  const [membersOf, setMembersOf] = useState<HealthPlan | null>(null)
  const [docsOf, setDocsOf] = useState<HealthPlan | null>(null)
  const [toDelete, setToDelete] = useState<HealthPlan | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: healthKeys.plans(),
    queryFn: listHealthPlans,
  })
  const { data: members } = useQuery({
    queryKey: healthKeys.familyMembers(),
    queryFn: listFamilyMembers,
  })

  const memberName = useMemo(() => {
    const map = new Map((members ?? []).map((m) => [m.id, m.full_name]))
    return (id: string) => map.get(id) ?? id
  }, [members])

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteHealthPlan(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: healthKeys.plans() })
      qc.invalidateQueries({ queryKey: healthKeys.agenda() })
      setToDelete(null)
      show('Plano excluído.')
    },
  })

  const plans = data ?? []

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (p: HealthPlan) => {
    setEditing(p)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Planos de Saúde"
        subtitle="Cadastre os planos da família, a mensalidade e os membros cobertos."
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
            Novo plano
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : plans.length === 0 ? (
        <EmptyState
          icon={<HealthAndSafetyRoundedIcon />}
          title="Nenhum plano cadastrado"
          description="Adicione o plano de saúde da família para vincular às consultas."
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Novo plano
            </Button>
          }
        />
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Plano</TableCell>
                  <TableCell>Operadora</TableCell>
                  <TableCell>Modalidade</TableCell>
                  <TableCell align="right">Mensalidade</TableCell>
                  <TableCell>Membros</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {plans.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>
                      {p.name}
                      {p.ans_code && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          ANS {p.ans_code}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{p.operator || '—'}</TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={planType.labelOf(p.plan_type)} />
                    </TableCell>
                    <TableCell align="right">{formatCents(p.monthly_fee_cents)}</TableCell>
                    <TableCell>
                      {p.members?.length ? (
                        <Tooltip
                          title={p.members
                            .map((m) => memberName(m.member_id) + (m.holder ? ' (titular)' : ''))
                            .join(', ')}
                        >
                          <AvatarGroup max={4} sx={{ justifyContent: 'flex-start', '& .MuiAvatar-root': { width: 30, height: 30, fontSize: 13 } }}>
                            {p.members.map((m) => (
                              <Avatar key={m.id}>{initials(memberName(m.member_id))}</Avatar>
                            ))}
                          </AvatarGroup>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Sem membros
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={p.active ? 'Ativo' : 'Inativo'}
                        color={p.active ? 'success' : 'default'}
                        variant={p.active ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Membros">
                        <IconButton size="small" onClick={() => setMembersOf(p)}>
                          <GroupsRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Documentos">
                        <IconButton size="small" onClick={() => setDocsOf(p)}>
                          <DescriptionRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEdit(p)}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton size="small" color="error" onClick={() => setToDelete(p)}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      <Box sx={{ mt: 2 }} />

      {formOpen && <PlanFormDialog open={formOpen} plan={editing} onClose={() => setFormOpen(false)} />}
      {membersOf && (
        <MembersDialog open={Boolean(membersOf)} plan={membersOf} onClose={() => setMembersOf(null)} />
      )}
      {docsOf && <PlanDocumentsDialog plan={docsOf} onClose={() => setDocsOf(null)} />}
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir plano"
        description={`Tem certeza que deseja excluir "${toDelete?.name}"? Esta ação não pode ser desfeita.`}
        loading={deleteMut.isPending}
        onConfirm={() => toDelete && deleteMut.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  )
}
