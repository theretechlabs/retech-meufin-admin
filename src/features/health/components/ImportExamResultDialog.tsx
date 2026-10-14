import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Step,
  StepLabel,
  Stepper,
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
import { AttachFileButton } from '@/components/common/AttachFileButton'
import { AsyncAutocompleteField } from '@/components/fields/AsyncAutocompleteField'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import type { AutocompleteOption } from '@/components/fields/options'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  confirmExamDocument,
  extractDocument,
  getDocumentExtractionStatus,
  listFamilyMembers,
  listLabs,
  uploadDocument,
  type ConfirmExamItem,
  type ExamItemSuggestion,
  type HealthExtractionStatus,
  type RefTier,
} from '../api'
import { errorMessage, healthKeys } from '../constants'
import { markerOption, searchMarkers } from '../markerOptions'
import { LoadingState } from './StateViews'
import { resultNumber, TierFit } from './TierFit'

const STEPS = ['Enviar arquivo', 'Ler exame', 'Revisar', 'Confirmar']

const ACCEPTED = 'application/pdf,image/jpeg,image/png'

function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Converte string editável ("1,25") em número ou null. */
function toNumber(v: string): number | null {
  const t = v.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function numToText(v: number | null | undefined): string {
  return v == null ? '' : String(v).replace('.', ',')
}

/** Linha editável derivada de um item sugerido pela extração. */
type ReviewItem = {
  accepted: boolean
  rawName: string
  /** 'matched' usa markerId; 'new' cria marcador com markerName. */
  markerMode: 'matched' | 'new'
  markerId: string | null
  markerName: string // nome exibido/editável (novo marcador)
  candidates: AutocompleteOption[]
  resultValue: string
  unit: string
  refMin: string
  refMax: string
  refText: string | null
  method: string | null
  material: string | null
  rawText: string | null
  /** Curadoria do marcador casado (tooltip + enquadramento informativo). */
  markerRefText: string | null
  markerRefTiers: RefTier[]
}

function suggestionToReview(s: ExamItemSuggestion): ReviewItem {
  const matched = s.marker_status === 'matched' && s.marker_id
  return {
    accepted: Boolean(s.result_value?.trim()),
    rawName: s.raw_name,
    markerMode: matched ? 'matched' : 'new',
    markerId: matched ? (s.marker_id as string) : null,
    markerName: matched ? (s.marker_name ?? s.raw_name) : s.raw_name,
    candidates: (s.candidates ?? []).map((c) =>
      markerOption({ id: c.marker_id, canonical_name: c.canonical_name, canonical_unit: c.canonical_unit }),
    ),
    resultValue: s.result_value ?? '',
    unit: s.unit ?? '',
    refMin: numToText(s.reference_min),
    refMax: numToText(s.reference_max),
    refText: s.reference_text ?? null,
    method: s.method ?? null,
    material: s.material ?? null,
    rawText: s.raw_text ?? null,
    markerRefText: s.marker_ref_text ?? null,
    markerRefTiers: s.marker_ref_tiers ?? [],
  }
}

/**
 * Busca de marcador no catálogo para itens sem match: mostra os candidatos
 * fuzzy quando vazio e busca no servidor a partir de 2 caracteres — antes só
 * dava para aceitar o "mais próximo" ou criar marcador novo. Ao escolher, a
 * linha vira "matched" e este campo sai de cena; por isso nunca tem valor.
 */
function MarkerSearchField({
  candidates,
  onSelect,
}: {
  candidates: AutocompleteOption[]
  onSelect: (opt: AutocompleteOption) => void
}) {
  return (
    <AsyncAutocompleteField
      label="Buscar no catálogo"
      size="small"
      value=""
      placeholder={candidates.length > 0 ? 'ou escolha um parecido…' : undefined}
      queryKey={healthKeys.markers({ ctx: 'exam-import', candidates: candidates.map((c) => c.value) })}
      search={async (query, signal) => {
        const fromSearch = query.length >= 2 ? (await searchMarkers(query, signal)).map(markerOption) : []
        const seen = new Set(fromSearch.map((o) => o.value))
        return [...fromSearch, ...candidates.filter((c) => !seen.has(c.value))]
      }}
      onChange={(_, opt) => {
        if (opt) onSelect(opt)
      }}
    />
  )
}

export function ImportExamResultDialog({
  open,
  onClose,
  onConfirmed,
}: {
  open: boolean
  onClose: () => void
  onConfirmed: (message: string) => void
}) {
  const qc = useQueryClient()

  const [step, setStep] = useState(0)
  const [memberId, setMemberId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [pdfPassword, setPdfPassword] = useState('')

  // Cabeçalho do exame (passo revisão)
  const [examDate, setExamDate] = useState(todayIso())
  const [collectionDate, setCollectionDate] = useState('')
  const [summary, setSummary] = useState('')

  // Laboratório: existente (labId) ou criação (createLab + labName)
  const [labId, setLabId] = useState('')
  const [createLab, setCreateLab] = useState(false)
  const [labName, setLabName] = useState('')

  const [items, setItems] = useState<ReviewItem[]>([])
  const [warnings, setWarnings] = useState<string[]>([])

  const { data: members = [] } = useQuery({
    queryKey: healthKeys.familyMembers(),
    queryFn: listFamilyMembers,
    enabled: open,
  })
  const { data: labs = [] } = useQuery({
    queryKey: healthKeys.labs(),
    queryFn: listLabs,
    enabled: open,
  })

  // ---- Passo 1: upload + trigger extração -------------------------------
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Selecione um arquivo.')
      if (!memberId) throw new Error('Selecione o membro da família.')
      // Retry (ex.: senha do PDF): reaproveita o documento já enviado.
      let docId = documentId
      if (!docId) {
        const form = new FormData()
        form.append('file', file)
        form.append('document_type', 'exam_result')
        form.append('family_member_id', memberId)
        const doc = await uploadDocument(form)
        docId = doc.id
      }
      await extractDocument(docId, pdfPassword || undefined)
      return docId
    },
    onSuccess: (docId) => {
      setDocumentId(docId)
      setStep(1)
    },
  })

  // ---- Passo 2: polling do status ---------------------------------------
  const statusQuery = useQuery<HealthExtractionStatus>({
    queryKey: [...healthKeys.documents(), 'extraction-status', documentId] as const,
    queryFn: () => getDocumentExtractionStatus(documentId as string),
    enabled: step === 1 && Boolean(documentId),
    refetchInterval: (query) => {
      const s = query.state.data?.status
      return s === 'pending' || s === 'processing' ? 2500 : false
    },
  })

  const status = statusQuery.data

  // Extração completa: popula (uma vez) e avança — mesmo padrão do import de
  // fatura ("ajustar estado durante o render", guardado por populatedFor).
  const [populatedFor, setPopulatedFor] = useState<string | null>(null)
  if (
    step === 1 &&
    status?.status === 'completed' &&
    documentId &&
    populatedFor !== documentId
  ) {
    setPopulatedFor(documentId)
    const exam = status.exam
    setItems((exam?.items ?? []).map(suggestionToReview))
    setWarnings(exam?.warnings ?? [])
    if (exam?.exam_date) setExamDate(exam.exam_date)
    if (exam?.collection_date) setCollectionDate(exam.collection_date)
    if (exam?.summary) setSummary(exam.summary)
    if (exam?.lab_id) {
      setLabId(exam.lab_id)
      setCreateLab(false)
    } else if (exam?.lab_is_new && exam.laboratory_name) {
      setCreateLab(true)
      setLabName(exam.laboratory_name)
    }
    setStep(2)
  }

  // ---- Passo 3/4: confirmar ---------------------------------------------
  const acceptedItems = useMemo(() => items.filter((i) => i.accepted), [items])
  const newMarkersCount = useMemo(
    () => acceptedItems.filter((i) => i.markerMode === 'new' && i.markerName.trim()).length,
    [acceptedItems]
  )

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!documentId) throw new Error('Documento inválido.')
      const payloadItems: ConfirmExamItem[] = acceptedItems.map((i) => {
        const base: ConfirmExamItem = {
          raw_marker_name: i.rawName || undefined,
          result_value: i.resultValue.trim(),
          unit: i.unit.trim() || undefined,
          reference_min: toNumber(i.refMin),
          reference_max: toNumber(i.refMax),
          reference_text: i.refText || undefined,
          method: i.method || undefined,
          material: i.material || undefined,
          raw_text: i.rawText || undefined,
        }
        if (i.markerMode === 'matched' && i.markerId) {
          base.marker_id = i.markerId
        } else if (i.markerName.trim()) {
          base.new_marker = {
            name: i.markerName.trim(),
            canonical_unit: i.unit.trim() || undefined,
            ref_min: toNumber(i.refMin),
            ref_max: toNumber(i.refMax),
            ref_text: i.refText || undefined,
            aliases: i.rawName && i.rawName !== i.markerName.trim() ? [i.rawName] : undefined,
          }
        }
        return base
      })
      return confirmExamDocument(documentId, {
        family_member_id: memberId,
        exam_date: examDate,
        collection_date: collectionDate || undefined,
        lab_id: !createLab && labId ? labId : undefined,
        new_lab_name: createLab && labName.trim() ? labName.trim() : undefined,
        summary: summary.trim() || undefined,
        items: payloadItems,
      })
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: healthKeys.all })
      const extras: string[] = []
      if (res.created_markers.length > 0) {
        extras.push(`${res.created_markers.length} marcador(es) novo(s) no catálogo`)
      }
      if (res.created_lab) extras.push(`laboratório "${res.created_lab.name}" criado`)
      const base = `Exame importado com ${res.items_total} item(ns).`
      onConfirmed(extras.length > 0 ? `${base} Também: ${extras.join(' e ')}.` : base)
      onClose()
    },
  })

  const setItem = (index: number, patch: Partial<ReviewItem>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))

  const pending = uploadMutation.isPending || confirmMutation.isPending
  const failed = status?.status === 'failed'

  const canConfirm =
    acceptedItems.length > 0 &&
    Boolean(examDate) &&
    acceptedItems.every(
      (i) =>
        i.resultValue.trim() &&
        (i.markerMode === 'matched' ? Boolean(i.markerId) : Boolean(i.markerName.trim()))
    )

  return (
    // Fecha SÓ pelo botão: a extração custa tokens de LLM e clique fora /
    // Esc acidental descartaria a revisão inteira.
    <Dialog open={open} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Importar exame (PDF)
        <IconButton aria-label="Fechar" onClick={onClose} disabled={pending} edge="end">
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stepper activeStep={step} sx={{ mt: 1, mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* ---------------- Passo 1: upload ---------------- */}
        {step === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {uploadMutation.isError && (
              <Alert severity="error">{errorMessage(uploadMutation.error)}</Alert>
            )}
            <AutocompleteField
              label="Membro da família"
              value={memberId}
              onChange={setMemberId}
              options={members.map((m) => ({ value: m.id, label: m.full_name }))}
              disableClearable
            />

            <AttachFileButton
              label={file ? file.name : 'Selecionar PDF ou imagem'}
              accept={ACCEPTED}
              onFiles={(picked) => {
                setFile(picked[0] ?? null)
                setDocumentId(null)
              }}
            />
            <TextField
              type="password"
              label="Senha do PDF (se protegido)"
              value={pdfPassword}
              onChange={(e) => setPdfPassword(e.target.value)}
              fullWidth
              helperText="Alguns laboratórios protegem o laudo com senha (geralmente CPF ou data de nascimento). Usada só na leitura; não fica salva."
            />
            <Typography variant="caption" color="text.secondary">
              Aceita PDF ou imagem (JPG/PNG). O laudo será lido por IA para sugerir os itens do
              exame — você revisa tudo antes de salvar.
            </Typography>
          </Box>
        )}

        {/* ---------------- Passo 2: lendo ---------------- */}
        {step === 1 && (
          <Box>
            {failed ? (
              <Alert severity="error">
                {status?.error_message ||
                  'Falha ao ler o exame. Tente novamente ou lance manualmente.'}
              </Alert>
            ) : statusQuery.isError ? (
              <Alert severity="warning">
                {errorMessage(
                  statusQuery.error,
                  'Extração LLM não configurada; lance manualmente ou configure a env.'
                )}
              </Alert>
            ) : (
              <LoadingState label="Lendo o exame…" />
            )}
          </Box>
        )}

        {/* ---------------- Passo 3: revisão ---------------- */}
        {step === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {confirmMutation.isError && (
              <Alert severity="error">{errorMessage(confirmMutation.error)}</Alert>
            )}
            {warnings.length > 0 && (
              <Alert severity="warning">
                {warnings.map((w, i) => (
                  <Typography key={i} variant="body2">
                    {w}
                  </Typography>
                ))}
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                type="date"
                label="Data do exame"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 180 }}
              />
              <TextField
                type="date"
                label="Data da coleta"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 180 }}
              />
              <TextField
                label="Resumo"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                sx={{ flex: 1, minWidth: 220 }}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              {!createLab ? (
                <AutocompleteField
                  label="Laboratório"
                  size="small"
                  fullWidth={false}
                  sx={{ minWidth: 260 }}
                  emptyLabel="Sem laboratório"
                  value={labId}
                  onChange={setLabId}
                  options={labs.map((l) => ({ value: l.id, label: l.name }))}
                />
              ) : (
                <TextField
                  label="Novo laboratório"
                  value={labName}
                  onChange={(e) => setLabName(e.target.value)}
                  sx={{ minWidth: 260 }}
                  size="small"
                />
              )}
              <FormControlLabel
                control={
                  <Switch
                    checked={createLab}
                    onChange={(e) => setCreateLab(e.target.checked)}
                    size="small"
                  />
                }
                label="Cadastrar laboratório novo"
              />
            </Box>

            {items.length === 0 ? (
              <Alert severity="info">
                Nenhum item foi identificado no laudo. Você pode fechar e lançar manualmente.
              </Alert>
            ) : (
              <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" />
                      <TableCell sx={{ minWidth: 240 }}>Marcador</TableCell>
                      <TableCell sx={{ width: 130 }}>Resultado</TableCell>
                      <TableCell sx={{ width: 110 }}>Unidade</TableCell>
                      <TableCell sx={{ width: 100 }} align="right">
                        Ref. mín
                      </TableCell>
                      <TableCell sx={{ width: 100 }} align="right">
                        Ref. máx
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((it, idx) => (
                      <TableRow key={idx} hover selected={it.accepted}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={it.accepted}
                            onChange={(e) => setItem(idx, { accepted: e.target.checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {it.markerMode === 'matched' ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2">{it.markerName}</Typography>
                                <Chip label="catálogo" size="small" color="success" variant="outlined" />
                                {(it.refText || it.markerRefText) && (
                                  <Tooltip
                                    title={
                                      <Typography variant="caption" sx={{ whiteSpace: 'pre-line' }}>
                                        {it.refText ?? it.markerRefText}
                                      </Typography>
                                    }
                                    arrow
                                  >
                                    <InfoOutlinedIcon
                                      fontSize="inherit"
                                      sx={{ color: 'text.secondary', cursor: 'help' }}
                                    />
                                  </Tooltip>
                                )}
                              </Box>
                            ) : (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TextField
                                  variant="standard"
                                  fullWidth
                                  value={it.markerName}
                                  onChange={(e) => setItem(idx, { markerName: e.target.value })}
                                  placeholder="Nome do marcador"
                                />
                                <Chip label="novo" size="small" color="warning" variant="outlined" />
                              </Box>
                            )}
                            {it.markerMode === 'new' && (
                              <MarkerSearchField
                                candidates={it.candidates}
                                onSelect={(c) =>
                                  setItem(idx, {
                                    markerMode: 'matched',
                                    markerId: c.value,
                                    markerName: c.label,
                                  })
                                }
                              />
                            )}
                            {it.markerRefTiers.length > 0 && resultNumber(it.resultValue) != null && (
                              <TierFit value={resultNumber(it.resultValue) as number} tiers={it.markerRefTiers} />
                            )}
                            {it.markerMode === 'matched' && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ cursor: 'pointer', textDecoration: 'underline' }}
                                onClick={() =>
                                  setItem(idx, {
                                    markerMode: 'new',
                                    markerId: null,
                                    markerName: it.rawName,
                                  })
                                }
                              >
                                usar como novo marcador
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <TextField
                            variant="standard"
                            fullWidth
                            value={it.resultValue}
                            onChange={(e) => setItem(idx, { resultValue: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            variant="standard"
                            fullWidth
                            value={it.unit}
                            onChange={(e) => setItem(idx, { unit: e.target.value })}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            variant="standard"
                            value={it.refMin}
                            onChange={(e) => setItem(idx, { refMin: e.target.value })}
                            inputProps={{ style: { textAlign: 'right' } }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            variant="standard"
                            value={it.refMax}
                            onChange={(e) => setItem(idx, { refMax: e.target.value })}
                            inputProps={{ style: { textAlign: 'right' } }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Divider />
            <Typography variant="body2" color="text.secondary">
              {acceptedItems.length} de {items.length} item(ns) selecionado(s).
              {newMarkersCount > 0 &&
                ` ${newMarkersCount} marcador(es) será(ão) criado(s) no catálogo.`}
              {createLab && labName.trim() && ` Laboratório "${labName.trim()}" será cadastrado.`}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={pending}>
          Cancelar
        </Button>

        {step === 0 && (
          <Button
            variant="contained"
            onClick={() => uploadMutation.mutate()}
            disabled={!file || !memberId || uploadMutation.isPending}
          >
            Enviar e ler
          </Button>
        )}

        {step === 1 && failed && (
          <Button
            variant="contained"
            onClick={() => {
              setDocumentId(null)
              setPopulatedFor(null)
              setItems([])
              setStep(0)
            }}
          >
            Tentar novamente
          </Button>
        )}

        {step === 2 && (
          <Button
            variant="contained"
            onClick={() => confirmMutation.mutate()}
            disabled={!canConfirm || confirmMutation.isPending}
          >
            Confirmar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
