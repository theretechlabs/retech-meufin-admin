import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  Switch,
  FormControlLabel,
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
import FolderSharedRoundedIcon from '@mui/icons-material/FolderSharedRounded'
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import {
  createFamilyMember,
  deleteFamilyMember,
  deleteMemberAvatar,
  listFamilyMembersPaged,
  updateFamilyMember,
  uploadMemberAvatar,
  type FamilyMember,
  type FamilyMemberInput,
} from '../api'
import { AvatarCropDialog } from '@/components/common/AvatarCropDialog'
import { DecimalField, formatDecimalBR, parseDecimalBR } from '@/components/fields/DecimalField'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { ACTIVE_FILTER_OPTIONS } from '@/components/fields/options'
import { errorMessage, GENDER_OPTIONS, healthKeys, RELATIONSHIP_LABEL, RELATIONSHIP_OPTIONS } from '../constants'
import { TablePaginationBR } from '@/components/tables/TablePaginationBR'
import { PageHeader } from '../components/PageHeader'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews'
import { MemberDocumentsDialog } from '../components/MemberDocumentsDialog'
import { useToast } from '@/providers/ToastProvider'

/**
 * No form, peso e altura trafegam como string pt-BR mascarada (DecimalField);
 * a altura é digitada em metros e convertida para cm no submit.
 */
type FormValues = Omit<FamilyMemberInput, 'height_cm' | 'weight_kg'> & {
  height_m: string
  weight_kg: string
}


const emptyForm: FormValues = {
  full_name: '',
  relationship: 'self',
  birth_date: '',
  gender: '',
  document: '',
  notes: '',
  height_m: '',
  weight_kg: '',
  active: true,
}

