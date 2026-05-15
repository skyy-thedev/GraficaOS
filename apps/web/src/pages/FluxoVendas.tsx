import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import {
  Calculator,
  Clock3,
  CreditCard,
  DollarSign,
  FileSpreadsheet,
  Minus,
  Phone,
  Plus,
  ReceiptText,
  Settings2,
  Sparkles,
  CalendarDays,
  Wallet,
} from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { PricingManagerDialog } from '@/components/pricing/PricingManagerDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useArtes } from '@/hooks/useArtes';
import { useAuth } from '@/hooks/useAuth';
import { usePricingProducts, usePricingSettings } from '@/hooks/usePricing';
import { useCreateVenda, useUpdateVenda, useVendas } from '@/hooks/useVendas';
import type { FormaPagamento, PricingProduct, PricingUrgency, Venda, VendaStatus } from '@/types';
import { extrairNumeroContato, normalizarTexto } from '@/utils/arteAnalytics';
import { calculatePricingPreview, formatPricingCurrency, URGENCY_LABELS } from '@/utils/pricing';

const FORMA_PAGAMENTO_OPTIONS: Array<{ value: FormaPagamento; label: string }> = [
  { value: 'PIX', label: 'Pix' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'DEBITO', label: 'Débito' },
  { value: 'CREDITO', label: 'Crédito' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'TRANSFERENCIA', label: 'Transferência' },
  { value: 'OUTRO', label: 'Outro' },
];

const STATUS_BADGE_VARIANT: Record<VendaStatus, 'warning' | 'success'> = {
  AGUARDANDO: 'warning',
  CONCLUIDA: 'success',
};

type ProductPrimaryType = 'GRAFICA_RAPIDA' | 'COMUNICACAO_VISUAL' | 'BRINDES';

const PRIMARY_PRODUCT_TYPE_OPTIONS: Array<{ value: ProductPrimaryType; label: string; helper: string }> = [
  {
    value: 'GRAFICA_RAPIDA',
    label: 'Gráfica Rápida',
    helper: 'A4, A3, plastificação, sulfite, couchê, vergê, P/B e colorido.',
  },
  {
    value: 'COMUNICACAO_VISUAL',
    label: 'Comunicação Visual',
    helper: 'Banner, flyer, folder, cartões, adesivos e itens promocionais.',
  },
  {
    value: 'BRINDES',
    label: 'Brindes',
    helper: 'Caneca, squeeze, foto, porta-retratos, laser e impressão 3D.',
  },
];

const QTY_PRESETS_COMMON = [50, 100, 250, 500, 1000];

interface ProductGroupDef {
  id: string;
  label: string;
  match: (p: PricingProduct) => boolean;
}

const PRODUCT_GROUP_DEFS: Record<ProductPrimaryType, ProductGroupDef[]> = {
  GRAFICA_RAPIDA: [
    { id: 'GR_IMPRESSAO', label: 'Impressão', match: (p) => /impress[aã]o/i.test(p.name) },
    { id: 'GR_PLASTIFICACAO', label: 'Plastificação', match: (p) => /plastifica/i.test(p.name) },
    { id: 'GR_FOTO', label: 'Foto / Revelação', match: (p) => /foto/i.test(p.name) },
    { id: 'GR_ARTE', label: 'Arte & Design', match: (p) => /arte|qr/i.test(p.name) },
    { id: 'GR_OUTROS', label: 'Outros', match: () => true },
  ],
  COMUNICACAO_VISUAL: [
    { id: 'CV_CARTAO', label: 'Cartão de Visitas', match: (p) => isBusinessCardProduct(p) },
    { id: 'CV_FLYER', label: 'Flyer / Panfleto', match: (p) => /flyer|panfleto/i.test(p.name) },
    { id: 'CV_FOLDER', label: 'Folder', match: (p) => isFolderProduct(p) },
    { id: 'CV_BANNER', label: 'Banner / Lona', match: (p) => isBannerProduct(p) },
    { id: 'CV_ADESIVO', label: 'Adesivo / Placa', match: (p) => /adesivo|placa|faixa/i.test(p.name) },
    { id: 'CV_OUTROS', label: 'Outros', match: () => true },
  ],
  BRINDES: [],
};

const GUIDED_GROUP_IDS = ['GR_IMPRESSAO', 'CV_CARTAO', 'CV_FLYER', 'CV_FOLDER', 'CV_BANNER'];

interface CartItem {
  id: string;
  product: PricingProduct;
  quantity: number;
  finishIds: string[];
  sizeVariationId?: string;
  customWidthMeters?: number;
  customHeightMeters?: number;
  includeArtCreation: boolean;
  artCreationSupported: boolean;
  discountPercent: number;
  urgency: PricingUrgency;
  enableUrgency: boolean;
  preview: ReturnType<typeof calculatePricingPreview>;
  observacoes?: string;
}

const CARD_TABLE_PRODUCT_NAMES = [
  'Couché Brilho 50un',
  'Couché Brilho 100un F/V',
  'Premium 600g 100un',
  'Premium Luxo 250un',
  'Mini Cartão 100un',
  'PVC Premium 50un',
] as const;

const FOLDER_OPTION_TO_PRODUCT_NAME: Record<string, string> = {
  UMA_DOBRA: 'Folder 1 Dobra 500un',
  DUAS_DOBRAS: 'Folder 2 Dobras 1000un',
  SANFONA: 'Folder Sanfona',
  CARTEIRA: 'Folder Carteira',
};

function formatCurrency(value: number) {
  return formatPricingCurrency(value);
}

function getDefaultSizeVariationId(product: Pick<PricingProduct, 'sizeVariations'>) {
  return product.sizeVariations[0]?.id ?? '';
}

function isBannerProduct(product: Pick<PricingProduct, 'name'> | null) {
  return /banner/i.test(product?.name ?? '');
}

function parsePaperVariationName(name: string) {
  const [paperType, grammage] = name.split('|').map((part) => part.trim());
  return {
    paperType: paperType ?? '',
    grammage: grammage ?? '',
  };
}

function hasPaperVariationStructure(product: Pick<PricingProduct, 'sizeVariations'> | null) {
  return (product?.sizeVariations ?? []).some((variation) => variation.name.includes('|'));
}

function supportsCustomCentimeterSize(product: Pick<PricingProduct, 'name'> | null) {
  return /flyer|cart[aã]o|folder/i.test(product?.name ?? '');
}

function isFolderProduct(product: Pick<PricingProduct, 'name'> | null) {
  return /folder/i.test(product?.name ?? '');
}

function isBusinessCardProduct(product: Pick<PricingProduct, 'name' | 'legacyProdutoTipo'> | null) {
  return product?.legacyProdutoTipo === 'CARTAO_VISITA' || /cart[aã]o|pvc|couché|premium.*un|mini.*un/i.test(product?.name ?? '');
}

function supportsProfessionalArtCreation(product: Pick<PricingProduct, 'name' | 'legacyProdutoTipo'> | null) {
  return isBusinessCardProduct(product) || /banner|flyer/i.test(product?.name ?? '');
}

function getArtCreationLabel(product: Pick<PricingProduct, 'name' | 'legacyProdutoTipo'> | null) {
  return isBusinessCardProduct(product)
    ? 'Adicionar criação de arte profissional (+R$ 120,00)'
    : 'Adicionar criação de arte profissional (+R$ 60,00)';
}

function formatDimensionLabel(width?: string, height?: string) {
  if (!width || !height) return null;
  return `${width} × ${height}`;
}

function resolvePrimaryProductType(product: Pick<PricingProduct, 'name' | 'category' | 'premiumCategory' | 'legacyProdutoTipo'>): ProductPrimaryType {
  const label = `${product.name} ${product.category} ${product.premiumCategory ?? ''}`.toLowerCase();

  if (/foto|caneca|squeeze|porta.?retratos?|laser|3d|brinde/.test(label)) {
    return 'BRINDES';
  }

  if (
    /banner|flyer|folder|cart[aã]o|adesivo|logo|logotipo|placa|faixa|lona|backlight|perfurado|envelopamento/.test(label)
    || ['BANNER', 'ADESIVO', 'ADESIVO_RECORTE', 'LONA', 'PLACA', 'FAIXA', 'CARTAO_VISITA', 'PANFLETO', 'FOLDER', 'PERFURADO', 'ENVELOPAMENTO', 'BACKLIGHT'].includes(product.legacyProdutoTipo ?? '')
  ) {
    return 'COMUNICACAO_VISUAL';
  }

  return 'GRAFICA_RAPIDA';
}

