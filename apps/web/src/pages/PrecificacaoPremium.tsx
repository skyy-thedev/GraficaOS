import { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  ChevronRight,
  Layers3,
  Package2,
  Percent,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useAuth } from '@/hooks/useAuth';
import {
  useCreatePricingProduct,
  usePricingFinishes,
  usePricingProducts,
  usePricingSettings,
  useUpdatePricingProduct,
  useUpdatePricingSettings,
} from '@/hooks/usePricing';
import type {
  CreatePricingProductRequest,
  ModifierType,
  PricingMode,
  PricingProduct,
  PricingUrgency,
  ProdutoTipo,
} from '@/types';
import { PRODUTO_LABELS } from '@/utils/arteAnalytics';
import {
  calculatePricingPreview,
  formatPricingCurrency,
  MODIFIER_TYPE_LABELS,
  PRICING_MODE_LABELS,
  URGENCY_LABELS,
} from '@/utils/pricing';

const CATEGORY_PRESETS = [
  'Impressão Interna',
  'Grandes Formatos',
  'Papelaria Premium',
  'Terceirização Estratégica',
];

const PREMIUM_CATEGORY_PRESETS = [
  'Operação Expressa',
  'Linha Corporativa',
  'Grandes Formatos',
  'High-Ticket',
  'Terceirização Estratégica',
];

const PRICING_MODE_OPTIONS: Array<{ value: PricingMode; label: string; helper: string }> = [
  { value: 'PROGRESSIVE', label: 'Progressivo', helper: 'Escala por volume com faixas inteligentes.' },
  { value: 'FIXED', label: 'Fixo', helper: 'Preço unitário único para qualquer tiragem.' },
  { value: 'OUTSOURCED', label: 'Terceirizado', helper: 'Fornecedor + multiplicador global premium.' },
];

const MODIFIER_OPTIONS: Array<{ value: ModifierType; label: string }> = [
  { value: 'FIXED', label: 'Valor fixo' },
  { value: 'PERCENTAGE', label: 'Percentual' },
];

const LEGACY_PRODUCT_OPTIONS = Object.entries(PRODUTO_LABELS).map(([value, label]) => ({
  value: value as ProdutoTipo,
  label,
}));

interface DraftTier {
  id: string;
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: number;
}

interface DraftSizeVariation {
  id: string;
  name: string;
  widthCm: number | null;
  heightCm: number | null;
  value: number;
  pricingType: ModifierType;
  sortOrder: number;
}

interface DraftProduct {
  name: string;
  description: string;
  category: string;
  premiumCategory: string;
  legacyProdutoTipo: ProdutoTipo | '';
  isOutsourced: boolean;
  supplierCost: number | null;
  pricingMode: PricingMode;
  fixedUnitPrice: number | null;
  urgencyEnabled: boolean;
  active: boolean;
  sortOrder: number;
  pricingTiers: DraftTier[];
  sizeVariations: DraftSizeVariation[];
  finishIds: string[];
}

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyDraft(allFinishIds: string[]): DraftProduct {
  return {
    name: '',
    description: '',
    category: 'Impressão Interna',
    premiumCategory: 'Operação Expressa',
    legacyProdutoTipo: '',
    isOutsourced: false,
    supplierCost: null,
    pricingMode: 'PROGRESSIVE',
    fixedUnitPrice: null,
    urgencyEnabled: true,
    active: true,
    sortOrder: 0,
    pricingTiers: [
      { id: makeId('tier'), minQuantity: 1, maxQuantity: 1, unitPrice: 0 },
      { id: makeId('tier'), minQuantity: 2, maxQuantity: 10, unitPrice: 0 },
    ],
    sizeVariations: [
      { id: makeId('size'), name: 'Padrão', widthCm: null, heightCm: null, value: 0, pricingType: 'FIXED', sortOrder: 0 },
    ],
    finishIds: allFinishIds,
  };
}

