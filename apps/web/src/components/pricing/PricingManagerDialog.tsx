import { useEffect, useMemo, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl pricing-dialog-content">
        <DialogHeader>
          <DialogTitle>Precificação integrada</DialogTitle>
          <DialogDescription>
            Gerencie produtos em cards, ajuste nome e regra comercial sem sair do fluxo de vendas.
          </DialogDescription>
        </DialogHeader>

        <div className="pricing-dialog-shell">
          <div className="pricing-dialog-sidebar">
            <div className="pricing-dialog-toolbar">
              <div>
                <strong>Catálogo premium</strong>
                <div className="pricing-catalog-meta">{productCatalog.length} item(ns) ativos</div>
              </div>
              <Button size="sm" onClick={handleNew}>
                <Plus size={14} />
                Novo item
              </Button>
            </div>

            <div className="pricing-dialog-products">
              {productCatalog.map((product) => {
                const active = selectedProductId === product.id;
                return (
                  <Card
                    key={product.id}
                    className={`pricing-dialog-product-card${active ? ' pricing-dialog-product-card-active' : ''}`}
                    onClick={() => setSelectedProductId(product.id)}
                  >
                    <CardContent className="pt-4">
                      <div className="pricing-catalog-title-row">
                        <strong>{product.name}</strong>
                        <Badge variant={product.isOutsourced ? 'warning' : 'info'}>{PRICING_MODE_LABELS[product.pricingMode]}</Badge>
                      </div>
                      <div className="pricing-catalog-meta">{product.category} · {product.premiumCategory ?? 'Premium livre'}</div>
                      <div className="pricing-catalog-meta">
                        {product.isOutsourced
                          ? `${formatPricingCurrency((product.supplierCost ?? 0) * Number(settingsDraft || 2.5))} final automático`
                          : `${product.pricingTiers.length} faixa(s) configurada(s)`}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="pricing-dialog-editor">
            <Card>
              <CardContent className="pt-5 pricing-settings-row">
                <div className="space-y-2">
                  <Label>Multiplicador terceirizado</Label>
                  <Input type="number" min={0.1} step="0.1" value={settingsDraft} onChange={(event) => setSettingsDraft(event.target.value)} />
                </div>
                <Button onClick={() => updateSettings.mutate({ outsourcedMultiplier: Number(settingsDraft) || 2.5 })} disabled={updateSettings.isPending}>
                  {updateSettings.isPending ? 'Salvando...' : 'Salvar multiplicador'}
                </Button>
              </CardContent>
            </Card>

            {draft && (
              <Card>
                <CardContent className="pt-5 space-y-5">
                  <div className="pricing-editor-head">
                    <div>
                      <strong>{selectedProduct ? 'Editar item' : 'Novo item'}</strong>
                      <div className="pricing-catalog-meta">Cards detalhados e edição comercial rápida.</div>
                    </div>
                    <Badge variant="outline"><Sparkles size={12} /> Catálogo vivo</Badge>
                  </div>

                  <div className="pricing-form-grid">
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input value={draft.name} onChange={(event) => setDraft((current) => current ? { ...current, name: event.target.value } : current)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Input value={draft.category} onChange={(event) => setDraft((current) => current ? { ...current, category: event.target.value } : current)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria premium</Label>
                      <Input value={draft.premiumCategory} onChange={(event) => setDraft((current) => current ? { ...current, premiumCategory: event.target.value } : current)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Produto legado</Label>
                      <Select value={draft.legacyProdutoTipo || '__NONE__'} onValueChange={(value) => setDraft((current) => current ? { ...current, legacyProdutoTipo: value === '__NONE__' ? '' : value as ProdutoTipo } : current)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__NONE__">Sem vínculo</SelectItem>
                          {LEGACY_PRODUCT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="pricing-mode-row">
                    {(['PROGRESSIVE', 'FIXED', 'OUTSOURCED'] as PricingMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`pricing-mode-card${(draft.isOutsourced ? 'OUTSOURCED' : draft.pricingMode) === mode ? ' pricing-mode-card-active' : ''}`}
                        onClick={() => setDraft((current) => current ? { ...current, pricingMode: mode, isOutsourced: mode === 'OUTSOURCED' } : current)}
                      >
                        <strong>{PRICING_MODE_LABELS[mode]}</strong>
                      </button>
                    ))}
                  </div>

                  <div className="pricing-form-grid">
                    <div className="space-y-2">
                      <Label>Custo fornecedor</Label>
                      <Input type="number" min={0} step="0.01" value={draft.supplierCost ?? ''} disabled={!draft.isOutsourced} onChange={(event) => setDraft((current) => current ? { ...current, supplierCost: event.target.value === '' ? null : Number(event.target.value) } : current)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Preço fixo</Label>
                      <Input type="number" min={0} step="0.01" value={draft.fixedUnitPrice ?? ''} disabled={draft.isOutsourced || draft.pricingMode !== 'FIXED'} onChange={(event) => setDraft((current) => current ? { ...current, fixedUnitPrice: event.target.value === '' ? null : Number(event.target.value) } : current)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Ordenação</Label>
                      <Input type="number" min={0} value={draft.sortOrder} onChange={(event) => setDraft((current) => current ? { ...current, sortOrder: Number(event.target.value) } : current)} />
                    </div>
                    <div className="pricing-dialog-checks">
                      <label className="pricing-check-card"><input type="checkbox" checked={draft.urgencyEnabled} onChange={(event) => setDraft((current) => current ? { ...current, urgencyEnabled: event.target.checked } : current)} /><span><strong>Urgência</strong><small>Ativa +20% e +30%</small></span></label>
                    </div>
                  </div>

                  <div className="pricing-section-card">
                    <div className="pricing-section-head">
                      <div>
                        <h3>Faixas</h3>
                        <p>Edite a tabela progressiva inline.</p>
                      </div>
                      <Button size="sm" variant="outline" disabled={draft.isOutsourced || draft.pricingMode !== 'PROGRESSIVE'} onClick={() => setDraft((current) => current ? { ...current, pricingTiers: [...current.pricingTiers, { id: makeId('tier'), minQuantity: (current.pricingTiers.at(-1)?.maxQuantity ?? current.pricingTiers.at(-1)?.minQuantity ?? 0) + 1, maxQuantity: null, unitPrice: 0 }] } : current)}>Adicionar faixa</Button>
                    </div>
                    <div className="pricing-tier-table">
                      <div className="pricing-tier-header pricing-tier-row"><span>Mín.</span><span>Máx.</span><span>Valor</span><span /></div>
                      {draft.pricingTiers.map((tier) => (
                        <div key={tier.id} className="pricing-tier-row">
                          <Input type="number" value={tier.minQuantity} disabled={draft.isOutsourced || draft.pricingMode !== 'PROGRESSIVE'} onChange={(event) => setDraft((current) => current ? { ...current, pricingTiers: current.pricingTiers.map((currentTier) => currentTier.id === tier.id ? { ...currentTier, minQuantity: Number(event.target.value) } : currentTier) } : current)} />
                          <Input type="number" value={tier.maxQuantity ?? ''} disabled={draft.isOutsourced || draft.pricingMode !== 'PROGRESSIVE'} onChange={(event) => setDraft((current) => current ? { ...current, pricingTiers: current.pricingTiers.map((currentTier) => currentTier.id === tier.id ? { ...currentTier, maxQuantity: event.target.value === '' ? null : Number(event.target.value) } : currentTier) } : current)} placeholder="aberto" />
                          <Input type="number" step="0.01" value={tier.unitPrice} disabled={draft.isOutsourced || draft.pricingMode !== 'PROGRESSIVE'} onChange={(event) => setDraft((current) => current ? { ...current, pricingTiers: current.pricingTiers.map((currentTier) => currentTier.id === tier.id ? { ...currentTier, unitPrice: Number(event.target.value) } : currentTier) } : current)} />
                          <Button variant="ghost" size="sm" onClick={() => setDraft((current) => current ? { ...current, pricingTiers: current.pricingTiers.filter((currentTier) => currentTier.id !== tier.id) } : current)}>Remover</Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pricing-section-card">
                    <div className="pricing-section-head">
                      <div>
                        <h3>Acabamentos permitidos</h3>
                        <p>Defina o que aparece como opção no fluxo de vendas.</p>
                      </div>
                    </div>
                    <div className="pricing-chip-grid">
                      {finishCatalog.map((finish) => {
                        const active = draft.finishIds.includes(finish.id);
                        return (
                          <button
                            key={finish.id}
                            type="button"
                            className={`pricing-chip${active ? ' pricing-chip-active' : ''}`}
                            onClick={() => setDraft((current) => current ? {
                              ...current,
                              finishIds: active
                                ? current.finishIds.filter((currentId) => currentId !== finish.id)
                                : [...current.finishIds, finish.id],
                            } : current)}
                          >
                            <strong>{finish.name}</strong>
                            <span>{finish.pricingType === 'PERCENTAGE' ? `${finish.value}%` : formatPricingCurrency(finish.value)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pricing-editor-footer">
                    <Button onClick={handleSave} disabled={createProduct.isPending || updateProduct.isPending}>
                      {createProduct.isPending || updateProduct.isPending ? 'Salvando...' : selectedProduct ? 'Salvar alterações' : 'Criar item'}
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