export function FluxoVendasPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { data: vendas } = useVendas();
  const { data: artes } = useArtes();
  const { data: pricingProducts } = usePricingProducts();
  const { data: pricingSettings } = usePricingSettings();
  const createVenda = useCreateVenda();
  const updateVenda = useUpdateVenda();

  const [isPricingDialogOpen, setIsPricingDialogOpen] = useState(false);
  const [selectedProductType, setSelectedProductType] = useState<ProductPrimaryType>('GRAFICA_RAPIDA');
  const [form, setForm] = useState({
    clienteNome: '',
    clienteDocumento: '',
    clienteTelefone: '',
    pricingProductId: '',
    quantidade: 1,
    sizeVariationId: '',
    paperType: '',
    paperGrammage: '',
    customWidthMeters: '',
    customHeightMeters: '',
    customWidthCm: '',
    customHeightCm: '',
    folderOption: 'DUAS_DOBRAS',
    enableUrgency: false,
    urgency: 'PRIORITARIO' as PricingUrgency,
    enableFinishes: false,
    includeArtCreation: false,
    finishIds: [] as string[],
    formaPagamento: '' as '' | FormaPagamento,
    observacoes: '',
    discountPercent: 0,
  });
  const [showClienteSuggestions, setShowClienteSuggestions] = useState(false);
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, FormaPagamento | ''>>({});
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedProductGroup, setSelectedProductGroup] = useState<string | null>(null);
  const [impressaoSize, setImpressaoSize] = useState('A4');
  const [impressaoColor, setImpressaoColor] = useState<'PB' | 'COLORIDO'>('PB');

  const activeProducts = useMemo(
    () => (pricingProducts ?? []).filter((product) => product.active),
    [pricingProducts],
  );

  const cardTableProducts = useMemo(() => {
    const preferredOrder = new Map<string, number>(CARD_TABLE_PRODUCT_NAMES.map((name, index) => [name, index]));

    return activeProducts
      .filter((product) => preferredOrder.has(product.name))
      .sort((first, second) => {
        const firstOrder = preferredOrder.get(first.name) ?? Number.MAX_SAFE_INTEGER;
        const secondOrder = preferredOrder.get(second.name) ?? Number.MAX_SAFE_INTEGER;
        return firstOrder - secondOrder || first.sortOrder - second.sortOrder;
      });
  }, [activeProducts]);

  const productsByPrimaryType = useMemo(() => ({
    GRAFICA_RAPIDA: activeProducts.filter((product) => resolvePrimaryProductType(product) === 'GRAFICA_RAPIDA'),
    COMUNICACAO_VISUAL: activeProducts.filter((product) => resolvePrimaryProductType(product) === 'COMUNICACAO_VISUAL'),
    BRINDES: activeProducts.filter((product) => resolvePrimaryProductType(product) === 'BRINDES'),
  }), [activeProducts]);

  const typedProductOptions = productsByPrimaryType[selectedProductType] ?? [];

  const productGroupsForCategory = useMemo((): ProductGroupDef[] => {
    if (selectedProductType === 'BRINDES') return [];
    const defs = PRODUCT_GROUP_DEFS[selectedProductType] ?? [];
    const productsForType = productsByPrimaryType[selectedProductType] ?? [];
    const result: ProductGroupDef[] = [];
    const matchedIds = new Set<string>();
    for (const def of defs) {
      if (def.id === 'GR_OUTROS' || def.id === 'CV_OUTROS') {
        const unmatched = productsForType.filter((p) => !matchedIds.has(p.id));
        if (unmatched.length > 0) result.push(def);
      } else {
        const matching = productsForType.filter((p) => def.match(p));
        if (matching.length > 0) {
          result.push(def);
          matching.forEach((p) => matchedIds.add(p.id));
        }
      }
    }
    return result;
  }, [selectedProductType, productsByPrimaryType]);

  const groupProducts = useMemo((): PricingProduct[] => {
    if (!selectedProductGroup) return [];
    const productsForType = productsByPrimaryType[selectedProductType] ?? [];
    const defs = PRODUCT_GROUP_DEFS[selectedProductType] ?? [];
    if (selectedProductGroup === 'GR_OUTROS' || selectedProductGroup === 'CV_OUTROS') {
      const otherDefs = defs.filter((d) => d.id !== selectedProductGroup);
      return productsForType.filter((p) => !otherDefs.some((d) => d.match(p)));
    }
    const def = defs.find((d) => d.id === selectedProductGroup);
    return def ? productsForType.filter((p) => def.match(p)) : [];
  }, [selectedProductGroup, selectedProductType, productsByPrimaryType]);

  const impressaoSizesAvailable = useMemo(() => {
    const grProducts = (productsByPrimaryType.GRAFICA_RAPIDA ?? []).filter((p) => /impress[aã]o/i.test(p.name));
    return [...new Set(
      grProducts.map((p) => { const m = p.name.match(/\b(A\d+)\b/i); return m?.[1]?.toUpperCase() ?? null; })
        .filter((s): s is string => s !== null),
    )];
  }, [productsByPrimaryType.GRAFICA_RAPIDA]);

  const impressaoColorsAvailable = useMemo((): Array<'PB' | 'COLORIDO'> => {
    const grProducts = (productsByPrimaryType.GRAFICA_RAPIDA ?? []).filter((p) => /impress[aã]o/i.test(p.name));
    const colors: Array<'PB' | 'COLORIDO'> = [];
    if (grProducts.some((p) => /\bpb\b|preto/i.test(p.name))) colors.push('PB');
    if (grProducts.some((p) => /colorido/i.test(p.name))) colors.push('COLORIDO');
    return colors;
  }, [productsByPrimaryType.GRAFICA_RAPIDA]);

  const selectedProduct = useMemo(
    () => activeProducts.find((product) => product.id === form.pricingProductId) ?? null,
    [activeProducts, form.pricingProductId],
  );

  const productSupportsPaperSelection = useMemo(
    () => hasPaperVariationStructure(selectedProduct),
    [selectedProduct],
  );

  const bannerProductSelected = useMemo(
    () => isBannerProduct(selectedProduct),
    [selectedProduct],
  );

  const centimeterSizeEnabled = useMemo(
    () => supportsCustomCentimeterSize(selectedProduct),
    [selectedProduct],
  );

  const folderProductSelected = useMemo(
    () => isFolderProduct(selectedProduct),
    [selectedProduct],
  );

  const businessCardProductSelected = useMemo(
    () => isBusinessCardProduct(selectedProduct),
    [selectedProduct],
  );

  const artCreationSupported = useMemo(
    () => supportsProfessionalArtCreation(selectedProduct),
    [selectedProduct],
  );

  const flyerProductSelected = useMemo(
    () => /flyer/i.test(selectedProduct?.name ?? ''),
    [selectedProduct],
  );

  const folderProducts = useMemo(
    () => productsByPrimaryType.COMUNICACAO_VISUAL.filter((product) => isFolderProduct(product)),
    [productsByPrimaryType],
  );

  const paperOptions = useMemo(() => {
    if (!selectedProduct) return [];

    return Array.from(new Set(
      selectedProduct.sizeVariations
        .map((variation) => parsePaperVariationName(variation.name).paperType)
        .filter(Boolean),
    ));
  }, [selectedProduct]);

  const grammageOptions = useMemo(() => {
    if (!selectedProduct || !productSupportsPaperSelection) return [];

    return selectedProduct.sizeVariations
      .map((variation) => ({
        variationId: variation.id,
        ...parsePaperVariationName(variation.name),
      }))
      .filter((variation) => variation.paperType === form.paperType)
      .map((variation) => variation.grammage)
      .filter(Boolean);
  }, [form.paperType, productSupportsPaperSelection, selectedProduct]);

  useEffect(() => {
    if (!productSupportsPaperSelection) return;
    if (!grammageOptions.length) return;
    if (grammageOptions.includes(form.paperGrammage)) return;

    setForm((current) => ({
      ...current,
      paperGrammage: grammageOptions[0] ?? '',
    }));
  }, [form.paperGrammage, grammageOptions, productSupportsPaperSelection]);

  useEffect(() => {
    if (!selectedProduct) return;

    const nextType = resolvePrimaryProductType(selectedProduct);
    setSelectedProductType((current) => current === nextType ? current : nextType);
  }, [selectedProduct]);

  useEffect(() => {
    const productsForType = productsByPrimaryType[selectedProductType] ?? [];
    if (productsForType.length === 0) return;

    if (selectedProduct && resolvePrimaryProductType(selectedProduct) === selectedProductType) {
      return;
    }

    const nextProduct = productsForType[0];
    if (!nextProduct) return;

    setForm((current) => ({
      ...current,
      pricingProductId: nextProduct.id,
      sizeVariationId: getDefaultSizeVariationId(nextProduct),
      finishIds: current.finishIds.filter((finishId) => nextProduct.availableFinishIds.includes(finishId)),
    }));
  }, [productsByPrimaryType, selectedProduct, selectedProductType]);

  useEffect(() => {
    if (!selectedProduct) return;

    setForm((current) => ({
      ...current,
      sizeVariationId: current.sizeVariationId && selectedProduct.sizeVariations.some((variation) => variation.id === current.sizeVariationId)
        ? current.sizeVariationId
        : getDefaultSizeVariationId(selectedProduct),
      paperType: productSupportsPaperSelection
        ? parsePaperVariationName(
          (selectedProduct.sizeVariations.find((variation) => variation.id === (current.sizeVariationId && selectedProduct.sizeVariations.some((item) => item.id === current.sizeVariationId)
            ? current.sizeVariationId
            : getDefaultSizeVariationId(selectedProduct))) ?? selectedProduct.sizeVariations[0])?.name ?? '',
        ).paperType
        : '',
      paperGrammage: productSupportsPaperSelection
        ? parsePaperVariationName(
          (selectedProduct.sizeVariations.find((variation) => variation.id === (current.sizeVariationId && selectedProduct.sizeVariations.some((item) => item.id === current.sizeVariationId)
            ? current.sizeVariationId
            : getDefaultSizeVariationId(selectedProduct))) ?? selectedProduct.sizeVariations[0])?.name ?? '',
        ).grammage
        : '',
      finishIds: current.finishIds.filter((finishId) => selectedProduct.availableFinishIds.includes(finishId)),
      includeArtCreation: supportsProfessionalArtCreation(selectedProduct) ? current.includeArtCreation : false,
      customWidthCm: supportsCustomCentimeterSize(selectedProduct) ? current.customWidthCm : '',
      customHeightCm: supportsCustomCentimeterSize(selectedProduct) ? current.customHeightCm : '',
      folderOption: isFolderProduct(selectedProduct)
        ? (Object.entries(FOLDER_OPTION_TO_PRODUCT_NAME).find(([, productName]) => productName === selectedProduct.name)?.[0] ?? 'DUAS_DOBRAS')
        : 'DUAS_DOBRAS',
    }));
  }, [productSupportsPaperSelection, selectedProduct]);

  useEffect(() => {
    if (!folderProductSelected) return;

    const nextProductName = FOLDER_OPTION_TO_PRODUCT_NAME[form.folderOption];
    const nextProduct = folderProducts.find((product) => product.name === nextProductName);
    if (!nextProduct || nextProduct.id === form.pricingProductId) return;

    setForm((current) => ({
      ...current,
      pricingProductId: nextProduct.id,
      sizeVariationId: getDefaultSizeVariationId(nextProduct),
      finishIds: current.finishIds.filter((finishId) => nextProduct.availableFinishIds.includes(finishId)),
    }));
  }, [folderProductSelected, folderProducts, form.folderOption, form.pricingProductId]);

  useEffect(() => {
    if (!selectedProduct || !productSupportsPaperSelection) return;

    const matchedVariation = selectedProduct.sizeVariations.find((variation) => {
      const parsed = parsePaperVariationName(variation.name);
      return parsed.paperType === form.paperType && parsed.grammage === form.paperGrammage;
    });

    if (matchedVariation && matchedVariation.id !== form.sizeVariationId) {
      setForm((current) => ({
        ...current,
        sizeVariationId: matchedVariation.id,
      }));
    }
  }, [form.paperGrammage, form.paperType, form.sizeVariationId, productSupportsPaperSelection, selectedProduct]);

  // Reset group when product category changes
  useEffect(() => {
    setSelectedProductGroup(null);
  }, [selectedProductType]);

  // Auto-select impressao product when size/color changes
  useEffect(() => {
    if (selectedProductGroup !== 'GR_IMPRESSAO') return;
    const grProducts = (productsByPrimaryType.GRAFICA_RAPIDA ?? []).filter((p) => /impress[aã]o/i.test(p.name));
    const target = grProducts.find((p) => {
      const hasSize = new RegExp(`\\b${impressaoSize}\\b`, 'i').test(p.name);
      const isPB = /\bpb\b|preto/i.test(p.name);
      const isColorido = /colorido/i.test(p.name);
      return hasSize && (impressaoColor === 'PB' ? isPB : isColorido);
    }) ?? grProducts.find((p) => new RegExp(`\\b${impressaoSize}\\b`, 'i').test(p.name)) ?? grProducts[0];
    if (target && target.id !== form.pricingProductId) {
      setForm((c) => ({ ...c, pricingProductId: target.id, sizeVariationId: getDefaultSizeVariationId(target) }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductGroup, impressaoSize, impressaoColor]);

  // Auto-select first product when switching to a group (non-impressao)
  useEffect(() => {
    if (!selectedProductGroup || selectedProductGroup === 'GR_IMPRESSAO') return;
    const first = groupProducts[0];
    if (first && first.id !== form.pricingProductId) {
      setForm((c) => ({
        ...c,
        pricingProductId: first.id,
        sizeVariationId: getDefaultSizeVariationId(first),
        finishIds: c.finishIds.filter((id) => first.availableFinishIds.includes(id)),
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductGroup]);

  const cardTablePreviewMap = useMemo(() => {
    if (!pricingSettings) return new Map<string, ReturnType<typeof calculatePricingPreview>>();

    return new Map(
      cardTableProducts.map((product) => [
        product.id,
        calculatePricingPreview({
          product,
          settings: pricingSettings,
          quantity: 1,
          finishIds: [],
          sizeVariationId: getDefaultSizeVariationId(product) || undefined,
          includeArtCreation: form.includeArtCreation && artCreationSupported,
          urgency: 'NONE',
        }),
      ]),
    );
  }, [artCreationSupported, cardTableProducts, form.includeArtCreation, pricingSettings]);

  const typedProductPreviewMap = useMemo(() => {
    if (!pricingSettings) return new Map<string, ReturnType<typeof calculatePricingPreview>>();

    return new Map(
      typedProductOptions.map((product) => [
        product.id,
        calculatePricingPreview({
          product,
          settings: pricingSettings,
          quantity: form.quantidade,
          finishIds: [],
          sizeVariationId: getDefaultSizeVariationId(product) || undefined,
          customWidthMeters: isBannerProduct(product) ? 1 : undefined,
          customHeightMeters: isBannerProduct(product) ? 1 : undefined,
          urgency: form.enableUrgency && product.urgencyEnabled ? form.urgency : 'NONE',
        }),
      ]),
    );
  }, [form.enableUrgency, form.quantidade, form.urgency, pricingSettings, typedProductOptions]);

  const clientesExistentes = useMemo(() => {
    const mapa = new Map<string, { nome: string; referencia: string; total: number }>();

    for (const arte of artes ?? []) {
      const chave = `${normalizarTexto(arte.clienteNome)}::${extrairNumeroContato(arte.clienteNumero)}`;
      const atual = mapa.get(chave);
      if (atual) {
        atual.total += 1;
      } else {
        mapa.set(chave, {
          nome: arte.clienteNome,
          referencia: arte.clienteNumero,
          total: 1,
        });
      }
    }

    return Array.from(mapa.values()).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
  }, [artes]);

  const clienteSuggestions = useMemo(() => {
    const termo = normalizarTexto(`${form.clienteNome} ${form.clienteDocumento}`);
    if (!termo) return clientesExistentes.slice(0, 6);

    return clientesExistentes
      .filter((cliente) => normalizarTexto(`${cliente.nome} ${cliente.referencia}`).includes(termo))
      .slice(0, 6);
  }, [clientesExistentes, form.clienteDocumento, form.clienteNome]);

  const pricingPreview = useMemo(() => {
    if (!selectedProduct || !pricingSettings) return null;

    return calculatePricingPreview({
      product: selectedProduct,
      settings: pricingSettings,
      quantity: form.quantidade,
      finishIds: form.enableFinishes ? form.finishIds : [],
      sizeVariationId: form.sizeVariationId || undefined,
      customWidthMeters: bannerProductSelected ? Number(form.customWidthMeters || 0) || undefined : undefined,
      customHeightMeters: bannerProductSelected ? Number(form.customHeightMeters || 0) || undefined : undefined,
      includeArtCreation: form.includeArtCreation && artCreationSupported,
      urgency: form.enableUrgency ? form.urgency : 'NONE',
    });
  }, [artCreationSupported, bannerProductSelected, form.customHeightMeters, form.customWidthMeters, form.enableFinishes, form.enableUrgency, form.finishIds, form.includeArtCreation, form.quantidade, form.sizeVariationId, form.urgency, pricingSettings, selectedProduct]);

  const registros = vendas ?? [];
  const minhasVendas = isAdmin ? registros : registros.filter((venda) => venda.responsavelId === user?.id);
  const aguardandoCount = minhasVendas.filter((venda) => venda.status === 'AGUARDANDO').length;
  const concluidasCount = minhasVendas.filter((venda) => venda.status === 'CONCLUIDA').length;
  const totalConcluido = minhasVendas.filter((venda) => venda.status === 'CONCLUIDA').reduce((soma, venda) => soma + venda.valorTotal, 0);
  const ticketMedio = concluidasCount > 0 ? totalConcluido / concluidasCount : 0;
  const vendasDia = minhasVendas.filter((venda) => venda.createdAt.slice(0, 10) === format(new Date(), 'yyyy-MM-dd'));
  const vendasSemana = minhasVendas.filter((venda) => {
    const vendaDate = new Date(venda.createdAt);
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);
    return vendaDate >= monday;
  });
  const vendasMes = minhasVendas.filter((venda) => {
    const vendaDate = new Date(venda.createdAt);
    const now = new Date();
    return vendaDate.getMonth() === now.getMonth() && vendaDate.getFullYear() === now.getFullYear();
  });

  const buildObservacoesPayload = () => {
    const extras: string[] = [];
    const dimensionLabel = formatDimensionLabel(form.customWidthCm, form.customHeightCm);

    if (dimensionLabel && centimeterSizeEnabled) {
      extras.push(`Medida personalizada: ${dimensionLabel} cm`);
    }

    if (folderProductSelected) {
      const folderLabel = form.folderOption === 'UMA_DOBRA'
        ? '1 dobra'
        : form.folderOption === 'DUAS_DOBRAS'
          ? '2 dobras'
          : form.folderOption === 'SANFONA'
            ? 'sanfona'
            : 'carteira';
      extras.push(`Modelo do folder: ${folderLabel}`);
    }

    if (form.includeArtCreation && artCreationSupported) {
      extras.push(isBusinessCardProduct(selectedProduct) ? 'Criação de arte profissional inclusa (+R$ 120,00)' : 'Criação de arte profissional inclusa (+R$ 60,00)');
    }

    const base = form.observacoes.trim();
    return [base, ...extras].filter(Boolean).join(' | ');
  };

  const resetForm = () => {
    const defaultProduct = productsByPrimaryType.GRAFICA_RAPIDA[0] ?? activeProducts[0] ?? null;

    setForm({
      clienteNome: '',
      clienteDocumento: '',
      clienteTelefone: '',
      pricingProductId: defaultProduct?.id ?? '',
      quantidade: 1,
      sizeVariationId: defaultProduct ? getDefaultSizeVariationId(defaultProduct) : '',
      paperType: defaultProduct && hasPaperVariationStructure(defaultProduct)
        ? parsePaperVariationName(defaultProduct.sizeVariations[0]?.name ?? '').paperType
        : '',
      paperGrammage: defaultProduct && hasPaperVariationStructure(defaultProduct)
        ? parsePaperVariationName(defaultProduct.sizeVariations[0]?.name ?? '').grammage
        : '',
      customWidthMeters: '',
      customHeightMeters: '',
      customWidthCm: '',
      customHeightCm: '',
      folderOption: 'DUAS_DOBRAS',
      enableUrgency: false,
      urgency: 'PRIORITARIO',
      enableFinishes: false,
      includeArtCreation: false,
      finishIds: [],
      formaPagamento: '',
      observacoes: '',
      discountPercent: 0,
    });

    if (defaultProduct) {
      setSelectedProductType(resolvePrimaryProductType(defaultProduct));
    }
    setSelectedProductGroup(null);
    setImpressaoSize('A4');
    setImpressaoColor('PB');
  };

  const addToCart = () => {
    if (!selectedProduct || !pricingPreview) return;
    setCartItems((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random()}`,
        product: selectedProduct,
        quantity: form.quantidade,
        finishIds: form.enableFinishes ? form.finishIds : [],
        sizeVariationId: form.sizeVariationId || undefined,
        customWidthMeters: bannerProductSelected ? Number(form.customWidthMeters || 0) || undefined : undefined,
        customHeightMeters: bannerProductSelected ? Number(form.customHeightMeters || 0) || undefined : undefined,
        includeArtCreation: form.includeArtCreation && artCreationSupported,
        artCreationSupported,
        discountPercent: form.discountPercent,
        urgency: form.urgency,
        enableUrgency: form.enableUrgency,
        preview: pricingPreview,
        observacoes: buildObservacoesPayload() || undefined,
      },
    ]);
  };

  const submitCart = async (status: VendaStatus) => {
    if (cartItems.length === 0) return;
    for (const item of cartItems) {
      await createVenda.mutateAsync({
        clienteNome: form.clienteNome || undefined,
        clienteDocumento: form.clienteDocumento || undefined,
        clienteTelefone: form.clienteTelefone || undefined,
        pricingProductId: item.product.id,
        quantidade: item.quantity,
        finishIds: item.finishIds.length > 0 ? item.finishIds : undefined,
        sizeVariationId: item.sizeVariationId,
        customWidthMeters: item.customWidthMeters,
        customHeightMeters: item.customHeightMeters,
        includeArtCreation: item.includeArtCreation,
        descontoPercent: item.discountPercent > 0 ? item.discountPercent : undefined,
        urgencia: item.enableUrgency ? item.urgency : 'NONE',
        status,
        formaPagamento: status === 'CONCLUIDA' ? form.formaPagamento || undefined : undefined,
        observacoes: item.observacoes,
      });
    }
    setCartItems([]);
    resetForm();
  };

  const applyClienteSuggestion = (cliente: { nome: string }) => {
    setForm((current) => ({
      ...current,
      clienteNome: cliente.nome,
    }));
    setShowClienteSuggestions(false);
  };

  const concluirVenda = async (venda: Venda) => {
    const formaPagamento = paymentDrafts[venda.id];
    if (!formaPagamento) return;

    await updateVenda.mutateAsync({
      id: venda.id,
      data: {
        status: 'CONCLUIDA',
        formaPagamento,
      },
    });
  };

  const toggleFinish = (finishId: string) => {
    setForm((current) => ({
      ...current,
      finishIds: current.finishIds.includes(finishId)
        ? current.finishIds.filter((currentId) => currentId !== finishId)
        : [...current.finishIds, finishId],
    }));
  };

  return (
    <>
      <Topbar title="Fluxo de Vendas" />
      <div className="page-wrapper vendas-page p-7 flex flex-col gap-6">
        <Card className="pricing-hero-card">
          <CardContent className="pt-6 pricing-hero-content">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="section-title">Fluxo de vendas integrado</h2>
                <Badge variant="info">Venda Guiada</Badge>
              </div>
              <p className="oper-filter-note" style={{ marginTop: 6 }}>
                Vendas rápidas agora usam a tabela comercial em tempo real, com urgência, acabamentos e catálogo centralizados na própria operação.
              </p>
            </div>
            <div className="pricing-hero-tags">
              <span><Calculator size={14} /> total instantâneo</span>
              <span><Sparkles size={14} /> produtos rápidos</span>
              <span><Settings2 size={14} /> catálogo em modal</span>
            </div>
          </CardContent>
        </Card>

        <div className="dash-stats-grid oper-stats-grid vendas-top-stats-grid">
          <button type="button" className="dash-stat-card dash-stat-blue interactive-card" data-glow="blue" onClick={() => navigate('/relatorio?preset=day&focus=sales')}>
            <div className="dash-stat-icon-wrap dash-stat-icon-blue"><DollarSign size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{vendasDia.length}</span>
              <span className="dash-stat-label">Vendas do dia</span>
            </div>
          </button>
          <button type="button" className="dash-stat-card dash-stat-purple interactive-card" data-glow="accent" onClick={() => navigate('/relatorio?preset=week&focus=sales')}>
            <div className="dash-stat-icon-wrap dash-stat-icon-purple"><CalendarDays size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{vendasSemana.length}</span>
              <span className="dash-stat-label">Vendas essa semana</span>
            </div>
          </button>
          <button type="button" className="dash-stat-card dash-stat-green interactive-card" data-glow="green" onClick={() => navigate('/relatorio?preset=month&focus=sales')}>
            <div className="dash-stat-icon-wrap dash-stat-icon-green"><FileSpreadsheet size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{vendasMes.length}</span>
              <span className="dash-stat-label">Vendas esse mês</span>
            </div>
          </button>
          <div className="dash-stat-card dash-stat-yellow">
            <div className="dash-stat-icon-wrap dash-stat-icon-yellow"><Clock3 size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{aguardandoCount}</span>
              <span className="dash-stat-label">Em aguardo</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-green">
            <div className="dash-stat-icon-wrap dash-stat-icon-green"><ReceiptText size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{concluidasCount}</span>
              <span className="dash-stat-label">Concluídas</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-blue">
            <div className="dash-stat-icon-wrap dash-stat-icon-blue"><DollarSign size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{formatCurrency(totalConcluido)}</span>
              <span className="dash-stat-label">Total vendido</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-purple">
            <div className="dash-stat-icon-wrap dash-stat-icon-purple"><Wallet size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{formatCurrency(ticketMedio)}</span>
              <span className="dash-stat-label">Ticket médio</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 venda-integrated-grid">
          <Card>
            <CardHeader>
              <div className="pricing-catalog-head">
                <div>
                  <CardTitle>Nova venda / orçamento</CardTitle>
                  <div className="pricing-catalog-meta">Cliente opcional · produto obrigatório · cálculo automático</div>
                </div>
                <Button variant="outline" onClick={() => setIsPricingDialogOpen(true)}>
                  <Settings2 size={16} />
                  Gerir catálogo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
                <div className="venda-form-grid venda-form-grid-expanded">
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <div className="cliente-suggest-wrap">
                      <Input
                        value={form.clienteNome}
                        onFocus={() => setShowClienteSuggestions(true)}
                        onBlur={() => window.setTimeout(() => setShowClienteSuggestions(false), 120)}
                        onChange={(event) => {
                          setForm((current) => ({ ...current, clienteNome: event.target.value }));
                          setShowClienteSuggestions(true);
                        }}
                        placeholder="Venda balcão, cliente corporativo ou deixe em branco"
                      />
                      {showClienteSuggestions && clienteSuggestions.length > 0 && (
                        <div className="cliente-suggest-list">
                          {clienteSuggestions.map((cliente) => (
                            <button
                              key={`${cliente.nome}-${cliente.referencia}`}
                              type="button"
                              className="cliente-suggest-item"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => applyClienteSuggestion(cliente)}
                            >
                              <span className="cliente-suggest-name">{cliente.nome}</span>
                              <span className="cliente-suggest-meta">Contato base: {cliente.referencia} · {cliente.total} histórico(s)</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>CPF / CNPJ</Label>
                    <Input
                      value={form.clienteDocumento}
                      onChange={(event) => setForm((current) => ({ ...current, clienteDocumento: event.target.value }))}
                      placeholder="Opcional para venda rápida"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label><Phone size={13} style={{ display: 'inline', marginRight: 4 }} />Telefone</Label>
                    <Input
                      value={form.clienteTelefone}
                      onChange={(event) => setForm((current) => ({ ...current, clienteTelefone: event.target.value }))}
                      placeholder="(00) 00000-0000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Quantidade *</Label>
                    <div className="qty-stepper">
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => setForm((current) => ({ ...current, quantidade: Math.max(1, current.quantidade - 1) }))}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="qty-value">
                        <input
                          type="number"
                          min="1"
                          className="qty-input"
                          value={form.quantidade}
                          onChange={(event) => setForm((current) => ({ ...current, quantidade: Math.max(1, Number.parseInt(event.target.value || '1', 10)) }))}
                        />
                      </span>
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => setForm((current) => ({ ...current, quantidade: current.quantidade + 1 }))}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {!businessCardProductSelected && !selectedProductGroup && (
                    <div className="space-y-2">
                      <Label>{productSupportsPaperSelection ? 'Tipo de papel' : 'Variação'}</Label>
                      {productSupportsPaperSelection ? (
                        <Select value={form.paperType || '__NONE__'} onValueChange={(value) => setForm((current) => ({ ...current, paperType: value === '__NONE__' ? '' : value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o papel" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__NONE__">Selecione o papel</SelectItem>
                            {paperOptions.map((paperType) => (
                              <SelectItem key={paperType} value={paperType}>{paperType}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Select value={form.sizeVariationId || '__NONE__'} onValueChange={(value) => setForm((current) => ({ ...current, sizeVariationId: value === '__NONE__' ? '' : value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sem variação" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__NONE__">Sem variação</SelectItem>
                            {(selectedProduct?.sizeVariations ?? []).map((variation) => (
                              <SelectItem key={variation.id} value={variation.id}>{variation.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  {productSupportsPaperSelection && !selectedProductGroup && (
                    <div className="space-y-2">
                      <Label>Gramatura</Label>
                      <Select value={form.paperGrammage || '__NONE__'} onValueChange={(value) => setForm((current) => ({ ...current, paperGrammage: value === '__NONE__' ? '' : value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a gramatura" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__NONE__">Selecione a gramatura</SelectItem>
                          {grammageOptions.map((grammage) => (
                            <SelectItem key={grammage} value={grammage}>{grammage}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                </div>


                {/* ── WIZARD: categoria → grupo → configuração ── */}
                <div className="space-y-4 venda-product-wizard-section">

                  {/* Passo 1: Categoria */}
                  <div className="space-y-2">
                    <Label>Categoria *</Label>
                    <div className="venda-type-grid">
                      {PRIMARY_PRODUCT_TYPE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`venda-type-card${selectedProductType === option.value ? ' venda-type-card-active' : ''}`}
                          onClick={() => setSelectedProductType(option.value)}
                        >
                          <strong>{option.label}</strong>
                          <span>{option.helper}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Passo 2: Grupo de produto */}
                  {productGroupsForCategory.length > 0 && (
                    <div className="space-y-2">
                      <Label>O que o cliente precisa?</Label>
                      <div className="venda-group-grid">
                        {productGroupsForCategory.map((group) => (
                          <button
                            key={group.id}
                            type="button"
                            className={`venda-group-card${selectedProductGroup === group.id ? ' venda-group-card-active' : ''}`}
                            onClick={() => setSelectedProductGroup(group.id)}
                          >
                            {group.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Passo 3a: Impressão */}
                  {selectedProductGroup === 'GR_IMPRESSAO' && (
                    <div className="space-y-3 venda-group-config">
                      {impressaoSizesAvailable.length > 0 && (
                        <div className="space-y-2">
                          <Label>Tamanho</Label>
                          <div className="config-option-pills">
                            {[...impressaoSizesAvailable, 'Personalizado'].map((size) => (
                              <button
                                key={size}
                                type="button"
                                className={`config-pill${impressaoSize === size ? ' config-pill-active' : ''}`}
                                onClick={() => setImpressaoSize(size)}
                              >{size}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {impressaoColorsAvailable.length > 0 && (
                        <div className="space-y-2">
                          <Label>Cor</Label>
                          <div className="config-option-pills">
                            {impressaoColorsAvailable.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={`config-pill${impressaoColor === color ? ' config-pill-active' : ''}`}
                                onClick={() => setImpressaoColor(color)}
                              >{color === 'PB' ? 'Preto e Branco' : 'Colorido'}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {impressaoSize === 'Personalizado' && (
                        <div className="venda-form-grid venda-form-grid-expanded venda-extra-grid">
                          <div className="space-y-2">
                            <Label>Largura (cm)</Label>
                            <Input type="number" min="0" step="0.1" value={form.customWidthCm}
                              onChange={(e) => setForm((c) => ({ ...c, customWidthCm: e.target.value }))} placeholder="Opcional" />
                          </div>
                          <div className="space-y-2">
                            <Label>Altura (cm)</Label>
                            <Input type="number" min="0" step="0.1" value={form.customHeightCm}
                              onChange={(e) => setForm((c) => ({ ...c, customHeightCm: e.target.value }))} placeholder="Opcional" />
                          </div>
                        </div>
                      )}
                      {productSupportsPaperSelection && paperOptions.length > 0 && (
                        <div className="space-y-2">
                          <Label>Tipo de papel</Label>
                          <div className="config-option-pills">
                            {paperOptions.map((pt) => (
                              <button key={pt} type="button"
                                className={`config-pill${form.paperType === pt ? ' config-pill-active' : ''}`}
                                onClick={() => setForm((c) => ({ ...c, paperType: pt }))}>{pt}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {productSupportsPaperSelection && grammageOptions.length > 0 && (
                        <div className="space-y-2">
                          <Label>Gramatura</Label>
                          <div className="config-option-pills">
                            {grammageOptions.map((gr) => (
                              <button key={gr} type="button"
                                className={`config-pill${form.paperGrammage === gr ? ' config-pill-active' : ''}`}
                                onClick={() => setForm((c) => ({ ...c, paperGrammage: gr }))}>{gr}</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Passo 3b: Cartão de Visitas */}
                  {selectedProductGroup === 'CV_CARTAO' && (
                    <div className="space-y-3 venda-group-config">
                      <div className="space-y-2">
                        <Label>Quantidade</Label>
                        <div className="config-qty-presets">
                          {QTY_PRESETS_COMMON.map((qty) => (
                            <button key={qty} type="button"
                              className={`config-qty-btn${form.quantidade === qty ? ' config-qty-btn-active' : ''}`}
                              onClick={() => setForm((c) => ({ ...c, quantidade: qty }))}>{qty}</button>
                          ))}
                        </div>
                      </div>
                      {cardTableProducts.length > 0 && (
                        <div className="space-y-2">
                          <Label>Modelo</Label>
                          <div className="config-model-grid">
                            {cardTableProducts.map((product) => {
                              const preview = cardTablePreviewMap.get(product.id);
                              return (
                                <button key={product.id} type="button"
                                  className={`config-model-btn${form.pricingProductId === product.id ? ' config-model-btn-active' : ''}`}
                                  onClick={() => setForm((c) => ({ ...c, pricingProductId: product.id, sizeVariationId: getDefaultSizeVariationId(product), finishIds: c.finishIds.filter((id) => product.availableFinishIds.includes(id)) }))}>
                                  <span className="config-model-name">{product.name.replace(/^Cart\u00e3o\s+/i, '')}</span>
                                  {preview && <span className="config-model-price">{formatCurrency(preview.total)}</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {selectedProduct && (selectedProduct.sizeVariations ?? []).length > 0 && (
                        <div className="space-y-2">
                          <Label>Impressão</Label>
                          <div className="config-option-pills">
                            {(selectedProduct.sizeVariations ?? []).map((variation) => (
                              <button key={variation.id} type="button"
                                className={`config-pill${form.sizeVariationId === variation.id ? ' config-pill-active' : ''}`}
                                onClick={() => setForm((c) => ({ ...c, sizeVariationId: variation.id }))}>{variation.name}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {artCreationSupported && (
                        <label className={`pricing-check-card venda-toggle-card${form.includeArtCreation ? ' venda-toggle-card-accent' : ''}`}>
                          <input type="checkbox" checked={form.includeArtCreation}
                            onChange={(e) => setForm((c) => ({ ...c, includeArtCreation: e.target.checked }))} />
                          <span><strong>Criação de arte?</strong><small>{getArtCreationLabel(selectedProduct)}</small></span>
                        </label>
                      )}
                    </div>
                  )}

                  {/* Passo 3c: Flyer */}
                  {selectedProductGroup === 'CV_FLYER' && (
                    <div className="space-y-3 venda-group-config">
                      <div className="space-y-2">
                        <Label>Quantidade</Label>
                        <div className="config-qty-presets">
                          {QTY_PRESETS_COMMON.map((qty) => (
                            <button key={qty} type="button"
                              className={`config-qty-btn${form.quantidade === qty ? ' config-qty-btn-active' : ''}`}
                              onClick={() => setForm((c) => ({ ...c, quantidade: qty }))}>{qty}</button>
                          ))}
                        </div>
                      </div>
                      {groupProducts.length > 1 && (
                        <div className="space-y-2">
                          <Label>Tamanho / Modelo</Label>
                          <div className="config-model-grid">
                            {groupProducts.map((product) => {
                              const preview = typedProductPreviewMap.get(product.id);
                              return (
                                <button key={product.id} type="button"
                                  className={`config-model-btn${form.pricingProductId === product.id ? ' config-model-btn-active' : ''}`}
                                  onClick={() => setForm((c) => ({ ...c, pricingProductId: product.id, sizeVariationId: getDefaultSizeVariationId(product), finishIds: c.finishIds.filter((id) => product.availableFinishIds.includes(id)) }))}>
                                  <span className="config-model-name">{product.name}</span>
                                  {preview && <span className="config-model-price">{formatCurrency(preview.total)}</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {productSupportsPaperSelection && paperOptions.length > 0 && (
                        <div className="space-y-2">
                          <Label>Tipo de papel</Label>
                          <div className="config-option-pills">
                            {paperOptions.map((pt) => (
                              <button key={pt} type="button"
                                className={`config-pill${form.paperType === pt ? ' config-pill-active' : ''}`}
                                onClick={() => setForm((c) => ({ ...c, paperType: pt }))}>{pt}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {productSupportsPaperSelection && grammageOptions.length > 0 && (
                        <div className="space-y-2">
                          <Label>Gramatura</Label>
                          <div className="config-option-pills">
                            {grammageOptions.map((gr) => (
                              <button key={gr} type="button"
                                className={`config-pill${form.paperGrammage === gr ? ' config-pill-active' : ''}`}
                                onClick={() => setForm((c) => ({ ...c, paperGrammage: gr }))}>{gr}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {artCreationSupported && (
                        <label className={`pricing-check-card venda-toggle-card${form.includeArtCreation ? ' venda-toggle-card-accent' : ''}`}>
                          <input type="checkbox" checked={form.includeArtCreation}
                            onChange={(e) => setForm((c) => ({ ...c, includeArtCreation: e.target.checked }))} />
                          <span><strong>Criação de arte?</strong><small>{getArtCreationLabel(selectedProduct)}</small></span>
                        </label>
                      )}
                    </div>
                  )}

                  {/* Passo 3d: Folder */}
                  {selectedProductGroup === 'CV_FOLDER' && (
                    <div className="space-y-3 venda-group-config">
                      <div className="space-y-2">
                        <Label>Dobras</Label>
                        <div className="config-option-pills">
                          <button type="button"
                            className={`config-pill${form.folderOption === 'UMA_DOBRA' ? ' config-pill-active' : ''}`}
                            onClick={() => setForm((c) => ({ ...c, folderOption: 'UMA_DOBRA' }))}>1 Dobra</button>
                          <button type="button"
                            className={`config-pill${['DUAS_DOBRAS', 'SANFONA', 'CARTEIRA'].includes(form.folderOption) ? ' config-pill-active' : ''}`}
                            onClick={() => setForm((c) => ({ ...c, folderOption: c.folderOption === 'UMA_DOBRA' ? 'DUAS_DOBRAS' : c.folderOption }))}>2 Dobras</button>
                        </div>
                      </div>
                      {['DUAS_DOBRAS', 'SANFONA', 'CARTEIRA'].includes(form.folderOption) && (
                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <div className="config-option-pills">
                            <button type="button" className={`config-pill${form.folderOption === 'DUAS_DOBRAS' ? ' config-pill-active' : ''}`} onClick={() => setForm((c) => ({ ...c, folderOption: 'DUAS_DOBRAS' }))}>Padrão</button>
                            <button type="button" className={`config-pill${form.folderOption === 'SANFONA' ? ' config-pill-active' : ''}`} onClick={() => setForm((c) => ({ ...c, folderOption: 'SANFONA' }))}>Sanfona</button>
                            <button type="button" className={`config-pill${form.folderOption === 'CARTEIRA' ? ' config-pill-active' : ''}`} onClick={() => setForm((c) => ({ ...c, folderOption: 'CARTEIRA' }))}>Carteira</button>
                          </div>
                        </div>
                      )}
                      {artCreationSupported && (
                        <label className={`pricing-check-card venda-toggle-card${form.includeArtCreation ? ' venda-toggle-card-accent' : ''}`}>
                          <input type="checkbox" checked={form.includeArtCreation}
                            onChange={(e) => setForm((c) => ({ ...c, includeArtCreation: e.target.checked }))} />
                          <span><strong>Criação de arte?</strong><small>{getArtCreationLabel(selectedProduct)}</small></span>
                        </label>
                      )}
                    </div>
                  )}

                  {/* Passo 3e: Banner / Lona */}
                  {selectedProductGroup === 'CV_BANNER' && (
                    <div className="space-y-3 venda-group-config">
                      {groupProducts.length > 1 && (
                        <div className="space-y-2">
                          <Label>Produto</Label>
                          <div className="config-model-grid">
                            {groupProducts.map((product) => {
                              const preview = typedProductPreviewMap.get(product.id);
                              return (
                                <button key={product.id} type="button"
                                  className={`config-model-btn${form.pricingProductId === product.id ? ' config-model-btn-active' : ''}`}
                                  onClick={() => setForm((c) => ({ ...c, pricingProductId: product.id, sizeVariationId: getDefaultSizeVariationId(product), finishIds: c.finishIds.filter((id) => product.availableFinishIds.includes(id)) }))}>
                                  <span className="config-model-name">{product.name}</span>
                                  {preview && <span className="config-model-price">{formatCurrency(preview.total)}/m²</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="venda-form-grid venda-form-grid-expanded">
                        <div className="space-y-2">
                          <Label>Largura (m)</Label>
                          <Input type="number" min="0" step="0.01" value={form.customWidthMeters}
                            onChange={(e) => setForm((c) => ({ ...c, customWidthMeters: e.target.value }))} placeholder="Ex.: 1.20" />
                        </div>
                        <div className="space-y-2">
                          <Label>Altura (m)</Label>
                          <Input type="number" min="0" step="0.01" value={form.customHeightMeters}
                            onChange={(e) => setForm((c) => ({ ...c, customHeightMeters: e.target.value }))} placeholder="Ex.: 0.90" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Passo 3f: Grupos genéricos (Plastificação, Adesivo, Outros…) */}
                  {selectedProductGroup && !GUIDED_GROUP_IDS.includes(selectedProductGroup) && groupProducts.length > 0 && (
                    <div className="space-y-2 venda-group-config">
                      <Label>Opções disponíveis</Label>
                      <div className="venda-product-option-grid">
                        {groupProducts.map((product) => {
                          const preview = typedProductPreviewMap.get(product.id);
                          return (
                            <button key={product.id} type="button"
                              className={`venda-product-option-card${form.pricingProductId === product.id ? ' venda-product-option-card-active' : ''}`}
                              onClick={() => setForm((c) => ({ ...c, pricingProductId: product.id, sizeVariationId: getDefaultSizeVariationId(product), finishIds: c.finishIds.filter((id) => product.availableFinishIds.includes(id)) }))}>
                              <strong>{product.name}</strong>
                              <span>{preview ? formatCurrency(preview.total) : 'Calculando...'}</span>
                            </button>
                          );
                        })}
                      </div>
                      {centimeterSizeEnabled && !bannerProductSelected && (
                        <div className="venda-form-grid venda-form-grid-expanded venda-extra-grid" style={{ marginTop: 8 }}>
                          <div className="space-y-2">
                            <Label>Largura (cm)</Label>
                            <Input type="number" min="0" step="0.1" value={form.customWidthCm}
                              onChange={(e) => setForm((c) => ({ ...c, customWidthCm: e.target.value }))} placeholder="Opcional" />
                          </div>
                          <div className="space-y-2">
                            <Label>Altura (cm)</Label>
                            <Input type="number" min="0" step="0.1" value={form.customHeightCm}
                              onChange={(e) => setForm((c) => ({ ...c, customHeightCm: e.target.value }))} placeholder="Opcional" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Brindes: grid direto sem grupos */}
                  {selectedProductType === 'BRINDES' && typedProductOptions.length > 0 && (
                    <div className="space-y-2">
                      <Label>Opções disponíveis</Label>
                      <div className="venda-product-option-grid">
                        {typedProductOptions.map((product) => {
                          const preview = typedProductPreviewMap.get(product.id);
                          return (
                            <button key={product.id} type="button"
                              className={`venda-product-option-card${form.pricingProductId === product.id ? ' venda-product-option-card-active' : ''}`}
                              onClick={() => setForm((c) => ({ ...c, pricingProductId: product.id, sizeVariationId: getDefaultSizeVariationId(product), finishIds: c.finishIds.filter((id) => product.availableFinishIds.includes(id)) }))}>
                              <strong>{product.name}</strong>
                              <span>{preview ? formatCurrency(preview.total) : 'Calculando...'}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>

                {/* Tamanho personalizado para outros produtos que suportam cm (ex: plastificação) */}
                {centimeterSizeEnabled && !bannerProductSelected && selectedProductGroup && !GUIDED_GROUP_IDS.includes(selectedProductGroup) ? null : (
                  centimeterSizeEnabled && !bannerProductSelected && selectedProductType === 'BRINDES' ? (
                    <div className="venda-form-grid venda-form-grid-expanded venda-extra-grid">
                      <div className="space-y-2">
                        <Label>Largura personalizada (cm)</Label>
                        <Input type="number" min="0" step="0.1" value={form.customWidthCm}
                          onChange={(e) => setForm((c) => ({ ...c, customWidthCm: e.target.value }))} placeholder="Opcional" />
                      </div>
                      <div className="space-y-2">
                        <Label>Altura personalizada (cm)</Label>
                        <Input type="number" min="0" step="0.1" value={form.customHeightCm}
                          onChange={(e) => setForm((c) => ({ ...c, customHeightCm: e.target.value }))} placeholder="Opcional" />
                      </div>
                    </div>
                  ) : null
                )}


                <div className="venda-toggle-grid">
                  <label className={`pricing-check-card venda-toggle-card${form.enableUrgency ? ' venda-toggle-card-danger' : ''}`}>
                    <input
                      type="checkbox"
                      checked={form.enableUrgency}
                      onChange={(event) => setForm((current) => ({ ...current, enableUrgency: event.target.checked }))}
                    />
                    <span>
                      <strong>Ativar urgência</strong>
                      <small>Aplica prioritário ou express sobre o subtotal.</small>
                    </span>
                  </label>
                  <label className={`pricing-check-card venda-toggle-card${form.enableFinishes ? ' venda-toggle-card-accent' : ''}`}>
                    <input
                      type="checkbox"
                      checked={form.enableFinishes}
                      onChange={(event) => setForm((current) => ({ ...current, enableFinishes: event.target.checked }))}
                    />
                    <span>
                      <strong>Ativar acabamento</strong>
                      <small>Libera corte, vinco, encadernação e laminação brilho/fosca.</small>
                    </span>
                  </label>
                </div>

                {form.enableUrgency && (
                  <div className="space-y-2">
                    <Label>Tipo de urgência</Label>
                    <Select value={form.urgency} onValueChange={(value) => setForm((current) => ({ ...current, urgency: value as PricingUrgency }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRIORITARIO">{URGENCY_LABELS.PRIORITARIO}</SelectItem>
                        <SelectItem value="EXPRESS">{URGENCY_LABELS.EXPRESS}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {form.enableFinishes && selectedProduct && (
                  <div className="pricing-chip-grid">
                    {selectedProduct.availableFinishes.map((finish) => {
                      const active = form.finishIds.includes(finish.id);
                      return (
                        <button
                          key={finish.id}
                          type="button"
                          className={`pricing-chip${active ? ' pricing-chip-active' : ''}`}
                          onClick={() => toggleFinish(finish.id)}
                        >
                          <strong>{finish.name}</strong>
                          <span>{finish.pricingType === 'PERCENTAGE' ? `${finish.value}%` : formatCurrency(finish.value)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    rows={3}
                    value={form.observacoes}
                    onChange={(event) => setForm((current) => ({ ...current, observacoes: event.target.value }))}
                    placeholder="Detalhes da venda, anotação de retirada, contexto do orçamento ou condição comercial."
                  />
                </div>

                <div className="venda-form-actions">
                  <Button
                    type="button"
                    onClick={addToCart}
                    disabled={!selectedProduct || !pricingPreview || pricingPreview.total <= 0}
                  >
                    <Plus size={16} />
                    Confirmar item
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Preview do cálculo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedProduct && pricingPreview ? (
                <div className="pricing-preview-summary">
                  <div className="pricing-preview-hero">
                    <div>
                      <span className="pricing-preview-overline">Total final</span>
                      <strong>{formatCurrency(pricingPreview.total)}</strong>
                      <small>{selectedProduct.name}</small>
                    </div>
                    <div className="pricing-preview-pill">
                      <Calculator size={16} />
                      {selectedProduct.isOutsourced ? 'Fornecedor x multiplicador' : 'Tabela dinâmica'}
                    </div>
                  </div>

                  <div className="pricing-breakdown-list">
                    <div className="pricing-breakdown-row"><span>Unitário</span><strong>{formatCurrency(pricingPreview.baseUnitPrice)}</strong></div>
                    <div className="pricing-breakdown-row"><span>Subtotal base</span><strong>{formatCurrency(pricingPreview.baseSubtotal)}</strong></div>
                    <div className="pricing-breakdown-row"><span>Variação</span><strong>{formatCurrency(pricingPreview.sizeVariationAmount)}</strong></div>
                    <div className="pricing-breakdown-row"><span>Acabamentos</span><strong>{formatCurrency(pricingPreview.finishesAmount)}</strong></div>
                    <div className="pricing-breakdown-row"><span>Criação de arte</span><strong>{formatCurrency(pricingPreview.artCreationAmount)}</strong></div>
                    <div className="pricing-breakdown-row"><span>Urgência</span><strong>{formatCurrency(pricingPreview.urgencyAmount)}</strong></div>
                    {form.discountPercent > 0 && (
                      <div className="pricing-breakdown-row pricing-breakdown-row-discount">
                        <span>Desconto ({form.discountPercent}%)</span>
                        <strong style={{ color: 'var(--green)' }}>- {formatCurrency(pricingPreview.total * (form.discountPercent / 100))}</strong>
                      </div>
                    )}
                    <div className="pricing-breakdown-row pricing-breakdown-row-total">
                      <span>Total{form.discountPercent > 0 ? ' com desconto' : ''}</span>
                      <strong>{formatCurrency(form.discountPercent > 0 ? Number((pricingPreview.total * (1 - form.discountPercent / 100)).toFixed(2)) : pricingPreview.total)}</strong>
                    </div>
                  </div>

                  <div className="pricing-discount-radios">
                    <span className="pricing-discount-label">Desconto para o cliente</span>
                    <div className="pricing-discount-options">
                      {[0, 5, 10, 15, 20, 25, 30].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          className={`pricing-discount-opt${form.discountPercent === pct ? ' pricing-discount-opt-active' : ''}`}
                          onClick={() => setForm((current) => ({ ...current, discountPercent: pct }))}
                        >
                          {pct === 0 ? 'Sem' : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {pricingPreview.customDimensions && (
                    <div className="pricing-preview-details">
                      <div>
                        <span>Medidas</span>
                        <strong>{pricingPreview.customDimensions.widthMeters.toFixed(2)}m × {pricingPreview.customDimensions.heightMeters.toFixed(2)}m</strong>
                      </div>
                      <div>
                        <span>Área</span>
                        <strong>{pricingPreview.customDimensions.areaSquareMeters.toFixed(2)} m²</strong>
                      </div>
                      <div>
                        <span>Preço por m²</span>
                        <strong>{formatCurrency(pricingPreview.customDimensions.pricePerSquareMeter)}</strong>
                      </div>
                    </div>
                  )}

                  {centimeterSizeEnabled && formatDimensionLabel(form.customWidthCm, form.customHeightCm) && (
                    <div className="pricing-preview-details">
                      <div>
                        <span>Medida personalizada</span>
                        <strong>{formatDimensionLabel(form.customWidthCm, form.customHeightCm)} cm</strong>
                      </div>
                      {folderProductSelected && (
                        <div>
                          <span>Modelo do folder</span>
                          <strong>{form.folderOption === 'UMA_DOBRA' ? '1 dobra' : form.folderOption === 'DUAS_DOBRAS' ? '2 dobras' : form.folderOption === 'SANFONA' ? 'Sanfona' : 'Carteira'}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pricing-preview-details">
                    <div>
                      <span>Faixa aplicada</span>
                      <strong>
                        {pricingPreview.matchedTier
                          ? `${pricingPreview.matchedTier.minQuantity}-${pricingPreview.matchedTier.maxQuantity ?? '+'}`
                          : selectedProduct.isOutsourced
                            ? `${pricingSettings?.outsourcedMultiplier?.toFixed(2) ?? '2.50'}x`
                            : 'Fixo'}
                      </strong>
                    </div>
                    <div>
                      <span>Urgência</span>
                      <strong>{URGENCY_LABELS[form.enableUrgency ? form.urgency : 'NONE']}</strong>
                    </div>
                    <div>
                      <span>Acabamentos</span>
                      <strong>{form.enableFinishes ? form.finishIds.length : 0}</strong>
                    </div>
                    <div>
                      <span>Criação de arte</span>
                      <strong>{form.includeArtCreation && artCreationSupported ? 'Sim' : 'Não'}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="oper-filter-note">Selecione um produto para ver o cálculo instantâneo.</div>
              )}
            </CardContent>
          </Card>
          </div>
        </div>

        {cartItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Carrinho ({cartItems.length} {cartItems.length === 1 ? 'item' : 'itens'}) · {formatCurrency(cartItems.reduce((sum, item) => sum + Number((item.preview.total * (1 - item.discountPercent / 100)).toFixed(2)), 0))}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {cartItems.map((item, index) => (
                  <div key={item.id} className="cart-item-row">
                    <div className="cart-item-thumb">
                      <strong>{item.product.name}</strong>
                      <span>{item.quantity} un.{item.includeArtCreation ? ' · Arte incl.' : ''}{item.finishIds.length > 0 ? ` · ${item.finishIds.length} acabamento(s)` : ''}</span>
                    </div>
                    <div className="cart-item-price">
                      {item.discountPercent > 0 && (
                        <span className="cart-item-original">{formatCurrency(item.preview.total)}</span>
                      )}
                      <strong>{formatCurrency(Number((item.preview.total * (1 - item.discountPercent / 100)).toFixed(2)))}</strong>
                      {item.discountPercent > 0 && (
                        <span className="cart-item-discount-badge" style={{ color: 'var(--green)' }}>-{item.discountPercent}%</span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="cart-item-remove"
                      onClick={() => setCartItems((current) => current.filter((_, i) => i !== index))}
                    >×</button>
                  </div>
                ))}
              </div>
              <div className="cart-total-bar">
                <span>Total do pedido</span>
                <strong>{formatCurrency(cartItems.reduce((sum, item) => sum + Number((item.preview.total * (1 - item.discountPercent / 100)).toFixed(2)), 0))}</strong>
              </div>
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select value={form.formaPagamento || '__NONE__'} onValueChange={(value) => setForm((current) => ({ ...current, formaPagamento: value === '__NONE__' ? '' : value as FormaPagamento }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione para concluir" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">Pagamento pendente</SelectItem>
                    {FORMA_PAGAMENTO_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="cart-actions">
                <Button type="button" variant="ghost" onClick={() => submitCart('AGUARDANDO')} disabled={createVenda.isPending}>
                  Salvar em aguardo
                </Button>
                <Button type="button" onClick={() => submitCart('CONCLUIDA')} disabled={!form.formaPagamento || createVenda.isPending}>
                  Finalizar pedido ({cartItems.length} {cartItems.length === 1 ? 'item' : 'itens'})
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{isAdmin ? 'Registros de vendas' : 'Minhas vendas registradas'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {minhasVendas.map((venda) => (
              <div key={venda.id} className="venda-card">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="oper-card-title">{venda.codigo}</strong>
                      <Badge variant={STATUS_BADGE_VARIANT[venda.status]}>{venda.status === 'AGUARDANDO' ? 'Aguardando' : 'Concluída'}</Badge>
                      <Badge variant="outline">Pricing</Badge>
                    </div>
                    <div className="oper-card-emphasis" style={{ marginTop: 8 }}>{venda.clienteNome || 'Cliente avulso / balcão'}</div>
                    <div className="oper-card-sub" style={{ marginTop: 6 }}>
                      {venda.produtoNome} · {venda.quantidade} un. · {formatCurrency(venda.valorTotal)}
                    </div>
                    {venda.sizeVariationNome && (
                      <div className="oper-card-sub" style={{ marginTop: 4 }}>Variação: {venda.sizeVariationNome}</div>
                    )}
                    {venda.acabamentos && venda.acabamentos.length > 0 && (
                      <div className="oper-card-sub" style={{ marginTop: 4 }}>Acabamentos: {venda.acabamentos.map((finish) => finish.name).join(' · ')}</div>
                    )}
                    {venda.urgenciaNivel !== 'NONE' && (
                      <div className="oper-card-sub" style={{ marginTop: 4 }}>Urgência: {URGENCY_LABELS[venda.urgenciaNivel]}</div>
                    )}
                    {venda.clienteDocumento && (
                      <div className="oper-card-sub" style={{ marginTop: 4 }}>CPF/CNPJ: {venda.clienteDocumento}</div>
                    )}
                    {isAdmin && (
                      <div className="oper-card-sub" style={{ marginTop: 4 }}>Responsável: {venda.responsavel.name} · {venda.responsavel.loja === 'PAPER_OFFICE_I' ? 'PaperOffice I' : 'PaperOffice II'}</div>
                    )}
                  </div>
                  <div className="venda-card-side">
                    <div className="venda-card-total">{formatCurrency(venda.valorTotal)}</div>
                    <div className="venda-card-meta">
                      {format(new Date(venda.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                    <div className="venda-card-meta">
                      {venda.formaPagamento ? `Pagamento: ${FORMA_PAGAMENTO_OPTIONS.find((item) => item.value === venda.formaPagamento)?.label}` : 'Pagamento pendente'}
                    </div>
                  </div>
                </div>

                {venda.observacoes && (
                  <div className="smart-summary-text" style={{ marginTop: 10 }}>{venda.observacoes}</div>
                )}

                {venda.status === 'AGUARDANDO' && (
                  <div className="venda-actions-row">
                    <div className="space-y-2 venda-payment-select">
                      <Label>Forma de pagamento para concluir</Label>
                      <Select
                        value={paymentDrafts[venda.id] ?? '__NONE__'}
                        onValueChange={(value) => setPaymentDrafts((current) => ({ ...current, [venda.id]: value === '__NONE__' ? '' : value as FormaPagamento }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Escolha o pagamento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__NONE__">Escolha o pagamento</SelectItem>
                          {FORMA_PAGAMENTO_OPTIONS.map((item) => (
                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={() => concluirVenda(venda)}
                      disabled={!paymentDrafts[venda.id] || updateVenda.isPending}
                    >
                      <CreditCard size={16} />
                      Concluir agora
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {minhasVendas.length === 0 && (
              <div style={{ color: 'var(--text2)', fontSize: 15 }}>
                Nenhuma venda registrada ainda. Use os produtos rápidos acima para iniciar o novo fluxo integrado.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PricingManagerDialog open={isPricingDialogOpen} onOpenChange={setIsPricingDialogOpen} />
    </>
  );
}