function createDraftFromProduct(product: PricingProduct): DraftProduct {
  return {
    name: product.name,
    description: product.description ?? '',
    category: product.category,
    premiumCategory: product.premiumCategory ?? '',
    legacyProdutoTipo: product.legacyProdutoTipo ?? '',
    isOutsourced: product.isOutsourced,
    supplierCost: product.supplierCost,
    pricingMode: product.pricingMode,
    fixedUnitPrice: product.fixedUnitPrice,
    urgencyEnabled: product.urgencyEnabled,
    active: product.active,
    sortOrder: product.sortOrder,
    pricingTiers: product.pricingTiers.map((tier) => ({
      id: tier.id,
      minQuantity: tier.minQuantity,
      maxQuantity: tier.maxQuantity,
      unitPrice: tier.unitPrice,
    })),
    sizeVariations: product.sizeVariations.map((variation) => ({
      id: variation.id,
      name: variation.name,
      widthCm: variation.widthCm,
      heightCm: variation.heightCm,
      value: variation.value,
      pricingType: variation.pricingType,
      sortOrder: variation.sortOrder,
    })),
    finishIds: [...product.availableFinishIds],
  };
}

function buildRequestFromDraft(draft: DraftProduct): CreatePricingProductRequest {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || undefined,
    category: draft.category.trim(),
    premiumCategory: draft.premiumCategory.trim() || undefined,
    legacyProdutoTipo: draft.legacyProdutoTipo || null,
    isOutsourced: draft.isOutsourced,
    supplierCost: draft.supplierCost,
    pricingMode: draft.isOutsourced ? 'OUTSOURCED' : draft.pricingMode,
    fixedUnitPrice: draft.fixedUnitPrice,
    urgencyEnabled: draft.urgencyEnabled,
    active: draft.active,
    sortOrder: draft.sortOrder,
    pricingTiers: draft.pricingTiers
      .map((tier) => ({
        minQuantity: tier.minQuantity,
        maxQuantity: tier.maxQuantity,
        unitPrice: Number(tier.unitPrice),
      }))
      .sort((first, second) => first.minQuantity - second.minQuantity),
    sizeVariations: draft.sizeVariations.map((variation, index) => ({
      name: variation.name.trim(),
      widthCm: variation.widthCm,
      heightCm: variation.heightCm,
      value: Number(variation.value),
      pricingType: variation.pricingType,
      sortOrder: variation.sortOrder ?? index,
    })),
    finishIds: draft.finishIds,
  };
}

