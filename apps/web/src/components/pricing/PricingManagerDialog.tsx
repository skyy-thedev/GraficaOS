import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  ProdutoTipo,
} from '@/types';
import { PRODUTO_LABELS } from '@/utils/arteAnalytics';
import { formatPricingCurrency, PRICING_MODE_LABELS } from '@/utils/pricing';

interface PricingManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DraftTier {
  id: string;
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: number;
}

interface DraftSizeVariation {
  id: string;
  name: string;
  value: number;
  pricingType: ModifierType;
  sortOrder: number;
}

interface DraftProduct {
  name: string;
  category: string;
  premiumCategory: string;
  legacyProdutoTipo: ProdutoTipo | '';
  pricingMode: PricingMode;
  isOutsourced: boolean;
  supplierCost: number | null;
  fixedUnitPrice: number | null;
  urgencyEnabled: boolean;
  active: boolean;
  sortOrder: number;
  pricingTiers: DraftTier[];
  sizeVariations: DraftSizeVariation[];
  finishIds: string[];
}

const LEGACY_PRODUCT_OPTIONS = Object.entries(PRODUTO_LABELS).map(([value, label]) => ({
  value: value as ProdutoTipo,
  label,
}));

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyDraft(finishIds: string[]): DraftProduct {
  return {
    name: '',
    category: 'Impressão Interna',
    premiumCategory: 'Operação Expressa',
    legacyProdutoTipo: '',
    pricingMode: 'PROGRESSIVE',
    isOutsourced: false,
    supplierCost: null,
    fixedUnitPrice: null,
    urgencyEnabled: true,
    active: true,
    sortOrder: 0,
    pricingTiers: [
      { id: makeId('tier'), minQuantity: 1, maxQuantity: 1, unitPrice: 0 },
      { id: makeId('tier'), minQuantity: 2, maxQuantity: 10, unitPrice: 0 },
    ],
    sizeVariations: [],
    finishIds,
  };
}

function createDraftFromProduct(product: PricingProduct): DraftProduct {
  return {
    name: product.name,
    category: product.category,
    premiumCategory: product.premiumCategory ?? '',
    legacyProdutoTipo: product.legacyProdutoTipo ?? '',
    pricingMode: product.pricingMode,
    isOutsourced: product.isOutsourced,
    supplierCost: product.supplierCost,
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
    sizeVariations: product.sizeVariations.map((sv) => ({
      id: sv.id,
      name: sv.name,
      value: sv.value,
      pricingType: sv.pricingType,
      sortOrder: sv.sortOrder,
    })),
    finishIds: [...product.availableFinishIds],
  };
}

function buildRequestFromDraft(draft: DraftProduct): CreatePricingProductRequest {
  return {
    name: draft.name.trim(),
    category: draft.category.trim(),
    premiumCategory: draft.premiumCategory.trim() || undefined,
    legacyProdutoTipo: draft.legacyProdutoTipo || null,
    pricingMode: draft.isOutsourced ? 'OUTSOURCED' : draft.pricingMode,
    isOutsourced: draft.isOutsourced,
    supplierCost: draft.supplierCost,
    fixedUnitPrice: draft.fixedUnitPrice,
    urgencyEnabled: draft.urgencyEnabled,
    active: draft.active,
    sortOrder: draft.sortOrder,
    pricingTiers: draft.pricingTiers.map((tier) => ({
      minQuantity: tier.minQuantity,
      maxQuantity: tier.maxQuantity,
      unitPrice: tier.unitPrice,
    })),
    sizeVariations: draft.sizeVariations.map((sv) => ({
      name: sv.name.trim(),
      value: sv.value,
      pricingType: sv.pricingType,
      sortOrder: sv.sortOrder,
    })),
    finishIds: draft.finishIds,
  };
}

