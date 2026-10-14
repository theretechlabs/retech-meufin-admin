import { MoneyField } from '@/components/fields/MoneyField'
import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Divider,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { AttachFileButton } from '@/components/common/AttachFileButton'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  centsToReais,
  confirmInvoice,
  type InvoiceMetaSuggestion,
  formatCents,
  getExtractionStatus,
  reaisToCents,
  triggerExtraction,
  uploadInvoiceDocument,
  type ConfirmInvoiceItem,
  type CreditCard,
  type ExtractionStatus,
  type PurchaseSuggestion,
} from '../api'
import {
  errorMessage,
  financeKeys,
  SETTLEABLE_STATUS_OPTIONS,
} from '../constants'
import { useExpenseCategories } from '../hooks/useExpenseCategories'
import { ReconciliationDialog } from './ReconciliationDialog'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { LoadingState } from '@/features/health/components/StateViews'

const STEPS = ['Enviar arquivo', 'Ler fatura', 'Revisar', 'Confirmar']

const ACCEPTED = 'application/pdf,image/*'

function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Linha editável (estado local) derivada de uma sugestão de compra. */
type ReviewItem = {
  accepted: boolean
  description: string
  amount: string // REAIS (string editável)
  date: string // "YYYY-MM-DD"
  category: string
  installment_number: number | null
  installment_total: number | null
}

function suggestionToReview(p: PurchaseSuggestion): ReviewItem {
  return {
    accepted: true,
    description: p.description ?? '',
    // toFixed(2) preserva zeros finais: 15070 → "150,70". String(150.7) viraria
    // "150,7" e a máscara do MoneyField (que lê só dígitos) exibiria 15,07.
    amount: centsToReais(p.amount_cents ?? 0).toFixed(2).replace('.', ','),
    date: p.date ?? '',
    category: p.category ?? 'outros',
    installment_number: p.installment_number ?? null,
    installment_total: p.installment_total ?? null,
  }
}

