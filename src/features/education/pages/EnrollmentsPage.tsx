import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createEnrollment,
  deleteEnrollment,
  listEnrollments,
  updateEnrollment,
  type Enrollment,
  type EnrollmentInput,
  type Shift,
  type Stage,
} from '../api'
import {
  centsToReais,
  CURRENT_YEAR,
  educationKeys,
  errorMessage,
  formatCents,
  toCents,
} from '../constants'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import { listFamilyMembers } from '@/features/health/api'
import { PageHeader } from '@/features/health/components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { numericOptions } from '@/components/fields/options'
import { useSchoolYears } from '../hooks/useSchoolYears'

type FormState = {
  member_id: string
  school_year: number
  stage: Stage
  school_name: string
  grade: string
  shift: '' | Shift
  monthly_fee_reais: string
  enrollment_fee_reais: string
  notes: string
}

function emptyForm(): FormState {
  return {
    member_id: '',
    school_year: CURRENT_YEAR,
    stage: 'fundamental1',
    school_name: '',
    grade: '',
    shift: '',
    monthly_fee_reais: '',
    enrollment_fee_reais: '',
    notes: '',
  }
}

export default function EnrollmentsPage() {
  const queryClient = useQueryClient()
  const stage = useCatalog('education.stage')
  const shift = useCatalog('education.shift')
  const [yearFilter, setYearFilter] = useState<number | ''>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Enrollment | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [formError, setFormError] = useState<string | null>(null)

  const membersQuery = useQuery({
    queryKey: ['education', 'members'],
    queryFn: listFamilyMembers,
  })

  const params = useMemo(
    () => (yearFilter ? { school_year: yearFilter } : {}),
    [yearFilter],
  )

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: educationKeys.enrollments(params),
    queryFn: () => listEnrollments(params),
  })

  const enrollments = data ?? []
  const members = membersQuery.data ?? []
  const years = useSchoolYears()

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const input: EnrollmentInput = {
        member_id: form.member_id,
        school_year: Number(form.school_year),
        stage: form.stage,
        school_name: form.school_name || null,
        grade: form.grade || null,
        shift: form.shift || null,
        monthly_fee_cents: toCents(form.monthly_fee_reais || '0'),
        enrollment_fee_cents: toCents(form.enrollment_fee_reais || '0'),
        notes: form.notes || null,
      }
      return editing ? updateEnrollment(editing.id, input) : createEnrollment(input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: educationKeys.all })
      setDialogOpen(false)
    },
    onError: (err) => setFormError(errorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEnrollment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: educationKeys.all }),
  })

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyForm(), member_id: members[0]?.id ?? '' })
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(e: Enrollment) {
    setEditing(e)
    setForm({
      member_id: e.member_id,
      school_year: e.school_year,
      stage: e.stage,
      school_name: e.school_name ?? '',
      grade: e.grade ?? '',
      shift: e.shift ?? '',
      monthly_fee_reais: e.monthly_fee_cents ? String(centsToReais(e.monthly_fee_cents)) : '',
      enrollment_fee_reais: e.enrollment_fee_cents ? String(centsToReais(e.enrollment_fee_cents)) : '',
      notes: e.notes ?? '',
    })
    setFormError(null)
    setDialogOpen(true)
  }

  function submit() {
    if (!form.member_id) {
      setFormError('Selecione o membro da família.')
      return
    }
    setFormError(null)
    upsertMutation.mutate()
  }

  return (
    <>
      <PageHeader
        title="Matrículas"
        subtitle="Ano letivo, etapa e mensalidade de cada membro da família."
        action={
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={openCreate}
            disabled={members.length === 0}
          >
            Nova matrícula
          </Button>
        }
      />

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <AutocompleteField
          label="Ano letivo"
          size="small"
          emptyLabel="Todos os anos"
          value={yearFilter === '' ? '' : String(yearFilter)}
          onChange={(v) => setYearFilter(v === '' ? '' : Number(v))}
          options={numericOptions(years)}
          fullWidth={false}
          sx={{ minWidth: 160 }}
        />
      </Stack>

      {members.length === 0 && !membersQuery.isLoading && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Cadastre membros da família em Saúde para poder matriculá-los.
          </Typography>
        </Box>
      )}

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : enrollments.length === 0 ? (
        <EmptyState
          icon={<SchoolRoundedIcon />}
          title="Nenhuma matrícula cadastrada"
          description="Cadastre a matrícula do ano letivo de cada membro."
          action={
            members.length > 0 ? (
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
                Nova matrícula
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Membro</TableCell>
                  <TableCell>Ano</TableCell>
                  <TableCell>Etapa</TableCell>
                  <TableCell>Escola</TableCell>
                  <TableCell>Série</TableCell>
                  <TableCell align="right">Mensalidade</TableCell>
                  <TableCell align="right">Matrícula</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {enrollments.map((e) => (
                  <TableRow key={e.id} hover>
                    <TableCell>{e.member_name ?? '—'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={e.school_year} variant="outlined" />
                    </TableCell>
                    <TableCell>{stage.labelOf(e.stage)}</TableCell>
                    <TableCell>{e.school_name ?? '—'}</TableCell>
                    <TableCell>{e.grade ?? '—'}</TableCell>
                    <TableCell align="right">{formatCents(e.monthly_fee_cents)}</TableCell>
                    <TableCell align="right">{formatCents(e.enrollment_fee_cents)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEdit(e)}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            if (window.confirm(`Excluir a matrícula de ${e.member_name ?? 'membro'}?`)) {
                              deleteMutation.mutate(e.id)
                            }
                          }}
                        >
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Editar matrícula' : 'Nova matrícula'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <AutocompleteField
                label="Membro"
                value={form.member_id}
                onChange={(v) => setForm({ ...form, member_id: v })}
                options={members.map((m) => ({ value: m.id, label: m.full_name }))}
                disableClearable
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Ano letivo"
                value={form.school_year}
                onChange={(e) => setForm({ ...form, school_year: Number(e.target.value) })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <AutocompleteField
                label="Etapa"
                value={form.stage}
                onChange={(v) => setForm({ ...form, stage: v as Stage })}
                options={stage.options}
                loading={stage.isLoading}
                disableClearable
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <AutocompleteField
                label="Turno"
                emptyLabel="Não informar"
                value={form.shift}
                onChange={(v) => setForm({ ...form, shift: v as '' | Shift })}
                options={shift.options}
                loading={shift.isLoading}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                fullWidth
                label="Escola"
                value={form.school_name}
                onChange={(e) => setForm({ ...form, school_name: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Série"
                placeholder="ex: 3º ano"
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Mensalidade (R$)"
                value={form.monthly_fee_reais}
                onChange={(e) => setForm({ ...form, monthly_fee_reais: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Matrícula (R$)"
                value={form.enrollment_fee_reais}
                onChange={(e) => setForm({ ...form, enrollment_fee_reais: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Observações"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Grid>
            {formError && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2" color="error">
                  {formError}
                </Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={submit} disabled={upsertMutation.isPending}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