/** Iniciais (até 2) a partir do nome completo. */
function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** "YYYY-MM-DD" → "DD/MM/YYYY" (sem sofrer com fuso). */
function formatBirthDate(iso?: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

/** Peso/altura em texto compacto pt-BR: "72,5 kg · 1,78 m". */
function formatMeasures(m: FamilyMember): string {
  const parts: string[] = []
  if (m.weight_kg != null) {
    parts.push(
      `${m.weight_kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`
    )
  }
  if (m.height_cm != null) parts.push(`${formatDecimalBR(m.height_cm / 100, 2)} m`)
  return parts.length ? parts.join(' · ') : '—'
}

function MemberFormDialog({
  open,
  member,
  onClose,
}: {
  open: boolean
  member: FamilyMember | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const isEdit = Boolean(member)

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    values: member
      ? {
          full_name: member.full_name,
          relationship: member.relationship,
          birth_date: member.birth_date,
          gender: member.gender ?? '',
          document: member.document ?? '',
          notes: member.notes ?? '',
          height_m: formatDecimalBR(member.height_cm != null ? member.height_cm / 100 : null, 2),
          weight_kg: formatDecimalBR(member.weight_kg, 1),
          active: member.active,
        }
      : emptyForm,
  })

  const mutation = useMutation({
    mutationFn: (values: FamilyMemberInput) =>
      isEdit ? updateFamilyMember(member!.id, values) : createFamilyMember(values),
    onSuccess: () => {
      show(isEdit ? 'Membro atualizado com sucesso.' : 'Membro criado com sucesso.')
      qc.invalidateQueries({ queryKey: healthKeys.familyMembers() })
      reset(emptyForm)
      onClose()
    },
  })

  // --- Foto (avatar) do membro ---
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(member?.avatar_url ?? null)

  // Reflete a foto do membro selecionado ao (re)abrir o diálogo.
  useEffect(() => {
    setAvatarUrl(member?.avatar_url ?? null)
  }, [member])

  const invalidateMembers = () => {
    qc.invalidateQueries({ queryKey: healthKeys.familyMembers() })
    qc.invalidateQueries({ queryKey: healthKeys.birthdays() })
  }

  const uploadAvatar = useMutation({
    mutationFn: (blob: Blob) => uploadMemberAvatar(member!.id, blob),
    onSuccess: (updated) => {
      setAvatarUrl(updated.avatar_url ?? null)
      invalidateMembers()
      show('Foto atualizada.')
    },
    onError: (e) => show(errorMessage(e), 'error'),
  })

  const removeAvatar = useMutation({
    mutationFn: () => deleteMemberAvatar(member!.id),
    onSuccess: () => {
      setAvatarUrl(null)
      invalidateMembers()
      show('Foto removida.')
    },
    onError: (e) => show(errorMessage(e), 'error'),
  })

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    e.target.value = '' // permite re-selecionar o mesmo arquivo
    if (file) setCropFile(file)
  }

  const avatarBusy = uploadAvatar.isPending || removeAvatar.isPending

  const submit = handleSubmit(({ height_m, weight_kg, ...values }) => {
    const heightM = parseDecimalBR(height_m)
    mutation.mutate({
      ...values,
      gender: values.gender || null,
      document: values.document || null,
      notes: values.notes || null,
      height_cm: heightM != null ? Math.round(heightM * 100) : null,
      weight_kg: parseDecimalBR(weight_kg),
    })
  })

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {isEdit ? 'Editar membro' : 'Novo membro da família'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}

          {isEdit && (
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar
                src={avatarUrl ?? undefined}
                sx={{ width: 64, height: 64, fontSize: '1.4rem', fontWeight: 800 }}
              >
                {memberInitials(member?.full_name ?? '')}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Foto
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PhotoCameraRoundedIcon />}
                    disabled={avatarBusy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {avatarUrl ? 'Alterar foto' : 'Adicionar foto'}
                  </Button>
                  {avatarUrl && (
                    <Button
                      size="small"
                      color="error"
                      disabled={avatarBusy}
                      onClick={() => removeAvatar.mutate()}
                    >
                      Remover
                    </Button>
                  )}
                </Stack>
              </Box>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={onPickFile}
              />
            </Stack>
          )}

          <Controller
            name="full_name"
            control={control}
            rules={{ required: 'Informe o nome completo' }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Nome completo"
                fullWidth
                required
                error={Boolean(errors.full_name)}
                helperText={errors.full_name?.message}
              />
            )}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="relationship"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <AutocompleteField
                  label="Parentesco"
                  value={field.value}
                  onChange={field.onChange}
                  options={RELATIONSHIP_OPTIONS}
                  required
                  disableClearable
                />
              )}
            />
            <Controller
              name="birth_date"
              control={control}
              rules={{ required: 'Informe a data de nascimento' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="date"
                  label="Data de nascimento"
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                  error={Boolean(errors.birth_date)}
                  helperText={errors.birth_date?.message}
                />
              )}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="gender"
              control={control}
              render={({ field }) => (
                <AutocompleteField
                  label="Gênero"
                  emptyLabel="Não informado"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  options={GENDER_OPTIONS}
                />
              )}
            />
            <Controller
              name="document"
              control={control}
              render={({ field }) => (
                <TextField {...field} value={field.value ?? ''} label="Documento (CPF)" fullWidth />
              )}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="weight_kg"
              control={control}
              render={({ field }) => (
                <DecimalField {...field} decimals={1} unit="kg" label="Peso" fullWidth />
              )}
            />
            <Controller
              name="height_m"
              control={control}
              render={({ field }) => (
                <DecimalField {...field} decimals={2} unit="m" label="Altura" fullWidth />
              )}
            />
          </Stack>
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                label="Observações"
                fullWidth
                multiline
                minRows={2}
              />
            )}
          />
          <Controller
            name="active"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Ativo"
              />
            )}
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

      <AvatarCropDialog
        open={Boolean(cropFile)}
        imageFile={cropFile}
        onClose={() => setCropFile(null)}
        onApply={(blob) => {
          setCropFile(null)
          uploadAvatar.mutate(blob)
        }}
      />
    </Dialog>
  )
}