export function ImportInvoiceDialog({
  open,
  cards,
  defaultCardId,
  onClose,
  onConfirmed,
}: {
  open: boolean
  cards: CreditCard[]
  defaultCardId: string
  onClose: () => void
  onConfirmed: (message: string) => void
}) {
  const { activeCategories } = useExpenseCategories()
  const qc = useQueryClient()

  const [step, setStep] = useState(0)
  const [cardId, setCardId] = useState(defaultCardId || (cards[0]?.id ?? ''))
  const [file, setFile] = useState<File | null>(null)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [pdfPassword, setPdfPassword] = useState('')

  // Campos da fatura (passo revisão)
  const [dueDate, setDueDate] = useState(todayIso())
  const [description, setDescription] = useState('')
  const [invoiceStatus, setInvoiceStatus] = useState<'prevista' | 'realizada'>('prevista')

  // Itens em revisão
  const [items, setItems] = useState<ReviewItem[]>([])
  // Agregados extraídos (total a pagar, fatura anterior, créditos)
  const [invoiceMeta, setInvoiceMeta] = useState<InvoiceMetaSuggestion | null>(null)
  // Total a pagar editável (string da máscara); vazio = usar soma dos itens
  const [totalText, setTotalText] = useState('')

  // Conciliação pós-importação: fatura criada cujos cupons de crédito casam.
  const [reconcileInvoiceId, setReconcileInvoiceId] = useState<string | null>(null)

  // ---- Passo 1: upload + trigger extração -------------------------------
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Selecione um arquivo.')
      // Retry (ex.: senha do PDF): reaproveita o documento já enviado.
      let docId = documentId
      if (!docId) {
        const doc = await uploadInvoiceDocument(file, cardId || undefined)
        docId = doc.id
      }
      await triggerExtraction(docId, pdfPassword || undefined)
      return docId
    },
    onSuccess: (docId) => {
      setDocumentId(docId)
      setStep(1)
    },
  })

  // ---- Passo 2: polling do status ---------------------------------------
  const statusQuery = useQuery<ExtractionStatus>({
    queryKey: [...financeKeys.all, 'extraction-status', documentId] as const,
    queryFn: () => getExtractionStatus(documentId as string),
    enabled: step === 1 && Boolean(documentId),
    refetchInterval: (query) => {
      const s = query.state.data?.status
      return s === 'pending' || s === 'processing' ? 2500 : false
    },
  })

  const status = statusQuery.data

  // Quando a extração completa, popula os itens (uma vez) e avança para a revisão.
  // Padrão do React de "ajustar estado durante o render" ao detectar que os dados
  // externos (polling) mudaram — sem efeito e sem loop (guardado por populatedFor).
  const [populatedFor, setPopulatedFor] = useState<string | null>(null)
  if (
    step === 1 &&
    status?.status === 'completed' &&
    documentId &&
    populatedFor !== documentId
  ) {
    setPopulatedFor(documentId)
    setItems((status.purchases ?? []).map(suggestionToReview))
    const meta = status.invoice ?? null
    setInvoiceMeta(meta)
    if (meta?.total_cents && meta.total_cents > 0) {
      setTotalText((meta.total_cents / 100).toFixed(2).replace('.', ','))
    }
    if (!description) {
      setDescription(file?.name?.replace(/\.[^.]+$/, '') || 'Fatura importada')
    }
    setStep(2)
  }

  // ---- Passo 3/4: confirmar ---------------------------------------------
  const acceptedItems = useMemo(() => items.filter((i) => i.accepted), [items])
  const acceptedTotalCents = useMemo(
    () => acceptedItems.reduce((acc, i) => acc + reaisToCents(i.amount), 0),
    [acceptedItems]
  )

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!documentId) throw new Error('Documento inválido.')
      const payloadItems: ConfirmInvoiceItem[] = acceptedItems.map((i) => ({
        description: i.description.trim(),
        amount_cents: reaisToCents(i.amount),
        date: i.date || undefined,
        category: i.category || undefined,
        installment_number: i.installment_number ?? undefined,
        installment_total: i.installment_total ?? undefined,
      }))
      const totalCents = reaisToCents(totalText)
      return confirmInvoice(documentId, {
        card_id: cardId || undefined,
        due_date: dueDate,
        description: description.trim() || 'Fatura importada',
        status: invoiceStatus,
        // Total a pagar informado; vazio = soma dos itens (comportamento padrão)
        amount_cents: totalCents > 0 ? totalCents : undefined,
        items: payloadItems,
      })
    },
    onSuccess: (invoice) => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
      // CTA educativo: usuário novo entende que o sistema reconheceu o
      // parcelamento e onde acompanhar o compromisso futuro.
      const parceladas = acceptedItems.filter(
        (i) => i.installment_number != null && i.installment_total != null,
      ).length
      const base = `Fatura importada com ${acceptedItems.length} compra(s).`
      onConfirmed(
        parceladas > 0
          ? `${base} ${parceladas} compra(s) parcelada(s) identificada(s) — acompanhe o compromisso futuro na tela Parcelamentos.`
          : base,
      )
      // Abre a conciliação: cupons de crédito que casam com estas compras.
      if (invoice?.id) setReconcileInvoiceId(invoice.id)
      else onClose()
    },
  })

  const setItem = (index: number, patch: Partial<ReviewItem>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))

  const pending = uploadMutation.isPending || confirmMutation.isPending
  const failed = status?.status === 'failed'

  return (
    <>
      {reconcileInvoiceId && (
        <ReconciliationDialog
          open
          invoiceEntryId={reconcileInvoiceId}
          onClose={() => {
            setReconcileInvoiceId(null)
            onClose()
          }}
        />
      )}
      <Dialog open={open} maxWidth="md" fullWidth>
      {/* Fecha SÓ pelo botão: a extração custa tokens de LLM e clique fora /
          Esc acidental descartaria a revisão inteira. */}
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Importar fatura (PDF)
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
              label="Cartão"
              emptyLabel="Sem cartão"
              value={cardId}
              onChange={setCardId}
              options={cards.map((c) => ({ value: c.id, label: c.name }))}
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
              helperText="A maioria das faturas abre sem senha — deixe em branco. Quando o banco protege o PDF, a senha costuma ser os primeiros dígitos do seu CPF ou CNPJ (ex.: 4 primeiros do CNPJ). Usada só na leitura; não fica salva."
            />
            <Typography variant="caption" color="text.secondary">
              Aceita PDF ou imagem (JPG/PNG). O conteúdo será lido por IA para sugerir as compras.
            </Typography>
          </Box>
        )}

        {/* ---------------- Passo 2: lendo ---------------- */}
        {step === 1 && (
          <Box>
            {failed ? (
              <Alert severity="error">
                {status?.error_message ||
                  'Falha ao ler a fatura. Tente novamente ou lance manualmente.'}
              </Alert>
            ) : statusQuery.isError ? (
              <Alert severity="warning">
                {errorMessage(
                  statusQuery.error,
                  'Extração LLM não configurada; lance manualmente ou configure a env.'
                )}
              </Alert>
            ) : (
              <LoadingState label="Lendo a fatura…" />
            )}
          </Box>
        )}

        {/* ---------------- Passo 3: revisão ---------------- */}
        {step === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {confirmMutation.isError && (
              <Alert severity="error">{errorMessage(confirmMutation.error)}</Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                type="date"
                label="Vencimento"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 180 }}
              />
              <TextField
                label="Descrição da fatura"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                sx={{ flex: 1, minWidth: 220 }}
              />
              <AutocompleteField
                label="Status"
                fullWidth={false}
                sx={{ minWidth: 200 }}
                value={invoiceStatus}
                onChange={(v) => setInvoiceStatus(v as 'prevista' | 'realizada')}
                options={SETTLEABLE_STATUS_OPTIONS}
                disableClearable
              />
            </Box>

            {items.length === 0 ? (
              <Alert severity="info">
                Nenhuma compra foi identificada na fatura. Você pode fechar e lançar manualmente.
              </Alert>
            ) : (
              <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" />
                      <TableCell>Descrição</TableCell>
                      <TableCell sx={{ width: 140 }} align="right">
                        Valor
                      </TableCell>
                      <TableCell sx={{ width: 150 }}>Data</TableCell>
                      <TableCell sx={{ width: 160 }}>Categoria</TableCell>
                      <TableCell sx={{ width: 90 }}>Parcela</TableCell>
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
                          <TextField
                            variant="standard"
                            fullWidth
                            value={it.description}
                            onChange={(e) => setItem(idx, { description: e.target.value })}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <MoneyField
                            variant="standard"
                            value={it.amount}
                            onChange={(e) => setItem(idx, { amount: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            variant="standard"
                            type="date"
                            value={it.date}
                            onChange={(e) => setItem(idx, { date: e.target.value })}
                            InputLabelProps={{ shrink: true }}
                          />
                        </TableCell>
                        <TableCell>
                          <AutocompleteField
                            label=""
                            size="small"
                            value={it.category}
                            onChange={(v) => setItem(idx, { category: v })}
                            options={activeCategories.map((cat) => ({
                              value: cat.slug,
                              label: cat.name,
                              description: cat.group_name,
                            }))}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <TextField
                              variant="standard"
                              type="number"
                              value={it.installment_number ?? ''}
                              onChange={(e) =>
                                setItem(idx, {
                                  installment_number: e.target.value
                                    ? Math.max(1, Math.trunc(Number(e.target.value)))
                                    : null,
                                })
                              }
                              inputProps={{ min: 1, style: { width: 34, textAlign: 'center' } }}
                              placeholder="nº"
                            />
                            <span>/</span>
                            <TextField
                              variant="standard"
                              type="number"
                              value={it.installment_total ?? ''}
                              onChange={(e) =>
                                setItem(idx, {
                                  installment_total: e.target.value
                                    ? Math.max(1, Math.trunc(Number(e.target.value)))
                                    : null,
                                })
                              }
                              inputProps={{ min: 1, style: { width: 34, textAlign: 'center' } }}
                              placeholder="total"
                            />
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Divider />
            <Typography variant="body2" color="text.secondary">
              {acceptedItems.length} de {items.length} compra(s) selecionada(s). Soma:{' '}
              <strong>{formatCents(acceptedTotalCents)}</strong>
            </Typography>

            <MoneyField
              label="Total da fatura (a pagar)"
              value={totalText}
              onChange={(e) => setTotalText(e.target.value)}
              sx={{ maxWidth: 280 }}
              helperText="Vazio = soma das compras. Em faturas com créditos/pagamentos, use o valor do boleto."
            />

            {(invoiceMeta?.credits?.length ?? 0) > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Pagamentos e créditos do ciclo (não viram lançamentos)
                </Typography>
                {invoiceMeta!.credits.map((c, i) => (
                  <Typography key={i} variant="body2" color="text.secondary">
                    {c.date ? `${c.date.slice(8, 10)}/${c.date.slice(5, 7)} — ` : ''}
                    {c.description}: −{formatCents(c.amount_cents)}
                  </Typography>
                ))}
                {(() => {
                  const creditsSum = invoiceMeta!.credits.reduce(
                    (acc, c) => acc + c.amount_cents,
                    0,
                  )
                  const prev = invoiceMeta?.previous_balance_cents ?? 0
                  const expected = prev - creditsSum + acceptedTotalCents
                  const informed = reaisToCents(totalText)
                  const closes = informed > 0 && Math.abs(expected - informed) < 100
                  return (
                    <Alert severity={closes ? 'success' : 'warning'} sx={{ mt: 1, py: 0.5 }}>
                      Fatura anterior {formatCents(prev)} − créditos {formatCents(creditsSum)} +
                      compras {formatCents(acceptedTotalCents)} ={' '}
                      <strong>{formatCents(expected)}</strong>
                      {closes
                        ? ' — bate com o total informado.'
                        : informed > 0
                          ? ` — difere do total informado (${formatCents(informed)}). Confira itens e créditos.`
                          : ' — informe o total a pagar acima.'}
                    </Alert>
                  )
                })()}
              </Box>
            )}
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
            disabled={!file || uploadMutation.isPending}
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
            disabled={acceptedItems.length === 0 || !dueDate || confirmMutation.isPending}
          >
            Confirmar
          </Button>
        )}
      </DialogActions>
      </Dialog>
    </>
  )
}