export function PrecificacaoPremiumPage() {
  const { isAdmin } = useAuth();
  const { data: settings } = usePricingSettings();
  const { data: products, isLoading: isProductsLoading } = usePricingProducts();
  const { data: finishes } = usePricingFinishes();
  const createProduct = useCreatePricingProduct();
  const updateProduct = useUpdatePricingProduct();
  const updateSettings = useUpdatePricingSettings();

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftProduct | null>(null);
  const [settingsDraft, setSettingsDraft] = useState('2.5');
  const [previewQuantity, setPreviewQuantity] = useState(25);
  const [previewFinishIds, setPreviewFinishIds] = useState<string[]>([]);
  const [previewUrgency, setPreviewUrgency] = useState<PricingUrgency>('NONE');
  const [previewSizeVariationId, setPreviewSizeVariationId] = useState<string>('');

  const finishCatalog = finishes ?? [];
  const productCatalog = products ?? [];

  useEffect(() => {
    if (settings) {
      setSettingsDraft(String(settings.outsourcedMultiplier));
    }
  }, [settings]);

  useEffect(() => {
    if (!draft && finishCatalog.length > 0) {
      setDraft(createEmptyDraft(finishCatalog.map((finish) => finish.id)));
    }
  }, [draft, finishCatalog]);

  useEffect(() => {
    if (!productCatalog.length || !finishCatalog.length) return;

    if (!selectedProductId) {
      const first = productCatalog[0];
      if (first) {
        setSelectedProductId(first.id);
        setDraft(createDraftFromProduct(first));
        setPreviewFinishIds(first.availableFinishIds.slice(0, 2));
        setPreviewSizeVariationId(first.sizeVariations[0]?.id ?? '');
      }
      return;
    }

    const selected = productCatalog.find((product) => product.id === selectedProductId);
    if (!selected) return;

    setDraft(createDraftFromProduct(selected));
    setPreviewFinishIds(selected.availableFinishIds.slice(0, 2));
    setPreviewSizeVariationId(selected.sizeVariations[0]?.id ?? '');
  }, [productCatalog, finishCatalog, selectedProductId]);

  useEffect(() => {
    if (!draft) return;

    if (previewSizeVariationId && !draft.sizeVariations.some((variation) => variation.id === previewSizeVariationId)) {
      setPreviewSizeVariationId(draft.sizeVariations[0]?.id ?? '');
    }

    setPreviewFinishIds((current) => current.filter((finishId) => draft.finishIds.includes(finishId)));
  }, [draft, previewSizeVariationId]);

  const selectedProduct = useMemo(
    () => productCatalog.find((product) => product.id === selectedProductId) ?? null,
    [productCatalog, selectedProductId],
  );

  const draftFinishes = useMemo(
    () => finishCatalog.filter((finish) => draft?.finishIds.includes(finish.id)),
    [draft?.finishIds, finishCatalog],
  );

  const preview = useMemo(() => {
    if (!draft) return null;

    return calculatePricingPreview({
      product: {
        pricingMode: draft.isOutsourced ? 'OUTSOURCED' : draft.pricingMode,
        isOutsourced: draft.isOutsourced,
        supplierCost: draft.supplierCost,
        fixedUnitPrice: draft.fixedUnitPrice,
        urgencyEnabled: draft.urgencyEnabled,
        pricingTiers: draft.pricingTiers.map((tier) => ({
          minQuantity: tier.minQuantity,
          maxQuantity: tier.maxQuantity,
          unitPrice: tier.unitPrice,
        })),
        sizeVariations: draft.sizeVariations,
        availableFinishes: draftFinishes,
      },
      settings: { outsourcedMultiplier: Number(settingsDraft) || 2.5 },
      quantity: previewQuantity,
      finishIds: previewFinishIds,
      sizeVariationId: previewSizeVariationId || undefined,
      urgency: previewUrgency,
    });
  }, [draft, draftFinishes, previewFinishIds, previewQuantity, previewSizeVariationId, previewUrgency, settingsDraft]);

  const totalProducts = productCatalog.length;
  const outsourcedCount = productCatalog.filter((product) => product.isOutsourced || product.pricingMode === 'OUTSOURCED').length;
  const internalCount = totalProducts - outsourcedCount;

  const handleCreateNew = () => {
    setSelectedProductId(null);
    setDraft(createEmptyDraft(finishCatalog.map((finish) => finish.id)));
    setPreviewFinishIds([]);
    setPreviewUrgency('NONE');
    setPreviewSizeVariationId('');
  };

  const handleSelectProduct = (product: PricingProduct) => {
    setSelectedProductId(product.id);
  };

  const handleSaveProduct = async () => {
    if (!draft) return;

    const payload = buildRequestFromDraft(draft);
    if (selectedProductId) {
      await updateProduct.mutateAsync({ id: selectedProductId, data: payload });
    } else {
      const created = await createProduct.mutateAsync(payload);
      setSelectedProductId(created.id);
    }
  };

  const toggleDraftFinish = (finishId: string) => {
    setDraft((current) => {
      if (!current) return current;
      const included = current.finishIds.includes(finishId);
      return {
        ...current,
        finishIds: included
          ? current.finishIds.filter((currentId) => currentId !== finishId)
          : [...current.finishIds, finishId],
      };
    });
  };

  const togglePreviewFinish = (finishId: string) => {
    setPreviewFinishIds((current) => current.includes(finishId)
      ? current.filter((currentId) => currentId !== finishId)
      : [...current, finishId]);
  };

  const selectedSizeLabel = draft?.sizeVariations.find((variation) => variation.id === previewSizeVariationId)?.name ?? 'Sem variação';

  if (!isAdmin) {
    return (
      <>
        <Topbar title="Precificação Premium" />
        <div className="page-wrapper p-7">
          <Card>
            <CardContent className="pt-6">
              <h2 className="section-title">Acesso administrativo</h2>
              <p className="oper-filter-note" style={{ marginTop: 8 }}>
                O módulo premium de precificação fica disponível apenas no painel administrativo.
              </p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Precificação Premium" />
      <div className="page-wrapper pricing-premium-page p-7 flex flex-col gap-6">
        <Card className="pricing-hero-card">
          <CardContent className="pt-6 pricing-hero-content">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="section-title">Tabela premium dinâmica</h2>
                <Badge variant="info">High-ticket</Badge>
              </div>
              <p className="oper-filter-note" style={{ marginTop: 8 }}>
                Estruture produtos internos e terceirizados com regras vivas, preview instantâneo e acabamento premium sem visual de ERP antigo.
              </p>
            </div>
            <div className="pricing-hero-tags">
              <span><Sparkles size={14} /> cálculo instantâneo</span>
              <span><Layers3 size={14} /> faixas progressivas</span>
              <span><Package2 size={14} /> catálogo escalável</span>
            </div>
          </CardContent>
        </Card>

        <div className="dash-stats-grid oper-stats-grid">
          <div className="dash-stat-card dash-stat-blue">
            <div className="dash-stat-icon-wrap dash-stat-icon-blue"><Package2 size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{totalProducts}</span>
              <span className="dash-stat-label">Produtos premium</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-green">
            <div className="dash-stat-icon-wrap dash-stat-icon-green"><Layers3 size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{internalCount}</span>
              <span className="dash-stat-label">Internos</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-purple">
            <div className="dash-stat-icon-wrap dash-stat-icon-purple"><WandSparkles size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{outsourcedCount}</span>
              <span className="dash-stat-label">Terceirizados</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-yellow">
            <div className="dash-stat-icon-wrap dash-stat-icon-yellow"><Percent size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{Number(settingsDraft || 0).toFixed(2)}x</span>
              <span className="dash-stat-label">Multiplicador global</span>
            </div>
          </div>
        </div>

        <div className="pricing-premium-shell">
          <Card className="pricing-catalog-card">
            <CardHeader>
              <div className="pricing-catalog-head">
                <div>
                  <CardTitle>Catálogo premium</CardTitle>
                  <CardDescription>Produtos e categorias com leitura rápida.</CardDescription>
                </div>
                <Button size="sm" onClick={handleCreateNew}>Novo produto</Button>
              </div>
            </CardHeader>
            <CardContent className="pricing-catalog-list">
              {isProductsLoading && <div className="oper-filter-note">Carregando catálogo premium...</div>}
              {!isProductsLoading && productCatalog.map((product) => {
                const active = selectedProductId === product.id;
                return (
                  <button
                    key={product.id}
                    type="button"
                    className={`pricing-catalog-item${active ? ' pricing-catalog-item-active' : ''}`}
                    onClick={() => handleSelectProduct(product)}
                  >
                    <div>
                      <div className="pricing-catalog-title-row">
                        <strong>{product.name}</strong>
                        <Badge variant={product.pricingMode === 'OUTSOURCED' ? 'warning' : 'info'}>
                          {PRICING_MODE_LABELS[product.pricingMode]}
                        </Badge>
                      </div>
                      <div className="pricing-catalog-meta">
                        {product.category} · {product.premiumCategory ?? 'Categoria premium livre'}
                      </div>
                      <div className="pricing-catalog-meta">
                        {product.pricingTiers.length} faixa(s) · {product.availableFinishes.length} acabamento(s)
                      </div>
                    </div>
                    <ChevronRight size={16} />
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <div className="pricing-editor-stack">
            <Card>
              <CardHeader>
                <CardTitle>Configuração global</CardTitle>
                <CardDescription>Multiplicador automático aplicado aos produtos terceirizados.</CardDescription>
              </CardHeader>
              <CardContent className="pricing-settings-row">
                <div className="space-y-2">
                  <Label>Multiplicador terceirizado</Label>
                  <Input
                    type="number"
                    min={0.1}
                    step="0.1"
                    value={settingsDraft}
                    onChange={(event) => setSettingsDraft(event.target.value)}
                  />
                </div>
                <Button
                  onClick={() => updateSettings.mutate({ outsourcedMultiplier: Number(settingsDraft) || 2.5 })}
                  disabled={updateSettings.isPending}
                >
                  {updateSettings.isPending ? 'Salvando...' : 'Salvar multiplicador'}
                </Button>
              </CardContent>
            </Card>

            {draft && (
              <Card>
                <CardHeader>
                  <div className="pricing-editor-head">
                    <div>
                      <CardTitle>{selectedProduct ? 'Editar produto' : 'Novo produto premium'}</CardTitle>
                      <CardDescription>
                        Estruture faixas, urgência, acabamentos e variações com foco em rapidez operacional.
                      </CardDescription>
                    </div>
                    <Badge variant="outline">{draft.isOutsourced ? 'Fornecedor + multiplicador' : 'Tabela gerenciável'}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="pricing-form-grid">
                    <div className="space-y-2">
                      <Label>Nome do produto *</Label>
                      <Input value={draft.name} onChange={(event) => setDraft((current) => current ? { ...current, name: event.target.value } : current)} placeholder="Ex.: Impressão A4 Premium" />
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria *</Label>
                      <Input value={draft.category} list="pricing-category-list" onChange={(event) => setDraft((current) => current ? { ...current, category: event.target.value } : current)} placeholder="Categoria operacional" />
                      <datalist id="pricing-category-list">
                        {CATEGORY_PRESETS.map((category) => <option key={category} value={category} />)}
                      </datalist>
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria premium</Label>
                      <Input value={draft.premiumCategory} list="pricing-premium-category-list" onChange={(event) => setDraft((current) => current ? { ...current, premiumCategory: event.target.value } : current)} placeholder="Linha corporativa, high-ticket..." />
                      <datalist id="pricing-premium-category-list">
                        {PREMIUM_CATEGORY_PRESETS.map((category) => <option key={category} value={category} />)}
                      </datalist>
                    </div>
                    <div className="space-y-2">
                      <Label>Produto legado vinculado</Label>
                      <Select
                        value={draft.legacyProdutoTipo || '__NONE__'}
                        onValueChange={(value) => setDraft((current) => current ? { ...current, legacyProdutoTipo: value === '__NONE__' ? '' : value as ProdutoTipo } : current)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Opcional" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__NONE__">Sem vínculo legado</SelectItem>
                          {LEGACY_PRODUCT_OPTIONS.map((product) => (
                            <SelectItem key={product.value} value={product.value}>{product.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={draft.description}
                      onChange={(event) => setDraft((current) => current ? { ...current, description: event.target.value } : current)}
                      placeholder="Posicione o produto com linguagem premium e operacional."
                      rows={3}
                    />
                  </div>

                  <div className="pricing-toggle-grid">
                    <label className="pricing-check-card">
                      <input
                        type="checkbox"
                        checked={draft.isOutsourced}
                        onChange={(event) => setDraft((current) => current ? {
                          ...current,
                          isOutsourced: event.target.checked,
                          pricingMode: event.target.checked ? 'OUTSOURCED' : current.pricingMode === 'OUTSOURCED' ? 'PROGRESSIVE' : current.pricingMode,
                        } : current)}
                      />
                      <span>
                        <strong>Produto terceirizado</strong>
                        <small>Ativa custo de fornecedor + multiplicador global.</small>
                      </span>
                    </label>
                    <label className="pricing-check-card">
                      <input
                        type="checkbox"
                        checked={draft.urgencyEnabled}
                        onChange={(event) => setDraft((current) => current ? { ...current, urgencyEnabled: event.target.checked } : current)}
                      />
                      <span>
                        <strong>Urgência habilitada</strong>
                        <small>Permite Prioritário (+20%) e Express (+30%).</small>
                      </span>
                    </label>
                    <label className="pricing-check-card">
                      <input
                        type="checkbox"
                        checked={draft.active}
                        onChange={(event) => setDraft((current) => current ? { ...current, active: event.target.checked } : current)}
                      />
                      <span>
                        <strong>Produto ativo</strong>
                        <small>Mantém o item disponível no catálogo operacional.</small>
                      </span>
                    </label>
                  </div>

                  <div className="pricing-mode-row">
                    {PRICING_MODE_OPTIONS.map((option) => {
                      const active = (draft.isOutsourced ? 'OUTSOURCED' : draft.pricingMode) === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`pricing-mode-card${active ? ' pricing-mode-card-active' : ''}`}
                          onClick={() => setDraft((current) => current ? {
                            ...current,
                            pricingMode: option.value,
                            isOutsourced: option.value === 'OUTSOURCED',
                          } : current)}
                        >
                          <strong>{option.label}</strong>
                          <span>{option.helper}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pricing-form-grid">
                    <div className="space-y-2">
                      <Label>Ordem visual</Label>
                      <Input type="number" min={0} value={draft.sortOrder} onChange={(event) => setDraft((current) => current ? { ...current, sortOrder: Number(event.target.value) } : current)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Custo fornecedor</Label>
                      <Input type="number" min={0} step="0.01" value={draft.supplierCost ?? ''} onChange={(event) => setDraft((current) => current ? { ...current, supplierCost: event.target.value === '' ? null : Number(event.target.value) } : current)} disabled={!draft.isOutsourced} />
                    </div>
                    <div className="space-y-2">
                      <Label>Preço fixo unitário</Label>
                      <Input type="number" min={0} step="0.01" value={draft.fixedUnitPrice ?? ''} onChange={(event) => setDraft((current) => current ? { ...current, fixedUnitPrice: event.target.value === '' ? null : Number(event.target.value) } : current)} disabled={draft.isOutsourced || draft.pricingMode !== 'FIXED'} />
                    </div>
                  </div>

                  <div className="pricing-section-card">
                    <div className="pricing-section-head">
                      <div>
                        <h3>Faixas progressivas</h3>
                        <p>Editor inline para precificação por volume com leitura instantânea.</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDraft((current) => current ? {
                          ...current,
                          pricingTiers: [...current.pricingTiers, {
                            id: makeId('tier'),
                            minQuantity: (current.pricingTiers.at(-1)?.maxQuantity ?? current.pricingTiers.at(-1)?.minQuantity ?? 0) + 1,
                            maxQuantity: null,
                            unitPrice: 0,
                          }],
                        } : current)}
                        disabled={draft.isOutsourced || draft.pricingMode !== 'PROGRESSIVE'}
                      >
                        Adicionar faixa
                      </Button>
                    </div>
                    <div className="pricing-tier-table">
                      <div className="pricing-tier-header pricing-tier-row">
                        <span>Mín.</span>
                        <span>Máx.</span>
                        <span>Valor un.</span>
                        <span />
                      </div>
                      {draft.pricingTiers.map((tier) => (
                        <div key={tier.id} className="pricing-tier-row">
                          <Input type="number" min={1} value={tier.minQuantity} disabled={draft.isOutsourced || draft.pricingMode !== 'PROGRESSIVE'} onChange={(event) => setDraft((current) => current ? ({
                            ...current,
                            pricingTiers: current.pricingTiers.map((currentTier) => currentTier.id === tier.id ? { ...currentTier, minQuantity: Number(event.target.value) } : currentTier),
                          }) : current)} />
                          <Input type="number" min={1} value={tier.maxQuantity ?? ''} disabled={draft.isOutsourced || draft.pricingMode !== 'PROGRESSIVE'} onChange={(event) => setDraft((current) => current ? ({
                            ...current,
                            pricingTiers: current.pricingTiers.map((currentTier) => currentTier.id === tier.id ? { ...currentTier, maxQuantity: event.target.value === '' ? null : Number(event.target.value) } : currentTier),
                          }) : current)} placeholder="aberto" />
                          <Input type="number" min={0} step="0.01" value={tier.unitPrice} disabled={draft.isOutsourced || draft.pricingMode !== 'PROGRESSIVE'} onChange={(event) => setDraft((current) => current ? ({
                            ...current,
                            pricingTiers: current.pricingTiers.map((currentTier) => currentTier.id === tier.id ? { ...currentTier, unitPrice: Number(event.target.value) } : currentTier),
                          }) : current)} />
                          <Button type="button" variant="ghost" size="sm" onClick={() => setDraft((current) => current ? ({
                            ...current,
                            pricingTiers: current.pricingTiers.filter((currentTier) => currentTier.id !== tier.id),
                          }) : current)}>
                            Remover
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pricing-section-card">
                    <div className="pricing-section-head">
                      <div>
                        <h3>Variações de tamanho</h3>
                        <p>Crie formatos com ajuste fixo ou percentual sem poluir a tela.</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDraft((current) => current ? ({
                          ...current,
                          sizeVariations: [...current.sizeVariations, {
                            id: makeId('size'),
                            name: `Variação ${current.sizeVariations.length + 1}`,
                            widthCm: null,
                            heightCm: null,
                            value: 0,
                            pricingType: 'FIXED',
                            sortOrder: current.sizeVariations.length,
                          }],
                        }) : current)}
                      >
                        Nova variação
                      </Button>
                    </div>
                    <div className="pricing-size-list">
                      {draft.sizeVariations.map((variation, index) => (
                        <div key={variation.id} className="pricing-size-item">
                          <div className="pricing-size-grid">
                            <Input value={variation.name} onChange={(event) => setDraft((current) => current ? ({
                              ...current,
                              sizeVariations: current.sizeVariations.map((currentVariation) => currentVariation.id === variation.id ? { ...currentVariation, name: event.target.value } : currentVariation),
                            }) : current)} placeholder="Nome da variação" />
                            <Input type="number" min={0} step="0.1" value={variation.widthCm ?? ''} onChange={(event) => setDraft((current) => current ? ({
                              ...current,
                              sizeVariations: current.sizeVariations.map((currentVariation) => currentVariation.id === variation.id ? { ...currentVariation, widthCm: event.target.value === '' ? null : Number(event.target.value) } : currentVariation),
                            }) : current)} placeholder="Largura cm" />
                            <Input type="number" min={0} step="0.1" value={variation.heightCm ?? ''} onChange={(event) => setDraft((current) => current ? ({
                              ...current,
                              sizeVariations: current.sizeVariations.map((currentVariation) => currentVariation.id === variation.id ? { ...currentVariation, heightCm: event.target.value === '' ? null : Number(event.target.value) } : currentVariation),
                            }) : current)} placeholder="Altura cm" />
                            <Input type="number" min={0} step="0.01" value={variation.value} onChange={(event) => setDraft((current) => current ? ({
                              ...current,
                              sizeVariations: current.sizeVariations.map((currentVariation) => currentVariation.id === variation.id ? { ...currentVariation, value: Number(event.target.value) } : currentVariation),
                            }) : current)} placeholder="Ajuste" />
                            <Select value={variation.pricingType} onValueChange={(value) => setDraft((current) => current ? ({
                              ...current,
                              sizeVariations: current.sizeVariations.map((currentVariation) => currentVariation.id === variation.id ? { ...currentVariation, pricingType: value as ModifierType } : currentVariation),
                            }) : current)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MODIFIER_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="pricing-size-actions">
                            <span>Ordem {index + 1}</span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setDraft((current) => current ? ({
                              ...current,
                              sizeVariations: current.sizeVariations.filter((currentVariation) => currentVariation.id !== variation.id),
                            }) : current)}>
                              Remover
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pricing-section-card">
                    <div className="pricing-section-head">
                      <div>
                        <h3>Acabamentos disponíveis</h3>
                        <p>Selecione o que esse produto pode receber no cálculo premium.</p>
                      </div>
                    </div>
                    <div className="pricing-chip-grid">
                      {finishCatalog.map((finish) => {
                        const selected = draft.finishIds.includes(finish.id);
                        return (
                          <button
                            key={finish.id}
                            type="button"
                            className={`pricing-chip${selected ? ' pricing-chip-active' : ''}`}
                            onClick={() => toggleDraftFinish(finish.id)}
                          >
                            <strong>{finish.name}</strong>
                            <span>
                              {finish.pricingType === 'PERCENTAGE' ? `${finish.value}%` : formatPricingCurrency(finish.value)} · {finish.type}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pricing-editor-footer">
                    <Button onClick={handleSaveProduct} disabled={createProduct.isPending || updateProduct.isPending}>
                      {createProduct.isPending || updateProduct.isPending ? 'Salvando...' : selectedProductId ? 'Salvar produto' : 'Criar produto premium'}
                    </Button>
                    <Button variant="ghost" onClick={handleCreateNew}>Novo rascunho</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="pricing-preview-card">
            <CardHeader>
              <CardTitle>Preview dinâmico</CardTitle>
              <CardDescription>Veja o cálculo final em tempo real com volume, acabamentos e urgência.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {draft && (
                <>
                  <div className="pricing-preview-controls">
                    <div className="space-y-2">
                      <Label>Quantidade</Label>
                      <Input type="number" min={1} value={previewQuantity} onChange={(event) => setPreviewQuantity(Math.max(1, Number(event.target.value) || 1))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Urgência</Label>
                      <Select value={previewUrgency} onValueChange={(value) => setPreviewUrgency(value as PricingUrgency)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(URGENCY_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Variação</Label>
                      <Select value={previewSizeVariationId || '__NONE__'} onValueChange={(value) => setPreviewSizeVariationId(value === '__NONE__' ? '' : value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__NONE__">Sem variação</SelectItem>
                          {draft.sizeVariations.map((variation) => (
                            <SelectItem key={variation.id} value={variation.id}>{variation.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="pricing-chip-grid pricing-chip-grid-preview">
                    {draftFinishes.map((finish) => {
                      const selected = previewFinishIds.includes(finish.id);
                      return (
                        <button
                          key={finish.id}
                          type="button"
                          className={`pricing-chip${selected ? ' pricing-chip-active' : ''}`}
                          onClick={() => togglePreviewFinish(finish.id)}
                        >
                          <strong>{finish.name}</strong>
                          <span>{finish.pricingType === 'PERCENTAGE' ? `${finish.value}%` : formatPricingCurrency(finish.value)}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pricing-preview-summary">
                    <div className="pricing-preview-hero">
                      <div>
                        <span className="pricing-preview-overline">Preço final</span>
                        <strong>{formatPricingCurrency(preview?.total ?? 0)}</strong>
                        <small>
                          {draft.name || 'Produto em rascunho'} · {selectedSizeLabel}
                        </small>
                      </div>
                      <div className="pricing-preview-pill">
                        <Calculator size={16} />
                        {PRICING_MODE_LABELS[draft.isOutsourced ? 'OUTSOURCED' : draft.pricingMode]}
                      </div>
                    </div>

                    <div className="pricing-breakdown-list">
                      <div className="pricing-breakdown-row">
                        <span>Base unitária</span>
                        <strong>{formatPricingCurrency(preview?.baseUnitPrice ?? 0)}</strong>
                      </div>
                      <div className="pricing-breakdown-row">
                        <span>Subtotal por volume</span>
                        <strong>{formatPricingCurrency(preview?.baseSubtotal ?? 0)}</strong>
                      </div>
                      <div className="pricing-breakdown-row">
                        <span>Variação de tamanho</span>
                        <strong>{formatPricingCurrency(preview?.sizeVariationAmount ?? 0)}</strong>
                      </div>
                      <div className="pricing-breakdown-row">
                        <span>Acabamentos</span>
                        <strong>{formatPricingCurrency(preview?.finishesAmount ?? 0)}</strong>
                      </div>
                      <div className="pricing-breakdown-row">
                        <span>Urgência</span>
                        <strong>{formatPricingCurrency(preview?.urgencyAmount ?? 0)}</strong>
                      </div>
                      <div className="pricing-breakdown-row pricing-breakdown-row-total">
                        <span>Total premium</span>
                        <strong>{formatPricingCurrency(preview?.total ?? 0)}</strong>
                      </div>
                    </div>

                    <div className="pricing-preview-details">
                      <div>
                        <span>Faixa aplicada</span>
                        <strong>
                          {preview?.matchedTier
                            ? `${preview.matchedTier.minQuantity} - ${preview.matchedTier.maxQuantity ?? '+'}`
                            : draft.isOutsourced
                              ? `Fornecedor x ${Number(settingsDraft || 0).toFixed(2)}`
                              : 'Preço fixo'}
                        </strong>
                      </div>
                      <div>
                        <span>Urgência</span>
                        <strong>{URGENCY_LABELS[previewUrgency]}</strong>
                      </div>
                      <div>
                        <span>Acabamentos ativos</span>
                        <strong>{previewFinishIds.length}</strong>
                      </div>
                    </div>

                    {preview && preview.selectedFinishes.length > 0 && (
                      <div className="pricing-preview-finish-list">
                        {preview.selectedFinishes.map((finish) => (
                          <div key={finish.id} className="pricing-preview-finish-item">
                            <span>{finish.name}</span>
                            <strong>
                              {finish.pricingType === 'PERCENTAGE'
                                ? `${finish.value}% · ${formatPricingCurrency(finish.amount)}`
                                : formatPricingCurrency(finish.amount)}
                            </strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