export function PricingManagerDialog({ open, onOpenChange }: PricingManagerDialogProps) {
  const { data: settings } = usePricingSettings();
  const { data: products } = usePricingProducts();
  const { data: finishes } = usePricingFinishes();
  const createProduct = useCreatePricingProduct();
  const updateProduct = useUpdatePricingProduct();
  const updateSettings = useUpdatePricingSettings();

  const finishCatalog = finishes ?? [];
  const productCatalog = products ?? [];
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftProduct | null>(null);
  const [settingsDraft, setSettingsDraft] = useState('2.5');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    if (settings) setSettingsDraft(String(settings.outsourcedMultiplier));
  }, [settings]);

  useEffect(() => {
    if (!open) return;
    if (!draft && finishCatalog.length > 0) {
      setDraft(createEmptyDraft(finishCatalog.map((finish) => finish.id)));
    }
  }, [draft, finishCatalog, open]);

  useEffect(() => {
    if (!open || !productCatalog.length || !finishCatalog.length) return;
    if (!selectedProductId) return;

    const selected = productCatalog.find((product) => product.id === selectedProductId);
    if (selected) setDraft(createDraftFromProduct(selected));
  }, [finishCatalog.length, open, productCatalog, selectedProductId]);

  const selectedProduct = useMemo(
    () => productCatalog.find((product) => product.id === selectedProductId) ?? null,
    [productCatalog, selectedProductId],
  );

  const filteredCatalog = useMemo(() => {
    const query = sidebarSearch.toLowerCase();
    return productCatalog.filter((p) => {
      if (!showInactive && !p.active) return false;
      if (!query) return true;
      return (
        p.name.toLowerCase().includes(query)
        || p.category.toLowerCase().includes(query)
        || (p.premiumCategory ?? '').toLowerCase().includes(query)
      );
    });
  }, [productCatalog, showInactive, sidebarSearch]);

  const catalogByCategory = useMemo(() => {
    const map = new Map<string, typeof filteredCatalog>();
    for (const p of filteredCatalog) {
      if (!map.has(p.category)) map.set(p.category, []);
      map.get(p.category)!.push(p);
    }
    return map;
  }, [filteredCatalog]);

  const handleNew = () => {
    setSelectedProductId(null);
    setDraft(createEmptyDraft(finishCatalog.map((finish) => finish.id)));
  };

  const handleSave = async () => {
    if (!draft) return;
    const payload = buildRequestFromDraft(draft);

    if (selectedProductId) {
      await updateProduct.mutateAsync({ id: selectedProductId, data: payload });
      return;
    }

    const created = await createProduct.mutateAsync(payload);
    setSelectedProductId(created.id);
  };

  const effectiveMode = draft?.isOutsourced ? 'OUTSOURCED' : (draft?.pricingMode ?? 'PROGRESSIVE');
  const isProgressive = effectiveMode === 'PROGRESSIVE';
  const isOutsourced = effectiveMode === 'OUTSOURCED';
  const isFixed = effectiveMode === 'FIXED';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl pricing-dialog-content">
        <DialogHeader>
          <DialogTitle>Precificação integrada</DialogTitle>
          <DialogDescription>
            Gerencie produtos, faixas e variações sem sair do fluxo de vendas.
          </DialogDescription>
        </DialogHeader>

        <div className="pricing-dialog-shell">
          {/* ── SIDEBAR ── */}
          <div className="pricing-dialog-sidebar">
            <div className="pricing-dialog-toolbar">
              <div>
                <strong>Catálogo</strong>
                <div className="pricing-catalog-meta">{productCatalog.length} produto(s)</div>
              </div>
              <Button size="sm" onClick={handleNew}>
                <Plus size={14} />
                Novo
              </Button>
            </div>

            <div className="pricing-sidebar-search">
              <Search size={13} className="pricing-sidebar-search-icon" />
              <input
                className="pricing-sidebar-search-input"
                placeholder="Buscar produto…"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
              />
            </div>

            <label className="pricing-show-inactive">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              <span>Mostrar inativos</span>
            </label>

            <div className="pricing-dialog-products">
              {[...catalogByCategory.entries()].map(([category, categoryProducts]) => (
                <div key={category} className="pricing-catalog-group">
                  <div className="pricing-catalog-group-label">{category}</div>
                  {categoryProducts.map((product) => {
                    const isActive = selectedProductId === product.id;
                    const priceLabel = product.isOutsourced
                      ? formatPricingCurrency((product.supplierCost ?? 0) * Number(settingsDraft || 2.5))
                      : product.pricingMode === 'FIXED'
                        ? formatPricingCurrency(product.fixedUnitPrice ?? 0)
                        : `${product.pricingTiers.length} faixa(s)`;
                    return (
                      <div
                        key={product.id}
                        className={`pricing-sidebar-item${isActive ? ' pricing-sidebar-item-active' : ''}${!product.active ? ' pricing-sidebar-item-inactive' : ''}`}
                        onClick={() => setSelectedProductId(product.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setSelectedProductId(product.id)}
                      >
                        <div className="pricing-sidebar-item-name">{product.name}</div>
                        <div className="pricing-sidebar-item-meta">
                          <span>{priceLabel}</span>
                          {product.sizeVariations.length > 0 && (
                            <span className="pricing-sv-badge">{product.sizeVariations.length}v</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              {filteredCatalog.length === 0 && (
                <div className="pricing-catalog-empty">Nenhum resultado.</div>
              )}
            </div>
          </div>

          {/* ── EDITOR ── */}
          <div className="pricing-dialog-editor">
            {/* Multiplicador */}
            <Card>
              <CardContent className="pt-5 pricing-settings-row">
                <div className="space-y-2">
                  <Label>Multiplicador terceirizado</Label>
                  <Input
                    type="number"
                    min={0.1}
                    step="0.1"
                    value={settingsDraft}
                    onChange={(e) => setSettingsDraft(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => updateSettings.mutate({ outsourcedMultiplier: Number(settingsDraft) || 2.5 })}
                  disabled={updateSettings.isPending}
                >
                  {updateSettings.isPending ? 'Salvando…' : 'Salvar multiplicador'}
                </Button>
              </CardContent>
            </Card>

            {draft && (
              <Card>
                <CardContent className="pt-5 space-y-5">
                  <div className="pricing-editor-head">
                    <div>
                      <strong>{selectedProduct ? 'Editar produto' : 'Novo produto'}</strong>
                      <div className="pricing-catalog-meta">
                        {selectedProduct ? selectedProduct.category : 'Preencha os campos abaixo'}
                      </div>
                    </div>
                    <Badge variant="outline"><Sparkles size={12} /> Catálogo vivo</Badge>
                  </div>

                  {/* Identificação */}
                  <div className="pricing-form-grid">
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input
                        value={draft.name}
                        onChange={(e) => setDraft((c) => c ? { ...c, name: e.target.value } : c)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Input
                        value={draft.category}
                        onChange={(e) => setDraft((c) => c ? { ...c, category: e.target.value } : c)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria premium</Label>
                      <Input
                        value={draft.premiumCategory}
                        onChange={(e) => setDraft((c) => c ? { ...c, premiumCategory: e.target.value } : c)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Produto legado</Label>
                      <Select
                        value={draft.legacyProdutoTipo || '__NONE__'}
                        onValueChange={(v) => setDraft((c) => c ? { ...c, legacyProdutoTipo: v === '__NONE__' ? '' : v as ProdutoTipo } : c)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__NONE__">Sem vínculo</SelectItem>
                          {LEGACY_PRODUCT_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Modo de precificação */}
                  <div className="pricing-mode-row">
                    {(['PROGRESSIVE', 'FIXED', 'OUTSOURCED'] as PricingMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`pricing-mode-card${effectiveMode === mode ? ' pricing-mode-card-active' : ''}`}
                        onClick={() => setDraft((c) => c ? { ...c, pricingMode: mode, isOutsourced: mode === 'OUTSOURCED' } : c)}
                      >
                        <strong>{PRICING_MODE_LABELS[mode]}</strong>
                      </button>
                    ))}
                  </div>

                  {/* Valores — só campos relevantes ao modo */}
                  <div className="pricing-form-grid">
                    {isOutsourced && (
                      <div className="space-y-2">
                        <Label>Custo fornecedor (R$)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={draft.supplierCost ?? ''}
                          onChange={(e) => setDraft((c) => c ? { ...c, supplierCost: e.target.value === '' ? null : Number(e.target.value) } : c)}
                        />
                      </div>
                    )}
                    {isFixed && (
                      <div className="space-y-2">
                        <Label>Preço unitário fixo (R$)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={draft.fixedUnitPrice ?? ''}
                          onChange={(e) => setDraft((c) => c ? { ...c, fixedUnitPrice: e.target.value === '' ? null : Number(e.target.value) } : c)}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Ordenação</Label>
                      <Input
                        type="number"
                        min={0}
                        value={draft.sortOrder}
                        onChange={(e) => setDraft((c) => c ? { ...c, sortOrder: Number(e.target.value) } : c)}
                      />
                    </div>
                    <div className="pricing-dialog-checks">
                      <label className="pricing-check-card">
                        <input
                          type="checkbox"
                          checked={draft.urgencyEnabled}
                          onChange={(e) => setDraft((c) => c ? { ...c, urgencyEnabled: e.target.checked } : c)}
                        />
                        <span><strong>Urgência</strong><small>+20% / +30%</small></span>
                      </label>
                      <label className="pricing-check-card">
                        <input
                          type="checkbox"
                          checked={draft.active}
                          onChange={(e) => setDraft((c) => c ? { ...c, active: e.target.checked } : c)}
                        />
                        <span><strong>Ativo</strong><small>Visível no catálogo</small></span>
                      </label>
                    </div>
                  </div>

                  {/* Faixas progressivas */}
                  {isProgressive && (
                    <div className="pricing-section-card">
                      <div className="pricing-section-head">
                        <div>
                          <h3>Faixas progressivas</h3>
                          <p>Tabela de preços por volume.</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDraft((c) => c ? {
                            ...c,
                            pricingTiers: [
                              ...c.pricingTiers,
                              {
                                id: makeId('tier'),
                                minQuantity: (c.pricingTiers.at(-1)?.maxQuantity ?? c.pricingTiers.at(-1)?.minQuantity ?? 0) + 1,
                                maxQuantity: null,
                                unitPrice: 0,
                              },
                            ],
                          } : c)}
                        >
                          + Faixa
                        </Button>
                      </div>
                      <div className="pricing-tier-table">
                        <div className="pricing-tier-header pricing-tier-row">
                          <span>Mín.</span><span>Máx.</span><span>R$/un</span><span />
                        </div>
                        {draft.pricingTiers.map((tier) => (
                          <div key={tier.id} className="pricing-tier-row">
                            <Input
                              type="number"
                              value={tier.minQuantity}
                              onChange={(e) => setDraft((c) => c ? { ...c, pricingTiers: c.pricingTiers.map((t) => t.id === tier.id ? { ...t, minQuantity: Number(e.target.value) } : t) } : c)}
                            />
                            <Input
                              type="number"
                              value={tier.maxQuantity ?? ''}
                              placeholder="aberto"
                              onChange={(e) => setDraft((c) => c ? { ...c, pricingTiers: c.pricingTiers.map((t) => t.id === tier.id ? { ...t, maxQuantity: e.target.value === '' ? null : Number(e.target.value) } : t) } : c)}
                            />
                            <Input
                              type="number"
                              step="0.01"
                              value={tier.unitPrice}
                              onChange={(e) => setDraft((c) => c ? { ...c, pricingTiers: c.pricingTiers.map((t) => t.id === tier.id ? { ...t, unitPrice: Number(e.target.value) } : t) } : c)}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDraft((c) => c ? { ...c, pricingTiers: c.pricingTiers.filter((t) => t.id !== tier.id) } : c)}
                            >
                              ✕
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Variações de tamanho/papel/lado */}
                  <div className="pricing-section-card">
                    <div className="pricing-section-head">
                      <div>
                        <h3>Variações</h3>
                        <p>
                          Papel, gramatura, frente/verso.{' '}
                          <span className="pricing-hint">Formato: <code>Tipo|Gramatura|Lado</code></span>
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDraft((c) => c ? {
                          ...c,
                          sizeVariations: [
                            ...c.sizeVariations,
                            {
                              id: makeId('sv'),
                              name: '',
                              value: 0,
                              pricingType: 'FIXED',
                              sortOrder: c.sizeVariations.length * 10,
                            },
                          ],
                        } : c)}
                      >
                        + Variação
                      </Button>
                    </div>
                    <div className="pricing-tier-table">
                      {draft.sizeVariations.length > 0 && (
                        <div className="pricing-tier-header pricing-sv-header">
                          <span>Nome da variação</span>
                          <span>Adicional</span>
                          <span>Tipo</span>
                          <span />
                        </div>
                      )}
                      {draft.sizeVariations.map((sv) => (
                        <div key={sv.id} className="pricing-sv-row">
                          <Input
                            value={sv.name}
                            placeholder="ex: Sulfite|75g|Frente"
                            onChange={(e) => setDraft((c) => c ? { ...c, sizeVariations: c.sizeVariations.map((s) => s.id === sv.id ? { ...s, name: e.target.value } : s) } : c)}
                          />
                          <Input
                            type="number"
                            step="0.01"
                            value={sv.value}
                            onChange={(e) => setDraft((c) => c ? { ...c, sizeVariations: c.sizeVariations.map((s) => s.id === sv.id ? { ...s, value: Number(e.target.value) } : s) } : c)}
                          />
                          <Select
                            value={sv.pricingType}
                            onValueChange={(v) => setDraft((c) => c ? { ...c, sizeVariations: c.sizeVariations.map((s) => s.id === sv.id ? { ...s, pricingType: v as ModifierType } : s) } : c)}
                          >
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="FIXED">R$/un</SelectItem>
                              <SelectItem value="PERCENTAGE">% total</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDraft((c) => c ? { ...c, sizeVariations: c.sizeVariations.filter((s) => s.id !== sv.id) } : c)}
                          >
                            ✕
                          </Button>
                        </div>
                      ))}
                      {draft.sizeVariations.length === 0 && (
                        <div className="pricing-tier-empty">
                          Sem variações — produto sem seletor de papel ou lado.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Acabamentos */}
                  <div className="pricing-section-card">
                    <div className="pricing-section-head">
                      <div>
                        <h3>Acabamentos permitidos</h3>
                        <p>O que aparece como opção no fluxo de vendas.</p>
                      </div>
                    </div>
                    <div className="pricing-chip-grid">
                      {finishCatalog.map((finish) => {
                        const isActive = draft.finishIds.includes(finish.id);
                        return (
                          <button
                            key={finish.id}
                            type="button"
                            className={`pricing-chip${isActive ? ' pricing-chip-active' : ''}`}
                            onClick={() => setDraft((c) => c ? {
                              ...c,
                              finishIds: isActive
                                ? c.finishIds.filter((id) => id !== finish.id)
                                : [...c.finishIds, finish.id],
                            } : c)}
                          >
                            <strong>{finish.name}</strong>
                            <span>{finish.pricingType === 'PERCENTAGE' ? `${finish.value}%` : formatPricingCurrency(finish.value)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pricing-editor-footer">
                    <Button
                      onClick={handleSave}
                      disabled={createProduct.isPending || updateProduct.isPending}
                    >
                      {createProduct.isPending || updateProduct.isPending
                        ? 'Salvando…'
                        : selectedProduct ? 'Salvar alterações' : 'Criar produto'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
