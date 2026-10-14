import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { AttachFileButton } from '@/components/common/AttachFileButton'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded'
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import RequestQuoteRoundedIcon from '@mui/icons-material/RequestQuoteRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteEntryAttachment,
  entryAttachmentDownloadURL,
  listEntryAttachments,
  uploadEntryAttachment,
  type EntryAttachment,
  type EntryAttachmentType,
} from '../api'
import { errorMessage, financeKeys, isAttachmentReplicable } from '../constants'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import { ConfirmDialog } from '@/features/health/components/ConfirmDialog'
import { ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { RECEIPT_ACCEPT } from './EntryReceiptsSection'
import { AutocompleteField } from '@/components/fields/AutocompleteField'

/** Rascunho de anexo antes do upload (usado no form de criação e no diálogo de adicionar). */
export type AttachmentDraft = {
  file: File
  attachment_type: EntryAttachmentType
  payment_code: string
  note: string
}

const HAS_CODE: ReadonlySet<EntryAttachmentType> = new Set(['boleto', 'pix_qrcode'])

/**
 * Lê o campo 01 (Point of Initiation Method) do payload EMV do Pix:
 * "12" = QR dinâmico (uso único, com validade). Espelha o servidor; serve
 * só para avisar antes do upload.
 */
function isPixDynamic(payload: string): boolean {
  const p = payload.trim()
  for (let i = 0; i + 4 <= p.length; ) {
    const tag = p.slice(i, i + 2)
    const len = Number(p.slice(i + 2, i + 4))
    if (!Number.isInteger(len) || len < 0 || i + 4 + len > p.length) return false
    if (tag === '01') return p.slice(i + 4, i + 4 + len) === '12'
    i += 4 + len
  }
  return false
}

/** Como o anexo se comporta numa série, para o texto de apoio dos forms. */
function seriesHint(type: EntryAttachmentType, applyToFuture: boolean): string {
  if (!isAttachmentReplicable(type)) {
    return 'Fica só neste lançamento: cada parcela tem o seu.'
  }
  return applyToFuture
    ? 'Será replicado às parcelas futuras previstas desta série.'
    : 'Fica só neste lançamento (replicação às futuras desligada).'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Linha digitável em blocos legíveis; Pix fica como está (longo, copia inteiro). */
function displayCode(type: EntryAttachmentType | null | undefined, code: string): string {
  if (type === 'boleto' && /^\d{47}$/.test(code)) {
    return `${code.slice(0, 5)}.${code.slice(5, 10)} ${code.slice(10, 15)}.${code.slice(15, 21)} ${code.slice(21, 26)}.${code.slice(26, 32)} ${code.slice(32, 33)} ${code.slice(33)}`
  }
  if (type === 'boleto' && /^\d{48}$/.test(code)) {
    return code.match(/.{1,12}/g)?.join(' ') ?? code
  }
  return code
}

function MimeIcon({ mime }: { mime: string }) {
  if (mime === 'application/pdf') return <PictureAsPdfRoundedIcon fontSize="small" color="error" />
  if (mime.startsWith('image/')) return <ImageRoundedIcon fontSize="small" color="primary" />
  return <DescriptionRoundedIcon fontSize="small" color="action" />
}

/** Botão "copiar" com confirmação visual de 1,5s. */
export function CopyCodeButton({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard bloqueado (http sem TLS, iframe): o usuário ainda vê o código abaixo.
    }
  }
  return (
    <Tooltip title={copied ? 'Copiado!' : label}>
      <IconButton size="small" onClick={copy} aria-label={label} color={copied ? 'success' : 'default'}>
        {copied ? <CheckRoundedIcon fontSize="small" /> : <ContentCopyRoundedIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  )
}

/**
 * Campos de um rascunho de anexo: tipo, código de pagamento (boleto/Pix) e
 * observação. Compartilhado pelo form de criação e pelo diálogo de adicionar.
 */
function DraftFields({
  draft,
  onChange,
  autoFocusType,
  inSeries = false,
  applyToFuture = false,
}: {
  draft: AttachmentDraft
  onChange: (d: AttachmentDraft) => void
  autoFocusType?: boolean
  /** Lançamento pertence a parcelamento/recorrência: mostra como o anexo se propaga. */
  inSeries?: boolean
  applyToFuture?: boolean
}) {
  const attachmentType = useCatalog('finance.attachment_type')
  const showCode = HAS_CODE.has(draft.attachment_type)
  const isImage = draft.file.type.startsWith('image/')
  const pixDynamic = draft.attachment_type === 'pix_qrcode' && isPixDynamic(draft.payment_code)
  return (
    <Stack spacing={1.5}>
      <AutocompleteField
        label="Tipo"
        size="small"
        value={draft.attachment_type}
        autoFocus={autoFocusType}
        onChange={(v) => onChange({ ...draft, attachment_type: v as EntryAttachmentType })}
        options={attachmentType.options}
        loading={attachmentType.isLoading}
        disableClearable
      />
      {showCode && (
        <TextField
          size="small"
          label={draft.attachment_type === 'boleto' ? 'Linha digitável' : 'Pix copia e cola'}
          value={draft.payment_code}
          onChange={(e) => onChange({ ...draft, payment_code: e.target.value })}
          multiline={draft.attachment_type === 'pix_qrcode'}
          minRows={draft.attachment_type === 'pix_qrcode' ? 2 : 1}
          helperText={
            isImage
              ? 'Opcional: se a imagem tiver QR Code Pix, o código é lido automaticamente.'
              : 'Opcional — facilita copiar na hora de pagar.'
          }
        />
      )}
      {pixDynamic && (
        <Alert severity="warning" sx={{ py: 0 }}>
          QR Pix dinâmico: é de uso único e tem validade. Replicar às próximas parcelas pode deixar
          um código vencido nelas.
        </Alert>
      )}
      <TextField
        size="small"
        label="Observação"
        value={draft.note}
        onChange={(e) => onChange({ ...draft, note: e.target.value })}
        inputProps={{ maxLength: 500 }}
      />
      {inSeries && (
        <Typography variant="caption" color="text.secondary">
          {seriesHint(draft.attachment_type, applyToFuture)}
        </Typography>
      )}
    </Stack>
  )
}

/** Sugere o tipo pelo nome do arquivo (ajuste manual sempre possível). */
function guessType(file: File): EntryAttachmentType {
  const n = file.name.toLowerCase()
  if (/boleto|cobran|fatura-?boleto/.test(n)) return 'boleto'
  if (/pix|qr/.test(n)) return 'pix_qrcode'
  if (/nf|nota|danfe|nfe|nfs/.test(n)) return 'nota_fiscal'
  if (/contrat/.test(n)) return 'contrato'
  if (/fatura|invoice/.test(n)) return 'fatura'
  return 'outro'
}

function newDraft(file: File): AttachmentDraft {
  return { file, attachment_type: guessType(file), payment_code: '', note: '' }
}

/**
 * Lista de rascunhos de anexo no form de criação da despesa: o upload só
 * acontece depois que o lançamento existe. Cada item expande tipo/código.
 */
export function AttachmentDraftList({
  drafts,
  onChange,
  disabled,
  inSeries = false,
  applyToFuture = false,
}: {
  drafts: AttachmentDraft[]
  onChange: (drafts: AttachmentDraft[]) => void
  disabled?: boolean
  /** Série (parcelas/recorrência): cada rascunho mostra se replica ou fica só aqui. */
  inSeries?: boolean
  /** Replicação ligada (no create de série é sempre; no edit segue "Aplicar às próximas"). */
  applyToFuture?: boolean
}) {
  return (
    <Stack spacing={1}>
      <AttachFileButton
        label="Anexar documento para pagar (boleto, QR Pix, nota…)"
        multiple
        accept={RECEIPT_ACCEPT}
        disabled={disabled}
        onFiles={(picked) => onChange([...drafts, ...picked.map(newDraft)])}
      />
      {drafts.map((d, i) => (
        <Box
          key={`${d.file.name}-${i}`}
          sx={{ p: 1.5, borderRadius: 1.5, border: 1, borderColor: 'divider' }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <MimeIcon mime={d.file.type} />
            <Typography variant="body2" noWrap sx={{ flex: 1 }} title={d.file.name}>
              {d.file.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatSize(d.file.size)}
            </Typography>
            <IconButton
              size="small"
              onClick={() => onChange(drafts.filter((_, j) => j !== i))}
              disabled={disabled}
              aria-label="Remover anexo"
            >
              <DeleteOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>
          <DraftFields
            draft={d}
            onChange={(nd) => onChange(drafts.map((x, j) => (j === i ? nd : x)))}
            inSeries={inSeries}
            applyToFuture={applyToFuture}
          />
        </Box>
      ))}
    </Stack>
  )
}

/** Diálogo "adicionar anexo" a um lançamento existente. */
function AddAttachmentDialog({
  entryId,
  file,
  inSeries,
  onClose,
  onDone,
}: {
  entryId: string
  file: File
  inSeries: boolean
  onClose: () => void
  onDone: (replicatedTo: number) => void
}) {
  const [draft, setDraft] = useState<AttachmentDraft>(() => newDraft(file))
  const [applyToFuture, setApplyToFuture] = useState(true)
  const replicable = isAttachmentReplicable(draft.attachment_type)
  const willReplicate = inSeries && replicable && applyToFuture
  const mutation = useMutation({
    mutationFn: () =>
      uploadEntryAttachment(entryId, { ...draft, apply_to: willReplicate ? 'future' : undefined }),
    onSuccess: (a) => onDone(a.replicated_to ?? 0),
  })
  return (
    <Dialog open onClose={mutation.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Adicionar anexo</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
          <Stack direction="row" alignItems="center" spacing={1}>
            <MimeIcon mime={file.type} />
            <Typography variant="body2" noWrap title={file.name}>
              {file.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatSize(file.size)}
            </Typography>
          </Stack>
          <DraftFields
            draft={draft}
            onChange={setDraft}
            autoFocusType
            inSeries={inSeries}
            applyToFuture={willReplicate}
          />
          {inSeries && replicable && (
            <FormControlLabel
              control={
                <Switch
                  checked={applyToFuture}
                  onChange={(e) => setApplyToFuture(e.target.checked)}
                />
              }
              label="Aplicar às próximas parcelas"
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button onClick={() => mutation.mutate()} variant="contained" disabled={mutation.isPending}>
          {mutation.isPending ? 'Enviando…' : willReplicate ? 'Anexar à série' : 'Anexar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * Anexos de apoio do lançamento (boleto, QR Code Pix, nota, contrato…):
 * lista com código de pagamento copiável, abre via URL presignada, exclui
 * e adiciona. Distinto dos comprovantes (que provam o pagamento).
 */
export function EntryAttachmentsSection({
  entryId,
  readOnly = false,
  inSeries = false,
}: {
  entryId: string
  readOnly?: boolean
  /** Lançamento em parcelamento/recorrência: habilita replicar às próximas. */
  inSeries?: boolean
}) {
  const attachmentType = useCatalog('finance.attachment_type')
  const [replicatedMsg, setReplicatedMsg] = useState<string | null>(null)
  const qc = useQueryClient()
  const [adding, setAdding] = useState<File | null>(null)
  const [toDelete, setToDelete] = useState<EntryAttachment | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)

  const attachmentsQ = useQuery({
    queryKey: financeKeys.attachments(entryId),
    queryFn: () => listEntryAttachments(entryId),
  })
  const attachments = attachmentsQ.data ?? []

  // Prefixo de todos os lançamentos: a replicação altera anexos de outras parcelas.
  const invalidate = () => qc.invalidateQueries({ queryKey: [...financeKeys.all, 'attachments'] })

  const deleteMutation = useMutation({
    mutationFn: (a: EntryAttachment) => deleteEntryAttachment(entryId, a.id),
    onSuccess: () => {
      setToDelete(null)
      invalidate()
    },
  })

  const openAttachment = async (a: EntryAttachment) => {
    setOpenError(null)
    setOpeningId(a.id)
    const tab = window.open('', '_blank')
    try {
      const url = await entryAttachmentDownloadURL(entryId, a.id)
      if (tab) tab.location.href = url
      else window.location.href = url
    } catch (err) {
      tab?.close()
      setOpenError(errorMessage(err))
    } finally {
      setOpeningId(null)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.75 }}
          >
            <RequestQuoteRoundedIcon fontSize="small" color="action" />
            Documentos para pagar
            {attachments.length > 0 && (
              <Typography component="span" variant="caption" color="text.secondary">
                ({attachments.length})
              </Typography>
            )}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Boleto, QR Code Pix, nota, contrato, fatura — o que você usa para pagar.
          </Typography>
        </Box>
      </Box>
      {!readOnly && (
        <Box sx={{ mb: 1 }}>
          <AttachFileButton
            label="Anexar documento para pagar"
            accept={RECEIPT_ACCEPT}
            onFiles={(picked) => setAdding(picked[0])}
          />
        </Box>
      )}

      {attachmentsQ.isLoading && <LoadingState label="Carregando anexos…" />}
      {attachmentsQ.isError && <ErrorState message={errorMessage(attachmentsQ.error)} />}
      {deleteMutation.isError && <ErrorState message={errorMessage(deleteMutation.error)} />}
      {openError && <ErrorState message={openError} />}
      {replicatedMsg && (
        <Alert severity="success" sx={{ mb: 1 }} onClose={() => setReplicatedMsg(null)}>
          {replicatedMsg}
        </Alert>
      )}

      {attachmentsQ.isSuccess && attachments.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Nenhum anexo. Boleto, QR Code Pix, nota ou contrato ficam aqui para consulta.
        </Typography>
      )}

      {attachments.length > 0 && (
        <Stack spacing={0.75}>
          {attachments.map((a) => (
            <Box
              key={a.id}
              sx={{ px: 1, py: 0.75, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MimeIcon mime={a.mime_type} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                    <Chip
                      size="small"
                      variant="outlined"
                      icon={a.attachment_type === 'pix_qrcode' ? <QrCode2RoundedIcon /> : undefined}
                      label={attachmentType.labelOf(a.attachment_type ?? 'outro')}
                    />
                    <Typography variant="body2" noWrap title={a.original_file_name}>
                      {a.original_file_name}
                    </Typography>
                    {a.replicated_from_entry_id && (
                      <Tooltip title="Cópia do anexo enviado em outra parcela desta série">
                        <Chip size="small" variant="outlined" color="info" label="Da série" />
                      </Tooltip>
                    )}
                    {a.pix_dynamic && (
                      <Tooltip title="QR Pix dinâmico: uso único e com validade; pode estar vencido">
                        <Chip size="small" variant="outlined" color="warning" label="Pode expirar" />
                      </Tooltip>
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {formatSize(a.size_bytes)}
                    {a.note ? ` · ${a.note}` : ''}
                  </Typography>
                </Box>
                <Tooltip title="Abrir / baixar">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => openAttachment(a)}
                      disabled={openingId === a.id}
                      aria-label="Abrir anexo"
                    >
                      <DownloadRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                {!readOnly && (
                  <Tooltip title="Excluir">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setToDelete(a)}
                      aria-label="Excluir anexo"
                    >
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              {a.payment_code && (
                <Box
                  sx={{
                    mt: 0.75,
                    ml: 3.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    bgcolor: 'action.selected',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      flex: 1,
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                      userSelect: 'all',
                    }}
                  >
                    {displayCode(a.attachment_type, a.payment_code)}
                  </Typography>
                  <CopyCodeButton
                    code={a.payment_code}
                    label={a.attachment_type === 'boleto' ? 'Copiar linha digitável' : 'Copiar código Pix'}
                  />
                </Box>
              )}
            </Box>
          ))}
        </Stack>
      )}

      {adding && (
        <AddAttachmentDialog
          entryId={entryId}
          file={adding}
          inSeries={inSeries}
          onClose={() => setAdding(null)}
          onDone={(replicatedTo) => {
            setAdding(null)
            setReplicatedMsg(
              replicatedTo > 0 ? `Anexo replicado em ${replicatedTo} parcela(s) futura(s).` : null
            )
            invalidate()
          }}
        />
      )}

      <ConfirmDialog
        open={toDelete != null}
        title="Excluir anexo?"
        description={
          toDelete ? `"${toDelete.original_file_name}" deixará de aparecer neste lançamento.` : undefined
        }
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete)}
        onClose={() => setToDelete(null)}
      />
    </Box>
  )
}
