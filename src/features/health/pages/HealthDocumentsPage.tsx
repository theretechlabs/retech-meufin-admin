import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  Chip,
  Divider,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { AttachFileButton } from "@/components/common/AttachFileButton";
import { AutocompleteField } from "@/components/fields/AutocompleteField";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import FolderSharedRoundedIcon from "@mui/icons-material/FolderSharedRounded";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteDocument,
  getDocumentDownloadUrl,
  listDocumentsPaged,
  listFamilyMembers,
  uploadDocument,
  type HealthDocument,
} from "../api";
import { errorMessage, healthKeys } from "../constants";
import { useCatalog } from "@/lib/catalogs/useCatalog";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TablePaginationBR } from "@/components/tables/TablePaginationBR";
import { useToast } from "@/providers/ToastProvider";
import { formatDateTimeBR } from "@/utils/dates";

function formatSize(bytes?: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Rótulo discreto de grupo dentro do card de filtros. */
function GroupLabel({ children }: { children: string }) {
  return (
    <Typography
      variant="caption"
      sx={{
        display: "block",
        mb: 1,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "text.secondary",
      }}
    >
      {children}
    </Typography>
  );
}

/**
 * Documentos de saúde: tudo que foi enviado (laudos, radiografias, PDFs),
 * com filtros por membro/tipo, visualização (URL temporária) e upload direto
 * (sem extração — para anexos como imagens de ressonância/radiografia).
 *
 * Layout responsivo: filtros e upload em grid (campos ocupam a célula inteira,
 * nunca encolhem); no celular a tabela vira lista de cards.
 */
export default function HealthDocumentsPage() {
  const qc = useQueryClient();
  const { show } = useToast();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const documentType = useCatalog("health.document_type");
  const [memberId, setMemberId] = useState("");
  const [docType, setDocType] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [toDelete, setToDelete] = useState<HealthDocument | null>(null);
  const [uploadType, setUploadType] = useState("image_report");

  const { data: members = [] } = useQuery({
    queryKey: healthKeys.familyMembers(),
    queryFn: listFamilyMembers,
  });

  const params = useMemo(
    () => ({
      family_member_id: memberId || undefined,
      document_type: docType || undefined,
      limit: pageSize,
      offset: page * pageSize,
    }),
    [memberId, docType, page, pageSize],
  );
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [...healthKeys.documents(), "page", params] as const,
    queryFn: () => listDocumentsPaged(params),
  });
  const docs = data?.items ?? [];

  const memberName = (id?: string | null) =>
    members.find((m) => m.id === id)?.full_name ?? "—";

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      form.append("document_type", uploadType);
      if (memberId) form.append("family_member_id", memberId);
      return uploadDocument(form);
    },
    onSuccess: () => {
      show("Documento enviado.");
      qc.invalidateQueries({ queryKey: healthKeys.documents() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      show("Documento excluído.");
      setToDelete(null);
      qc.invalidateQueries({ queryKey: healthKeys.documents() });
    },
  });

  const view = async (doc: HealthDocument) => {
    const { url } = await getDocumentDownloadUrl(doc.id);
    window.open(url, "_blank", "noopener");
  };

  const fileName = (d: HealthDocument) =>
    d.original_file_name || d.file_name || "—";

  const typeChip = (d: HealthDocument) => (
    <Chip
      size="small"
      variant="outlined"
      label={documentType.labelOf(d.document_type)}
    />
  );
  const linkChip = (d: HealthDocument) =>
    d.exam_result_id ? (
      <Chip
        size="small"
        color="success"
        variant="outlined"
        label="anexado a exame"
      />
    ) : null;

  const actions = (d: HealthDocument) => (
    <Stack
      direction="row"
      spacing={0.5}
      justifyContent="flex-end"
      flexShrink={0}
    >
      <Tooltip title="Visualizar / baixar">
        <IconButton size="small" onClick={() => view(d)}>
          <OpenInNewRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Excluir">
        <IconButton size="small" color="error" onClick={() => setToDelete(d)}>
          <DeleteOutlineRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  return (
    <>
      <PageHeader
        title="Documentos"
        subtitle="Laudos, radiografias e arquivos de saúde enviados — visualize, organize e anexe aos exames."
      />

      <Card sx={{ p: { xs: 2, md: 2.5 }, mb: 2.5 }}>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 2.5, md: 3 },
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) auto" },
            alignItems: "start",
          }}
        >
          <Box>
            <GroupLabel>Filtrar</GroupLabel>
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                },
              }}
            >
              <AutocompleteField
                label="Membro"
                size="small"
                emptyLabel="Todos"
                value={memberId}
                onChange={(v) => {
                  setMemberId(v);
                  setPage(0);
                }}
                options={members.map((m) => ({
                  value: m.id,
                  label: m.full_name,
                }))}
              />
              <AutocompleteField
                label="Tipo"
                size="small"
                emptyLabel="Todos"
                value={docType}
                onChange={(v) => {
                  setDocType(v);
                  setPage(0);
                }}
                options={documentType.options}
                loading={documentType.isLoading}
              />
            </Box>
          </Box>

          <Divider sx={{ display: { md: "none" } }} />

          <Box
            sx={{
              pl: { md: 3 },
              borderLeft: { md: "1px solid" },
              borderColor: { md: "divider" },
            }}
          >
            <GroupLabel>Enviar arquivo</GroupLabel>
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "minmax(0, 1fr) auto",
                  md: "240px auto",
                },
                alignItems: "center",
              }}
            >
              <AutocompleteField
                label="Tipo do upload"
                size="small"
                value={uploadType}
                onChange={setUploadType}
                options={documentType.options}
                loading={documentType.isLoading}
                disableClearable
              />
              <AttachFileButton
                fullWidth={false}
                label="Enviar arquivo"
                accept="application/pdf,image/jpeg,image/png"
                loading={uploadMutation.isPending}
                onFiles={(picked) => uploadMutation.mutate(picked[0])}
              />
            </Box>
          </Box>
        </Box>

        {uploadMutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorMessage(uploadMutation.error)}
          </Alert>
        )}
        {memberId === "" && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1.5, display: "block" }}
          >
            Dica: selecione um membro antes de enviar para o arquivo já ficar
            vinculado a ele.
          </Typography>
        )}
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : docs.length === 0 ? (
        <EmptyState
          icon={<FolderSharedRoundedIcon />}
          title="Nenhum documento"
          description="Envie laudos e imagens de exames, ou importe um exame por PDF — os arquivos aparecem aqui."
        />
      ) : (
        <Card>
          {isMobile ? (
            <Stack divider={<Divider />}>
              {docs.map((d) => (
                <Box key={d.id} sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        flex: 1,
                        minWidth: 0,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {fileName(d)}
                    </Typography>
                    {actions(d)}
                  </Stack>
                  <Stack
                    direction="row"
                    spacing={1}
                    flexWrap="wrap"
                    useFlexGap
                    sx={{ mt: 1 }}
                  >
                    {typeChip(d)}
                    {linkChip(d)}
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 1 }}
                  >
                    {memberName(d.family_member_id)} ·{" "}
                    {formatSize(d.size_bytes)} ·{" "}
                    {formatDateTimeBR(d.created_at)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Arquivo</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Membro</TableCell>
                    <TableCell>Vínculo</TableCell>
                    <TableCell>Tamanho</TableCell>
                    <TableCell>Enviado em</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {docs.map((d) => (
                    <TableRow key={d.id} hover>
                      <TableCell sx={{ fontWeight: 600, maxWidth: 280 }}>
                        <Typography
                          variant="body2"
                          noWrap
                          title={d.original_file_name ?? ""}
                        >
                          {fileName(d)}
                        </Typography>
                      </TableCell>
                      <TableCell>{typeChip(d)}</TableCell>
                      <TableCell>{memberName(d.family_member_id)}</TableCell>
                      <TableCell>
                        {linkChip(d) ?? (
                          <Typography variant="caption" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{formatSize(d.size_bytes)}</TableCell>
                      <TableCell>{formatDateTimeBR(d.created_at)}</TableCell>
                      <TableCell align="right">{actions(d)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <TablePaginationBR
            total={data?.total ?? 0}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir documento"
        description={`Tem certeza que deseja excluir "${toDelete?.original_file_name ?? "este documento"}"? O arquivo será removido do armazenamento.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
