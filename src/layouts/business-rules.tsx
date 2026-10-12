import type { SvgIconComponent } from '@mui/icons-material'
import BiotechRoundedIcon from '@mui/icons-material/BiotechRounded'
import MonitorHeartRoundedIcon from '@mui/icons-material/MonitorHeartRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded'
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded'

/**
 * Registro central de REGRAS DE NEGÓCIO complexas/críticas, exibidas na UI
 * via popover no ícone ⓘ ao lado do item de menu (padrão BioPass).
 *
 * Texto limpo e direto ao ponto. Uma entrada por chave (`info` do item de menu).
 */

export type BusinessRuleBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; text: string }
  | { type: 'callout'; tone: 'info' | 'warning'; title: string; text: string }

export type BusinessRule = {
  title: string
  icon?: SvgIconComponent
  blocks: BusinessRuleBlock[]
}

export const businessRules: Record<string, BusinessRule> = {
  'health.markers': {
    title: 'Catálogo de exames sem duplicatas',
    icon: BiotechRoundedIcon,
    blocks: [
      {
        type: 'paragraph',
        text: 'Cada marcador (glicose, hematócrito, ferritina…) tem identidade única no catálogo. É isso que mantém o histórico correto ao longo do tempo.',
      },
      {
        type: 'callout',
        tone: 'warning',
        title: 'Por que não pode duplicar',
        text: 'Se “Glicose” e “glicemia” virassem 2 cadastros, o gráfico de evolução se quebraria em séries separadas — histórico inútil.',
      },
      {
        type: 'list',
        items: [
          'O nome é normalizado (sem acento/maiúscula) e comparado a nomes e apelidos existentes.',
          'Igual → bloqueia e sugere o marcador existente.',
          'Parecido → alerta antes de criar (fuzzy).',
          'Catálogo base compartilhado + os marcadores do seu workspace.',
        ],
      },
    ],
  },
  'health.results': {
    title: 'Referência varia por laboratório',
    icon: MonitorHeartRoundedIcon,
    blocks: [
      {
        type: 'paragraph',
        text: 'A faixa de referência muda entre labs (método, equipamento, população). Guardamos a referência de cada resultado, não uma global.',
      },
      {
        type: 'list',
        items: [
          'Padronizados (hematócrito, glicose): valor comparável → 1 gráfico absoluto com todos os labs.',
          'Dependentes de método (ferritina, vitamina D): o padrão é o modo normalizado.',
        ],
      },
      {
        type: 'code',
        text: "x' = 2·(x − min) / (max − min) − 1",
      },
      {
        type: 'paragraph',
        text: 'O modo normalizado põe cada ponto na posição da própria referência — assim dá para comparar labs diferentes num gráfico só.',
      },
    ],
  },
  'finance.income': {
    title: 'Receita lança-se bruta; o tipo carrega a semântica',
    icon: PaymentsRoundedIcon,
    blocks: [
      {
        type: 'callout',
        tone: 'info',
        title: 'Os cards seguem o VENCIMENTO, como a lista',
        text: '"Receitas do mês", "Recebido" e "A receber" olham o que vence no mês escolhido. "Entrou no caixa" é o outro eixo: tudo que foi recebido dentro do mês, mesmo vencendo em outro — o mesmo número da dashboard. Os cards somam o mês inteiro e respeitam mês, ano e membro; os demais filtros só afetam a lista.',
      },
      {
        type: 'paragraph',
        text: 'Receita entra sempre pelo valor BRUTO do contrato. Desconto na origem (ex.: equipamento comprado pela empresa e abatido do repasse) vira uma despesa espelhada na mesma data — o líquido aparece no saldo, e as três verdades se preservam: quanto você fatura, pra onde foi o dinheiro e o rastro do bem.',
      },
      {
        type: 'callout',
        tone: 'warning',
        title: 'Nunca lance o líquido',
        text: 'Lançar só o que caiu na conta esconde o desconto: o equipamento some do gráfico de categorias e seu faturamento real fica subestimado para qualquer análise futura.',
      },
      {
        type: 'list',
        items: [
          'O TIPO é curado pelo sistema (não é cadastro livre) — é ele que permite os indicadores futuros: composição ativa × passiva, sazonalidade na projeção e inteligência fiscal.',
          'CLT usa Salário; PJ usa Remuneração PJ (contrato); retirada de sócio usa Pró-labore ou Dividendos — tratamentos fiscais diferentes.',
          'Ao escolher a Fonte, o tipo é sugerido automaticamente pela natureza dela (pode trocar).',
          'Reembolso não é renda (é estorno) — fica fora dos indicadores de composição.',
          '13º/Férias e Freela são sazonais — a projeção anual não os lineariza.',
        ],
      },
    ],
  },
  'finance.expenses': {
    title: 'Cards, parcelas, retroativos e recorrências',
    icon: TrendingDownRoundedIcon,
    blocks: [
      {
        type: 'callout',
        tone: 'info',
        title: 'Os cards seguem o VENCIMENTO, como a lista',
        text: '"Contas do mês", "Pago" e "A pagar" olham o que vence no mês escolhido: total sem canceladas, quanto disso já foi pago (pelo valor pago) e quanto está em aberto. "Saiu do caixa" é o outro eixo: tudo que foi pago dentro do mês, mesmo vencendo em outro — o mesmo número da dashboard.',
      },
      {
        type: 'list',
        items: [
          'Os cards respeitam mês, ano e membro. Status, categoria e busca filtram só a lista.',
          'Os cards somam o mês inteiro, não só a página visível.',
          'Isenção total (desconto igual ao valor) conta como paga com valor zero.',
        ],
      },
      {
        type: 'callout',
        tone: 'warning',
        title: 'Parcelado: o valor é DA PARCELA',
        text: 'Em despesa parcelada, informe o valor de cada parcela (o aviso mostra a conta: N× valor = total). O sistema clona esse valor em cada parcela — nunca digite o total.',
      },
      {
        type: 'list',
        items: [
          'Lançamento retroativo (ex.: financiamento começado ano passado): marque "vencidos foram pagos" e as parcelas até hoje nascem realizadas.',
          'Parcelas cruzam o ano até quitar (15× em outubro vai até dezembro do ano seguinte).',
          'Recorrentes mantêm sempre 12 meses de previstos à frente (o sistema completa o horizonte diariamente).',
          'Para ENCERRAR uma recorrência: cancele a ocorrência mais recente — o sistema para de gerar novas.',
          'Excluir ocorrências futuras de recorrência ativa não encerra: elas são recriadas pelo horizonte automático.',
        ],
      },
    ],
  },
  'finance.categories': {
    title: 'Categorias em duas camadas',
    icon: CategoryRoundedIcon,
    blocks: [
      {
        type: 'paragraph',
        text: 'Categoria é sua: crie, renomeie e arquive à vontade (Pets, Escola do João, Viagens...). Grupo é do sistema: fixo, e é por ele que os indicadores agregam — liberdade total sem bagunçar os números.',
      },
      {
        type: 'list',
        items: [
          'Toda categoria pertence a exatamente um grupo (Moradia, Alimentação, Transporte, Saúde...).',
          'Renomear categoria não altera o histórico — o vínculo é interno, o nome é só rótulo.',
          '"Outros" não pode ser removida: é o destino de tudo que chega sem categoria conhecida (ex.: importação de fatura).',
          'A importação por LLM só sugere categorias que existem no seu cadastro.',
        ],
      },
    ],
  },
  'finance.dashboard': {
    title: 'Como os números da dashboard são calculados',
    icon: InsightsRoundedIcon,
    blocks: [
      {
        type: 'paragraph',
        text: 'A dashboard responde 4 perguntas: como estou este mês, o que ainda vem, pra onde foi o dinheiro e quanto do futuro já está comprometido.',
      },
      {
        type: 'callout',
        tone: 'warning',
        title: 'Fatura de cartão não duplica',
        text: 'A fatura entra pelo total; as compras dentro dela ficam de fora dos totais. Já no gráfico de categorias é o contrário: valem as compras (com a categoria real de cada uma), não a fatura.',
      },
      {
        type: 'callout',
        tone: 'info',
        title: 'Dois eixos: caixa e competência',
        text: 'O número grande dos cards "Saiu/Entrou do caixa no mês" é CAIXA: o que foi pago ou recebido dentro do mês, não importa quando vencia. A legenda embaixo é COMPETÊNCIA: quanto vence no mês e quanto ainda está em aberto. Uma parcela de dezembro paga em agosto conta no caixa de agosto e no "vence" de dezembro.',
      },
      {
        type: 'list',
        items: [
          'Caixa usa o valor efetivamente pago (juros, multa e desconto contam; isenção total conta zero).',
          'Vence no mês = previstas + realizadas que vencem no mês (canceladas fora).',
          'A pagar / A receber = o que vence no mês e ainda está previsto.',
          'Liquidação por compensação (ex.: usado abatido na troca) fica fora do caixa: nenhum dinheiro passou.',
          'Parcelas futuras somam parcelas previstas que vencem após o mês selecionado.',
          'Os mesmos números aparecem nos cards de Despesas e Receitas — vêm da mesma fonte.',
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        title: 'Filtro por membro',
        text: 'Faturas de cartão não têm membro atribuído — com o filtro de membro ativo, elas (e suas compras) saem da conta.',
      },
    ],
  },
  'finance.payables': {
    title: 'Liquidação: pagar/receber com rastro',
    icon: TaskAltRoundedIcon,
    blocks: [
      {
        type: 'paragraph',
        text: 'Liquidar registra QUANDO, QUANTO e COMO o lançamento foi pago (ou recebido): forma de pagamento, conta ou cartão e comprovantes.',
      },
      {
        type: 'list',
        items: [
          'O valor pago pode diferir do previsto — juros, multa ou desconto. Guardamos os dois.',
          'Liquidar uma fatura de cartão liquida todas as compras dentro dela (cascata). Cancelar idem.',
          'Pix, débito, transferência e boleto podem apontar a conta de origem; dinheiro não precisa.',
          'Comprovante aceita PDF, foto (JPG/PNG/HEIC/WebP) e DOC — quantos arquivos quiser.',
        ],
      },
      {
        type: 'callout',
        tone: 'warning',
        title: 'Pagou com cartão de crédito?',
        text: 'A despesa sai agora do status previsto, mas o dinheiro só sai de verdade na fatura do cartão. Registre a compra na fatura também — por enquanto o sistema não faz isso sozinho.',
      },
    ],
  },
  'finance.invoices': {
    title: 'Fatura pai e compras filhas',
    icon: ReceiptLongRoundedIcon,
    blocks: [
      {
        type: 'paragraph',
        text: 'Uma fatura importada vira um lançamento pai (total da fatura) com compras filhas (cada item, com categoria própria).',
      },
      {
        type: 'list',
        items: [
          'Totais e gráficos usam o pai — as filhas não duplicam o valor.',
          'O gráfico de categorias usa as filhas — é nelas que mora a categoria real.',
          'Liquidar/cancelar o pai propaga para as filhas automaticamente.',
          'Parcelas de compras importadas valem só para a fatura atual; as futuras ainda não são geradas automaticamente.',
        ],
      },
    ],
  },
}