export default function FamilyMembersPage() {
  const qc = useQueryClient()
  const { show } = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<FamilyMember | null>(null)
  const [toDelete, setToDelete] = useState<FamilyMember | null>(null)
  const [docsFor, setDocsFor] = useState<FamilyMember | null>(null)

  const [q, setQ] = useState('')
  const [relationship, setRelationship] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const params = useMemo(
    () => ({
      limit: pageSize,
      offset: page * pageSize,
      query: q.trim() || undefined,
      relationship: relationship || undefined,
      active: status === '' ? undefined : status === 'true',
    }),
    [pageSize, page, q, relationship, status]
  )

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [...healthKeys.familyMembers(), params],
    queryFn: () => listFamilyMembersPaged(params),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFamilyMember(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: healthKeys.familyMembers() })
      setToDelete(null)
      show('Membro excluído.')
    },
  })

  const members = useMemo(() => data?.items ?? [], [data])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (m: FamilyMember) => {
    setEditing(m)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Membros da Família"
        subtitle="Cadastre as pessoas cujos exames de saúde você vai acompanhar."
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
            Novo membro
          </Button>
        }
      />

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(0)
            }}
            placeholder="Buscar por nome…"
            size="small"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <AutocompleteField
            label="Parentesco"
            size="small"
            fullWidth={false}
            sx={{ minWidth: { sm: 200 } }}
            emptyLabel="Todos"
            value={relationship}
            onChange={(v) => {
              setRelationship(v)
              setPage(0)
            }}
            options={RELATIONSHIP_OPTIONS}
          />
          <AutocompleteField
            label="Status"
            size="small"
            fullWidth={false}
            sx={{ minWidth: { sm: 200 } }}
            emptyLabel="Todos"
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(0)
            }}
            options={ACTIVE_FILTER_OPTIONS}
          />
        </Stack>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : members.length === 0 ? (
        <EmptyState
          icon={<GroupsRoundedIcon />}
          title="Nenhum membro cadastrado"
          description={
            q || relationship || status
              ? 'Ajuste a busca ou os filtros.'
              : 'Adicione o primeiro membro da família para começar a organizar os exames.'
          }
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Novo membro
            </Button>
          }
        />
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 56 }} />
                  <TableCell>Nome</TableCell>
                  <TableCell>Parentesco</TableCell>
                  <TableCell>Nascimento</TableCell>
                  <TableCell align="center">Idade</TableCell>
                  <TableCell>Medidas</TableCell>
                  <TableCell>Documento</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id} hover>
                    <TableCell sx={{ width: 56 }}>
                      <Avatar
                        src={m.avatar_url ?? undefined}
                        sx={{ width: 40, height: 40, fontSize: '0.9rem', fontWeight: 700 }}
                      >
                        {memberInitials(m.full_name)}
                      </Avatar>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{m.full_name}</TableCell>
                    <TableCell>{RELATIONSHIP_LABEL[m.relationship] ?? m.relationship}</TableCell>
                    <TableCell>{formatBirthDate(m.birth_date)}</TableCell>
                    <TableCell align="center">
                      {m.age != null ? `${m.age} anos` : '—'}
                    </TableCell>
                    <TableCell>{formatMeasures(m)}</TableCell>
                    <TableCell>{m.document || '—'}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={m.active ? 'Ativo' : 'Inativo'}
                        color={m.active ? 'success' : 'default'}
                        variant={m.active ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Documentos">
                        <IconButton size="small" onClick={() => setDocsFor(m)}>
                          <FolderSharedRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEdit(m)}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton size="small" color="error" onClick={() => setToDelete(m)}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePaginationBR
            total={data?.total ?? 0}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </Card>
      )}

      {formOpen && (
        <MemberFormDialog open={formOpen} member={editing} onClose={() => setFormOpen(false)} />
      )}

      {docsFor && <MemberDocumentsDialog member={docsFor} onClose={() => setDocsFor(null)} />}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir membro"
        description={`Tem certeza que deseja excluir "${toDelete?.full_name}"? Esta ação não pode ser desfeita.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  )
}
