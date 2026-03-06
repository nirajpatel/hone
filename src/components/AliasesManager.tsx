import { useState, useEffect, useMemo } from 'react';
import { StandardDialog } from './ui/standard-dialog';
import { AutocompleteDropdown } from './ui/autocomplete-dropdown';
import { Button } from './ui/button';
import { Trash2, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface AliasesManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessToken: string;
}

interface Aliases {
  roasterAliases: Record<string, string>;
  coffeeNameAliases: Record<string, string>;
}

interface AllCoffee {
  roaster: string;
  name: string;
}

export function AliasesManager({ open, onOpenChange, accessToken }: AliasesManagerProps) {
  const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-23508aac`;
  const authHeaders = { Authorization: `Bearer ${accessToken}` };

  const [aliases, setAliases] = useState<Aliases>({ roasterAliases: {}, coffeeNameAliases: {} });
  const [allCoffees, setAllCoffees] = useState<AllCoffee[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Roaster alias form
  const [variantRoaster, setVariantRoaster] = useState('');
  const [canonicalRoaster, setCanonicalRoaster] = useState('');
  const [savingRoaster, setSavingRoaster] = useState(false);

  // Coffee-name alias form
  const [aliasRoaster, setAliasRoaster] = useState('');
  const [variantCoffee, setVariantCoffee] = useState('');
  const [canonicalCoffee, setCanonicalCoffee] = useState('');
  const [savingCoffee, setSavingCoffee] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadData();
  }, [open]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [aliasRes, coffeesRes] = await Promise.all([
        fetch(`${apiUrl}/aliases`, { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
        fetch(`${apiUrl}/coffees/all`, { headers: authHeaders }),
      ]);
      if (aliasRes.ok) setAliases(await aliasRes.json());
      if (coffeesRes.ok) setAllCoffees(await coffeesRes.json());
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoadingData(false);
    }
  };

  const allRoasters = useMemo(
    () => [...new Set(allCoffees.map(c => c.roaster))].sort(),
    [allCoffees]
  );

  const roasterOptions = useMemo(
    () => allRoasters.map(r => ({ value: r, line1: r })),
    [allRoasters]
  );

  const filteredCoffeeOptions = useMemo(() => {
    if (!aliasRoaster) return [];
    const canonical = aliases.roasterAliases[aliasRoaster] ?? aliasRoaster;
    const names = [
      ...new Set(
        allCoffees
          .filter(c => {
            const cr = aliases.roasterAliases[c.roaster] ?? c.roaster;
            return cr === canonical;
          })
          .map(c => c.name)
      ),
    ].sort();
    return names.map(n => ({ value: n, line1: n }));
  }, [aliasRoaster, allCoffees, aliases.roasterAliases]);

  // ── Roaster alias actions ─────────────────────────────────────────────────

  const handleAddRoasterAlias = async () => {
    if (!variantRoaster || !canonicalRoaster) return;
    if (variantRoaster === canonicalRoaster) {
      toast.error('Variant and canonical roaster must differ');
      return;
    }
    setSavingRoaster(true);
    try {
      const res = await fetch(`${apiUrl}/roaster-aliases`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant: variantRoaster, canonical: canonicalRoaster }),
      });
      if (!res.ok) throw new Error();
      toast.success(`"${variantRoaster}" → "${canonicalRoaster}" saved`);
      setVariantRoaster('');
      setCanonicalRoaster('');
      await loadData();
    } catch {
      toast.error('Failed to save roaster alias');
    } finally {
      setSavingRoaster(false);
    }
  };

  const handleDeleteRoasterAlias = async (variant: string) => {
    try {
      const res = await fetch(`${apiUrl}/roaster-aliases`, {
        method: 'DELETE',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Removed alias for "${variant}"`);
      await loadData();
    } catch {
      toast.error('Failed to delete roaster alias');
    }
  };

  // ── Coffee-name alias actions ─────────────────────────────────────────────

  const handleAddCoffeeAlias = async () => {
    if (!aliasRoaster || !variantCoffee || !canonicalCoffee) return;
    if (variantCoffee === canonicalCoffee) {
      toast.error('Variant and canonical coffee names must differ');
      return;
    }
    const canonicalRoasterResolved = aliases.roasterAliases[aliasRoaster] ?? aliasRoaster;
    setSavingCoffee(true);
    try {
      const res = await fetch(`${apiUrl}/coffee-name-aliases`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canonicalRoaster: canonicalRoasterResolved,
          variantCoffeeName: variantCoffee,
          canonicalCoffeeName: canonicalCoffee,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(`"${variantCoffee}" → "${canonicalCoffee}" saved`);
      setVariantCoffee('');
      setCanonicalCoffee('');
      await loadData();
    } catch {
      toast.error('Failed to save coffee-name alias');
    } finally {
      setSavingCoffee(false);
    }
  };

  const handleDeleteCoffeeAlias = async (key: string) => {
    const [canonicalRoasterResolved, variantCoffeeName] = key.split('|');
    try {
      const res = await fetch(`${apiUrl}/coffee-name-aliases`, {
        method: 'DELETE',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonicalRoaster: canonicalRoasterResolved, variantCoffeeName }),
      });
      if (!res.ok) throw new Error();
      toast.success('Coffee-name alias removed');
      await loadData();
    } catch {
      toast.error('Failed to delete coffee-name alias');
    }
  };

  const roasterAliasEntries = Object.entries(aliases.roasterAliases).sort(([a], [b]) => a.localeCompare(b));
  const coffeeNameAliasEntries = Object.entries(aliases.coffeeNameAliases).sort(([a], [b]) => a.localeCompare(b));

  return (
    <StandardDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Manage Aliases"
      subtitle="Link variant roaster and coffee names to their canonical versions."
      maxWidth="52rem"
      maxHeight="90dvh"
    >
      {loadingData ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-8 pb-6">

          {/* ── Roaster aliases ──────────────────────────────────────────── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Roaster aliases</h3>
            <p className="text-xs text-gray-400 mb-4">
              Map a variant roaster name to its canonical name. All coffees from the variant will resolve to the canonical roaster.
            </p>

            <div className="flex gap-2 items-end mb-4">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Variant name</label>
                <AutocompleteDropdown
                  value={variantRoaster}
                  onChange={setVariantRoaster}
                  options={roasterOptions}
                  placeholder="e.g. Desnudo"
                />
              </div>
              <div className="text-gray-400 self-center pb-0.5">→</div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Canonical name</label>
                <AutocompleteDropdown
                  value={canonicalRoaster}
                  onChange={setCanonicalRoaster}
                  options={roasterOptions}
                  placeholder="e.g. Desnudo Coffee"
                />
              </div>
              <Button
                onClick={handleAddRoasterAlias}
                disabled={!variantRoaster || !canonicalRoaster || savingRoaster}
                size="sm"
                className="cursor-pointer flex-shrink-0"
              >
                {savingRoaster ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add
              </Button>
            </div>

            {roasterAliasEntries.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No roaster aliases defined yet.</p>
            ) : (
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                {roasterAliasEntries.map(([variant, canonical], i) => (
                  <div
                    key={variant}
                    className={`flex items-center justify-between px-4 py-2.5 text-sm ${i !== 0 ? 'border-t border-gray-100' : ''}`}
                  >
                    <span className="text-gray-800">
                      <span className="font-medium">{variant}</span>
                      <span className="text-gray-400 mx-2">→</span>
                      <span>{canonical}</span>
                    </span>
                    <button
                      onClick={() => handleDeleteRoasterAlias(variant)}
                      className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer ml-4 flex-shrink-0"
                      title="Remove alias"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Coffee-name aliases ──────────────────────────────────────── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Coffee-name aliases</h3>
            <p className="text-xs text-gray-400 mb-4">
              For a given roaster, link a variant coffee name to its canonical name.
            </p>

            <div className="flex gap-2 items-end mb-4 flex-wrap">
              <div className="flex-1 min-w-[10rem]">
                <label className="block text-xs text-gray-500 mb-1">Roaster</label>
                <AutocompleteDropdown
                  value={aliasRoaster}
                  onChange={(v) => { setAliasRoaster(v); setVariantCoffee(''); setCanonicalCoffee(''); }}
                  options={roasterOptions}
                  placeholder="Select roaster"
                />
              </div>
              <div className="flex-1 min-w-[10rem]">
                <label className="block text-xs text-gray-500 mb-1">Variant coffee name</label>
                <AutocompleteDropdown
                  value={variantCoffee}
                  onChange={setVariantCoffee}
                  options={filteredCoffeeOptions}
                  placeholder="Variant name"
                  disabled={!aliasRoaster}
                />
              </div>
              <div className="text-gray-400 self-center pb-0.5">→</div>
              <div className="flex-1 min-w-[10rem]">
                <label className="block text-xs text-gray-500 mb-1">Canonical coffee name</label>
                <AutocompleteDropdown
                  value={canonicalCoffee}
                  onChange={setCanonicalCoffee}
                  options={filteredCoffeeOptions}
                  placeholder="Canonical name"
                  disabled={!aliasRoaster}
                />
              </div>
              <Button
                onClick={handleAddCoffeeAlias}
                disabled={!aliasRoaster || !variantCoffee || !canonicalCoffee || savingCoffee}
                size="sm"
                className="cursor-pointer flex-shrink-0"
              >
                {savingCoffee ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add
              </Button>
            </div>

            {coffeeNameAliasEntries.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No coffee-name aliases defined yet.</p>
            ) : (
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                {coffeeNameAliasEntries.map(([key, canonicalValue], i) => {
                  const [roasterPart, variantName] = key.split('|');
                  const canonicalName = canonicalValue.split('|')[1] ?? canonicalValue;
                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-between px-4 py-2.5 text-sm ${i !== 0 ? 'border-t border-gray-100' : ''}`}
                    >
                      <span className="text-gray-800">
                        <span className="text-gray-400 text-xs mr-2">{roasterPart}</span>
                        <span className="font-medium">{variantName}</span>
                        <span className="text-gray-400 mx-2">→</span>
                        <span>{canonicalName}</span>
                      </span>
                      <button
                        onClick={() => handleDeleteCoffeeAlias(key)}
                        className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer ml-4 flex-shrink-0"
                        title="Remove alias"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </StandardDialog>
  );
}
